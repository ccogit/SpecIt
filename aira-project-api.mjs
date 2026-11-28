import { createHash, randomUUID } from 'node:crypto';
import { parseAiraJson } from './aira-identities.mjs';

const fail = code => { throw Object.assign(Error(code), {code}); };
const need = (value, code = 'INVALID_SCHEMA') => { if (!value) fail(code); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = bytes => parseAiraJson(new TextDecoder('utf-8', {fatal:true, ignoreBOM:true}).decode(bytes));
const encode = files => Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, bytes.toString('base64')]));
function decode(files) {
  need(object(files));
  return Object.fromEntries(Object.entries(files).map(([path, raw]) => {
    need(typeof raw === 'string');
    const bytes = Buffer.from(raw, 'base64');
    need(bytes.toString('base64') === raw, 'INVALID_HASH');
    return [path, bytes];
  }));
}
export const projectRoutes = ['/api/aira/project','/api/aira/history','/api/aira/v2/restore','/api/aira/preview/invalidate'];
export function projectError(error) {
  const codes = ['INVALID_SCHEMA','INVALID_HASH','INVALID_PATH','WRONG_TARGET','HISTORY_CONFLICT','ID_CONFLICT','CONTENT_DRIFT','BLOCKER_OPEN','APPROVAL_REQUIRED','APPROVAL_STALE','REPLAY','MUTATION_UNCERTAIN','CONTEXT_UNAVAILABLE','EVIDENCE_MISMATCH','POLICY_DENIED','VERSION_MISMATCH','SOURCE_UNAVAILABLE'];
  const code = codes.includes(error?.code) ? error.code : 'INVALID_SCHEMA';
  const status = code === 'POLICY_DENIED' || code === 'WRONG_TARGET' ? 403 :
    ['HISTORY_CONFLICT','APPROVAL_STALE','CONTEXT_UNAVAILABLE','REPLAY'].includes(code) ? 409 : 400;
  return {status, data:{error:'Aira-Projekt: '+code, code}};
}

// All I/O is local. The existing HTTP server applies its Host/Origin/body-size
// gate before calling dispatch. Only the server-selected project authorizes Run.
export function createProjectApi({store, runStatus, normalizePlan, preview, buildFiles, exportFiles, zipFiles, makeRecord, validateRecord, now=Date.now}) {
  let starting = false, pending = null;
  const owner = randomUUID();
  function localObservation() {
    if (starting) return 'running';
    try {
      const status = runStatus();
      if (status?.active === true || status?.items?.some(x => ['running','waiting'].includes(x.state))) return 'running';
      return status?.active === false && Array.isArray(status.items) && status.items.every(x => ['done','failed','stopped','skipped','blocked'].includes(x.state)) ? 'idle' : 'unknown';
    } catch { return 'unknown'; }
  }
  function observation() {
    const local = localObservation(), reservation = store.active().local_run;
    if (!reservation) return local;
    if (reservation.owner !== owner) return 'unknown';
    if (local === 'idle') {store.releaseRun(owner,reservation.token);return 'idle';}
    return local;
  }
  function context(body) {
    const {project, selection} = store.active();
    need(project?.mode === 'aira' && project.binding, 'WRONG_TARGET');
    need(body.project_id === project.project_id && body.selection === selection, 'HISTORY_CONFLICT');
    need(body.plan_id === project.binding.plan_id && body.repo === project.binding.repo, 'WRONG_TARGET');
    return {project, selection};
  }
  function history(body) {
    const {project, selection} = context(body), entries = store.history(project.project_id);
    const record = entries.at(-1)?.record ?? null;
    return {project, selection, record,
      history: entries.map(entry => ({revision:json(entry.files['manifest.json']).revision, manifest_sha256:entry.manifest_sha256})),
      export_status: entries.length ? 'archived' : 'not_exported', last_known_receipt:null,
      ...(body.action === 'backup' ? {packages:entries.map(e => encode(e.files)),records:entries.map(e => e.record ?? null)} : {})};
  }
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
    return value;
  }
  const fingerprint = body => {
    const {approved,changes_approved,expected_manifest_sha256,preview_id,...inputs}=body;
    return hash(JSON.stringify(canonical(inputs)));
  };
  function comparison(prev, files) {
    const m=json(files['manifest.json']), r=json(files['requirements.json']);
    const old=prev?json(prev.files['manifest.json']):null, prior=prev?json(prev.files['requirements.json']):null;
    const entities=(manifest,req)=>new Map([...(manifest?.plan?.tasks??[]),...(req?.requirements??[]),...(req?.criteria??[]),...(req?.tests??[]),...(req?.decisions??[])].map(x=>[x.id,x]));
    const a=entities(old,prior),b=entities(m,r);
    const points=manifest=>Object.fromEntries([...Object.entries(manifest?.tasks??{}),...(manifest?.blockers??[]).map(x=>[x.id,x])].map(([id,x])=>[id,x.points]));
    const before=points(old),after=points(m);
    return {previous_revision:old?.revision??null, spec_changed:old!==null&&old.spec_sha256!==m.spec_sha256,
      added:[...b.keys()].filter(id=>!a.has(id)),removed:[...a.keys()].filter(id=>!b.has(id)),
      changed:[...b.keys()].filter(id=>a.has(id)&&JSON.stringify(canonical(a.get(id)))!==JSON.stringify(canonical(b.get(id)))),
      points_changed:Object.keys(after).filter(id=>before[id]!==after[id]).map(id=>({id,before:before[id]??null,after:after[id]}))};
  }
  function current(body) {
    const {project, selection} = context(body);
    need(body.expected_generation === project.generation && body.expected_head === project.manifest_sha256, 'HISTORY_CONFLICT');
    need(body.expected_export_epoch === project.export_epoch, 'APPROVAL_STALE');
    const entries = store.history(project.project_id), prev = entries.at(-1);
    need(body.revision === project.revision + 1, 'HISTORY_CONFLICT');
    // The browser may show a cached predecessor but may not supply it as authority.
    if (Object.hasOwn(body,'previous_manifest_sha256')) need(body.previous_manifest_sha256 === project.manifest_sha256, 'HISTORY_CONFLICT');
    const {project_id, selection: ignored, expected_generation, expected_head, expected_export_epoch, preview_id, mapping, previous, previous_manifest_sha256, ...input} = body;
    const payload = {...input, previous_manifest_sha256:project.manifest_sha256,
      ...(prev ? {previous:{manifest_bytes:prev.files['manifest.json'],requirements_bytes:prev.files['requirements.json']}} : {})};
    return {project, selection, prev, payload, mapping};
  }
  function dispatch(path, body) {
    need(object(body));
    if (path === '/api/aira/project') {
      if (body.action === 'status') {
        const run_observation = observation(), {local_run, ...state} = store.active();
        return {...state,run_observation};
      }
      need(body.action === 'activate' && body.confirmed === true, 'APPROVAL_REQUIRED');
      const source = body.source ? {...body.source, ...(body.source.plan ? {plan:normalizePlan(body.source.plan)} : {})} : undefined;
      const selected=store.activate({expected_selection:body.expected_selection,mode:body.mode,
        binding:body.binding,project_id:body.project_id,source,observation:observation()});
      pending=null;return selected;
    }
    if (path === '/api/aira/history') return history(body);
    if (path === '/api/aira/preview/invalidate') {
      context(body);
      if(pending?.id===body.preview_id)pending=null;
      return {invalidated:true};
    }
    if (path === '/api/aira/v2/restore') {
      const {project, selection} = context(body);
      need(body.expected_generation === project.generation && body.expected_head === project.manifest_sha256, 'HISTORY_CONFLICT');
      need(body.expected_export_epoch === project.export_epoch, 'APPROVAL_STALE');
      need(Array.isArray(body.packages) && body.packages.length && Array.isArray(body.records) && body.records.length === body.packages.length);
      const packages = body.packages.map(decode);
      const records = packages.map((files,i) => {
        const record = body.records[i] ?? makeRecord(files, {}, null, null);
        need(record.manifest_sha256 === hash(files['manifest.json']) && record.manifest_bytes === files['manifest.json'].toString('utf8') && record.requirements_bytes === files['requirements.json'].toString('utf8'), 'INVALID_HASH');
        need(validateRecord(record, project.binding) === true, 'INVALID_SCHEMA');
        return record;
      });
      store.restore(project.project_id,{packages,records,expected_generation:project.generation,expected_head:project.manifest_sha256,expected_selection:selection,expected_export_epoch:project.export_epoch});
      pending=null;return history(body);
    }
    need(body.schema_version === 2, 'VERSION_MISMATCH');
    const {project, selection, prev, payload, mapping} = current(body);
    if (path === '/api/aira/preview') {
      pending=null;
      const result=preview(payload), files=buildFiles(payload);
      need(hash(files['manifest.json'])===result.manifest_sha256,'INVALID_HASH');
      const record=makeRecord(files,mapping??{},payload.migration,prev?.record);
      need(validateRecord(record,project.binding)===true,'INVALID_SCHEMA');
      if(result.unchanged && prev?.record) need(JSON.stringify(canonical(record))===JSON.stringify(canonical(prev.record)), 'HISTORY_CONFLICT');
      pending={id:randomUUID(),fingerprint:fingerprint(body),files,record,manifest_sha256:result.manifest_sha256,expires:now()+300000};
      return {...result,preview_id:pending.id,expires_at:pending.expires,comparison:comparison(prev,files)};
    }
    need(path === '/api/aira/export');
    need(payload.approved===true && payload.changes_approved===true,'APPROVAL_REQUIRED');
    const frozen=pending;
    need(frozen && frozen.id===body.preview_id && frozen.expires>now() && frozen.fingerprint===fingerprint(body) &&
      frozen.manifest_sha256===payload.expected_manifest_sha256,'APPROVAL_STALE');
    pending=null; // single-use authorization, even if the subsequent archive fails
    const verified=exportFiles(payload);
    need(Object.keys(verified).length===Object.keys(frozen.files).length &&
      Object.entries(frozen.files).every(([name,bytes])=>Buffer.isBuffer(verified[name])&&bytes.equals(verified[name])),'CONTENT_DRIFT');
    const zip=zipFiles(frozen.files);
    store.append(project.project_id,{files:frozen.files,record:frozen.record,expected_generation:project.generation,expected_head:project.manifest_sha256,expected_selection:selection,expected_export_epoch:project.export_epoch});
    return zip;
  }
  function assertRun(body) {
    // Reject integrated selection even when the caller omits all client metadata.
    store.assertRun(body);
    if (body.plan) store.assertRun({...body,plan:normalizePlan(body.plan)});
  }
  async function startRun(body, start) {
    assertRun(body);
    need(observation() === 'idle', 'CONTEXT_UNAVAILABLE');
    const normalized = body.plan ? {...body,plan:normalizePlan(body.plan)} : body;
    const token = store.reserveRun(normalized, owner);
    starting = true;
    try { return await start(); } finally {
      starting = false;
      if (localObservation() === 'idle') store.releaseRun(owner,token);
    }
  }
  return {dispatch, assertRun, startRun};
}

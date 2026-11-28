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
export const projectRoutes = ['/api/aira/project','/api/aira/history','/api/aira/v2/restore'];
export function projectError(error) {
  const codes = ['INVALID_SCHEMA','INVALID_HASH','INVALID_PATH','WRONG_TARGET','HISTORY_CONFLICT','ID_CONFLICT','CONTENT_DRIFT','BLOCKER_OPEN','APPROVAL_REQUIRED','APPROVAL_STALE','REPLAY','MUTATION_UNCERTAIN','CONTEXT_UNAVAILABLE','EVIDENCE_MISMATCH','POLICY_DENIED','VERSION_MISMATCH','SOURCE_UNAVAILABLE'];
  const code = codes.includes(error?.code) ? error.code : 'INVALID_SCHEMA';
  const status = code === 'POLICY_DENIED' || code === 'WRONG_TARGET' ? 403 :
    ['HISTORY_CONFLICT','APPROVAL_STALE','CONTEXT_UNAVAILABLE','REPLAY'].includes(code) ? 409 : 400;
  return {status, data:{error:'Aira-Projekt: '+code, code}};
}

// All I/O is local. The existing HTTP server applies its Host/Origin/body-size
// gate before calling dispatch. Only the server-selected project authorizes Run.
export function createProjectApi({store, runStatus, normalizePlan, preview, exportFiles, zipFiles, makeRecord, validateRecord}) {
  let starting = false;
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
  function current(body) {
    const {project, selection} = context(body);
    need(body.expected_generation === project.generation && body.expected_head === project.manifest_sha256, 'HISTORY_CONFLICT');
    const entries = store.history(project.project_id), prev = entries.at(-1);
    need(body.revision === project.revision + 1, 'HISTORY_CONFLICT');
    // The browser may show a cached predecessor but may not supply it as authority.
    if (Object.hasOwn(body,'previous_manifest_sha256')) need(body.previous_manifest_sha256 === project.manifest_sha256, 'HISTORY_CONFLICT');
    const {project_id, selection: ignored, expected_generation, expected_head, mapping, previous, previous_manifest_sha256, ...input} = body;
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
      return store.activate({expected_selection:body.expected_selection,mode:body.mode,
        binding:body.binding,project_id:body.project_id,source,observation:observation()});
    }
    if (path === '/api/aira/history') return history(body);
    if (path === '/api/aira/v2/restore') {
      const {project, selection} = context(body);
      need(body.expected_generation === project.generation && body.expected_head === project.manifest_sha256, 'HISTORY_CONFLICT');
      need(Array.isArray(body.packages) && body.packages.length && Array.isArray(body.records) && body.records.length === body.packages.length);
      const packages = body.packages.map(decode);
      const records = packages.map((files,i) => {
        const record = body.records[i] ?? makeRecord(files, {}, null, null);
        need(record.manifest_sha256 === hash(files['manifest.json']) && record.manifest_bytes === files['manifest.json'].toString('utf8') && record.requirements_bytes === files['requirements.json'].toString('utf8'), 'INVALID_HASH');
        need(validateRecord(record, project.binding) === true, 'INVALID_SCHEMA');
        return record;
      });
      store.restore(project.project_id,{packages,records,expected_generation:project.generation,expected_head:project.manifest_sha256,expected_selection:selection});
      return history(body);
    }
    need(body.schema_version === 2, 'VERSION_MISMATCH');
    const {project, selection, prev, payload, mapping} = current(body);
    if (path === '/api/aira/preview') return preview(payload);
    need(path === '/api/aira/export');
    need(typeof payload.expected_manifest_sha256 === 'string', 'APPROVAL_REQUIRED');
    const files = exportFiles(payload);
    const record = makeRecord(files, mapping ?? {}, payload.migration, prev?.record);
    need(validateRecord(record, project.binding) === true, 'INVALID_SCHEMA');
    const zip = zipFiles(files); // generate before publishing the atomic archive
    store.append(project.project_id,{files,record,expected_generation:project.generation,expected_head:project.manifest_sha256,expected_selection:selection});
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

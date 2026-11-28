import {artifactPath, sha256} from './aira-export.mjs';
import {codepointCompare,parseAiraJson} from './aira-identities.mjs';
import {confirmRequirementRevision} from './aira-requirement-revisions.mjs';
import {verifyV1Migration} from './aira-v1-migration.mjs';
import {checkRequirementCoverage, restoreRequirementHighWater} from './aira-requirement-identities.mjs';
import {canonicalV2Json, projectV2EvidenceLine} from './aira-v2-projection.mjs';
import {validatePlan} from './planner.mjs';

function requireValue(condition, code, field) {
  if (!condition) throw Object.assign(new Error('Aira-Export: V2 '+code+' – '+field), {code});
}

const schema = (condition, field) => requireValue(condition, 'INVALID_SCHEMA', field);
const identity = (condition, field) => requireValue(condition, 'ID_CONFLICT', field);
const history = (condition, field) => requireValue(condition, 'HISTORY_CONFLICT', field);
const plain = value => value != null && Object.getPrototypeOf(value) === Object.prototype;
const text = value => typeof value === 'string' && value.isWellFormed() && !value.includes('\r') && value.length<=1000 && Boolean(value.trim());
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const bullets = values => values.length ? values.map(value => '- ' + value).join('\n') : '- (keine)';
const section = (name, body) => '## ' + name + '\n\n' + body;

function canonical(value, field) {
  try {
    return canonicalV2Json(value);
  } catch {
    schema(false, field);
  }
}

function canonicalManifest(manifest) {
  const json = canonicalV2Json(manifest);
  // The branched reference retains the fractional digit for a whole-minute target.
  return json.replace(/^(  "target_minutes": [0-9]+),$/m, '$1.0,');
}

function bytes(value, field) {
  schema(value instanceof Uint8Array || typeof value === 'string' && value.isWellFormed(), field);
  return Buffer.from(value);
}


const equal = (a,b) => canonicalV2Json(a) === canonicalV2Json(b);
const exact = (value, fields, name, optional=[]) => schema(plain(value) && fields.every(k=>Object.hasOwn(value,k)) && Object.keys(value).every(k=>fields.includes(k)||optional.includes(k)),name);
const utc = x => typeof x==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString()===x.replace('Z','.000Z');
const localEvidence = x => text(x) && x.length<=240 && !/^(?:\/|[A-Za-z][A-Za-z0-9+.-]*:)/.test(x) && !x.includes('\\') && !x.split('/').includes('..');
const point = x => [1,2,3,5,8].includes(x);
const minute = (x,max) => typeof x==='number'&&Number.isFinite(x)&&x>0&&x<=max&&Math.abs(x*100-Math.round(x*100))<1e-7;
const strictlySorted = (entries,key) => entries.every((entry,i)=>i===0||codepointCompare(entries[i-1][key],entry[key])<0);
const kinds = {requirement:/^(FR|NFR)-/,task:/^T\d{2,3}$/,decision:/^B\d{2}$/,criterion:/^AC-/,test:/^TC-/};

function rawJson(value, field) {
  const raw = bytes(value,field);
  let parsed;
  try {
    const decoded=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw);
    if(decoded.charCodeAt(0)===0xfeff)throw Error('BOM');
    parsed=parseAiraJson(decoded);
    canonicalV2Json(parsed); // validate scalar values and numbers; NEVER hash the reserialization
  }catch{schema(false,field);}
  return {raw,value:parsed};
}
function checkPlan(plan) {
  let validated;
  try {validated=validatePlan(plan);}catch{schema(false,'plan');}
  schema(canonical(plan,'plan JSON')===canonicalV2Json(validated)&&!containsCR(plan),'normalized plan');
  schema(plan.tasks.every(t=>/^T(?:0[1-9]|[1-9][0-9]{1,2})$/.test(t.id)&&minute(t.minutes,2880)&&t.minutes>=.05&&
    (!Object.hasOwn(t,'raw')||minute(t.raw,Number.MAX_SAFE_INTEGER))&&
    !/[\p{Cc}\u2028\u2029|;\\]/u.test(t.title)&&!t.title.startsWith('#')&&!/^[:\-\s]+$/.test(t.title)&&
    new Set(t.blockedBy).size===t.blockedBy.length&&new Set(t.features).size===t.features.length),'task fields');
  return validated;
}
function checkManifest(m) {
  exact(m,['schema_version','plan_id','revision','repo','spec_sha256','target_minutes','plan','tasks','blockers','artifacts','previous_manifest_sha256','requirements_sha256','draft_files','mode'],'manifest fields',['target_minutes_reason']);
  requireValue(m.schema_version===2,'VERSION_MISMATCH','schema version');
  schema(m.mode==='aira'&&typeof m.plan_id==='string'&&/^[A-Za-z0-9][A-Za-z0-9-]{0,23}$/.test(m.plan_id)&&typeof m.repo==='string'&&/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(m.repo)&&m.repo.split('/').every(x=>x!=='.'&&x!=='..')&&!/\.git$/i.test(m.repo)&&Number.isSafeInteger(m.revision)&&m.revision>0,'manifest binding');
  schema(hash(m.spec_sha256)&&hash(m.requirements_sha256)&& (m.revision===1?m.previous_manifest_sha256===null:hash(m.previous_manifest_sha256)),'manifest hashes');
  schema(m.target_minutes===null?m.target_minutes_reason==='not_available':minute(m.target_minutes,1e9)&&!Object.hasOwn(m,'target_minutes_reason'),'target minutes');
  checkPlan(m.plan);
  schema(plain(m.tasks)&&Array.isArray(m.blockers)&&Array.isArray(m.artifacts)&&Array.isArray(m.draft_files),'manifest mappings');
  const order=[...m.blockers.map(b=>b.id),...m.plan.waves.flatMap(w=>[...w].sort(codepointCompare))];
  identity(order.length<=99&&new Set(order).size===order.length&&Object.keys(m.tasks).length===m.plan.tasks.length&&m.plan.tasks.every(t=>Object.hasOwn(m.tasks,t.id)),'manifest identities');
  schema(strictlySorted(m.blockers,'id'),'blocker order');
  const paths=[];
  for(const [i,id] of order.entries()){
    const task=m.plan.tasks.find(t=>t.id===id),entry=task?m.tasks[id]:m.blockers.find(b=>b.id===id);
    exact(entry,task?['epic_title','item_title','file','points']:['id','decision','epic_title','item_title','file','points'],'work item mapping');
    const prefix='SpecIt '+m.plan_id+' '+id+' – ';
    schema(point(entry.points)&&entry.epic_title===prefix+(task?task.title:'Entscheidung klären')&&entry.item_title===prefix+(task?'Umsetzung: '+task.title:'Entscheidung dokumentieren')&&(task||(/^B(?:0[1-9]|[1-9][0-9])$/.test(id)&&text(entry.decision))),'work item mapping');
    const path='draft/'+String(i+1).padStart(2,'0')+'-'+id+'.md';
    requireValue(entry.file===path,'INVALID_PATH','work item path');paths.push(path);
  }
  paths.push('draft/EPICS.md');
  requireValue(m.draft_files.length===paths.length,'INVALID_PATH','draft paths');
  for(const [i,entry] of m.draft_files.entries()){
    exact(entry,['path','sha256'],'draft declaration');
    requireValue(entry.path===paths[i],'INVALID_PATH','draft path');requireValue(hash(entry.sha256),'INVALID_HASH','draft hash');
  }
  const artifactNames=new Set();
  for(const a of m.artifacts){
    exact(a,['path','sha256'],'artifact declaration');
    try{artifactPath(a.path);}catch{requireValue(false,'INVALID_PATH','artifact path');}
    requireValue(!artifactNames.has(a.path.toLowerCase()),'INVALID_PATH','artifact collision');artifactNames.add(a.path.toLowerCase());
    requireValue(hash(a.sha256),'INVALID_HASH','artifact hash');
  }
  requireValue(strictlySorted(m.artifacts,'path'),'INVALID_PATH','artifact order');
  for(const path of artifactNames) requireValue(path.split('/').every((_,i)=>!artifactNames.has(path.split('/').slice(0,i).join('/'))),'INVALID_PATH','artifact parent');
}

function activeIds(plan, requirements) {
  return [...plan.tasks, ...requirements.requirements, ...requirements.decisions,
    ...requirements.criteria, ...requirements.tests].map(entry => entry.id);
}

function validateIdentities(plan, requirements) {
  const active = activeIds(plan, requirements);
  const retired = requirements.retired_ids.map(entry => entry.id);
  let counters;
  try {
    counters = restoreRequirementHighWater({}, active, retired);
  } catch {
    identity(false, 'active or retired identities');
  }
  return {active, retired, counters};
}

function references(ids, targets, field) {
  schema(Array.isArray(ids) && new Set(ids).size === ids.length && ids.every(id => targets.has(id)), field);
}

function validateRequirements(plan, data) {
  exact(data,['schema_version','plan_id','revision','requirements','criteria','tests','decisions','exceptions','retired_ids'],'requirements fields');
  const {requirements, decisions, criteria, tests, exceptions, retired_ids} = data;
  const limits=[[requirements,500],[decisions,99],[criteria,1200],[tests,1200],[exceptions,500],[retired_ids,5000]];
  schema(limits.every(([list,max])=>Array.isArray(list)&&list.length<=max&&list.every(plain)),'requirements lists');
  const identities = validateIdentities(plan, data);
  const taskIds = new Set(plan.tasks.map(task => task.id));
  const requirementIds = new Set(requirements.map(entry => entry.id));
  const byDecision = new Map(decisions.map(decision => [decision.id, decision]));
  const openByTask = new Map(plan.tasks.map(task => [task.id, []]));
  const allByTask = new Map(plan.tasks.map(task => [task.id, []]));
  for(const r of requirements){
    exact(r,['id','text','mandatory','state'],'requirement fields');
    schema(text(r.text)&&typeof r.mandatory==='boolean'&&['approved','deferred'].includes(r.state),'requirement data');
    identity(kinds.requirement.test(r.id),'requirement namespace');
  }
  for (const decision of decisions) {
    exact(decision,['id','text','state','task_ids','requirement_ids','resolution','evidence_ref','confirmed_by','confirmed_at'],'decision fields');
    identity(kinds.decision.test(decision.id), 'decision identity');
    schema(text(decision.text), 'decision text');
    references(decision.task_ids, taskIds, 'decision tasks');schema(decision.task_ids.length>0,'decision task references');
    references(decision.requirement_ids, requirementIds, 'decision requirements');
    const confirmation = [decision.resolution, decision.confirmed_by, decision.confirmed_at, decision.evidence_ref];
    schema(decision.state === 'open' && confirmation.every(value => value === null)
      || decision.state === 'resolved' && text(decision.resolution)&&text(decision.confirmed_by)&&utc(decision.confirmed_at)&&localEvidence(decision.evidence_ref), 'decision confirmation');
    for (const id of decision.task_ids) {
      allByTask.get(id).push(decision);
      if(decision.state==='open')openByTask.get(id).push(decision);
    }
  }
  for (const task of plan.tasks) {
    references(task.requirements, requirementIds, 'plan task requirements');
    const decisionTexts = openByTask.get(task.id).map(decision => decision.text);
    schema(equal(decisionTexts,[...task.blockedBy]),'open decisions for ' + task.id);
    schema(equal(task.acceptance,criteria.filter(c=>c.task_id===task.id).map(c=>c.text))&&equal(task.tests,tests.filter(c=>c.task_id===task.id).map(c=>c.description)),'exact acceptance/test projection for '+task.id);
  }
  const criteriaByOwner = new Map();
  for (const criterion of criteria) {
    exact(criterion,['id','task_id','requirement_ids','text','verification','decision_id'],'criterion fields');
    const {id, task_id, decision_id, requirement_ids} = criterion;
    identity(id.startsWith('AC-' + task_id + '-'), 'criterion owner identity');
    schema(taskIds.has(task_id) ? decision_id === null : byDecision.has(task_id) && decision_id === task_id,'criterion owner and decision');
    schema(text(criterion.text) && ['test','manual','inspection'].includes(criterion.verification), 'criterion text and verification');
    references(requirement_ids, requirementIds, 'criterion requirements');
    if(taskIds.has(task_id)){
      const task=plan.tasks.find(t=>t.id===task_id);
      schema(requirement_ids.length>0&&requirement_ids.every(id=>task.requirements.includes(id)),'criterion requirements outside task');
    }
    if (!criteriaByOwner.has(task_id)) criteriaByOwner.set(task_id, new Set());
    criteriaByOwner.get(task_id).add(id);
  }
  for (const entry of tests) {
    exact(entry,['id','task_id','criterion_ids','description'],'test fields');
    identity(entry.id.startsWith('TC-' + entry.task_id + '-'), 'test owner identity');
    schema((taskIds.has(entry.task_id) || byDecision.has(entry.task_id)) && text(entry.description),'test owner and description');
    references(entry.criterion_ids, criteriaByOwner.get(entry.task_id) ?? new Set(), 'test criteria');schema(entry.criterion_ids.length>0,'test references');
  }
  for(const id of [...taskIds,...byDecision.keys()])schema(criteriaByOwner.has(id),'missing criterion for '+id);
  for(const c of criteria)if(c.verification==='test')schema(tests.some(t=>t.criterion_ids.includes(c.id)),'missing test for '+c.id);
  for(const e of exceptions){
    exact(e,['requirement_id','reason','approved_by','approved_at'],'exception fields');
    schema(text(e.reason)&&text(e.approved_by)&&utc(e.approved_at),'exception approval');
  }
  for(const e of retired_ids){
    exact(e,['kind','id','reason','retired_revision'],'tombstone fields');
    identity(Object.hasOwn(kinds,e.kind)&&kinds[e.kind].test(e.id),'tombstone namespace');
    schema(text(e.reason)&&Number.isSafeInteger(e.retired_revision)&&e.retired_revision>0&&e.retired_revision<=data.revision,'tombstone metadata');
  }
  schema(strictlySorted(requirements,'id')&&strictlySorted(decisions,'id')&&strictlySorted(retired_ids,'id'),'identity ordering');
  try {
    checkRequirementCoverage(requirements, criteria.map(entry => entry.requirement_ids),exceptions.map(entry => entry.requirement_id));
  } catch (error) {schema(false, error.message);}
  return {openByTask, allByTask, identities};
}

// Decode original archived bytes exactly once. A parsed object is not a
// predecessor proof: whitespace, escapes and final LF are part of the hash.
export function readV2Predecessor(previous) {
  history(plain(previous)&&Object.hasOwn(previous,'manifest_bytes')&&Object.hasOwn(previous,'requirements_bytes'),'original predecessor bytes required');
  const m=rawJson(previous.manifest_bytes,'predecessor manifest'),r=rawJson(previous.requirements_bytes,'predecessor requirements');
  checkManifest(m.value);
  const manifest=m.value,requirements=r.value;
  history(requirements.schema_version===2&&requirements.plan_id===manifest.plan_id&&requirements.revision===manifest.revision&&sha256(r.raw)===manifest.requirements_sha256,'predecessor requirements binding');
  const checked=validateRequirements(manifest.plan,requirements);
  schema(manifest.blockers.length===requirements.decisions.length&&manifest.blockers.every((b,i)=>b.id===requirements.decisions[i].id&&b.decision===requirements.decisions[i].text),'predecessor blocker mapping');
  return {manifest,requirements,manifestBytes:m.raw,requirementsBytes:r.raw,identities:checked.identities};
}
function validateHistory(input, identities) {
  const {previous, revision, previous_manifest_sha256, plan_id, repo, requirements} = input;
  if (revision === 1) {
    history(previous == null && previous_manifest_sha256 === null, 'initial revision predecessor');
    if(requirements.retired_ids.length){
      history(input.migration!=null,'initial tombstones require V1 migration');
      const migration=verifyV1Migration(input.migration,{plan_id,repo});
      const known=new Set(migration.manifest_bytes.flatMap(raw=>{const m=parseAiraJson(raw);return [...m.plan.tasks,...m.blockers].map(x=>x.id);}));
      history(requirements.retired_ids.every(x=>known.has(x.id)&&x.retired_revision===1),'unknown migration tombstone');
    }
    return null;
  }
  history(hash(previous_manifest_sha256),'predecessor hash');
  const prior=readV2Predecessor(previous);
  const {manifest,requirements:old}=prior;
  history(manifest.plan_id===plan_id&&manifest.repo===repo&&manifest.revision===revision-1&&sha256(prior.manifestBytes)===previous_manifest_sha256,'predecessor binding');
  const active=new Set(identities.active),retired=new Map(requirements.retired_ids.map(x=>[x.id,x])),priorActive=new Set(prior.identities.active),priorRetired=new Set(prior.identities.retired);
  history(prior.identities.active.every(id=>active.has(id)||retired.has(id))&&old.retired_ids.every(x=>retired.has(x.id)&&equal(x,retired.get(x.id))),'identity continuity');
  history(requirements.retired_ids.every(x=>priorRetired.has(x.id)||priorActive.has(x.id)&&x.retired_revision===revision),'new tombstone continuity');
  for(const id of identities.active)if(!priorActive.has(id)){
    const [ns,n]=Object.entries(restoreRequirementHighWater({},[id],[]))[0];
    identity(n>(prior.identities.counters[ns]??0),'reused identity: '+id);
  }
  return prior;
}

function addArtifacts(files, sources) {
  schema(plain(sources), 'artifact sources');
  const paths = Object.keys(sources).sort(codepointCompare);
  const lowerPaths = new Set(paths.map(path => path.toLowerCase()));
  requireValue(lowerPaths.size === paths.length, 'INVALID_PATH', 'colliding artifact paths');
  return paths.map(path => {
    try {
      artifactPath(path);
    } catch {
      requireValue(false, 'INVALID_PATH', 'artifact path: ' + path);
    }
    const parts = path.toLowerCase().split('/');
    requireValue(parts.every((_, i) => !lowerPaths.has(parts.slice(0, i).join('/'))),
      'INVALID_PATH', 'artifact parent is a file: ' + path);
    files[path] = bytes(sources[path], path);
    return {path, sha256: sha256(files[path])};
  });
}

function evidence(entries, owner, field) {
  return entries.filter(entry => entry.task_id === owner)
    .map(entry => projectV2EvidenceLine(entry.id, entry[field])).join('').slice(0, -1) || '- (keine)';
}

/** Project checked inputs into freshly allocated UTF-8 files. previous holds the
 * checked predecessor's manifest and requirements data. Optional hash and draft
 * assertions bind supplied expectations to the generated bytes.
 */
function projectV2(input, {skipHistory=false, archived=null}={}) {
  const {schema_version = 2, plan_id, revision, repo, plan, target_minutes, confirmed_points,
    spec, requirements, artifacts: sources = {}, previous_manifest_sha256 = null} = input;
  requireValue(schema_version === 2 && requirements?.schema_version === 2, 'VERSION_MISMATCH', 'schema version');
  schema(typeof plan_id === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]{0,23}$/.test(plan_id), 'plan ID');
  schema(typeof repo === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)
    && repo.split('/').every(part => part !== '.' && part !== '..') && !/\.git$/i.test(repo), 'repository');
  schema(Number.isSafeInteger(revision) && revision >= 1 && requirements.plan_id === plan_id
    && requirements.revision === revision, 'plan and requirements revision');
  schema(target_minutes === null || minute(target_minutes,1e9), 'target minutes');
  const validated=checkPlan(plan);
  const {allByTask, identities}=validateRequirements(plan,requirements);
  const predecessor=skipHistory?null:validateHistory({...input,previous_manifest_sha256},identities);

  const files = Object.create(null);
  files['SPEC.md'] = bytes(spec, 'SPEC.md');
  try {
    new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(files['SPEC.md']);
  } catch {
    schema(false, 'SPEC.md UTF-8');
  }
  schema(!files['SPEC.md'].subarray(0, 3).equals(Buffer.from([239, 187, 191])), 'SPEC.md BOM');
  const spec_sha256 = sha256(files['SPEC.md']);
  requireValue(!Object.hasOwn(input, 'spec_sha256') || input.spec_sha256 === spec_sha256,
    'INVALID_HASH', 'SPEC.md hash');
  const artifacts = addArtifacts(files, sources);
  files['requirements.json'] = archived ? Buffer.from(archived.requirementsBytes) : Buffer.from(canonical(requirements, 'requirements JSON'));
  const requirements_sha256 = sha256(files['requirements.json']);
  requireValue(!Object.hasOwn(input, 'requirements_sha256') || input.requirements_sha256 === requirements_sha256,
    'INVALID_HASH', 'requirements.json hash');
  const refs = [
    '../SPEC.md (SHA-256: ' + spec_sha256 + ')',
    '../manifest.json',
    '../requirements.json (SHA-256: ' + requirements_sha256 + ')',
    ...artifacts.map(({path, sha256}) => '../' + path + ' (SHA-256: ' + sha256 + ')'),
  ];

  const open = [...requirements.decisions]
    .sort((a, b) => codepointCompare(a.id, b.id));
  const order = [...open.map(decision => decision.id), ...plan.waves.flatMap(wave => [...wave].sort(codepointCompare))];
  schema(order.length <= 99 && plain(confirmed_points) && Object.keys(confirmed_points).length === order.length
    && order.every(id => Object.hasOwn(confirmed_points, id) && [1, 2, 3, 5, 8].includes(confirmed_points[id])),
  'confirmed story points and work item count');
  const tasks = {};
  const blockers = [];
  const mappings = new Map();
  const draftPaths = [];
  for (const [index, id] of order.entries()) {
    const task = plan.tasks.find(entry => entry.id === id);
    const decision = open.find(entry => entry.id === id);
    const prefix = 'SpecIt ' + plan_id + ' ' + id + ' – ';
    const mapping = {
      epic_title: prefix + (task ? task.title : 'Entscheidung klären'),
      item_title: prefix + (task ? 'Umsetzung: ' + task.title : 'Entscheidung dokumentieren'),
      file: 'draft/' + String(index + 1).padStart(2, '0') + '-' + id + '.md',
      points: confirmed_points[id],
    };
    if (task) tasks[id] = mapping;
    else blockers.push({id, decision: decision.text, ...mapping});
    mappings.set(id, mapping);
    const sections = [
      section('Ziel', task ? task.goal : decision.text),
      section('Ausgangslage', plan.summary),
      ...(task ? [
        section('Anforderungen', bullets(task.requirements)),
        section('Features', bullets(task.features)),
        section('Umfang', bullets(task.scope)),
        section('Nicht im Umfang', bullets(task.outOfScope)),
        section('Schnittstellen', bullets(task.interfaces)),
        section('Liefergegenstände', bullets(task.deliverables)),
      ] : [
        section('Umfang', '- Entscheidung fachlich klären und dokumentieren.'),
        section('Nicht im Umfang', '- Keine Umsetzung abhängiger Tasks.'),
      ]),
      section('Acceptance', evidence(requirements.criteria, id, 'text')),
      section('Tests', evidence(requirements.tests, id, 'description')),
      ...(task ? [
        section('Festlegungen', bullets(plan.decisions)),
        section('Offene Entscheidungen', bullets(task.blockedBy)),
        section('Abhängigkeiten', bullets(task.dependsOn)),
      ] : []),
      section('Referenzen', bullets(refs)),
    ];
    const header = ['# ' + mapping.item_title, 'Epic: ' + mapping.epic_title, 'Umfang: ' + mapping.points].join('\n');
    files[mapping.file] = Buffer.from([header, ...sections].join('\n\n') + '\n');
    draftPaths.push(mapping.file);
  }
  const rows = order.map(id => {
    const task = plan.tasks.find(entry => entry.id === id);
    const dependencies = task ? [...task.dependsOn, ...allByTask.get(id).map(decision => decision.id)] : [];
    const blockedBy = dependencies.sort(codepointCompare).map(dep => mappings.get(dep).epic_title).join('; ');
    return '| ' + mappings.get(id).epic_title + ' | ' + (blockedBy || '–') + ' | – |';
  });
  const epics = 'draft/EPICS.md';
  files[epics] = Buffer.from(['| Epic | Blocked by | Status |', '| --- | --- | --- |', ...rows].join('\n') + '\n');
  draftPaths.push(epics);
  const draft_files = draftPaths.map(path => ({path, sha256: sha256(files[path])}));
  if (Object.hasOwn(input, 'draft_files')) {
    requireValue(Array.isArray(input.draft_files) && input.draft_files.length === draftPaths.length
      && draftPaths.every((path, i) => input.draft_files[i]?.path === path), 'INVALID_PATH', 'draft paths');
    requireValue(draft_files.every(({sha256}, i) => input.draft_files[i].sha256 === sha256),
      'INVALID_HASH', 'draft hashes');
  }
  const manifest = {schema_version, mode: 'aira', plan_id, revision, previous_manifest_sha256, repo, plan: validated,
    spec_sha256, requirements_sha256, target_minutes, tasks, blockers, artifacts, draft_files,
    ...(target_minutes === null ? {target_minutes_reason: 'not_available'} : {})};
  checkManifest(manifest);
  if(archived){
    requireValue(equal(manifest,archived.manifest),'CONTENT_DRIFT','archived manifest projection');
    files['manifest.json']=Buffer.from(archived.manifestBytes);
  }else files['manifest.json']=Buffer.from(canonicalManifest(manifest));
  return {files,manifest,order,predecessor};
}

function semanticManifest({revision,previous_manifest_sha256,requirements_sha256,draft_files,...value}) {return value;}
function semanticRequirements({revision,...value}) {return value;}

// Low-level deterministic projection. No approval is inferred here; the
// public versioned export API below enforces the explicit review boundary.
export function buildAiraV2Export(input) {
  const projected=projectV2(input);
  const previous=projected.predecessor;
  if(previous&&equal(semanticManifest(projected.manifest),semanticManifest(previous.manifest))&&equal(semanticRequirements(input.requirements),semanticRequirements(previous.requirements))){
    const restored=projectV2({...input,revision:previous.manifest.revision,previous_manifest_sha256:previous.manifest.previous_manifest_sha256,requirements:previous.requirements,
      requirements_sha256:previous.manifest.requirements_sha256,draft_files:previous.manifest.draft_files},{skipHistory:true,archived:previous});
    return {...restored,predecessor:previous,unchanged:true};
  }
  return {...projected,unchanged:false};
}

function requireConfirmation(input,result) {
  const prior=result.predecessor;
  const previous=prior?{plan:prior.manifest.plan,requirements:prior.requirements,highWater:prior.identities.counters}:null;
  const migration=input.migration?verifyV1Migration(input.migration,input):null;
  try {
    confirmRequirementRevision(input.plan,input.requirements,{previous,confirmedIds:input.confirmed_ids,migration});
  }catch(error){requireValue(false,'APPROVAL_REQUIRED',error.message);}
}

export function previewAiraV2(input) {
  const result=buildAiraV2Export(input);
  requireConfirmation(input,result);
  const {files,manifest,unchanged}=result;
  return {manifest,manifest_sha256:sha256(files['manifest.json']),manifest_bytes:files['manifest.json'].toString('utf8'),
    requirements_bytes:files['requirements.json'].toString('utf8'),drafts:Object.fromEntries(manifest.draft_files.map(({path})=>[path,files[path].toString('utf8')])),
    unchanged,changes:unchanged?[]:[manifest.revision===1?'Erstexport':'Neue fachlich zu bestätigende Revision']};
}
export function exportAiraV2(input) {
  requireValue(input.approved===true,'APPROVAL_REQUIRED','fachliche Freigabe');
  const result=buildAiraV2Export(input);
  requireConfirmation(input,result);
  requireValue(!result.predecessor||result.unchanged||input.changes_approved===true,'APPROVAL_REQUIRED','Änderungsfreigabe');
  requireValue(!Object.hasOwn(input,'expected_manifest_sha256')||input.expected_manifest_sha256===sha256(result.files['manifest.json']),'APPROVAL_STALE','preview hash');
  return result.files;
}

// Verify an archived V2 package without trusting package data as an approval.
// Hash checks operate on the received bytes, then projection compares drafts.
export function verifyAiraV2(files, historyEntries=[]) {
  const m=rawJson(files['manifest.json'],'manifest JSON'),r=rawJson(files['requirements.json'],'requirements JSON');
  const manifest=m.value,requirements=r.value;
  checkManifest(manifest);
  requireValue(requirements.schema_version===2,'VERSION_MISMATCH','requirements version');
  schema(requirements.plan_id===manifest.plan_id&&requirements.revision===manifest.revision,'requirements binding');
  validateRequirements(manifest.plan,requirements);
  requireValue(sha256(r.raw)===manifest.requirements_sha256,'INVALID_HASH','requirements bytes');
  const confirmed_points=Object.fromEntries([...Object.entries(manifest.tasks),...manifest.blockers.map(b=>[b.id,b])].map(([id,value])=>[id,value.points]));
  const artifacts=Object.fromEntries(manifest.artifacts.map(a=>{
    requireValue(Object.hasOwn(files,a.path),'INVALID_PATH','missing artifact');
    requireValue(sha256(bytes(files[a.path],a.path))===a.sha256,'INVALID_HASH','artifact hash');
    return [a.path,files[a.path]];
  }));
  let previous=null;
  history(Array.isArray(historyEntries),'history list');
  if(historyEntries.length){
    const last=historyEntries.at(-1);
    previous=Object.hasOwn(last,'manifest_bytes')?last:{manifest_bytes:last['manifest.json'],requirements_bytes:last['requirements.json']};
  }
  const input={schema_version:2,plan_id:manifest.plan_id,repo:manifest.repo,revision:manifest.revision,plan:manifest.plan,target_minutes:manifest.target_minutes,
    previous_manifest_sha256:manifest.previous_manifest_sha256,previous,requirements,confirmed_points,spec:files['SPEC.md'],artifacts,
    spec_sha256:manifest.spec_sha256,requirements_sha256:manifest.requirements_sha256,draft_files:manifest.draft_files};
  const generated=projectV2(input,{archived:{manifest,manifestBytes:m.raw,requirementsBytes:r.raw}});
  requireValue(equal(Object.keys(generated.files).sort(),Object.keys(files).sort()),'INVALID_PATH','package files');
  for(const path of Object.keys(generated.files)){
    const raw=bytes(files[path],path);
    requireValue(sha256(raw)===sha256(generated.files[path]),'INVALID_HASH','package hash');
    requireValue(raw.equals(generated.files[path]),'CONTENT_DRIFT','package projection');
  }
  return true;
}

export function validateV2Restore(record, binding) {
  const prior=readV2Predecessor({manifest_bytes:record?.manifest_bytes,requirements_bytes:record?.requirements_bytes});
  const {manifest,requirements,identities}=prior;
  history(binding.plan_id===manifest.plan_id&&binding.repo===manifest.repo&&record.repo===manifest.repo&&record.manifest_sha256===sha256(prior.manifestBytes),'restored binding');
  history(plain(record.snapshot)&&equal(record.snapshot.plan,manifest.plan)&&equal(record.snapshot.requirements,requirements)&&equal(record.snapshot.highWater,identities.counters)&&plain(record.mapping),'restored identity state');
  if(record.snapshot.migration)verifyV1Migration(record.snapshot.migration,binding);
  const active=new Set(identities.active);
  history(Object.values(record.mapping).every(id=>active.has(id)),'restored mapping');
  return true;
}

function containsCR(value) {
  if (typeof value === 'string') return value.includes('\r');
  return value !== null && typeof value === 'object' && Object.values(value).some(containsCR);
}

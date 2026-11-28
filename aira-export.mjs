import { createHash } from 'node:crypto';
import { validatePlan } from './planner.mjs';
import { codepointCompare as cmp, decisionsFor, identityConflicts } from './aira-identities.mjs';
export { decisionsFor } from './aira-identities.mjs';

const fail = field => { throw new Error('Aira-Export: ungültig oder nicht bestätigt: '+field); };
const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x) && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
const keys = (x, required, optional=[]) => {
  if (!obj(x) || required.some(k=>!Object.hasOwn(x,k)) || Object.keys(x).some(k=>!required.includes(k)&&!optional.includes(k))) fail('Felder');
};
function canonical(x) {
  if (Array.isArray(x)) return x.map(canonical);
  if (obj(x)) return Object.fromEntries(Object.keys(x).sort(cmp).map(k=>[k,canonical(x[k])]));
  if (x===null || typeof x==='boolean' || (typeof x==='number' && Number.isFinite(x)) || (typeof x==='string' && x.isWellFormed())) return x;
  fail('JSON-Datentyp');
}
export const json = x => JSON.stringify(canonical(x),null,2)+'\n';
const same = (a,b) => json(a)===json(b);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function bytes(x) {
  if (typeof x==='string' && x.isWellFormed()) return Buffer.from(x,'utf8');
  if (x instanceof Uint8Array) return Buffer.from(x);
  fail('Bytequelle');
}
function title(t) {
  if(typeof t!=='string'||!t.trim()||t!==t.trim()||t.length>160||/[\p{Cc}\u2028\u2029|;\\]/u.test(t)||t.startsWith('#')||/^[:\-\s]+$/.test(t)) fail('Task-Titel');
}
function normalizedPlan(plan) {
  // validatePlan is deliberately forgiving. Only its exact normalized result is exportable.
  let validated;
  try { validated=validatePlan(plan); } catch { fail('Plan/IDs/Abhängigkeiten'); }
  if(!same(plan,validated)) fail('normalisierter Plan (Pflichtfelder, Typen, DAG, waves, blocked)');
  for(const t of plan.tasks) {
    title(t.title);
    if(new Set(t.blockedBy).size!==t.blockedBy.length) fail('doppelte offene Entscheidung');
  }
  // Generated Markdown must use LF; never repair or silently drop input.
  const hasCR=x=>typeof x==='string'?x.includes('\r'):Array.isArray(x)?x.some(hasCR):obj(x)?Object.values(x).some(hasCR):false;
  if(hasCR(plan)) fail('Zeilenenden im Plan');
}
export function artifactPath(path) {
  if(typeof path!=='string'||path.length>240||!path.startsWith('artifacts/')||
    path.split('/').some(s=>! /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(s)||s.endsWith('.')||/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(s))) fail('Artefaktpfad');
  return path;
}
const bullets = xs => xs.length?xs.map(x=>'- '+x).join('\n'):'- (keine)';
const section = ([name,value]) => '## '+name+'\n\n'+(Array.isArray(value)?bullets(value):value);
const prefix = (planId,id) => 'SpecIt '+planId+' '+id+' – ';
const manifestKeys=['schema_version','plan_id','revision','repo','spec_sha256','target_minutes','plan','tasks','blockers','artifacts'];
const point = v => [1,2,3,5,8].includes(v);
const hash = v => typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const contentOf = ({revision,...rest}) => rest;
function validateHistory(history,plan_id,repo) {
  if(!Array.isArray(history))fail('Identitätshistorie');
  for(const [i,m] of history.entries()){
    keys(m,manifestKeys,['target_minutes_reason']);
    if(m.schema_version!==1||m.plan_id!==plan_id||m.repo!==repo||m.revision!==i+1||!hash(m.spec_sha256))fail('lückenhafte oder konkurrierende Historie');
    if(m.target_minutes===null?m.target_minutes_reason!=='not_available':!(Number.isFinite(m.target_minutes)&&m.target_minutes>0)||Object.hasOwn(m,'target_minutes_reason'))fail('Historie Zielzeit');
    normalizedPlan(m.plan);
    const earlier=history.slice(0,i),previous=earlier.at(-1);
    if(identityConflicts(m.plan,previous).length)fail('Identitätskonflikt in Historie');
    const decisions=decisionsFor(m.plan,earlier);
    const ids=[...decisions.map(d=>d.id),...m.plan.waves.flatMap(w=>[...w].sort(cmp))];
    if(ids.length>99||!Array.isArray(m.blockers)||m.blockers.length!==decisions.length||!Array.isArray(m.artifacts))fail('Historie Zuordnungen');
    keys(m.tasks,m.plan.tasks.map(t=>t.id));
    for(const [j,id] of ids.entries()){
      const t=m.plan.tasks.find(t=>t.id===id),d=decisions.find(d=>d.id===id);
      const mapping=t?m.tasks[id]:m.blockers.find(x=>x.id===id);
      keys(mapping,t?['epic_title','item_title','file','points']:['id','decision','epic_title','item_title','file','points']);
      const p=prefix(plan_id,id);
      if(!point(mapping.points)||mapping.epic_title!==p+(t?t.title:'Entscheidung klären')||mapping.item_title!==p+(t?'Umsetzung: '+t.title:'Entscheidung dokumentieren')||mapping.file!=='draft/'+String(j+1).padStart(2,'0')+'-'+id+'.md'||(!t&&mapping.decision!==d.decision))fail('Historie Mapping');
    }
    const paths=new Set();
    for(const a of m.artifacts){keys(a,['path','sha256']);artifactPath(a.path);if(!hash(a.sha256)||paths.has(a.path.toLowerCase()))fail('Historie Artefakt');paths.add(a.path.toLowerCase());}
    if(previous&&same(contentOf(m),contentOf(previous)))fail('leere Historienrevision');
  }
}
function changesBetween(m,prev){
  if(!prev)return ['Erstexport'];
  const changes=[];
  if(m.spec_sha256!==prev.spec_sha256)changes.push('SPEC.md geändert (SHA-256)');
  if(m.target_minutes!==prev.target_minutes)changes.push('Zielzeit geändert');
  if(!same(m.artifacts,prev.artifacts))changes.push('Artefakte geändert');
  if(m.plan.summary!==prev.plan.summary||!same(m.plan.decisions,prev.plan.decisions))changes.push('Ausgangslage/Festlegungen geändert');
  for(const t of m.plan.tasks){
    const old=prev.plan.tasks.find(x=>x.id===t.id);
    if(!old)changes.push(t.id+': neuer Task');
    else for(const field of Object.keys(t).concat(Object.keys(old).filter(k=>!Object.hasOwn(t,k)))){
      if(!Object.hasOwn(t,field)||!Object.hasOwn(old,field)||!same(t[field],old[field]))changes.push(t.id+': '+field+' geändert');
    }
    if(prev.tasks[t.id]&&m.tasks[t.id].points!==prev.tasks[t.id].points)changes.push(t.id+': Punkte geändert');
  }
  for(const d of m.blockers){const old=prev.blockers.find(x=>x.id===d.id);if(!old)changes.push(d.id+': neue Entscheidung');else if(old.points!==d.points)changes.push(d.id+': Punkte geändert')}
  if(!same(m.plan.waves,prev.plan.waves)||!same(m.plan.tasks.map(t=>t.id),prev.plan.tasks.map(t=>t.id)))changes.push('Planreihenfolge geändert');
  return changes;
}

/** Pure in-memory projection. The caller must explicitly approve the complete input.
 * No filesystem paths are opened, no network or runner is invoked.
 */
function projectAira(input) {
  keys(input,['plan_id','revision','repo','plan','target_minutes','confirmed_points','approved','spec'],['schema_version','spec_sha256','artifacts','history','changes_approved']);
  const {plan_id,revision,repo,plan,target_minutes,confirmed_points}=input;
  const history=Object.hasOwn(input,'history')?input.history:[];
  if(typeof input.approved!=='boolean')fail('Freigabetyp');
  if(Object.hasOwn(input,'changes_approved')&&typeof input.changes_approved!=='boolean')fail('Änderungsfreigabe');
  if(Object.hasOwn(input,'schema_version')&&input.schema_version!==1) fail('Schema-Version');
  if(typeof plan_id!=='string'||! /^[A-Za-z0-9][A-Za-z0-9-]{0,23}$/.test(plan_id)) fail('Plan-ID');
  if(!Number.isSafeInteger(revision)||revision<1) fail('Revision');
  if(typeof repo!=='string'||! /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)||repo.split('/').some(p=>p==='.'||p==='..')||/\.git$/i.test(repo)) fail('Zielrepo owner/name');
  if(target_minutes!==null&&!(Number.isFinite(target_minutes)&&target_minutes>0)) fail('Zielzeit');
  normalizedPlan(plan);
  validateHistory(history,plan_id,repo);
  const prev=history.at(-1);
  if(!prev&&revision!==1||prev&&revision!==prev.revision&&revision!==prev.revision+1)fail('Revision ohne passende Identitätshistorie');
  const conflicts=identityConflicts(plan,prev);
  if(conflicts.length)fail('Migration mit Coordinator erforderlich: '+conflicts.join('; '));
  const spec=bytes(input.spec);
  try { new TextDecoder('utf-8',{fatal:true}).decode(spec); } catch { fail('SPEC UTF-8'); }
  if(spec.subarray(0,3).equals(Buffer.from([239,187,191]))) fail('SPEC BOM');
  const spec_sha256=sha256(spec);
  if(Object.hasOwn(input,'spec_sha256')&&input.spec_sha256!==spec_sha256) fail('SPEC Hash');
  const sources=Object.hasOwn(input,'artifacts')?input.artifacts:{};
  if(!obj(sources)) fail('Artefakte');
  const paths=Object.keys(sources).sort(cmp);
  if(new Set(paths.map(p=>p.toLowerCase())).size!==paths.length) fail('kollidierende Artefaktpfade');
  const files=Object.create(null);
  files['SPEC.md']=spec;
  const artifacts=paths.map(path=>{
    artifactPath(path);
    if(paths.some(p=>p.toLowerCase().startsWith(path.toLowerCase()+'/'))) fail('Artefaktpfad Dateikonflikt');
    files[path]=bytes(sources[path]);
    return {path,sha256:sha256(files[path])};
  });
  const decisions=decisionsFor(plan,history);
  const order=[...decisions.map(d=>d.id),...plan.waves.flatMap(w=>[...w].sort(cmp))];
  if(order.length>99) fail('maximal 99 Work items');
  if(!obj(confirmed_points))fail('bestätigte Punkte');
  for(const id of order) if(!Object.hasOwn(confirmed_points,id)||!point(confirmed_points[id])) fail('Punkte für '+id);
  keys(confirmed_points,order);
  const refs=['../SPEC.md (SHA-256: '+spec_sha256+')','../manifest.json',...artifacts.map(a=>'../'+a.path+' (SHA-256: '+a.sha256+')')];
  const tasks={},blockers=[],byId=new Map(),decisionIds=new Map(decisions.map(d=>[d.decision,d.id]));
  for(const [index,id] of order.entries()) {
    const t=plan.tasks.find(t=>t.id===id),d=decisions.find(d=>d.id===id),p=prefix(plan_id,id);
    const mapping={epic_title:p+(t?t.title:'Entscheidung klären'),item_title:p+(t?'Umsetzung: '+t.title:'Entscheidung dokumentieren'),file:'draft/'+String(index+1).padStart(2,'0')+'-'+id+'.md',points:confirmed_points[id]};
    if(mapping.epic_title.length>255||mapping.item_title.length>255) fail('generierter Titel');
    byId.set(id,mapping);
    if(t) tasks[id]=mapping; else blockers.push({id,decision:d.decision,...mapping});
    const sections=t?[
      ['Ziel',t.goal],['Ausgangslage',plan.summary],['Anforderungen',t.requirements],['Features',t.features],
      ['Umfang',t.scope],['Nicht im Umfang',t.outOfScope],['Schnittstellen',t.interfaces],['Liefergegenstände',t.deliverables],
      ['Acceptance',t.acceptance],['Tests',t.tests],['Festlegungen',plan.decisions],['Offene Entscheidungen',t.blockedBy],['Abhängigkeiten',t.dependsOn]
    ]:[
      ['Ziel',d.decision],['Ausgangslage',plan.summary],['Umfang',['Entscheidung fachlich klären und dokumentieren.']],
      ['Nicht im Umfang',['Keine Umsetzung abhängiger Tasks.']],['Acceptance',['Bestätigte Entscheidung dokumentiert.']],['Tests',['Bestätigung und Dokumentation prüfen.']]
    ];
    files[mapping.file]=Buffer.from('# '+mapping.item_title+'\nEpic: '+mapping.epic_title+'\nUmfang: '+mapping.points+'\n\n'+[...sections,['Referenzen',refs]].map(section).join('\n\n')+'\n');
  }
  const epics=order.map(id=>{
    const t=plan.tasks.find(t=>t.id===id);
    const deps=t?[...new Set([...t.dependsOn,...t.blockedBy.map(d=>decisionIds.get(d))])].sort(cmp):[];
    return '| '+byId.get(id).epic_title+' | '+(deps.map(d=>byId.get(d).epic_title).join('; ')||'–')+' | – |';
  });
  files['draft/EPICS.md']=Buffer.from(['| Epic | Blocked by | Status |','| --- | --- | --- |',...epics].join('\n')+'\n');
  const manifest={schema_version:1,plan_id,revision,repo,spec_sha256,target_minutes,...(target_minutes===null?{target_minutes_reason:'not_available'}:{}),plan,tasks,blockers,artifacts};
  const unchanged=!!prev&&same(contentOf(manifest),contentOf(prev));
  const requiredRevision=prev?(unchanged?prev.revision:prev.revision+1):1;
  if(revision!==requiredRevision)fail('konkurrierende oder falsche Revision; erwartet '+requiredRevision);
  files['manifest.json']=Buffer.from(json(manifest));
  return {files,manifest,changes:unchanged?[]:changesBetween(manifest,prev),unchanged};
}

export function exportAira(input) {
  if(input?.approved!==true)fail('fachliche Freigabe');
  const result=projectAira(input);
  if(input.history?.length&&!result.unchanged&&input.changes_approved!==true)fail('Änderungsplan ausdrücklich freigeben');
  return result.files;
}

// Preview contains no ZIP and authorizes nothing. Revision derives from exact content.
export function previewAira(input) {
  const history=input?.history??[];
  if(!Array.isArray(history))fail('Identitätshistorie');
  const last=history.at(-1);
  let result;
  if(last){
    try{result=projectAira({...input,revision:last.revision});}
    catch(e){if(e.message!=='Aira-Export: ungültig oder nicht bestätigt: konkurrierende oder falsche Revision; erwartet '+(last.revision+1))throw e;
      result=projectAira({...input,revision:last.revision+1});}
  }else result=projectAira({...input,revision:1});
  return {manifest:result.manifest,changes:result.changes,unchanged:result.unchanged};
}

/** Verify an existing initial package against the projection, without writing/importing it.
 * Comparing the canonical manifest bytes also rejects duplicate JSON keys.
 */
export function verifyAira(files,history=[]) {
  let m;
  try { m=JSON.parse(bytes(files['manifest.json']).toString('utf8')); } catch { fail('Manifest JSON'); }
  keys(m,['schema_version','plan_id','revision','repo','spec_sha256','target_minutes','plan','tasks','blockers','artifacts'],['target_minutes_reason']);
  if(m.schema_version!==1) fail('Schema-Version');
  if(!obj(m.tasks)||!Array.isArray(m.blockers)||!Array.isArray(m.artifacts)) fail('Manifest-Zuordnungen');
  const points=Object.create(null),artifacts=Object.create(null);
  for(const [id,t] of Object.entries(m.tasks)) points[id]=t.points;
  for(const t of m.blockers) points[t.id]=t.points;
  for(const a of m.artifacts) { artifactPath(a.path); artifacts[a.path]=files[a.path]; }
  const generated=exportAira({schema_version:m.schema_version,plan_id:m.plan_id,revision:m.revision,repo:m.repo,plan:m.plan,target_minutes:m.target_minutes,confirmed_points:points,approved:true,spec:files['SPEC.md'],spec_sha256:m.spec_sha256,artifacts,history,changes_approved:true});
  if(!same(Object.keys(generated).sort(),Object.keys(files).sort())) fail('Paketdateien');
  for(const p of Object.keys(generated)) if(!generated[p].equals(bytes(files[p]))) fail('Hash oder Markdown-/Manifest-Projektion');
  return true;
}

import { createHash } from 'node:crypto';
import { validatePlan } from './planner.mjs';

const fail = field => { throw new Error('Aira-Export: ungültig oder nicht bestätigt: '+field); };
const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x) && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
const keys = (x, required, optional=[]) => {
  if (!obj(x) || required.some(k=>!Object.hasOwn(x,k)) || Object.keys(x).some(k=>!required.includes(k)&&!optional.includes(k))) fail('Felder');
};
const cmp = (a,b) => {
  const aa=Array.from(a,c=>c.codePointAt(0)),bb=Array.from(b,c=>c.codePointAt(0));
  for(let i=0;i<Math.min(aa.length,bb.length);i++) if(aa[i]!==bb[i]) return aa[i]-bb[i];
  return aa.length-bb.length;
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
  if (JSON.stringify(plan).includes('\\r') && JSON.stringify(plan).includes('\\r')) {
    const check=x=>typeof x==='string'?x.includes('\r'):Array.isArray(x)?x.some(check):obj(x)?Object.values(x).some(check):false;
    if(check(plan)) fail('Zeilenenden im Plan');
  }
}
export function artifactPath(path) {
  if(typeof path!=='string'||path.length>240||!path.startsWith('artifacts/')||
    path.split('/').some(s=>! /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(s)||s.endsWith('.')||/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(s))) fail('Artefaktpfad');
  return path;
}
const bullets = xs => xs.length?xs.map(x=>'- '+x).join('\n'):'- (keine)';
const section = ([name,value]) => '## '+name+'\n\n'+(Array.isArray(value)?bullets(value):value);
const prefix = (planId,id) => 'SpecIt '+planId+' '+id+' – ';
const bId = n => 'B'+String(n).padStart(2,'0');

export function decisionsFor(plan) {
  return [...new Set(plan.tasks.flatMap(t=>t.blockedBy))].sort(cmp).map((decision,i)=>({id:bId(i+1),decision}));
}

/** Pure in-memory projection. The caller must explicitly approve the complete input.
 * No filesystem paths are opened, no network or runner is invoked.
 */
export function exportAira(input) {
  keys(input,['plan_id','revision','repo','plan','target_minutes','confirmed_points','approved','spec'],['schema_version','spec_sha256','artifacts']);
  const {plan_id,revision,repo,plan,target_minutes,confirmed_points,approved}=input;
  if(approved!==true) fail('fachliche Freigabe');
  if(Object.hasOwn(input,'schema_version')&&input.schema_version!==1) fail('Schema-Version');
  if(typeof plan_id!=='string'||! /^[A-Za-z0-9][A-Za-z0-9-]{0,23}$/.test(plan_id)) fail('Plan-ID');
  if(revision!==1) fail('Revision ohne Identitätshistorie');
  if(typeof repo!=='string'||! /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)||repo.split('/').some(p=>p==='.'||p==='..')||/\.git$/i.test(repo)) fail('Zielrepo owner/name');
  if(target_minutes!==null&&!(Number.isFinite(target_minutes)&&target_minutes>0)) fail('Zielzeit');
  normalizedPlan(plan);
  const spec=bytes(input.spec);
  try { new TextDecoder('utf-8',{fatal:true}).decode(spec); } catch { fail('SPEC UTF-8'); }
  if(spec.subarray(0,3).equals(Buffer.from([239,187,191]))) fail('SPEC BOM');
  const spec_sha256=sha256(spec);
  if(Object.hasOwn(input,'spec_sha256')&&input.spec_sha256!==spec_sha256) fail('SPEC Hash');
  const sources=input.artifacts??{};
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
  const decisions=decisionsFor(plan);
  const order=[...decisions.map(d=>d.id),...plan.waves.flatMap(w=>[...w].sort(cmp))];
  if(order.length>99) fail('maximal 99 Work items');
  keys(confirmed_points,order);
  for(const id of order) if(![1,2,3,5,8].includes(confirmed_points[id])) fail('Punkte für '+id);
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
  files['manifest.json']=Buffer.from(json(manifest));
  return files;
}

/** Verify an existing initial package against the projection, without writing/importing it.
 * Comparing the canonical manifest bytes also rejects duplicate JSON keys.
 */
export function verifyAira(files) {
  let m;
  try { m=JSON.parse(bytes(files['manifest.json']).toString('utf8')); } catch { fail('Manifest JSON'); }
  keys(m,['schema_version','plan_id','revision','repo','spec_sha256','target_minutes','plan','tasks','blockers','artifacts'],['target_minutes_reason']);
  if(m.schema_version!==1) fail('Schema-Version');
  if(!obj(m.tasks)||!Array.isArray(m.blockers)||!Array.isArray(m.artifacts)) fail('Manifest-Zuordnungen');
  const points=Object.create(null),artifacts=Object.create(null);
  for(const [id,t] of Object.entries(m.tasks)) points[id]=t.points;
  for(const t of m.blockers) points[t.id]=t.points;
  for(const a of m.artifacts) { artifactPath(a.path); artifacts[a.path]=files[a.path]; }
  const generated=exportAira({schema_version:m.schema_version,plan_id:m.plan_id,revision:m.revision,repo:m.repo,plan:m.plan,target_minutes:m.target_minutes,confirmed_points:points,approved:true,spec:files['SPEC.md'],spec_sha256:m.spec_sha256,artifacts});
  if(!same(Object.keys(generated).sort(),Object.keys(files).sort())) fail('Paketdateien');
  for(const p of Object.keys(generated)) if(!generated[p].equals(bytes(files[p]))) fail('Hash oder Markdown-/Manifest-Projektion');
  return true;
}

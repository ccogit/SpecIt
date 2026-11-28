import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, openSync, closeSync, fsyncSync, renameSync, rmSync, mkdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { parseAiraJson } from './aira-identities.mjs';

const fail = code => { throw Object.assign(new Error('Aira feedback: '+code), {code}); };
const need = (ok, code='INVALID_SCHEMA') => { if (!ok) fail(code); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const keys = (x, names) => need(object(x) && Object.keys(x).length === names.split(' ').length && names.split(' ').every(k=>Object.hasOwn(x,k)));
const str = x => typeof x === 'string' && x.isWellFormed() && x.trim().length > 0 && x.length <= 4096 && !/[\x00-\x1f\x7f]/.test(x);
const nullable = (x, fn=str) => x === null || fn(x);
const hex = (x,n=64) => typeof x === 'string' && x.length===n && /^[0-9a-f]+$/i.test(x);
const positive = x => Number.isSafeInteger(x) && x>0;
const utc = x => typeof x==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0,19)===x.slice(0,19);
const uuid = x => typeof x==='string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(x);
const one = (x, values) => values.split(' ').includes(x);
const reason = x => nullable(x,v=>typeof v==='string' && /^[A-Z][A-Z0-9_]*$/.test(v));
const unique = (list, key='id') => {
  need(Array.isArray(list));
  const seen=new Set();
  for(const x of list){need(object(x)&&str(x[key])&&!seen.has(x[key]));seen.add(x[key]);}
};
const json = bytes => {
  try { return parseAiraJson(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)); }
  catch { fail('INVALID_SCHEMA'); }
};
const merged = task => ['merge_confirmed','done'].includes(task.state) && !!task.assignment_id && positive(task.pr_number) &&
  ['head_sha','base_sha','candidate_sha','merge_sha'].every(k=>hex(task[k],40)) && !!task.acceptance_event_id;

// Binding and archive must come from trusted local registry, never the feedback.
export function validateFeedback(bytes, context, receiptHash) {
  need(bytes instanceof Uint8Array && bytes.byteLength>0 && bytes.byteLength<=2*1024*1024);
  const sha256=hash(bytes);
  if(receiptHash!==undefined)need(hex(receiptHash)&&sha256===receiptHash,'INVALID_HASH');
  const f=json(bytes);
  keys(f,'schema_version binding_id repo jira_project plan_id sequence previous_feedback_sha256 observed_at revision manifest_sha256 import_state tasks requirements decisions measurements findings');
  need(f.schema_version===1,'VERSION_MISMATCH');
  need(uuid(f.binding_id)&&str(f.repo)&&str(f.jira_project)&&str(f.plan_id)&&positive(f.sequence)&&positive(f.revision)&&hex(f.manifest_sha256)&&utc(f.observed_at));
  need(f.sequence===1?f.previous_feedback_sha256===null:hex(f.previous_feedback_sha256),'HISTORY_CONFLICT');
  need(one(f.import_state,'committed partial uncertain superseded'));
  const b=context.binding;
  need(b && ['binding_id','repo','jira_project','plan_id'].every(k=>f[k]===b[k]),'WRONG_TARGET');
  const archived=context.history.find(e=>e.manifest_sha256===f.manifest_sha256);
  need(archived && hash(archived.files['manifest.json'])===f.manifest_sha256,'WRONG_TARGET');
  const m=json(archived.files['manifest.json']),r=json(archived.files['requirements.json']);
  need(m.revision===f.revision&&r.revision===f.revision&&m.repo===f.repo&&m.plan_id===f.plan_id&&r.plan_id===f.plan_id&&hash(archived.files['requirements.json'])===m.requirements_sha256,'WRONG_TARGET');
  const tasks=new Set([...m.plan.tasks,...r.decisions].map(x=>x.id)), criteria=new Map(r.criteria.map(x=>[x.id,x])), requirements=new Map(r.requirements.map(x=>[x.id,x])), decisions=new Set(r.decisions.map(x=>x.id));
  for(const list of [f.tasks,f.requirements,f.decisions])unique(list);
  unique(f.measurements,'event_id');
  need(Array.isArray(f.findings));
  const findingKeys=new Set();
  const verified=new Set(), assignments=new Set();
  for(const t of f.tasks){
    keys(t,'id jira_key state assignment_id pr_number head_sha base_sha candidate_sha merge_sha acceptance_event_id criteria reason');
    need(tasks.has(t.id),'ID_CONFLICT');
    need(nullable(t.jira_key)&&nullable(t.assignment_id)&&nullable(t.pr_number,positive)&&nullable(t.acceptance_event_id)&&reason(t.reason));
    need(one(t.state,'pending blocked assigned reported verified merge_confirmed done failed unknown'));
    for(const k of ['head_sha','base_sha','candidate_sha','merge_sha'])need(nullable(t[k],v=>hex(v,40)));
    if(t.assignment_id)assignments.add(t.assignment_id);
    if(['merge_confirmed','done'].includes(t.state)&&m.plan.tasks.some(x=>x.id===t.id))need(merged(t),'EVIDENCE_MISMATCH');
    unique(t.criteria);
    for(const c of t.criteria){
      keys(c,'id state evidence_ref');
      need(criteria.get(c.id)?.task_id===t.id,'ID_CONFLICT');
      need(one(c.state,'reported verified failed not_run unknown')&&nullable(c.evidence_ref));
      if(c.state==='verified'){need(!!c.evidence_ref,'EVIDENCE_MISMATCH');if(merged(t))verified.add(c.id);}
    }
  }
  for(const q of f.requirements){
    keys(q,'id state criterion_ids reason');
    need(requirements.has(q.id),'ID_CONFLICT');
    need(one(q.state,'pending partial verified failed unknown')&&reason(q.reason)&&Array.isArray(q.criterion_ids));
    const expected=r.criteria.filter(c=>c.requirement_ids.includes(q.id)).map(c=>c.id);
    need(new Set(q.criterion_ids).size===q.criterion_ids.length&&q.criterion_ids.every(id=>expected.includes(id)),'ID_CONFLICT');
    if(q.state==='verified')need(expected.length>0&&expected.every(id=>q.criterion_ids.includes(id)&&verified.has(id)),'EVIDENCE_MISMATCH');
  }
  for(const d of f.decisions){
    keys(d,'id state evidence_ref resolution reason');
    need(decisions.has(d.id),'ID_CONFLICT');
    need(one(d.state,'open resolved pending_confirmation unknown')&&nullable(d.evidence_ref)&&nullable(d.resolution,v=>typeof v==='string'&&v.isWellFormed()&&v.trim().length>0&&v.length<=1000&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v))&&reason(d.reason));
    need(d.resolution===null||d.state==='resolved');
  }
  for(const v of f.measurements){
    keys(v,'event_id assignment_id metric value reason observed_at');
    need(assignments.has(v.assignment_id),'ID_CONFLICT');
    need(one(v.metric,'assignment_to_merge_seconds rework_count segment_seconds')&&utc(v.observed_at)&&reason(v.reason)&& (v.value===null?v.reason!==null:Number.isSafeInteger(v.value)&&v.value>=0&&v.reason===null));
    need(Date.parse(v.observed_at)<=Date.parse(f.observed_at),'EVIDENCE_MISMATCH');
  }
  for(const v of f.findings){
    keys(v,'code ref state');need(reason(v.code)&&v.code!==null&&str(v.ref)&&/^[A-Za-z0-9_.:/-]+$/.test(v.ref)&&one(v.state,'open resolved unknown'));
    const key=JSON.stringify([v.code,v.ref]);need(!findingKeys.has(key),'ID_CONFLICT');findingKeys.add(key);
  }
  return {sha256,feedback:f};
}

function replay(entries,context){
  need(Array.isArray(entries));
  let last=null;
  return entries.map((e,i)=>{
    need(object(e)&&typeof e.bytes==='string'&&hex(e.sha256));
    const bytes=Buffer.from(e.bytes,'base64');
    need(bytes.toString('base64')===e.bytes,'INVALID_HASH');
    const v=validateFeedback(bytes,context,e.sha256),f=v.feedback;
    need(f.sequence===i+1&&f.previous_feedback_sha256===(last?.sha256??null),'HISTORY_CONFLICT');
    need(!last||Date.parse(f.observed_at)>=Date.parse(last.feedback.observed_at)&&f.revision>=last.feedback.revision,'HISTORY_CONFLICT');
    last=v;return v;
  });
}
export function appendFeedback(entries, bytes, context, receiptHash){
  const history=replay(entries,context),v=validateFeedback(bytes,context,receiptHash),f=v.feedback;
  const old=history[f.sequence-1];
  if(old){need(old.sha256===v.sha256,'HISTORY_CONFLICT');return {status:'no_op',entries};}
  const last=history.at(-1);
  need(f.sequence===history.length+1&&f.previous_feedback_sha256===(last?.sha256??null),'HISTORY_CONFLICT');
  need(f.manifest_sha256===context.history.at(-1)?.manifest_sha256,'WRONG_TARGET');
  need(!last||Date.parse(f.observed_at)>=Date.parse(last.feedback.observed_at),'HISTORY_CONFLICT');
  return {status:'accepted',entries:[...entries,{sha256:v.sha256,bytes:Buffer.from(bytes).toString('base64')}]};
}
export function feedbackProjection(entries,context){
  const history=replay(entries,context),head=context.history.at(-1)?.manifest_sha256;
  const latest=history.at(-1)??null;
  return {freshness:!latest?'unknown':latest.feedback.manifest_sha256!==head||latest.feedback.import_state==='superseded'?'stale':latest.feedback.import_state==='committed'?'current':'unknown',
    current:latest?.feedback.manifest_sha256===head?latest:null,
    history:history.map(v=>({...v,historical:v!==latest||v.feedback.manifest_sha256!==head}))};
}

// Dedicated append-only receipt file; separate from SPEC, package archive and learning.
export function createFeedbackStore(root, getContext){
  mkdirSync(root,{recursive:true,mode:0o700});
  need(lstatSync(root).isDirectory(),'INVALID_PATH');
  const path=join(root,'feedback.json'),lock=join(root,'feedback.lock');
  const read=()=>{
    try{need(lstatSync(path).isFile(),'INVALID_PATH');const list=json(readFileSync(path));need(Array.isArray(list));return list;}
    catch(e){if(e.code==='ENOENT')return [];throw e;}
  };
  const transaction=fn=>{
    let fd;try{fd=openSync(lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')fail('HISTORY_CONFLICT');throw e;}
    const tmp=join(root,'feedback-'+randomUUID()+'.tmp');
    try{
      const old=read(),context=getContext(),result=fn(old,context);
      if(result.entries!==old){
        const out=openSync(tmp,'wx',0o600);
        try{writeFileSync(out,JSON.stringify(result.entries));fsyncSync(out);}finally{closeSync(out);}
        renameSync(tmp,path);
        if(process.platform!=='win32'){const dir=openSync(root,'r');try{fsyncSync(dir);}finally{closeSync(dir);}}
      }
      return result.status;
    }finally{rmSync(tmp,{force:true});closeSync(fd);rmSync(lock,{force:true});}
  };
  return {
    import:(bytes,receiptHash)=>transaction((old,c)=>appendFeedback(old,bytes,c,receiptHash)),
    projection:()=>feedbackProjection(read(),getContext()),
    backup:()=>{const entries=read();replay(entries,getContext());return entries;},
    restore:entries=>transaction((old,c)=>{
      replay(old,c);replay(entries,c);
      need(entries.length>=old.length&&old.every((e,i)=>e.sha256===entries[i].sha256&&e.bytes===entries[i].bytes),'HISTORY_CONFLICT');
      return {entries:entries.length===old.length?old:entries,status:entries.length===old.length?'no_op':'restored'};
    })
  };
}

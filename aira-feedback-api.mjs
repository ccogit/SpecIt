import {randomUUID} from 'node:crypto';
import {closeSync,fsyncSync,lstatSync,mkdirSync,openSync,readFileSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {parseAiraJson} from './aira-identities.mjs';
import {createFeedbackStore,feedbackProjection} from './aira-feedback.mjs';
import {createDecisionReviews,reservedDecisionEvidence} from './aira-feedback-decisions.mjs';

const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(ok,code='INVALID_SCHEMA')=>{if(!ok)fail(code);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(x);
const jira=x=>typeof x==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(x);
const projectId=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9-]{0,23}$/.test(x);
const decode=raw=>{
  need(typeof raw==='string'&&raw.length<=2800000);
  const b=Buffer.from(raw,'base64');need(b.toString('base64')===raw,'INVALID_HASH');return b;
};
const readJson=(path,fallback)=>{
  try{need(lstatSync(path).isFile(),'INVALID_PATH');return parseAiraJson(readFileSync(path,'utf8'));}
  catch(e){if(e.code==='ENOENT')return fallback;throw e;}
};
function writeJson(root,path,value){
  const tmp=join(root,'feedback-'+randomUUID()+'.tmp');
  try{
    const fd=openSync(tmp,'wx',0o600);
    try{writeFileSync(fd,JSON.stringify(value));fsyncSync(fd);}finally{closeSync(fd);}
    renameSync(tmp,path);
    if(process.platform!=='win32'){const dir=openSync(root,'r');try{fsyncSync(dir);}finally{closeSync(dir);}}
  }finally{rmSync(tmp,{force:true});}
}
export const feedbackRoute='/api/aira/feedback';

// Uses SI-6's project archive write.lock as a read barrier. The adapter never
// writes projects.json. Selection/epoch checks and receipt append run under
// that same lock, so another process cannot advance the archive mid-import.
export function createFeedbackApi({store,root,owner,now}){
  const registry=join(root,'feedback-bindings.json'),lock=join(root,'write.lock'),guard=join(root,'feedback-operation.lock');
  const reviews=createDecisionReviews(root,{owner,now});
  function lockFile(path,fn){
    let fd;try{fd=openSync(path,'wx',0o600);}catch(e){if(e.code==='EEXIST')fail('HISTORY_CONFLICT');throw e;}
    try{return fn();}finally{closeSync(fd);rmSync(path,{force:true});}
  }
  const locked=fn=>lockFile(lock,fn),guarded=fn=>lockFile(guard,fn);
  function context(body){
    need(object(body));
    const {project,selection}=store.active();
    need(project?.mode==='aira'&&project.binding,'WRONG_TARGET');
    need(body.project_id===project.project_id&&body.selection===selection,'HISTORY_CONFLICT');
    need(body.plan_id===project.binding.plan_id&&body.repo===project.binding.repo,'WRONG_TARGET');
    need(body.expected_generation===project.generation&&body.expected_head===project.manifest_sha256&&body.expected_export_epoch===project.export_epoch,'HISTORY_CONFLICT');
    need(projectId(project.project_id));
    return {project,selection,history:store.history(project.project_id)};
  }
  function bindings(){
    const all=readJson(registry,[]);
    need(Array.isArray(all)&&all.every(x=>object(x)&&projectId(x.project_id)&&uuid(x.binding_id)&&jira(x.jira_project)&&typeof x.plan_id==='string'&&typeof x.repo==='string'));
    need(new Set(all.map(x=>x.project_id)).size===all.length&&new Set(all.map(x=>x.binding_id.toLowerCase())).size===all.length,'HISTORY_CONFLICT');
    return all;
  }
  function receiptStore(project,history,entry){
    need(entry&&entry.plan_id===project.binding.plan_id&&entry.repo===project.binding.repo,'WRONG_TARGET');
    const {project_id,...binding}=entry;
    const parent=join(root,'feedback');mkdirSync(parent,{mode:0o700,recursive:true});need(lstatSync(parent).isDirectory(),'INVALID_PATH');
    return createFeedbackStore(join(parent,project_id),()=>({binding,history}));
  }
  function dispatch(body){
    return guarded(()=>locked(()=>{
      const {project,selection,history}=context(body),all=bindings();
      let entry=all.find(x=>x.project_id===project.project_id);
      if(body.action==='bind'){
        // Explicit source verification by a human at the trusted local
        // boundary; never learn binding_id or Jira project from feedback bytes.
        need(body.confirmed===true,'APPROVAL_REQUIRED');
        need(uuid(body.binding_id)&&jira(body.jira_project));
        const next={project_id:project.project_id,...project.binding,binding_id:body.binding_id,jira_project:body.jira_project};
        if(entry)need(entry.binding_id===next.binding_id&&entry.jira_project===next.jira_project,'WRONG_TARGET');
        else{
          need(!all.some(x=>x.binding_id.toLowerCase()===next.binding_id.toLowerCase()),'WRONG_TARGET');
          writeJson(root,registry,[...all,next]);entry=next;
        }
      }
      const binding=entry?{binding_id:entry.binding_id,jira_project:entry.jira_project}:null;
      if(!entry){
        need(body.action==='status','CONTEXT_UNAVAILABLE');
        return {binding:null,owner:reviews.owner,projection:{freshness:'unknown',current:null,history:[]}};
      }
      const receipts=receiptStore(project,history,entry);
      let status,backup,candidate;
      switch(body.action){
        case 'bind':case 'status':break;
        case 'import':
          need(body.source_confirmed===true,'APPROVAL_REQUIRED');
          status=receipts.import(decode(body.bytes),body.sha256);break;
        case 'backup':
          backup={schema_version:1,...project.binding,...binding,entries:receipts.backup(),reviews:reviews.backup({binding,history,projection:receipts.projection()})};break;
        case 'restore':
          need(body.source_confirmed===true,'APPROVAL_REQUIRED');
          need(object(body.backup)&&body.backup.schema_version===1&&['binding_id','jira_project','plan_id','repo'].every(k=>body.backup[k]===entry[k]),'WRONG_TARGET');
          {
            const restoredProjection=feedbackProjection(body.backup.entries,{binding:{...project.binding,...binding},history});
            const restoreReviews=reviews.restore({binding,history,projection:restoredProjection,reviews:body.backup.reviews});
            status=receipts.restore(body.backup.entries);restoreReviews();break;
          }
        case 'confirm_decision':
          candidate=reviews.confirm({project,selection,history,binding,projection:receipts.projection(),proposal:body.proposal,confirmation:body.confirmation});break;
        default:fail('INVALID_SCHEMA');
      }
      return {binding,owner:reviews.owner,projection:receipts.projection(),...(status?{status}:{}),...(backup?{backup}:{}),...(candidate??{})};
    }));
  }
  // Serialize receipt changes across the approval check and synchronous SI-6
  // preview/export. SI-6 still owns its own archive CAS and frozen preview.
  function withExportApproval(body,run){
    if(!Object.hasOwn(body,'feedback_approval')&&!(Array.isArray(body.requirements?.decisions)&&body.requirements.decisions.some(d=>reservedDecisionEvidence(d?.evidence_ref))))return run();
    return guarded(()=>{
      locked(()=>{
        const {project,selection,history}=context(body),entry=bindings().find(x=>x.project_id===project.project_id);
        const binding=entry?{binding_id:entry.binding_id,jira_project:entry.jira_project}:null;
        const projection=entry?receiptStore(project,history,entry).projection():null;
        reviews.verifyExport({body,project,selection,history,binding,projection});
      });
      return run();
    });
  }
  return {dispatch,withExportApproval};
}

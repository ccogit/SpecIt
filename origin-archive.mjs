import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,lstatSync,readFileSync,openSync,closeSync,writeFileSync,fsyncSync,renameSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {parseAiraJson} from './aira-identities.mjs';
import {originBackupDigestShape,maxOriginBackupBytes} from './origin-backup.mjs';

const hash=v=>createHash('sha256').update(v).digest('hex');
const validHash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const planId=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9-]{0,23}$/.test(v);
const need=(v,code='INVALID_SCHEMA')=>{if(!v)throw Object.assign(Error(code),{code});};
const exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===k;
function verify(backup){
  need(hash(originBackupDigestShape(backup))===backup.sha256,'INVALID_HASH');
  return backup;
}
function inspect(backup){
  const ids=new Set(),issues=[];
  for(const {key,raw} of backup.entries){
    try{
      const obj=parseAiraJson(raw);
      need(obj&&typeof obj==='object'&&!Array.isArray(obj));
      if(key==='specit-v3'){
        need(typeof obj.idea==='string'&&typeof obj.spec==='string');
        if(planId(obj.plan_id))ids.add(obj.plan_id);
      }else if(key==='specit-aira-history-v1'){
        for(const [id,history] of Object.entries(obj)){
          need(planId(id)&&Array.isArray(history));ids.add(id);
          need(history.every(m=>m&&m.plan_id===id&&Number.isSafeInteger(m.revision)&&m.revision>0));
        }
      }else{
        const id=key.slice('specit-aira-v2:'.length);ids.add(id);
        need(typeof obj.manifest_bytes==='string'&&typeof obj.requirements_bytes==='string'&&validHash(obj.manifest_sha256));
        const m=parseAiraJson(obj.manifest_bytes),r=parseAiraJson(obj.requirements_bytes);
        need(m.schema_version===2&&m.plan_id===id&&m.repo===obj.repo&&r.plan_id===id&&r.revision===m.revision);
        need(hash(obj.manifest_bytes)===obj.manifest_sha256&&hash(obj.requirements_bytes)===m.requirements_sha256,'INVALID_HASH');
      }
    }catch{issues.push({key,code:'LEGACY_UNVERIFIED'});}
  }
  return {plan_ids:[...ids].sort(),issues};
}
const stateDigest=state=>hash(JSON.stringify(state));
const empty=()=>({schema_version:1,records:[]});
const maxStore=128*1024*1024;

// Separate, append-preserving origin archive; no project activation, binding,
// revision append, feedback, calibration or runner dependency. Restoring an
// original to a browser is a separate explicit operation, never authoritative.
export function createOriginArchive(root,{getProjects=()=>[]}={}){
  const dir=resolve(root);mkdirSync(dir,{recursive:true,mode:0o700});need(lstatSync(dir).isDirectory(),'INVALID_PATH');
  const index=join(dir,'origins.json'),lock=join(dir,'write.lock');
  function read(){
    let stat;try{stat=lstatSync(index);}catch(e){if(e.code==='ENOENT')return empty();throw e;}
    need(stat.isFile()&&stat.size<=maxStore,'INVALID_PATH');
    const state=parseAiraJson(readFileSync(index,'utf8'));
    need(exact(state,'records,schema_version')&&state.schema_version===1&&Array.isArray(state.records));
    const ids=new Set();
    for(const r of state.records){
      need(exact(r,'backup,state')&&['active','rolled_back'].includes(r.state));verify(r.backup);
      need(!ids.has(r.backup.sha256),'HISTORY_CONFLICT');ids.add(r.backup.sha256);
    }
    return state;
  }
  function write(fn){
    let fd;try{fd=openSync(lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')need(false,'HISTORY_CONFLICT');throw e;}
    const temp=join(dir,'origin-'+randomUUID()+'.tmp');
    try{
      const state=read(),result=fn(state),raw=JSON.stringify(state);
      need(Buffer.byteLength(raw)<=maxStore,'SOURCE_UNAVAILABLE');
      const out=openSync(temp,'wx',0o600);
      try{writeFileSync(out,raw);fsyncSync(out);}finally{closeSync(out);}
      renameSync(temp,index);
      if(process.platform!=='win32'){const d=openSync(dir,'r');try{fsyncSync(d);}finally{closeSync(d);}}
      return result;
    }finally{rmSync(temp,{force:true});closeSync(fd);rmSync(lock,{force:true});}
  }
  const find=(state,id)=>{need(validHash(id));const record=state.records.find(r=>r.backup.sha256===id);need(record,'SOURCE_UNAVAILABLE');return record;};
  const summary=r=>({backup_id:r.backup.sha256,source_origin:r.backup.source_origin,state:r.state,keys:r.backup.entries.map(e=>e.key),...inspect(r.backup)});
  function preview(state,operation,backup){
    verify(backup);const existing=state.records.find(r=>r.backup.sha256===backup.sha256),info=inspect(backup);
    const conflicts=[];
    for(const record of state.records){
      if(record.state!=='active'||record.backup.sha256===backup.sha256)continue;
      const other=record.backup,otherInfo=inspect(other);
      const common=backup.entries.filter(e=>other.entries.some(o=>o.key===e.key&&o.raw!==e.raw));
      if(backup.source_origin===other.source_origin&&common.length)
        conflicts.push({kind:'origin_key',backup_id:other.sha256,keys:common.map(e=>e.key)});
      const plans=info.plan_ids.filter(id=>otherInfo.plan_ids.some(p=>p.toLowerCase()===id.toLowerCase()));
      if(plans.length)conflicts.push({kind:'plan_id',backup_id:other.sha256,plan_ids:plans});
    }
    // The server's current binding authority is advisory for archival conflicts;
    // a migrated browser record cannot modify or attach to a server binding.
    for(const p of getProjects()){
      if(p.binding&&info.plan_ids.some(id=>id.toLowerCase()===p.binding.plan_id.toLowerCase()))
        conflicts.push({kind:'server_binding',project_id:p.project_id,plan_ids:[p.binding.plan_id]});
    }
    const current=existing?.state??'absent';
    const can_apply=operation==='import'?current==='absent'||current==='active':
      operation==='rollback'?current==='active':operation==='restore'?current==='rolled_back':false;
    const view={operation,backup_id:backup.sha256,current,can_apply,conflicts,issues:info.issues,plan_ids:info.plan_ids,keys:backup.entries.map(e=>e.key)};
    return {...view,preview_sha256:hash(JSON.stringify([stateDigest(state),view]))};
  }
  function dispatch(body){
    need(body&&typeof body==='object'&&!Array.isArray(body));
    const action=body.action;
    if(action==='list'){need(exact(body,'action'));return {records:read().records.map(summary)};}
    if(action==='read'){need(exact(body,'action,backup_id'));return {backup:structuredClone(find(read(),body.backup_id).backup)};}
    if(action==='preview'){
      need(['import','rollback','restore'].includes(body.operation));
      const state=read();
      if(body.operation==='import'){need(exact(body,'action,backup,operation'));return preview(state,body.operation,body.backup);}
      need(exact(body,'action,backup_id,operation'));
      return preview(state,body.operation,find(state,body.backup_id).backup);
    }
    need(action==='apply'&&['import','rollback','restore'].includes(body.operation));
    need(body.confirmed===true,'APPROVAL_REQUIRED');need(validHash(body.preview_sha256));
    need(exact(body,body.operation==='import'?'action,backup,confirmed,operation,preview_sha256,resolution':'action,backup_id,confirmed,operation,preview_sha256,resolution'));
    need(['none','keep_separate'].includes(body.resolution));
    return write(state=>{
      const backup=body.operation==='import'?body.backup:find(state,body.backup_id).backup;
      const v=preview(state,body.operation,backup);
      need(v.preview_sha256===body.preview_sha256&&v.can_apply,'HISTORY_CONFLICT');
      need(body.operation==='rollback'||!v.conflicts.length||body.resolution==='keep_separate','HISTORY_CONFLICT');
      const record=state.records.find(r=>r.backup.sha256===backup.sha256);
      if(body.operation==='import'&&!record)state.records.push({backup:structuredClone(backup),state:'active'});
      else if(body.operation==='rollback')record.state='rolled_back';
      else if(body.operation==='restore')record.state='active';
      return {record:summary(find(state,backup.sha256)),changed:body.operation!=='import'||!record};
    });
  }
  return {dispatch};
}
export const maxOriginRequestBytes=maxOriginBackupBytes+65536;

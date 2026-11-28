import {randomUUID,createHash} from 'node:crypto';
import {closeSync,fsyncSync,lstatSync,mkdirSync,openSync,readFileSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {parseAiraJson,sameManifest} from './aira-identities.mjs';
import {confirmDecisionProposal} from './public/aira-feedback-model.mjs';

const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(ok,code='INVALID_SCHEMA')=>{if(!ok)fail(code);};
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(x);
const actor=x=>typeof x==='string'&&/^[A-Za-z0-9_.@-]{1,100}$/.test(x);
const evidence=x=>typeof x==='string'&&x.length<=240&&/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(x)&&x.split('/').every(p=>p!=='.'&&p!=='..');
const json=bytes=>parseAiraJson(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const reservedDecisionEvidence=ref=>typeof ref==='string'&&ref.startsWith('feedback-decision-reviews/');
const reference=(binding,id)=>'feedback-decision-reviews/'+binding.binding_id+'/'+id+'.json';
const parseRef=(binding,ref)=>{
  need(reservedDecisionEvidence(ref),'INVALID_PATH');
  const prefix='feedback-decision-reviews/'+binding.binding_id+'/';
  const id=ref.slice(prefix.length,-5);
  need(ref===reference(binding,id)&&uuid(id),'INVALID_PATH');return id;
};
const archive=entry=>{
  need(entry&&entry.files,'CONTEXT_UNAVAILABLE');
  return {manifest:json(entry.files['manifest.json']),requirements:json(entry.files['requirements.json']),manifestSha:entry.manifest_sha256};
};
const contextFields=(project,selection)=>({project_id:project.project_id,selection,generation:project.generation,
  export_epoch:project.export_epoch,manifest_sha256:project.manifest_sha256});

export function createDecisionReviews(root,{owner,now=Date.now}={}){
  const ownerId=actor(owner)?owner:null;
  function directory(binding){
    need(uuid(binding.binding_id),'WRONG_TARGET');
    const parent=join(root,'feedback-decision-reviews');
    mkdirSync(parent,{recursive:true,mode:0o700});need(lstatSync(parent).isDirectory(),'INVALID_PATH');
    const dir=join(parent,binding.binding_id);mkdirSync(dir,{recursive:true,mode:0o700});need(lstatSync(dir).isDirectory(),'INVALID_PATH');
    return dir;
  }
  function read(binding,id){
    need(uuid(id),'INVALID_PATH');const path=join(directory(binding),id+'.json');
    try{need(lstatSync(path).isFile(),'INVALID_PATH');return json(readFileSync(path));}
    catch(e){if(e.code==='ENOENT')fail('SOURCE_UNAVAILABLE');throw e;}
  }
  function write(binding,proof){
    const id=proof.review_id;need(uuid(id),'INVALID_PATH');
    const dir=directory(binding),path=join(dir,id+'.json'),temp=join(dir,randomUUID()+'.tmp');
    try{
      try{const existing=read(binding,id);need(sameManifest(existing,proof),'HISTORY_CONFLICT');return;}
      catch(e){if(e.code!=='SOURCE_UNAVAILABLE')throw e;}
      const fd=openSync(temp,'wx',0o600);
      try{writeFileSync(fd,JSON.stringify(proof));fsyncSync(fd);}finally{closeSync(fd);}
      renameSync(temp,path);
      if(process.platform!=='win32'){const fd=openSync(dir,'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
    }finally{rmSync(temp,{force:true});}
  }
  function sourceProof(binding,proof,history,projection){
    need(proof?.schema_version===1&&uuid(proof.review_id)&&proof.binding_id===binding.binding_id,'WRONG_TARGET');
    const original=history.find(x=>x.manifest_sha256===proof.context?.manifest_sha256);
    const prior=archive(original),source=projection.history.find(x=>x.sha256===proof.proposal?.receipt_sha256);
    need(source&&source.feedback.manifest_sha256===prior.manifestSha&&source.feedback.import_state==='committed','EVIDENCE_MISMATCH');
    const c=proof.confirmation;
    need(c?.confirmed===true&&c.jira_confirmed===true&&actor(c.actor)&&evidence(c.local_evidence_ref)&&
      typeof c.jira_key==='string'&&c.jira_key.startsWith(binding.jira_project+'-')&&/^[1-9]\d*$/.test(c.jira_key.slice(binding.jira_project.length+1)),'APPROVAL_REQUIRED');
    const observedKey=source.feedback.tasks.find(t=>t.id===proof.proposal.id)?.jira_key;
    need(!observedKey||observedKey===c.jira_key,'EVIDENCE_MISMATCH');
    const candidate=confirmDecisionProposal({...prior,projection:{freshness:'current',current:source},proposal:proof.proposal,
      confirmation:{confirmed:true,actor:c.actor,evidence_ref:reference(binding,proof.review_id),confirmed_at:c.confirmed_at}});
    const d=candidate.decisions.find(x=>x.id===proof.proposal.id);
    need(sameManifest(d,proof.decision),'EVIDENCE_MISMATCH');
    return {candidate,confirmed_ids:[d.id,...d.task_ids]};
  }
  function confirm({project,selection,history,binding,projection,proposal,confirmation}){
    need(ownerId,'CONTEXT_UNAVAILABLE');
    need(confirmation?.confirmed===true&&confirmation.actor===ownerId&&confirmation.jira_confirmed===true,'APPROVAL_REQUIRED');
    need(evidence(confirmation.local_evidence_ref),'APPROVAL_REQUIRED');
    need(projection.freshness==='current'&&projection.current?.sha256===proposal?.receipt_sha256,'APPROVAL_STALE');
    const prior=archive(history.at(-1)),id=randomUUID();
    const c={confirmed:true,actor:ownerId,local_evidence_ref:confirmation.local_evidence_ref,jira_confirmed:true,jira_key:confirmation.jira_key,
      confirmed_at:new Date(now()).toISOString().replace(/\.\d{3}Z$/,'Z')};
    const candidate=confirmDecisionProposal({...prior,projection,proposal,
      confirmation:{confirmed:true,actor:ownerId,evidence_ref:reference(binding,id),confirmed_at:c.confirmed_at}});
    const decision=candidate.decisions.find(d=>d.id===proposal.id);
    const proof={schema_version:1,review_id:id,binding_id:binding.binding_id,context:contextFields(project,selection),
      proposal:structuredClone(proposal),confirmation:c,decision};
    const checked=sourceProof(binding,proof,history,projection);
    write(binding,proof);
    return {approval_id:id,requirements:checked.candidate,confirmed_ids:checked.confirmed_ids};
  }
  function verifyExport({body,project,selection,history,binding,projection}){
    const prior=archive(history.at(-1));
    const changed=(body.requirements?.decisions??[]).filter(d=>reservedDecisionEvidence(d.evidence_ref)&&
      !sameManifest(d,prior.requirements.decisions.find(x=>x.id===d.id)));
    if(!Object.hasOwn(body,'feedback_approval')){need(!changed.length,'APPROVAL_REQUIRED');return;}
    need(changed.length===1&&binding&&uuid(body.feedback_approval),'APPROVAL_REQUIRED');
    const proof=read(binding,body.feedback_approval);
    need(ownerId&&proof.confirmation?.actor===ownerId&&sameManifest(proof.context,contextFields(project,selection))&&
      projection.freshness==='current'&&projection.current?.sha256===proof.proposal?.receipt_sha256,'APPROVAL_STALE');
    const checked=sourceProof(binding,proof,history,projection);
    need(body.revision===checked.candidate.revision&&sameManifest(changed[0],proof.decision)&&
      checked.confirmed_ids.every(id=>body.confirmed_ids?.includes(id)),'APPROVAL_STALE');
  }
  // Only already archived decision confirmations travel in a feedback backup.
  // Pending authorizations are never restored.
  function archivedRefs(history){
    const refs=new Map();
    for(const entry of history){
      for(const d of archive(entry).requirements.decisions)if(reservedDecisionEvidence(d.evidence_ref)){
        if(!refs.has(d.evidence_ref))refs.set(d.evidence_ref,d);
        else need(sameManifest(refs.get(d.evidence_ref),d),'HISTORY_CONFLICT');
      }
    }
    return refs;
  }
  function verifyArchived(binding,proof,history,projection,refs){
    const ref=reference(binding,proof.review_id),decision=refs.get(ref);
    need(decision&&sameManifest(decision,proof.decision),'EVIDENCE_MISMATCH');
    sourceProof(binding,proof,history,projection);
    need(history.some(entry=>entry.manifest_sha256!==proof.context.manifest_sha256&&
      archive(entry).manifest.revision>proof.proposal.revision&&archive(entry).requirements.decisions.some(d=>sameManifest(d,decision))),'EVIDENCE_MISMATCH');
  }
  function backup({binding,history,projection}){
    const refs=archivedRefs(history);
    return [...refs.keys()].map(ref=>{
      const proof=read(binding,parseRef(binding,ref));verifyArchived(binding,proof,history,projection,refs);
      return {proof,sha256:hash(Buffer.from(JSON.stringify(proof)))};
    });
  }
  function restore({binding,history,projection,reviews=[]}){
    need(Array.isArray(reviews),'INVALID_SCHEMA');
    const refs=archivedRefs(history),seen=new Set();
    for(const entry of reviews){
      const proof=entry?.proof;
      need(proof&&entry.sha256===hash(Buffer.from(JSON.stringify(proof))),'INVALID_HASH');
      need(!seen.has(proof.review_id),'ID_CONFLICT');seen.add(proof.review_id);
      verifyArchived(binding,proof,history,projection,refs);
    }
    // Do not silently accept an incomplete audit backup of an archived decision.
    for(const ref of refs.keys()){
      const id=parseRef(binding,ref);
      if(!seen.has(id))verifyArchived(binding,read(binding,id),history,projection,refs);
    }
    return ()=>{for(const {proof} of reviews)write(binding,proof);};
  }
  return {owner:ownerId,confirm,verifyExport,backup,restore};
}

// Pure read-only projection and candidate construction, shared by browser and
// the local server. No measurements, I/O, Jira mutation or calibration.
const byId = rows => new Map((rows??[]).map(row=>[row.id,row]));
const known = value => value===true?'yes':value===false?'no':'unknown';
const observed = (row,predicate) => known(row&&row.state!=='unknown'?predicate(row):null);
const mergeConfirmed = task => !!task && ['merge_confirmed','done'].includes(task.state) && !!task.merge_sha && !!task.acceptance_event_id;
const verified = criterion => criterion?.state==='verified' && !!criterion.evidence_ref;
const aggregate = values => values.includes('no')?'no':values.length&&values.every(v=>v==='yes')?'yes':'unknown';
const refs=task=>({jira_key:task?.jira_key??null,pr_number:task?.pr_number??null,merge_sha:task?.merge_sha??null,acceptance_event_id:task?.acceptance_event_id??null});
const fail=code=>{throw Object.assign(Error(code),{code});};

export function feedbackView({projection,manifest,requirements,manifestSha=null,importError=null}){
  const candidate=projection?.current;
  const fresh=!!(projection?.freshness==='current' && candidate?.feedback?.revision===manifest.revision &&
    candidate.feedback.plan_id===manifest.plan_id && (!manifestSha||candidate.feedback.manifest_sha256===manifestSha));
  const feedback=candidate?.feedback;
  const source=feedback??projection?.history?.at(-1)?.feedback;
  const tasks=byId(feedback?.tasks),reqs=byId(feedback?.requirements),decisions=byId(feedback?.decisions);
  const criteria=requirements.criteria.map(c=>{
    const t=tasks.get(c.task_id),row=t?.criteria.find(x=>x.id===c.id);
    return {id:c.id,task_id:c.task_id,state:row?.state??'unknown',
      reported:observed(row,x=>['reported','verified','failed'].includes(x.state)),
      verified:observed(row,verified),merged:observed(t,mergeConfirmed),
      fulfilled:fresh&&verified(row)&&mergeConfirmed(t),evidence_ref:row?.evidence_ref??null,...refs(t)};
  });
  const taskRows=[...manifest.plan.tasks,...requirements.decisions].map(t=>{
    const row=tasks.get(t.id),related=criteria.filter(c=>c.task_id===t.id);
    return {id:t.id,state:row?.state??'unknown',
      reported:observed(row,x=>['reported','verified','merge_confirmed','done','failed'].includes(x.state)),
      verified:observed(row,x=>['verified','merge_confirmed','done'].includes(x.state)&&related.length>0&&related.every(c=>c.verified==='yes')),
      merged:observed(row,mergeConfirmed),reason:row?.reason??null,
      evidence_refs:related.map(c=>c.evidence_ref).filter(Boolean),...refs(row)};
  });
  const requirementRows=requirements.requirements.map(r=>{
    const row=reqs.get(r.id),related=criteria.filter(c=>requirements.criteria.find(x=>x.id===c.id).requirement_ids.includes(r.id));
    const fulfilled=fresh&&row?.state==='verified'&&related.length>0&&related.every(c=>c.fulfilled&&row.criterion_ids.includes(c.id));
    return {id:r.id,mandatory:r.mandatory,state:row?.state??'unknown',fulfilled:!!fulfilled,
      reported:aggregate(related.map(c=>c.reported)),verified:aggregate(related.map(c=>c.verified)),merged:aggregate(related.map(c=>c.merged)),
      missing:related.filter(c=>!c.fulfilled||!row?.criterion_ids.includes(c.id)).map(c=>c.id),
      jira_keys:[...new Set(related.map(c=>c.jira_key).filter(Boolean))],pr_numbers:[...new Set(related.map(c=>c.pr_number).filter(Boolean))],
      evidence_refs:[...new Set(related.map(c=>c.evidence_ref).filter(Boolean))],reason:row?.reason??null};
  });
  const decisionRows=requirements.decisions.map(d=>{
    const row=decisions.get(d.id);
    return {id:d.id,state:row?.state??'unknown',local_state:d.state,evidence_ref:row?.evidence_ref??null,reason:row?.reason??null,
      ...refs(tasks.get(d.id)),
      proposal:fresh&&row?.state==='resolved'&&row.resolution&&row.resolution!==d.resolution&&row.evidence_ref?
        {id:d.id,revision:manifest.revision,manifest_sha256:manifestSha??feedback.manifest_sha256??null,receipt_sha256:candidate.sha256,
          before:d.resolution,after:row.resolution,source_evidence_ref:row.evidence_ref}:null};
  });
  return {revision:manifest.revision,source_revision:source?.revision??null,observed_at:source?.observed_at??null,
    freshness:fresh?'current':projection?.freshness==='stale'?'stale':'unknown',import_state:source?.import_state??'unknown',
    history:(projection?.history??[]).map(x=>({sequence:x.feedback.sequence,revision:x.feedback.revision,observed_at:x.feedback.observed_at,
      historical:x.historical,receipt_sha256:x.sha256,import_state:x.feedback.import_state,
      tasks:x.feedback.tasks.map(t=>t.id+': '+t.state),requirements:x.feedback.requirements.map(r=>r.id+': '+r.state),
      decisions:x.feedback.decisions.map(d=>d.id+': '+d.state)})),
    importError,requirements:requirementRows,criteria,tasks:taskRows,decisions:decisionRows,findings:structuredClone(feedback?.findings??[])};
}

// The trusted local server checks the operator, independent human evidence
// and Jira observation. This function only prepares a candidate revision.
export function confirmDecisionProposal({proposal,projection,manifest,requirements,manifestSha=null,confirmation}){
  const current=feedbackView({projection,manifest,requirements,manifestSha}).decisions.find(d=>d.id===proposal?.id)?.proposal;
  if(!current||Object.keys(current).length!==Object.keys(proposal).length||Object.keys(current).some(k=>current[k]!==proposal[k]))fail('APPROVAL_STALE');
  if(confirmation?.confirmed!==true||typeof confirmation.actor!=='string'||!confirmation.actor.trim()||
    typeof confirmation.evidence_ref!=='string'||!confirmation.evidence_ref.trim()||
    typeof confirmation.confirmed_at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(confirmation.confirmed_at)||
    !Number.isFinite(Date.parse(confirmation.confirmed_at)))fail('APPROVAL_REQUIRED');
  const next=structuredClone(requirements);
  next.revision=manifest.revision+1;
  const d=next.decisions.find(d=>d.id===proposal.id);
  Object.assign(d,{state:'resolved',resolution:current.after,evidence_ref:confirmation.evidence_ref,confirmed_by:confirmation.actor,confirmed_at:confirmation.confirmed_at});
  return next;
}

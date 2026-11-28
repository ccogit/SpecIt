// Presentation only. Never consumes measurements or writes SPEC, plan or points.
const byId = rows => new Map((rows??[]).map(row=>[row.id,row]));
const known = value => value===true?'yes':value===false?'no':'unknown';
const mergeConfirmed = task => !!task && ['merge_confirmed','done'].includes(task.state) && !!task.merge_sha && !!task.acceptance_event_id;
const verified = criterion => criterion?.state==='verified' && !!criterion.evidence_ref;

export function feedbackView({projection,manifest,requirements,importError=null}){
  const candidate=projection?.current;
  const fresh=projection?.freshness==='current' && candidate?.feedback?.revision===manifest.revision &&
    candidate.feedback.plan_id===manifest.plan_id;
  const feedback=candidate?.feedback;
  const tasks=byId(feedback?.tasks),reqs=byId(feedback?.requirements),decisions=byId(feedback?.decisions);
  const refs=task=>({jira_key:task?.jira_key??null,pr_number:task?.pr_number??null,merge_sha:task?.merge_sha??null,acceptance_event_id:task?.acceptance_event_id??null});
  const criteria=requirements.criteria.map(c=>{
    const t=tasks.get(c.task_id),row=t?.criteria.find(x=>x.id===c.id);
    return {id:c.id,task_id:c.task_id,state:row?.state??'unknown',reported:known(row?['reported','verified','failed'].includes(row.state):null),
      verified:known(row?verified(row):null),merged:known(t?mergeConfirmed(t):null),
      fulfilled:fresh&&verified(row)&&mergeConfirmed(t),evidence_ref:row?.evidence_ref??null,...refs(t)};
  });
  const taskRows=manifest.plan.tasks.map(t=>{
    const row=tasks.get(t.id),related=criteria.filter(c=>c.task_id===t.id);
    return {id:t.id,state:row?.state??'unknown',reported:known(row?['reported','verified','merge_confirmed','done','failed'].includes(row.state):null),
      verified:known(row?related.length>0&&related.every(c=>c.verified==='yes'):null),merged:known(row?mergeConfirmed(row):null),reason:row?.reason??null,...refs(row)};
  });
  const requirementRows=requirements.requirements.map(r=>{
    const row=reqs.get(r.id),related=criteria.filter(c=>requirements.criteria.find(x=>x.id===c.id).requirement_ids.includes(r.id));
    const fulfilled=fresh&&row?.state==='verified'&&related.length>0&&related.every(c=>c.fulfilled&&row.criterion_ids.includes(c.id));
    return {id:r.id,mandatory:r.mandatory,state:row?.state??'unknown',fulfilled:!!fulfilled,missing:related.filter(c=>!c.fulfilled||!row?.criterion_ids.includes(c.id)).map(c=>c.id),
      reason:row?.reason??null};
  });
  const decisionRows=requirements.decisions.map(d=>{
    const row=decisions.get(d.id);
    return {id:d.id,state:row?.state??'unknown',local_state:d.state,evidence_ref:row?.evidence_ref??null,reason:row?.reason??null,
      proposal:fresh&&row?.state==='resolved'&&row.resolution&&row.resolution!==d.resolution&&row.evidence_ref?
        {id:d.id,revision:manifest.revision,receipt_sha256:candidate.sha256,before:d.resolution,after:row.resolution,source_evidence_ref:row.evidence_ref}:null};
  });
  return {revision:manifest.revision,source_revision:feedback?.revision??null,observed_at:feedback?.observed_at??null,
    freshness:fresh?'current':projection?.freshness==='stale'?'stale':'unknown',import_state:feedback?.import_state??'unknown',
    history:(projection?.history??[]).map(x=>({sequence:x.feedback.sequence,revision:x.feedback.revision,observed_at:x.feedback.observed_at,historical:x.historical})),
    importError,requirements:requirementRows,criteria,tasks:taskRows,decisions:decisionRows,findings:structuredClone(feedback?.findings??[])};
}

// The caller must authenticate the owner and verify the local evidence in the
// trusted project context. This only prepares a candidate revision; no writes.
export function confirmDecisionProposal({proposal,projection,manifest,requirements,confirmation}){
  const current=feedbackView({projection,manifest,requirements}).decisions.find(d=>d.id===proposal?.id)?.proposal;
  if(!current||Object.keys(current).some(k=>current[k]!==proposal[k]))throw Error('APPROVAL_STALE');
  if(confirmation?.confirmed!==true||typeof confirmation.actor!=='string'||!confirmation.actor.trim()||
    typeof confirmation.evidence_ref!=='string'||!confirmation.evidence_ref.trim()||
    typeof confirmation.confirmed_at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(confirmation.confirmed_at)||
    !Number.isFinite(Date.parse(confirmation.confirmed_at)))throw Error('APPROVAL_REQUIRED');
  const next=structuredClone(requirements);
  next.revision=manifest.revision+1;
  const d=next.decisions.find(d=>d.id===proposal.id);
  Object.assign(d,{state:'resolved',resolution:current.after,evidence_ref:confirmation.evidence_ref,confirmed_by:confirmation.actor,confirmed_at:confirmation.confirmed_at});
  return next;
}

// All imported text is rendered as text, not HTML or external links.
// The review callback is a request to open a diff, not permission to apply it.
export function renderFeedbackReview(container, view, onReviewProposal){
  const doc=container.ownerDocument;
  const el=(tag,text,parent=container)=>{const e=doc.createElement(tag);e.textContent=text;parent.append(e);return e;};
  container.replaceChildren();
  el('h3','Aira-Rücklauf (read-only)');
  el('p','Revision '+view.revision+' · Quelle: '+(view.source_revision??'unknown')+' · '+(view.observed_at??'unknown')+' · '+view.freshness+' · '+view.import_state);
  if(view.importError)el('p','Importfehler: '+view.importError);
  for(const [label,rows] of [['Anforderungen',view.requirements],['Kriterien',view.criteria],['Tasks',view.tasks],['Entscheidungen / Klärungsbedarf',view.decisions],['Historie',view.history],['Findings',view.findings]]){
    el('h4',label);
    const list=el('ul','');
    for(const row of rows){
      const {proposal,...fields}=row;
      const li=el('li',Object.entries(fields).map(([k,v])=>k+': '+(v??'unknown')).join(' · '),list);
      if(proposal){
        el('pre','Vorher: '+(proposal.before??'(offen)')+'\nVorschlag: '+proposal.after+'\nBeleg: '+proposal.source_evidence_ref,li);
        const button=el('button','Diff fachlich prüfen',li);button.type='button';
        button.disabled=typeof onReviewProposal!=='function';
        button.addEventListener('click',()=>onReviewProposal?.(structuredClone(proposal)));
      }
    }
  }
}

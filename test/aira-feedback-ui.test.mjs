import test from 'node:test';
import assert from 'node:assert/strict';
import {feedbackView,confirmDecisionProposal,renderFeedbackReview,mountFeedbackPanel} from '../public/aira-feedback-ui.mjs';

const manifest={revision:2,plan_id:'p',plan:{tasks:[{id:'T01',blockedBy:['B01']}]}};
const requirements={revision:2,plan_id:'p',requirements:[{id:'FR-001',mandatory:true}],criteria:[
  {id:'AC-T01-001',task_id:'T01',requirement_ids:['FR-001']},
  {id:'AC-T01-002',task_id:'T01',requirement_ids:['FR-001']}
],decisions:[{id:'B01',state:'open',resolution:null,evidence_ref:null,confirmed_by:null,confirmed_at:null}]};
const projection={freshness:'current',current:{sha256:'a'.repeat(64),feedback:{
  revision:2,plan_id:'p',sequence:2,observed_at:'2026-11-28T12:00:00Z',import_state:'committed',
  tasks:[{id:'T01',state:'reported',jira_key:'DEMO-1',pr_number:7,criteria:[{id:'AC-T01-001',state:'reported',evidence_ref:'report'}]}],
  requirements:[{id:'FR-001',state:'partial',criterion_ids:['AC-T01-001']}],
  decisions:[{id:'B01',state:'resolved',resolution:'Entscheidung <b>Text</b>',evidence_ref:'report/decision'}],
  measurements:[{metric:'rework_count',value:47}],findings:[]
}},history:[]};
const input=()=>structuredClone({projection,manifest,requirements});
test('T11/T14 separates reported, verified, merged, missing and unknown',()=>{
  const i=input(),v=feedbackView(i);
  assert.equal(v.tasks[0].reported,'yes');
  assert.equal(v.tasks[0].verified,'no');
  assert.equal(v.tasks[0].merged,'no');
  assert.equal(v.criteria[1].state,'unknown');
  assert.equal(v.criteria[1].reported,'unknown');
  assert.equal(v.requirements[0].fulfilled,false);
  const t=i.projection.current.feedback.tasks[0];t.state='done';t.merge_sha='a'.repeat(40);t.acceptance_event_id='event';t.assignment_id='assignment';t.head_sha='b'.repeat(40);t.base_sha='c'.repeat(40);t.candidate_sha='d'.repeat(40);
  t.criteria[0].state='verified';i.projection.current.feedback.requirements[0].state='verified';
  const after=feedbackView(i);
  assert.equal(after.criteria[0].fulfilled,true);
  assert.equal(after.requirements[0].fulfilled,false);
  assert.deepEqual(after.requirements[0].missing,['AC-T01-002']);
  i.projection.freshness='stale';
  assert.equal(feedbackView(i).criteria[0].fulfilled,false);
  assert.equal(feedbackView({...i,projection:null}).tasks[0].merged,'unknown');
});
test('T15 diff requires explicit confirmation and prepares only a new candidate revision',()=>{
  const i=input(),before=structuredClone(i),proposal=feedbackView(i).decisions[0].proposal;
  assert.equal(proposal.before,null);
  assert.throws(()=>confirmDecisionProposal({...i,proposal}),/APPROVAL_REQUIRED/);
  assert.throws(()=>confirmDecisionProposal({...i,proposal:{...proposal,after:'different'},confirmation:{confirmed:true}}),/APPROVAL_STALE/);
  const confirmation={confirmed:true,actor:'owner',evidence_ref:'local/decision',confirmed_at:'2026-11-28T12:01:00Z'};
  const candidate=confirmDecisionProposal({...i,proposal,confirmation});
  assert.equal(candidate.revision,3);
  assert.equal(candidate.decisions[0].resolution,proposal.after);
  assert.equal(candidate.decisions[0].confirmed_by,'owner');
  assert.deepEqual(i,before);
  assert.deepEqual(i.manifest.plan.tasks[0].blockedBy,['B01']);
  i.projection.freshness='unknown';
  assert.throws(()=>confirmDecisionProposal({...i,proposal,confirmation}),/APPROVAL_STALE/);
});
test('T15 safe rendering presents references and review action, never measurements or automatic changes',()=>{
  const i=input(),before=structuredClone(i);
  class Element{
    constructor(tag,doc){this.tag=tag;this.ownerDocument=doc;this.children=[];this.textContent='';}
    append(e){this.children.push(e);}
    replaceChildren(){this.children=[];}
    addEventListener(name,fn){this[name]=fn;}
  }
  const doc={createElement:tag=>new Element(tag,doc)},root=new Element('section',doc);
  const seen=[];renderFeedbackReview(root,feedbackView({...i,importError:'INVALID_HASH'}),p=>seen.push(p));
  const all=e=>[e,...e.children.flatMap(all)],nodes=all(root),text=nodes.map(e=>e.textContent).join(' ');
  for(const s of ['2026-11-28T12:00:00Z','DEMO-1','pr_number: 7','INVALID_HASH','<b>Text</b>','reported','verified','merged'])assert.ok(text.includes(s),s);
  assert.ok(!text.includes('rework_count'));
  assert.equal(seen.length,0);
  nodes.find(e=>e.tag==='button').click();
  assert.equal(seen.length,1);
  assert.deepEqual(i,before);
});

test('T15 mounted feedback panel preserves original bytes and requires a separate explicit owner review',async()=>{
  class Element{
    constructor(tag,doc){this.tag=tag;this.ownerDocument=doc;this.children=[];this.textContent='';this.value='';this.files=[];this.checked=false;this.disabled=false;}
    append(e){this.children.push(e);}
    replaceChildren(){this.children=[];}
    setAttribute(name,value){this[name]=value;}
    addEventListener(name,fn){this[name]=fn;}
  }
  const doc={createElement:tag=>new Element(tag,doc)},root=new Element('section',doc);
  const i=input(),sha='c'.repeat(64);i.projection.current.feedback.manifest_sha256=sha;
  const context={body:{project_id:'P1',selection:1,expected_head:sha},record:{manifest_bytes:JSON.stringify(i.manifest),requirements_bytes:JSON.stringify(i.requirements),manifest_sha256:sha},canEdit:true};
  const calls=[],candidates=[],changes=[];
  const response={binding:{binding_id:'demo',jira_project:'DEMO'},owner:'owner-test',projection:i.projection};
  const panel=mountFeedbackPanel({root,getContext:()=>context,request:async(path,body)=>{
    assert.equal(path,'/api/aira/feedback');calls.push(body);
    if(body.action==='confirm_decision'){
      if(!body.confirmation.confirmed||!body.confirmation.jira_confirmed)throw Error('APPROVAL_REQUIRED');
      return {json:async()=>({...response,approval_id:'review',requirements:{...i.requirements,revision:3},confirmed_ids:['B01','T01']})};
    }
    return {json:async()=>({...response,...(body.action==='import'?{status:'accepted'}:{})})};
  },onCandidate:r=>candidates.push(r),onChanged:()=>changes.push(true),saveBackup:()=>assert.fail('not requested')});
  const all=e=>[e,...e.children.flatMap(all)],findButton=text=>all(root).find(e=>e.tag==='button'&&e.textContent===text);
  const field=text=>all(root).find(e=>e.tag==='label'&&e.textContent.startsWith(text)).children[0];
  await panel.load();assert.deepEqual(calls.map(c=>c.action),['status']);assert.equal(candidates.length,0);
  findButton('Diff fachlich prüfen').click();assert.equal(calls.length,1);
  await findButton('Bestätigten Diff in Revisionsentwurf übernehmen').click();
  assert.equal(candidates.length,0);assert.ok(all(root).some(e=>e.textContent.includes('APPROVAL_REQUIRED')));
  findButton('Diff fachlich prüfen').click();
  field('Konfigurierter Fachowner').value='owner-test';field('Unabhängig geprüfter lokaler Beleg').value='review/local.json';field('Jira-Referenz').value='DEMO-7';
  field('Jira-Entscheidungsbeobachtung').checked=true;field('Als Fachowner').checked=true;
  await findButton('Bestätigten Diff in Revisionsentwurf übernehmen').click();
  assert.equal(candidates.length,1);assert.equal(candidates[0].approval_id,'review');
  assert.deepEqual(calls.at(-1).confirmation,{confirmed:true,actor:'owner-test',local_evidence_ref:'review/local.json',jira_key:'DEMO-7',jira_confirmed:true});
  assert.equal(calls.at(-1).proposal.manifest_sha256,sha);
  const bytes=Buffer.from('{"text":"äöü"}\n'),f=field('Originaldatei feedback.json');f.files=[new Blob([bytes])];f.change();
  field('Herkunft und unveränderte Originalbytes').checked=true;field('Optionale separate SHA-256').value='d'.repeat(64);
  await findButton('Feedback importieren').click();
  assert.equal(calls.at(-1).action,'import');assert.deepEqual(Buffer.from(calls.at(-1).bytes,'base64'),bytes);
  assert.equal(calls.at(-1).source_confirmed,true);assert.equal(calls.at(-1).sha256,'d'.repeat(64));
  assert.equal(changes.length,1);assert.equal(candidates.length,1);
  assert.ok(!all(root).some(e=>e.textContent.includes('rework_count')));
  assert.ok(calls.every(c=>['status','confirm_decision','import'].includes(c.action)));
});

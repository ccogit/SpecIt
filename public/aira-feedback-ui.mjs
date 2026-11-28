import {feedbackView} from './aira-feedback-model.mjs';
export {feedbackView,confirmDecisionProposal} from './aira-feedback-model.mjs';

const json=value=>JSON.stringify(value,null,2);
const b64=bytes=>{
  let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(raw);
};
const fail=message=>{throw Error(message);};

// All imported text is rendered as text, not HTML or external links.
// The review callback opens a diff; it is not permission to apply it.
export function renderFeedbackReview(container,view,onReviewProposal){
  const doc=container.ownerDocument;
  const el=(tag,text,parent=container)=>{const e=doc.createElement(tag);e.textContent=text;parent.append(e);return e;};
  const display=v=>v==null?'unknown':Array.isArray(v)?v.length?v.join(', '):'–':String(v);
  container.replaceChildren();
  el('h3','Aira-Rücklauf (read-only)');
  el('p','Revision '+view.revision+' · Quelle: '+(view.source_revision??'unknown')+' · '+(view.observed_at??'unknown')+' · '+view.freshness+' · '+view.import_state);
  if(view.importError)el('p','Importfehler: '+view.importError);
  for(const [label,rows] of [['Anforderungen',view.requirements],['Kriterien',view.criteria],['Tasks',view.tasks],['Entscheidungen / Klärungsbedarf',view.decisions],['Quittungshistorie',view.history],['Findings',view.findings]]){
    el('h4',label);
    const list=el('ul','');
    for(const row of rows){
      const {proposal,...fields}=row;
      const li=el('li',Object.entries(fields).map(([k,v])=>k+': '+display(v)).join(' · '),list);
      if(proposal){
        el('pre','Vorher: '+(proposal.before??'(offen)')+'\nVorschlag: '+proposal.after+'\nBeleg: '+proposal.source_evidence_ref,li);
        const button=el('button','Diff fachlich prüfen',li);button.type='button';
        button.disabled=typeof onReviewProposal!=='function';
        button.addEventListener('click',()=>onReviewProposal?.(structuredClone(proposal)));
      }
    }
  }
}

// Mounted inside the SI-6 handoff dialog. All authority comes from the
// selected server archive; no localStorage or learning/runner integration.
export function mountFeedbackPanel({root,getContext,request,parseBackup=JSON.parse,onCandidate,onChanged=()=>{},onStatus=()=>{},saveBackup}){
  const doc=root.ownerDocument;
  root.replaceChildren();
  const el=(tag,text,parent=root)=>{const e=doc.createElement(tag);e.textContent=text;parent.append(e);return e;};
  const input=(label,type,parent=root)=>{
    const wrap=el('label',label+' ',parent),field=el('input','',wrap);field.type=type;return field;
  };
  const button=(label,fn,parent=root)=>{const e=el('button',label,parent);e.type='button';e.addEventListener('click',fn);return e;};
  el('h3','Aira-Feedback importieren');
  const status=el('p','Feedbackstatus: unknown');status.setAttribute('role','status');
  const bindingStatus=el('p','Bindung: unknown');
  const bindingId=input('Unabhängig geprüfte Aira-Binding-ID (UUID)','text');
  const jiraProject=input('Jira-Projekt','text');
  const bindChecked=input('Zielbindung anhand der vertrauenswürdigen Aira-Registry geprüft','checkbox');
  const bindButton=button('Feedbackbindung bestätigen',()=>perform('bind',()=>({
    binding_id:bindingId.value.trim(),jira_project:jiraProject.value.trim(),confirmed:bindChecked.checked})));
  const file=input('Originaldatei feedback.json','file');file.accept='.json,application/json';
  const sha=input('Optionale separate SHA-256-Quittung','text');
  const sourceChecked=input('Herkunft und unveränderte Originalbytes geprüft (Hash allein beweist keine Herkunft)','checkbox');
  const importButton=button('Feedback importieren',()=>perform('import',async()=>{
    const f=file.files[0];if(!f||f.size>2*1024*1024)fail('Originaldatei fehlt oder ist zu groß.');
    const bytes=new Uint8Array(await f.arrayBuffer()),expected=sha.value.trim().toLowerCase();
    return {bytes:b64(bytes),source_confirmed:sourceChecked.checked,...(expected?{sha256:expected}:{})};
  }));
  const refresh=button('Feedbackstatus aktualisieren',()=>perform('status'));
  const backupButton=button('Feedback-Sicherung herunterladen',()=>perform('backup'));
  const restoreFile=input('Feedback-Sicherung (JSON)','file');restoreFile.accept='.json,application/json';
  const restoreChecked=input('Sicherung und Herkunft unabhängig geprüft','checkbox');
  const restoreButton=button('Feedback-Sicherung wiederherstellen',()=>perform('restore',async()=>{
    const f=restoreFile.files[0];if(!f||f.size>60*1024*1024)fail('Sicherungsdatei fehlt oder ist zu groß.');
    return {backup:parseBackup(await f.text()),source_confirmed:restoreChecked.checked};
  }));
  file.addEventListener('change',()=>{sourceChecked.checked=false;sha.value='';});
  restoreFile.addEventListener('change',()=>{restoreChecked.checked=false;});
  const viewRoot=el('section','');
  const reviewRoot=el('section','');reviewRoot.hidden=true;
  el('h4','Fachliche Entscheidung prüfen',reviewRoot);
  const diff=el('pre','',reviewRoot);
  const ownerStatus=el('p','',reviewRoot);
  const actor=input('Konfigurierter Fachowner (Actor-ID)','text',reviewRoot);
  const evidence=input('Unabhängig geprüfter lokaler Beleg (relative Referenz)','text',reviewRoot);
  const jiraKey=input('Jira-Referenz der beobachteten Entscheidung','text',reviewRoot);
  const jiraChecked=input('Jira-Entscheidungsbeobachtung unabhängig geprüft','checkbox',reviewRoot);
  const ownerChecked=input('Als Fachowner diesen exakten Diff bestätigen; nur einen Entwurf für die neue Revision erzeugen','checkbox',reviewRoot);
  const apply=button('Bestätigten Diff in Revisionsentwurf übernehmen',()=>perform('confirm_decision',()=>({
    proposal:selected,confirmation:{confirmed:ownerChecked.checked,actor:actor.value.trim(),local_evidence_ref:evidence.value.trim(),
      jira_key:jiraKey.value.trim(),jira_confirmed:jiraChecked.checked}})),reviewRoot);
  button('Prüfung abbrechen',()=>selectProposal(null),reviewRoot);
  let generation=0,state=null,busy=false,selected=null,importError=null,resultText='';
  function selectProposal(proposal){
    selected=proposal;reviewRoot.hidden=!proposal;
    actor.value='';evidence.value='';jiraChecked.checked=false;ownerChecked.checked=false;jiraKey.value='';
    if(proposal){
      diff.textContent=proposal.id+' · Revision '+proposal.revision+' · SHA-256 '+proposal.receipt_sha256+
        '\nVorher: '+(proposal.before??'(offen)')+'\nNachher: '+proposal.after+'\nAira-Beleg: '+proposal.source_evidence_ref;
      jiraKey.value=state?.projection?.current?.feedback?.tasks.find(t=>t.id===proposal.id)?.jira_key??'';
    }else diff.textContent='';
    buttons();
  }
  function buttons(){
    const context=getContext(),bound=!!state?.binding,ready=!!context&&!busy;
    for(const x of [bindingId,jiraProject,bindChecked,bindButton])x.disabled=!ready||bound;
    for(const x of [file,sha,sourceChecked,importButton,restoreFile,restoreChecked,restoreButton])x.disabled=!ready||!bound||!context?.record;
    refresh.disabled=!ready;backupButton.disabled=!ready||!bound;
    apply.disabled=!ready||!selected||!state?.owner||!context?.canEdit;
    ownerStatus.textContent=state?.owner?'Fachowner: '+state.owner+' (lokale vertrauenswürdige Anwendung)':
      'Fachowner nicht konfiguriert. SPECIT_AIRA_FEEDBACK_OWNER am lokalen Server setzen.';
  }
  function render(){
    const context=getContext(),record=context?.record,projection=state?.projection;
    const last=projection?.history?.at(-1);
    bindingStatus.textContent=state?.binding?'Feedbackbindung: '+state.binding.binding_id+' · '+state.binding.jira_project:'Feedbackbindung: unknown / nicht bestätigt';
    status.textContent=importError?'Importfehler / Klärungsbedarf: '+importError:
      'Feedbackstatus: '+(projection?.freshness??'unknown')+(resultText?' · '+resultText:'');
    onStatus(last?'Letzte bekannte Aira-Quittung: Sequenz '+last.feedback.sequence+' · Revision '+last.feedback.revision+' · '+last.feedback.observed_at+' · '+projection.freshness:
      'Letzte bekannte Aira-Quittung: unbekannt / nicht verfügbar');
    viewRoot.replaceChildren();
    if(record){
      const view=feedbackView({projection,manifest:parseBackup(record.manifest_bytes),requirements:parseBackup(record.requirements_bytes),
        manifestSha:record.manifest_sha256,importError});
      renderFeedbackReview(viewRoot,view,selectProposal);
    }else el('p','Keine archivierte Revision. Rücklauf bleibt unknown.',viewRoot);
    buttons();
  }
  function clear(){
    generation++;busy=false;state=null;importError=null;resultText='';
    bindingId.value='';jiraProject.value='';bindChecked.checked=false;file.value='';sha.value='';sourceChecked.checked=false;
    restoreFile.value='';restoreChecked.checked=false;selectProposal(null);render();
  }
  async function perform(action,extra=()=>({}),force=false){
    const context=getContext();
    if(!context||busy&&!force)return;
    const fingerprint=JSON.stringify(context.body),ticket=++generation;
    const still=()=>ticket===generation&&JSON.stringify(getContext()?.body)===fingerprint;
    busy=true;buttons();
    try{
      const payload=await extra();
      if(!still())return;
      const result=await (await request('/api/aira/feedback',{...context.body,action,...payload})).json();
      if(!still())return;
      state=result;importError=null;resultText=result.status??'';
      if(action==='backup')saveBackup(result.backup);
      if(action==='bind'||(['import','restore'].includes(action)&&result.status!=='no_op'))onChanged();
      if(action==='confirm_decision'){onCandidate(result);resultText='Fachlich bestätigter Kandidat; keine archivierte Änderung. Vorschau und Freigabe erforderlich.';}
      if(action==='import'){file.value='';sourceChecked.checked=false;sha.value='';}
      if(action==='restore'){restoreFile.value='';restoreChecked.checked=false;}
      selectProposal(null);
    }catch(e){if(still())importError=e.message;}
    finally{if(ticket===generation){busy=false;render();}}
  }
  return {clear,load(){state=null;importError=null;resultText='';selectProposal(null);return perform('status',()=>({}),true);}};
}

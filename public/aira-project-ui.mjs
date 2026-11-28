import {projectRequirementsPlan} from '/planner.mjs';
import {proposeRequirementPlan} from '/aira-plan-proposal.mjs';
import {interviewDecisionDrafts} from '/interview.mjs';
import {confirmRequirementRevision,requirementCoverageReport} from '/aira-requirement-revisions.mjs';
import {parseAiraJson,sameManifest} from '/aira-identities.mjs';
import {mountFeedbackPanel} from '/aira-feedback-ui.mjs';

const json=value=>JSON.stringify(value,null,2);
const read=element=>parseAiraJson(element.value);
const byId=id=>document.getElementById(id);
const error=message=>{throw Error(message);};
import {readV1PackageDirectories} from '/aira-v2-ui.mjs';

export function mountAiraV2({getCurrent,getQuestions,getRepo,getV1History,isBusy,notice,getStandaloneContext,onModeChange=()=>{}}){
  const dialog=byId('airaV2Dialog'),id=byId('airaV2PlanId'),repo=byId('airaV2Repo'),editor=byId('airaV2Draft'),mapping=byId('airaV2Mapping'),links=byId('airaV2Links'),migration=byId('airaV2Migration'),points=byId('airaV2Points'),status=byId('airaV2Status'),approval=byId('airaV2Approve'),download=byId('airaV2Download'),review=byId('airaV2Review'),coverage=byId('airaV2Coverage'),confirmations=byId('airaV2Confirmations'),first=byId('airaV2First'),previewButton=byId('airaV2Preview');
  let source=null,questions=[],preview=null,context=null,selection=null,version=0,working=false,feedbackApproval=null;
  const bind=byId('airaV2Bind'),modeStatus=byId('airaProjectModeStatus');
  const binding=()=>{
    if(!/^[A-Za-z0-9][A-Za-z0-9-]{0,23}$/.test(id.value)||!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo.value))error('Gültige Plan-ID und Zielrepository erforderlich.');
    return {plan_id:id.value,repo:repo.value};
  };
  const contextBody=(c=context)=>({project_id:c.project.project_id,selection:c.selection,...c.project.binding,
    expected_generation:c.project.generation,expected_head:c.project.manifest_sha256,expected_export_epoch:c.project.export_epoch});
  function revoke(p){if(p)void request('/api/aira/preview/invalidate',{...p.context,preview_id:p.result.preview_id}).catch(()=>{});}
  function invalidate(){const p=preview;preview=null;version++;approval.checked=false;download.disabled=true;review.textContent='';byId('airaV2Conflict').textContent='';revoke(p);}
  function clearContext(){
    invalidate();context=null;feedbackApproval=null;feedbackPanel.clear();editor.value='';mapping.value='{}';links.value='[]';migration.value='';points.value='{}';confirmations.value='';first.checked=false;coverage.textContent='';
    byId('airaV2MigrationIds').textContent='';byId('airaV2ProposalKeys').textContent='';byId('airaV2PointRows').replaceChildren();byId('airaV2History').textContent='';
    byId('airaV2ExportStatus').textContent='Exportstatus: Stand nicht geladen';byId('airaV2ReceiptStatus').textContent='Letzte bekannte Aira-Quittung: unbekannt';
    updateActions();
  }
  function updateActions(){
    for(const key of ['airaV2Load','airaV2Restore','airaV2SaveBackup','airaV2Migrate','airaV2Propose','airaV2Preview']){
      byId(key).disabled=working||(['airaV2SaveBackup','airaV2Migrate','airaV2Propose','airaV2Preview'].includes(key)&&!context)
        ||(['airaV2Migrate','airaV2Propose','airaV2Preview'].includes(key)&&!source);
    }
    download.disabled=working||!preview||!approval.checked;
  }
  function ensureCurrent(requirePlan=true){
    if(!dialog.open||source!==getCurrent()||isBusy()||json(questions)!==json(getQuestions()))error('Plan, Spezifikation oder Interview geändert. Dialog erneut öffnen.');
    if(requirePlan&&!source)error('Bitte zuerst einen aktuellen Plan erstellen.');
    return binding();
  }
  function ensureContext(requirePlan=true){
    const b=ensureCurrent(requirePlan);
    if(!context||context.project.binding.plan_id!==b.plan_id||context.project.binding.repo!==b.repo)error('Bindung oder Historie geändert. Stand neu laden.');
    return context.record;
  }
  function setSelection(next){
    selection=next;
    const p=next?.project;
    modeStatus.textContent=!next?'Projektmodus: unbekannt – direkte Umsetzung gesperrt':p?.mode==='aira'
      ?'Integriert · '+p.binding.plan_id+' · '+p.binding.repo+' · Revision '+p.revision+' · keine direkte Umsetzung':'Standalone · direkte Umsetzung nur für getrennte Projekte';
    onModeChange();
  }
  async function refresh(){const next=await (await request('/api/aira/project',{action:'status'})).json();setSelection(next);return next;}
  async function selectBinding(b,backup){
    const before=await refresh(),p=before.project;
    const same=p?.mode==='aira'&&p.binding.plan_id===b.plan_id&&p.binding.repo===b.repo;
    if(same&&!bind.checked)return before;
    if(!bind.checked)error('Projektbindung bzw. Moduswechsel ausdrücklich bestätigen.');
    let src=source?JSON.parse(source):null;
    if(!src&&backup?.records?.[0]?.snapshot&&backup.packages?.[0]?.['SPEC.md']){
      const spec=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(backup.packages[0]['SPEC.md']),c=>c.charCodeAt(0)));
      src={plan:backup.records[0].snapshot.plan,spec};
    }
    const next=await (await request('/api/aira/project',{action:'activate',mode:'aira',binding:b,confirmed:true,expected_selection:before.selection,...(src?{source:{plan:src.plan,spec:src.spec}}:{})})).json();
    setSelection(next);bind.checked=false;return next;
  }
  function showHistory(h){
    byId('airaV2History').textContent=h.history.length?h.history.map(x=>'Revision '+x.revision+' · '+x.manifest_sha256).join('\n'):'Keine V2-Revision im Serverarchiv.';
    byId('airaV2ExportStatus').textContent=h.export_status==='archived'?'Exportstatus: Revision '+h.project.revision+' lokal archiviert (kein Zustellnachweis)':'Exportstatus: noch nicht exportiert';
    byId('airaV2ReceiptStatus').textContent='Letzte bekannte Aira-Quittung: '+(h.last_known_receipt?json(h.last_known_receipt):'unbekannt / nicht verfügbar');
  }
  function showPoints(){
    const root=byId('airaV2PointRows');root.replaceChildren();
    try{
      const draft=read(editor), values=read(points), prior=context?.record?parseAiraJson(context.record.manifest_bytes):null;
      for(const task of [...draft.plan.tasks,...draft.requirements.decisions]){
        const label=document.createElement('label'),select=document.createElement('select');
        const old=prior?.tasks?.[task.id]?.points??prior?.blockers?.find(x=>x.id===task.id)?.points;
        label.textContent=task.id+' · '+(task.title??task.question??task.id)+(old!==undefined?' (bisher '+old+')':'')+' ';
        for(const value of ['',1,2,3,5,8]){const option=document.createElement('option');option.value=String(value);option.textContent=value===''?'Bitte bestätigen':String(value);select.append(option);}
        select.value=[1,2,3,5,8].includes(values[task.id])?String(values[task.id]):'';
        select.onchange=()=>{const next=read(points);next[task.id]=select.value?Number(select.value):null;points.value=json(next);invalidate();};
        label.append(select);root.append(label);
      }
    }catch{}
  }
  async function loadHistory(selected,reset=true){
    const h=await (await request('/api/aira/history',contextBody(selected))).json();
    if(!dialog.open||binding().plan_id!==h.project.binding.plan_id||binding().repo!==h.project.binding.repo)error('Bindung geändert.');
    context=h;feedbackApproval=null;setSelection({...selected,project:h.project});showHistory(h);
    if(reset&&h.record){
      migration.value='';confirmations.value='';first.checked=false;byId('airaV2MigrationIds').textContent='';byId('airaV2ProposalKeys').textContent='';
      const next=structuredClone(h.record.snapshot);next.requirements.revision++;
      editor.value=json({plan:next.plan,requirements:next.requirements});mapping.value=json(h.record.mapping);
      points.value=json(Object.fromEntries([...next.plan.tasks,...next.requirements.decisions].map(x=>[x.id,null])));
      showCoverage();showPoints();
    }
    await feedbackPanel.load();updateActions();return h;
  }
  const readMigration=()=>migration.value.trim()?read(migration):null;
  const showCoverage=()=>{
    try{
      const draft=read(editor);
      coverage.textContent=requirementCoverageReport(draft.requirements).map(r=>r.id+' · '+({covered:'abgedeckt',missing:'FEHLT',exception:'genehmigte Ausnahme'}[r.state])+' · '+r.criterion_ids.join(', ')+(r.exception?' · '+r.exception.reason:'')).join('\n');
    }catch{coverage.textContent='Requirements-Entwurf noch nicht lesbar.'}
  };
  const request=async(path,body)=>{
    const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    if(!response.ok){const result=await response.json();error(result.error||'Aira-Anfrage fehlgeschlagen.');}
    return response;
  };
  const attempt=fn=>async()=>{if(working)return;working=true;updateActions();try{await fn()}catch(e){invalidate();status.textContent=e.message;if(dialog.open)byId('airaV2Conflict').textContent=e.message;else notice(e.message)}finally{working=false;updateActions()}};
  const open=attempt(async()=>{
    source=getCurrent();questions=structuredClone(getQuestions());clearContext();bind.checked=false;
    id.value='';repo.value=getRepo();status.textContent='Plan-ID und Repository wählen. Bei neuem Projekt oder Wechsel die Bindung ausdrücklich bestätigen.';
    byId('airaV2Questions').textContent=questions.map(q=>q.question+' ('+q.state+')').join('\n');
    dialog.showModal();const selected=await refresh();
    if(selected.project?.mode==='aira'&&dialog.open){
      id.value=selected.project.binding.plan_id;repo.value=selected.project.binding.repo;
      await loadHistory(selected);status.textContent='Serverarchiv geladen. Punkte und Änderungen erneut fachlich bestätigen.';
    }
  });
  byId('goAiraV2').onclick=open;byId('airaProjectOpen').onclick=open;
  byId('airaStandaloneProject').onclick=attempt(async()=>{
    if(isBusy())error('Umsetzung läuft oder Status ist unbekannt.');
    if(!window.confirm('Ein getrenntes Standalone-Projekt auswählen? Bestehende Aira-Bindungen bleiben geschützt.'))return;
    const before=await refresh(),src=getStandaloneContext();
    const next=await (await request('/api/aira/project',{action:'activate',mode:'standalone',confirmed:true,expected_selection:before.selection,source:src})).json();
    setSelection(next);notice('Getrennter Standalone-Modus gewählt.');
  });
  byId('airaV2Close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{source=null;questions=[];clearContext()});
  dialog.addEventListener('input',event=>{
    if(event.target.closest?.('#airaV2Feedback'))return;
    if(event.target===approval){if(!approval.checked&&preview)invalidate();updateActions();return;}
    if(event.target===bind)return;
    if(event.target===id||event.target===repo){clearContext();bind.checked=false;status.textContent='Stand für diese Bindung neu laden.';return;}
    if(event.target.closest?.('#airaV2PointRows'))return;
    invalidate();if(event.target===editor){showCoverage();showPoints();}
    if(event.target===points)showPoints();
    if(event.target===mapping&&context)delete context.proposalMapping;
  });
  byId('airaV2Load').onclick=attempt(async()=>{
    const b=ensureCurrent(false);clearContext();const selected=await selectBinding(b);
    ensureCurrent(false);const h=await loadHistory(selected);
    status.textContent=h.record?'Persistierter Stand geladen. Änderungen und Punkte erneut bestätigen.':'Noch keine V2-Revision. Erstaufnahme bestätigen oder Originalhistorie wiederherstellen.';
  });
  byId('airaV2Restore').onclick=attempt(async()=>{
    const b=ensureCurrent(false),f=byId('airaV2Backup').files[0];
    if(!f)error('Bitte vollständige V2-Sicherung wählen.');
    const backup=parseAiraJson(await f.text());ensureCurrent(false);
    if(backup.schema_version!==2||backup.plan_id!==b.plan_id||backup.repo!==b.repo||!Array.isArray(backup.packages)||!backup.packages.length||!Array.isArray(backup.records))error('Vollständige Sicherung mit passender Bindung erforderlich.');
    if(!window.confirm('Vollständige Originalkette serverseitig prüfen und wiederherstellen?'))return;
    const selected=await selectBinding(b,backup);invalidate();ensureCurrent(false);
    const h=await (await request('/api/aira/v2/restore',{...contextBody(selected),packages:backup.packages,records:backup.records})).json();
    await loadHistory(h);status.textContent='Originalkette serverseitig geprüft und wiederhergestellt.';
  });
  byId('airaV2Migrate').onclick=attempt(async()=>{
    if(ensureContext())error('Migration nur für die erste V2-Revision.');
    const b=binding(),packages=await readV1PackageDirectories(byId('airaV2Packages').files);
    const target=byId('airaV2Target').value,evidence_ref=byId('airaV2Evidence').value;
    const verified=await (await request('/api/aira/migration',{...b,migration:{packages,target,evidence_ref}})).json();
    ensureContext();
    const known=new Map();
    for(const raw of verified.manifest_bytes){
      const m=parseAiraJson(raw);
      for(const entry of [...m.plan.tasks,...m.blockers])known.set(entry.id,entry.title??entry.decision);
    }
    const prior=getV1History(b.plan_id);
    if(prior.length>verified.manifest_bytes.length||prior.some((m,i)=>!sameManifest(m,parseAiraJson(verified.manifest_bytes[i]))))error('Originalpakete stimmen nicht mit lokaler V1-Historie überein.');
    migration.value=json({...verified,confirmed:false,mapping:[...known].map(([id])=>({id,action:''}))});
    byId('airaV2MigrationIds').textContent=[...known].map(([id,t])=>id+' · '+t).join('\n');
    status.textContent='Originalpakete geprüft. Migration je ID retain/retire zuordnen, neue Vorschlags-Schlüssel explizit auf V1-IDs abbilden, Migrationsfeld confirmed=true setzen.';
    invalidate();
  });
  byId('airaV2Propose').onclick=attempt(async()=>{
    const record=ensureContext(),b=binding(),m=readMigration();
    if(!record&&getV1History(b.plan_id).length&&!m)error('V1-Migration erforderlich.');
    const draft=proposeRequirementPlan(JSON.parse(source).plan,{plan_id:b.plan_id,previous:record?.snapshot??null,mapping:read(mapping),migration:m,decisions:interviewDecisionDrafts(questions,read(links))});
    editor.value=json({plan:draft.plan,requirements:draft.requirements});
    // Candidate IDs are displayed separately, not silently accepted as an
    // identity mapping on a later regeneration.
    byId('airaV2ProposalKeys').textContent=json(draft.mapping);
    context.proposalMapping=draft.mapping;
    confirmations.value='';points.value=json(Object.fromEntries([...draft.plan.tasks,...draft.requirements.decisions].map(t=>[t.id,null])));
    showCoverage();showPoints();invalidate();status.textContent='Unbestätigter Vorschlag. Bestehende IDs im Zuordnungsfeld explizit wählen, ggf. neu erzeugen, fachliche Daten/Referenzen und Tombstone-Gründe bearbeiten.';
  });
  function input(){
    const record=ensureContext(),b=binding(),m=readMigration(),draft=read(editor);
    if(!record&&!first.checked&&!m)error('Erstaufnahme ausdrücklich bestätigen oder Sicherung wiederherstellen.');
    if(!record&&getV1History(b.plan_id).length&&!m)error('V1-Migration erforderlich.');
    if(record&&m)error('Keine erneute V1-Migration.');
    if(m&&!m.confirmed)error('V1-Mapping und Migrationsnachweis ausdrücklich bestätigen.');
    const confirmedIds=confirmations.value.split(/[\s,;]+/).filter(Boolean);
    const plan=projectRequirementsPlan(draft.plan,draft.requirements);
    const snapshot=confirmRequirementRevision(plan,draft.requirements,{previous:record?.snapshot??null,confirmedIds,migration:m});
    const current=JSON.parse(source);
    const chosen=context.proposalMapping??read(mapping);
    const active=new Set([...snapshot.plan.tasks,...snapshot.requirements.requirements,...snapshot.requirements.criteria,...snapshot.requirements.tests,...snapshot.requirements.decisions].map(x=>x.id));
    const mapped=Object.fromEntries(Object.entries(chosen).filter(([,value])=>active.has(value)));
    return {snapshot, payload:{...contextBody(),...b,mapping:mapped,schema_version:2,revision:draft.requirements.revision,plan,requirements:draft.requirements,spec:current.spec,target_minutes:current.target_minutes,confirmed_points:read(points),confirmed_ids:confirmedIds,...(feedbackApproval?{feedback_approval:feedbackApproval}:{}),...(m?{migration:m}:{})}};
  }
  previewButton.onclick=attempt(async()=>{
    invalidate();const state=input(),fingerprint=JSON.stringify(state.payload),v=version,c=contextBody();
    const result=await (await request('/api/aira/preview',state.payload)).json();
    const candidate={fingerprint,result,context:c};
    try{if(v!==version||fingerprint!==JSON.stringify(input().payload))error('Eingaben geändert; erneut prüfen.');}
    catch(e){revoke(candidate);throw e;}
    preview=candidate;
    const d=result.comparison;
    review.textContent='Revision '+result.manifest.revision+' · '+(result.unchanged?'unveränderte Wiederholung':'neuer Export')+
      '\nVergleich mit Revision '+(d.previous_revision??'–')+' · SPEC geändert: '+(d.spec_changed?'ja':'nein')+
      '\nNeue IDs: '+(d.added.join(', ')||'–')+'\nEntfernte IDs: '+(d.removed.join(', ')||'–')+'\nGeänderte IDs: '+(d.changed.join(', ')||'–')+
      '\nPunkteänderungen: '+(d.points_changed.map(x=>x.id+': '+(x.before??'–')+' → '+x.after).join(', ')||'–')+
      '\nSHA-256 Manifest: '+result.manifest_sha256+'\n'+json(result.manifest)+'\n'+result.requirements_bytes+'\n'+Object.entries(result.drafts).map(([path,body])=>path+'\n'+body).join('\n\n');
    status.textContent='Exakte Projektion prüfen und fachlich freigeben (Vorschau 5 Minuten gültig).';
  });
  function saveBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  download.onclick=attempt(async()=>{
    const p=preview;
    if(!p||!approval.checked||Date.now()>=p.result.expires_at)error('Aktuelle Vorschau und fachliche Freigabe erforderlich.');
    const state=input(),still=()=>preview===p&&approval.checked&&p.fingerprint===JSON.stringify(input().payload);
    if(!still())error('Veraltete Freigabe.');
    const response=await request('/api/aira/export',{...state.payload,approved:true,changes_approved:true,preview_id:p.result.preview_id,expected_manifest_sha256:p.result.manifest_sha256});
    const blob=await response.blob();
    let current=false;try{current=still()}catch{}
    if(!current){invalidate();if(dialog.open)byId('airaV2ExportStatus').textContent='Exportstatus: neu laden – die zuletzt freigegebene Revision kann bereits archiviert sein';status.textContent='Eingaben geändert; kein Download. Der Server kann die zuvor freigegebene Revision bereits archiviert haben. Stand neu laden.';return;}
    preview=null;invalidate();
    saveBlob(blob,'aira-v2-'+state.payload.plan_id+'-r'+p.result.manifest.revision+'.zip');
    await loadHistory(context);
    status.textContent='Freigegebenes Paket lokal archiviert und heruntergeladen. Keine automatische Aira-Übergabe oder Agentenausführung.';
  });
  byId('airaV2SaveBackup').onclick=attempt(async()=>{
    ensureContext(false);
    const h=await (await request('/api/aira/history',{...contextBody(),action:'backup'})).json();
    if(!h.packages.length)error('Keine V2-Historie gespeichert.');
    const backup={schema_version:2,...h.project.binding,packages:h.packages,records:h.records};
    saveBlob(new Blob([json(backup)],{type:'application/json'}),'specit-v2-'+h.project.binding.plan_id+'-history.json');
  });
  const feedbackPanel=mountFeedbackPanel({root:byId('airaV2Feedback'),
    getContext:()=>context?{body:contextBody(),record:context.record,canEdit:!!source&&!!context.record}:null,
    request,parseBackup:parseAiraJson,
    onStatus:text=>{byId('airaV2ReceiptStatus').textContent=text;},
    onChanged:()=>{feedbackApproval=null;invalidate();},
    saveBackup:backup=>saveBlob(new Blob([json(backup)],{type:'application/json'}),'specit-aira-'+id.value+'-feedback.json'),
    onCandidate:result=>{
      if(working)error('Übergabe läuft; Diff erneut prüfen.');
      const record=ensureContext();if(!record)error('Keine archivierte Ausgangsrevision.');
      const base=structuredClone(record.snapshot);base.requirements.revision++;
      if(!sameManifest(read(editor),{plan:base.plan,requirements:base.requirements}))error('Der Entwurf enthält andere Änderungen. Bitte separat sichern und den Archivstand neu laden.');
      const plan=projectRequirementsPlan(base.plan,result.requirements);
      confirmRequirementRevision(plan,result.requirements,{previous:record.snapshot,confirmedIds:result.confirmed_ids});
      invalidate();feedbackApproval=result.approval_id;
      editor.value=json({plan,requirements:result.requirements});confirmations.value=result.confirmed_ids.join(' ');
      points.value=json(Object.fromEntries([...plan.tasks,...result.requirements.decisions].map(t=>[t.id,null])));
      showCoverage();showPoints();status.textContent='Fachlich bestätigter Entscheidungsdiff als neuer Entwurf. Punkte, Vorschau und Exportfreigabe separat bestätigen; kein automatischer Writeback oder Jira-Release.';
    }});
  void refresh().catch(()=>setSelection(null));
  return {blocksRun:()=>!selection||selection.project?.mode==='aira',sync(){
    if(dialog.open&&(source!==getCurrent()||json(questions)!==json(getQuestions())||isBusy())){
      invalidate();status.textContent='Eingaben oder Ausführungsstatus geändert. Dialog erneut öffnen.';
    }
  }};
}

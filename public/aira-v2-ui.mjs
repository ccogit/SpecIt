import {proposeRequirementPlan,projectRequirementsPlan} from '/planner.mjs';
import {interviewDecisionDrafts} from '/interview.mjs';
import {confirmRequirementRevision,requirementCoverageReport} from '/aira-requirement-revisions.mjs';
import {parseAiraJson,sameManifest} from '/aira-identities.mjs';

const json=value=>JSON.stringify(value,null,2);
const read=element=>parseAiraJson(element.value);
const byId=id=>document.getElementById(id);
const error=message=>{throw Error(message);};
const base64=bytes=>{
  let raw='';
  for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(raw);
};
const decode=value=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Uint8Array.from(atob(value),c=>c.charCodeAt(0)));

// An extracted package directory preserves every file as raw bytes. Selecting
// a parent with multiple revision directories is supported; no files written.
export async function readV1PackageDirectories(files){
  const all=[...files],roots=all.filter(f=>f.webkitRelativePath.endsWith('/manifest.json')).map(f=>f.webkitRelativePath.slice(0,-'manifest.json'.length));
  if(!roots.length||roots.some(a=>roots.some(b=>a!==b&&a.startsWith(b))))error('Bitte entpackte, getrennte V1-Paketordner mit manifest.json auswählen.');
  const packages=roots.map(()=>Object.create(null));
  let size=0;
  for(const file of all){
    const i=roots.findIndex(root=>file.webkitRelativePath.startsWith(root));
    if(i<0)error('Datei außerhalb der V1-Paketordner.');
    const path=file.webkitRelativePath.slice(roots[i].length);
    if(Object.hasOwn(packages[i],path))error('Doppelter Paketpfad.');
    const bytes=new Uint8Array(await file.arrayBuffer());size+=bytes.length;
    if(size>900000)error('V1-Originalpakete zu groß für diese lokale Anfrage.');
    packages[i][path]=base64(bytes);
  }
  return packages.sort((a,b)=>parseAiraJson(decode(a['manifest.json'])).revision-parseAiraJson(decode(b['manifest.json'])).revision);
}

export function mountAiraV2({getCurrent,getQuestions,getRepo,getV1History,isBusy,notice}){
  const dialog=byId('airaV2Dialog'),id=byId('airaV2PlanId'),repo=byId('airaV2Repo'),editor=byId('airaV2Draft'),mapping=byId('airaV2Mapping'),links=byId('airaV2Links'),migration=byId('airaV2Migration'),points=byId('airaV2Points'),status=byId('airaV2Status'),approval=byId('airaV2Approve'),download=byId('airaV2Download'),review=byId('airaV2Review'),coverage=byId('airaV2Coverage'),confirmations=byId('airaV2Confirmations'),first=byId('airaV2First'),previewButton=byId('airaV2Preview');
  let source=null,questions=[],preview=null,context=null;
  const storageKey=()=> 'specit-aira-v2:'+id.value;
  const binding=()=>{
    if(!/^[A-Za-z0-9][A-Za-z0-9-]{0,23}$/.test(id.value)||!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo.value))error('Gültige Plan-ID und Zielrepository erforderlich.');
    return {plan_id:id.value,repo:repo.value};
  };
  const local=()=>{
    const raw=localStorage.getItem(storageKey());
    if(raw===null)return {raw,record:null};
    const record=parseAiraJson(raw),b=binding();
    if(record.snapshot?.requirements?.plan_id!==b.plan_id||record.repo!==b.repo||typeof record.manifest_bytes!=='string'||typeof record.requirements_bytes!=='string'||!record.manifest_sha256||!record.mapping)error('Ungültige oder unpassende V2-Historie. Kein Erstexport.');
    const m=parseAiraJson(record.manifest_bytes),r=parseAiraJson(record.requirements_bytes);
    if(m.schema_version!==2||m.plan_id!==b.plan_id||m.repo!==b.repo||!sameManifest(m.plan,record.snapshot.plan)||!sameManifest(r,record.snapshot.requirements))error('Persistierte V2-Historie stimmt nicht mit den Originaldaten überein.');
    return {raw,record};
  };
  function invalidate(){preview=null;approval.checked=false;download.disabled=true;review.textContent='';}
  function clearContext(){
    context=null;editor.value='';mapping.value='{}';links.value='[]';migration.value='';points.value='{}';confirmations.value='';first.checked=false;coverage.textContent='';byId('airaV2MigrationIds').textContent='';byId('airaV2ProposalKeys').textContent='';invalidate();
  }
  const ensureCurrent=()=>{
    if(!dialog.open||source!==getCurrent()||isBusy()||json(questions)!==json(getQuestions()))error('Plan, Spezifikation oder Interview geändert. Dialog erneut öffnen.');
    binding();
  };
  const ensureContext=()=>{
    ensureCurrent();const b=binding(),l=local();
    if(!context||context.id!==b.plan_id||context.repo!==b.repo||context.raw!==l.raw)error('Plan-ID, Repository oder Historie geändert. Stand neu laden.');
    return l.record;
  };
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
  const attempt=fn=>async()=>{try{await fn()}catch(e){invalidate();status.textContent=e.message}};
  byId('goAiraV2').onclick=()=>{
    if(isBusy()||!getCurrent()){notice('Aira V2: Bitte zuerst aktuellen Plan erstellen und prüfen.');return;}
    source=getCurrent();questions=structuredClone(getQuestions());
    clearContext();repo.value=getRepo();status.textContent='Plan-ID eingeben, dann Stand laden. Keine automatische fachliche Bestätigung.';
    byId('airaV2Questions').textContent=questions.map(q=>q.question+' ('+q.state+')').join('\n');
    dialog.showModal();
  };
  byId('airaV2Close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{source=null;questions=[];clearContext()});
  dialog.addEventListener('input',event=>{
    if(event.target===approval){download.disabled=!preview||!approval.checked;return;}
    if(event.target===id||event.target===repo){clearContext();status.textContent='Stand für diese Bindung neu laden.';return;}
    invalidate();if(event.target===editor)showCoverage();
  });
  byId('airaV2Load').onclick=attempt(async()=>{
    ensureCurrent();clearContext();const b=binding(),{raw,record}=local();
    context={id:b.plan_id,repo:b.repo,raw};
    if(record){
      const next=structuredClone(record.snapshot);
      next.requirements.revision++;
      editor.value=json({plan:next.plan,requirements:next.requirements});
      mapping.value=json(record.mapping);
      points.value=json({}); // points must be confirmed for this export again
      showCoverage();status.textContent='Persistierter Stand geladen. Änderungen mit expliziten IDs bestätigen; unveränderte Wiederholung möglich.';
    }else{
      status.textContent=getV1History(b.plan_id).length?'V1-Historie vorhanden. Erst Originalpakete und Migrationsnachweis laden.':'Kein lokaler V2-Stand. Bei Erstexport ausdrücklich bestätigen, bei bestehendem externem Stand zuerst Wiederherstellung.';
    }
  });
  byId('airaV2Restore').onclick=attempt(async()=>{
    ensureCurrent();const b=binding(),f=byId('airaV2Backup').files[0];
    if(!f)error('Bitte V2-Sicherungsdatei wählen.');
    if(!navigator.locks)error('Keine sichere Browsersperre verfügbar.');
    const candidate=parseAiraJson(await f.text());
    if(!dialog.open||id.value!==b.plan_id||repo.value!==b.repo)error('Bindung geändert.');
    // The server validates the raw saved predecessor and its hash before a
    // restored record is adopted; no automatic overwrite of local history.
    await request('/api/aira/v2/restore',{...b,record:candidate});
    await navigator.locks.request(storageKey(),async()=>{
      ensureCurrent();if(id.value!==b.plan_id||repo.value!==b.repo||localStorage.getItem(storageKey())!==null)error('Lokale Historie existiert oder Bindung geändert.');
      localStorage.setItem(storageKey(),JSON.stringify(candidate));
    });
    clearContext();status.textContent='Sicherung übernommen. Stand laden und fachlich prüfen.';
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
    showCoverage();invalidate();status.textContent='Unbestätigter Vorschlag. Bestehende IDs im Zuordnungsfeld explizit wählen, ggf. neu erzeugen, fachliche Daten/Referenzen und Tombstone-Gründe bearbeiten.';
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
    return {snapshot, payload:{...b,schema_version:2,revision:draft.requirements.revision,plan,requirements:draft.requirements,spec:current.spec,target_minutes:current.target_minutes,confirmed_points:read(points),confirmed_ids:confirmedIds,approved:false,changes_approved:false,
      ...(m?{migration:m}:{}),
      ...(record?{previous:{manifest_bytes:record.manifest_bytes,requirements_bytes:record.requirements_bytes},previous_manifest_sha256:record.manifest_sha256}:{previous_manifest_sha256:null})}};
  }
  previewButton.onclick=attempt(async()=>{
    invalidate();const state=input(),fingerprint=JSON.stringify(state.payload);
    const result=await (await request('/api/aira/preview',state.payload)).json();
    if(fingerprint!==JSON.stringify(input().payload))error('Eingaben geändert; erneut prüfen.');
    preview={fingerprint,result,snapshot:state.snapshot,raw:context.raw};
    review.textContent='Revision '+result.manifest.revision+' · '+(result.unchanged?'unveränderte Wiederholung':'neuer Export')+'\nSHA-256 SPEC: '+result.manifest.spec_sha256+'\nSHA-256 Manifest: '+result.manifest_sha256+'\nSHA-256 Requirements: '+result.manifest.requirements_sha256+'\n'+json(result.manifest)+'\n'+result.requirements_bytes+'\n'+Object.entries(result.drafts).map(([path,body])=>path+'\n'+body).join('\n\n');
    status.textContent='Exakte Projektion prüfen und fachlich freigeben.';download.disabled=true;
  });
  download.onclick=attempt(async()=>{
    const p=preview;download.disabled=true;
    if(!p||!approval.checked||!navigator.locks)error('Freigabe, Vorschau oder sichere Browsersperre fehlt.');
    await navigator.locks.request(storageKey(),async()=>{
      const still=()=>preview===p&&approval.checked&&p.fingerprint===JSON.stringify(input().payload)&&p.raw===local().raw;
      if(!still())error('Veraltete Freigabe.');
      const state=input();
      const response=await request('/api/aira/export',{...state.payload,approved:true,changes_approved:true,expected_manifest_sha256:p.result.manifest_sha256});
      const blob=await response.blob();
      if(!still())error('Eingaben geändert; kein Download.');
      if(!p.result.unchanged){
        const chosen=context.proposalMapping??read(mapping);
        const active=new Set([...state.snapshot.plan.tasks,...state.snapshot.requirements.requirements,...state.snapshot.requirements.criteria,...state.snapshot.requirements.tests,...state.snapshot.requirements.decisions].map(x=>x.id));
        const record={repo:repo.value,snapshot:state.snapshot,mapping:Object.fromEntries(Object.entries(chosen).filter(([,value])=>active.has(value))),manifest_bytes:p.result.manifest_bytes,requirements_bytes:p.result.requirements_bytes,manifest_sha256:p.result.manifest_sha256};
        localStorage.setItem(storageKey(),JSON.stringify(record));
      }
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='aira-v2-'+id.value+'-r'+p.result.manifest.revision+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      invalidate();context=null;status.textContent='V2-Paket exportiert und Identitätsstand gespeichert. Sicherung herunterladen; kein Jira-Write oder Agentenstart.';
    });
  });
  byId('airaV2SaveBackup').onclick=attempt(async()=>{
    ensureCurrent();const {raw}=local();if(!raw)error('Keine V2-Historie gespeichert.');
    const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');
    a.href=url;a.download='specit-v2-'+id.value+'-history.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
}

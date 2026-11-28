import {createOriginBackup,verifyOriginBackup,previewBrowserRestore,restoreBrowserBackup,maxOriginBackupBytes} from './origin-backup.mjs';
import {parseAiraJson} from './aira-identities.mjs';
const $=id=>document.getElementById(id);
const status=$('status'),previewText=$('preview-text'),original=$('original'),records=$('records');
let selected=null,serverPreview=null,browserPreview=null,busy=false;
const render=value=>JSON.stringify(value,null,2);
const fail=code=>{throw Error(code);};
function reset(){serverPreview=null;browserPreview=null;$('apply').disabled=true;$('browser-restore').disabled=true;$('keep').checked=false;previewText.textContent='';}
const save=(backup)=>{
  const blob=new Blob([render(backup)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='specit-origin-'+backup.sha256.slice(0,12)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
async function request(body){
  const r=await fetch('./api/origin-migration',{method:'POST',mode:'same-origin',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await r.json();if(!r.ok)fail(data.code??'SOURCE_UNAVAILABLE');return data;
}
function action(fn){return async()=>{if(busy)return;busy=true;$('file').disabled=true;try{await fn();}catch(e){reset();status.textContent='Nicht übernommen: '+(e.code??e.message);}finally{busy=false;$('file').disabled=false;}};}
function showPreview(p){previewText.textContent=render(p);status.textContent='Vorschau: noch keine Daten geändert.';}
$('file').onchange=action(async()=>{
  reset();selected=null;
  const f=$('file').files[0];if(!f)return;
  if(f.size>maxOriginBackupBytes*2)fail('INVALID_SCHEMA');
  selected=await verifyOriginBackup(parseAiraJson(await f.text()));status.textContent='Sicherung geprüft. Bitte Dry-run auswählen.';
});
$('export').onclick=action(async()=>{const backup=await createOriginBackup(localStorage,location.origin);save(backup);status.textContent='Originaldaten exportiert; Quelle unverändert.';});
$('preview').onclick=action(async()=>{reset();if(!selected)fail('Sicherung wählen');serverPreview=await request({action:'preview',operation:'import',backup:selected});showPreview(serverPreview);$('apply').disabled=!serverPreview.can_apply;});
$('browser-preview').onclick=action(async()=>{reset();if(!selected)fail('Sicherung wählen');browserPreview=await previewBrowserRestore(localStorage,selected);showPreview(browserPreview);$('browser-restore').disabled=!browserPreview.can_restore;});
$('apply').onclick=action(async()=>{
  if(!selected||!serverPreview||serverPreview.backup_id!==selected.sha256)fail('HISTORY_CONFLICT');
  if(!window.confirm('Originale separat archivieren? Projektmodus und Serverrevision bleiben unverändert.'))return;
  await request({action:'apply',operation:'import',backup:selected,preview_sha256:serverPreview.preview_sha256,confirmed:true,resolution:$('keep').checked?'keep_separate':'none'});
  reset();await list();status.textContent='Originale im Serverarchiv gesichert; kein Aira-Import.';
});
$('browser-restore').onclick=action(async()=>{
  if(!selected||!browserPreview)fail('HISTORY_CONFLICT');
  if(!window.confirm('Andere SpecIt-Tabs geschlossen? Nur fehlende Schlüssel wiederherstellen, nichts überschreiben?'))return;
  await restoreBrowserBackup(localStorage,selected,browserPreview,{confirmed:true,locks:navigator.locks});
  reset();status.textContent='Browserdaten wiederhergestellt. Kein automatischer Neustart, Moduswechsel oder Import.';
});
async function list(){
  const data=await request({action:'list'});records.replaceChildren();
  for(const record of data.records){
    const article=document.createElement('article'),pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';pre.textContent=render(record);article.append(pre);
    const btn=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=action(fn);article.append(b);};
    const read=async()=>{const {backup}=await request({action:'read',backup_id:record.backup_id});return verifyOriginBackup(backup);};
    btn('Original lesen',async()=>{const b=await read();original.textContent=b.entries.map(e=>e.key+'\n'+e.raw).join('\n\n');});
    btn('Original exportieren',async()=>save(await read()));
    btn('Für Browser-Restore wählen',async()=>{reset();selected=await read();browserPreview=await previewBrowserRestore(localStorage,selected);showPreview(browserPreview);$('browser-restore').disabled=!browserPreview.can_restore;});
    const op=record.state==='active'?'rollback':'restore';
    btn(op==='rollback'?'Archivübernahme rückgängig machen (Dry-run)':'Archivübernahme wiederherstellen (Dry-run)',async()=>{
      reset();const p=await request({action:'preview',operation:op,backup_id:record.backup_id});showPreview(p);
      const confirm=document.createElement('button');confirm.type='button';confirm.textContent='Vorschau ausdrücklich anwenden';article.append(confirm);
      confirm.onclick=action(async()=>{
        if(!window.confirm('Nur Archivstatus ändern, Originale und Projektbindung bleiben erhalten?'))return;
        await request({action:'apply',operation:op,backup_id:record.backup_id,preview_sha256:p.preview_sha256,confirmed:true,resolution:$('keep').checked?'keep_separate':'none'});
        reset();await list();status.textContent='Archivstatus geändert. Originale bleiben lesbar und exportierbar.';
      });
    });
    records.append(article);
  }
  if(!data.records.length)records.textContent='Noch keine Originale archiviert.';
}
$('list').onclick=action(list);

// The standalone server otherwise stops shortly after navigation away from app.mjs.
// Keep the migration page alive without reloading or starting a job.
const live=new EventSource('./api/alive');
window.addEventListener('pagehide',()=>live.close(),{once:true});

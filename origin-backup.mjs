// Lossless legacy-Origin backup. Only explicitly known project-data keys;
// preferences, cookies, capabilities and unrelated origin data are excluded.
// JSON.stringify preserves the raw JavaScript strings (including lone UTF-16
// surrogates); no parsing/re-serialization of a legacy record changes it.
const sha=/^[0-9a-f]{64}$/;
const keyPattern=/^specit-aira-v2:[A-Za-z0-9][A-Za-z0-9-]{0,23}$/;
export const maxOriginBackupBytes=16*1024*1024;
export const isOriginDataKey=k=>typeof k==='string'&&(['specit-v3','specit-aira-history-v1'].includes(k)||keyPattern.test(k));
const require=(ok,code='INVALID_SCHEMA')=>{if(!ok)throw Object.assign(Error(code),{code});};
const exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===k;
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const validOrigin=value=>{
  try{const u=new URL(value);return u.origin===value&&u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname);}
  catch{return false;}
};
export function originBackupPayload(value){
  require(exact(value,'entries,schema_version,source_origin')||exact(value,'entries,schema_version,sha256,source_origin'));
  require(value.schema_version===1,'VERSION_MISMATCH');
  require(typeof value.source_origin==='string'&&validOrigin(value.source_origin));
  require(Array.isArray(value.entries)&&value.entries.length>0&&value.entries.length<=1000);
  let last='';
  for(const entry of value.entries){
    require(exact(entry,'key,raw')&&isOriginDataKey(entry.key)&&typeof entry.raw==='string'&&cmp(entry.key,last)>0);
    last=entry.key;
  }
  const payload=JSON.stringify({schema_version:1,source_origin:value.source_origin,entries:value.entries.map(e=>({key:e.key,raw:e.raw}))});
  require(new TextEncoder().encode(payload).length<=maxOriginBackupBytes);
  return payload;
}
export function originBackupDigestShape(value){
  require(exact(value,'entries,schema_version,sha256,source_origin')&&typeof value.sha256==='string'&&sha.test(value.sha256));
  return originBackupPayload(value);
}
async function digest(value){
  const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function verifyOriginBackup(value){
  require(await digest(originBackupDigestShape(value))===value.sha256,'INVALID_HASH');
  return value;
}
function collect(storage){
  const keys=new Set();
  for(let i=0;i<storage.length;i++){const k=storage.key(i);if(isOriginDataKey(k))keys.add(k);}
  return [...keys].sort(cmp).map(key=>{
    const raw=storage.getItem(key);require(typeof raw==='string','HISTORY_CONFLICT');return {key,raw};
  });
}
export async function createOriginBackup(storage,source_origin){
  const entries=collect(storage),payload={schema_version:1,source_origin,entries};
  const raw=originBackupPayload(payload),sha256=await digest(raw);
  require(JSON.stringify(entries)===JSON.stringify(collect(storage)),'HISTORY_CONFLICT');
  return {...payload,sha256};
}
export async function previewBrowserRestore(storage,backup){
  await verifyOriginBackup(backup);
  const entries=backup.entries.map(({key,raw})=>{
    const current=storage.getItem(key);
    return {key,status:current===null?'missing':current===raw?'identical':'conflict'};
  });
  return {sha256:backup.sha256,entries,can_restore:entries.every(e=>e.status!=='conflict')};
}
// Explicit restore in a dedicated page, never by app startup. Existing values
// are never replaced or removed. For an occupied origin use a different browser
// profile or explicitly archive that origin first and choose an empty one.
export async function restoreBrowserBackup(storage,backup,preview,{confirmed=false,locks}={}){
  require(confirmed===true,'APPROVAL_REQUIRED');
  require(locks&&typeof locks.request==='function','CONTEXT_UNAVAILABLE');
  return locks.request('specit-origin-migration',async()=>{
    const fresh=await previewBrowserRestore(storage,backup);
    require(JSON.stringify(fresh)===JSON.stringify(preview)&&fresh.can_restore,'HISTORY_CONFLICT');
    const added=[];
    try{
      for(const {key,raw} of backup.entries){
        const current=storage.getItem(key);
        require(current===null||current===raw,'HISTORY_CONFLICT');
        if(current===null){storage.setItem(key,raw);added.push({key,raw});}
      }
      require(backup.entries.every(e=>storage.getItem(e.key)===e.raw),'HISTORY_CONFLICT');
    }catch(e){
      // Roll back only writes from this attempt; never remove existing or changed values.
      for(const {key,raw} of added.reverse())if(storage.getItem(key)===raw)storage.removeItem(key);
      throw e;
    }
    return {restored:added.length,identical:backup.entries.length-added.length};
  });
}

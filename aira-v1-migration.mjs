import {verifyAira,sha256} from './aira-export.mjs';
import {parseAiraJson} from './aira-identities.mjs';

const fail = () => {throw Object.assign(Error('Aira-Export: ungültiges V1-Originalpaket oder Migrationsnachweis.'),{code:'HISTORY_CONFLICT'});};
const decode = value => {
  if(typeof value!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) fail();
  const bytes=Buffer.from(value,'base64');
  if(bytes.toString('base64')!==value)fail();
  return bytes;
};
const strictText = bytes => new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);

// Verify the ORIGINAL extracted files (including SPEC, every draft and all
// artifacts) for each V1 revision. The original bytes are never normalized.
export function verifyV1Migration(migration, {plan_id,repo}) {
  try {
    if(!migration||!Array.isArray(migration.packages)||!migration.packages.length||migration.packages.length>100||
       typeof migration.target!=='string'||!migration.target.trim()||typeof migration.evidence_ref!=='string'||!migration.evidence_ref.trim())fail();
    const history=[],manifest_bytes=[],manifest_sha256=[];
    let total=0;
    for(const encoded of migration.packages){
      if(!encoded||Object.getPrototypeOf(encoded)!==Object.prototype||Object.keys(encoded).length>1000)fail();
      const files=Object.create(null);
      for(const [path,value] of Object.entries(encoded)){
        const bytes=decode(value);total+=bytes.length;
        if(total>10_000_000)fail();
        files[path]=bytes;
      }
      if(!Object.hasOwn(files,'manifest.json'))fail();
      const raw=strictText(files['manifest.json']),m=parseAiraJson(raw);
      if(m.schema_version!==1||m.plan_id!==plan_id||m.repo!==repo||m.revision!==history.length+1)fail();
      if(verifyAira(files,history)!==true)fail();
      history.push(m);manifest_bytes.push(raw);manifest_sha256.push(sha256(files['manifest.json']));
    }
    if(migration.manifest_bytes && JSON.stringify(migration.manifest_bytes)!==JSON.stringify(manifest_bytes))fail();
    if(migration.manifest_sha256 && JSON.stringify(migration.manifest_sha256)!==JSON.stringify(manifest_sha256))fail();
    return {...migration,repo,manifest_bytes,manifest_sha256};
  }catch{fail();}
}

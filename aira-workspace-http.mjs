import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync, lstatSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { parseAiraJson } from './aira-identities.mjs';
import { createWorkspacePackageService } from './aira-workspace-package.mjs';
import { workspaceStatic } from './public/aira-workspace-ui.mjs';

const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const hash=/^[0-9a-f]{64}$/;
const id=/^[A-Za-z0-9_-]{1,64}$/;
const valid=(re,v)=>typeof v==='string'&&re.test(v);
const exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===k;
const need=(v,code='INVALID_SCHEMA')=>{if(!v)throw Object.assign(Error(code),{code});};
const status={INVALID_SCHEMA:400,INVALID_HASH:400,INVALID_PATH:400,WRONG_TARGET:403,POLICY_DENIED:403,APPROVAL_REQUIRED:403,
  VERSION_MISMATCH:409,REPLAY:409,HISTORY_CONFLICT:409,EVIDENCE_MISMATCH:409,CONTENT_DRIFT:409,CONTEXT_UNAVAILABLE:503,SOURCE_UNAVAILABLE:503};
const json=(res,n,body)=>{res.writeHead(n,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
const route='/api/workspace/specit/v1/';
const ops=new Set(['capabilities','open_context','prepare_package']);
const digest=b=>createHash('sha256').update(b).digest('hex');

// Private process-to-process interface. Configuration is supplied only by a
// trusted launcher, never by a browser/DTO. Aira owns registry, browser session,
// CSRF, import, progress and approvals. A rotated/revoked scope is read anew.
export function readWorkspaceConfig(file,now=Date.now){
  try{
    need(lstatSync(file).isFile(),'CONTEXT_UNAVAILABLE');
    const raw=readFileSync(file);need(raw.length<=65536,'CONTEXT_UNAVAILABLE');
    const c=parseAiraJson(new TextDecoder('utf-8',{fatal:true}).decode(raw));
    need(exact(c,'adapter_version,binding_id,capability,draft_id,expires_at,instance_id,jira_project,mode,plan_id,project_id,repo,site,workspace_id'),'CONTEXT_UNAVAILABLE');
    need(c.adapter_version===1&&c.mode==='integrated','VERSION_MISMATCH');
    need([c.instance_id,c.workspace_id,c.binding_id].every(v=>valid(uuid,v))&&[c.draft_id,c.project_id,c.plan_id].every(v=>valid(id,v))&&
      valid(hash,c.capability)&&typeof c.repo==='string'&&/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(c.repo)&&
      typeof c.site==='string'&&c.site.length>0&&c.site.length<=240&&typeof c.jira_project==='string'&&c.jira_project.length>0&&c.jira_project.length<=64&&
      Number.isSafeInteger(c.expires_at)&&c.expires_at>now()&&c.expires_at<=now()+300000,'CONTEXT_UNAVAILABLE');
    return c;
  }catch(e){if(status[e.code])throw e;throw Object.assign(Error('CONTEXT_UNAVAILABLE'),{code:'CONTEXT_UNAVAILABLE'});}
}
const fingerprint=c=>digest(JSON.stringify(Object.keys(c).sort().map(k=>[k,c[k]])));
const publicContext=c=>({workspace_id:c.workspace_id,binding_id:c.binding_id,draft_id:c.draft_id});
const privateContext=c=>({...publicContext(c),project_id:c.project_id,repo:c.repo,plan_id:c.plan_id,site:c.site,jira_project:c.jira_project});

export function createWorkspaceHttp({store,configFile,stageDir,zipFiles,host,now=Date.now}){
  let session=null;
  const config=()=>readWorkspaceConfig(configFile,now);
  function checkScope(c){
    const p=store.get(c.project_id);
    need(p.mode==='aira'&&p.binding?.repo===c.repo&&p.binding?.plan_id===c.plan_id,'WRONG_TARGET');
    return p;
  }
  async function handle(req,res){
    try{
      const counts=new Map();
      for(let i=0;i<req.rawHeaders.length;i+=2){const key=req.rawHeaders[i].toLowerCase();counts.set(key,(counts.get(key)||0)+1);}
      for(const k of ['host','authorization','origin','cookie','content-type','content-length','transfer-encoding','x-csrf-token'])need((counts.get(k)||0)<=1);
      need(req.headers.host===host,'POLICY_DENIED');
      const staticResult=workspaceStatic(req.method,req.url);
      if(staticResult){res.writeHead(200,staticResult.headers);res.end(staticResult.body);return;}
      need(req.method==='POST'&&req.url.startsWith(route)&&ops.has(req.url.slice(route.length)),'INVALID_PATH');
      // Browser credentials are never accepted at the service boundary.
      need(!req.headers.origin&&!req.headers.cookie&&!req.headers['x-csrf-token']&&!req.headers['transfer-encoding'],'POLICY_DENIED');
      need(req.headers['content-type']==='application/json'&&/^[0-9]+$/.test(req.headers['content-length']||'')); 
      const length=Number(req.headers['content-length']);
      if(length>65536){json(res,413,{ok:false,code:'INVALID_SCHEMA',ref:'request'});return;}
      const c=config(),key=fingerprint(c),authorization=req.headers.authorization;
      need(typeof authorization==='string'&&/^Bearer [0-9a-f]{64}$/.test(authorization)&&timingSafeEqual(Buffer.from(authorization.slice(7),'hex'),Buffer.from(c.capability,'hex')),'POLICY_DENIED');
      const chunks=[];let bytes=0;
      for await(const chunk of req){bytes+=chunk.length;need(bytes<=length&&bytes<=65536);chunks.push(chunk);}
      need(bytes===length);
      let body;try{body=parseAiraJson(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(Buffer.concat(chunks)));}catch{need(false);}
      need(body&&typeof body==='object'&&!Array.isArray(body));
      need(body.schema_version===1,'VERSION_MISMATCH');need(valid(uuid,body.request_id));
      need(fingerprint(config())===key,'CONTEXT_UNAVAILABLE');
      checkScope(c);
      if(session?.key!==key)session={key,seen:new Set(),pinned:false,opened:false};
      const current=session;
      need(current.seen.size<4096&&!current.seen.has(body.request_id),'REPLAY');current.seen.add(body.request_id);
      const op=req.url.slice(route.length);
      const ok=data=>json(res,200,{ok:true,schema_version:1,request_id:body.request_id,data});
      if(op==='capabilities'){
        need(exact(body,'request_id,schema_version'));current.pinned=true;
        return ok({adapter_version:1,package_versions:[2],feedback_versions:[1],mode:'integrated',instance_id:c.instance_id});
      }
      need(current.pinned,'VERSION_MISMATCH');
      need(body.workspace_id===c.workspace_id,'WRONG_TARGET');
      if(op==='open_context'){
        need(exact(body,'binding_id,draft_id,request_id,schema_version,workspace_id'));
        need(body.binding_id===c.binding_id&&body.draft_id===c.draft_id,'WRONG_TARGET');
        current.opened=true;return ok({...publicContext(c),status:'ready'});
      }
      need(current.opened,'CONTEXT_UNAVAILABLE');
      const service=createWorkspacePackageService({store,capability:Buffer.from(c.capability,'hex'),expiresAt:c.expires_at,now,
        resolveContext:async w=>{const fresh=config();need(fingerprint(fresh)===key&&w===fresh.workspace_id,'CONTEXT_UNAVAILABLE');checkScope(fresh);return privateContext(fresh);},
        stage:({context,files,revision,manifest_sha256})=>{
          const fresh=config();need(fingerprint(fresh)===key,'CONTEXT_UNAVAILABLE');
          const p=checkScope(fresh);need(p.revision===revision&&p.manifest_sha256===manifest_sha256,'HISTORY_CONFLICT');
          mkdirSync(stageDir,{recursive:true,mode:0o700});need(lstatSync(stageDir).isDirectory(),'INVALID_PATH');
          const staging_id=randomUUID(),temp=join(stageDir,staging_id+'.tmp'),dest=join(stageDir,staging_id+'.json');
          const zip=zipFiles(files);
          try{
            writeFileSync(temp,JSON.stringify({schema_version:1,staging_id,context,revision,manifest_sha256,package_sha256:digest(zip),package_b64:zip.toString('base64')}),{flag:'wx',mode:0o600});
            need(fingerprint(config())===key,'CONTEXT_UNAVAILABLE');
            renameSync(temp,dest);
          }finally{rmSync(temp,{force:true});}
          return staging_id;
        }});
      const result=await service(body,Buffer.from(c.capability,'hex'));json(res,200,result);
    }catch(e){if(!res.headersSent){const code=Object.hasOwn(status,e.code)?e.code:'SOURCE_UNAVAILABLE';json(res,status[code],{ok:false,code,ref:'adapter'});}else res.destroy();}
  }
  return handle;
}

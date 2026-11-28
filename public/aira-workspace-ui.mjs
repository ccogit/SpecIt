// Host-bundled, first-party module. No browser storage, target selection or runner.
// The host supplies the confirmed context and the existing SpecIt domain actions.
export const workspaceViews = Object.freeze(['discovery', 'spec', 'review', 'plan']);
const namespace = '/workspace/specit/';
const labels = { discovery:'Discovery', spec:'Spezifikation', review:'Review', plan:'Plan' };
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const id = /^[A-Za-z0-9_-]{1,64}$/;
const hash = /^[0-9a-f]{64}$/;
const states = new Set('validated previewed approved applying committed uncertain partial superseded stale conflict rejected'.split(' '));
const exact = (x, keys) => x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).sort().join(',') === keys;
const require = (ok, code) => { if (!ok) throw Object.assign(new Error(code), { code }); };
const positive = x => Number.isSafeInteger(x) && x > 0;
const cursorValid = x => Number.isSafeInteger(x) && x >= 0;
const valid = (regex, value) => typeof value === 'string' && regex.test(value);

export const workspaceCss = `.specit-workspace{color-scheme:light dark;color:var(--specit-fg,CanvasText);background:var(--specit-bg,Canvas);font:inherit;padding:1rem}.specit-workspace nav{display:flex;flex-wrap:wrap;gap:1rem}.specit-workspace pre{white-space:pre-wrap;overflow-wrap:anywhere}.specit-workspace textarea{box-sizing:border-box;width:100%;min-height:12rem;font:inherit}.specit-workspace iframe{width:100%;min-height:18rem;border:1px solid currentColor}`;
export function workspaceStatic(method, target) {
  if (method !== 'GET') return null;
  const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"};
  if (target === namespace+'assets/view.css') return {headers:{...headers,'Content-Type':'text/css; charset=utf-8'},body:workspaceCss};
  const view = workspaceViews.find(v => target === namespace+v);
  if (!view) return null;
  const nav = workspaceViews.map(v=>`<a href="./${v}"${v===view?' aria-current="page"':''}>${labels[v]}</a>`).join('');
  return {headers:{...headers,'Content-Type':'text/html; charset=utf-8'},body:`<!doctype html><html lang="de"><meta charset="utf-8"><link rel="stylesheet" href="./assets/view.css"><title>SpecIt – ${labels[view]}</title><main class="specit-workspace" data-view="${view}"><nav>${nav}</nav><h1>${labels[view]}</h1><div data-content role="status">Workspace-Kontext wird vom Host bereitgestellt.</div></main></html>`};
}

// post is the host's scoped POST transport. The capability never enters this module.
// No automatic mutation or retry. Only the three SpecIt-side operations plus progress.
export function createWorkspaceClient({ post, context, instanceId, mode, requestId = () => crypto.randomUUID() }) {
  require(['fake','integrated'].includes(mode) && valid(uuid,instanceId), 'VERSION_MISMATCH');
  require(exact(context,'binding_id,draft_id,workspace_id') && valid(uuid,context.workspace_id) &&
    (context.binding_id === null || valid(uuid,context.binding_id)) &&
    (context.draft_id === null || valid(id,context.draft_id)) && (context.binding_id || context.draft_id), 'CONTEXT_UNAVAILABLE');
  const scope = Object.freeze({...context});
  let ready = false, epoch = 0;
  async function call(operation, fields, stream = false) {
    const request_id = requestId();
    require(valid(uuid,request_id),'INVALID_SCHEMA');
    const result = await post('../../api/workspace/specit/v1/'+operation, {schema_version:1,request_id,...fields}, {stream});
    if(stream) return result;
    require(exact(result,'data,ok,request_id,schema_version') && result.ok === true && result.request_id === request_id && result.schema_version === 1,'EVIDENCE_MISMATCH');
    return result.data;
  }
  return {
    async open() {
      ready=false; const ticket=++epoch;
      const cap=await call('capabilities',{});
      require(exact(cap,'adapter_version,feedback_versions,instance_id,mode,package_versions') && cap.adapter_version===1 &&
        JSON.stringify(cap.package_versions)==='[2]' && JSON.stringify(cap.feedback_versions)==='[1]' && cap.mode===mode && cap.instance_id===instanceId,'VERSION_MISMATCH');
      const c=await call('open_context',scope);
      require(exact(c,'binding_id,draft_id,status,workspace_id') && c.status==='ready' && Object.keys(scope).every(k=>c[k]===scope[k]) && ticket===epoch,'WRONG_TARGET');
      ready=true; return Object.freeze({...c});
    },
    close(){ready=false;epoch++;},
    async prepare({revision,manifest_sha256,confirmed}) {
      require(ready && scope.draft_id,'CONTEXT_UNAVAILABLE');
      require(confirmed===true,'APPROVAL_REQUIRED');
      require(positive(revision) && valid(hash,manifest_sha256),'INVALID_SCHEMA');
      const ticket=epoch;
      const data=await call('prepare_package',{workspace_id:scope.workspace_id,draft_id:scope.draft_id,revision,manifest_sha256});
      require(ready && ticket===epoch && exact(data,'manifest_sha256,revision,staging_id') && valid(uuid,data.staging_id) && data.revision===revision && data.manifest_sha256===manifest_sha256,'EVIDENCE_MISMATCH');
      return data;
    },
    async *progress(job_id,cursor=0) {
      require(ready && valid(uuid,job_id) && cursorValid(cursor),'CONTEXT_UNAVAILABLE');
      const ticket=epoch;
      const chunks=await call('progress',{workspace_id:scope.workspace_id,job_id,cursor},true);
      for await(const event of readWorkspaceProgress(chunks,job_id,cursor)){
        require(ready && ticket===epoch,'CONTEXT_UNAVAILABLE'); yield event;
      }
    }
  };
}

// POST response stream: preserve chunk boundaries, reject malformed/gapped frames.
export async function* readWorkspaceProgress(chunks, job_id, cursor=0) {
  const decoder=new TextDecoder('utf-8',{fatal:true}); let pending='',count=0,total=0;
  for await(const chunk of chunks){
    require(chunk instanceof Uint8Array,'EVIDENCE_MISMATCH'); total+=chunk.byteLength;
    require(total<=65536,'EVIDENCE_MISMATCH'); pending+=decoder.decode(chunk,{stream:true});
    let end;
    while((end=pending.indexOf('\n\n'))!==-1){
      const frame=pending.slice(0,end);pending=pending.slice(end+2);
      require(++count<=32 && /^event: progress\ndata: [^\n]+$/.test(frame),'EVIDENCE_MISMATCH');
      let event;try{event=JSON.parse(frame.slice('event: progress\ndata: '.length));}catch{require(false,'EVIDENCE_MISMATCH');}
      require(exact(event,'cursor,job_id,state') && positive(event.cursor) && event.cursor===cursor+1 && event.job_id===job_id && states.has(event.state),'EVIDENCE_MISMATCH');
      cursor=event.cursor;yield event;
    }
  }
  require(pending+decoder.decode()==='','EVIDENCE_MISMATCH');
}

// Called only by a trusted host after open_context. The existing SpecIt core
// supplies readDraft/saveDraft/renderBacklog/requirementCoverageReport. No new
// HTTP operation, browser selection, localStorage, or implicit approval here.
export function mountWorkspaceView(root,{view,context,domain,client}){
  require(workspaceViews.includes(view) && context?.status==='ready' && valid(id,context.draft_id),'CONTEXT_UNAVAILABLE');
  const doc=root.ownerDocument, el=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  let mounted=true; const target=root.querySelector('[data-content]')??root;
  const status=el('p'), content=el('div');target.replaceChildren(content,status);
  const guard=async fn=>{try{await fn();}catch{if(mounted)status.textContent='Workspace-Anfrage abgelehnt. Kontext erneut prüfen.';}};
  const load=()=>guard(async()=>{
    const draft=await domain.readDraft(context);
    require(mounted && draft?.draft_id===context.draft_id,'WRONG_TARGET');content.replaceChildren();
    if(view==='discovery'||view==='spec'){
      const field=view==='discovery'?'idea':'spec',editor=el('textarea');editor.value=draft[field]??'';editor.setAttribute('aria-label',labels[view]);
      const save=el('button','Entwurf speichern');save.type='button';
      save.onclick=()=>guard(async()=>{require(mounted,'CONTEXT_UNAVAILABLE');await domain.saveDraft(context,{field,value:editor.value,expected_generation:draft.generation});status.textContent='Entwurf gespeichert; keine Freigabe.';await load();});
      content.append(editor,save);
      if(view==='spec'&&draft.prototype_html){const frame=el('iframe');frame.setAttribute('sandbox','');frame.setAttribute('referrerpolicy','no-referrer');frame.title='Isolierte Prototyp-Vorschau';frame.srcdoc='<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:">'+draft.prototype_html;content.append(frame);}
    }else if(view==='review'){
      const report=domain.requirementCoverageReport(draft.requirements);content.append(el('pre',JSON.stringify(report,null,2)));
    }else{
      content.append(el('pre',domain.renderBacklog(draft.plan,draft.spec)));
      if(draft.approved_revision && draft.manifest_sha256){const prepare=el('button','Fachlich freigegebenes Paket bereitstellen');prepare.type='button';prepare.onclick=()=>guard(async()=>{require(mounted,'CONTEXT_UNAVAILABLE');prepare.disabled=true;try{await client.prepare({revision:draft.approved_revision,manifest_sha256:draft.manifest_sha256,confirmed:true});if(mounted)status.textContent='Paket bereitgestellt – Aira-Import benötigt separate Freigabe.';}finally{prepare.disabled=false;}});content.append(prepare);}
    }
  });
  void load();return ()=>{mounted=false;client.close();target.replaceChildren();};
}

// The Aira shell supplies the per-tab CSRF token from its authenticated session
// (not a private service capability). No cross-origin or redirect fallback.
export function createWorkspaceBrowserTransport({csrf, fetchImpl=globalThis.fetch, origin=globalThis.location?.origin, viewUrl=globalThis.location?.href}){
  require(typeof csrf==='string'&&csrf.length>0&&typeof origin==='string'&&typeof viewUrl==='string','CONTEXT_UNAVAILABLE');
  const base=new URL(viewUrl);
  require(base.origin===origin&&base.hostname==='127.0.0.1'&&base.protocol==='http:'&&workspaceViews.some(v=>base.pathname===namespace+v),'WRONG_TARGET');
  return async (path,body,{stream=false}={})=>{
    const url=new URL(path,base);
    require(url.origin===origin&&['capabilities','open_context','prepare_package','progress'].some(op=>url.pathname==='/api/workspace/specit/v1/'+op)&&!url.search&&!url.hash,'WRONG_TARGET');
    const raw=JSON.stringify(body);require(new TextEncoder().encode(raw).length<=65536,'INVALID_SCHEMA');
    const res=await fetchImpl(url,{method:'POST',mode:'same-origin',credentials:'same-origin',redirect:'error',cache:'no-store',
      headers:{'content-type':'application/json','x-csrf-token':csrf},body:raw});
    require(res.ok,'SOURCE_UNAVAILABLE');
    const type=(res.headers.get('content-type')||'').split(';')[0].trim();
    require(type===(stream?'text/event-stream':'application/json'),'EVIDENCE_MISMATCH');
    if(stream){require(res.body,'SOURCE_UNAVAILABLE');return res.body;}
    const reader=res.body?.getReader();require(reader,'SOURCE_UNAVAILABLE');
    const decoder=new TextDecoder('utf-8',{fatal:true});let rawResponse='',size=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;require(size<=65536,'EVIDENCE_MISMATCH');rawResponse+=decoder.decode(value,{stream:true});}rawResponse+=decoder.decode();}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    return JSON.parse(rawResponse);
  };
}

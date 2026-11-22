/** OpenAI-compatible streaming backend for local GPU inference and text diffusion. */
import { inferenceTimer } from './ai-performance.mjs';
import { splitChapters } from './blocks.mjs';
import { chapterGroups } from './spec-parallel.mjs';

/** Structural gate for experimental non-Claude output, not a semantic guarantee. */
export function validateExternalCore(content) {
 const sections=splitChapters(content),wanted=chapterGroups.flat();
 if(sections.intro.trim()||sections.chapters.length!==wanted.length
    ||sections.chapters.some((c,i)=>c.title!==wanted[i]||!c.body.trim()))
   throw Error('Der Inferenzdienst hat keine vollständige Kapitelstruktur geliefert.');
 const frBody=sections.chapters.find(c=>c.title==='Funktionale Anforderungen')?.body||'';
 if(!/\bFR-\d{3}\b/.test(frBody) || !/Abnahme|Akzeptanz/i.test(frBody))
   throw Error('Der Inferenzdienst hat keine prüfbaren funktionalen Anforderungen geliefert.');
 const ids=[...frBody.matchAll(/\bFR-\d{3}\b/g)].map(m=>m[0]);
 if(new Set(ids).size<1)throw Error('Die Anforderungskennungen fehlen.');
 return sections.chapters.map(c=>'## '+c.title+'\n\n'+c.body).join('\n\n')+'\n';
}

const modelId = v => typeof v === 'string' && /^[a-zA-Z0-9._:/-]{1,120}$/.test(v) ? v : '';

export function generationBackends(env = process.env) {
  let gpu = null;
  if (modelId(env.SPECIT_GPU_MODEL)) {
    try {
      const base = new URL(env.SPECIT_GPU_BASE_URL || 'http://127.0.0.1:8000/v1/');
      if (!['http:','https:'].includes(base.protocol)
        || !['127.0.0.1','localhost','[::1]'].includes(base.hostname)
        || !['/v1','/v1/'].includes(base.pathname)
        || base.username || base.password || base.search || base.hash)
        throw Error('GPU-Endpunkt muss ein lokaler OpenAI-kompatibler /v1-Server sein.');
      const endpoint = new URL(base.origin + '/v1/chat/completions');
      gpu = { transport:'gpu', endpoint:endpoint.href, model:env.SPECIT_GPU_MODEL, key:env.SPECIT_GPU_API_KEY || '' };
    } catch { /* invalid local endpoint is disabled, never silently redirected */ }
  }
  const provider=env.SPECIT_DIFFUSION_PROVIDER||'inception';
  const allowed=['inception','openrouter'].includes(provider);
  const key=provider==='openrouter'?env.SPECIT_OPENROUTER_API_KEY:env.SPECIT_INCEPTION_API_KEY;
  const selectedModel=provider==='openrouter'
    ?env.SPECIT_DIFFUSION_MODEL||'inception/mercury-3'
    :env.SPECIT_INCEPTION_MODEL||'mercury-3';
  const diffusion = allowed&&key&&modelId(selectedModel)
    ? {transport:'diffusion',endpoint:provider==='openrouter'
         ?'https://openrouter.ai/api/v1/chat/completions'
         :'https://api.inceptionlabs.ai/v1/chat/completions',
       model:selectedModel,key}
    : null;
  return {gpu,diffusion};
}

/** Consumes OpenAI Chat Completions SSE events. Skips reasoning-only deltas. */
export async function streamChatCompletion({ backend, system, instruction, data, maxTokens = 16000,
  onText = () => {}, signal, store, request = fetch }) {
  if (!backend || !['gpu','diffusion'].includes(backend.transport)) throw Error('Kein Inferenz-Backend konfiguriert.');
  const timer = inferenceTimer(store,{model:backend.model,transport:backend.transport,streaming:true});
  let ok = false, output = '', buffer = '', stop = '', ended = false;
  try {
    const body = { model:backend.model,max_tokens:maxTokens,stream:true,
      stream_options:{include_usage:true},
      messages:[{role:'system',content:system},
        {role:'user',content:instruction+'\n\nProjektdaten (JSON):\n'+JSON.stringify(data)}] };
    const response = await request(backend.endpoint,{
      method:'POST',redirect:'error',
      headers:{'content-type':'application/json',accept:'text/event-stream',
        ...(backend.key?{authorization:'Bearer '+backend.key}:{})},
      body:JSON.stringify(body),
      signal:signal?AbortSignal.any([signal,AbortSignal.timeout(360000)]):AbortSignal.timeout(360000)
    });
    if (!response.ok) throw Error('Inferenzdienst: HTTP ' + response.status + ' – Modell und Kontingent prüfen.');
    if (!response.body) throw Error('Inferenzdienst hat keinen Antwortstrom geliefert.');
    const decoder = new TextDecoder();
    const handle = line => {
      if (!line.startsWith('data:')) return;
      const chunk=line.slice(5).trim();
      if (chunk==='[DONE]'){ended=true;return}
      let event;try{event=JSON.parse(chunk)}catch{throw Error('Ungültiges Streaming-Ereignis vom Inferenzdienst.')}
      if(event.error)throw Error('Inferenzdienst meldet einen Fehler.');
      if(event.usage) timer.tokens({
        input_tokens:event.usage.prompt_tokens,output_tokens:event.usage.completion_tokens
      });
      const choice=event.choices?.[0];
      const value=choice?.delta?.content;
      const text=typeof value==='string'?value:Array.isArray(value)?value.filter(v=>v?.type==='text').map(v=>v.text||'').join(''):'';
      if(text){timer.firstToken();output+=text;onText(text)}
      if(choice?.finish_reason)stop=choice.finish_reason;
    };
    for await (const chunk of response.body) {
      buffer+=decoder.decode(chunk,{stream:true}).replace(/\r/g,'');
      let i;
      while ((i=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,i);buffer=buffer.slice(i+1);
        handle(line);
      }
      if(ended)break;
    }
    if (buffer.trim()) handle(buffer.trim());
    if (!output.trim() || stop==='length' || (!ended && !['stop','eos'].includes(stop))) throw Error('Inferenzdienst: unvollständige oder leere Modellausgabe.');
    ok=true;return output;
  } finally {timer.finish(ok)}
}

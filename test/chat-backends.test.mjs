import test from 'node:test';
import assert from 'node:assert/strict';
import { generationBackends, streamChatCompletion, validateExternalCore } from '../chat-backends.mjs';
import { chapterGroups } from '../spec-parallel.mjs';

test('GPU inference accepts only local loopback /v1 and explicit model IDs',()=>{
 const env={SPECIT_GPU_MODEL:'Qwen/Qwen3-8B',SPECIT_GPU_BASE_URL:'http://127.0.0.1:8000/v1'};
 assert.equal(generationBackends(env).gpu?.endpoint,'http://127.0.0.1:8000/v1/chat/completions');
 assert.equal(generationBackends({...env,SPECIT_GPU_BASE_URL:'http://192.168.1.22:8000/v1'}).gpu,null);
 assert.equal(generationBackends({...env,SPECIT_GPU_BASE_URL:'https://api.evil.test/v1'}).gpu,null);
 assert.equal(generationBackends({...env,SPECIT_GPU_BASE_URL:'http://localhost:8000/private'}).gpu,null);
 assert.equal(generationBackends({}).gpu,null);
});
test('diffusion uses only fixed Inception endpoint and requires server key',()=>{
 assert.equal(generationBackends({}).diffusion,null);
 const backend=generationBackends({SPECIT_INCEPTION_API_KEY:'secret'}).diffusion;
 assert.equal(backend.endpoint,'https://api.inceptionlabs.ai/v1/chat/completions');
 assert.equal(backend.model,'mercury-3');
 const router=generationBackends({SPECIT_DIFFUSION_PROVIDER:'openrouter',SPECIT_OPENROUTER_API_KEY:'another-secret'}).diffusion;
 assert.equal(router.endpoint,'https://openrouter.ai/api/v1/chat/completions');
 assert.equal(router.model,'inception/mercury-3');
 assert.equal(generationBackends({SPECIT_DIFFUSION_PROVIDER:'unknown',SPECIT_INCEPTION_API_KEY:'secret'}).diffusion,null);
});
test('SSE chunks stream in order, count real tokens, and preserve server-side auth',async()=>{
 const backend=generationBackends({SPECIT_INCEPTION_API_KEY:'secret'}).diffusion;
 const sse=['data: {"choices":[{"delta":{"content":"## Ziel"}}]}\n\n',
  'data: {"choices":[{"delta":{"content":" und Nutzer"},"finish_reason":"stop"}]}\n\n',
  'data: {"choices":[],"usage":{"prompt_tokens":42,"completion_tokens":8}}\n\n',
  'data: [DONE]\n\n'].join('');
 const pieces=[sse.slice(0,30),sse.slice(30,60),sse.slice(60)];
 const seen=[],store={timings:[]};
 const request=async (url,init)=>{
  assert.equal(url,backend.endpoint);
  assert.equal(init.headers.authorization,'Bearer secret');
  assert.equal(JSON.parse(init.body).messages[1].content.includes('Projektdaten (JSON)'),true);
  return new Response(new ReadableStream({start(controller){for(const part of pieces)controller.enqueue(new TextEncoder().encode(part));controller.close()}}),{status:200});
 };
 const result=await streamChatCompletion({backend,system:'X',instruction:'Y',data:{idea:'app'},request,store,onText:t=>seen.push(t)});
 assert.equal(result,'## Ziel und Nutzer');
 assert.deepEqual(seen,['## Ziel',' und Nutzer']);
 assert.equal(store.timings.length,1);
 assert.equal(store.timings[0].output_tokens,8);
 assert.equal(store.timings[0].ok,true);
});
test('truncated, HTTP-error and empty output fail closed',async()=>{
 const backend=generationBackends({SPECIT_INCEPTION_API_KEY:'secret'}).diffusion;
 const bad=async()=>new Response('bad',{status:401});
 await assert.rejects(streamChatCompletion({backend,system:'',instruction:'',data:{},request:bad}),/HTTP 401/);
 const truncated=async()=>new Response('data: {"choices":[{"delta":{"content":"partial"},"finish_reason":"length"}]}\n\n');
 await assert.rejects(streamChatCompletion({backend,system:'',instruction:'',data:{},request:truncated}),/unvollständige/);
});

test('experimental provider output passes only with eight complete chapters and functional acceptance',()=>{
 const expected=chapterGroups.flat();
 const sections=expected.map(title=>'## '+title+'\n\n'+(title==='Funktionale Anforderungen'?'FR-001: Eingabe prüfen. Abnahme: ungültige Eingabe wird abgelehnt.':'Erforderlicher Inhalt.'));
 assert.equal((validateExternalCore(sections.join('\n\n'),[{name:'Eingabe'}]).match(/## /g)||[]).length,8);
 assert.throws(()=>validateExternalCore(sections.join('\n\n'),[{name:'Export'}]),/Feature nicht spezifiziert/);
 assert.throws(()=>validateExternalCore(sections.slice(1).join('\n\n')),/Kapitelstruktur/);
 const missing=sections.map(x=>x.replace('FR-001: Eingabe prüfen. Abnahme:','Keine Funktion.')).join('\n\n');
 assert.throws(()=>validateExternalCore(missing),/funktionalen Anforderungen/);
});

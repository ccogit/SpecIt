import test from 'node:test';
import assert from 'node:assert/strict';
import { splitReusableSkills, anthropicMessageBody, enabledPromptCache, promptCacheTtl } from '../anthropic-cache.mjs';
const instruction='Erstelle ein Dokument.\n\nVerbindliche Skill-Richtlinien für diese Phase.\nBehalte alle FR-Kriterien bei.';
const args={model:'m',maxTokens:500,system:'Du bist ein Assistent.',instruction,data:{idea:'abc',answers:[]}};

test('default is byte-compatible with the original text input and system string',()=>{
 const b=anthropicMessageBody(args);
 assert.equal(b.system,args.system);
 assert.equal(b.messages[0].content,instruction+'\n\nProjektdaten (JSON):\n'+JSON.stringify(args.data));
 assert.equal(b.stream,undefined);
});
test('caching moves stable skill content into a reusable system block',()=>{
 const b=anthropicMessageBody({...args,cache:true,stream:true,ttl:'1h'});
 assert.equal(b.stream,true);assert.equal(b.system.length,2);
 assert.equal(b.system[0].text,args.system);
 assert.deepEqual(b.system[1].cache_control,{type:'ephemeral',ttl:'1h'});
 assert.equal(b.system[1].text,'Verbindliche Skill-Richtlinien für diese Phase.\nBehalte alle FR-Kriterien bei.');
 assert.ok(!b.messages[0].content.includes('Behalte alle FR-Kriterien'));
 assert.ok(b.messages[0].content.includes('Erstelle ein Dokument.'));
});
test('without skills never writes cache markers to tiny generic system prompt',()=>{
 const b=anthropicMessageBody({...args,instruction:'hello',cache:true});
 assert.equal(b.system,args.system);
 assert.equal(splitReusableSkills('hello').skills,'');
});
test('cache is explicitly opt-in and TTL accepts only a bounded value',()=>{
 assert.equal(enabledPromptCache({}),false);
 assert.equal(enabledPromptCache({SPECIT_PROMPT_CACHE:'1'}),true);
 assert.equal(promptCacheTtl({SPECIT_PROMPT_CACHE_TTL:'bad'}),'5m');
 assert.equal(promptCacheTtl({SPECIT_PROMPT_CACHE_TTL:'1h'}),'1h');
});

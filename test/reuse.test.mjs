import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQueries, normalizeRepo, searchRepositories, validateReuseAnalysis, cleanSelections } from '../reuse.mjs';

const upstream={html_url:'https://github.com/sample/tool',full_name:'sample/tool',description:'Reusable engine',license:{spdx_id:'MIT'},stargazers_count:42,pushed_at:'2026-08-21T00:00:00Z',language:'TypeScript',topics:['workflow'],archived:false,fork:false};
test('search terms sanitized and bounded',()=>{
 assert.deepEqual(parseQueries({queries:['workflow engine','workflow engine','calendar library']}),['workflow engine','calendar library']);
 assert.equal(parseQueries({queries:['a','b']}).length,0);
});
test('only real GitHub repository records are accepted',()=>{
 assert.equal(normalizeRepo({...upstream,archived:true}),null);
 assert.equal(normalizeRepo({...upstream,html_url:'https://example.com/tool'}),null);
 assert.equal(normalizeRepo(upstream).license,'MIT');
});
test('repository search deduplicates evidence and reports partial failure',async()=>{
 const fake=async url=>url.includes('calendar')?{ok:false,status:403}:{ok:true,json:async()=>({items:[upstream,upstream]})};
 const result=await searchRepositories(['workflow','calendar'],fake);
 assert.equal(result.candidates.length,1);
 assert.equal(result.failures.length,1);
});
test('AI cannot invent project URLs and missing licenses require review',()=>{
 const candidates=[normalizeRepo(upstream),normalizeRepo({...upstream,full_name:'sample/unknown',html_url:'https://github.com/sample/unknown',license:null})];
 const a=validateReuseAnalysis({projects:[
  {url:'https://github.com/sample/tool',decision:'einbeziehen',functions:['FR-001'],reason:'fits'},
  {url:'https://github.com/sample/unknown',decision:'einbeziehen',functions:['FR-002']},
  {url:'https://github.com/fake/not-found',decision:'einbeziehen',functions:['FR-003']}
 ]},candidates);
 assert.equal(a.length,2);assert.equal(a[0].decision,'einbeziehen');assert.equal(a[1].decision,'prüfen');assert.equal(a[0].included,false);
});
test('only safe URL records pass user selections',()=>{
 const v=cleanSelections([{url:'https://github.com/sample/tool',functions:['FR-001'],license:'MIT'},{url:'https://not-github.test/x',functions:['bad']}]);
 assert.equal(v.length,1);assert.deepEqual(v[0].functions,['FR-001']);
});

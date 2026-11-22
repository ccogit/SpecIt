import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStrategy, strategyIds } from '../spec-strategies.mjs';

test('four explicit strategies and existing default are distinct', () => {
  assert.deepEqual(strategyIds, ['classic','incremental','preload','parallel','turbo','gpu','diffusion']);
  assert.deepEqual(resolveStrategy(undefined), { id:'incremental',full:false,parallel:false,label:'Intelligent' });
  assert.deepEqual(resolveStrategy('classic'), { id:'classic',full:true,parallel:false,label:'Klassisch' });
  assert.deepEqual(resolveStrategy('preload',{hasApi:true}), { id:'preload',full:true,parallel:false,label:'Vorbereitet' });
  assert.deepEqual(resolveStrategy('parallel',{hasApi:true}), { id:'parallel',full:true,parallel:true,label:'Parallel' });
  assert.deepEqual(resolveStrategy('turbo',{hasApi:true}), { id:'turbo',full:true,parallel:true,label:'Turbo' });
  assert.deepEqual(resolveStrategy('gpu',{hasGpu:true}), {id:'gpu',full:true,parallel:false,label:'GPU lokal'});
  assert.deepEqual(resolveStrategy('diffusion',{hasDiffusion:true}), {id:'diffusion',full:true,parallel:false,label:'Diffusion'});
});

test('old environment switch only applies to unspecified requests, not explicit choices', () => {
  assert.equal(resolveStrategy(undefined,{hasApi:true,legacyParallel:true}).id,'parallel');
  assert.equal(resolveStrategy('classic',{hasApi:true,legacyParallel:true}).parallel,false);
  assert.equal(resolveStrategy('incremental',{hasApi:true,legacyParallel:true}).parallel,false);
});

test('parallel modes require API and untrusted input cannot select hidden modes', () => {
  assert.throws(()=>resolveStrategy('preload'),/API-Schlüssel/);
  assert.throws(()=>resolveStrategy('parallel'),/API-Schlüssel/);
  assert.throws(()=>resolveStrategy('turbo'),/API-Schlüssel/);
  assert.throws(()=>resolveStrategy('gpu'),/GPU/);
  assert.throws(()=>resolveStrategy('diffusion'),/Diffusion/);
  assert.throws(()=>resolveStrategy('unknown',{hasApi:true}),/Unbekannte/);
  assert.throws(()=>resolveStrategy({}, {hasApi:true}),/Unbekannte/);
});

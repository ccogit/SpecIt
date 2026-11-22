import test from 'node:test';
import assert from 'node:assert/strict';
import { aiProfile, inferenceTimer } from '../ai-performance.mjs';

test('legacy defaults remain intact until fast mode is explicitly enabled', () => {
  assert.deepEqual(aiProfile('final', {}, 'claude-sonnet-4-6'), { model: 'claude-sonnet-4-6' });
  assert.deepEqual(aiProfile('final', { SPECIT_FAST_MODE: '1' }), { model: 'claude-haiku-5-5', effort: 'low' });
  assert.deepEqual(aiProfile('features', { SPECIT_FAST_MODE: '1' }), { model: 'claude-haiku-5-5', effort: 'low' });
  assert.deepEqual(aiProfile('plan', { SPECIT_FAST_MODE: '1' }), { model: 'claude-sonnet-4-6' });
});

test('stage overrides outrank fast mode and reject invalid values', () => {
  const e = { SPECIT_FAST_MODE: '1', SPECIT_FINAL_MODEL: 'claude-sonnet-5-5', SPECIT_FINAL_EFFORT: 'medium' };
  assert.deepEqual(aiProfile('final', e), { model: 'claude-sonnet-5-5', effort: 'medium' });
  assert.deepEqual(aiProfile('final', { SPECIT_FINAL_MODEL: 'invalid model', SPECIT_FINAL_EFFORT: 'unknown' }), { model: 'claude-sonnet-4-6' });
  assert.deepEqual(aiProfile('concept', { SPECIT_CONCEPT_MODEL: 'claude-haiku-5-5', SPECIT_AI_EFFORT: 'low' }), { model: 'claude-haiku-5-5', effort: 'low' });
});

test('timing records latency and optional token counts once, no text data', () => {
  let t = 100; const store = { timings: [] };
  const m = inferenceTimer(store, { model: 'm', transport: 'api', streaming: true }, () => t);
  t = 132; m.firstToken(); t = 145; m.firstToken();
  m.tokens({ input_tokens: 120, output_tokens: 1 }); m.tokens({ output_tokens: 45, cache_read_input_tokens: 55 });
  t = 250; m.finish(true); m.finish(false);
  assert.deepEqual(store.timings, [{ model: 'm', transport: 'api', streaming: true, ok: true, totalMs: 150, input_tokens: 120, output_tokens: 45, cache_read_input_tokens: 55, firstTokenMs: 32 }]);
});

test('explicit strategy controls the model regardless of global fast mode', () => {
  const fastEnv = { SPECIT_FAST_MODE: '1', SPECIT_FINAL_MODEL: 'claude-haiku-5-5', SPECIT_FINAL_EFFORT: 'high' };
  assert.deepEqual(aiProfile('final', fastEnv, 'claude-sonnet-4-6', 'classic'), { model: 'claude-sonnet-4-6' });
  assert.deepEqual(aiProfile('final', fastEnv, 'claude-sonnet-4-6', 'turbo'), { model: 'claude-haiku-5-5', effort: 'low' });
  assert.deepEqual(aiProfile('final', { SPECIT_FAST_MODE: '1' }, 'claude-sonnet-4-6', 'parallel'), { model: 'claude-sonnet-4-6' });
});

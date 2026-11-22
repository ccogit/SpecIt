/** Small, dependency-free AI routing and latency metrics for SpecIt. */
const effortLevels = new Set(['low', 'medium', 'high']);
const modelId = value => /^[a-zA-Z][a-zA-Z0-9._-]{2,80}$/.test(value || '') ? value : '';

/** Preserve existing defaults unless fast mode or a per-stage override is explicitly enabled. */
export function aiProfile(mode, env = process.env, fallbackModel = 'claude-sonnet-4-6') {
  const key = ({ final: 'FINAL', features: 'FEATURE', concept: 'CONCEPT', questions: 'QUESTIONS', review: 'REVIEW' })[mode] || '';
  const fast = env.SPECIT_FAST_MODE === '1' && ['final', 'features'].includes(mode);
  const configured = key && modelId(env[`SPECIT_${key}_MODEL`]);
  const model = configured || (fast ? 'claude-haiku-5-5' : modelId(fallbackModel) || 'claude-sonnet-4-6');
  const chosenEffort = (key && env[`SPECIT_${key}_EFFORT`]) || env.SPECIT_AI_EFFORT || (fast ? 'low' : '');
  return { model, ...(effortLevels.has(chosenEffort) ? { effort: chosenEffort } : {}) };
}

/** Never collect the prompt or generated contents in diagnostics. */
export function inferenceTimer(store, { model, transport, streaming = false }, clock = () => performance.now()) {
  const started = clock();
  let firstMs = null, finished = false, tokens = {};
  return {
    firstToken() { if (firstMs === null) firstMs = Math.max(0, Math.round(clock() - started)); },
    tokens(value) {
      for (const field of ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens']) {
        if (Number.isFinite(value?.[field])) tokens[field] = value[field];
      }
    },
    finish(ok) {
      if (finished) return;
      finished = true;
      const metric = { model, transport, streaming, ok: !!ok, totalMs: Math.max(0, Math.round(clock() - started)), ...tokens };
      if (firstMs !== null) metric.firstTokenMs = firstMs;
      if (store && Array.isArray(store.timings)) store.timings.push(metric);
    },
  };
}

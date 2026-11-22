/** Per-request generation strategies, separate from model/vendor configuration. */
const descriptors = {
  classic: { full: true, parallel: false, label: 'Klassisch' },
  incremental: { full: false, parallel: false, label: 'Intelligent' },
  parallel: { full: true, parallel: true, label: 'Parallel' },
  turbo: { full: true, parallel: true, label: 'Turbo' },
};
export const strategyIds = Object.freeze(Object.keys(descriptors));

/** Reject unknown explicit strategies. Old clients without a strategy retain the prior setting. */
export function resolveStrategy(raw, { hasApi = false, legacyParallel = false } = {}) {
  const id = raw == null || raw === '' ? (legacyParallel ? 'parallel' : 'incremental') : raw;
  if (!Object.hasOwn(descriptors, id)) throw Error('Unbekannte Generierungsstrategie.');
  if (descriptors[id].parallel && !hasApi) throw Error('Die Strategie ' + descriptors[id].label + ' erfordert einen Anthropic-API-Schlüssel.');
  return { id, ...descriptors[id] };
}

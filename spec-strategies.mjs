/** Per-request generation strategies, separate from model/vendor configuration. */
const descriptors = {
  classic: { full: true, parallel: false, label: 'Klassisch' },
  incremental: { full: false, parallel: false, label: 'Intelligent' },
  preload: { full: true, parallel: false, label: 'Vorbereitet' },
  structured: { full: true, parallel: false, label: 'Strukturiert' },
  parallel: { full: true, parallel: true, label: 'Parallel' },
  turbo: { full: true, parallel: true, label: 'Turbo' },
  gpu: { full: true, parallel: false, label: 'GPU lokal' },
};
export const strategyIds = Object.freeze(Object.keys(descriptors));

/** hasApi = Claude ist erreichbar – über einen API-Schlüssel oder über das lokal angemeldete Claude Code. */
/** Reject unknown explicit strategies. Old clients without a strategy retain the prior setting. */
export function resolveStrategy(raw, { hasApi = false, hasGpu = false, legacyParallel = false } = {}) {
  const id = raw == null || raw === '' ? (legacyParallel ? 'parallel' : 'incremental') : raw;
  if (!Object.hasOwn(descriptors, id)) throw Error('Unbekannte Generierungsstrategie.');
  if ((descriptors[id].parallel || id === 'preload') && !hasApi) throw Error('Die Strategie ' + descriptors[id].label + ' erfordert Claude: einen Anthropic-API-Schlüssel oder ein angemeldetes Claude Code.');
  if (id==='gpu' && !hasGpu) throw Error('Lokaler GPU-Inferenzserver ist nicht konfiguriert.');
  return { id, ...descriptors[id] };
}

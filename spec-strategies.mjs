/** Per-request generation strategies, separate from model/vendor configuration. */
const descriptors = {
  classic: { full: true, parallel: false, label: 'Klassisch' },
  incremental: { full: false, parallel: false, label: 'Intelligent' },
  preload: { full: true, parallel: false, label: 'Vorbereitet' },
  structured: { full: true, parallel: false, label: 'Strukturiert' },
  parallel: { full: true, parallel: true, label: 'Parallel' },
  turbo: { full: true, parallel: true, label: 'Turbo' },
  gpu: { full: true, parallel: false, label: 'GPU lokal' },
  diffusion: { full: true, parallel: false, label: 'Diffusion' },
};
export const strategyIds = Object.freeze(Object.keys(descriptors));

/** Reject unknown explicit strategies. Old clients without a strategy retain the prior setting. */
export function resolveStrategy(raw, { hasApi = false, hasGpu = false, hasDiffusion = false, legacyParallel = false } = {}) {
  const id = raw == null || raw === '' ? (legacyParallel ? 'parallel' : 'incremental') : raw;
  if (!Object.hasOwn(descriptors, id)) throw Error('Unbekannte Generierungsstrategie.');
  if ((descriptors[id].parallel || id === 'preload') && !hasApi) throw Error('Die Strategie ' + descriptors[id].label + ' erfordert einen Anthropic-API-Schlüssel.');
  if (id==='gpu' && !hasGpu) throw Error('Lokaler GPU-Inferenzserver ist nicht konfiguriert.');
  if (id==='diffusion' && !hasDiffusion) throw Error('Diffusion-Anbieter ist nicht konfiguriert.');
  return { id, ...descriptors[id] };
}

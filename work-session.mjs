// Eine Browser-Arbeitssitzung: gemeinsam abbrechen und verspätete Antworten verwerfen.
// Unabhängige Vorgänge dürfen parallel laufen, gehören aber immer zur selben Sitzung.
export function createWorkSession() {
  let generation = 0;
  let controller = new AbortController();
  return {
    get generation() { return generation; },
    get signal() { return controller.signal; },
    isCurrent(stamp) { return stamp === generation && !controller.signal.aborted; },
    combine(signal) {
      return signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;
    },
    invalidate() {
      controller.abort();
      generation++;
      controller = new AbortController();
      return generation;
    },
  };
}

// Ein Retry muss beim Zurücksetzen unmittelbar enden, nicht erst nach seiner Wartefrist.
export function abortableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    const error = () => Object.assign(new Error('Abgebrochen.'), { name: 'AbortError' });
    if (signal?.aborted) return reject(error());
    let timer;
    const stop = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => { stop(); reject(error()); };
    timer = setTimeout(() => { stop(); resolve(); }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

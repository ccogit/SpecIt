// Speculative generation results are private to a random browser-session token.
// Each result is additionally bound to the validated, complete request payload.
import { createHash } from 'node:crypto';

const validSession = session => typeof session === 'string' && /^[a-f0-9-]{32,64}$/i.test(session);
export function preloadFingerprint(data) {
  const { preloadToken, ...payload } = data || {};
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export class SpecPreloadCache {
  constructor({ ttlMs = 180000, limit = 2, now = Date.now } = {}) {
    this.ttlMs = ttlMs;
    this.limit = limit;
    this.now = now;
    this.entries = new Map();
  }
  key(session, payload) {
    if (!validSession(session)) throw Error('Ungültige Preload-Sitzung.');
    return session + ':' + preloadFingerprint(payload);
  }
  cleanup() {
    for (const [key, item] of this.entries)
      if (item.expires <= this.now()) { item.controller.abort(); this.entries.delete(key); }
  }
  start(session, payload, run, signal) {
    const key = this.key(session, payload);
    this.cleanup();
    const old = this.entries.get(key);
    if (old) return old.promise;
    // One speculative request at a time, bounded cache; foreground calls are never throttled.
    for (const [existingKey, item] of this.entries) {
      if (!item.ready) { item.controller.abort(); this.entries.delete(existingKey); }
    }
    const controller = new AbortController();
    if (signal?.aborted) controller.abort();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const entry = { controller, expires: this.now() + this.ttlMs, ready: false, result: null, promise: null };
    this.entries.set(key, entry);
    entry.promise = Promise.resolve().then(async () => {
      if (controller.signal.aborted) throw Error('Vorbereitung abgebrochen.');
      const result = await run(controller.signal);
      if (controller.signal.aborted) throw Error('Vorbereitung abgebrochen.');
      if (typeof result !== 'string' || !result.trim()) throw Error('Unvollständiges Preload-Ergebnis.');
      entry.result = result;
      entry.ready = true;
      entry.expires = this.now() + this.ttlMs;
      return result;
    }).catch(e => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
      throw e;
    }).finally(() => signal?.removeEventListener('abort', abort));
    while (this.entries.size > this.limit) {
      const [firstKey, first] = this.entries.entries().next().value;
      if (firstKey !== key) { first.controller.abort(); this.entries.delete(firstKey); }
      else break;
    }
    return entry.promise;
  }
  async take(session, payload) {
    const key = this.key(session, payload);
    this.cleanup();
    const item = this.entries.get(key);
    if (!item) return null;
    try {
      const result = await item.promise;
      return this.entries.get(key) === item && item.expires > this.now() ? result : null;
    } catch { return null; }
  }
  abortPending() {
    for (const [key, item] of this.entries) {
      if (!item.ready) { item.controller.abort(); this.entries.delete(key); }
    }
  }
}

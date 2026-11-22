/** Live benchmark. Requires a running SpecIt server and configured Claude access. */
import { setTimeout as pause } from 'node:timers/promises';
import { specFrame, coreChapters } from '../blocks.mjs';
import { chapterGroups } from '../spec-parallel.mjs';

const base = process.env.SPECIT_BENCH_URL || 'http://127.0.0.1:3000';
const repeats = Number(process.argv[2] || 2);
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 10) throw Error('Aufrufe pro Fall: 1 bis 10.');
const cases = [
  { name: 'Notizen', idea: 'Eine lokale Notizen-App mit Listen, Bearbeiten und Suche.', features: [{ name: 'Notizen', note: 'anlegen, bearbeiten, löschen', core: true }, { name: 'Suche', note: 'nach Text', core: false }] },
  { name: 'Teamaufgaben', idea: 'Ein Team plant Aufgaben mit Fälligkeiten, Rollen und Status; Änderungen bleiben nach Neustarts erhalten.', features: [{ name: 'Aufgabenverwaltung', note: 'Anlegen, Bearbeiten, Zuweisen, Abschließen', core: true }, { name: 'Rollen', note: 'Mitglied und Administrator', core: true }, { name: 'Filter', note: 'nach Status und Termin', core: false }] },
  { name: 'Raumbuchung', idea: 'Eine Webanwendung zur Buchung von Besprechungsräumen inklusive Kalender, Genehmigung und Vermeidung von Doppelbuchungen.', features: [{ name: 'Raumbuchung', note: 'Kalender, Verfügbarkeit, Reservierung', core: true }, { name: 'Genehmigung', note: 'durch Raumverwalter', core: true }] },
];
const percentile = (a, q) => { const v = [...a].sort((x, y) => x - y); return v[Math.max(0, Math.ceil(v.length * q) - 1)]; };
const all = [];
for (const example of cases) {
  for (let i = 0; i < repeats; i++) {
    if (all.length) await pause(1700); // server has a 1500 ms cooldown
    const payload = { mode: 'final', ai: true, project: example.name, idea: example.idea,
      features: example.features, questions: [], extras: [], autonomy: 100, duration: '1 Stunde', minutes: 60, creativity: 2, tone: 2 };
    const start = performance.now();
    const res = await fetch(new URL('/api/spec/stream', base), { method: 'POST', headers: { 'content-type': 'application/json', origin: new URL(base).origin }, body: JSON.stringify(payload) });
    if (!res.ok) throw Error(example.name + ': HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200));
    let buffer = '', done = null;
    for await (const chunk of res.body) {
      buffer += new TextDecoder().decode(chunk);
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        if (!line.trim()) continue;
        const item = JSON.parse(line);
        if (item.error) throw Error(example.name + ': ' + item.error);
        if (item.done) done = item;
      }
    }
    const elapsed = Math.round(performance.now() - start);
    if (!done?.markdown) throw Error(example.name + ': Ergebnis unvollständig.');
    const actual = coreChapters(done.markdown, specFrame(payload)).map(c => c.title);
    const expected = chapterGroups.flat();
    const complete = JSON.stringify(actual) === JSON.stringify(expected) && /\bFR-\d{3}\b/.test(done.markdown);
    const calls = done.usage?.timings || [];
    const result = { case: example.name, run: i + 1, elapsedMs: elapsed, complete,
      models: calls.map(x => x.model).join(', '), calls: calls.length, firstTokenMs: Math.min(...calls.map(x => x.firstTokenMs).filter(Number.isFinite)),
      inputTokens: calls.reduce((sum, x) => sum + (x.input_tokens || 0), 0), outputTokens: calls.reduce((sum, x) => sum + (x.output_tokens || 0), 0) };
    if (!Number.isFinite(result.firstTokenMs)) result.firstTokenMs = null;
    all.push(result);
    console.log(JSON.stringify(result));
  }
}
console.table(cases.map(c => { const results = all.filter(r => r.case === c.name); const ms = results.map(r => r.elapsedMs);
  return { case: c.name, runs: results.length, p50Ms: percentile(ms, 0.5), p95Ms: percentile(ms, 0.95), valid: results.filter(r => r.complete).length + '/' + results.length };
}));
if (all.some(r => !r.complete)) process.exitCode = 1;

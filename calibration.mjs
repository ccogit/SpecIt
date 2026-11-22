// Kalibrierung der Laufzeit-Schätzung an echten Läufen: Die KI rät die Minuten je Auftrag und je Feature; nach jeder
// direkten Umsetzung wird die Schätzung mit der gemessenen Laufzeit der Agenten verglichen. Der daraus gebildete Faktor
// rechnet künftige Schätzungen um. Getrennt für Aufträge des Plans ('plan') und Features ('feat').
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const file = () => process.env.SPECIT_CALIBRATION || path.join(homedir(), '.specit', 'calibration.json');
const kinds = ['plan', 'feat'], blank = () => ({ plan: { est: 0, real: 0, runs: 0 }, feat: { est: 0, real: 0, runs: 0 } });
const round = x => Math.round(x * 100) / 100;

/** Minuten auf Hundertstel, mindestens drei Sekunden – kurze Aufträge werden nicht auf ganze Minuten aufgerundet. */
export const cleanMinutes = (x, fallback) => Number.isFinite(x) && x > 0 ? Math.min(2880, Math.max(0.05, round(x))) : fallback;

/** Faktor gemessen/geschätzt; ohne Messung 1. Begrenzt, damit ein einzelner Ausreißer die Schätzung nicht unbrauchbar macht. */
export function factorOf(c, kind) {
  const k = c && c[kind];
  return k && k.est > 0 && k.real > 0 ? Math.min(10, Math.max(0.02, k.real / k.est)) : 1;
}

/** Nimmt einen Lauf auf (est = Schätzung der KI in Minuten, unskaliert; real = gemessene Minuten). Ältere Läufe zählen je neuem Lauf nur noch zu 60 %. */
export function learn(c, kind, est, real) {
  const out = { ...blank(), ...c };
  if (!kinds.includes(kind) || !(est > 0) || !(real > 0)) return out;
  const k = out[kind] || { est: 0, real: 0, runs: 0 };
  out[kind] = { est: round(k.est * 0.6 + est), real: round(k.real * 0.6 + real), runs: (k.runs || 0) + 1 };
  return out;
}

export function load() {
  try {
    const c = JSON.parse(readFileSync(file(), 'utf8')), out = blank();
    for (const k of kinds) if (c[k] && c[k].est > 0 && c[k].real > 0) out[k] = { est: c[k].est, real: c[k].real, runs: Number.isInteger(c[k].runs) ? c[k].runs : 1 };
    return out;
  } catch { return blank(); }
}

export function record(kind, est, real) {
  const c = learn(load(), kind, est, real);
  try { mkdirSync(path.dirname(file()), { recursive: true }); writeFileSync(file(), JSON.stringify(c, null, 1)); } catch { /* ohne Schreibrecht bleibt es bei der bisherigen Schätzung */ }
  return c;
}

export const factor = kind => factorOf(load(), kind);
export const info = () => { const c = load(); return { plan: { factor: round(factorOf(c, 'plan')), runs: c.plan.runs }, feat: { factor: round(factorOf(c, 'feat')), runs: c.feat.runs } }; };

/** Rechnet die Schätzungen der KI um: raw behält ihren Wert (für den späteren Vergleich), minutes ist der kalibrierte. */
export function scale(items, f) {
  return items.map(x => {
    const raw = cleanMinutes(x.minutes, 1), out = { ...x, raw, minutes: cleanMinutes(raw * f, 0.05) };
    if (x.lean && Number.isFinite(x.lean.minutes)) out.lean = { ...x.lean, minutes: Math.min(cleanMinutes(x.lean.minutes * f, 0.05), out.minutes) };
    if (out.lean && !(out.lean.minutes < out.minutes)) delete out.lean;
    return out;
  });
}

/** Unskalierte Schätzung einer Liste: raw, wo vorhanden, sonst der kalibrierte Wert zurückgerechnet. */
export const rawSum = (items, f) => items.reduce((n, x) => n + (Number.isFinite(x.raw) && x.raw > 0 ? x.raw : x.minutes / f), 0);

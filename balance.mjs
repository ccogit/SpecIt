// Bilanz von Input und Output: Wer hat wie viel zum Konzept beigetragen – der Nutzer, die Standards von SpecIt
// oder die KI – und welche Artefakte sind daraus entstanden. Reine Rechnung aus gezählten Tatsachen.
const words = t => (String(t || '').trim().match(/\S+/g) || []).length;
const num = v => (Number.isFinite(v) && v > 0 ? Math.round(v) : 0);

/**
 * x: { idea, questions, extras, features, clicks, usage:{context,ai,calls}, spec, name, logos, layouts,
 *      plan, planWords, nextStep, finished, output } – output ist das Ergebnis von scanArtifacts() des Zielordners.
 * Liefert die drei Input-Quellen, ihre Anteile an den Festlegungen und die Artefakte des Outputs.
 */
export function balance(x = {}) {
  const q = Array.isArray(x.questions) ? x.questions : [], extras = Array.isArray(x.extras) ? x.extras : [];
  const features = Array.isArray(x.features) ? x.features : [], u = x.usage || {};
  const decided = q.filter(z => z.state === 'decided').length, defaults = q.filter(z => z.state === 'default');
  const typed = words(x.idea) + q.reduce((n, z) => n + words(z.custom), 0) + extras.reduce((n, e) => n + words(e), 0);
  // a) Nutzer: selbst getippt, selbst geklickt, selbst entschieden
  const user = { words: typed, clicks: num(x.clicks), decisions: decided + extras.length };
  // b) Standard: übernommene Standardantworten (auto = ohne Rückfrage übernommen) und der feste Kontext von SpecIt,
  //    der mit jeder Anfrage an die KI geht (Anweisungen, Regeln, Vorlagen)
  const std = { decisions: defaults.length, auto: defaults.filter(z => z.auto).length, words: num(u.context) };
  // c) KI: erzeugte Zwischenergebnisse (Fragen, Optionen, Features, Review, Namen) und eigene Vorschläge im Umfang
  const ai = { words: num(u.ai), calls: num(u.calls), suggestions: features.filter(f => f && f.own && f.on !== false).length };
  const total = user.decisions + std.decisions + ai.suggestions, pct = n => (total ? Math.round(100 * n / total) : 0);
  const shares = { user: pct(user.decisions), std: pct(std.decisions), ai: total ? 100 - pct(user.decisions) - pct(std.decisions) : 0 };

  const outputs = [], spec = String(x.spec || '');
  if (spec.trim()) {
    const sections = (spec.match(/^##\s/gm) || []).length;
    outputs.push({ key: 'spec', label: 'Spezifikation', short: 'Wörter Spez.', value: words(spec), unit: 'Wörter',
      detail: [sections ? sections + ' Abschnitte' : '', features.length ? features.filter(f => f.on !== false).length + ' Features' : ''].filter(Boolean).join(' · ') });
  }
  const logos = num(x.logos), layouts = num(x.layouts), name = String(x.name || '').trim();
  if (name || logos || layouts) {
    // Der Name zählt mit: Auch er ist ein Ergebnis – ein Name und ein Logo sind zwei Ergebnisse, nicht „1 Entwürfe“
    const count = (name ? 1 : 0) + logos + layouts, unit = count === 1 ? 'Ergebnis' : 'Ergebnisse', one = (n, single, many) => n + ' ' + (n === 1 ? single : many);
    outputs.push({ key: 'brand', label: 'Name, Layout und Logo', short: unit, value: count, unit,
      detail: [name ? 'Name „' + name + '“' : '', layouts ? one(layouts, 'Layout-Entwurf', 'Layout-Entwürfe') : '', logos ? one(logos, 'Logo-Entwurf', 'Logo-Entwürfe') : ''].filter(Boolean).join(' · ') });
  }
  const plan = x.plan && Array.isArray(x.plan.tasks) ? x.plan : null;
  if (plan) {
    outputs.push({ key: 'plan', label: 'Agent-Aufträge', short: 'Aufträge', value: plan.tasks.length, unit: 'Aufträge',
      detail: [num(x.planWords) ? num(x.planWords).toLocaleString('de-DE') + ' Wörter' : '', Array.isArray(plan.waves) ? plan.waves.length + ' Stufen' : ''].filter(Boolean).join(' · ') });
    if (x.nextStep === 'run') {
      const o = x.output && num(x.output.files) ? x.output : null;
      outputs.push(o
        ? { key: 'code', label: 'Umsetzung im Zielordner', short: 'Dateien', value: num(o.files), unit: 'Dateien',
            detail: num(o.lines).toLocaleString('de-DE') + ' Zeilen' + (o.truncated ? ' (Zählung abgebrochen)' : ''),
            groups: (Array.isArray(o.groups) ? o.groups : []).filter(g => num(g.files)).map(g => ({ label: g.label, files: num(g.files), lines: num(g.lines) })) }
        : { key: 'code', label: 'Umsetzung im Zielordner', short: 'Dateien', value: 0, unit: 'Dateien', detail: 'noch nicht gestartet', pending: true });
    } else {
      outputs.push({ key: 'files', label: 'Dateien zum Download', short: 'Dateien', value: 3, unit: 'Dateien',
        detail: 'Spezifikation, Aufträge als JSON, Aufträge als Markdown', pending: !x.finished });
    }
  }
  return { user, std, ai, open: q.filter(z => z.state === 'open').length, shares, outputs,
    inWords: user.words + std.words + ai.words, outWords: words(spec) + num(x.planWords) };
}

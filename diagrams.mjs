import { routeDiagram } from './diagram-routing.mjs';
// Schaubilder der spezifizierten Anwendung. Die KI liefert nur Struktur (Knoten und Verbindungen als JSON); gezeichnet wird
// hier: Anordnung für das SVG der Oberfläche und Mermaid-Text für das Markdown. So gibt es keine Syntaxfehler im Schaubild
// und keine Abhängigkeit von einer Zeichenbibliothek. Läuft im Browser und in Node – keine Dateizugriffe.

const kinds = ['start', 'step', 'decision', 'end', 'error'];
const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
// Kennungen der Anforderungen, auf die ein Knoten verweist (FR-001, NFR-001 …)
const refsOf = v => [...new Set((Array.isArray(v) ? v : []).filter(r => typeof r === 'string' && /^(?:FR|NFR)-\d{3}$/.test(r)))].slice(0, 6);

/** Anweisung an die KI: den wichtigsten Kernablauf als Struktur. */
export const flowPrompt = 'Leite aus der Spezifikation (spec) das Ablaufdiagramm des wichtigsten Kernablaufs der Anwendung ab – so, wie ihn eine Person von Anfang bis Ende erlebt. '
  + 'Liefere nur Struktur, keine Zeichnung: 6 bis 12 Knoten und ihre Verbindungen. '
  + 'Knoten: id (n1, n2 …), label (höchstens 40 Zeichen, aus Nutzersicht, Tätigkeit zuerst, z. B. „Namen eingeben“), '
  + 'kind = start (genau einer, der Einstieg), step (Schritt), decision (Verzweigung, als kurze Frage mit Fragezeichen), end (Ergebnis, mindestens einer), error (Fehler- oder Randfall), '
  + 'refs = Kennungen der Anforderungen, die der Knoten umsetzt (z. B. ["FR-003"]; leer, wenn keine passt). '
  + 'Verbindungen: from, to (Knoten-ids), label nur an den Ausgängen einer Verzweigung (z. B. „ja“, „nein“, „ungerade Zahl“), sonst leer. '
  + 'Jede Verzweigung hat mindestens zwei Ausgänge. Nimm die ein bis drei wichtigsten Fehler- oder Randfälle aus der Spezifikation auf und führe sie zurück in den Ablauf oder zu einem Ende. '
  + 'Erfinde nichts, was die Spezifikation nicht hergibt. title = der Ablauf in drei bis sechs Wörtern. '
  + 'Ausschließlich JSON ohne Markdown-Codeblock: {"title":"...","nodes":[{"id":"n1","label":"...","kind":"start","refs":[]}],"edges":[{"from":"n1","to":"n2","label":""}]}';

/**
 * Prüft und bereinigt ein Ablaufdiagramm: gültige Knoten, genau ein Einstieg, nur Verbindungen zwischen vorhandenen Knoten,
 * nur was vom Einstieg aus erreichbar ist. Liefert { title, nodes, edges } oder null, wenn kein brauchbarer Ablauf übrig bleibt.
 */
export function cleanFlow(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return null;
  const map = new Map(), nodes = [];
  for (const n of raw.nodes) {
    if (!n || typeof n !== 'object' || nodes.length >= 14) continue;
    const from = text(n.id, 24), label = text(n.label, 60);
    if (!from || !label || map.has(from)) continue;
    const id = 'n' + (nodes.length + 1); map.set(from, id);
    nodes.push({ id, label, kind: kinds.includes(n.kind) ? n.kind : 'step', refs: refsOf(n.refs) });
  }
  if (nodes.length < 3) return null;
  // Genau ein Einstieg: der erste als start gekennzeichnete, sonst der erste Knoten
  const start = nodes.find(n => n.kind === 'start') || nodes[0];
  for (const n of nodes) if (n.kind === 'start' && n !== start) n.kind = 'step';
  start.kind = 'start';
  const seen = new Set(); let edges = [];
  for (const e of raw.edges) {
    if (!e || typeof e !== 'object' || edges.length >= 28) continue;
    const from = map.get(text(e.from, 24)), to = map.get(text(e.to, 24));
    if (!from || !to || from === to || seen.has(from + '>' + to)) continue;
    seen.add(from + '>' + to); edges.push({ from, to, label: text(e.label, 24) });
  }
  // Nur was vom Einstieg aus erreichbar ist
  const reach = new Set([start.id]), todo = [start.id];
  while (todo.length) { const id = todo.pop(); for (const e of edges) if (e.from === id && !reach.has(e.to)) { reach.add(e.to); todo.push(e.to); } }
  const kept = nodes.filter(n => reach.has(n.id)); edges = edges.filter(e => reach.has(e.from) && reach.has(e.to));
  if (kept.length < 3 || edges.length < 2) return null;
  // Der Einstieg steht vorn; Kennungen fortlaufend
  kept.sort((a, b) => (b === start) - (a === start));
  const renum = new Map(kept.map((n, i) => [n.id, 'n' + (i + 1)]));
  return { title: text(raw.title, 60), nodes: kept.map(n => ({ ...n, id: renum.get(n.id) })), edges: edges.map(e => ({ ...e, from: renum.get(e.from), to: renum.get(e.to) })) };
}

const mm = s => String(s).replace(/["`]/g, '\'').replace(/[<>{}[\]|]/g, ' ').replace(/\s+/g, ' ').trim();

/** Mermaid-Text des Ablaufs (flowchart, von oben nach unten) – für das Markdown; GitHub und viele Editoren zeigen ihn als Bild. */
export function flowMermaid(flow) {
  const shape = n => n.kind === 'start' || n.kind === 'end' ? '(["' + mm(n.label) + '"])' : n.kind === 'decision' ? '{"' + mm(n.label) + '"}' : '["' + mm(n.label) + '"]';
  const lines = ['flowchart TD', ...flow.nodes.map(n => '  ' + n.id + shape(n)), ...flow.edges.map(e => '  ' + e.from + (e.label ? ' -->|"' + mm(e.label) + '"| ' : ' --> ') + e.to)];
  const errors = flow.nodes.filter(n => n.kind === 'error').map(n => n.id);
  if (errors.length) lines.push('  classDef fehler stroke-dasharray:4 3', '  class ' + errors.join(',') + ' fehler');
  return lines.join('\n');
}

/** Bricht eine Beschriftung in höchstens zwei Zeilen um; was nicht passt, endet mit „…“. */
export function wrapLabel(label, width = 24) {
  const words = String(label).split(' '), lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (!cur) lines[lines.length - 1] = w; else if ((cur + ' ' + w).length <= width) lines[lines.length - 1] = cur + ' ' + w; else lines.push(w);
  }
  if (lines.length > 2) { lines.length = 2; lines[1] = lines[1].slice(0, width - 1).replace(/\s+$/, '') + '…'; }
  return lines.map(l => l.length > width + 2 ? l.slice(0, width + 1) + '…' : l);
}

const rnd = v => Math.round(v * 10) / 10;
/** Lücken einer Stufe, durch die eine Verbindung laufen kann: links und rechts außen und zwischen den Knoten. */
const gapsOf = (xs, w, gapX) => { const s = [...xs].sort((a, b) => a - b); return [s[0] - gapX / 2, ...s.map(x => x + w + gapX / 2)]; };
/**
 * Weg von (x1,y1) nach (x2,y2) über mehrere Stufen hinweg: Durch jede Stufe dazwischen (mids: [{top,bottom,gaps}], in Laufrichtung)
 * führt er senkrecht durch die nächstgelegene Lücke statt hinter einem Knoten hindurch. Liefert { d, lx, ly }.
 */
function routeThrough(x1, y1, x2, y2, mids, tip = 4) {
  const dir = y2 >= y1 ? 1 : -1; let d = 'M' + rnd(x1) + ',' + rnd(y1), px = x1, py = y1, curve = null;
  mids.forEach((m, i) => {
    const want = x1 + (x2 - x1) * (i + 1) / (mids.length + 1), gap = m.gaps.reduce((best, g) => Math.abs(g - want) < Math.abs(best - want) ? g : best, m.gaps[0]), n = m.used.get(gap) || 0, gx = gap + [0, -7, 7, -12, 12][n % 5];
    m.used.set(gap, n + 1);
    const inY = dir > 0 ? m.top - 8 : m.bottom + 8, outY = dir > 0 ? m.bottom + 8 : m.top - 8, mid = (py + inY) / 2;
    d += ' C' + rnd(px) + ',' + rnd(mid) + ' ' + rnd(gx) + ',' + rnd(mid) + ' ' + rnd(gx) + ',' + rnd(inY) + ' L' + rnd(gx) + ',' + rnd(outY);
    if (!i) curve = [[px, py], [px, mid], [gx, mid], [gx, inY]];
    px = gx; py = outY;
  });
  const endY = y2 - dir * tip, mid = (py + endY) / 2;
  return { d: d + ' C' + rnd(px) + ',' + rnd(mid) + ' ' + rnd(x2) + ',' + rnd(mid) + ' ' + rnd(x2) + ',' + rnd(endY), curve: curve || [[px, py], [px, mid], [x2, mid], [x2, endY]] };
}
const cubicAt = ([p, a, b, q], s) => { const u = 1 - s; return [u * u * u * p[0] + 3 * u * u * s * a[0] + 3 * u * s * s * b[0] + s * s * s * q[0], u * u * u * p[1] + 3 * u * u * s * a[1] + 3 * u * s * s * b[1] + s * s * s * q[1]]; };
/**
 * Platz für eine Beschriftung auf einer Kurve: möglichst in der Mitte; liegt dort schon eine andere Beschriftung oder ein Knoten,
 * ein Stück davor oder dahinter. taken sammelt die vergebenen Plätze ([x, y, halbe Breite]).
 */
function labelSpot(curve, label, boxes, taken) {
  const half = String(label).length * 3.5 + 5, free = c => !boxes.some(b => c[0] + half > b.x && c[0] - half < b.x + b.w && c[1] + 8 > b.y && c[1] - 8 < b.y + b.h) && !taken.some(o => Math.abs(o[0] - c[0]) < o[2] + half && Math.abs(o[1] - c[1]) < 14);
  let spot = cubicAt(curve, 0.5);
  for (const s of [0.5, 0.36, 0.64, 0.24, 0.76, 0.14, 0.86]) { const c = cubicAt(curve, s); if (free(c)) { spot = c; break; } }
  if (label) taken.push([spot[0], spot[1], half]);
  return { lx: rnd(spot[0]), ly: rnd(spot[1]) };
}

/**
 * Ordnet den Ablauf in Stufen von oben nach unten an. Rücksprünge (Verbindungen zu einem früheren Schritt) bestimmen die Stufen
 * nicht mit und laufen außen an der rechten Seite zurück. Liefert { width, height, nodes:[{…,x,y,w,h,lines}], edges:[{…,d,lx,ly,back}] }.
 */
export function layoutFlow(flow, { w = 184, h = 48, gapX = 26, gapY = 46, pad = 14 } = {}) {
  const ids = flow.nodes.map(n => n.id), out = new Map(ids.map(id => [id, []]));
  for (const e of flow.edges) out.get(e.from).push(e);
  // Rücksprünge finden: Verbindung zu einem Knoten, der im Durchlauf gerade offen ist
  const state = new Map(), back = new Set();
  const visit = id => { state.set(id, 1); for (const e of out.get(id)) { const s = state.get(e.to); if (s === 1) back.add(e); else if (!s) visit(e.to); } state.set(id, 2); };
  visit(ids[0]);
  // Stufe = längster Weg vom Einstieg über Vorwärtsverbindungen
  const rank = new Map(ids.map(id => [id, 0]));
  for (let i = 0; i < ids.length; i++) for (const e of flow.edges) if (!back.has(e) && rank.get(e.to) < rank.get(e.from) + 1) rank.set(e.to, rank.get(e.from) + 1);
  const rows = [];
  for (const id of ids) (rows[rank.get(id)] ||= []).push(id);
  // Innerhalb einer Stufe nach der mittleren Lage der Vorgänger ordnen – das spart Überkreuzungen
  const col = new Map();
  rows.forEach((row, r) => {
    if (r) {
      const mean = id => { const ps = flow.edges.filter(e => e.to === id && !back.has(e) && col.has(e.from)).map(e => col.get(e.from)); return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0; };
      const key = new Map(row.map((id, i) => [id, mean(id) + i / 1000])); row.sort((a, b) => key.get(a) - key.get(b));
    }
    const span = row.length * w + (row.length - 1) * gapX; row.forEach((id, i) => col.set(id, i * (w + gapX) - span / 2 + w / 2));
  });
  // Rücksprünge laufen auf der Seite zurück, auf der ihr Ausgangsknoten steht – so kreuzen sie keine Nachbarn
  const sideways = e => back.has(e) || rank.get(e.to) <= rank.get(e.from), leftOf = e => col.get(e.from) < col.get(e.to);
  const half = Math.max(...rows.map(row => row.length * w + (row.length - 1) * gapX)) / 2, room = 46;
  const left = flow.edges.some(e => sideways(e) && leftOf(e)) ? room : 0, right = flow.edges.some(e => sideways(e) && !leftOf(e)) ? room : 0;
  const at = new Map(), nodes = flow.nodes.map(n => { const p = { ...n, w, h, x: pad + left + half + col.get(n.id) - w / 2, y: pad + rank.get(n.id) * (h + gapY), lines: wrapLabel(n.label) }; at.set(n.id, p); return p; });
  const r1 = v => Math.round(v * 10) / 10, taken = [];
  const lanes = rows.map(row => ({ top: at.get(row[0]).y, bottom: at.get(row[0]).y + h, gaps: gapsOf(row.map(id => at.get(id).x), w, gapX), used: new Map() }));
  const edges = flow.edges.map(e => {
    const a = at.get(e.from), b = at.get(e.to);
    if (sideways(e)) {
      // Rücksprung oder Verbindung in dieselbe Stufe: außen an der Seite vorbei
      const dir = leftOf(e) ? -1 : 1, x1 = a.x + (dir > 0 ? w : 0), y1 = a.y + h / 2, x2 = b.x + (dir > 0 ? w : 0), y2 = b.y + h / 2, far = (dir > 0 ? Math.max(x1, x2) : Math.min(x1, x2)) + dir * 34;
      return { ...e, back: true, d: 'M' + r1(x1) + ',' + r1(y1) + ' C' + r1(far) + ',' + r1(y1) + ' ' + r1(far) + ',' + r1(y2) + ' ' + r1(x2 + dir * 4) + ',' + r1(y2), lx: r1(far - dir * 8), ly: r1((y1 + y2) / 2) };
    }
    // Überspringt die Verbindung Stufen, läuft sie durch deren Lücken statt hinter Knoten hindurch
    const mids = lanes.slice(rank.get(e.from) + 1, rank.get(e.to));
    const way = routeThrough(a.x + w / 2, a.y + h, b.x + w / 2, b.y, mids);
    return { ...e, back: false, d: way.d, ...labelSpot(way.curve, e.label, nodes, taken) };
  });
  return { width: Math.ceil(pad * 2 + half * 2 + left + right), height: Math.ceil(pad * 2 + rows.length * h + (rows.length - 1) * gapY), nodes, edges };
}

/* ---------- Aufbau (Bausteine in Ebenen) und Datenmodell (Objekte und Beziehungen) ---------- */

const archKinds = ['actor', 'ui', 'logic', 'store', 'external'];
/** Ebenen des Aufbaus von oben nach unten; Fremdsysteme stehen in der untersten Ebene neben der Datenhaltung. */
export const layerNames = { actor: 'Nutzer', ui: 'Oberfläche', logic: 'Logik', store: 'Daten und Schnittstellen' };
const layerOf = kind => kind === 'external' ? 'store' : kind;

/** Anweisung an die KI: Aufbau und Datenmodell als Struktur. */
export const archPrompt = 'Leite aus der Spezifikation (spec) zwei Strukturen ab – nur Struktur, keine Zeichnung. '
  + '1. structure – der Aufbau der Anwendung als 5 bis 10 Bausteine in Ebenen. Knoten: id (n1, n2 …), label (höchstens 28 Zeichen), note (ein Halbsatz, höchstens 60 Zeichen: wofür der Baustein da ist), refs = Kennungen der Anforderungen, die der Baustein vor allem umsetzt (z. B. ["FR-003"]; höchstens 4, leer bei Nutzerrollen), '
  + 'kind = actor (Nutzerrolle, höchstens 3), ui (Bereich oder Ansicht der Oberfläche), logic (fachlicher Baustein, z. B. „Auslosung“), store (Datenhaltung, z. B. „Lokaler Speicher“) oder external (Fremdsystem oder Schnittstelle nach außen). '
  + 'Verbindungen (edges): from, to in Richtung der Nutzung, label ein bis zwei Wörter (z. B. „nutzt“, „speichert“, „liest“); höchstens 14, nur die wesentlichen. '
  + '2. data – die fachlichen Objekte, die die Anwendung hält. entities: name (Einzahl, höchstens 24 Zeichen), attributes (höchstens 6 kurze Feldnamen). '
  + 'relations: from, to (Namen der Objekte), kind = "1:1", "1:n" oder "n:m" (from steht links), label ein bis zwei Wörter (z. B. „besitzt“). Höchstens 8 Objekte; leere Listen, wenn die Anwendung keine eigenen Objekte hält. '
  + 'Erfinde nichts, was die Spezifikation nicht hergibt; nenne keine Technik, die sie nicht festlegt. '
  + 'Ausschließlich JSON ohne Markdown-Codeblock: {"structure":{"nodes":[{"id":"n1","label":"...","note":"...","kind":"ui","refs":[]}],"edges":[{"from":"n1","to":"n2","label":"nutzt"}]},"data":{"entities":[{"name":"...","attributes":["..."]}],"relations":[{"from":"...","to":"...","kind":"1:n","label":"..."}]}}';

function cleanStructure(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return null;
  const map = new Map(), nodes = [];
  for (const n of raw.nodes) {
    if (!n || typeof n !== 'object' || nodes.length >= 12) continue;
    const from = text(n.id, 24), label = text(n.label, 40);
    if (!from || !label || map.has(from)) continue;
    const id = 'n' + (nodes.length + 1); map.set(from, id);
    nodes.push({ id, label, note: text(n.note, 80), kind: archKinds.includes(n.kind) ? n.kind : 'logic', refs: refsOf(n.refs) });
  }
  const seen = new Set(), edges = [];
  for (const e of raw.edges) {
    if (!e || typeof e !== 'object' || edges.length >= 16) continue;
    const from = map.get(text(e.from, 24)), to = map.get(text(e.to, 24));
    if (!from || !to || from === to || seen.has(from + '>' + to) || seen.has(to + '>' + from)) continue;
    seen.add(from + '>' + to); edges.push({ from, to, label: text(e.label, 18) });
  }
  return nodes.length >= 3 && edges.length >= 2 ? { nodes, edges } : null;
}

function cleanData(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.entities)) return null;
  const map = new Map(), entities = [];
  for (const e of raw.entities) {
    if (!e || typeof e !== 'object' || entities.length >= 8) continue;
    const name = text(e.name, 30), key = name.toLowerCase();
    if (!name || map.has(key)) continue;
    const id = 'e' + (entities.length + 1); map.set(key, id);
    entities.push({ id, name, attributes: [...new Set((Array.isArray(e.attributes) ? e.attributes : []).map(a => text(a, 26)).filter(Boolean))].slice(0, 6) });
  }
  if (entities.length < 2) return null;
  const seen = new Set(), relations = [];
  for (const r of Array.isArray(raw.relations) ? raw.relations : []) {
    if (!r || typeof r !== 'object' || relations.length >= 12) continue;
    // Beziehungen nennen die Objekte beim Namen; ein bereits geprüftes Modell (aus dem gespeicherten Stand) nennt ihre Kennung
    const ids = new Set(entities.map(e => e.id)), find = v => map.get(text(v, 30).toLowerCase()) || (ids.has(v) ? v : undefined);
    const from = find(r.from), to = find(r.to);
    if (!from || !to || from === to || seen.has(from + '>' + to) || seen.has(to + '>' + from)) continue;
    seen.add(from + '>' + to); relations.push({ from, to, kind: ['1:1', '1:n', 'n:m'].includes(r.kind) ? r.kind : '1:n', label: text(r.label, 20) });
  }
  return { entities, relations };
}

/** Prüft Aufbau und Datenmodell; jedes für sich darf fehlen (null). Liefert null, wenn beides fehlt. */
export function cleanArch(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const structure = cleanStructure(raw.structure), data = cleanData(raw.data);
  return structure || data ? { structure, data } : null;
}

/**
 * Ordnet die Bausteine in Ebenen an (Nutzer, Oberfläche, Logik, Daten und Schnittstellen). Verbindungen setzen verteilt an der
 * Kante eines Bausteins an (nicht alle in der Mitte) und laufen über Ebenen hinweg durch die Lücken. Liefert { width, height, rows, nodes, edges }.
 */
export function layoutStructure(st, { w = 168, h = 46, gapX = 26, gapY = 82, pad = 34, top = 16 } = {}) {
  const order = Object.keys(layerNames), groups = order.map(l => st.nodes.filter(n => layerOf(n.kind) === l)).map((list, i) => ({ layer: order[i], list })).filter(g => g.list.length);
  const col = new Map(), rowOf = new Map();
  groups.forEach((g, r) => {
    if (r) {
      // nach der mittleren Lage der verbundenen Bausteine der Ebenen darüber ordnen
      const mean = id => { const ps = st.edges.filter(e => (e.to === id && rowOf.get(e.from) < r) || (e.from === id && rowOf.get(e.to) < r)).map(e => col.get(e.to === id ? e.from : e.to)); return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0; };
      const key = new Map(g.list.map((n, i) => [n.id, mean(n.id) + i / 1000])); g.list.sort((a, b) => key.get(a.id) - key.get(b.id));
    }
    const span = g.list.length * w + (g.list.length - 1) * gapX;
    g.list.forEach((n, i) => { col.set(n.id, i * (w + gapX) - span / 2 + w / 2); rowOf.set(n.id, r); });
  });
  const half = Math.max(...groups.map(g => g.list.length * w + (g.list.length - 1) * gapX)) / 2;
  const rowY = r => pad + top + r * (h + gapY), at = new Map();
  const nodes = st.nodes.map(n => { const p = { ...n, w, h, x: pad + half + col.get(n.id) - w / 2, y: rowY(rowOf.get(n.id)), lines: wrapLabel(n.label, 22) }; at.set(n.id, p); return p; });
  const width = Math.ceil(pad * 2 + half * 2);
  const height = Math.ceil(pad * 2 + top + groups.length * h + (groups.length - 1) * gapY);
  const edges = routeDiagram(nodes, st.edges, { width, height, mode: 'structure' });
  return { width, height, rows: groups.map((g, r) => ({ name: layerNames[g.layer], y: rowY(r) - 8 })), nodes, edges };
}

// Liegt der Punkt in einem der Kästen (mit Rand)?
const inBox = (x, y, boxes, m = 5) => boxes.some(b => x > b.x - m && x < b.x + b.w + m && y > b.y - m && y < b.y + b.h + m);
// Punkt auf dem Weg von p über die Stütze c nach q (c = null: Gerade)
const along = (p, c, q, s) => c ? [(1 - s) * (1 - s) * p[0] + 2 * s * (1 - s) * c[0] + s * s * q[0], (1 - s) * (1 - s) * p[1] + 2 * s * (1 - s) * c[1] + s * s * q[1]] : [p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s];
const hits = (p, c, q, boxes) => { let n = 0; for (let i = 1; i < 24; i++) { const [x, y] = along(p, c, q, i / 24); if (inBox(x, y, boxes)) n++; } return n; };
const crosses = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); };

/**
 * Ordnet die Objekte des Datenmodells in einem Raster an. Die Plätze werden so getauscht, dass möglichst keine Beziehung hinter
 * einem fremden Kasten durchläuft und sich möglichst wenige kreuzen; was dann noch im Weg liegt, wird im Bogen umgangen.
 * Liefert { width, height, entities, relations:[{…, d, lx, ly, ca, cb, pa, pb}] }.
 */
export function layoutData(d, { w = 176, pad = 34, gapX = 120, gapY = 96, head = 28, line = 17 } = {}) {
  const ids = d.entities.map(e => e.id), near = new Map(ids.map(id => [id, []]));
  for (const r of d.relations) { near.get(r.from).push(r.to); near.get(r.to).push(r.from); }
  const order = [], seen = new Set();
  for (const start of ids) { if (seen.has(start)) continue; const todo = [start]; seen.add(start); while (todo.length) { const c = todo.shift(); order.push(c); for (const n of near.get(c)) if (!seen.has(n)) { seen.add(n); todo.push(n); } } }
  const cols = order.length <= 4 ? 2 : 3, lines = Math.ceil(order.length / cols), byId = new Map(d.entities.map(e => [e.id, e])), heightOf = e => head + Math.max(1, e.attributes.length) * line + 10;
  const width = pad * 2 + cols * w + (cols - 1) * gapX;
  // Plätze → Lage der Kästen; die Zeilenhöhe richtet sich nach dem höchsten Kasten der Zeile
  const place = slots => {
    const at = new Map(); let y = pad;
    for (let r = 0; r < lines; r++) {
      const row = slots.slice(r * cols, (r + 1) * cols); let rowH = 0;
      row.forEach((id, k) => { if (!id) return; const e = byId.get(id), hh = heightOf(e); rowH = Math.max(rowH, hh); at.set(id, { ...e, x: pad + k * (w + gapX), y, w, h: hh, head, line }); });
      if (rowH) y += rowH + gapY;
    }
    return { at, height: y - gapY + pad };
  };
  const mid = b => [b.x + b.w / 2, b.y + b.h / 2];
  const cost = at => {
    let c = 0; const segs = d.relations.map(r => [mid(at.get(r.from)), mid(at.get(r.to)), r]);
    for (const [p, q, r] of segs) { c += hits(p, null, q, [...at.values()].filter(b => b.id !== r.from && b.id !== r.to)) * 100 + Math.hypot(q[0] - p[0], q[1] - p[1]) / 100; }
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) { const [a, b, r] = segs[i], [e, g, s] = segs[j]; if (r.from !== s.from && r.from !== s.to && r.to !== s.from && r.to !== s.to && crosses(a, b, e, g)) c += 60; }
    return c;
  };
  // Tauschen, solange es besser wird (auch mit freien Plätzen)
  let slots = [...order, ...Array(cols * lines - order.length).fill(null)], best = cost(place(slots).at);
  for (let pass = 0, better = true; better && pass < 12; pass++) {
    better = false;
    for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
      if (!slots[i] && !slots[j]) continue;
      const trial = [...slots]; [trial[i], trial[j]] = [trial[j], trial[i]]; const c = cost(place(trial).at);
      if (c < best - 0.001) { slots = trial; best = c; better = true; }
    }
  }
  const { at, height } = place(slots), boxes = [...at.values()];
  const relations = routeDiagram(boxes, d.relations, { width, height, mode: 'data' });
  return { width: Math.ceil(width), height: Math.ceil(height), entities: slots.filter(Boolean).map(id => at.get(id)), relations };
}

/** Mermaid-Text des Aufbaus: ein Flussdiagramm mit einem Rahmen je Ebene. */
export function structureMermaid(st) {
  const shape = n => n.kind === 'actor' ? '(["' + mm(n.label) + '"])' : n.kind === 'store' ? '[("' + mm(n.label) + '")]' : n.kind === 'external' ? '[["' + mm(n.label) + '"]]' : '["' + mm(n.label) + '"]';
  const lines = ['flowchart TD'];
  for (const layer of Object.keys(layerNames)) {
    const list = st.nodes.filter(n => layerOf(n.kind) === layer); if (!list.length) continue;
    lines.push('  subgraph ' + layer + '["' + mm(layerNames[layer]) + '"]', ...list.map(n => '    ' + n.id + shape(n)), '  end');
  }
  lines.push(...st.edges.map(e => '  ' + e.from + (e.label ? ' -->|"' + mm(e.label) + '"| ' : ' --> ') + e.to));
  return lines.join('\n');
}

// Bezeichner für erDiagram: nur Buchstaben, Ziffern und Unterstrich, eindeutig
const ident = (s, used) => {
  let id = String(s).replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss').normalize('NFD').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x';
  if (/^\d/.test(id)) id = 'x_' + id;
  let out = id, n = 2; while (used.has(out.toLowerCase())) out = id + '_' + n++;
  used.add(out.toLowerCase()); return out;
};

/** Mermaid-Text des Datenmodells (erDiagram). */
export function dataMermaid(d) {
  const used = new Set(), name = new Map(d.entities.map(e => [e.id, ident(e.name, used)])), lines = ['erDiagram'];
  for (const e of d.entities) {
    const fields = new Set(), attrs = e.attributes.map(a => '    string ' + ident(a, fields));
    lines.push(attrs.length ? '  ' + name.get(e.id) + ' {' : '  ' + name.get(e.id), ...attrs, ...(attrs.length ? ['  }'] : []));
  }
  for (const r of d.relations) lines.push('  ' + name.get(r.from) + (r.kind === '1:1' ? ' ||--|| ' : r.kind === 'n:m' ? ' }o--o{ ' : ' ||--o{ ') + name.get(r.to) + ' : "' + (mm(r.label) || 'gehört zu') + '"');
  return lines.join('\n');
}

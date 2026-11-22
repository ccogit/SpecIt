import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanArch, layoutData, layoutStructure, cleanFlow, layoutFlow } from '../diagrams.mjs';

// Wie viele Stützpunkte eines Weges liegen in einem fremden Kasten? Der Weg ist ein SVG-Pfad aus M, C, L und Q;
// geprüft wird entlang der Geraden zwischen seinen Stützpunkten – das genügt, weil die Wege flach geführt sind.
function pathHits(d, boxes) {
  const nums = d.match(/-?\d+(?:\.\d+)?/g).map(Number), pts = [];
  for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  let n = 0;
  for (let i = 1; i < pts.length; i++) for (let s = 1; s < 10; s++) {
    const x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * s / 10, y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * s / 10;
    if (boxes.some(b => x > b.x + 2 && x < b.x + b.w - 2 && y > b.y + 2 && y < b.y + b.h - 2)) n++;
  }
  return n;
}

test('a dense data model is arranged so that no relation runs behind a foreign box and labels stay apart', () => {
  const names = ['Bewohner', 'Kategorie', 'Gerät', 'Leihvorgang', 'Wartungseintrag', 'Ereignis'];
  const dense = cleanArch({ data: {
    entities: names.map((name, i) => ({ name, attributes: ['id', 'Name', 'Status', 'Datum', 'Text', 'Art'].slice(0, 2 + i % 4) })),
    relations: [['Bewohner', 'Gerät'], ['Kategorie', 'Gerät'], ['Gerät', 'Leihvorgang'], ['Bewohner', 'Leihvorgang'], ['Gerät', 'Wartungseintrag'], ['Bewohner', 'Ereignis'], ['Gerät', 'Ereignis'], ['Leihvorgang', 'Ereignis']]
      .map(([from, to]) => ({ from, to, kind: '1:n', label: 'hat' })),
  } }).data;
  const l = layoutData(dense);
  assert.equal(l.entities.length, 6);
  for (const r of l.relations) assert.equal(pathHits(r.d, l.entities.filter(e => e.id !== r.from && e.id !== r.to)), 0, r.from + '→' + r.to + ' runs behind a box');
  for (const a of l.entities) for (const b of l.entities) if (a !== b) assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, 'boxes overlap');
  assert.ok(l.entities.every(e => e.x >= 0 && e.x + e.w <= l.width && e.y >= 0 && e.y + e.h <= l.height));
  const labels = l.relations.map(r => [r.lx, r.ly]);
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) assert.ok(Math.abs(labels[i][0] - labels[j][0]) >= 58 || Math.abs(labels[i][1] - labels[j][1]) >= 15, 'labels ' + i + ' and ' + j + ' overlap');
});

test('links that skip a layer run through the gaps and arrive at different points of a node', () => {
  const st = cleanArch({ structure: {
    nodes: [{ id: 'a', label: 'Liste', kind: 'ui' }, { id: 'b', label: 'Ansicht', kind: 'ui' }, { id: 'c', label: 'Logik A', kind: 'logic' }, { id: 'd', label: 'Logik B', kind: 'logic' }, { id: 'e', label: 'Speicher', kind: 'store' }],
    edges: [{ from: 'a', to: 'c' }, { from: 'b', to: 'd' }, { from: 'c', to: 'e' }, { from: 'a', to: 'e', label: 'liest' }, { from: 'b', to: 'e' }],
  } }).structure;
  const l = layoutStructure(st);
  for (const e of l.edges) assert.equal(pathHits(e.d, l.nodes.filter(n => n.id !== e.from && n.id !== e.to)), 0, e.from + '→' + e.to + ' runs behind a node');
  const labelled = l.edges.filter(e => e.label);
  for (const e of labelled) assert.ok(!l.nodes.some(n => e.lx > n.x && e.lx < n.x + n.w && e.ly > n.y && e.ly < n.y + n.h), 'label on a node');
  const ends = l.edges.filter(e => e.to === 'n5').map(e => e.d.match(/-?\d+(?:\.\d+)?/g).slice(-2)[0]);
  assert.equal(ends.length, 3);
  assert.equal(new Set(ends).size, 3);
});

test('a flow link that skips steps runs through the gaps, not behind the steps', () => {
  const flow = cleanFlow({
    nodes: ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ id, label: 'Schritt ' + id, kind: i ? 'step' : 'start' })),
    edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd' }, { from: 'd', to: 'e' }, { from: 'a', to: 'e', label: 'direkt' }],
  });
  const l = layoutFlow(flow);
  for (const e of l.edges) assert.equal(pathHits(e.d, l.nodes.filter(n => n.id !== e.from && n.id !== e.to)), 0, e.from + '→' + e.to + ' runs behind a step');
  assert.ok(l.nodes.every(n => n.x >= 0 && n.x + n.w <= l.width));
});

test('labels of links that fan out from one node do not overlap', () => {
  const st = cleanArch({ structure: {
    nodes: [{ id: 'u', label: 'Bewohner', kind: 'actor' }, ...['Inventar', 'Meine Anfragen', 'Meine Geräte', 'Verwaltung'].map((label, i) => ({ id: 'v' + i, label, kind: 'ui' })), { id: 'x', label: 'Verleihlogik', kind: 'logic' }, { id: 's', label: 'JSON-Datei', kind: 'store' }],
    edges: [...[0, 1, 2, 3].map(i => ({ from: 'u', to: 'v' + i, label: 'nutzt' })), { from: 'v0', to: 'x', label: 'fragt an' }, { from: 'v1', to: 'x', label: 'zieht zurück' }, { from: 'v2', to: 'x', label: 'bestätigt' }, { from: 'v3', to: 'x', label: 'pflegt' }, { from: 'x', to: 's', label: 'speichert' }, { from: 'v0', to: 's', label: 'liest' }],
  } }).structure;
  const l = layoutStructure(st), ls = l.edges.filter(e => e.label);
  for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) {
    const need = (ls[i].label.length + ls[j].label.length) * 3.5 + 10;
    assert.ok(Math.abs(ls[i].lx - ls[j].lx) >= need || Math.abs(ls[i].ly - ls[j].ly) >= 14, ls[i].label + ' / ' + ls[j].label + ' overlap');
  }
  for (const e of l.edges) assert.equal(pathHits(e.d, l.nodes.filter(n => n.id !== e.from && n.id !== e.to)), 0, e.from + '→' + e.to + ' runs behind a node');
});

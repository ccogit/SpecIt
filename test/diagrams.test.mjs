import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanFlow, flowMermaid, layoutFlow, wrapLabel } from '../diagrams.mjs';

const raw = {
  title: 'Paare auslosen',
  nodes: [
    { id: 'a', label: 'App öffnen', kind: 'start', refs: ['FR-001', 'x'] },
    { id: 'b', label: 'Namen eingeben', kind: 'step' },
    { id: 'c', label: 'Mindestens zwei Namen?', kind: 'decision' },
    { id: 'd', label: 'Hinweis "zu wenige Namen"', kind: 'error' },
    { id: 'e', label: 'Paare anzeigen', kind: 'end' },
    { id: 'z', label: 'Unerreichbar', kind: 'step' },
    { id: 'b', label: 'Doppelte Kennung', kind: 'step' },
  ],
  edges: [
    { from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'e', label: 'ja' }, { from: 'c', to: 'd', label: 'nein' },
    { from: 'd', to: 'b' }, { from: 'c', to: 'c' }, { from: 'c', to: 'gibtsnicht' }, { from: 'a', to: 'b' },
  ],
};

test('a flow is cleaned: one start, valid links only, unreachable and duplicate nodes dropped', () => {
  const f = cleanFlow(raw);
  assert.deepEqual(f.nodes.map(n => n.id + ':' + n.kind), ['n1:start', 'n2:step', 'n3:decision', 'n4:error', 'n5:end']);
  assert.deepEqual(f.nodes[0].refs, ['FR-001']);
  assert.equal(f.edges.length, 5);
  assert.equal(cleanFlow({ nodes: [{ id: 'a', label: 'x' }], edges: [] }), null);
  assert.equal(cleanFlow(null), null);
});

test('mermaid text is safe: quoted labels, no characters that break the syntax', () => {
  const m = flowMermaid(cleanFlow(raw));
  assert.ok(m.startsWith('flowchart TD\n  n1(["App öffnen"])'));
  assert.ok(m.includes('n3{"Mindestens zwei Namen?"}') && m.includes('n3 -->|"ja"| n5') && m.includes('n4["Hinweis \'zu wenige Namen\'"]'));
  assert.ok(m.includes('class n4 fehler'));
});

test('layout goes top to bottom, jumps back run along the side, nothing overlaps', () => {
  const l = layoutFlow(cleanFlow(raw)), by = Object.fromEntries(l.nodes.map(n => [n.id, n]));
  assert.ok(by.n1.y < by.n2.y && by.n2.y < by.n3.y && by.n3.y < by.n4.y);
  assert.equal(by.n4.y, by.n5.y);
  assert.ok(Math.abs(by.n4.x - by.n5.x) >= by.n4.w);
  assert.deepEqual(l.edges.filter(e => e.back).map(e => e.from + e.to), ['n4n2']);
  assert.ok(l.nodes.every(n => n.x >= 0 && n.x + n.w <= l.width && n.y + n.h <= l.height));
});

test('labels wrap into at most two lines', () => {
  assert.deepEqual(wrapLabel('Namen eingeben'), ['Namen eingeben']);
  const long = wrapLabel('Ergebnis als Text in die Zwischenablage kopieren und im Team teilen');
  assert.equal(long.length, 2); assert.ok(long[1].endsWith('…'));
});

const rawArch = {
  structure: {
    nodes: [
      { id: 'a', label: 'Teamleitung', kind: 'actor' }, { id: 'b', label: 'Namensliste', kind: 'ui', note: 'Namen pflegen' }, { id: 'c', label: 'Ergebnisansicht', kind: 'ui' },
      { id: 'd', label: 'Auslosung', kind: 'logic' }, { id: 'e', label: 'Lokaler Speicher', kind: 'store' }, { id: 'f', label: 'Zwischenablage', kind: 'external' },
    ],
    edges: [{ from: 'a', to: 'b', label: 'pflegt' }, { from: 'b', to: 'd', label: 'startet' }, { from: 'd', to: 'c', label: 'zeigt' }, { from: 'd', to: 'e', label: 'speichert' }, { from: 'c', to: 'f', label: 'kopiert' }, { from: 'b', to: 'c' }, { from: 'c', to: 'b' }],
  },
  data: {
    entities: [{ name: 'Person', attributes: ['Name', 'anwesend', 'Name'] }, { name: 'Runde', attributes: ['Datum'] }, { name: 'Größe (cm)', attributes: [] }, { name: 'person' }],
    relations: [{ from: 'Runde', to: 'Person', kind: 'n:m', label: 'enthält' }, { from: 'Runde', to: 'Unbekannt' }],
  },
};

test('structure and data model are cleaned independently', async () => {
  const { cleanArch } = await import('../diagrams.mjs');
  const a = cleanArch(rawArch);
  assert.equal(a.structure.nodes.length, 6);
  assert.equal(a.structure.edges.length, 6, 'the reverse of an existing link is dropped');
  assert.deepEqual(a.data.entities.map(e => e.name), ['Person', 'Runde', 'Größe (cm)']);
  assert.deepEqual(a.data.entities[0].attributes, ['Name', 'anwesend']);
  assert.equal(a.data.relations.length, 1);
  assert.equal(cleanArch({ structure: { nodes: [], edges: [] }, data: { entities: [{ name: 'A' }] } }), null);
  assert.equal(cleanArch({ data: rawArch.data }).structure, null);
  assert.deepEqual(cleanArch(a), a, 'cleaning a stored model again changes nothing');
});

test('the structure is laid out in layers from users down to data', async () => {
  const { cleanArch, layoutStructure, structureMermaid } = await import('../diagrams.mjs');
  const st = cleanArch(rawArch).structure, l = layoutStructure(st), by = Object.fromEntries(l.nodes.map(n => [n.label, n]));
  assert.deepEqual(l.rows.map(r => r.name), ['Nutzer', 'Oberfläche', 'Logik', 'Daten und Schnittstellen']);
  assert.ok(by.Teamleitung.y < by.Namensliste.y && by.Namensliste.y < by.Auslosung.y && by.Auslosung.y < by['Lokaler Speicher'].y);
  assert.equal(by['Lokaler Speicher'].y, by.Zwischenablage.y);
  assert.ok(l.nodes.every(n => n.x >= 0 && n.x + n.w <= l.width && n.y + n.h <= l.height));
  const m = structureMermaid(st);
  assert.ok(m.includes('subgraph ui["Oberfläche"]') && m.includes('[("Lokaler Speicher")]') && m.includes('-->|"pflegt"|'));
});

test('the data model is laid out without overlap and exported as a valid erDiagram', async () => {
  const { cleanArch, layoutData, dataMermaid } = await import('../diagrams.mjs');
  const d = cleanArch(rawArch).data, l = layoutData(d);
  for (const a of l.entities) for (const b of l.entities) if (a !== b) assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  assert.deepEqual([l.relations[0].ca, l.relations[0].cb], ['n', 'm']);
  const m = dataMermaid(d);
  assert.ok(m.startsWith('erDiagram') && m.includes('Runde }o--o{ Person : "enthält"') && m.includes('Groesse_cm') && m.includes('    string anwesend'));
});

test('nodes of the structure keep valid requirement references only', async () => {
  const { cleanArch } = await import('../diagrams.mjs');
  const a = cleanArch({ structure: { nodes: [{ id: 'a', label: 'Liste', kind: 'ui', refs: ['FR-001', 'FR-001', 'quatsch', 7] }, { id: 'b', label: 'Logik', kind: 'logic' }, { id: 'c', label: 'Speicher', kind: 'store', refs: 'FR-002' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }] } });
  assert.deepEqual(a.structure.nodes.map(n => n.refs), [['FR-001'], [], []]);
});

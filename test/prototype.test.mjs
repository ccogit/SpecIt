import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanProto, protoDocument, protoBrief, protoAccents } from '../prototype.mjs';

const good = '<div class="app"><div class="top"><div class="logo">XY</div><h1>Duo Lotto</h1></div><button class="btn" onclick="go()">Auslosen</button></div>\n<script>function go(){}</script>';

test('only the frame and its script survive: own styles, external files and embedded pages are removed', () => {
  const dirty = '```html\nHier ist der Prototyp:\n<!doctype html><html><head><title>x</title><style>body{color:red}</style><link rel="stylesheet" href="https://x.example/a.css"><meta http-equiv="refresh" content="0"></head><body>'
    + good + '<script src="https://x.example/a.js"></script><iframe src="https://x.example"></iframe></body></html>\n```';
  const c = cleanProto(dirty);
  assert.equal(c.body, good);
  assert.equal(cleanProto('<p>kein Rahmen</p>'), null);
  assert.equal(cleanProto('nur Text'), null);
  assert.equal(cleanProto({ body: good }).body, good, 'a stored prototype is accepted again');
  assert.equal(cleanProto(null), null);
});

test('the document carries the kit, blocks all network access and puts the logo in place', () => {
  const doc = protoDocument(good, { name: 'Duo Lotto', tone: 3 });
  assert.ok(doc.startsWith('<!doctype html>') && doc.includes("default-src 'none'") && doc.includes('--accent:' + protoAccents[3]));
  assert.ok(doc.includes('<div class="logo">DL</div>'), 'initials when no logo is chosen');
  const withLogo = protoDocument(good, { name: 'Duo Lotto', logoSvg: '<svg viewBox="0 0 1 1"></svg>' });
  assert.ok(withLogo.includes('<div class="logo"><svg viewBox="0 0 1 1"></svg></div>') && !withLogo.includes('>XY<'));
  assert.ok(protoDocument(good, { name: '<b>"x"', tone: 99 }).includes('&lt;b&gt;&quot;x&quot; – Prototyp') );
});

test('the brief keeps only the chapters that shape flow and look', () => {
  const spec = '# Titel\n\n## Rahmen\n\nR\n\n## Ziel und Nicht-Ziele\n\nZ\n\n## Kernabläufe und Randfälle\n\nK\n\n## Funktionale Anforderungen\n\nFR-001\n\n## UX und Gestaltung\n\nU\n\n## Abnahme\n\nA';
  const b = protoBrief(spec);
  assert.ok(b.includes('## Ziel und Nicht-Ziele') && b.includes('## Kernabläufe') && b.includes('## UX und Gestaltung'));
  assert.ok(!b.includes('FR-001') && !b.includes('## Rahmen') && !b.includes('## Abnahme'));
  assert.equal(protoBrief('Freitext ohne Kapitel'), 'Freitext ohne Kapitel');
});

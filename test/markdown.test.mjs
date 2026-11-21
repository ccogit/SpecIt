import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, parseInline, withToc, slug } from '../markdown.mjs';
import { demoQuestions, demoSpec, acceptDefault } from '../interview.mjs';

const plain = tokens => tokens.map(t => (t.t === 'text' || t.t === 'code' ? t.v : plain(t.c))).join('');

test('headings, paragraphs, rules and code blocks', () => {
  const blocks = parseMarkdown('# Titel\n\nErste Zeile\nzweite Zeile\n\n---\n\n```js\nconst a = "<b>";\n```\n');
  assert.deepEqual(blocks.map(b => b.type), ['h', 'p', 'hr', 'code']);
  assert.equal(blocks[0].level, 1);
  assert.equal(plain(blocks[1].inline), 'Erste Zeile zweite Zeile');
  assert.equal(blocks[3].text, 'const a = "<b>";');
});
test('nested and ordered lists', () => {
  const blocks = parseMarkdown('- Eins\n  - Kind A\n  - Kind B\n- Zwei\n\n1. Erstens\n2. Zweitens');
  assert.deepEqual(blocks.map(b => b.type), ['ul', 'ol']);
  assert.equal(blocks[0].items.length, 2);
  assert.equal(blocks[0].items[0].children[0].items.length, 2);
  assert.equal(plain(blocks[0].items[0].children[0].items[1].inline), 'Kind B');
  assert.equal(blocks[1].items.length, 2);
});
test('tables and block quotes', () => {
  const blocks = parseMarkdown('| Prio | Anforderung |\n|---|---|\n| Muss | **Auslosung** |\n| Kann | Export |\n\n> Demo: Hinweis\n> zweite Zeile');
  assert.equal(blocks[0].type, 'table');
  assert.equal(blocks[0].head.length, 2);
  assert.equal(blocks[0].rows.length, 2);
  assert.equal(blocks[0].rows[0][1][0].t, 'b');
  assert.equal(blocks[1].type, 'quote');
  assert.equal(plain(blocks[1].blocks[0].inline), 'Demo: Hinweis zweite Zeile');
});
test('inline formatting and safe links', () => {
  const tokens = parseInline('Das ist **fett**, *kursiv*, `code` und [Link](https://example.org).');
  assert.deepEqual(tokens.map(t => t.t), ['text', 'b', 'text', 'i', 'text', 'code', 'text', 'a', 'text']);
  assert.equal(tokens[7].href, 'https://example.org');
  const unsafe = parseInline('[klick](javascript:alert(1)) und snake_case_name bleibt');
  assert.ok(unsafe.every(t => t.t === 'text'));
  assert.ok(plain(unsafe).includes('snake_case_name'));
});
test('table of contents links every section and is rebuilt instead of duplicated', () => {
  const src = '# Titel\n\n> Hinweis\n\n## 1. Ziel & Nicht-Ziele\n\nText\n\n### Unterpunkt\n\n```\n## kein Abschnitt\n```\n\n## Risiken\n\n## Risiken\n';
  const md = withToc(src);
  const toc = md.slice(md.indexOf('## Inhaltsverzeichnis'), md.indexOf('## 1. Ziel'));
  assert.deepEqual(toc.trim().split('\n').slice(2), ['- [1. Ziel & Nicht-Ziele](#1-ziel--nicht-ziele)', '  - [Unterpunkt](#unterpunkt)', '- [Risiken](#risiken)', '- [Risiken](#risiken-1)']);
  assert.ok(md.indexOf('> Hinweis') < md.indexOf('## Inhaltsverzeichnis'), 'stands before the first section, after the intro');
  assert.equal(withToc(md), md, 'idempotent');
  assert.ok(withToc(md.replace('## Risiken\n\n## Risiken', '## Betrieb')).includes('- [Betrieb](#betrieb)'));
  assert.equal(withToc('# Nur Titel\n\nText'), '# Nur Titel\n\nText');
  assert.equal(slug('Qualität & Tests (v2)'), 'qualität--tests-v2');
  const link = parseInline('[Ziel](#ziel)')[0];
  assert.equal(link.t, 'a');
  assert.equal(link.href, '#ziel');
});
test('html in the source stays text', () => {
  const blocks = parseMarkdown('<script>alert(1)</script> und <img src=x onerror=1>');
  assert.equal(blocks[0].type, 'p');
  assert.equal(plain(blocks[0].inline), '<script>alert(1)</script> und <img src=x onerror=1>');
});
test('the demo specification renders as structured document', () => {
  const md = demoSpec('Pair Pressure', 'Kennenlerngespräche auslosen', demoQuestions().map(acceptDefault));
  const blocks = parseMarkdown(md);
  assert.equal(blocks[0].type, 'h');
  assert.equal(blocks[1].type, 'quote');
  assert.ok(blocks.filter(b => b.type === 'h').length >= 8);
  assert.ok(blocks.some(b => b.type === 'ul' && b.items.some(it => it.inline.some(t => t.t === 'i'))), 'assumption marker is emphasised');
});

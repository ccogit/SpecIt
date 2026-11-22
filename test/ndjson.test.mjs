import test from 'node:test';
import assert from 'node:assert/strict';
import { readNdjson } from '../ndjson.mjs';

const encoder = new TextEncoder();
const chunks = parts => new ReadableStream({
  start(controller) {
    for (const part of parts) controller.enqueue(typeof part === 'string' ? encoder.encode(part) : part);
    controller.close();
  },
});

test('NDJSON reader handles split lines, blank lines and final row without a newline', async () => {
  const found = [];
  await readNdjson(chunks(['{"t":"eins"}\n\n{"t":"zw', 'ei"}\n{"done":true}']), row => found.push(row));
  assert.deepEqual(found, [{ t: 'eins' }, { t: 'zwei' }, { done: true }]);
});

test('NDJSON reader preserves UTF-8 characters split across binary chunks', async () => {
  const bytes = encoder.encode('{"t":"Größe"}\n');
  const at = bytes.indexOf(0xc3);
  const found = [];
  await readNdjson(chunks([bytes.slice(0, at + 1), bytes.slice(at + 1)]), row => found.push(row));
  assert.deepEqual(found, [{ t: 'Größe' }]);
});

test('NDJSON reader rejects malformed JSON rather than discarding it', async () => {
  await assert.rejects(readNdjson(chunks(['{"t":', 'oops}\n']), () => {}), /ungültige Streaming-Antwort/);
});

test('NDJSON reader limits an unfinished message', async () => {
  await assert.rejects(readNdjson(chunks(['{"value":"123456789"}']), () => {}, { maxLineChars: 10 }), /zu groß/);
});

test('NDJSON reader rejects missing response streams', async () => {
  await assert.rejects(readNdjson(null, () => {}), /keinen Antwortstrom/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { zip, collect } from '../zip.mjs';

// Liest ein Archiv über das zentrale Verzeichnis zurück: { name: inhalt }
function unzip(buf) {
  const end = buf.length - 22, n = buf.readUInt16LE(end + 10), out = {}; let at = buf.readUInt32LE(end + 16);
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(at + 10), size = buf.readUInt32LE(at + 20), len = buf.readUInt16LE(at + 28), local = buf.readUInt32LE(at + 42);
    const name = buf.toString('utf8', at + 46, at + 46 + len), start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28), body = buf.subarray(start, start + size);
    out[name] = (method === 8 ? inflateRawSync(body) : body).toString('utf8'); at += 46 + len;
  }
  return out;
}

test('an archive contains every file with its content, names in UTF-8', () => {
  const long = 'Zeile\n'.repeat(500);
  assert.deepEqual(unzip(zip([{ name: 'README.md', data: Buffer.from('Hallo') }, { name: 'src/größe.js', data: Buffer.from(long) }])), { 'README.md': 'Hallo', 'src/größe.js': long });
});

test('the target folder is collected without dependencies and version control', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'specit-zip-'));
  fs.mkdirSync(path.join(dir, 'src')); fs.mkdirSync(path.join(dir, 'node_modules', 'x'), { recursive: true }); fs.mkdirSync(path.join(dir, '.git'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<p>'); fs.writeFileSync(path.join(dir, 'src', 'app.js'), '1'); fs.writeFileSync(path.join(dir, 'node_modules', 'x', 'i.js'), '2'); fs.writeFileSync(path.join(dir, '.git', 'HEAD'), '3');
  assert.deepEqual((await collect(dir)).map(f => f.name), ['index.html', 'src/app.js']);
  await assert.rejects(collect(path.join(dir, 'fehlt')), /existiert nicht/);
  await assert.rejects(collect(path.join(dir, '.git', '..', 'node_modules', '..', 'leer-' + Date.now())), /existiert nicht/);
});

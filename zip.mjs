// Übergabe einer direkten Umsetzung: packt den Zielordner als ZIP-Archiv (ohne Abhängigkeit, nur node:zlib).
// Nicht eingepackt wird, was sich wiederherstellen lässt oder nicht zum Ergebnis gehört (node_modules, .git, Build-Ordner).
import { deflateRawSync, crc32 } from 'node:zlib';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const SKIP = new Set(['.git', 'node_modules', '.venv', 'venv', '__pycache__', '.next', '.idea', '.vscode', 'coverage']);
const MAX_FILES = 5000, MAX_BYTES = 300 * 1024 * 1024;

/** Dateien unter dir als [{ name (mit '/'), data, mtime }]; wirft, wenn der Ordner fehlt, leer oder zu groß ist. */
export async function collect(dir) {
  const out = []; let bytes = 0;
  try { if (!(await stat(dir)).isDirectory()) throw 0; } catch { throw Error('Der Zielordner existiert nicht: ' + dir); }
  async function walk(abs, rel) {
    for (const e of (await readdir(abs, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = rel ? rel + '/' + e.name : e.name, full = path.join(abs, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) { if (!SKIP.has(e.name)) await walk(full, name); continue; }
      if (!e.isFile()) continue;
      const info = await stat(full); bytes += info.size;
      if (out.length >= MAX_FILES || bytes > MAX_BYTES) throw Error('Der Zielordner ist für einen Download zu groß (mehr als ' + MAX_FILES + ' Dateien oder 300 MB). Bitte direkt im Ordner öffnen.');
      out.push({ name, data: await readFile(full), mtime: info.mtime });
    }
  }
  await walk(dir, '');
  if (!out.length) throw Error('Im Zielordner liegen noch keine Dateien.');
  return out;
}

/** Baut aus [{ name, data, mtime }] ein ZIP-Archiv (Deflate, Namen in UTF-8). */
export function zip(files) {
  const parts = [], central = []; let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8'), data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(String(f.data), 'utf8');
    const packed = deflateRawSync(data), store = packed.length >= data.length, body = store ? data : packed, crc = crc32(data);
    const d = f.mtime instanceof Date ? f.mtime : new Date(), year = Math.max(1980, d.getFullYear());
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(store ? 0 : 8, 8);
    local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(20, 6); head.writeUInt16LE(0x0800, 8); head.writeUInt16LE(store ? 0 : 8, 10);
    head.writeUInt16LE(time, 12); head.writeUInt16LE(date, 14); head.writeUInt32LE(crc, 16); head.writeUInt32LE(body.length, 20); head.writeUInt32LE(data.length, 24);
    head.writeUInt16LE(name.length, 28); head.writeUInt32LE(offset, 42);
    parts.push(local, name, body); central.push(head, name); offset += 30 + name.length + body.length;
  }
  const dir = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, end]);
}

// Zählt Artefakte in einem Zielordner nach Art (Code, Tests, Doku, Entwürfe, Konfiguration).
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const artifactGroups = [['code', 'Code'], ['tests', 'Tests'], ['docs', 'Dokumentation'],
  ['design', 'UI-Entwürfe'], ['config', 'Konfiguration und Start'], ['other', 'Sonstiges']];

const SKIP = new Set(['.git', 'node_modules', 'dist', 'build', 'out', 'target', '.venv', 'venv',
  '__pycache__', '.next', '.idea', '.vscode', 'coverage']);
const TEST_DIRS = new Set(['test', 'tests', '__tests__', 'spec']);
const DESIGN_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.fig']);
const DOC_EXT = new Set(['.md', '.txt', '.rst', '.adoc']);
const DOC_NAMES = new Set(['license', 'readme', 'changelog']);
const CONFIG_NAMES = new Set(['package.json', 'package-lock.json', 'tsconfig.json', 'dockerfile', 'makefile',
  '.gitignore', '.env.example', 'docker-compose.yml', 'docker-compose.yaml']);
const CONFIG_EXT = new Set(['.json', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.lock', '.sh', '.bat', '.cmd', '.ps1']);
const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.java', '.kt', '.go', '.rs', '.rb',
  '.php', '.cs', '.c', '.h', '.cpp', '.html', '.css', '.scss', '.sql', '.vue', '.svelte', '.swift']);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.tiff']);
const MAX_TEXT = 2 * 1024 * 1024;

// Ordnet eine Datei (relativer Pfad mit '/') einer Gruppe zu.
export function classify(relPath) {
  const parts = String(relPath).split('/').filter(Boolean);
  const name = parts[parts.length - 1] || '';
  const lower = name.toLowerCase();
  const dirs = parts.slice(0, -1);
  const ext = path.extname(lower);
  const base = ext ? lower.slice(0, -ext.length) : lower;
  if (dirs.some((d) => TEST_DIRS.has(d)) || /\.(test|spec)\./.test(lower) || lower.includes('_test.') || lower.startsWith('test_')) return 'tests';
  if (dirs[0] === 'design' || DESIGN_EXT.has(ext)) return 'design';
  if (DOC_EXT.has(ext) || DOC_NAMES.has(base) || dirs.includes('docs')) return 'docs';
  if (CONFIG_NAMES.has(lower) || CONFIG_EXT.has(ext) || name.startsWith('.')) return 'config';
  if (CODE_EXT.has(ext)) return 'code';
  return 'other';
}

// Zeilen einer Textdatei: Anzahl '\n', plus 1 bei fehlendem Zeilenende.
function countLines(buf) {
  if (!buf.length) return 0;
  let n = 0;
  for (const b of buf) if (b === 10) n++;
  return buf[buf.length - 1] === 10 ? n : n + 1;
}

// Zählt rekursiv die Dateien unter dir.
export async function scanArtifacts(dir, { maxFiles = 5000 } = {}) {
  const groups = artifactGroups.map(([key, label]) => ({ key, label, files: 0, lines: 0, words: 0 }));
  const res = { files: 0, lines: 0, words: 0, bytes: 0, truncated: false, groups };
  const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));

  async function walk(abs, rel) {
    let entries;
    try { entries = await readdir(abs, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (res.truncated) return;
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      const childAbs = path.join(abs, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (!SKIP.has(e.name)) await walk(childAbs, childRel);
        continue;
      }
      if (!e.isFile()) continue;
      if (res.files >= maxFiles) { res.truncated = true; return; }
      let size = 0, lines = 0, wordCount = 0;
      try {
        size = (await stat(childAbs)).size;
        if (size <= MAX_TEXT && !IMAGE_EXT.has(path.extname(e.name).toLowerCase())) {
          const buf = await readFile(childAbs);
          if (!buf.subarray(0, 8000).includes(0)) { lines = countLines(buf); wordCount = (buf.toString('utf8').match(/\S+/g) || []).length; }
        }
      } catch { /* nicht lesbar: als Datei ohne Zeilen zählen */ }
      const g = byKey[classify(childRel)];
      g.files++; g.lines += lines; g.words += wordCount;
      res.files++; res.lines += lines; res.words += wordCount; res.bytes += size;
    }
  }

  await walk(dir, '');
  return res;
}

// Kleiner Markdown-Leser für die Ansicht der Spezifikation. Erzeugt einen Baum aus Blöcken und
// Inline-Elementen; der Browser baut daraus DOM-Knoten (nie innerHTML), sodass Inhalte nicht als HTML wirken.
// Unterstützt: Überschriften, Absätze, Listen (verschachtelt), Zitate, Codeblöcke, Tabellen, Trennlinien,
// fett, kursiv, Code, Links.

// Erlaubt sind Web- und Mail-Adressen sowie Sprungmarken innerhalb des Dokuments (#abschnitt).
const safeHref = url => (/^(https?:\/\/|mailto:|#[^\s]+$)/i.test(url) ? url : '');

const plain = tokens => tokens.map(t => (t.t === 'text' || t.t === 'code' ? t.v : plain(t.c))).join('');
/** Sprungmarke einer Überschrift, gebildet wie auf GitHub: klein, ohne Satzzeichen, Leerzeichen als Bindestrich. */
export const slug = text => text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
/** Vergibt Sprungmarken in Dokumentreihenfolge; gleiche Überschriften bekommen -1, -2 … angehängt. */
function slugger() {
  const seen = new Map();
  return text => { const base = slug(text), n = seen.get(base) || 0; seen.set(base, n + 1); return n ? base + '-' + n : base; };
}

const tocTitle = 'Inhaltsverzeichnis';
/**
 * Setzt vor den ersten Abschnitt ein Inhaltsverzeichnis mit Sprungmarken (Überschriften der Ebenen 2 und 3).
 * Ein vorhandenes wird ersetzt, damit es nach Änderungen stimmt. Unter zwei Abschnitten bleibt der Text, wie er ist.
 */
export function withToc(source) {
  const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
  const isHead = l => /^#{1,6}\s+\S/.test(l);
  const old = lines.findIndex(l => new RegExp('^##\\s+' + tocTitle + '\\s*$').test(l));
  if (old >= 0) { let end = old + 1; while (end < lines.length && !isHead(lines[end])) end++; lines.splice(old, end - old); }
  const heads = [];
  let fence = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) { fence = !fence; return; }
    const m = !fence && /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l);
    if (m) heads.push({ i, level: m[1].length, text: plain(parseInline(m[2])) });
  });
  const first = heads.find(h => h.level === 2);
  if (!first || heads.filter(h => h.level === 2).length < 2) return lines.join('\n');
  // Die Marken zählen so, wie sie im fertigen Dokument stehen: das Verzeichnis selbst kommt vor dem ersten Abschnitt.
  const next = slugger();
  const marks = new Map();
  for (const h of heads) { if (h === first) next(tocTitle); marks.set(h, next(h.text)); }
  const items = heads.filter(h => h.level === 2 || h.level === 3)
    .map(h => (h.level === 3 ? '  ' : '') + '- [' + h.text.replace(/[\[\]]/g, '') + '](#' + marks.get(h) + ')');
  lines.splice(first.i, 0, '## ' + tocTitle, '', ...items, '');
  return lines.join('\n');
}

export function parseInline(text) {
  const out = [];
  const push = v => { if (!v) return; const last = out[out.length - 1]; if (last && last.t === 'text') last.v += v; else out.push({ t: 'text', v }); };
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    let m;
    if ((m = /^`([^`]+)`/.exec(rest))) out.push({ t: 'code', v: m[1] });
    else if ((m = /^\*\*(?=\S)([\s\S]*?\S)\*\*/.exec(rest)) || (m = /^__(?=\S)([\s\S]*?\S)__(?!\w)/.exec(rest))) out.push({ t: 'b', c: parseInline(m[1]) });
    else if ((m = /^\*(?=\S)([^*]*?\S)\*(?!\*)/.exec(rest)) || ((i === 0 || /\W/.test(text[i - 1])) && (m = /^_(?=\S)([^_]*?\S)_(?!\w)/.exec(rest)))) out.push({ t: 'i', c: parseInline(m[1]) });
    else if ((m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest))) { const href = safeHref(m[2]); if (href) out.push({ t: 'a', href, c: parseInline(m[1]) }); else push(m[1]); }
    else if ((m = /^\\([\\`*_{}\[\]()#+\-.!|>])/.exec(rest))) push(m[1]);
    else { push(text[i]); i++; continue; }
    i += m[0].length;
  }
  return out;
}

const indentOf = line => /^\s*/.exec(line)[0].replace(/\t/g, '    ').length;
const listMark = line => /^\s*([-*+]|\d{1,9}[.)])\s+(.*)$/.exec(line);
const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => parseInline(c.trim().replace(/\\\|/g, '|')));
const isDivider = line => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes('-');

function parseList(lines, start, indent) {
  const ordered = /\d/.test(listMark(lines[start])[1]);
  const items = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { if (lines[i + 1] !== undefined && (listMark(lines[i + 1]) || indentOf(lines[i + 1]) > indent) && lines[i + 1].trim()) { i++; continue; } break; }
    const m = listMark(line), ind = indentOf(line);
    if (m && ind > indent + 1 && items.length) { const sub = parseList(lines, i, ind); items[items.length - 1].children.push(sub.block); i = sub.next; continue; }
    if (m && ind >= indent - 1 && ind <= indent + 1) { if (/\d/.test(m[1]) !== ordered) break; items.push({ text: m[2], children: [] }); i++; continue; }
    if (!m && ind > indent && items.length) { items[items.length - 1].text += ' ' + line.trim(); i++; continue; }
    break;
  }
  return { block: { type: ordered ? 'ol' : 'ul', items: items.map(it => ({ inline: parseInline(it.text), children: it.children })) }, next: i };
}

export function parseMarkdown(source) {
  const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = /^\s*(```|~~~)/.exec(line))) {
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(m[1])) body.push(lines[i++]);
      i++;
      blocks.push({ type: 'code', text: body.join('\n') });
    } else if ((m = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line))) {
      blocks.push({ type: 'h', level: m[1].length, inline: parseInline(m[2]) });
      i++;
    } else if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
    } else if (/^\s{0,3}>/.test(line)) {
      const body = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) body.push(lines[i++].replace(/^\s{0,3}>\s?/, ''));
      blocks.push({ type: 'quote', blocks: parseMarkdown(body.join('\n')) });
    } else if (line.includes('|') && lines[i + 1] !== undefined && isDivider(lines[i + 1])) {
      const head = cells(line), rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(cells(lines[i++]));
      blocks.push({ type: 'table', head, rows });
    } else if (listMark(line)) {
      const list = parseList(lines, i, indentOf(line));
      blocks.push(list.block);
      i = list.next;
    } else {
      const body = [];
      while (i < lines.length && lines[i].trim() && !/^\s{0,3}(#{1,6}\s|>|```|~~~)/.test(lines[i]) && !listMark(lines[i]) && !(lines[i].includes('|') && lines[i + 1] !== undefined && isDivider(lines[i + 1]))) body.push(lines[i++].trim());
      blocks.push({ type: 'p', inline: parseInline(body.join(' ')) });
    }
  }
  return blocks;
}

const idPrefix = 'sec-';

/** Baut DOM-Knoten aus dem Baum. `doc` ist das Dokument des Browsers. */
export function renderMarkdown(source, doc) {
  const el = (tag, children = []) => { const e = doc.createElement(tag); e.append(...children); return e; };
  const inline = tokens => tokens.map(t => {
    if (t.t === 'text') return doc.createTextNode(t.v);
    if (t.t === 'code') return el('code', [t.v]);
    if (t.t === 'b') return el('strong', inline(t.c));
    if (t.t === 'i') return el('em', inline(t.c));
    const a = el('a', inline(t.c));
    // Sprungmarken zeigen auf die Überschriften dieser Ansicht (Präfix, damit sie keine Elemente der Seite treffen).
    if (t.href.startsWith('#')) { let mark = t.href.slice(1); try { mark = decodeURIComponent(mark); } catch { /* unverändert */ } a.setAttribute('href', '#' + idPrefix + mark); return a; }
    a.href = t.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
    return a;
  });
  const next = slugger();
  const block = b => {
    if (b.type === 'h') { const h = el('h' + Math.min(b.level + 1, 6), inline(b.inline)); h.id = idPrefix + next(plain(b.inline)); return h; } // h1 der Seite bleibt der Seitentitel
    if (b.type === 'p') return el('p', inline(b.inline));
    if (b.type === 'hr') return el('hr');
    if (b.type === 'code') return el('pre', [el('code', [b.text])]);
    if (b.type === 'quote') return el('blockquote', b.blocks.map(block));
    if (b.type === 'table') {
      const row = (cellsOf, tag) => el('tr', cellsOf.map(c => el(tag, inline(c))));
      const wrap = el('div', [el('table', [el('thead', [row(b.head, 'th')]), el('tbody', b.rows.map(r => row(r, 'td')))])]);
      wrap.className = 'tablewrap';
      return wrap;
    }
    return el(b.type, b.items.map(it => el('li', [...inline(it.inline), ...it.children.map(block)])));
  };
  const frag = doc.createDocumentFragment();
  frag.append(...parseMarkdown(source).map(block));
  return frag;
}

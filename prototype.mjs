// Klickbarer Prototyp der spezifizierten Anwendung. SpecIt gibt das Gestaltungs-Gerüst vor (Farben, Karten, Knöpfe, Schalter);
// die KI liefert nur Inhalt und Verhalten mit den vorhandenen Klassen. Ohne Gerüst baut das Modell Korrektes, aber Beliebiges –
// mit Gerüst sieht jedes Ergebnis gepflegt aus und entsteht schneller. Läuft im Browser und in Node – keine Dateizugriffe.

/** Akzentfarbe je Einsatzbereich (0 = verspielt … 4 = förmlich); alle übrigen Töne leitet das Gerüst daraus ab. */
export const protoAccents = ['#c2417a', '#d97014', '#0e7a57', '#1f5fbf', '#22304a'];

/** Das Gerüst: eine Akzentfarbe, daraus abgeleitete Töne, und die Bausteine, die der Prototyp verwenden darf. */
export const protoCss = accent => `
:root{--accent:${accent};--bg:#f4f1ea;--card:#fff;--ink:#17201c;--soft:#5d6a64;--line:#e6e1d6;--accent-ink:#fff;--tint:color-mix(in srgb,var(--accent) 13%,#fff);--deep:color-mix(in srgb,var(--accent) 78%,#000);--warn:#b8540a;--shadow:0 1px 2px rgba(20,30,25,.06),0 12px 32px -12px rgba(20,30,25,.18)}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 "Segoe UI",system-ui,sans-serif;color:var(--ink);background:radial-gradient(1200px 600px at 80% -10%,color-mix(in srgb,var(--accent) 16%,#fff) 0,transparent 60%),var(--bg);min-height:100vh}
.app{max-width:1040px;margin:0 auto;padding:28px 24px 48px}
.top{display:flex;align-items:center;gap:14px;margin-bottom:26px}.logo{width:44px;height:44px;border-radius:12px;background:var(--accent);display:grid;place-items:center;color:#fff;font-weight:800;box-shadow:var(--shadow);overflow:hidden;flex-shrink:0}.logo svg{width:100%;height:100%;display:block}
.top h1{font-size:22px;margin:0;letter-spacing:-.02em}.top p{margin:0;color:var(--soft);font-size:13px}.spacer{flex:1}
.tabs{display:inline-flex;gap:4px;padding:4px;border-radius:12px;background:color-mix(in srgb,var(--ink) 6%,transparent)}.tab{font:inherit;font-weight:600;font-size:13px;border:0;border-radius:9px;padding:7px 14px;background:transparent;color:var(--soft);cursor:pointer}.tab.on{background:var(--card);color:var(--ink);box-shadow:var(--shadow)}
.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:18px}.col-4{grid-column:span 4}.col-5{grid-column:span 5}.col-6{grid-column:span 6}.col-7{grid-column:span 7}.col-8{grid-column:span 8}.col-12{grid-column:span 12}
@media(max-width:760px){.grid>*{grid-column:span 12}}
.card{background:var(--card);border-radius:18px;padding:20px 22px;box-shadow:var(--shadow);border:1px solid var(--line)}
.card h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--soft);margin:0;font-weight:700}
.card>*+*{margin-top:14px}.card>h2+*{margin-top:12px}.stack>*{margin:0}
.hero{background:linear-gradient(135deg,var(--accent),var(--deep));color:#fff;border:0;padding:24px 26px}.hero h2{color:rgba(255,255,255,.78)}.hero .big{font-size:38px;font-weight:800;letter-spacing:-.03em;line-height:1.15}.hero>h2+.big{margin-top:6px}.hero .muted{color:rgba(255,255,255,.85)}
.hero .bar{height:6px;background:rgba(255,255,255,.22)}.hero .bar>i{background:#fff}.hero .row{gap:10px 12px;flex-wrap:wrap}.hero label{color:#fff}.hero .toggle{background:rgba(255,255,255,.3)}.hero .toggle:checked{background:#fff}.hero .toggle:checked::after{background:var(--accent)}
.btn{font:inherit;font-weight:700;border:0;border-radius:12px;padding:11px 18px;background:var(--accent);color:var(--accent-ink);cursor:pointer;transition:transform .12s,box-shadow .12s;box-shadow:0 6px 16px -6px var(--accent)}.btn:hover{transform:translateY(-1px)}.btn:active{transform:none}.btn:disabled{opacity:.45;cursor:default;transform:none}
.btn.ghost{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--line)}.btn.light{background:#fff;color:var(--accent);box-shadow:none}
.hero .btn{background:#fff;color:var(--deep);box-shadow:0 6px 16px -8px rgba(0,0,0,.45)}.hero .btn.ghost,.hero .btn+.btn{background:transparent;color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.5)}.btn.small{padding:6px 12px;font-size:13px;border-radius:9px}
.field{width:100%;font:inherit;padding:11px 14px;border-radius:12px;border:1.5px solid var(--line);background:#fff;color:var(--ink);outline:none}.field:focus{border-color:var(--accent);box-shadow:0 0 0 4px var(--tint)}textarea.field{resize:vertical;min-height:72px}
.row{display:flex;align-items:center;gap:10px}.row.wrap{flex-wrap:wrap}.grow{flex:1;min-width:0}.stack{display:flex;flex-direction:column;gap:12px}
.list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}.item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;background:#faf8f3;transition:background .15s}.item:hover{background:var(--tint)}.item.off{opacity:.45}
.avatar{width:32px;height:32px;border-radius:50%;background:var(--tint);color:var(--accent);display:grid;place-items:center;font-weight:800;font-size:13px;flex-shrink:0}
.chip{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;background:var(--tint);color:var(--accent);font-size:12px;font-weight:700}.chip.warn{background:#fdebd8;color:var(--warn)}.hero .chip{background:rgba(255,255,255,.18);color:#fff}
.pair{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:14px;background:#faf8f3;border:1px solid var(--line);animation:pop .35s both}.pair b{font-size:16px}.pair small{color:var(--soft);display:block}
@keyframes pop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
.stat{font-size:28px;font-weight:800;letter-spacing:-.02em}.muted{color:var(--soft);font-size:13px}.empty{padding:26px;text-align:center;color:var(--soft);border:1.5px dashed var(--line);border-radius:14px}
.table{width:100%;border-collapse:collapse;font-size:14px}.table th{text-align:left;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--soft);padding:8px 10px;border-bottom:1.5px solid var(--line)}.table td{padding:10px;border-bottom:1px solid var(--line)}
.bar{height:8px;border-radius:999px;background:var(--tint);overflow:hidden}.bar>i{display:block;height:100%;background:var(--accent);border-radius:999px}
.toggle{appearance:none;width:38px;height:22px;border-radius:999px;background:#d8d3c7;position:relative;cursor:pointer;transition:background .15s;flex-shrink:0;margin:0}.toggle::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}.toggle:checked{background:var(--accent)}.toggle:checked::after{left:19px}
.hidden{display:none!important}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:#fff;padding:10px 18px;border-radius:12px;box-shadow:var(--shadow);opacity:0;transition:opacity .2s;pointer-events:none}.toast.on{opacity:1}`;

/** Anweisung an die KI: Inhalt und Verhalten mit den vorhandenen Bausteinen. */
export const protoPrompt = 'Baue einen klickbaren Prototyp der Anwendung aus den Projektdaten (name, spec = die Kapitel der Spezifikation, die Ablauf und Gestaltung bestimmen). '
  + 'Das Gestaltungs-Gerüst steht fest: Verwende ausschließlich die folgenden CSS-Klassen, schreibe KEIN eigenes CSS und keine style-Attribute (außer für Breiten in Prozent). '
  + 'Klassen: .app (Rahmen); .top mit .logo, h1, p und .spacer; .tabs mit .tab (.on) für zwei bis vier Bereiche; .grid mit .col-4/.col-5/.col-6/.col-7/.col-8/.col-12; .card (h2 als Kartentitel), .card.hero mit .big; '
  + '.btn (.ghost, .light, .small); .field (auch textarea); .row (.wrap), .grow, .stack; .list mit .item (.off) und .avatar; .chip (.warn); .pair (b, small); .stat; .muted; .empty; .table; .bar mit <i style="width:…%">; .toggle (Checkbox); .hidden; .toast (.on). '
  + 'Liefere NUR <div class="app">…</div> und danach ein <script>…</script> – kein <html>, <head>, <style>, keine externen Dateien. '
  + 'Der Kernablauf ist wirklich bedienbar, mit sinnvollen Beispieldaten im Speicher; kein Netzwerk, kein localStorage. '
  + 'Oben steht .top mit <div class="logo"></div> (leer lassen – das Logo setzt SpecIt ein), dem Namen als h1 und einem kurzen Satz. '
  + 'Die erste Karte ist eine .card.hero mit einer großen Zahl oder Aussage (.big) und genau einer Hauptaktion; höchstens eine Nebenaktion daneben, alle weiteren Aktionen und Schalter gehören in die Karten darunter. '
  + 'Hat die Anwendung mehrere Bereiche, schalten .tabs zwischen ihnen um (per .hidden). Begriffe und Anrede aus der Spezifikation, Texte auf Deutsch. '
  + 'Zeige den Kernablauf und zwei bis drei wichtige Erweiterungen; keine Erklärtexte über den Prototyp selbst. Kompakt: höchstens 130 Zeilen. '
  + 'Schreibe sofort los, ohne Vorüberlegung: Das erste Zeichen deiner Antwort ist „<“.';

/** Die Kapitel der Spezifikation, die Ablauf und Aussehen bestimmen – weniger Eingabe, schnellere Antwort. */
export function protoBrief(spec) {
  const lines = String(spec || '').replace(/\r\n?/g, '\n').split('\n'), out = [];
  for (const re of [/^## Ziel und Nicht-Ziele/, /^## Nutzer und Rollen/, /^## Kernabläufe/, /^## UX und Gestaltung/, /^## Umfang/]) {
    const at = lines.findIndex(l => re.test(l)); if (at < 0) continue;
    let end = at + 1; while (end < lines.length && !/^## /.test(lines[end])) end++;
    out.push(lines.slice(at, end).join('\n').trim());
  }
  return (out.length >= 2 ? out.join('\n\n') : lines.join('\n')).slice(0, 14000);
}

/**
 * Prüft die Lieferung der KI: nur der Rahmen und das Skript bleiben. Eigenes CSS, eingebundene Dateien und eingebettete Seiten
 * fallen weg. Liefert { body } oder null. (Angezeigt wird der Prototyp ohnehin abgeschottet – siehe protoDocument.)
 */
export function cleanProto(raw) {
  let html = typeof raw === 'string' ? raw : raw && typeof raw.body === 'string' ? raw.body : '';
  html = html.replace(/^\s*```(?:html)?\s*/i, '').replace(/\s*```\s*$/, '');
  const at = html.indexOf('<'); if (at < 0) return null;
  html = html.slice(at)
    .replace(/<!doctype[^>]*>/gi, '').replace(/<\/?(?:html|head|body)\b[^>]*>/gi, '').replace(/<title\b[\s\S]*?<\/title>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<script\b[^>]*\bsrc\s*=[^>]*>\s*<\/script>/gi, '')
    .replace(/<(?:link|meta|base)\b[^>]*>/gi, '').replace(/<(iframe|object|embed|frame|frameset)\b[\s\S]*?(?:<\/\1>|\/>)/gi, '').trim();
  if (!/<div\b[^>]*class\s*=\s*["'][^"']*\bapp\b/i.test(html) || html.length > 80000) return null;
  return { body: html };
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const initials = name => (String(name || '').match(/\p{L}+/gu) || ['A']).slice(0, 2).map(w => w[0].toUpperCase()).join('');

/**
 * Baut das vollständige Dokument: Gerüst, gewähltes Logo (oder die Anfangsbuchstaben) und der gelieferte Inhalt. Die eigene
 * Richtlinie im Dokument sperrt jeden Netzzugriff; angezeigt wird es in einem abgeschotteten Rahmen (sandbox ohne same-origin).
 */
export function protoDocument(body, { name = '', logoSvg = '', tone = 2 } = {}) {
  const accent = protoAccents[Number.isInteger(tone) && tone >= 0 && tone < protoAccents.length ? tone : 2];
  const mark = logoSvg || esc(initials(name));
  // das erste .logo-Element bekommt das Logo; fehlt es, bleibt der Inhalt, wie er ist
  const filled = body.replace(/(<div\b[^>]*class\s*=\s*["'][^"']*\blogo\b[^"']*["'][^>]*>)[\s\S]*?(<\/div>)/i, (m, a, b) => a + mark + b);
  return '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; img-src data:">'
    + '<title>' + esc(name || 'Prototyp') + ' – Prototyp</title><style>' + protoCss(accent) + (logoSvg ? '.logo{background:none;box-shadow:none}' : '') + '</style></head><body>' + filled + '</body></html>';
}

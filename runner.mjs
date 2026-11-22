// Startet die Umsetzung eines Plans über das lokal installierte Claude Code: ein Agent mit dem Gesamtauftrag
// oder mehrere Agenten, die die Teilaufträge entlang ihrer Abhängigkeiten parallel abarbeiten.
// Die Agenten arbeiten ausschließlich im angegebenen Zielordner und dürfen Dateien lesen und schreiben;
// Befehle (Tests, Build) nur, wenn das ausdrücklich erlaubt wurde.
import { spawn } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePlan, renderTask, renderSingle } from './planner.mjs';
import { MAX_SPEC_CHARS } from './limits.mjs';
import './agentskill.mjs';
import { cleanSelections } from './reuse.mjs';
import { isFileName, downloadFile } from './stitch.mjs';
import { scanArtifacts } from './artifacts.mjs';
import { factor, record, rawSum } from './calibration.mjs';
import { cleanSvg } from './interview.mjs';

const own = path.resolve(fileURLToPath(new URL('.', import.meta.url)));
const model = process.env.SPECIT_AGENT_MODEL || '';
// Für den laufenden Auftrag gewähltes Modell (mit Version); leer = Voreinstellung
let runModel = '';
const limit = (Number(process.env.SPECIT_AGENT_TIMEOUT_MIN) || 120) * 60000;
export const maxAgents = 6;
let job = null;

/** Prüft die Anfrage; wirft bei ungültigen Angaben. */
/** Prüft einen Zielordner (vollständiger Pfad, kein Laufwerk, nicht der SpecIt-Ordner) und liefert ihn bereinigt. */
export function targetDir(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 400) throw Error('Bitte einen Zielordner angeben.');
  const dir = path.resolve(value.trim());
  if (!path.isAbsolute(value.trim())) throw Error('Bitte den Zielordner als vollständigen Pfad angeben.');
  if (dir === path.parse(dir).root) throw Error('Ein Laufwerk selbst ist als Zielordner nicht zulässig.');
  const inside = (a, base) => { const rel = path.relative(base, a); return !rel || (!rel.startsWith('..') && !path.isAbsolute(rel)); };
  if (inside(dir, own) || inside(own, dir)) throw Error('Der Zielordner darf nicht der SpecIt-Ordner sein oder ihn enthalten.');
  return dir;
}

/** Öffnet den Zielordner im Dateimanager des Rechners. */
export async function openDir(value) {
  const dir = targetDir(value);
  try { if (!(await stat(dir)).isDirectory()) throw 0; } catch { throw Error('Der Zielordner existiert nicht: ' + dir); }
  const cmd = process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, [dir], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  return { dir };
}

export function validateRun(b) {
  const dir = targetDir(b && b.dir);
  if (typeof b.spec !== 'string' || !b.spec.trim() || b.spec.length > MAX_SPEC_CHARS) throw Error('Spezifikation fehlt oder zu lang.');
  const agents = Number.isInteger(b.agents) ? Math.min(maxAgents, Math.max(1, b.agents)) : 1;
  return { dir, agents, featRaw: Number.isFinite(b.featRaw) && b.featRaw > 0 ? Math.min(100000, b.featRaw) : 0, logo: typeof b.logo === 'string' && b.logo.length <= 40000 ? cleanSvg(b.logo) : '', layoutHtmls: (Array.isArray(b.layoutHtmls) ? b.layoutHtmls : []).filter(isFileName).slice(0, 4), shell: b.shell === true, model: /^claude-[a-z0-9-]{3,40}$/.test(b.model || '') ? b.model : '', spec: b.spec, plan: validatePlan(b.plan), context: { repo: String(b.repo || '').slice(0, 500), agent: 'Claude Code', reuse: cleanSelections(b.reuse), ...(typeof b.layoutChoice === 'string' && b.layoutChoice.trim() ? { layoutChoice: b.layoutChoice.trim().slice(0, 200) } : {}), ...(typeof b.layoutUrl === 'string' && b.layoutUrl.startsWith('https://stitch.withgoogle.com/projects/') ? { layoutUrl: b.layoutUrl } : {}) } };
}

const runNotes = (many, shell) => '\n\n## Hinweise für diesen automatischen Lauf\n'
  + '- Es kann nicht rückgefragt werden. Triff bei offenen Entscheidungen eine begründete Annahme und halte sie in der Datei ANNAHMEN.md fest.\n'
  + '- Arbeite ausschließlich im aktuellen Ordner.\n'
  + (many ? '- Weitere Agenten arbeiten gleichzeitig im selben Ordner an anderen Aufträgen. Ändere nur Dateien deines Umfangs, lies vorhandene Dateien vor dem Schreiben erneut und überschreibe keine fremden Änderungen.\n' : '')
  + (shell ? '- Führe die Tests aus und berichte das tatsächliche Ergebnis.\n' : '- Du kannst keine Befehle ausführen. Schreibe Code und Tests und beschreibe im Abschlussbericht, wie sie zu starten sind; behaupte keine Testergebnisse.\n')
  + '- Schließe mit einem kurzen Bericht: was umgesetzt ist, welche Dateien, was offen bleibt.';

function agent(prompt, dir, shell, children) {
  return new Promise(resolve => {
    const tools = ['Read', 'Glob', 'Grep', 'Edit', 'Write', ...(shell ? ['Bash'] : [])];
    const args = ['-p', '--output-format', 'json', '--tools', tools.join(','), '--permission-mode', 'acceptEdits', ...(shell ? ['--allowedTools', 'Bash'] : []),
      '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence', ...((runModel || model) ? ['--model', runModel || model] : [])];
    let out = '', done = false;
    const finish = v => { if (done) return; done = true; clearTimeout(timer); children.delete(child); resolve(v); };
    const child = spawn('claude', args, { cwd: dir, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    children.add(child);
    const timer = setTimeout(() => { child.kill(); finish({ ok: false, note: 'Zeitgrenze erreicht.' }); }, limit);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', c => { if (out.length < 4000000) out += c; });
    child.on('error', () => finish({ ok: false, note: 'Claude Code konnte nicht gestartet werden.' }));
    child.on('close', code => {
      let r = null; try { r = JSON.parse(out); } catch { /* kein JSON */ }
      const text = r && typeof r.result === 'string' ? r.result.trim() : '';
      finish({ ok: code === 0 && !!r && !r.is_error, note: (text || 'Kein Bericht erhalten. Anmeldung und Kontingent von Claude Code prüfen.').slice(0, 6000) });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(prompt);
  });
}

/** Startet den Lauf; es läuft höchstens einer. */
export async function startRun(r) {
  if (job && !job.ended) throw Error('Es läuft bereits eine Umsetzung.');
  await mkdir(r.dir, { recursive: true });
  runModel = r.model || '';
  if (!(await stat(r.dir)).isDirectory()) throw Error('Der Zielordner ist kein Ordner.');
  // Den gewählten Stitch-Entwurf als Datei in den Zielordner legen, damit die Agenten ihn lesen können
  if (r.layoutHtmls.length) {
    const files = [];
    for (const [i, name] of r.layoutHtmls.entries()) {
      try {
        const file = await downloadFile(name), target = r.layoutHtmls.length === 1 ? 'layout.html' : 'layout-' + (i + 1) + '.html';
        await mkdir(path.join(r.dir, 'design'), { recursive: true });
        await writeFile(path.join(r.dir, 'design', target), file.body);
        files.push('design/' + target);
      } catch { /* der Entwurf bleibt über den Link erreichbar */ }
    }
    if (files.length) r.context.layoutFile = files.join(', ');
  }
  // Das gewählte Logo liegt als Datei im Zielordner; die Aufträge verweisen darauf
  if (r.logo) {
    try { await mkdir(path.join(r.dir, 'design'), { recursive: true }); await writeFile(path.join(r.dir, 'design', 'logo.svg'), r.logo); r.context.logoFile = 'design/logo.svg'; } catch { /* ohne Logo-Datei weiter */ }
  }
  // est = Schätzung der KI je Auftrag in Minuten (unskaliert): Am Ende des Laufs wird sie mit der gemessenen Laufzeit verglichen
  const many = r.agents > 1, planFactor = factor('plan');
  const items = many
    ? r.plan.waves.flat().map(id => r.plan.tasks.find(t => t.id === id)).map(t => ({ id: t.id, title: t.title, est: rawSum([t], planFactor), deps: t.dependsOn, prompt: renderTask(t, r.plan, r.spec, r.context) }))
    : [{ id: 'Gesamt', title: 'Gesamtauftrag · ' + r.plan.tasks.length + ' Arbeitsschritte', est: rawSum(r.plan.tasks, planFactor), deps: [], prompt: renderSingle(r.plan, r.spec, r.context) }];
  for (const it of items) Object.assign(it, { state: 'waiting', agent: 0, started: 0, ended: 0, note: '', prompt: it.prompt + runNotes(many, r.shell) });
  const j = job = { dir: r.dir, agents: r.agents, shell: r.shell, items, started: Date.now(), ended: 0, stopped: false, children: new Set() };
  const state = id => items.find(x => x.id === id).state;
  const step = () => {
    if (j.ended) return;
    for (const it of items) {
      if (it.state !== 'waiting') continue;
      if (j.stopped) { it.state = 'stopped'; continue; }
      // Scheitert ein Vorgänger, wird der Auftrag nicht mehr begonnen.
      if (it.deps.some(d => ['failed', 'skipped', 'stopped'].includes(state(d)))) { it.state = 'skipped'; it.note = 'Nicht begonnen, weil ein Vorgänger nicht abgeschlossen wurde.'; continue; }
      if (items.filter(x => x.state === 'running').length >= j.agents || !it.deps.every(d => state(d) === 'done')) continue;
      // Der Auftrag bekommt den niedrigsten freien Platz: So zeigt die Oberfläche, welcher Agent woran arbeitet
      it.agent = freeAgent(items, j.agents); it.state = 'running'; it.started = Date.now();
      agent(it.prompt, j.dir, j.shell, j.children).then(res => {
        it.ended = Date.now(); it.note = res.note;
        it.state = j.stopped ? 'stopped' : res.ok ? 'done' : 'failed';
        scanArtifacts(j.dir).then(o => { j.output = o; }, () => {});
        step();
      });
    }
    if (!items.some(x => x.state === 'running' || x.state === 'waiting')) { j.ended = Date.now(); calibrate(j, r.featRaw); }
  };
  step();
  return runStatus();
}

// Nach dem Lauf: Schätzung und gemessene Agentenlaufzeit der abgeschlossenen Aufträge festhalten (nicht bei gestoppten Läufen).
// Die Feature-Schätzung zählt nur, wenn alles fertig wurde – sonst stünde ihr nur ein Teil der Arbeit gegenüber.
function calibrate(j, featRaw) {
  if (j.stopped) return;
  const done = j.items.filter(x => x.state === 'done'), real = done.reduce((n, x) => n + (x.ended - x.started) / 60000, 0), est = done.reduce((n, x) => n + x.est, 0);
  if (!done.length || !(real > 0)) return;
  record('plan', est, real);
  if (featRaw > 0 && done.length === j.items.length) record('feat', featRaw, real);
}

/** Niedrigster Agenten-Platz (1 … n), auf dem gerade kein Auftrag läuft. */
export function freeAgent(items, agents) {
  const busy = new Set(items.filter(x => x.state === 'running').map(x => x.agent));
  for (let n = 1; n <= agents; n++) if (!busy.has(n)) return n;
  return 1;
}

export function stopRun() {
  if (job && !job.ended) { job.stopped = true; for (const c of job.children) c.kill(); for (const it of job.items) if (it.state === 'waiting') it.state = 'stopped'; }
  return runStatus();
}

/** Beim Beenden des Servers: laufende Agenten nicht verwaist zurücklassen. */
export function killAgents() { if (job) for (const c of job.children) c.kill(); }

export function runStatus() {
  if (!job) return { active: false, items: [] };
  const now = Date.now();
  return { active: !job.ended, output: job.output || null, dir: job.dir, agents: job.agents, shell: job.shell, stopped: job.stopped, seconds: Math.round(((job.ended || now) - job.started) / 1000),
    items: job.items.map(it => ({ id: it.id, title: it.title, state: it.state, agent: it.agent, from: it.started ? Math.round((it.started - job.started) / 1000) : 0,
      waitsFor: it.state === 'waiting' ? it.deps.filter(d => job.items.find(x => x.id === d)?.state !== 'done') : [], seconds: it.started ? Math.round(((it.ended || now) - it.started) / 1000) : 0, note: it.note })) };
}

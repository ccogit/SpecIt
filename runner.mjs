// Startet die Umsetzung eines Plans über das lokal installierte Claude Code: ein Agent mit dem Gesamtauftrag
// oder mehrere Agenten, die die Teilaufträge entlang ihrer Abhängigkeiten parallel abarbeiten.
// Die Agenten arbeiten ausschließlich im angegebenen Zielordner und dürfen Dateien lesen und schreiben;
// Befehle (Tests, Build) nur, wenn das ausdrücklich erlaubt wurde.
import { spawn } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePlan, renderTask, renderSingle } from './planner.mjs';
import { cleanSelections } from './reuse.mjs';
import { isFileName, downloadFile } from './stitch.mjs';

const own = path.resolve(fileURLToPath(new URL('.', import.meta.url)));
const model = process.env.SPECIT_AGENT_MODEL || '';
const limit = (Number(process.env.SPECIT_AGENT_TIMEOUT_MIN) || 120) * 60000;
export const maxAgents = 6;
let job = null;

/** Prüft die Anfrage; wirft bei ungültigen Angaben. */
export function validateRun(b) {
  if (!b || typeof b.dir !== 'string' || !b.dir.trim() || b.dir.length > 400) throw Error('Bitte einen Zielordner angeben.');
  const dir = path.resolve(b.dir.trim());
  if (!path.isAbsolute(b.dir.trim())) throw Error('Bitte den Zielordner als vollständigen Pfad angeben.');
  if (dir === path.parse(dir).root) throw Error('Ein Laufwerk selbst ist als Zielordner nicht zulässig.');
  const inside = (a, base) => { const rel = path.relative(base, a); return !rel || (!rel.startsWith('..') && !path.isAbsolute(rel)); };
  if (inside(dir, own) || inside(own, dir)) throw Error('Der Zielordner darf nicht der SpecIt-Ordner sein oder ihn enthalten.');
  if (typeof b.spec !== 'string' || !b.spec.trim() || b.spec.length > 50000) throw Error('Spezifikation fehlt oder zu lang.');
  const agents = Number.isInteger(b.agents) ? Math.min(maxAgents, Math.max(1, b.agents)) : 1;
  return { dir, agents, layoutHtmls: (Array.isArray(b.layoutHtmls) ? b.layoutHtmls : []).filter(isFileName).slice(0, 4), shell: b.shell === true, spec: b.spec, plan: validatePlan(b.plan), context: { repo: String(b.repo || '').slice(0, 500), agent: 'Claude Code', reuse: cleanSelections(b.reuse), ...(typeof b.layoutChoice === 'string' && b.layoutChoice.trim() ? { layoutChoice: b.layoutChoice.trim().slice(0, 200) } : {}), ...(typeof b.layoutUrl === 'string' && b.layoutUrl.startsWith('https://stitch.withgoogle.com/projects/') ? { layoutUrl: b.layoutUrl } : {}) } };
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
      '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence', ...(model ? ['--model', model] : [])];
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
  const many = r.agents > 1;
  const items = many
    ? r.plan.waves.flat().map(id => r.plan.tasks.find(t => t.id === id)).map(t => ({ id: t.id, title: t.title, deps: t.dependsOn, prompt: renderTask(t, r.plan, r.spec, r.context) }))
    : [{ id: 'Gesamt', title: 'Gesamtauftrag · ' + r.plan.tasks.length + ' Arbeitsschritte', deps: [], prompt: renderSingle(r.plan, r.spec, r.context) }];
  for (const it of items) Object.assign(it, { state: 'waiting', started: 0, ended: 0, note: '', prompt: it.prompt + runNotes(many, r.shell) });
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
      it.state = 'running'; it.started = Date.now();
      agent(it.prompt, j.dir, j.shell, j.children).then(res => {
        it.ended = Date.now(); it.note = res.note;
        it.state = j.stopped ? 'stopped' : res.ok ? 'done' : 'failed';
        step();
      });
    }
    if (!items.some(x => x.state === 'running' || x.state === 'waiting')) j.ended = Date.now();
  };
  step();
  return runStatus();
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
  return { active: !job.ended, dir: job.dir, agents: job.agents, shell: job.shell, stopped: job.stopped, seconds: Math.round(((job.ended || now) - job.started) / 1000),
    items: job.items.map(it => ({ id: it.id, title: it.title, state: it.state, seconds: it.started ? Math.round(((it.ended || now) - it.started) / 1000) : 0, note: it.note })) };
}

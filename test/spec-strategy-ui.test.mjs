import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.mjs', import.meta.url), 'utf8');
const baseCss = readFileSync(new URL('../public/base.css', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/responsive.css', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');

test('all generation strategies are visible in the SpecIt UI and forwarded with the request', () => {
  for (const name of ['classic', 'incremental', 'preload', 'structured', 'parallel', 'turbo', 'gpu'])
    assert.match(html, new RegExp('<option value="' + name + '">'));
  assert.match(app, /strategy:s\.specStrategy/);
  assert.match(app, /specStrategy:'incremental'/);
  assert.match(app, /s\.specStrategy==='incremental'&&s\.spec\.trim\(\)/);
  assert.match(app, /spec\/preload/);
  assert.match(app, /preloadToken:preloadSession/);
});

test('the browser app is a separately served syntax-valid ES module', () => {
  assert.match(html, /<script type="module" src="\/app\.mjs"><\/script>/);
  assert.match(server, /'\/app\.mjs':await readFile/);
  assert.doesNotMatch(html, /<script type="module">/);
  const script = fileURLToPath(new URL('../public/app.mjs', import.meta.url));
  const run = spawnSync(process.execPath, ['--check', script], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});

test('responsive stylesheet is served and the mobile cancel action stays visible', () => {
  assert.match(html, /href="\/base\.css"/);
  assert.match(server, /'\/base\.css':await readFile/);
  assert.match(baseCss, /:root\s*\{/);
  assert.match(baseCss, /@media print/);
  assert.doesNotMatch(html, /<style>/);
  assert.match(html, /href="\/responsive\.css"/);
  assert.match(server, /'\/responsive\.css':await readFile/);
  assert.match(css, /\.top \.working \.workstop\s*\{[\s\S]*display:inline-flex!important/);
  assert.match(html, /id="reset"[^>]+aria-label=/);
  assert.match(html, /id="setToggle"[^>]+aria-label=/);
});

test('all resettable async requests use scoped locking and a cancellable work session', () => {
  assert.match(app, /function cancelSessionWork\(\)/);
  assert.match(app, /workSession\.invalidate\(\)/);
  assert.match(app, /const requestSignal=workSession\.combine/);
  assert.match(app, /const lockId=lock\(true,/);
  assert.match(app, /lock\(false,undefined,lockId\)/);
  assert.match(app, /if\(runBusy\|\|runStarting\)/);
});

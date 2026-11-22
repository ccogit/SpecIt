import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

process.env.SPECIT_CALIBRATION = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'specit-cal-')), 'calibration.json');
const { factorOf, learn, scale, rawSum, cleanMinutes, record, factor, info } = await import('../calibration.mjs');
const { validatePlan, demoPlan } = await import('../planner.mjs');
const { cleanFeatures } = await import('../interview.mjs');

test('without measured runs the estimate stays as it is', () => {
  assert.equal(factorOf({}, 'plan'), 1);
  assert.equal(factor('plan'), 1);
});

test('the factor is measured over estimated, newer runs weigh more, outliers are capped', () => {
  let c = learn({}, 'plan', 60, 6);
  assert.equal(factorOf(c, 'plan'), 0.1);
  assert.equal(factorOf(c, 'feat'), 1);
  c = learn(c, 'plan', 10, 10);
  assert.ok(factorOf(c, 'plan') > 0.25 && factorOf(c, 'plan') < 0.35);
  assert.equal(factorOf(learn({}, 'plan', 1000, 0.01), 'plan'), 0.02);
  assert.deepEqual(learn(c, 'plan', 0, 5), c);
});

test('scaling keeps the model value as raw and never rounds short tasks up to a minute', () => {
  const [a, b] = scale([{ minutes: 5, lean: { note: 'x', minutes: 2 } }, { minutes: 0.3 }], 0.1);
  assert.deepEqual([a.raw, a.minutes, a.lean.minutes], [5, 0.5, 0.2]);
  assert.deepEqual([b.raw, b.minutes], [0.3, 0.05]);
  assert.equal(rawSum([a, b], 0.1), 5.3);
  assert.equal(rawSum([{ minutes: 0.5 }], 0.1), 5);
  assert.equal(cleanMinutes(0.004, 9), 0.05);
});

test('plans and features keep fractional minutes and the raw value through validation', () => {
  const p = demoPlan('Eine Spezifikation'), scaled = { ...p, tasks: scale(p.tasks, 0.1) }, v = validatePlan(scaled);
  assert.ok(v.tasks.every((t, i) => t.raw === p.tasks[i].minutes && t.minutes < t.raw));
  const [f] = cleanFeatures([{ name: 'A', minutes: 0.4, raw: 4, core: true }]);
  assert.deepEqual([f.minutes, f.raw], [0.4, 4]);
});

test('a recorded run is stored and changes the factor', () => {
  record('plan', 30, 3);
  assert.equal(factor('plan'), 0.1);
  assert.deepEqual(info().plan, { factor: 0.1, runs: 1 });
});

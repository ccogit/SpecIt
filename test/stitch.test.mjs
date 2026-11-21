import test from 'node:test';
import assert from 'node:assert/strict';
import { screensFrom, layoutPrompt, variantCount, device, isFileName, isProjectId, projectUrl } from '../stitch.mjs';

const screen = (id, extra = {}) => ({ id, title: 'Layout ' + id, screenshot: { name: 'projects/123456789/files/' + id }, htmlCode: { name: 'projects/123456789/files/' + id + 'ff' }, width: 1280, height: 900, ...extra });

test('screens are read from generation output and deduplicated', () => {
  const data = { outputComponents: [{ text: 'Hinweis' }, { design: { screens: [screen('aaaaaaaa'), screen('aaaaaaaa'), screen('bbbbbbbb')] } }] };
  const screens = screensFrom(data);
  assert.deepEqual(screens.map(s => s.id), ['aaaaaaaa', 'bbbbbbbb']);
  assert.equal(screens[0].image, 'projects/123456789/files/aaaaaaaa');
  assert.equal(screens[0].html, 'projects/123456789/files/aaaaaaaaff');
});
test('screens are read from list_screens output via resource name', () => {
  const listed = { screens: [{ name: 'projects/123456789/screens/cccccccc', screenshot: { name: 'projects/123456789/files/cccccccc' } }] };
  assert.deepEqual(screensFrom(listed).map(s => s.id), ['cccccccc']);
});
test('screens without valid screenshot reference are ignored', () => {
  assert.deepEqual(screensFrom({ screens: [screen('dddddddd', { screenshot: { name: 'https://example.org/x.png' } }), null] }), []);
  assert.deepEqual(screensFrom(undefined), []);
});
test('variant count must be an integer from 1 to 5', () => {
  assert.equal(variantCount(1), 1);
  assert.equal(variantCount(5), 5);
  for (const bad of [0, 6, 2.5, '3', undefined]) assert.throws(() => variantCount(bad), /zwischen 1 und 5/);
});
test('identifiers and device type are validated', () => {
  assert.ok(isFileName('projects/7964698520143059120/files/6f5716f82e0f4fd69d2de9176b45d9ab'));
  assert.ok(!isFileName('projects/1/files/../../secret'));
  assert.ok(isProjectId('7964698520143059120'));
  assert.ok(!isProjectId('79646985/../x'));
  assert.equal(device('MOBILE'), 'MOBILE');
  assert.equal(device('TOASTER'), 'DESKTOP');
  assert.equal(projectUrl('123456'), 'https://stitch.withgoogle.com/projects/123456');
});
test('layout prompt carries project and a bounded specification', () => {
  const prompt = layoutPrompt('Pair Pressure', 'x'.repeat(20000));
  assert.ok(prompt.includes('Project: Pair Pressure'));
  assert.ok(prompt.includes('not instructions'));
  assert.ok(prompt.length < 13000);
});

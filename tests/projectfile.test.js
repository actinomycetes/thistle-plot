// Project files: TP saves .tplot; .thistle and .pprism from earlier versions still load; files from other
// Thistle apps (Thistle Flow .tflow / .zip / .json) get a plain "open it in Thistle Flow" message.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openApp } = require('./helpers');

let app;
before(async () => { app = await openApp({ consoleErrors: true }); });
after(async () => { await app.close(); });

// Load a file through the real 📂 Load input; returns the alert text
async function load(name, content) {
  const msg = new Promise(res => app.page.once('dialog', async d => { res(d.message()); await d.accept(); }));
  await app.page.setInputFiles('#fi-load', { name, mimeType: 'application/octet-stream', buffer: Buffer.from(content) });
  return msg;
}

test('Save downloads a .tplot file that names its app, and it loads back', async () => {
  await app.page.evaluate(() => loadExample('groups'));
  const [dl] = await Promise.all([app.page.waitForEvent('download'), app.page.evaluate(() => saveProject())]);
  assert.strictEqual(dl.suggestedFilename(), 'thistle_project.tplot');
  const text = require('fs').readFileSync(await dl.path(), 'utf8');
  const snap = JSON.parse(text);
  assert.strictEqual(snap.app, 'Thistle Plot'); assert.strictEqual(snap.format, 2);
  await app.page.evaluate(() => clearData());
  assert.match(await load('thistle_project.tplot', text), /loaded/);
  assert.strictEqual(await app.page.evaluate(() => G.groups[0].name), snap.G.groups[0].name);
});

test('older .thistle and .pprism projects still load', async () => {
  const old = JSON.stringify({ G: { nReps: 2, nRows: 2, rowNames: ['a', 'b'], groups: [{ name: 'Old A', reps: ['R1', 'R2'], data: [[1, 2], [3, 4]] }, { name: 'Old B', reps: ['R1', 'R2'], data: [[5, 6], [7, 8]] }] } });
  for (const ext of ['.thistle', '.pprism']) {
    assert.match(await load('old' + ext, old), /loaded/);
    assert.strictEqual(await app.page.evaluate(() => G.groups[1].name), 'Old B');
  }
});

test('Thistle Flow files and other files get a plain message and leave the table alone', async () => {
  const before = await app.page.evaluate(() => JSON.stringify(G));
  const flow = JSON.stringify({ app: 'ThistleFlow', kind: 'workspace', version: 2, samples: [] });
  assert.match(await load('run1.tflow', flow), /Thistle Flow workspace.*thistle-flow/);
  assert.match(await load('run1.json', flow), /Thistle Flow workspace/);
  assert.match(await load('run1.zip', 'PK\x03\x04rest'), /Thistle Flow workspace/);
  assert.match(await load('old.json', JSON.stringify({ app: 'FlowLite', version: 1 })), /Thistle Flow workspace.*thistle-flow/);
  assert.match(await load('gates.json', JSON.stringify({ app: 'Thistle Flow', format: 3, kind: 'template' })), /Thistle Flow template/);
  assert.match(await load('notes.json', '{"hello": 1}'), /not a Thistle Plot project/);
  assert.match(await load('data.txt', '1,2,3'), /use ⬆ CSV/);
  assert.strictEqual(await app.page.evaluate(() => JSON.stringify(G)), before);
  assert.deepStrictEqual(app.errors, []);
});

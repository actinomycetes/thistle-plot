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
  assert.match(await load('data.txt', '1,2,3'), /use ⬆ Open CSV/);
  assert.strictEqual(await app.page.evaluate(() => JSON.stringify(G)), before);
  assert.deepStrictEqual(app.errors, []);
});

test('loadProject sanitizes statTabs HTML, rejects unsafe plot imageData, and escapes plot titles', async () => {
  const png1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const payload = JSON.stringify({
    app: 'Thistle Plot', format: 2,
    G: { nReps: 1, nRows: 2, rowNames: ['R1', 'R2'], groups: [{ name: 'A', reps: ['R1'], data: [[1], [2]] }, { name: 'B', reps: ['R1'], data: [[3], [4]] }] },
    statTabs: [{
      id: 'st0', title: '<img src=x onerror="window.__tpProjXss=1">Stats',
      html: '<div class="scard"><script>window.__tpProjXss=2</script><img src="x" onerror="window.__tpProjXss=3"><a href="javascript:window.__tpProjXss=4">click</a><div style="background:url(javascript:alert(1))">badstyle</div><span style="color:var(--mu)">Safe text</span></div>',
    }],
    plotTabs: [
      { id: 'pt0', title: 'Bad JS', imageData: 'javascript:alert(1)' },
      { id: 'pt1', title: 'Bad SVG', imageData: 'data:image/svg+xml;base64,PHN2Zy8+' },
      { id: 'pt2', title: '<img src=x onerror="window.__tpProjXss=5">OK Plot', imageData: png1x1 },
    ],
  });
  assert.match(await load('untrusted.tplot', payload), /loaded/);
  await app.page.waitForTimeout(100);
  const r = await app.page.evaluate(() => ({
    xss: window.__tpProjXss || null,
    scripts: document.querySelectorAll('#stats-content script, #plot-content script').length,
    onErr: document.querySelectorAll('#stats-content [onerror], #plot-content [onerror], #stat-strip [onerror], #plot-strip [onerror]').length,
    jsLinks: document.querySelectorAll('#stats-content a[href^="javascript:"]').length,
    statText: document.getElementById('stats-content').textContent,
    nPlotTabs: plotTabs.length,
    plotImgs: document.querySelectorAll('#plot-content img').length,
    plotTitle: document.querySelector('#plot-content .plot-topbar span')?.textContent || '',
  }));
  assert.strictEqual(r.xss, null);
  assert.strictEqual(r.scripts, 0);
  assert.strictEqual(r.onErr, 0);
  assert.strictEqual(r.jsLinks, 0);
  assert.match(r.statText, /Safe text/);
  assert.strictEqual(r.nPlotTabs, 1, 'only the valid PNG plot tab should be restored');
  assert.strictEqual(r.plotImgs, 1);
  assert.ok(r.plotTitle.includes('<img src=x'), 'plot title should render escaped text');
  assert.deepStrictEqual(app.errors, []);
});

test('multi-dataset saveProject exports only active dataset tabs, removeDataset cleans/re-indexes tabs, and loadProject resets datasets', async () => {
  const cleanInit = JSON.stringify({
    app: 'Thistle Plot', format: 2,
    G: { nReps: 1, nRows: 2, rowNames: ['R1', 'R2'], groups: [{ name: 'A', reps: ['R1'], data: [[1], [2]] }, { name: 'B', reps: ['R1'], data: [[3], [4]] }] },
    statTabs: [], plotTabs: [],
  });
  assert.match(await load('reset.tplot', cleanInit), /loaded/);
  await app.page.evaluate(async () => {
    loadExampleKey('groups');
    const a = document.getElementById('asel'); a.value = 'desc'; a.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 40));
    const ap = document.getElementById('opt-autoplot'); if (ap) ap.checked = false;
    runAnalysis(); await new Promise(r => setTimeout(r, 80));
    addDataset(); loadExampleKey('xy');
    runAnalysis(); await new Promise(r => setTimeout(r, 80));
    addDataset(); loadExampleKey('paired');
    runAnalysis(); await new Promise(r => setTimeout(r, 80));
    switchDataset(1);
  });
  const [dl] = await Promise.all([app.page.waitForEvent('download'), app.page.evaluate(() => saveProject())]);
  const text = require('fs').readFileSync(await dl.path(), 'utf8');
  const snap = JSON.parse(text);
  assert.strictEqual(snap.statTabs.length, 1, 'only active dataset stat tabs exported');
  assert.strictEqual(snap.G.groups[0].name, 'Body weight (g)');

  const afterRemove = await app.page.evaluate(() => {
    removeDataset(1);
    return { nDS: datasets.length, activeDS, tabDs: statTabs.map(t => t.ds) };
  });
  assert.strictEqual(afterRemove.nDS, 2);
  assert.deepStrictEqual(afterRemove.tabDs, [0, 1], 'dataset 1 tab removed and dataset 2 tab re-indexed to 1');

  assert.match(await load('single.tplot', text), /loaded/);
  const afterLoad = await app.page.evaluate(() => ({ nDS: datasets.length, activeDS, name: datasets[0].name }));
  assert.strictEqual(afterLoad.nDS, 1, 'loadProject resets datasets array');
  assert.strictEqual(afterLoad.activeDS, 0);
  assert.strictEqual(afterLoad.name, 'single');
  assert.deepStrictEqual(app.errors, []);
});


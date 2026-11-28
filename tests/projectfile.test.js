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

test('multi-dataset saveProject, removeDataset, and loadProject preserve unrelated datasets across refresh and invalid files', async () => {
  const a2 = await openApp({ consoleErrors: true });
  const p = a2.page;
  const loadOn = async (name, content) => {
    const msg = new Promise(res => p.once('dialog', async d => { res(d.message()); await d.accept(); }));
    await p.setInputFiles('#fi-load', { name, mimeType: 'application/octet-stream', buffer: Buffer.from(content) });
    return msg;
  };
  try {
    // First prepare an incoming .tplot project saved from the paired example (with its own stat result + figure)
    await p.evaluate(async () => {
      loadExampleKey('paired');
      const a = document.getElementById('asel'); a.value = 'ttest_rel'; a.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 60));
      const ap = document.getElementById('opt-autoplot'); if (ap) ap.checked = false;
      runAnalysis(); await new Promise(r => setTimeout(r, 120));
    });
    const [dlIn] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => saveProject())]);
    const incomingText = require('fs').readFileSync(await dlIn.path(), 'utf8');
    const incomingSnap = JSON.parse(incomingText);
    assert.strictEqual(incomingSnap.statTabs.length, 1, 'saved project contains its active stat tab');
    assert.strictEqual(incomingSnap.G.groups[0].name, 'Before');

    // Open a clean app with empty initial workspace and verify reusing the first tab
    const aEmpty = await openApp({ consoleErrors: true });
    try {
      const msgEmpty = new Promise(res => aEmpty.page.once('dialog', async d => { res(d.message()); await d.accept(); }));
      await aEmpty.page.setInputFiles('#fi-load', { name: 'first.tplot', mimeType: 'application/octet-stream', buffer: Buffer.from(incomingText) });
      assert.match(await msgEmpty, /loaded/);
      const emptyRes = await aEmpty.page.evaluate(() => ({ nDS: datasets.length, activeDS, name: datasets[0].name, g0: G.groups[0].name }));
      assert.strictEqual(emptyRes.nDS, 1, 'empty initial workspace reuses its first tab');
      assert.strictEqual(emptyRes.activeDS, 0);
      assert.strictEqual(emptyRes.name, 'first');
      assert.strictEqual(emptyRes.g0, 'Before');
      assert.deepStrictEqual(aEmpty.errors, []);
    } finally { await aEmpty.close(); }

    // Now test the two-populated-datasets workflow on a clean workspace
    const a3 = await openApp({ consoleErrors: true });
    const p3 = a3.page;
    const loadOn3 = async (name, content) => {
      const msg = new Promise(res => p3.once('dialog', async d => { res(d.message()); await d.accept(); }));
      await p3.setInputFiles('#fi-load', { name, mimeType: 'application/octet-stream', buffer: Buffer.from(content) });
      return msg;
    };
    try {
      // Dataset 0: Unsaved A (groups example + one-way ANOVA)
      await p3.evaluate(async () => {
        loadExampleKey('groups');
        datasets[0].name = 'Unsaved A';
        const a = document.getElementById('asel'); a.value = 'anova'; a.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 60));
        const ap = document.getElementById('opt-autoplot'); if (ap) ap.checked = false;
        runAnalysis(); await new Promise(r => setTimeout(r, 120));
        // Dataset 1: Unsaved B (xy example + Pearson correlation)
        addDataset();
        loadExampleKey('xy');
        datasets[1].name = 'Unsaved B';
        a.value = 'pearson'; a.dispatchEvent(new Event('change'));
        await new Promise(r => setTimeout(r, 60));
        const ap2 = document.getElementById('opt-autoplot'); if (ap2) ap2.checked = false;
        runAnalysis(); await new Promise(r => setTimeout(r, 120));
        renderDataStrip();
      });

      // Open incoming.tplot as a third active dataset without overwriting Unsaved A / Unsaved B
      assert.match(await loadOn3('incoming.tplot', incomingText), /loaded/);
      await p3.waitForTimeout(80);

      const checkAllThree = async (phase) => {
        const meta = await p3.evaluate(() => ({
          names: datasets.map(d => d.name),
          stIds: statTabs.map(t => t.id),
          stDs: statTabs.map(t => t.ds),
        }));
        assert.deepStrictEqual(meta.names, ['Unsaved A', 'Unsaved B', 'incoming'], `${phase}: all three datasets preserved`);
        assert.strictEqual(new Set(meta.stIds).size, meta.stIds.length, `${phase}: all stat tab IDs unique`);
        assert.deepStrictEqual(meta.stDs.slice().sort(), [0, 1, 2], `${phase}: each dataset owns its stat tab`);

        await p3.evaluate(() => switchDataset(0));
        const d0 = await p3.evaluate(() => ({ g0: G.groups[0].name, txt: document.querySelector('#stats-content .tab-page.active')?.innerText || '' }));
        assert.strictEqual(d0.g0, 'Control', `${phase}: dataset 0 table`);
        assert.match(d0.txt, /ANOVA/i, `${phase}: dataset 0 result`);

        await p3.evaluate(() => switchDataset(1));
        const d1 = await p3.evaluate(() => ({ g0: G.groups[0].name, txt: document.querySelector('#stats-content .tab-page.active')?.innerText || '' }));
        assert.strictEqual(d1.g0, 'Body weight (g)', `${phase}: dataset 1 table`);
        assert.match(d1.txt, /Pearson/i, `${phase}: dataset 1 result`);

        await p3.evaluate(() => switchDataset(2));
        const d2 = await p3.evaluate(() => ({ g0: G.groups[0].name, txt: document.querySelector('#stats-content .tab-page.active')?.innerText || '' }));
        assert.strictEqual(d2.g0, 'Before', `${phase}: dataset 2 table`);
        assert.match(d2.txt, /Paired/i, `${phase}: dataset 2 result`);
      };

      await checkAllThree('after loadProject');

      // Persist in kept session, reload page, and verify all three datasets and their results survive
      await p3.click('#hdr');
      await p3.waitForFunction(() => sessionKept(), null, { timeout: 15000 });
      await p3.reload();
      await p3.waitForFunction(() => document.getElementById('hdr').style.display !== 'none');
      await p3.waitForSelector('.restore-note');
      await checkAllThree('after refresh');

      // Opening invalid project files must leave the active dataset and all tabs completely untouched
      const snapBeforeInvalid = await p3.evaluate(() => ({
        nDS: datasets.length, activeDS, G: JSON.stringify(G),
        stIds: statTabs.map(t => [t.id, t.ds]), ptIds: plotTabs.map(t => [t.id, t.ds]),
      }));
      assert.match(await loadOn3('broken.tplot', '{not valid json'), /not a Thistle Plot project/);
      assert.match(await loadOn3('bad-groups.tplot', JSON.stringify({ app: 'Thistle Plot', format: 2, G: { groups: [null] } })), /invalid data table/i);
      const snapAfterInvalid = await p3.evaluate(() => ({
        nDS: datasets.length, activeDS, G: JSON.stringify(G),
        stIds: statTabs.map(t => [t.id, t.ds]), ptIds: plotTabs.map(t => [t.id, t.ds]),
      }));
      assert.deepStrictEqual(snapAfterInvalid, snapBeforeInvalid, 'invalid project files must leave active dataset and tabs untouched');

      // Also verify saveProject exports only the active dataset and removeDataset cleans & re-indexes tabs
      await p3.evaluate(() => switchDataset(1));
      const [dlMid] = await Promise.all([p3.waitForEvent('download'), p3.evaluate(() => saveProject())]);
      const snapMid = JSON.parse(require('fs').readFileSync(await dlMid.path(), 'utf8'));
      assert.strictEqual(snapMid.statTabs.length, 1, 'saveProject exports only active dataset stat tabs');
      assert.strictEqual(snapMid.G.groups[0].name, 'Body weight (g)');

      const afterRemove = await p3.evaluate(() => {
        removeDataset(1);
        return { nDS: datasets.length, activeDS, tabDs: statTabs.map(t => t.ds) };
      });
      assert.strictEqual(afterRemove.nDS, 2);
      assert.deepStrictEqual(afterRemove.tabDs, [0, 1], 'dataset 1 tab removed and dataset 2 tab re-indexed to 1');
      assert.deepStrictEqual(a3.errors, []);
    } finally { await a3.close(); }
    assert.deepStrictEqual(a2.errors, []);
  } finally { await a2.close(); }
});


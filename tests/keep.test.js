// Kept session: data tables, results and figures are copied to this browser (IndexedDB) and reopen after a
// refresh; Start fresh empties it; inside a same-site page (Thistle Notebook) nothing is kept or restored.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openApp } = require('./helpers');

let app;
before(async () => { app = await openApp({ consoleErrors: true }); });
after(async () => { await app.close(); });

const ready = p => p.waitForFunction(() => document.getElementById('hdr').style.display !== 'none');
const kept = p => p.waitForFunction(() => sessionKept(), null, { timeout: 15000 });

test('data, results and figures reopen after a refresh; ↻ Update redraws a kept figure; Start fresh empties it', async () => {
  const p = app.page;
  assert.equal(await p.locator('.restore-note').count(), 0, 'nothing to reopen on a first visit');
  // dataset 1: ANOVA example, run with its auto-plot
  await p.evaluate(async () => {
    const a = document.getElementById('asel'); a.value = 'anova'; a.dispatchEvent(new Event('change'));
    loadExampleFor('stat'); await new Promise(r => setTimeout(r, 100)); runAnalysis(); await new Promise(r => setTimeout(r, 1200));
  });
  // dataset 2 with its own data
  await p.evaluate(async () => { addDataset(); loadExampleKey('xy'); datasets[1].name = 'Mice'; renderDataStrip(); await new Promise(r => setTimeout(r, 200)); });
  await p.click('#hdr'); // any interaction schedules the copy
  await kept(p);
  const before = await p.evaluate(() => ({ ds: datasets.map(d => d.name), active: activeDS, G1: JSON.stringify(datasets[0].G), nStat: statTabs.length, nPlot: plotTabs.length, title: statTabs[0]?.title }));
  assert.ok(before.nStat >= 1 && before.nPlot >= 1, JSON.stringify(before));
  await p.reload(); await ready(p);
  await p.waitForSelector('.restore-note');
  const afterR = await p.evaluate(() => ({ ds: datasets.map(d => d.name), active: activeDS, rows2: G.nRows, nStat: statTabs.length, nPlot: plotTabs.length, title: statTabs[0]?.title }));
  assert.deepStrictEqual(afterR.ds, before.ds);
  assert.strictEqual(afterR.active, 1, 'the active table is the one left open');
  assert.strictEqual(afterR.rows2, 15, 'second table (15 mice) is back');
  assert.strictEqual(afterR.nStat, before.nStat); assert.strictEqual(afterR.nPlot, before.nPlot);
  // back to the first table: its data, result and figure picture
  await p.evaluate(() => switchDataset(0));
  assert.strictEqual(await p.evaluate(() => JSON.stringify(G)), before.G1);
  assert.match(await p.locator('#stats-content .tab-page.active').innerText(), /ANOVA/i);
  const img = p.locator('#plot-content .tab-page.active img');
  assert.strictEqual(await img.count(), 1, 'figure shown as a picture');
  // ↻ Update redraws it as a live figure
  await p.locator('#plot-content .tab-page.active .replot-btn').click();
  await p.waitForFunction(() => document.querySelector('#plot-content .tab-page.active canvas'), null, { timeout: 10000 });
  // Start fresh: everything closes and nothing reopens
  p.once('dialog', d => d.accept());
  await p.evaluate(() => { const n = document.querySelector('.restore-note'); if (!n) _showRestoreNote(Date.now()); });
  await Promise.all([p.waitForEvent('load'), p.click('.restore-note [data-act=fresh]')]);
  await ready(p); await p.waitForTimeout(800);
  assert.strictEqual(await p.locator('.restore-note').count(), 0);
  assert.deepStrictEqual(await p.evaluate(() => ({ n: datasets.length, st: statTabs.length, pt: plotTabs.length })), { n: 1, st: 0, pt: 0 });
  assert.deepStrictEqual(app.errors, []);
});

test('a figure is still there after visiting an empty data table (was blank)', async () => {
  const p = app.page;
  await p.evaluate(async () => { const a = document.getElementById('asel'); a.value = 'anova'; a.dispatchEvent(new Event('change')); loadExampleFor('stat'); await new Promise(r => setTimeout(r, 100)); runAnalysis(); await new Promise(r => setTimeout(r, 1200)); });
  const id = await p.evaluate(() => activePT);
  assert.ok(await p.evaluate(id => !!document.querySelector('#' + id + ' canvas'), id));
  await p.evaluate(async () => { addDataset(); await new Promise(r => setTimeout(r, 200)); switchDataset(0); await new Promise(r => setTimeout(r, 300)); });
  assert.ok(await p.evaluate(id => !!document.querySelector('#' + id + ' canvas'), id), 'figure kept its drawing');
});

test('inside a same-site page (as in Thistle Notebook) nothing is restored or kept', async () => {
  // served over http so the frame and its parent are the same site (every file:// page counts as its own site)
  const p = app.page;
  const http = require('http'), fs = require('fs'), path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'));
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/embed-test.html')) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<iframe id="f" src="index.html" style="width:1200px;height:800px"></iframe>'); }
    res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html);
  });
  await new Promise(r => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  await p.goto(base + '/index.html'); await ready(p);
  await p.evaluate(async () => { loadExampleKey('groups'); });
  await p.click('#hdr'); await kept(p);
  const url = base + '/index.html';
  await p.goto(base + '/embed-test.html');
  const frame = p.frames().find(f => f !== p.mainFrame()) || (await (await p.waitForSelector('#f')).contentFrame());
  await frame.waitForFunction(() => document.getElementById('hdr')?.style.display !== 'none');
  await p.waitForTimeout(800);
  assert.strictEqual(await frame.evaluate(() => KEEP_SESSION), false);
  assert.strictEqual(await frame.evaluate(() => _hasData(G)), false, 'embedded copy starts empty');
  await p.goto(url); await ready(p); await p.waitForSelector('.restore-note');
  assert.strictEqual(await p.evaluate(() => _hasData(G)), true, 'the top-level copy is untouched');
  server.close();
});

test('work started before the kept session has loaded is not thrown away; the kept session is added after it', async () => {
  const a2 = await openApp({ consoleErrors: true }); const p = a2.page;
  try {
    // last visit: one table with a result and a figure
    await p.evaluate(async () => { const a = document.getElementById('asel'); a.value = 'anova'; a.dispatchEvent(new Event('change'));
      loadExampleFor('stat'); await new Promise(r => setTimeout(r, 100)); runAnalysis(); await new Promise(r => setTimeout(r, 1200)); datasets[0].name = 'Old'; renderDataStrip(); });
    await p.click('#hdr'); await kept(p);
    const old = await p.evaluate(() => ({ G: JSON.stringify(G), st: statTabs.length, pt: plotTabs.length }));
    // this visit: reading the kept copy is slow, and the user starts at once
    await p.addInitScript(() => { window.TP_RESTORE_DELAY = 1500; });
    await p.reload(); await ready(p);
    await p.evaluate(async () => { loadExampleKey('xy'); const a = document.getElementById('asel'); a.value = 'desc'; a.dispatchEvent(new Event('change'));
      runAnalysis(); await new Promise(r => setTimeout(r, 900)); });
    const mine = await p.evaluate(() => ({ G: JSON.stringify(G), st: statTabs.map(t => t.id), pt: plotTabs.map(t => t.id) }));
    await p.waitForSelector('.restore-note', { timeout: 10000 });
    const r = await p.evaluate(() => ({ G: JSON.stringify(G), active: activeDS, names: datasets.map(d => d.name), G2: JSON.stringify(datasets[1]?.G),
      st: statTabs.map(t => [t.id, t.ds]), pt: plotTabs.map(t => [t.id, t.ds, t.linkedStatId, t.ctx]), note: document.querySelector('.restore-note').textContent }));
    assert.strictEqual(r.G, mine.G, 'the table being worked on stays in front, unchanged');
    assert.strictEqual(r.active, 0);
    assert.deepStrictEqual(r.names, ['Dataset 1', 'Old']);
    assert.strictEqual(r.G2, old.G, 'the kept table is added after it');
    const ids = [...r.st.map(x => x[0]), ...r.pt.map(x => x[0])];
    assert.strictEqual(new Set(ids).size, ids.length, 'no two tabs share an id');
    assert.ok(mine.st.every(id => r.st.some(x => x[0] === id && x[1] === 0)), 'my result is kept on my table');
    assert.strictEqual(r.st.filter(x => x[1] === 1).length, old.st, 'kept results come back on the kept table');
    const keptPlots = r.pt.filter(x => x[1] === 1);
    assert.strictEqual(keptPlots.length, old.pt);
    keptPlots.forEach(([, , ls, ctx]) => { if (ls) assert.ok(r.st.some(x => x[0] === ls && x[1] === 1), 'links point at the renamed kept result'); if (ctx) assert.ok(r.st.some(x => x[0] === ctx)); });
    assert.match(r.note, /added/i);
    await p.evaluate(() => switchDataset(1));
    assert.strictEqual(await p.locator('#plot-content .tab-page.active img').count(), 1, 'the kept figure picture is there');
    assert.deepStrictEqual(a2.errors, []);
  } finally { await a2.close(); }
});

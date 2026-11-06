// RNA-seq scale: 20,000 genes x 2 groups x 3 replicates (400 truly up, 400 truly down).
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openApp, selectTest, loadGenes } = require('./helpers');

let app;
before(async () => { app = await openApp(); await loadGenes(app.page, 20000); });
after(async () => { await app.close(); });

test('Rank Product finds up and down genes without false calls, fast', async () => {
  await selectTest(app.page, 'rankprod');
  const t = await app.page.evaluate(async () => {
    const s = performance.now(); runAnalysis(); const ms = performance.now() - s;
    await new Promise(r => setTimeout(r, 2500));
    const st = statTabs.at(-1);
    const up = st.geneSet.up.map(x => x.row), dn = st.geneSet.down.map(x => x.row);
    return { ms, up: up.length, upTrue: up.filter(r => r < 400).length, down: dn.length,
             downTrue: dn.filter(r => r >= 400 && r < 800).length, plot: plotTabs.at(-1).title };
  });
  assert.ok(t.ms < 5000, 'took ' + t.ms);
  assert.strictEqual(t.up, t.upTrue, 'false up calls');
  assert.strictEqual(t.down, t.downTrue, 'false down calls');
  assert.ok(t.up >= 380 && t.down >= 350, `recovered ${t.up} up / ${t.down} down`);
  assert.ok(/Heatmap/.test(t.plot), 'linked figure is a heatmap: ' + t.plot);
});

test('per-row t-test on 20,000 rows links a heatmap and offers the full CSV', async () => {
  await selectTest(app.page, 'ttest_ind');
  const r = await app.page.evaluate(async () => {
    const p = document.getElementById('opt-perrow'); p.checked = true; p.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 50)); runAnalysis(); await new Promise(r => setTimeout(r, 2500));
    const st = statTabs.at(-1);
    return { plot: plotTabs.at(-1).title, linked: st.linkedPlotId === plotTabs.at(-1).id,
             csv: !!document.querySelector('#' + st.id + ' button[onclick^="downloadCSV"]') };
  });
  assert.ok(/Heatmap/.test(r.plot) && r.linked && r.csv, JSON.stringify(r));
  assert.deepStrictEqual(app.errors, []);
});

test('PCA on 20,000 genes returns every component', async () => {
  await selectTest(app.page, 'pca');
  const r = await app.page.evaluate(async () => {
    document.getElementById('opt-pcmode').value = 'reps'; runAnalysis(); await new Promise(r => setTimeout(r, 2000));
    const h = statTabs.at(-1).html;
    return { pcs: (h.match(/<td>PC\d+<\/td>/g) || []).length };
  });
  assert.strictEqual(r.pcs, 5, '6 replicate columns give 5 non-trivial PCs');
});

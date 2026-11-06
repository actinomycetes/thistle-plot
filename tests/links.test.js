// A significance mark / gene list belongs ONLY to the figure created by that run of a test.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openApp, selectTest, selectPlot } = require('./helpers');

let app;
before(async () => { app = await openApp(); });
after(async () => { await app.close(); });

test('hand-made plots never inherit stars from an earlier test', async () => {
  await selectTest(app.page, 'ttest_ind');
  const r = await app.page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    loadExampleFor('stat'); await w(150);
    const c = document.getElementById('opt-perrow'); c.checked = true; c.dispatchEvent(new Event('change')); await w(60);
    runAnalysis(); await w(900);
    const linkedPairs = (statTabs.at(-1).rowPairs || []).length;
    [...plotTabs].forEach(t => closePlotTab(t.id)); [...statTabs].forEach(t => closeStatTab(t.id));
    const ps = document.getElementById('psel'); ps.value = 'bar_sd'; renderPlotOpts('bar_sd'); await w(50);
    const g = document.getElementById('popt-groupby'); if (g) g.value = 'sample';
    runPlot(); await w(300);
    const ch = chartInst[plotTabs.at(-1).id];
    return { linkedPairs, manualGlobals: [lastStatPairs, lastStatRowPairs, lastStatGeneSet], manualSig: !!(ch && ch._sigPairs) };
  });
  assert.ok(r.linkedPairs > 0, 'the linked plot should have had per-row brackets');
  assert.deepStrictEqual(r.manualGlobals, [null, null, null]);
  assert.strictEqual(r.manualSig, false);
  assert.deepStrictEqual(app.errors, []);
});

test('🔗 re-creates a closed plot (with its stars) and a closed result', async () => {
  await selectTest(app.page, 'anova');
  const r = await app.page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    loadExampleFor('stat'); await w(100); runAnalysis(); await w(800);
    const st = statTabs.at(-1); closePlotTab(st.linkedPlotId);
    const n0 = plotTabs.length; goLinkedPlot(st.id); await w(900);
    const np = plotTabs.at(-1);
    const out = { plotRecreated: plotTabs.length === n0 + 1, linked: st.linkedPlotId === np.id, sig: chartInst[np.id]?._sigPairs?.length || 0 };
    closeStatTab(st.id); const s0 = statTabs.length; goLinkedStat(np.id); await w(900);
    out.statRecreated = statTabs.length === s0 + 1; out.statLinked = np.linkedStatId === statTabs.at(-1).id;
    return out;
  });
  assert.ok(r.plotRecreated && r.linked && r.statRecreated && r.statLinked, JSON.stringify(r));
  assert.ok(r.sig > 0, 're-created plot should show the test\'s brackets');
});

test('Clear and a new dataset start from the default empty table', async () => {
  const r = await app.page.evaluate(async () => {
    loadExample(); clearData();
    const a = G.groups.map(g => g.name).join(',') + '|' + G.nReps;
    loadExample(); addDataset(); await new Promise(r => setTimeout(r, 100));
    return { cleared: a, fresh: G.groups.map(g => g.name).join(','), filled: G.groups[0].data.flat().filter(v => v !== '').length };
  });
  assert.strictEqual(r.filled, 0, 'new dataset must be empty');
  assert.strictEqual(r.cleared.split('|')[0], r.fresh);
});

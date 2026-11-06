// ↻ Update redraws the active figure in place; + New makes a new tab; Live update redraws on option changes.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openApp, selectPlot } = require('./helpers');

let app;
before(async () => { app = await openApp(); });
after(async () => { await app.close(); });

const reset = () => app.page.evaluate(() => {
  [...plotTabs].forEach(t => closePlotTab(t.id)); [...statTabs].forEach(t => closeStatTab(t.id));
  const lv = document.getElementById('plot-live'); if (lv) { lv.checked = false; lv.dispatchEvent(new Event('change')); }
});

test('Update redraws the active tab in place; + New adds a tab', async () => {
  await reset();
  await selectPlot(app.page, 'bar_sd');
  const r = await app.page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    loadExample(); await w(100);
    const ps = document.getElementById('psel'); ps.value = 'bar_sd'; renderPlotOpts('bar_sd'); await w(50);
    newPlot(); await w(200);
    const id = plotTabs.at(-1).id, ch0 = chartInst[id];
    const btn = document.getElementById('plot-main-btn'), plus = document.getElementById('plot-new-btn');
    const out = { n1: plotTabs.length, label1: btn.textContent, plusShown: plus.style.display !== 'none',
      topbarBtn: !!document.querySelector('#' + id + ' .plot-topbar .replot-btn') };
    document.getElementById('popt-ylab').value = 'Signal (AU)';
    btn.click(); await w(200);
    out.n2 = plotTabs.length; out.sameId = plotTabs.at(-1).id === id; out.newChart = chartInst[id] !== ch0 && !!chartInst[id];
    out.ylabStored = plotTabs.at(-1).optState['po_popt-ylab'];
    out.yTitle = chartInst[id]?.options?.scales?.y?.title?.text;
    // ↻ in the figure's top bar does the same
    document.querySelector('#' + id + ' .plot-topbar .replot-btn').click(); await w(200);
    out.n3 = plotTabs.length;
    // + New always adds a tab, even when Update is possible
    plus.click(); await w(200);
    out.n4 = plotTabs.length;
    // + in the tab strip too
    document.querySelector('#plot-strip .tab-new').click(); await w(200);
    out.n5 = plotTabs.length;
    // changing the plot type turns the main button back into a new plot
    ps.value = 'boxplot'; ps.dispatchEvent(new Event('change')); await w(80);
    out.label2 = btn.textContent; out.plusShown2 = plus.style.display !== 'none';
    btn.click(); await w(200);
    out.n6 = plotTabs.length; out.lastType = plotTabs.at(-1).ptype;
    return out;
  });
  assert.strictEqual(r.n1, 1);
  assert.match(r.label1, /Update/);
  assert.ok(r.plusShown, '+ New is shown when Update is possible');
  assert.ok(r.topbarBtn, 'figure top bar has a ↻ button');
  assert.strictEqual(r.n2, 1, 'Update must not add a tab');
  assert.ok(r.sameId && r.newChart, JSON.stringify(r));
  assert.strictEqual(r.ylabStored, 'Signal (AU)');
  assert.strictEqual(r.n3, 1);
  assert.strictEqual(r.n4, 2);
  assert.strictEqual(r.n5, 3);
  assert.doesNotMatch(r.label2, /Update/);
  assert.strictEqual(r.plusShown2, false);
  assert.strictEqual(r.n6, 4); assert.strictEqual(r.lastType, 'boxplot');
  assert.deepStrictEqual(app.errors, []);
});

test('Updating a hand-made figure never adds a test\'s marks', async () => {
  await reset();
  const r = await app.page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    loadExample(); await w(100);
    const ps = document.getElementById('psel'); ps.value = 'bar_sd'; renderPlotOpts('bar_sd'); await w(50);
    newPlot(); await w(200);
    lastStatPairs = [{ i: 0, j: 1, stars: '***' }]; // left over from some earlier test run
    updatePlot(); await w(200);
    const id = plotTabs.at(-1).id;
    return { sig: chartInst[id]?._sigPairs?.length || 0, n: plotTabs.length };
  });
  assert.strictEqual(r.n, 1);
  assert.strictEqual(r.sig, 0);
});

test('Updating a linked figure keeps its marks until the data change', async () => {
  await reset();
  const r = await app.page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const a = document.getElementById('asel'); a.value = 'anova'; a.dispatchEvent(new Event('change')); await w(60);
    loadExampleFor('stat'); await w(100); runAnalysis(); await w(900);
    const st = statTabs.at(-1), id = st.linkedPlotId;
    activatePlotTab(id); await w(120);
    const out = { before: chartInst[id]?._sigPairs?.length || 0 };
    document.getElementById('popt-ylab').value = 'Expression'; updatePlot(); await w(200);
    out.n = plotTabs.length; out.keep = chartInst[id]?._sigPairs?.length || 0; out.stillLinked = plotTabs.at(-1).linkedStatId === st.id && st.linkedPlotId === id;
    // edit the data: the test's stars no longer describe it
    G.groups[0].data[0][0] = +G.groups[0].data[0][0] + 50;
    updatePlot(); await w(200);
    out.after = chartInst[id]?._sigPairs?.length || 0;
    out.unlinked = !plotTabs.at(-1).linkedStatId && !st.linkedPlotId;
    out.note = !!document.querySelector('#' + id + ' .replot-note');
    return out;
  });
  assert.ok(r.before > 0, 'auto-plot should have brackets: ' + JSON.stringify(r));
  assert.strictEqual(r.n, 1);
  assert.strictEqual(r.keep, r.before);
  assert.ok(r.stillLinked);
  assert.strictEqual(r.after, 0);
  assert.ok(r.unlinked && r.note, JSON.stringify(r));
});

test('Live update redraws on option changes, not on tab switches', async () => {
  await reset();
  const r = await app.page.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    loadExample(); await w(100);
    const ps = document.getElementById('psel'); ps.value = 'bar_sd'; renderPlotOpts('bar_sd'); await w(50);
    newPlot(); await w(200);
    const a = plotTabs.at(-1);
    newPlot(); await w(200);
    const b = plotTabs.at(-1);
    const lv = document.getElementById('plot-live'); lv.checked = true; lv.dispatchEvent(new Event('change'));
    const d0 = a.draws, e0 = b.draws;
    activatePlotTab(a.id); await w(700); // restoring a tab's options must not redraw
    const out = { switchDraws: a.draws - d0 + b.draws - e0 };
    const y = document.getElementById('popt-ylab'); y.value = 'Live title'; y.dispatchEvent(new Event('input', { bubbles: true }));
    await w(700);
    out.liveDraws = a.draws - d0; out.n = plotTabs.length;
    out.yTitle = chartInst[a.id]?.options?.scales?.y?.title?.text;
    const sel = document.getElementById('popt-dispmode'); sel.value = 'mean'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    await w(700);
    out.liveDraws2 = a.draws - d0;
    lv.checked = false; lv.dispatchEvent(new Event('change'));
    return out;
  });
  assert.strictEqual(r.switchDraws, 0);
  assert.strictEqual(r.liveDraws, 1);
  assert.strictEqual(r.n, 2);
  assert.strictEqual(r.yTitle, 'Live title');
  assert.strictEqual(r.liveDraws2, 2);
  assert.deepStrictEqual(app.errors, []);
});

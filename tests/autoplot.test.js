// Auto-plot after a test: a menu of the figures that suit the test, the recommended one first.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openApp, selectTest } = require('./helpers');

let app;
before(async () => { app = await openApp({ consoleErrors: true }); });
after(async () => { await app.close(); });
const ev = (fn, arg) => app.page.evaluate(fn, arg);

test('every offered figure is made after its test, on the example data', async () => {
  const choices = await ev(() => AUTO_PLOT_CHOICES);
  const bad = [];
  for (const [t, list] of Object.entries(choices)) {
    if (t === 'regress') continue; // regression makes its own fit and residual plots
    await selectTest(app.page, t);
    for (const v of list) {
      const r = await ev(async ([t, v]) => {
        loadExampleFor('stat'); await new Promise(r => setTimeout(r, 80));
        const sel = document.getElementById('opt-autoplot-type');
        if (sel) sel.value = v; else if (v !== AUTO_PLOT_FOR_TYPE[t]) return 'no menu';
        const n0 = plotTabs.length; runAnalysis(); await new Promise(r => setTimeout(r, 900));
        const pt = plotTabs[plotTabs.length - 1];
        if (plotTabs.length === n0) return 'no plot';
        return pt.optState?.psel === v ? '' : 'made ' + pt.optState?.psel;
      }, [t, v]);
      if (r) bad.push(`${t} → ${v}: ${r}`);
    }
  }
  assert.deepStrictEqual(bad, []);
  assert.deepStrictEqual(app.errors, []);
});

test('the recommended figure is the default; box and violin plots carry the brackets', async () => {
  await selectTest(app.page, 'mw');
  const r = await ev(async () => {
    const sel = document.getElementById('opt-autoplot-type'); const def = sel.value, label = sel.options[0].text;
    applyG({ nReps: 6, nRows: 1, rowNames: ['r'], groups: [{ name: 'A', reps: ['1','2','3','4','5','6'], data: [[1, 2, 3, 4, 5, 6]] },
      { name: 'B', reps: ['1','2','3','4','5','6'], data: [[11, 12, 13, 14, 15, 16]] }] });
    renderAnalysisOpts('mw'); await new Promise(r => setTimeout(r, 50));
    const out = { def, label };
    for (const v of ['boxplot', 'violin']) {
      document.getElementById('opt-autoplot-type').value = v; runAnalysis(); await new Promise(r => setTimeout(r, 900));
      const t = plotTabs[plotTabs.length - 1]; out[v] = document.querySelector('#' + t.id + ' canvas')?._brackets;
    }
    return out;
  });
  assert.strictEqual(r.def, 'boxplot'); assert.match(r.label, /recommended/);
  assert.strictEqual(r.boxplot, 1); assert.strictEqual(r.violin, 1);
});

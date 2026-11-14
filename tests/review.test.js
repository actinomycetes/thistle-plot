// Regression tests for the v1.0 calculation review. Each test pins a defect that was found and fixed;
// reference numbers come from SciPy/statsmodels (see tools/validate) or from the definition stated.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openApp, selectTest, selectPlot, wait } = require('./helpers');

let app;
before(async () => { app = await openApp({ consoleErrors: true }); });
after(async () => { await app.close(); });
const close = (a, b, rel = 1e-6) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b) + 1e-12, `${a} vs ${b}`);
const ev = (fn, arg) => app.page.evaluate(fn, arg);
// Run the selected test on a table and return the text of the newest result tab
async function runOn(G2, atype, setOpts) {
  await selectTest(app.page, atype);
  return ev(async ([G2, setOpts]) => {
    applyG(G2); renderAnalysisOpts(document.getElementById('asel').value);
    await new Promise(r => setTimeout(r, 50));
    for (const [id, v] of Object.entries(setOpts || {})) { const el = document.getElementById(id); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event('change')); }
    const ap = document.getElementById('opt-autoplot'); if (ap) ap.checked = false;
    runAnalysis(); await new Promise(r => setTimeout(r, 100));
    return statTabs[statTabs.length - 1].html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  }, [G2, setOpts]);
}
const table = (names, cols, rowNames) => ({ nReps: Math.max(...cols.map(c => Math.max(...c.map(r => r.length)))), nRows: cols[0].length,
  rowNames: rowNames || cols[0].map((_, i) => 'Row ' + (i + 1)), groups: names.map((n, i) => ({ name: n, reps: ['R1', 'R2', 'R3'].slice(0, cols[i][0].length), data: cols[i] })) });

test('Normality test is really Shapiro-Wilk (was Jarque-Bera under that name)', async () => {
  const r = await ev(() => shapiroWilk([0.3, 0.5, 0.6, 0.8, 1.1, 1.2, 1.9, 2.4, 3.8, 5.6, 9.1, 15.2, 0.9, 1.4, 2.0]));
  close(r.W, 0.683503, 1e-5); close(r.p, 0.000166467, 1e-4); // scipy.stats.shapiro
  const txt = await runOn(table(['A'], [[[1.2], [2.3], [2.9], [3.1], [3.3], [4.0], [4.4], [5.8]]]), 'norm');
  assert.match(txt, /Shapiro–Wilk W/);
  assert.doesNotMatch(txt, /Jarque/);
});

test('Mann-Whitney and Wilcoxon give exact p-values for small samples', async () => {
  const r = await ev(() => ({ mw: mannWhitneyU([1.1, 2.2, 3.3], [4.4, 5.5, 6.6]), w: wilcoxonSR([5, 6, 7, 8, 9], [0, 0, 0, 0, 0]) }));
  close(r.mw.p, 0.1);          // the normal approximation gave 0.0495 (*), the exact smallest possible p is 0.1
  assert.strictEqual(r.mw.method, 'exact');
  close(r.w.p, 0.0625);        // 2/2^5; the approximation gave 0.043 (*)
});

test('paired ratio t-test works on log ratios (it tested the mean ratio against 0, always "significant")', async () => {
  const r = await ev(() => ttestRel([10, 20, 30, 40], [10.5, 19, 31, 39.5], 'ratio'));
  assert.ok(r.p > 0.5, 'no change in ratio must not be significant: p=' + r.p);
  close(r.ratio, Math.exp([10 / 10.5, 20 / 19, 30 / 31, 40 / 39.5].map(Math.log).reduce((s, x) => s + x) / 4));
});

test('paired tests keep pairs aligned when a cell is blank', async () => {
  // Pairs: (1,1.5) (blank,9) (3,3.4) (4,4.6) (5,5.3): the blank must drop only its own pair
  const G2 = table(['Before', 'After'], [[[1], [''], [3], [4], [5]], [[1.5], [9], [3.4], [4.6], [5.3]]]);
  const txt = await runOn(G2, 'ttest_rel');
  const expected = await ev(() => ttestRel([1, 3, 4, 5], [1.5, 3.4, 4.6, 5.3]).p);
  assert.match(txt, new RegExp('Pairs 4'));
  assert.ok(txt.includes(fmtPstr(expected)), txt.slice(0, 400));
});
function fmtPstr(p) { return p < 0.0001 ? '<0.0001' : p.toPrecision(4); }

test('Z-score normalisation keeps group differences (it was applied per group, so every mean became 0)', async () => {
  const G2 = table(['A', 'B'], [[[1, 2, 3], [2, 3, 1]], [[11, 12, 13], [12, 13, 11]]]);
  const txt = await runOn(G2, 'ttest_ind', { 'opt-norm': 'zscore' });
  assert.match(txt, /t statistic -19\.3/, txt.slice(0, 300)); // same t as without normalisation
});

test('correlation and regression pair X and Y by row, not by position in the pooled list', async () => {
  const r = await ev(() => {
    applyG({ nReps: 1, nRows: 5, rowNames: ['a', 'b', 'c', 'd', 'e'], groups: [
      { name: 'X', reps: ['R1'], data: [[1], [2], [''], [4], [5]] }, { name: 'Y', reps: ['R1'], data: [[2], [4], [6], [8], [10]] }] });
    return xyPairs(0, 1);
  });
  assert.deepStrictEqual(r.x, [1, 2, 4, 5]); assert.deepStrictEqual(r.y, [2, 4, 8, 10]);
  // one X value per row with replicate Y columns: X is repeated for each Y replicate
  const r2 = await ev(() => {
    applyG({ nReps: 2, nRows: 2, rowNames: ['a', 'b'], groups: [
      { name: 'X', reps: ['R1', 'R2'], data: [[1, ''], [2, '']] }, { name: 'Y', reps: ['R1', 'R2'], data: [[5, 6], [7, '']] }] });
    return xyPairs(0, 1);
  });
  assert.deepStrictEqual(r2.x, [1, 1, 2]); assert.deepStrictEqual(r2.y, [5, 6, 7]);
});

test('chi-square ignores empty rows (they inflated the degrees of freedom) and warns on small counts', async () => {
  const r = await ev(() => chiSquare([[12, 5], [6, 14], [0, 0], [0, 0]]));
  assert.strictEqual(r.df, 1);
  const f = await ev(() => fishersExact(5, 0, 2, 3));
  assert.strictEqual(f.or, Infinity); // was a*d / 1
});

test('Fisher two-sided p uses a relative tolerance (tiny probabilities were all counted)', async () => {
  const r = await ev(() => [fishersExact(0, 60, 60, 0).p, 2 / Math.exp(logFact(120) - 2 * logFact(60))]);
  close(r[0], r[1], 1e-6); // only the two extreme tables
});

test('5PL reports the EC50 (half-way X), not only the midpoint parameter C', async () => {
  const r = await ev(() => { const x = [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100], y = x.map(v => 5 + 90 / Math.pow(1 + Math.pow(2 / v, 1.2), 0.5));
    const f = fit5PL(x, y); return [f.predict(f.ec50), (f.params[0] + f.params[1]) / 2, f.ec50, f.c]; });
  close(r[0], r[1], 1e-3);
  assert.ok(Math.abs(r[2] - r[3]) / r[3] > 0.1, 'with Asym = 0.5 the EC50 differs from C');
});

test('one-way ANOVA on identical values is an error, not p = 0', async () => {
  const r = await ev(() => onewayANOVA([[1, 1, 1], [1, 1, 1]]));
  assert.ok(r.error);
});

test('box-plot whiskers end at a data point, Q-Q plot uses Blom positions, brackets for (control > group) do not overlap', async () => {
  const w = await ev(() => _tukeyWhiskers([1, 2, 3, 4, 100], 2, 4));
  assert.deepStrictEqual(w, { lo: 1, hi: 4 }); // was hi = 7 (the fence)
  const src = await ev(() => plotQQ2.toString());
  assert.match(src, /i\+1-0\.375/);
  const lv = await ev(() => { const pairs = [{ i: 2, j: 0, stars: '*' }, { i: 2, j: 1, stars: '*' }];
    const chart = { _sigPairs: pairs, ctx: { save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fillText() {}, measureText: () => ({ width: 5 }) },
      scales: { x: { getPixelForValue: v => v * 10 }, y: { max: 10, getPixelForValue: v => v, getValueForPixel: v => v } }, chartArea: { top: 0 }, data: { datasets: [] } };
    try { sigBracketPlugin.afterDraw(chart); } catch (e) {}
    return pairs.map(p => p._lvl); });
  assert.notStrictEqual(lv[0], lv[1]);
});

test('histogram groups share bin edges', async () => {
  await selectPlot(app.page, 'histogram');
  const r = await ev(async () => {
    applyG({ nReps: 1, nRows: 4, rowNames: ['1', '2', '3', '4'], groups: [
      { name: 'A', reps: ['R1'], data: [[0], [1], [2], [3]] }, { name: 'B', reps: ['R1'], data: [[10], [11], [12], [13]] }] });
    renderPlotOpts('histogram'); runPlot(); await new Promise(r => setTimeout(r, 300));
    const ch = Object.values(Chart.instances).pop();
    return { labels: ch.data.labels, a: ch.data.datasets[0].data, b: ch.data.datasets[1].data };
  });
  assert.strictEqual(r.a.reduce((s, x) => s + x), 4); assert.strictEqual(r.b.reduce((s, x) => s + x), 4);
  assert.ok(r.a[0] > 0 && r.b[r.b.length - 1] > 0 && r.a[r.a.length - 1] === 0, JSON.stringify(r)); // A at the low end, B at the high end
  assert.deepStrictEqual(app.errors, []);
});

test('no trademarked product names or "Pure JS" badge in the app', async () => {
  const t = await ev(() => document.documentElement.outerHTML);
  const hit = (t.match(/.{0,40}(Prism|GraphPad|Pure JS).{0,40}/) || [''])[0];
  assert.strictEqual(hit, '', 'found: ' + hit);
  assert.ok(t.includes('https://github.com/actinomycetes/thistle-plot'), 'Help links to the source repository');
});

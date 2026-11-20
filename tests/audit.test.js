// Regression tests for the independent statistical review of TP v0.15.0 (Nov 2026, cases 02–13).
// Reference values: SciPy 1.18.1 / statsmodels 0.15.0 / mpmath / exact enumeration, reproduced by
// tools/validate/audit_refs.py. If one of these fails after an edit, the statistics changed: investigate first.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openApp } = require('./helpers');

let app;
before(async () => { app = await openApp({ consoleErrors: true }); });
after(async () => { await app.close(); });
const close = (a, b, rel = 1e-6) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} vs ${b}`);

// Run a test through the UI: data, test, options (by element id), then the newest result tab's text and HTML.
async function run(G, atype, opts = {}) {
  return app.page.evaluate(async ([G, atype, opts]) => {
    applyG(G);
    const a = document.getElementById('asel'); a.value = atype; a.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 60));
    for (const [id, v] of Object.entries(opts)) {
      const el = document.getElementById(id); if (!el) throw new Error('no option ' + id);
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
      el.dispatchEvent(new Event('change'));
    }
    await new Promise(r => setTimeout(r, 30));
    const before = statTabs.length; runAnalysis(); await new Promise(r => setTimeout(r, 150));
    const t = statTabs[statTabs.length - 1];
    const div = document.createElement('div'); div.innerHTML = t.html;
    return { added: statTabs.length > before, title: t.title, html: t.html, text: div.textContent.replace(/\s+/g, ' ') };
  }, [G, atype, opts]);
}
const col = (name, vals) => ({ name, reps: vals[0].map((_, k) => 'Rep' + (k + 1)), data: vals });
const tbl = (groups, rowNames) => ({ nReps: groups[0].reps.length, nRows: groups[0].data.length, rowNames: rowNames || groups[0].data.map((_, i) => 'Row ' + (i + 1)), groups });
const isError = r => /class="ebox"/.test(r.html) && !/class="scard"/.test(r.html);

test('02 Spearman: exact permutation p for n ≤ 10 (was the t approximation, p = 0 at n = 3)', async () => {
  const r = await app.page.evaluate(() => ({
    n3: spearmanR([1, 2, 3], [1, 2, 3]), n4: spearmanR([1, 2, 3, 4], [1, 2, 3, 4]),
    n5: spearmanR([1, 2, 3, 4, 5], [1, 2, 3, 5, 4]), n7: spearmanR([1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 7, 6]),
    ties: spearmanR([1, 2, 2, 3, 4], [1, 3, 2, 4, 5]), big: spearmanR([...Array(12).keys()], [...Array(12).keys()].map(i => (i * 7) % 12)),
  }));
  close(r.n3.p, 1 / 3, 1e-9); close(r.n4.p, 1 / 12, 1e-9); close(r.n5.p, 1 / 12, 1e-9);
  close(r.n7.p, 14 / 5040, 1e-9); close(r.ties.p, 4 / 120, 1e-9);
  assert.match(r.n3.method, /exact/); assert.match(r.big.method, /t approximation/);
  const ui = await run(tbl([col('X', [[1], [2], [3]]), col('Y', [[1], [2], [3]])]), 'spearman');
  assert.ok(!/\*\*\*\*/.test(ui.text), 'no **** for 3 points'); assert.match(ui.text, /exact/i);
});

test('03 KS: tail p-values keep their precision; ties are named', async () => {
  const r = await app.page.evaluate(() => {
    const seq = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
    return { k50: ks2Sample(seq(0, 50), seq(50, 100)), k25: ks2Sample(seq(0, 25), seq(25, 50)), k20: ks2Sample(seq(0, 20), seq(20, 40)),
      k4: ks2Sample([1, 2, 3, 4], [5, 6, 7, 8]), tied: ks2Sample([0, 0, 0, 0], [0, 1, 1, 1]) };
  });
  close(r.k50.p, 1.9823306042836678e-29); close(r.k25.p, 1.5821457e-14, 1e-6); close(r.k20.p, 1.4508889e-11, 1e-6);
  close(r.k4.p, 2 / 70, 1e-9); close(r.tied.p, 8 / 35, 1e-9);
  assert.strictEqual(r.k50.method, 'exact'); assert.strictEqual(r.tied.ties, true); assert.strictEqual(r.k4.ties, false);
  const ui = await run(tbl([col('A', [[0], [0], [0], [0]]), col('B', [[0], [1], [1], [1]])]), 'ks');
  assert.match(ui.text, /tied/i);
});

test('04 two-way ANOVA refuses a group count that does not match nA × nB (was a silent 2×2 fit of 6 groups)', async () => {
  const means = [1, 2, 4, 8, 16, 32], names = ['WT · Veh', 'WT · Lo', 'WT · Hi', 'KO · Veh', 'KO · Lo', 'KO · Hi'];
  const G = tbl(means.map((m, k) => col(names[k], [[m - 1, m, m + 1]])));
  const bad = await run(G, 'anova2', { 'opt-nA': 2, 'opt-nB': 2 });
  assert.ok(isError(bad), bad.text); assert.match(bad.text, /6 groups/);
  const ok = await run(G, 'anova2', { 'opt-nA': 2, 'opt-nB': 3 });   // statsmodels ols(Y ~ A*B): F 1200.5, 283.5, 171.5, df_resid 12
  assert.match(ok.text, /2×3/); assert.match(ok.text, /1200\.500/); assert.match(ok.text, /283\.500/); assert.match(ok.text, /171\.500/);
});

test('06 correlation and regression refuse a missing X instead of reusing the row’s other X', async () => {
  const X = col('X', [['', 2], [1, 3], [4, 5]]), Y = col('Y', [[10, 20], [5, 12], [15, 18]]);
  for (const t of ['pearson', 'spearman']) {
    const r = await run(tbl([X, Y]), t); assert.ok(isError(r), t + ': ' + r.text); assert.match(r.text, /Row 1/);
  }
  const reg = await run(tbl([X, Y]), 'regress'); assert.ok(isError(reg), reg.text);
  // complete pairs still work: scipy pearsonr([3,2,1,3,4,5],[10,20,5,12,15,18]) = 0.5398238, p = 0.2689193
  const ok = await run(tbl([col('X', [[3, 2], [1, 3], [4, 5]]), Y]), 'pearson');
  assert.match(ok.text, /0\.5398/); assert.match(ok.text, /0\.2689/);
  // X with one value per row and Y in replicates (dose layout) is refused for correlation (pseudo-replication)
  const dose = await run(tbl([col('Conc', [[1, ''], [2, ''], [3, ''], [4, '']]), col('Resp', [[1, 2], [3, 4], [5, 6], [7, 9]])]), 'pearson');
  assert.ok(isError(dose), dose.text);
});

test('07 polynomial fits work with more points than coefficients (used to throw)', async () => {
  const r = await app.page.evaluate(() => {
    const out = {};
    out.d2 = fitPolynomial([0, 1, 2, 3], [1, 4, 9, 16], 2).params;
    const xs = [0, 1, 2, 3, 4, 5]; out.d3 = fitPolynomial(xs, xs.map(x => 1 - x + 0.5 * x * x + 0.2 * x ** 3), 3).params;
    const off = fitPolynomial([10000, 10001, 10002, 10003], [1, 4, 9, 16].map((v, i) => (i + 1) ** 2), 2);
    out.offPred = [10000, 10001, 10002, 10003].map(off.predict);
    out.under = fitPolynomial([0, 1, 2], [1, 2, 5], 4);
    return out;
  });
  [1, 2, 1].forEach((v, i) => assert.ok(Math.abs(r.d2[i] - v) < 1e-9, 'deg2 ' + r.d2));       // numpy.polyfit
  [1, -1, 0.5, 0.2].forEach((v, i) => assert.ok(Math.abs(r.d3[i] - v) < 1e-8, 'deg3 ' + r.d3));
  [1, 4, 9, 16].forEach((v, i) => assert.ok(Math.abs(r.offPred[i] - v) < 1e-6, 'offset ' + r.offPred));
  assert.ok(r.under.error, 'underdetermined fit refused');
  const ui = await run(tbl([col('X', [[0], [1], [2], [3]]), col('Y', [[1], [4], [9], [16]])]), 'regress', { 'opt-rmodel': 'poly2' });
  assert.ok(!isError(ui), ui.text); assert.match(ui.text, /R² = 1\.0000/);
});

test('08 Fisher refuses tables larger than 2×2; blank, text and fractional counts are refused', async () => {
  const f3 = await run(tbl([col('A', [[10], [0], [10]]), col('B', [[0], [10], [10]])]), 'fisher');
  assert.ok(isError(f3), f3.text); assert.match(f3.text, /3 rows/);
  const blank = await run(tbl([col('A', [[3], [2]]), col('B', [[''], [5]])]), 'fisher');
  assert.ok(isError(blank), blank.text); assert.match(blank.text, /blank/i);
  const text = await run(tbl([col('A', [[3], [2]]), col('B', [['abc'], [5]])]), 'chisq');
  assert.ok(isError(text), text.text);
  const frac = await run(tbl([col('A', [[3], [2]]), col('B', [[0.5], [5]])]), 'chisq');
  assert.ok(isError(frac), frac.text); assert.match(frac.text, /whole/i);
  // a genuine zero is data: scipy fisher_exact([[3,0],[2,5]]) = 0.1666667; chi2_contingency(correction=False) 4.285714, p 0.0384339
  const z = tbl([col('A', [[3], [2]]), col('B', [[0], [5]])]);
  assert.match((await run(z, 'fisher')).text, /0\.1667/);
  const c = await run(z, 'chisq'); assert.match(c.text, /4\.286/); assert.match(c.text, /0\.03843/);
});

test('09 empty groups, single values and under-determined 5PL fits are not reported as results', async () => {
  const an = await run(tbl([col('A', [[1], [2], [3]]), col('B', [[4], [5], [6]]), col('C', [[''], [''], ['']])]), 'anova');
  assert.match(an.text, /13\.500/); assert.match(an.text, /0\.02131/); assert.match(an.text, /C.*no values/i);   // scipy f_oneway([1,2,3],[4,5,6])
  const d = await run(tbl([col('A', [[5], [''], ['']]), col('B', [[1], [2], [3]])]), 'desc');
  assert.ok(!/0\.000<\/td><td>0\.000/.test(d.html), 'no SD = SEM = 0 for one value');
  assert.match(d.html, /<td>A<\/td><td>1<\/td><td>5\.000<\/td><td>—<\/td><td>—<\/td>/);
  const two = await run(tbl([col('Conc', [[1], [1], [1], [10], [10], [10]]), col('Resp', [[5], [6], [7], [90], [91], [92]])]), 'dose');
  assert.ok(isError(two), two.text); assert.match(two.text, /5 different concentrations/);
  const neg = await run(tbl([col('Conc', [[0], [-1], [0.01], [0.1], [1], [10], [100]]), col('Resp', [[1], [1], [2], [10], [50], [90], [99]])]), 'dose');
  assert.ok(isError(neg), neg.text); assert.match(neg.text, /negative/i);
});

test('10 two-way ANOVA names the family each correction controls', async () => {
  const G = tbl([col('A1 · B1', [[1, 2, 3]]), col('A1 · B2', [[6, 7, 8]]), col('A2 · B1', [[2, 3, 4]]), col('A2 · B2', [[3, 4, 5]])]);
  const tk = await run(G, 'anova2', { 'opt-nA': 2, 'opt-nB': 2, 'opt-2ph': 'simpleB', 'opt-2corr': 'tukey' });
  assert.match(tk.text, /within each level of A/); assert.match(tk.text, /no correction/i);
  const hm = await run(G, 'anova2', { 'opt-nA': 2, 'opt-nB': 2, 'opt-2ph': 'simpleB', 'opt-2corr': 'holm' });
  assert.match(hm.text, /across all 2 comparisons/);
});

test('11 Holm–Šídák keeps precision at very small p and never goes below the raw p', async () => {
  const r = await app.page.evaluate(() => {
    const p = [1e-300, 1e-20, 1e-10, 0.01];
    return { a: adjustP([1e-20, 0.01], 'holm_sidak'), b: adjustP(p, 'holm_sidak'),
      ok: ['bonferroni', 'holm', 'holm_sidak', 'fdr'].every(m => adjustP(p, m).every((v, i) => v >= p[i])) };
  });
  close(r.a[0], 2e-20, 1e-12); close(r.a[1], 0.01, 1e-12);                 // statsmodels multipletests('holm-sidak')
  close(r.b[0], 4e-300, 1e-9); close(r.b[1], 3e-20, 1e-9); close(r.b[2], 1.9999999999e-10, 1e-9); close(r.b[3], 0.01, 1e-9);
  assert.ok(r.ok, 'adjusted ≥ raw');
});

test('12 paired ratio is refused on log-transformed values (it computed a ratio of logs)', async () => {
  const G = tbl([col('A', [[4], [8], [16]]), col('B', [[2], [2], [4]])]);
  const bad = await run(G, 'ttest_rel', { 'opt-ptype': 'ratio', 'opt-norm': 'log2' });
  assert.ok(isError(bad), bad.text); assert.match(bad.text, /Difference/);
  const ok = await run(G, 'ttest_rel', { 'opt-ptype': 'ratio', 'opt-norm': 'none' });   // scipy ttest_1samp(log(A/B)): GMR 3.1748, p 0.0377496
  assert.match(ok.text, /3\.175/); assert.match(ok.text, /0\.03775/);
  assert.match(ok.text, /3 rows × 1 replicate/);
});

test('13 Dunnett without one control is refused instead of silently becoming Holm–Šídák', async () => {
  const G = tbl([col('Vehicle', [[1], [2], [3], [2]]), col('DrugA', [[4], [5], [4], [6]]), col('DrugB', [[2], [3], [3], [4]])]);
  const r = await app.page.evaluate(async G => {
    applyG(G); const a = document.getElementById('asel'); a.value = 'anova'; a.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 60));
    const ph = document.getElementById('opt-ph'); const o = [...ph.options].find(o => o.value === 'dunnett'); o.disabled = false; ph.value = 'dunnett';
    document.getElementById('opt-cmp').value = 'all';
    runAnalysis(); await new Promise(r => setTimeout(r, 150));
    return statTabs[statTabs.length - 1].html;
  }, G);
  assert.match(r, /class="ebox"/); assert.match(r, /vs control/); assert.ok(!/Holm–Šídák/.test(r), 'no silent fallback');
});

test('01 Rank Product: average ranks for ties (no row-order artefact) and Heskes et al. (2014) p-values', async () => {
  const r = await app.page.evaluate(() => {
    const z = Array.from({ length: 100 }, () => [0, 0, 0]);
    const zeros = rankProductTest(z, z, 'delta');
    // partly tied data, run forward and with the rows reversed
    const rnd = _mulberry32(11), A = [], B = [];
    for (let i = 0; i < 100; i++) { A.push([0, 0, 0]); B.push([0, 1, 2].map(() => Math.round((rnd() - 0.5) * 4) / 2)); }
    const fw = rankProductTest(A, B, 'delta'), rv = rankProductTest([...A].reverse(), [...B].reverse(), 'delta');
    let maxDiff = 0; fw.forEach((x, i) => { const y = rv[99 - i]; maxDiff = Math.max(maxDiff, Math.abs(x.pUp - y.pUp), Math.abs(x.pDown - y.pDown)); });
    return { z0: zeros[0], z99: zeros[99], zMinQ: Math.min(...zeros.map(x => Math.min(x.qUp, x.qDown))), tied: zeros.tiedShare,
      maxDiff, both: fw.some(x => x.qUp < 0.05 && x.qDown < 0.05),
      heskes: rankProductP(9282, 9047, 4), untied: rankProductP(1, 10, 3).p, small: rankProductP(8, 20, 3).p };
  });
  // all-zero data: every row shares midrank 50.5 in every replicate, so nothing is significant and row 1 = row 100
  assert.strictEqual(r.z0.pUp, r.z99.pUp); assert.ok(r.zMinQ >= 0.05, 'no discoveries, min q ' + r.zMinQ);
  close(r.z0.pUp, 0.6571119, 1e-6); assert.strictEqual(r.tied, 1);
  assert.ok(r.maxDiff < 1e-12, 'row order does not change p: ' + r.maxDiff); assert.ok(!r.both, 'no row called both up and down');
  // Heskes, Eisinga & Breitling 2014, Table 1 (n = 9047, k = 4, rho = 9282): upper 3.888e-10, geometric 2.709e-10, lower 1.887e-10
  close(r.heskes.upper, 3.888e-10, 1e-3); close(r.heskes.p, 2.709e-10, 1e-3); close(r.heskes.lower, 1.887e-10, 1e-3);
  close(r.untied, 0.001, 1e-9);            // exact enumeration: 1/10^3 (the continuous formula gave 0.0318)
  close(r.small, 0.004811345, 1e-6);       // n = 20, k = 3, rho = 8 (exact 0.00475; RankProd 3.x 0.00481)
  const ui = await run(tbl([col('A', Array.from({ length: 20 }, () => [0, 0, 0])), col('B', Array.from({ length: 20 }, () => [0, 0, 0]))]), 'rankprod');
  assert.match(ui.text, /tied/i); assert.match(ui.text, /Heskes/);
});

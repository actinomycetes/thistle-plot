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

test('01 Rank Product: average ranks for ties and exact p-values from each replicate\'s own ranks (re-review)', async () => {
  // References: tools/validate/rankprod_refs.py (exact integer counting / full enumeration, standard library only).
  const r = await app.page.evaluate(() => {
    const z = Array.from({ length: 100 }, () => [0, 0, 0]);
    const zeros = rankProductTest(z, z, 'delta');
    const rnd = _mulberry32(11), A = [], B = [];
    for (let i = 0; i < 100; i++) { A.push([0, 0, 0]); B.push([0, 1, 2].map(() => Math.round((rnd() - 0.5) * 4) / 2)); }
    const fw = rankProductTest(A, B, 'delta'), rv = rankProductTest([...A].reverse(), [...B].reverse(), 'delta');
    let maxDiff = 0; fw.forEach((x, i) => { const y = rv[99 - i]; maxDiff = Math.max(maxDiff, Math.abs(x.pUp - y.pUp), Math.abs(x.pDown - y.pDown)); });
    // re-review fixture: 36 rows, A all 0, B = [1,1] for 2 rows and [0,0] for 34
    const fx = rankProductTest(Array.from({ length: 36 }, () => [0, 0]), Array.from({ length: 36 }, (_, i) => i < 2 ? [1, 1] : [0, 0]), 'delta');
    // untied: rank r in every replicate of n rows -> product r^k (rows with effects n..1 so row j has rank j+1)
    const untied = (n, k, row) => rankProductTest(Array.from({ length: n }, () => Array(k).fill(0)), Array.from({ length: n }, (_, j) => Array(k).fill(n - j)), 'delta')[row].pUp;
    // tied, unequal replicate sizes (replicate 2 has two blanks): effects up = [5,5,5,2,1,1,0] and [3,3,1,0,0,-,-]
    const e1 = [5, 5, 5, 2, 1, 1, 0], e2 = [3, 3, 1, 0, 0, NaN, NaN];
    const tu = rankProductTest(e1.map(() => [0, 0]), e1.map((v, i) => [v, e2[i]]), 'delta');
    return { z0: zeros[0], z99: zeros[99], zMinQ: Math.min(...zeros.map(x => Math.min(x.qUp, x.qDown))), tied: zeros.tiedShare, maxDiff,
      both: fw.some(x => x.qUp < 0.05 && x.qDown < 0.05), fxP: fx[0].pUp, fxQ: fx[0].qUp, fxCalls: fx.filter(x => x.qUp < 0.05).length,
      u331: untied(3, 3, 0), u20: untied(20, 3, 1), u200: untied(200, 4, 0), tu: [tu[0].pUp, tu[3].pUp, tu[4].pUp] };
  });
  // all-zero data: every row has the same rank in every replicate, so p = 1 for all rows and the row order cannot matter
  assert.strictEqual(r.z0.pUp, r.z99.pUp); close(r.z0.pUp, 1, 1e-12); assert.ok(r.zMinQ >= 0.05); assert.strictEqual(r.tied, 1);
  assert.ok(r.maxDiff < 1e-12, 'row order does not change p: ' + r.maxDiff); assert.ok(!r.both, 'no row called both up and down');
  // re-review: exact tie-preserving null gives (2/36)^2 = 0.00308642, BH q = 0.0555556, no calls (Heskes gave 0.00262, q 0.0471, 2 calls)
  close(r.fxP, 0.0030864197530864196, 1e-9); close(r.fxQ, 0.05555555555555555, 1e-9); assert.strictEqual(r.fxCalls, 0);
  close(r.u331, 1 / 27, 1e-12);                       // product 1 of 3 ranks of 3: exactly 1/27
  close(r.u20, 0.00475, 1e-9);                        // n = 20, k = 3, rank 2 everywhere (product 8): exact 0.00475 (Heskes 0.00481)
  close(r.u200, 6.25e-10, 1e-9);                      // n = 200, k = 4, product 1: 1/200^4 (rankprod_refs.py)
  close(r.tu[0], 0.17142857142857143, 1e-6);          // ranks (2, 1.5) of 7 and 5: exact enumeration 0.171429
  close(r.tu[1], 0.8, 1e-6);                          // ranks (4, 4.5): 0.8
  close(r.tu[2], 0.9428571428571428, 1e-6);           // ranks (5.5, 4.5): 0.942857
  const ui = await run(tbl([col('A', Array.from({ length: 20 }, () => [0, 0, 0])), col('B', Array.from({ length: 20 }, () => [0, 0, 0]))]), 'rankprod');
  assert.match(ui.text, /tied/i); assert.match(ui.text, /each replicate/i);
});

test('01 Rank Product p-values agree with exact counting for untied ranks (rankProductTail)', async () => {
  // P(product of k uniform ranks 1..n <= rho), exact integer counts from tools/validate/rankprod_refs.py
  const r = await app.page.evaluate(() => [[3, 3, 2], [20, 3, 8], [50, 3, 100], [200, 4, 5000], [1000, 2, 37]].map(([n, k, rho]) => {
    const ranks = Float64Array.from({ length: n }, (_, i) => i + 1), reps = Array.from({ length: k }, () => ranks);
    return rankProductTail(reps, Math.log(rho) - k * Math.log(n));
  }));
  const exact = [4 / 27, 0.00475, 0.010568, 0.0003618375, 0.000142];
  r.forEach((x, i) => { assert.ok(x.lower <= exact[i] * (1 + 1e-9) && x.upper >= exact[i] * (1 - 1e-9), `bounds bracket exact ${exact[i]}: ${x.lower}..${x.upper}`);
    assert.ok(x.p >= exact[i] * (1 - 1e-9) && x.p <= exact[i] * 1.05, `p = upper bound within 5% of exact ${exact[i]}: ${x.p}`); });
});

test('re-review: a flat dose response has no EC50 (5PL test, 5PL and 4PL curve fits)', async () => {
  const r = await app.page.evaluate(() => {
    const x = [0, 1, 2, 3, 4, 5], y = [5, 5, 5, 5, 5, 5], f5 = fit5PL(x, y), c5 = runRegression(x, y, '5pl'), c4 = runRegression(x, y, '4pl');
    return { f5: { ec50: f5.ec50, hill: f5.hill, flat: f5.flat, bot: f5.params[0], top: f5.params[1] }, c5: c5.params.EC50, c4: c4.params.ec50, c4eq: c4.equation, c5eq: c5.equation };
  });
  assert.ok(Number.isNaN(r.f5.ec50) && Number.isNaN(r.f5.hill) && r.f5.flat, JSON.stringify(r.f5));
  assert.strictEqual(r.f5.bot, 5); assert.strictEqual(r.f5.top, 5);
  assert.ok(Number.isNaN(r.c5) && Number.isNaN(r.c4), 'curve fits give no EC50'); assert.match(r.c4eq, /flat/i); assert.match(r.c5eq, /flat/i);
  const ui = await run(tbl([col('Dose', [[0], [1], [2], [3], [4], [5]]), col('Resp', [[5], [5], [5], [5], [5], [5]])]), 'dose');
  assert.match(ui.text, /no midpoint/i); assert.match(ui.text, /EC50[^—]*—/);
});

test('re-review: the printed polynomial equation reproduces the fitted values', async () => {
  const r = await app.page.evaluate(() => {
    const evalEq = (eq, x) => { // read back "y = a + b(x − m) + c(x − m)^2" or "y = a + bx + cx^2"
      const m = eq.match(/\(x − ([-\d.e+]+)\)/), c = m ? +m[1] : 0, u = x - c;
      return eq.replace(/^y = /, '').split(' + ').reduce((s, t) => { const k = t.match(/\^(\d+)/) ? +t.match(/\^(\d+)/)[1] : /x/.test(t) ? 1 : 0; return s + parseFloat(t) * u ** k; }, 0);
    };
    const X = Array.from({length:6}, (_,i)=>1e12+i), Y = [3, 4, 19, 84, 259, 628], f = fitPolynomial(X, Y, 4);
    const low = fitPolynomial([0, 1, 2, 3], [1, 4, 9, 16], 2);
    return { eq: f.equation, err: Math.max(...X.map((x, i) => Math.abs(evalEq(f.equation, x) - f.pred[i]))), low: low.equation, lowErr: Math.max(...[0, 1, 2, 3].map((x, i) => Math.abs(evalEq(low.equation, x) - low.pred[i]))) };
  });
  assert.ok(r.err < 0.05, `printed equation off by ${r.err}: ${r.eq}`);   // values span 3..628; 5 significant figures
  assert.match(r.eq, /x − 1000000000002\.5/);
  assert.strictEqual(r.low, 'y = 1.0000 + 2.0000x + 1.0000x^2'); assert.ok(r.lowErr < 1e-3);
});

test('re-review: KS with ties says its p-value is computed as for untied data', async () => {
  const ui = await run(tbl([col('A', [[0], [0], [0], [0]]), col('B', [[0], [1], [1], [1]])]), 'ks', { 'opt-ks-mode': 'two' });
  assert.ok(!/p-value \(exact\)/.test(ui.text), 'not labelled plainly exact'); assert.match(ui.text, /as if there were no ties/i);
});

test('dose fits preserve EC50 after changing response units', async () => {
  const results = await app.page.evaluate(() => {
    const x = [0, 1, 2, 4, 8, 16, 32], y = x.map(v => v / (4 + v));
    return ['4pl','5pl'].map(model => [1,1e-13].map(scale => {
      const r = runRegression(x,y.map(v => scale*v),model);
      return r.params.ec50 ?? r.params.EC50;
    }));
  });
  results.forEach(([a,b]) => close(a,b,0.001));
});

test('rank product excludes low coverage from BH and exposes both bounds', async () => {
  const r = await app.page.evaluate(() => {
    const a = [[0,0],[0,0],[0,NaN]], b = [[3,3],[1,1],[2,NaN]];
    return rankProductTest(a,b,'delta',2,true);
  });
  assert.ok(Number.isNaN(r[2].qUp));
  assert.ok(r[0].lowerUp <= r[0].pUp && r[0].pUp <= r[0].qUp);
});

test('rank product with one replicate pair uses every row by default', async () => {
  const A = Array.from({ length: 50 }, () => [0]), B = Array.from({ length: 50 }, (_, i) => [i < 3 ? 10 + i : Math.sin(i)]);
  const ui = await run(tbl([col('A', A), col('B', B)]), 'rankprod');
  assert.match(ui.text, /50 rows, 1 replicate pairs/, 'every row counted (the minimum of 2 left none)');
  const q = await app.page.evaluate(([a, b]) => rankProductTest(a, b, 'delta').slice(0, 3).map(r => r.qUp), [A, B]);
  assert.ok(q.every(Number.isFinite), 'q-values exist: ' + q);
});

test('rank product result describes the p-value bounds without calling them narrow', async () => {
  const b = await app.page.evaluate(() => { const r = Float64Array.from([1, 2, 3]); return rankProductTail([r, r, r], Math.log(2 / 27)); });
  close(b.upper, 4 / 27, 1e-9); // exact P(product of 3 ranks of 3 <= 2) = 4/27; the lower bound can be far below it
  const ui = await run(tbl([col('A', Array.from({ length: 20 }, () => [0, 0, 0])), col('B', Array.from({ length: 20 }, (_, i) => [i, i + 1, i + 2]))]), 'rankprod');
  assert.ok(!/narrow/i.test(ui.text), 'no "narrow" claim'); assert.match(ui.text, /upper bound/);
});

test('PR2: whitespace-only cells are ignored identically to blank cells across data readers', async () => {
  const r = await app.page.evaluate(() => {
    applyG({ nReps: 2, nRows: 2, rowNames: ['R1', 'R2'], groups: [
      { name: 'A', reps: ['Rep1', 'Rep2'], data: [[1, ' '], [2, '\t']] },
      { name: 'B', reps: ['Rep1', 'Rep2'], data: [[10, 20], [30, 40]] },
    ] });
    const kmG = { nReps: 1, nRows: 3, rowNames: ['S1', 'S2', 'S3'], groups: [
      { name: 'Time', reps: ['V'], data: [[5], [' '], [10]] },
      { name: 'Ctrl', reps: ['V'], data: [[1], [' '], [0]] },
      { name: 'Trt', reps: ['V'], data: [[' '], [1], [' ']] },
    ] };
    const vals = {
      cnSpace: Number.isNaN(cellNum(' ')), cnTab: Number.isNaN(cellNum('\t')), cnZero: cellNum('0'),
      grp: getGroupVals(0), pooled: getGroupPooled(0), row0: rowsOf(0, 0), grpRows: getGroupRows(0),
      paired: pairedCells(0, 1), xy: xyPairs(0, 1),
      pcaMean: buildPCAMatrix('mean', false).X[0],
      pcaRepsFeats: buildPCAMatrix('reps', false).feats,
    };
    applyG(kmG);
    const km = kmGroups();
    return { ...vals, kmGroups: km.groups.map(g => ({ name: g.name, n: g.t.length })) };
  });
  assert.strictEqual(r.cnSpace, true); assert.strictEqual(r.cnTab, true); assert.strictEqual(r.cnZero, 0);
  assert.deepStrictEqual(r.grp, [1, 2]);
  assert.deepStrictEqual(r.pooled, [1, 2]);
  assert.deepStrictEqual(r.row0, [1]);
  assert.deepStrictEqual(r.grpRows, [[1], [2]]);
  assert.deepStrictEqual(r.paired.a, [1, 2]); assert.deepStrictEqual(r.paired.b, [10, 30]);
  assert.deepStrictEqual(r.xy.x, [1, 2]); assert.deepStrictEqual(r.xy.y, [10, 30]);
  assert.deepStrictEqual(r.pcaMean, [1, 2]);
  assert.deepStrictEqual(r.pcaRepsFeats, []);
  assert.deepStrictEqual(r.kmGroups, [{ name: 'Ctrl', n: 2 }]);
  assert.deepStrictEqual(app.errors, []);
});

test('PR2: importRows parses numbers strictly without truncating dates, IDs, or unit strings', async () => {
  const r = await app.page.evaluate(() => {
    importRows([
      ['Sample', 'Date', 'Dose', 'ID', 'Pct', 'Val'],
      ['S1', '2026-01-15', '12mg', '001_ctrl', '10%', '3.5'],
      ['S2', '   ', '25', '002_trt', ' ', '7.2'],
      [' ', ' ', ' ', ' ', ' ', ' '],
    ], 'strict.csv');
    return { nRows: G.nRows, groups: G.groups.map(g => ({ name: g.name, data: g.data })) };
  });
  assert.strictEqual(r.nRows, 2, 'whitespace-only row dropped');
  assert.deepStrictEqual(r.groups.find(g => g.name === 'Date').data, [[''], ['']]);
  assert.deepStrictEqual(r.groups.find(g => g.name === 'Dose').data, [[''], [25]]);
  assert.deepStrictEqual(r.groups.find(g => g.name === 'ID').data, [[''], ['']]);
  assert.deepStrictEqual(r.groups.find(g => g.name === 'Pct').data, [[''], ['']]);
  assert.deepStrictEqual(r.groups.find(g => g.name === 'Val').data, [[3.5], [7.2]]);
});

test('PR2: auto-plot transfers #opt-norm to #popt-norm', async () => {
  const r = await app.page.evaluate(async () => {
    loadExampleKey('groups');
    const a = document.getElementById('asel'); a.value = 'ttest_ind'; a.dispatchEvent(new Event('change'));
    await new Promise(res => setTimeout(res, 60));
    document.getElementById('opt-norm').value = 'log2';
    document.getElementById('opt-autoplot').checked = true;
    runAnalysis();
    await new Promise(res => setTimeout(res, 250));
    return { pnorm: document.getElementById('popt-norm')?.value };
  });
  assert.strictEqual(r.pnorm, 'log2');
  assert.deepStrictEqual(app.errors, []);
});

test('PR2: _tickFmt and fmtParam format small/large values in scientific notation (nanomolar EC50)', async () => {
  const r = await app.page.evaluate(() => ({
    tSmall: _tickFmt(2e-7, [0, 1e-7, 2e-7]), tZero: _tickFmt(0, [0, 1e-7, 2e-7]), tBig: _tickFmt(1.5e7, [0, 5e6, 1e7, 1.5e7]),
    pSmall: fmtParam(1.5e-7, 3), pNorm: fmtParam(0.823, 3), pBig: fmtParam(2.4e6, 3),
  }));
  assert.match(r.tSmall, /2\.0e-7/i); assert.strictEqual(r.tZero, '0'); assert.match(r.tBig, /1\.5e\+7/i);
  assert.match(r.pSmall, /1\.500e-7/i); assert.strictEqual(r.pNorm, '0.823'); assert.match(r.pBig, /2\.400e\+6/i);
  const doses = [1e-10, 3e-10, 1e-9, 3e-9, 1e-8, 3e-8, 1e-7, 3e-7, 1e-6, 3e-6, 1e-5];
  const resp = doses.map(d => 5 + 95 / (1 + (1.5e-7 / d)));
  const ui = await run(tbl([col('Dose (M)', doses.map(v => [v])), col('Resp', resp.map(v => [v]))]), 'dose');
  assert.match(ui.text, /1\.50\de-7/i);
  assert.ok(!/EC50[^0-9]*0\.000\b/.test(ui.text), 'EC50 should not collapse to 0.000: ' + ui.text);
});

test('PR2: plots handle >10 groups, non-finite log2 values, empty cells, high-scale violins, and PCA mean mode', async () => {
  const r = await app.page.evaluate(async () => {
    // 12 groups: G1 has a 0 (non-finite under log2), G12 is completely blank
    const groups = Array.from({ length: 12 }, (_, i) => ({
      name: 'G' + (i + 1), reps: ['R1', 'R2'],
      data: i === 11 ? [['', ''], ['', '']] : [[i === 0 ? 0 : i + 2, i + 3], [i === 1 ? '' : i + 4, i === 1 ? '' : i + 5]],
    }));
    applyG({ nReps: 2, nRows: 2, rowNames: ['S1', 'S2'], groups });
    const runP = async (type, opts = {}) => {
      const ps = document.getElementById('psel'); ps.value = type; ps.dispatchEvent(new Event('change'));
      await new Promise(res => setTimeout(res, 40));
      for (const [k, v] of Object.entries(opts)) { const el = document.getElementById(k); if (el) el.value = v; }
      newPlot(); await new Promise(res => setTimeout(res, 150));
      return chartInst[activePT];
    };
    const barByG = await runP('bar_sd', { 'popt-norm': 'log2', 'popt-groupby': 'group' });
    const barHasUndef = barByG.data.datasets.some(d => JSON.stringify(d.backgroundColor).includes('undefined'));
    const g1BarVal = barByG.data.datasets[0].data[0];
    const emptyGrpVal = barByG.data.datasets[0].data[11];
    // By-sample bar plot uses canvasTab
    await runP('bar_sd', { 'popt-norm': 'log2', 'popt-groupby': 'sample' });
    const barSCanvas = document.querySelector('#plot-content .tab-page.active canvas');
    const barSDrawn = !!(barSCanvas && barSCanvas.width > 0 && barSCanvas.height > 0);
    const lineCh = await runP('line', { 'popt-norm': 'log2' });
    const lineHasUndef = lineCh.data.datasets.some(d => String(d.borderColor).includes('undefined'));
    const lineEmptyVal = lineCh.data.datasets[11]?.data[0];
    const histCh = await runP('histogram');
    const histHasUndef = histCh.data.datasets.some(d => String(d.backgroundColor).includes('undefined'));
    // High-scale violin (constant group at 1.5e5 + spread group) in both/reps/groupmean
    applyG({ nReps: 2, nRows: 3, rowNames: ['R1', 'R2', 'R3'], groups: [
      { name: 'Const', reps: ['R1', 'R2'], data: [[1.5e5, 1.5e5], [1.5e5, 1.5e5], [1.5e5, 1.5e5]] },
      { name: 'Spread', reps: ['R1', 'R2'], data: [[1.4e5, 1.45e5], [1.5e5, 1.55e5], [1.6e5, 1.65e5]] },
    ] });
    await runP('violin', { 'popt-dispmode': 'both', 'popt-dottype': 'groupmean' });
    const vCanvas = document.querySelector('#plot-content .tab-page.active canvas');
    const vDrawn = !!(vCanvas && vCanvas.width > 0 && vCanvas.height > 0);
    await runP('violin', { 'popt-dispmode': 'reps' });
    // PCA mean mode with colBy = 'rep'
    loadExampleKey('genes');
    await runP('pca', { 'popt-pcmode': 'mean', 'popt-pccol': 'rep' });
    const pcaTab = plotTabs[plotTabs.length - 1];
    pcaReplot(pcaTab.id);
    return { barHasUndef, g1BarVal, emptyGrpVal, barSDrawn, lineHasUndef, lineEmptyVal, histHasUndef, vDrawn };
  });
  assert.strictEqual(r.barHasUndef, false);
  assert.ok(Number.isFinite(r.g1BarVal), 'G1 bar mean stays finite after filtering log2(0): ' + r.g1BarVal);
  assert.strictEqual(r.emptyGrpVal, null, 'empty group should not plot a phantom 0 bar');
  assert.strictEqual(r.barSDrawn, true);
  assert.strictEqual(r.lineHasUndef, false);
  assert.strictEqual(r.lineEmptyVal, null);
  assert.strictEqual(r.histHasUndef, false);
  assert.strictEqual(r.vDrawn, true);
  assert.deepStrictEqual(app.errors, []);
});

test('PR2: HTML special characters in group, row, and dataset names are escaped safely', async () => {
  const xssName = '<img src=x onerror="window.__tpXss=1">';
  const label = 'CD4+ <10% & "ctrl"';
  const ui = await run(tbl([
    col(label, [[1, 2], [3, 4], [5, 6]]),
    col(xssName, [[7, 8], [9, 10], [11, 12]]),
  ], ['Gene <A>', 'Gene & B', xssName]), 'ttest_ind');
  const check = await app.page.evaluate(() => ({
    xss: window.__tpXss || null,
    imgs: document.querySelectorAll('#stats-content img, #data-strip img, #dtbl img').length,
  }));
  assert.strictEqual(check.xss, null);
  assert.strictEqual(check.imgs, 0);
  assert.ok(ui.text.includes(label), 'label text preserved: ' + ui.text);
  assert.ok(ui.text.includes(xssName), 'raw angle-bracket label shown as text, not HTML');
  assert.deepStrictEqual(app.errors, []);
});

test('PCA and Jacobi eigensolver are scale-invariant at 1e-6 magnitude', async () => {
  const r = await app.page.evaluate(() => {
    const X = [[1, 2, 3, 4], [2, 4, 5, 8], [5, 1, 2, 1], [6, 3, 4, 2]];
    const a = pcaCompute(X), b = pcaCompute(X.map(row => row.map(v => v * 1e-6)));
    return { va: a.varExplained, vb: b.varExplained, sa: a.scores[0], sb: b.scores[0].map(v => v / 1e-6) };
  });
  assert.strictEqual(r.va.length, 3);
  assert.strictEqual(r.vb.length, 3);
  r.va.forEach((v, i) => close(r.vb[i], v, 1e-6));
  r.sa.forEach((v, i) => close(Math.abs(r.sb[i]), Math.abs(v), 1e-6));
});

test('Shapiro–Wilk returns p = 1 when W = 1 and stays shift-invariant at +1e15', async () => {
  const r = await app.page.evaluate(() => {
    const m = Array.from({ length: 5 }, (_, i) => jStat.normal.inv((i + 1 - 0.375) / 5.25, 0, 1));
    const mm = m.reduce((s, v) => s + v * v, 0), u = 1 / Math.sqrt(5);
    const an = -m[0] / Math.sqrt(mm) + [0, 0.221157, -0.147981, -2.071190, 4.434685, -2.706056].reduce((s, c, k) => s + c * Math.pow(u, k), 0);
    const eps = Math.sqrt((mm - 2 * m[0] ** 2) / (1 - 2 * an ** 2));
    const exact = shapiroWilk([-an, m[1] / eps, m[2] / eps, m[3] / eps, an]);
    const base = [1, 2, 3, 4, 5, 10, 20, 50];
    const s0 = shapiroWilk(base), s1 = shapiroWilk(base.map(v => v + 1e14));
    return { exact, s0, s1 };
  });
  assert.strictEqual(r.exact.W, 1);
  assert.strictEqual(r.exact.p, 1);
  close(r.s1.W, r.s0.W, 1e-9);
  close(r.s1.p, r.s0.p, 1e-9);
});

test('per-row paired Ratio t-test refuses normalization just like standard mode', async () => {
  const G = tbl([col('A', [[4, 8, 16]]), col('B', [[2, 2, 4]])]);
  const bad = await run(G, 'ttest_rel', { 'opt-ptype': 'ratio', 'opt-norm': 'log2', 'opt-perrow': true });
  assert.ok(isError(bad), bad.text);
  assert.match(bad.text, /Difference/);
});

test('4PL and 5PL keep Bottom <= Top and 4PL refuses under-determined doses', async () => {
  const r = await app.page.evaluate(() => {
    const dx = [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100], dy = [2.1, 2.9, 5.2, 11.8, 27.5, 52.1, 74.9, 86.2, 90.3];
    const nx = [1e-9, 3e-9, 1e-8, 3e-8, 1e-7, 3e-7, 1e-6, 3e-6, 1e-5], ny = nx.map(x => 5 + 95 / (1 + Math.pow(1.5e-7 / x, 1.3)));
    const f4 = fit4PL(dx, dy), f5 = fit5PL(dx, dy), n4 = fit4PL(nx, ny), n5 = fit5PL(nx, ny);
    const few = fit4PL([1, 1, 1, 10, 10, 10], [5, 6, 7, 90, 91, 92]);
    const zeros = fit4PL([0, 0, 0, 0, 0], [1, 2, 3, 4, 5]);
    return { f4: f4.params, f5: { bot: f5.params[0], top: f5.params[1] }, n4: n4.params, n5: { bot: n5.params[0], top: n5.params[1] }, few: few.error, zeros: zeros.error };
  });
  assert.ok(r.f4.bot < r.f4.top, `4PL bot=${r.f4.bot} top=${r.f4.top}`);
  assert.ok(r.f5.bot < r.f5.top, `5PL bot=${r.f5.bot} top=${r.f5.top}`);
  close(r.f4.bot, 1.8934, 1e-3); close(r.f4.top, 92.4575, 1e-3);
  close(r.n4.bot, 5, 1e-3); close(r.n4.top, 100, 1e-3);
  close(r.n5.bot, 5, 1e-3); close(r.n5.top, 100, 1e-3);
  assert.ok(r.few && r.zeros, 'under-determined 4PL refused');
});

test('Kruskal–Wallis omits empty groups with a note and refuses all-identical values', async () => {
  const r = await app.page.evaluate(() => ({
    empty: kruskalWallis([[1, 2, 3], [4, 5, 6], []]),
    ident: kruskalWallis([[5, 5, 5], [5, 5, 5], [5, 5, 5]])
  }));
  assert.ok(r.empty.error, 'direct empty group guarded');
  assert.ok(r.ident.error, 'all-identical guarded');
  const ui = await run(tbl([col('A', [[1], [2], [3]]), col('B', [[''], [''], ['']]), col('C', [[4], [5], [6]])]), 'kruskal');
  assert.ok(!isError(ui), ui.text);
  assert.match(ui.text, /Left out: B/i);
  assert.match(ui.text, /A.*C/);
  const uiId = await run(tbl([col('A', [[5], [5], [5]]), col('B', [[5], [5], [5]])]), 'kruskal');
  assert.ok(isError(uiId), uiId.text);
});

test('chi2P and dunnettP preserve extreme tail precision without cancellation', async () => {
  const r = await app.page.evaluate(() => ({
    c75: chi2P(75, 1), c100: chi2P(100, 1), c50_5: chi2P(50, 5), c200_50: chi2P(200, 50),
    d30: dunnettP([15], 10, [10, 10], 30)[0],
    d1500: dunnettP([8], 500, [500, 500], 1500)[0],
    d2001: dunnettP([4], 700, [700, 700], 2001)[0],
    // Single comparison, n=2 per group (df=2): exact two-sided tail is 2 / (sqrt(t^2+2) * (sqrt(t^2+2)+|t|))
    m1_df2: [2, 20, 200].map(t => ({ t, p: dunnettP([t], 2, [2], 2)[0], q: _mvtTailProb(t, [Math.SQRT1_2], 2) })),
    // Multiple comparisons at low df and large t: compare against high-precision reference, marginal/Bonferroni bounds, and tighter tolerance
    m2_df2: [2, 20, 200].map(t => ({
      t,
      p: dunnettP([t], 2, [2, 2], 2)[0],
      tight: _mvtTailProb(t, [Math.SQRT1_2, Math.SQRT1_2], 2, 1e-11),
      marg: tP2(t, 2)
    })),
    m3_df3_50: {
      p: dunnettP([50], 2, [2, 2, 2], 3)[0],
      tight: _mvtTailProb(50, [Math.SQRT1_2, Math.SQRT1_2, Math.SQRT1_2], 3, 1e-11),
      marg: tP2(50, 3)
    },
    // Imbalanced high-correlation design (small shared control, large treatments): correlation rho = 2000/2002
    imbal: {
      p: dunnettP([1.92, 1.92], 2, [2000, 2000], 3999)[0],
      marg: tP2(1.92, 3999),
      mixed: dunnettP([1.92, 1.92], 2, [2, 2000], 2001)[0],
      mixedMarg: tP2(1.92, 2001)
    }
  }));
  close(r.c75, 4.707140590140393e-18, 1e-9);
  close(r.c100, 1.523970604832100e-23, 1e-9);
  close(r.c50_5, 1.385797336700959e-9, 1e-9);
  close(r.c200_50, 7.857610724654744e-20, 1e-9);
  close(r.d30, 3.49810744e-15, 1e-4);
  close(r.d1500, 4.93436145e-15, 1e-4);
  close(r.d2001, 1.30250665e-4, 1e-4);
  for (const row of r.m1_df2) {
    const rad = Math.sqrt(row.t * row.t + 2);
    const exact = 2 / (rad * (rad + Math.abs(row.t)));
    close(row.p, exact, 1e-9, `dunnettP m=1 df=2 t=${row.t}`);
    close(row.q, exact, 1e-7, `_mvtTailProb m=1 df=2 t=${row.t}`);
  }
  const refM2 = { 2: 2.744519558924e-1, 20: 3.862126673941e-3, 200: 3.878159579591e-5 };
  for (const row of r.m2_df2) {
    close(row.p, refM2[row.t], 1e-6, `dunnettP m=2 df=2 t=${row.t}`);
    close(row.p, row.tight, 1e-7, `dunnettP m=2 df=2 t=${row.t} convergence`);
    assert.ok(row.p >= row.marg && row.p <= Math.min(1, 2 * row.marg), `m=2 df=2 t=${row.t} within [marginal, Bonferroni]`);
  }
  close(r.m3_df3_50.p, 3.811396525400e-5, 1e-6, 'dunnettP m=3 df=3 t=50');
  close(r.m3_df3_50.p, r.m3_df3_50.tight, 1e-7, 'dunnettP m=3 df=3 t=50 convergence');
  assert.ok(r.m3_df3_50.p >= r.m3_df3_50.marg && r.m3_df3_50.p <= Math.min(1, 3 * r.m3_df3_50.marg), 'm=3 df=3 t=50 within [marginal, Bonferroni]');
  close(r.imbal.p, 0.05718282225, 1e-5, 'dunnettP imbalanced small control [2000,2000] df=3999 t=1.92');
  assert.ok(r.imbal.p > r.imbal.marg && r.imbal.p <= 2 * r.imbal.marg, 'imbalanced Dunnett strictly above single-comparison lower bound and <= Bonferroni');
  assert.ok(r.imbal.mixed > r.imbal.mixedMarg && r.imbal.mixed <= 2 * r.imbal.mixedMarg, 'mixed [2,2000] Dunnett within [marginal, Bonferroni]');
});

test('Kaplan–Meier validates times/events, handles early-censored groups in logRankK, and guards 0-event HR', async () => {
  const negT = await run(tbl([col('Time', [[-5], [10], [20]]), col('A', [[1], [1], [0]])]), 'km');
  assert.ok(isError(negT), negT.text); assert.match(negT.text, /negative/i);
  const badE = await run(tbl([col('Time', [[5], [10], [20]]), col('A', [[2], [1], [0]])]), 'km');
  assert.ok(isError(badE), badE.text); assert.match(badE.text, /1 \(event\) or 0/);
  const lr = await app.page.evaluate(() => {
    const s2 = [{ t: 5, e: 1, g: 0 }, { t: 10, e: 1, g: 0 }, { t: 15, e: 0, g: 0 }, { t: 3, e: 1, g: 1 }, { t: 6, e: 1, g: 1 }, { t: 9, e: 1, g: 1 }];
    const s3 = [...s2, { t: 1, e: 0, g: 2 }, { t: 2, e: 0, g: 2 }];
    return { r2: logRankK(s2, 2), r3: logRankK(s3, 3) };
  });
  assert.strictEqual(lr.r3.df, 1);
  close(lr.r3.chi, lr.r2.chi, 1e-9);
  close(lr.r3.p, lr.r2.p, 1e-9);
  const zeroEv = await run(tbl([col('Time', [[5], [10], [15], [20]]), col('A', [[1], [1], [''], ['']]), col('B', [[''], [''], [0], [0]])]), 'km');
  assert.ok(!isError(zeroEv), zeroEv.text);
  assert.match(zeroEv.text, /not estimable/i);
});

test('two-way ANOVA requires nA >= 2 and nB >= 2; Pearson r at n = 3 leaves 95% CI undefined', async () => {
  const r = await app.page.evaluate(() => ({
    tw: twowayANOVA([[1, 2, 3], [4, 5, 6]], 2, 1),
    pr3: pearsonR([1, 2, 3], [1, 3, 2]),
    prPerf: pearsonR([1, 2, 3, 4], [2, 4, 6, 8])
  }));
  assert.ok(r.tw.error, '1-level factor refused');
  assert.ok(Number.isNaN(r.pr3.ci95lo) && Number.isNaN(r.pr3.ci95hi), 'n=3 CI is NaN');
  assert.ok(Number.isNaN(r.prPerf.ci95lo) && Number.isNaN(r.prPerf.ci95hi), '|r|=1 CI is NaN');
  const ui = await run(tbl([col('X', [[1], [2], [3]]), col('Y', [[1], [3], [2]])]), 'pearson');
  assert.match(ui.text, /\[—, —\]/);
});

test('regress, mtc, and volcano handle constant X, centred poly params, negative R2, NaN p-values, and top up-regulated sorting', async () => {
  const lin = await app.page.evaluate(() => ({
    lin: fitLinear([5, 5, 5], [1, 2, 3]),
    log: fitLogarithmic([5, 5, 5], [1, 2, 3]),
    exp: fitExponential([5, 5, 5], [1, 2, 3]),
    pow: fitPower([5, 5, 5], [1, 2, 3])
  }));
  Object.entries(lin).forEach(([k, v]) => assert.ok(v.error, k + ' constant X refused'));
  // Centred polynomial parameter table matches centred equation (no 1e48 values)
  const polyUI = await run(tbl([col('X', Array.from({ length: 6 }, (_, i) => [1e12 + i])), col('Y', [[3], [4], [19], [84], [259], [628]])]), 'regress', { 'opt-rmodel': 'poly4' });
  assert.match(polyUI.text, /c1 \(x − 1000000000002\.5\)/);
  assert.ok(!/e\+4\d/.test(polyUI.text), 'no cancelled 1e48 parameter');
  // Negative R^2 is not clamped to 0 on exponential fit to strongly non-exponential data
  const expUI = await run(tbl([col('X', [[0], [1], [2], [3], [4]]), col('Y', [[100], [1], [100], [1], [100]])]), 'regress', { 'opt-rmodel': 'exp' });
  assert.match(expUI.text, /R² = -/);
  // MTC counts only valid p-values and puts invalid NaN rows at the bottom when > 200 rows
  const pRows = Array.from({ length: 205 }, (_, i) => [i < 5 ? 1.5 : (i - 4) / 250]);
  const mtcUI = await run(tbl([col('P', pRows)]), 'mtc');
  assert.match(mtcUI.text, /200 tests/);
  const firstRowMatch = mtcUI.html.match(/<tbody>\s*<tr><td>([^<]+)<\/td>/);
  assert.strictEqual(firstRowMatch && firstRowMatch[1], 'Row 6', 'smallest valid p is first, not NaN');
  // Volcano Top Up-regulated sorts by ascending p-value
  const fc = Array.from({ length: 15 }, (_, i) => [i === 14 ? 5 : 2]);
  const pv = Array.from({ length: 15 }, (_, i) => [i === 14 ? 1e-8 : 0.04]);
  const vNames = Array.from({ length: 15 }, (_, i) => 'Gene' + (i + 1));
  const volUI = await run(tbl([col('FC', fc), col('P', pv)], vNames), 'volcano');
  const topGene = volUI.html.match(/Top Up-regulated<\/h4><table[^>]*><thead>.*?<\/thead><tbody>\s*<tr><td>([^<]+)<\/td>/);
  assert.strictEqual(topGene && topGene[1], 'Gene15', 'most significant up-regulated gene is first');
});


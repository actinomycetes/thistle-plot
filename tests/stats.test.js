// Numerical regression tests. Reference values were cross-checked at v0.8.0 against
// SciPy (dunnett, ks_2samp, logrank) and statsmodels (anova_lm, lilliefors). If one of
// these fails after an edit, the statistics changed: investigate before updating the numbers.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openApp } = require('./helpers');

let app;
before(async () => { app = await openApp(); });
after(async () => { await app.close(); });
const close = (a, b, rel = 1e-3) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} vs ${b}`);

test('Dunnett vs control (exact multivariate t)', async () => {
  const r = await app.page.evaluate(() => {
    const c = [2.1, 2.3, 1.9, 3.2, 2.8], a = [4.5, 4.8, 4.2, 5.1], b = [3.0, 3.2, 2.8, 4.1, 3.8, 4.0];
    const df = c.length + a.length + b.length - 3;
    const MSW = [c, a, b].reduce((s, g) => s + g.reduce((q, x) => q + (x - mean(g)) ** 2, 0), 0) / df;
    const t = [a, b].map(g => (mean(g) - mean(c)) / Math.sqrt(MSW * (1 / g.length + 1 / c.length)));
    return { t, p: dunnettP(t, c.length, [a.length, b.length], df) };
  });
  close(r.t[0], 6.4125, 1e-3); close(r.t[1], 3.3195, 1e-3);
  close(r.p[0], 6.407e-5, 2e-2); close(r.p[1], 0.011344, 2e-2);
});

test('Kolmogorov-Smirnov two-sample (exact) and Lilliefors', async () => {
  const r = await app.page.evaluate(() => {
    const ks = ks2Sample([1.2, 3.4, 2.2, 5.1, 0.3, 2.8, 4.4], [2.5, 6.1, 4.9, 5.5, 7.2, 3.3]);
    const x = []; for (let i = 0; i < 40; i++) x.push(Math.exp(Math.sin(i * 1.7) * 1.3));
    const lf = lillieforsTest(x);
    return { ks, lf: { D: lf.D, p: lf.p } };
  });
  close(r.ks.D, 0.5238095, 1e-5); close(r.ks.p, 0.27739, 1e-3); assert.strictEqual(r.ks.method, 'exact');
  close(r.lf.D, 0.17928, 1e-3); assert.ok(Math.abs(r.lf.p - 0.0025) < 0.001, 'Lilliefors p ' + r.lf.p);
});

test('multiple-comparison adjustments', async () => {
  const r = await app.page.evaluate(() => {
    const p = [0.01, 0.02, 0.03, 0.04];
    return { bonf: adjustP(p, 'bonferroni'), holm: adjustP(p, 'holm'), hs: adjustP(p, 'holm_sidak'), fdr: adjustP(p, 'fdr') };
  });
  assert.deepStrictEqual(r.bonf.map(x => +x.toFixed(6)), [0.04, 0.08, 0.12, 0.16]);
  assert.deepStrictEqual(r.holm.map(x => +x.toFixed(6)), [0.04, 0.06, 0.06, 0.06]);
  // step-down Sidak: 1-(1-p_i)^(m-i+1), then made monotone (never decreasing)
  [1 - Math.pow(0.99, 4), 1 - Math.pow(0.98, 3), 1 - Math.pow(0.97, 2), 1 - Math.pow(0.97, 2)].forEach((e, i) => close(r.hs[i], e, 1e-9));
  assert.deepStrictEqual(r.fdr.map(x => +x.toFixed(6)), [0.04, 0.04, 0.04, 0.04]);
});

// Runs Thistle Plot's own statistics functions (inside index.html, in headless Chromium) on the cases in
// cases.json and prints the results as JSON. compare.py computes the same quantities with SciPy/statsmodels.
const path = require('path');
const { openApp } = require(path.join(__dirname, '..', '..', 'tests', 'helpers'));
const cases = require('./cases.json');
(async () => {
  const app = await openApp();
  try {
    const out = await app.page.evaluate(C => {
      const R = {};
      const pick = (o, k) => Object.fromEntries(k.map(x => [x, o[x]]));
      R.welch = pick(ttestInd(C.a, C.b), ['t', 'df', 'p']);
      R.paired = pick(ttestRel(C.pre, C.post), ['t', 'df', 'p']);
      R.paired_ratio = pick(ttestRel(C.pre, C.post, 'ratio'), ['t', 'df', 'p', 'ratio']);
      R.mw = pick(mannWhitneyU(C.a, C.b), ['U1', 'p', 'method']);
      R.mw_small = pick(mannWhitneyU(C.small1, C.small2), ['U1', 'p', 'method']);
      R.mw_ties = pick(mannWhitneyU(C.tie1, C.tie2), ['U1', 'p', 'method']);
      const big1 = Array.from({ length: 40 }, (_, i) => Math.sin(i * 1.3) * 3 + i * 0.05), big2 = Array.from({ length: 35 }, (_, i) => Math.cos(i * 0.7) * 3 + 1);
      R.mw_large = pick(mannWhitneyU(big1, big2), ['U1', 'p', 'method']);
      R.wilcoxon = pick(wilcoxonSR(C.pre, C.post), ['Wplus', 'p', 'method']);
      R.wilcoxon_noties = pick(wilcoxonSR([1.3, -2.1, 3.4, 4.6, 5.2, 6.9, -0.7, 8.8, 9.5, 2.2], Array(10).fill(0)), ['Wplus', 'p', 'method']);
      R.wilcoxon_ratio = pick(rankSumTest(C.pre, C.post, 'ratio'), ['Wplus', 'p', 'method']);
      const anova = onewayANOVA([C.a, C.b, C.c], 'tukey');
      R.anova = { F: anova.F, p: anova.p, tukey: anova.posthoc.map(x => x.p_adj) };
      const dun = onewayANOVA([C.a, C.b, C.c], 'dunnett', [0]);
      R.dunnett = dun.posthoc.map(x => x.p_adj);
      const kw = kruskalWallis([C.a, C.b, C.c]);
      R.kruskal = { H: kw.H, p: kw.p, dunn_z: kw.posthoc.map(x => x.z) };
      R.pearson = pick(pearsonR(C.x, C.y), ['r', 'p', 'ci95lo', 'ci95hi']);
      R.spearman = pick(spearmanR(C.x, C.skew.slice(0, 10)), ['r', 'p']);
      const lin = fitLinear(C.x, C.y); R.linear = { a: lin.params.a, b: lin.params.b, r2: lin.r2 };
      R.shapiro = ['a', 'skew', 'pre', 'small1'].map(k => pick(shapiroWilk(C[k]), ['W', 'p']));
      const big = Array.from({ length: 200 }, (_, i) => Math.exp(Math.sin(i * 1.7) * 1.3)); R.shapiro.push(pick(shapiroWilk(big), ['W', 'p']));
      R.fisher = fishersExact(C.fisher[0][0], C.fisher[0][1], C.fisher[1][0], C.fisher[1][1]);
      R.chisq = pick(chiSquare(C.chisq), ['chi', 'df', 'p']);
      R.ks = pick(ks2Sample(C.a, C.c), ['D', 'p']);
      R.ks2 = pick(ks2Sample(big1, big2), ['D', 'p']);
      const subj = C.km_t.flatMap((t, g) => t.map((ti, i) => ({ t: ti, e: C.km_e[g][i], g })));
      R.logrank = pick(logRankK(subj, 2), ['chi', 'p']);
      R.km = kaplanMeier(C.km_t[0], C.km_e[0]).map(p => [p.t, p.s]);
      R.adjust = Object.fromEntries(['bonferroni', 'holm', 'holm_sidak', 'fdr'].map(m => [m, adjustP(C.pvals, m)]));
      // two-way ANOVA, 2x3 balanced
      const cells = [C.a.slice(0, 4), C.b.slice(0, 4), C.c.slice(0, 4), C.pre.slice(0, 4), C.post.slice(0, 4), C.skew.slice(0, 4)];
      const tw = twowayANOVA(cells, 2, 3); R.anova2 = pick(tw, ['FA', 'FB', 'FAB', 'pA', 'pB', 'pAB']);
      const dx = [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100], dy = [2.1, 2.9, 5.2, 11.8, 27.5, 52.1, 74.9, 86.2, 90.3];
      const f5 = fit5PL(dx, dy); R.fit5 = { sse: dx.reduce((s, x, i) => s + (f5.predict(x) - dy[i]) ** 2, 0), ec50: f5.ec50 };
      const f4 = fit4PL(dx, dy); R.fit4 = { sse: dx.reduce((s, x, i) => s + (f4.predict(x) - dy[i]) ** 2, 0), ec50: f4.params.ec50 };
      R.lillie = pick(lillieforsTest(C.skew), ['D', 'p']);
      return R;
    }, cases);
    console.log(JSON.stringify(out));
  } finally { await app.close(); }
})();

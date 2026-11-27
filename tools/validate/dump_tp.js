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
      R.wilcoxon_ratio = pick(wilcoxonPaired(C.pre, C.post, 'ratio'), ['Wplus', 'p', 'method']);
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
      const f5 = fit5PL(dx, dy); R.fit5 = { sse: dx.reduce((s, x, i) => s + (f5.predict(x) - dy[i]) ** 2, 0), ec50: f5.ec50, bot: f5.params[0], top: f5.params[1] };
      const f4 = fit4PL(dx, dy); R.fit4 = { sse: dx.reduce((s, x, i) => s + (f4.predict(x) - dy[i]) ** 2, 0), ec50: f4.params.ec50, bot: f4.params.bot, top: f4.params.top };
      R.lillie = pick(lillieforsTest(C.skew), ['D', 'p']);
      // Additional validation cases: scale-invariant PCA, Shapiro Royston boundaries & W=1, 3-group log-rank, extreme tails
      const pcaX = [[1, 2, 3, 4], [2, 4, 5, 8], [5, 1, 2, 1], [6, 3, 4, 2]];
      const pca1 = pcaCompute(pcaX), pcaSmall = pcaCompute(pcaX.map(r => r.map(v => v * 1e-6)));
      R.pca = { var1: pca1.varExplained, varSmall: pcaSmall.varExplained };
      const sw4m = Array.from({ length: 4 }, (_, i) => jStat.normal.inv((i + 1 - 0.375) / 4.25, 0, 1));
      const sw4mm = sw4m.reduce((s, v) => s + v * v, 0), sw4u = 0.5;
      const sw4an = -sw4m[0] / Math.sqrt(sw4mm) + [0, 0.221157, -0.147981, -2.071190, 4.434685, -2.706056].reduce((s, c, k) => s + c * Math.pow(sw4u, k), 0);
      const sw4eps = Math.sqrt((sw4mm - 2 * sw4m[0] ** 2) / (1 - 2 * sw4an ** 2));
      const sw4Exact = [-sw4an, sw4m[1] / sw4eps, sw4m[2] / sw4eps, sw4an];
      R.shapiro_extra = [
        [1.1, 2.0, 2.7, 4.9], // n = 4
        [0.8, 1.5, 2.1, 3.0, 5.4], // n = 5
        [1.1, 1.4, 1.9, 2.0, 2.3, 2.6, 2.9, 3.1, 3.5, 4.0, 5.2], // n = 11
        [1.1, 1.4, 1.9, 2.0, 2.3, 2.6, 2.9, 3.1, 3.5, 4.0, 5.2, 6.1], // n = 12
        sw4Exact // W = 1
      ].map(v => pick(shapiroWilk(v), ['W', 'p']));
      const lr3Subj = [
        ...C.km_t[0].map((t, i) => ({ t, e: C.km_e[0][i], g: 0 })),
        ...C.km_t[1].map((t, i) => ({ t, e: C.km_e[1][i], g: 1 })),
        ...[2, 5, 7, 11, 13, 17, 21, 26].map((t, i) => ({ t, e: i % 3 === 0 ? 0 : 1, g: 2 }))
      ];
      R.logrank3 = pick(logRankK(lr3Subj, 3), ['chi', 'df', 'p']);
      const lr3Cens = [...subj, { t: 1, e: 0, g: 2 }, { t: 2, e: 0, g: 2 }];
      R.logrank3_cens = pick(logRankK(lr3Cens, 3), ['chi', 'df', 'p']);
      R.chi2_tail = {
        c75_1: chi2P(75, 1), c100_1: chi2P(100, 1), c50_5: chi2P(50, 5), c200_50: chi2P(200, 50),
        tbl: pick(chiSquare([[80, 5], [5, 80]]), ['chi', 'df', 'p'])
      };
      R.dunnett_tail = {
        t15_df30: dunnettP([15], 10, [10, 10], 30)[0],
        t8_df1500: dunnettP([8], 500, [500, 500], 1500)[0],
        t4_df2001: dunnettP([4], 700, [700, 700], 2001)[0]
      };
      return R;
    }, cases);
    console.log(JSON.stringify(out));
  } finally { await app.close(); }
})();

"""Compare Thistle Plot's statistics (JSON from dump_tp.js on stdin) with SciPy / statsmodels on the same data.
Prints OK or CHECK per quantity. Run with: node dump_tp.js | python3 compare.py"""
import json, sys, math, itertools, pathlib
import numpy as np
from scipy import stats, optimize
import statsmodels.api as sm
from statsmodels.formula.api import ols
from statsmodels.stats.multitest import multipletests
from statsmodels.stats.diagnostic import lilliefors
import pandas as pd

TP = json.load(sys.stdin)
CASES = json.loads((pathlib.Path(__file__).parent / 'cases.json').read_text())
bad = 0


def check(name, tp, ref, rel=1e-6, abs_=1e-12):
    global bad
    tp_a, ref_a = np.atleast_1d(np.asarray(tp, float)), np.atleast_1d(np.asarray(ref, float))
    ok = tp_a.shape == ref_a.shape and np.all(np.abs(tp_a - ref_a) <= np.maximum(abs_, rel * np.abs(ref_a)))
    if not ok: bad += 1
    fmt = lambda v: ', '.join(f'{x:.6g}' for x in np.atleast_1d(v))
    print(f"{'OK   ' if ok else 'CHECK'}  {name:34s} TP {fmt(tp_a)}  |  reference {fmt(ref_a)}")


a, b, c = (np.array(CASES[k]) for k in 'abc')
pre, post = np.array(CASES['pre']), np.array(CASES['post'])
r = stats.ttest_ind(a, b, equal_var=False)
check('Welch t, p', [TP['welch']['t'], TP['welch']['p']], [r.statistic, r.pvalue])
check('Welch df', TP['welch']['df'], r.df)
r = stats.ttest_rel(pre, post)
check('paired t, p', [TP['paired']['t'], TP['paired']['p']], [r.statistic, r.pvalue])
r = stats.ttest_rel(np.log(pre), np.log(post))
check('ratio paired t (log), p', [TP['paired_ratio']['t'], TP['paired_ratio']['p']], [r.statistic, r.pvalue])
check('geometric mean ratio', TP['paired_ratio']['ratio'], math.exp(np.mean(np.log(pre / post))))

r = stats.mannwhitneyu(a, b, method='exact')
check('Mann-Whitney U, exact p', [TP['mw']['U1'], TP['mw']['p']], [r.statistic, r.pvalue])
r = stats.mannwhitneyu(CASES['small1'], CASES['small2'], method='exact')
check('Mann-Whitney n=3 v 3 exact p', TP['mw_small']['p'], r.pvalue)


def perm_p_ranksum(x, y):  # full enumeration, two-sided by distance from the mean (handles ties)
    z = np.concatenate([x, y]); rk = stats.rankdata(z); n1 = len(x); mu = n1 * (len(z) + 1) / 2
    obs = abs(rk[:n1].sum() - mu); cnt = tot = 0
    for idx in itertools.combinations(range(len(z)), n1):
        tot += 1; cnt += abs(rk[list(idx)].sum() - mu) >= obs - 1e-9
    return cnt / tot


check('Mann-Whitney with ties (enum.)', TP['mw_ties']['p'], perm_p_ranksum(np.array(CASES['tie1']), np.array(CASES['tie2'])))
big1 = np.array([math.sin(i * 1.3) * 3 + i * 0.05 for i in range(40)]); big2 = np.array([math.cos(i * 0.7) * 3 + 1 for i in range(35)])
r = stats.mannwhitneyu(big1, big2, method='asymptotic', use_continuity=True)
check('Mann-Whitney n=75 (normal approx)', TP['mw_large']['p'], r.pvalue)


def perm_p_signed(d):  # all 2^n sign patterns, two-sided by distance from the mean (handles ties)
    d = np.array([float(f'{v:.12g}') for v in d]); d = d[d != 0]; rk = stats.rankdata(np.abs(d))
    obs = rk[d > 0].sum(); mu = len(d) * (len(d) + 1) / 4
    cnt = sum(abs(sum(rk[i] for i in range(len(d)) if s[i]) - mu) >= abs(obs - mu) - 1e-9 for s in itertools.product([0, 1], repeat=len(d)))
    return cnt / 2 ** len(d)


check('Wilcoxon signed-rank (enum., ties)', TP['wilcoxon']['p'], perm_p_signed(pre - post))
check('Wilcoxon on log ratio (enum.)', TP['wilcoxon_ratio']['p'], perm_p_signed(np.log(pre / post)))
r = stats.wilcoxon([1.3, -2.1, 3.4, 4.6, 5.2, 6.9, -0.7, 8.8, 9.5, 2.2], method='exact')
check('Wilcoxon exact, no ties (SciPy)', TP['wilcoxon_noties']['p'], r.pvalue)

r = stats.f_oneway(a, b, c)
check('one-way ANOVA F, p', [TP['anova']['F'], TP['anova']['p']], [r.statistic, r.pvalue])
t = stats.tukey_hsd(a, b, c)
check('Tukey HSD p (1-2,1-3,2-3)', TP['anova']['tukey'], [t.pvalue[0, 1], t.pvalue[0, 2], t.pvalue[1, 2]], rel=2e-3, abs_=1e-6)


def dunnett_ref(groups, ctrl):  # adjusted two-sided p by adaptive quadrature of the multivariate t integral
    from scipy import integrate
    df = sum(len(g) for g in groups) - len(groups); msw = sum(((g - g.mean()) ** 2).sum() for g in groups) / df
    others = [g for i, g in enumerate(groups) if i != ctrl]; g0 = groups[ctrl]
    lam = [math.sqrt(len(g) / (len(g) + len(g0))) for g in others]
    def inner(cc):
        f = lambda z: stats.norm.pdf(z) * np.prod([stats.norm.cdf((cc + l * z) / math.sqrt(1 - l * l)) - stats.norm.cdf((-cc + l * z) / math.sqrt(1 - l * l)) for l in lam])
        return integrate.quad(f, -12, 12, epsabs=1e-15, epsrel=1e-12, limit=500)[0]
    dens = lambda s: math.exp(math.log(2) + (df / 2) * math.log(df / 2) - math.lgamma(df / 2) + (df - 1) * math.log(s) - df * s * s / 2)
    out = []
    for g in others:
        t = abs(g.mean() - g0.mean()) / math.sqrt(msw * (1 / len(g) + 1 / len(g0)))
        out.append(integrate.quad(lambda s: dens(s) * (1 - inner(t * s)), 0, np.inf, epsabs=1e-16, epsrel=1e-10, limit=500)[0])
    return out


check('Dunnett p vs control (quadrature)', TP['dunnett'], dunnett_ref([a, b, c], 0), rel=1e-4)
# (scipy.stats.dunnett integrates by randomised quasi-Monte Carlo, so its very small p-values vary from run to run;
#  the quadrature above is the more accurate reference.)
r = stats.kruskal(a, b, c)
check('Kruskal-Wallis H, p', [TP['kruskal']['H'], TP['kruskal']['p']], [r.statistic, r.pvalue])
allv = np.concatenate([a, b, c]); rk = stats.rankdata(allv); N = len(allv)
_, cnts = np.unique(allv, return_counts=True); T = (cnts ** 3 - cnts).sum()
grp = [rk[:len(a)], rk[len(a):len(a) + len(b)], rk[len(a) + len(b):]]
dz = [(grp[i].mean() - grp[j].mean()) / math.sqrt((N * (N + 1) / 12 - T / (12 * (N - 1))) * (1 / len(grp[i]) + 1 / len(grp[j]))) for i, j in [(0, 1), (0, 2), (1, 2)]]
check("Dunn's z (formula, independent)", TP['kruskal']['dunn_z'], dz)

x, y = np.array(CASES['x']), np.array(CASES['y'])
r = stats.pearsonr(x, y); ci = r.confidence_interval()
check('Pearson r, p', [TP['pearson']['r'], TP['pearson']['p']], [r.statistic, r.pvalue], rel=1e-5)
check('Pearson 95% CI (Fisher z)', [TP['pearson']['ci95lo'], TP['pearson']['ci95hi']], [ci.low, ci.high], rel=1e-3)
r = stats.spearmanr(x, CASES['skew'][:10])
check('Spearman rho, p', [TP['spearman']['r'], TP['spearman']['p']], [r.statistic, r.pvalue], abs_=1e-12)
r = stats.linregress(x, y)
check('linear fit a, b, R2', [TP['linear']['a'], TP['linear']['b'], TP['linear']['r2']], [r.intercept, r.slope, r.rvalue ** 2])

big = np.array([math.exp(math.sin(i * 1.7) * 1.3) for i in range(200)])
for k, (v, nm) in enumerate(zip([a, CASES['skew'], pre, CASES['small1'], big], ['n=7', 'skewed n=15', 'n=10', 'n=3', 'n=200'])):
    r = stats.shapiro(v)
    check(f'Shapiro-Wilk W, p ({nm})', [TP['shapiro'][k]['W'], TP['shapiro'][k]['p']], [r.statistic, r.pvalue], rel=1e-4, abs_=1e-6)

f = CASES['fisher']; r = stats.fisher_exact(f)
check("Fisher's exact p (two-sided)", TP['fisher']['p'], r.pvalue)
check('odds ratio (sample, ad/bc)', TP['fisher']['or'], f[0][0] * f[1][1] / (f[0][1] * f[1][0]))
r = stats.chi2_contingency(CASES['chisq'], correction=False)
check('chi-square, df, p', [TP['chisq']['chi'], TP['chisq']['df'], TP['chisq']['p']], [r.statistic, r.dof, r.pvalue])
r = stats.ks_2samp(a, c, method='exact')
check('KS two-sample D, exact p', [TP['ks']['D'], TP['ks']['p']], [r.statistic, r.pvalue])
r = stats.ks_2samp(big1, big2, method='exact')
check('KS two-sample n=75, exact p', [TP['ks2']['D'], TP['ks2']['p']], [r.statistic, r.pvalue])
lf = lilliefors(CASES['skew'], dist='norm', pvalmethod='approx')
check('Lilliefors D', TP['lillie']['D'], lf[0])
check('Lilliefors p (simulation vs table)', TP['lillie']['p'], lf[1], rel=0.5, abs_=0.003)

t0, t1 = CASES['km_t']; e0, e1 = CASES['km_e']
r = stats.logrank(stats.CensoredData.right_censored(t0, np.logical_not(e0)), stats.CensoredData.right_censored(t1, np.logical_not(e1)))
check('log-rank chi2, p', [TP['logrank']['chi'], TP['logrank']['p']], [r.statistic ** 2, r.pvalue])
ec = stats.ecdf(stats.CensoredData.right_censored(t0, np.logical_not(e0)))
tp_km = dict((t, s) for t, s in TP['km'])
check('Kaplan-Meier S(t) at event times', [tp_km[t] for t in ec.sf.quantiles], ec.sf.probabilities)

for m, sm_m in [('bonferroni', 'bonferroni'), ('holm', 'holm'), ('holm_sidak', 'holm-sidak'), ('fdr', 'fdr_bh')]:
    check(f'adjusted p: {m}', TP['adjust'][m], multipletests(CASES['pvals'], method=sm_m)[1])

cells = [CASES['a'][:4], CASES['b'][:4], CASES['c'][:4], CASES['pre'][:4], CASES['post'][:4], CASES['skew'][:4]]
df = pd.DataFrame([(i // 3, i % 3, v) for i, cl in enumerate(cells) for v in cl], columns=['A', 'B', 'y'])
tab = sm.stats.anova_lm(ols('y ~ C(A) * C(B)', df).fit(), typ=2)
check('two-way ANOVA F (A, B, AxB)', [TP['anova2'][k] for k in ['FA', 'FB', 'FAB']], tab['F'][:3].values)
check('two-way ANOVA p (A, B, AxB)', [TP['anova2'][k] for k in ['pA', 'pB', 'pAB']], tab['PR(>F)'][:3].values)

dx = np.array([0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100]); dy = np.array([2.1, 2.9, 5.2, 11.8, 27.5, 52.1, 74.9, 86.2, 90.3])
m4 = lambda x, b, t, le, h: b + (t - b) / (1 + (x / 10 ** le) ** h)
p4, _ = optimize.curve_fit(m4, dx, dy, p0=[0, 100, 0, 1], maxfev=20000)
check('4PL fit: residual SS', TP['fit4']['sse'], ((m4(dx, *p4) - dy) ** 2).sum(), rel=1e-3)
check('4PL fit: EC50', TP['fit4']['ec50'], 10 ** p4[2], rel=1e-3)
m5 = lambda x, b, t, lc, h, ls: b + (t - b) / (1 + (10 ** lc / x) ** h) ** np.exp(ls)
p5, _ = optimize.curve_fit(m5, dx, dy, p0=[0, 100, 0, 1, 0], maxfev=50000)
s5 = ((m5(dx, *p5) - dy) ** 2).sum()
ok5 = TP['fit5']['sse'] <= s5 * (1 + 1e-3)
print(f"{'OK   ' if ok5 else 'CHECK'}  {'5PL fit: residual SS (TP <= SciPy)':34s} TP {TP['fit5']['sse']:.6g}  |  reference {s5:.6g}")
bad += not ok5
c5, h5, s5_ = 10 ** p5[2], p5[3], math.exp(p5[4])
check('5PL fit: EC50 (half-way X)', TP['fit5']['ec50'], c5 * (2 ** (1 / s5_) - 1) ** (-1 / h5), rel=2e-2)
print(f'\n{bad} to check' if bad else '\nAll agree.')
sys.exit(1 if bad else 0)

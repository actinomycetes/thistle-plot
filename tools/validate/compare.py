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
# Spearman: TP uses the exact permutation p for n <= 10 (v0.16.0). scipy's default spearmanr p is the t approximation,
# which is invalid at small n (e.g. 6.6e-64 here, impossible: the smallest exact p is 2/10!), so the reference is an
# exact permutation test over every ordering of the Y ranks.
sk = np.array(CASES['skew'][:10])
r = stats.spearmanr(x, sk)
import itertools
def _spearman_exact_p(u, v):
    # every ordering of the Y ranks (midranks doubled to integers, so the comparison is exact)
    a = (2 * stats.rankdata(u)).astype(int); b = (2 * stats.rankdata(v)).astype(int)
    n = len(a); A = [int(t) for t in (n * a - a.sum())]; B = [int(t) for t in b]
    obs = abs(sum(p * q for p, q in zip(A, B))); hits = total = 0
    for perm in itertools.permutations(B):
        total += 1
        if abs(sum(p * q for p, q in zip(A, perm))) >= obs: hits += 1
    return hits / total
class _P: pass
pe = _P(); pe.pvalue = _spearman_exact_p(x, sk)
check('Spearman rho, exact p (n = 10)', [TP['spearman']['r'], TP['spearman']['p']], [r.statistic, pe.pvalue], rel=1e-9)
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
check('4PL fit: Bottom, Top', [TP['fit4']['bot'], TP['fit4']['top']], [min(p4[0], p4[1]), max(p4[0], p4[1])], rel=1e-3)
m5 = lambda x, b, t, lc, h, ls: b + (t - b) / (1 + (10 ** lc / x) ** h) ** np.exp(ls)
p5, _ = optimize.curve_fit(m5, dx, dy, p0=[0, 100, 0, 1, 0], maxfev=50000)
s5 = ((m5(dx, *p5) - dy) ** 2).sum()
ok5 = TP['fit5']['sse'] <= s5 * (1 + 1e-3)
print(f"{'OK   ' if ok5 else 'CHECK'}  {'5PL fit: residual SS (TP <= SciPy)':34s} TP {TP['fit5']['sse']:.6g}  |  reference {s5:.6g}")
bad += not ok5
c5, h5, s5_ = 10 ** p5[2], p5[3], math.exp(p5[4])
check('5PL fit: EC50 (half-way X)', TP['fit5']['ec50'], c5 * (2 ** (1 / s5_) - 1) ** (-1 / h5), rel=2e-2)
check('5PL fit: Bottom, Top', [TP['fit5']['bot'], TP['fit5']['top']], [min(p5[0], p5[1]), max(p5[0], p5[1])], rel=2e-2)

# Scale-invariant PCA (SVD reference)
pcaX = np.array([[1, 2, 3, 4], [2, 4, 5, 8], [5, 1, 2, 1], [6, 3, 4, 2]], float)
_, sv, _ = np.linalg.svd(pcaX - pcaX.mean(axis=0), full_matrices=False)
eig = sv ** 2
var_ref = 100.0 * eig[:3] / eig.sum()
check('PCA var explained (normal)', TP['pca']['var1'], var_ref, rel=1e-6)
check('PCA var explained (1e-6 scaled)', TP['pca']['varSmall'], var_ref, rel=1e-6)

# Shapiro-Wilk Royston boundaries (n = 4, 5, 11, 12) and W = 1 -> p = 1
sh_extra = [
    ([1.1, 2.0, 2.7, 4.9], 'n=4'),
    ([0.8, 1.5, 2.1, 3.0, 5.4], 'n=5'),
    ([1.1, 1.4, 1.9, 2.0, 2.3, 2.6, 2.9, 3.1, 3.5, 4.0, 5.2], 'n=11'),
    ([1.1, 1.4, 1.9, 2.0, 2.3, 2.6, 2.9, 3.1, 3.5, 4.0, 5.2, 6.1], 'n=12'),
]
for k, (v, nm) in enumerate(sh_extra):
    r = stats.shapiro(v)
    check(f'Shapiro-Wilk W, p ({nm})', [TP['shapiro_extra'][k]['W'], TP['shapiro_extra'][k]['p']], [r.statistic, r.pvalue], rel=1e-4, abs_=1e-6)
check('Shapiro-Wilk W=1 -> p=1', [TP['shapiro_extra'][4]['W'], TP['shapiro_extra'][4]['p']], [1.0, 1.0], rel=1e-9)

# 3-group Mantel-Cox log-rank (independent NumPy computation) and all-censored-early 3rd group
def logrank_k_ref(groups):
    k = len(groups)
    subj = [(ti, ei, g) for g, (ts, es) in enumerate(groups) for ti, ei in zip(ts, es)]
    times = sorted({t for t, e, _ in subj if e})
    O = np.zeros(k); E = np.zeros(k); V = np.zeros((k, k))
    for t in times:
        n = np.array([sum(1 for ti, _, g in subj if g == gi and ti >= t) for gi in range(k)], float)
        d = np.array([sum(1 for ti, ei, g in subj if g == gi and ti == t and ei) for gi in range(k)], float)
        N, D = n.sum(), d.sum()
        if N < 1 or D == 0: continue
        O += d; E += n * D / N
        if N > 1:
            f = D * (N - D) / (N - 1)
            V += f * (np.diag(n / N) - np.outer(n / N, n / N))
    active = [g for g in range(k) if E[g] > 0]
    df_ = len(active) - 1
    idx = active[:df_]
    u = (O - E)[idx]
    chi = float(u @ np.linalg.solve(V[np.ix_(idx, idx)], u))
    return chi, df_, float(stats.chi2.sf(chi, df_))

t2 = [2, 5, 7, 11, 13, 17, 21, 26]; e2 = [0 if i % 3 == 0 else 1 for i in range(len(t2))]
chi3, df3, p3 = logrank_k_ref([(t0, e0), (t1, e1), (t2, e2)])
check('log-rank k=3 chi2, df, p', [TP['logrank3']['chi'], TP['logrank3']['df'], TP['logrank3']['p']], [chi3, df3, p3])
r_lr2 = stats.logrank(stats.CensoredData.right_censored(t0, np.logical_not(e0)), stats.CensoredData.right_censored(t1, np.logical_not(e1)))
check('log-rank k=3 (1 early-cens) chi2,df,p', [TP['logrank3_cens']['chi'], TP['logrank3_cens']['df'], TP['logrank3_cens']['p']], [r_lr2.statistic ** 2, 1, r_lr2.pvalue])

# Extreme upper-tail chi-square and chi2P (no 1 - cdf cancellation)
check('chi2P(75, 1)', TP['chi2_tail']['c75_1'], stats.chi2.sf(75, 1), rel=1e-10, abs_=0)
check('chi2P(100, 1)', TP['chi2_tail']['c100_1'], stats.chi2.sf(100, 1), rel=1e-10, abs_=0)
check('chi2P(50, 5)', TP['chi2_tail']['c50_5'], stats.chi2.sf(50, 5), rel=1e-10, abs_=0)
check('chi2P(200, 50)', TP['chi2_tail']['c200_50'], stats.chi2.sf(200, 50), rel=1e-10, abs_=0)
rc_tail = stats.chi2_contingency([[80, 5], [5, 80]], correction=False)
check('chi-square extreme tail chi2, p', [TP['chi2_tail']['tbl']['chi'], TP['chi2_tail']['tbl']['p']], [rc_tail.statistic, rc_tail.pvalue], rel=1e-9, abs_=0)

# Extreme upper-tail Dunnett (cancellation-free quadrature via stats.norm.sf)
def dunnett_tail_ref(c_val, n_ctrl, n_other, df_):
    from scipy import integrate
    lam = [math.sqrt(n / (n + n_ctrl)) for n in n_other]
    sq = [math.sqrt(1.0 - l * l) for l in lam]
    def inner(cs):
        if cs <= 0:
            return 1.0
        if cs > 38:
            return 0.0
        def f(z):
            tail = 0.0
            for l, q in zip(lam, sq):
                qi = min(1.0, float(stats.norm.sf((cs + l * z) / q) + stats.norm.sf((cs - l * z) / q)))
                tail += qi * (1.0 - tail)
            return stats.norm.pdf(z) * tail
        z_hi = max(14.0, max(l * cs + 10.0 * q for l, q in zip(lam, sq)))
        z_pts = sorted({l * cs for l in lam if 0 < l * cs < z_hi})
        return 2.0 * integrate.quad(f, 0, z_hi, points=z_pts, epsabs=0, epsrel=1e-11, limit=500)[0]
    lnC = (df_ / 2) * math.log(df_ / 2) - math.lgamma(df_ / 2) - df_ / 2 + math.log(2)
    s_star = math.sqrt(max(0.0, df_ - 1) / (df_ + c_val * c_val))
    sd_star = 1.0 / math.sqrt(2 * (df_ + c_val * c_val))
    s_chi = math.sqrt(max(0.0, df_ - 1) / df_)
    sd_chi = 1.0 / math.sqrt(2 * df_)
    lo = max(0.0, min(s_star - 14 * sd_star, s_chi - 14 * sd_chi))
    hi = min(38.0 / c_val, max(s_star + 14 * sd_star, s_chi + 14 * sd_chi, 10.0 if df_ <= 4 else 0.0))
    pts = sorted({p for p in (s_star, 1.0 / c_val, 4.0 / c_val, s_chi) if lo < p < hi})
    def fs(s):
        if s <= 0:
            return math.exp(lnC + 0.5 * df_) * inner(0.0) if df_ == 1 else 0.0
        ld = lnC + (df_ - 1) * math.log(s) - 0.5 * df_ * (s * s - 1)
        return math.exp(ld) * inner(c_val * s) if ld > -700 else 0.0
    return integrate.quad(fs, lo, hi, points=pts, epsabs=0, epsrel=1e-9, limit=500)[0]

check('Dunnett tail t=15, df=30', TP['dunnett_tail']['t15_df30'], dunnett_tail_ref(15.0, 10, [10, 10], 30), rel=1e-4, abs_=0)
check('Dunnett tail t=8, df=1500', TP['dunnett_tail']['t8_df1500'], dunnett_tail_ref(8.0, 500, [500, 500], 1500), rel=1e-4, abs_=0)
check('Dunnett tail t=4, df=2001', TP['dunnett_tail']['t4_df2001'], dunnett_tail_ref(4.0, 700, [700, 700], 2001), rel=1e-4, abs_=0)
for t_val, key in [(2.0, 'm1_df2_t2'), (20.0, 'm1_df2_t20'), (200.0, 'm1_df2_t200')]:
    rad = math.sqrt(t_val * t_val + 2.0)
    check(f'Dunnett m=1 df=2 t={t_val:g}', TP['dunnett_tail'][key], 2.0 / (rad * (rad + t_val)), rel=1e-9, abs_=0)
for t_val, key in [(2.0, 'm2_df2_t2'), (20.0, 'm2_df2_t20'), (200.0, 'm2_df2_t200')]:
    check(f'Dunnett m=2 df=2 t={t_val:g}', TP['dunnett_tail'][key], dunnett_tail_ref(t_val, 2, [2, 2], 2), rel=1e-5, abs_=0)
check('Dunnett m=3 df=3 t=50', TP['dunnett_tail']['m3_df3_t50'], dunnett_tail_ref(50.0, 2, [2, 2, 2], 3), rel=1e-5, abs_=0)

print(f'\n{bad} to check' if bad else '\nAll agree.')
sys.exit(1 if bad else 0)

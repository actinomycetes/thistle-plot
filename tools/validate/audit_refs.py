"""Reference values for tests/audit.test.js (independent statistical review of TP v0.15.0, Nov 2026).

Run:  python3 -I tools/validate/audit_refs.py
Needs scipy, statsmodels, numpy, mpmath. Every number printed here is hard-coded in tests/audit.test.js.
R was not available; R's fisher.test values quoted by the review are reproduced by the exact r x c enumeration below.
"""
import itertools
import math

import mpmath
import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf
from scipy import stats
from statsmodels.stats.multitest import multipletests


def spearman_exact(x, y):
    """Two-sided exact permutation p of Spearman's rho: every ordering of y (ties kept as midranks)."""
    rx, ry = stats.rankdata(x), stats.rankdata(y)
    a, b = rx - rx.mean(), ry - ry.mean()
    obs = abs(a @ b)
    hits = total = 0
    for p in itertools.permutations(b):
        total += 1
        hits += abs(a @ np.array(p)) >= obs - 1e-9 * (1 + obs)
    return hits / total


print('02 Spearman exact')
for x, y in [([1, 2, 3], [1, 2, 3]), ([1, 2, 3, 4], [1, 2, 3, 4]), ([1, 2, 3, 4, 5], [1, 2, 3, 5, 4]),
             ([1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 7, 6]), ([1, 2, 2, 3, 4], [1, 3, 2, 4, 5])]:
    print('  ', x, y, spearman_exact(x, y))

print('03 KS exact tails (no ties): 2/C(2k,k) for disjoint samples')
mpmath.mp.dps = 50
for k in (4, 20, 25, 50):
    print('   k =', k, mpmath.mpf(2) / mpmath.binomial(2 * k, k), ' scipy:', stats.ks_2samp(range(k), range(k, 2 * k), method='exact').pvalue)
print('   tied [0,0,0,0] vs [0,1,1,1] (no-ties exact):', stats.ks_2samp([0, 0, 0, 0], [0, 1, 1, 1], method='exact').pvalue, '= 8/35')

print('04 two-way ANOVA 2x3, means [1,2,4,8,16,32], offsets -1/0/+1')
rows = [(a, b, [1, 2, 4, 8, 16, 32][ai * 3 + bi] + o) for ai, a in enumerate(['WT', 'KO'])
        for bi, b in enumerate(['Veh', 'Lo', 'Hi']) for o in (-1, 0, 1)]
d = pd.DataFrame(rows, columns=['A', 'B', 'Y'])
print(sm.stats.anova_lm(smf.ols('Y ~ C(A, Sum) * C(B, Sum)', d).fit(), typ=2)[['df', 'F']])

print('06 Pearson on complete pairs:', stats.pearsonr([3, 2, 1, 3, 4, 5], [10, 20, 5, 12, 15, 18]))

print('07 polynomial fits (numpy.polynomial.polyfit, ascending powers)')
print('   deg 2:', np.polynomial.polynomial.polyfit([0, 1, 2, 3], [1, 4, 9, 16], 2))
xs = np.arange(6)
print('   deg 3:', np.polynomial.polynomial.polyfit(xs, 1 - xs + 0.5 * xs**2 + 0.2 * xs**3, 3))


def fisher_rx2(t):
    """Exact Fisher test for an r x 2 table (R's rule: tables with probability <= observed * (1 + 1e-7))."""
    r = [sum(x) for x in t]
    c1, n = sum(x[0] for x in t), sum(r)

    def prob(col):
        return math.prod(math.comb(r[i], col[i]) for i in range(len(r))) / math.comb(n, c1)

    p0 = prob([x[0] for x in t])
    return sum(prob(c) for c in itertools.product(*[range(ri + 1) for ri in r])
               if sum(c) == c1 and prob(c) <= p0 * (1 + 1e-7))


print('08 Fisher 3x2 [10,0],[0,10],[10,10] exact:', fisher_rx2([[10, 0], [0, 10], [10, 10]]),
      ' top-left 2x2 only:', stats.fisher_exact([[10, 0], [0, 10]])[1])
print('   [5,5],[5,5],[10,0] exact:', fisher_rx2([[5, 5], [5, 5], [10, 0]]))
print('   genuine zero [[3,0],[2,5]]: fisher', stats.fisher_exact([[3, 0], [2, 5]])[1],
      ' chi2', stats.chi2_contingency([[3, 0], [2, 5]], correction=False)[:2])

print('09 one-way ANOVA without the empty group:', stats.f_oneway([1, 2, 3], [4, 5, 6]))

print('11 Holm-Sidak:', multipletests([1e-20, 0.01], method='holm-sidak')[1],
      multipletests([1e-300, 1e-20, 1e-10, 0.01], method='holm-sidak')[1])

a, b = np.array([4, 8, 16]), np.array([2, 2, 4])
r = stats.ttest_1samp(np.log(a / b), 0)
print('12 paired ratio on raw values: GMR', math.exp(np.mean(np.log(a / b))), 'p', r.pvalue)

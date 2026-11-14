# Checking Thistle Plot's statistics

`tools/validate/run.sh` runs Thistle Plot's own statistics code (the functions inside `index.html`, in a headless
browser) and computes the same numbers with independent, widely used open-source software: SciPy and statsmodels.
It prints **OK** or **CHECK** for each quantity. OK means agreement to 1 part in a million unless a looser tolerance
is stated in `compare.py` (iterative fits and simulated p-values).

| Test in Thistle Plot | Reference |
|---|---|
| Welch and paired t-tests (difference and ratio) | `scipy.stats.ttest_ind`, `ttest_rel` (on logs for ratios) |
| Mann–Whitney U, Wilcoxon signed-rank (exact and normal approximation) | `scipy.stats.mannwhitneyu`, `wilcoxon`; full enumeration of permutations when there are ties |
| One-way ANOVA, Tukey, Dunnett, Kruskal–Wallis, Dunn | `scipy.stats.f_oneway`, `tukey_hsd`, `kruskal`; Dunnett by adaptive quadrature of the multivariate t integral; Dunn's z from its formula |
| Two-way ANOVA | `statsmodels` `anova_lm` |
| Pearson (with 95% CI), Spearman, linear regression | `scipy.stats.pearsonr`, `spearmanr`, `linregress` |
| 4PL and 5PL fits | `scipy.optimize.curve_fit` (Thistle Plot must reach the same or a lower residual sum of squares) |
| Shapiro–Wilk, Lilliefors, Kolmogorov–Smirnov | `scipy.stats.shapiro`, `statsmodels` `lilliefors`, `scipy.stats.ks_2samp` |
| Fisher's exact, chi-square | `scipy.stats.fisher_exact`, `chi2_contingency` (no continuity correction) |
| Kaplan–Meier, log-rank | `scipy.stats.ecdf` (censored), `scipy.stats.logrank` |
| Bonferroni, Holm, Holm–Šídák, Benjamini–Hochberg | `statsmodels` `multipletests` |

## Running it
1. Install **Node.js** (LTS, https://nodejs.org), **Python 3** (https://www.python.org) and **Git** (https://git-scm.com).
2. Get the code and its test libraries (once):
   ```bash
   git clone https://github.com/actinomycetes/thistle-plot.git
   cd thistle-plot
   npm install && npx playwright install chromium
   ```
3. Run the check: `bash tools/validate/run.sh` (or `npm run validate`). The first run sets up the Python packages
   in `tools/validate/.work/` (internet needed once).

To check your own numbers, add or change values in `cases.json`. If a line says **CHECK**, please report it to the
maintainer with the line.

## What this does not check
It checks the calculations, not how you entered the data or chose the test. Figures are checked by the Playwright
tests in `tests/`.

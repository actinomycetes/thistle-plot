# Thistle Plot (TP): project guide for Claude Code

TP is a **beta** (0.x) GraphPad-Prism-style statistics and plotting web app for bench scientists
(UoE TT ncRNA lab). It is a **single self-contained `index.html`** (about 300 KB), plain JavaScript,
no framework, no build step. Libraries come from cdnjs: Chart.js 4.4.1, jStat 1.9.6, PapaParse 5.4.1.
It is served by GitHub Pages straight from `index.html` and embedded on a Confluence wiki through an iFrame macro.
Data never leaves the browser.

## Ground rules
- Keep it ONE file with no build step for users. Do not introduce a bundler or split `index.html` unless the maintainer asks.
- No `localStorage`/`sessionStorage` for data (projects are saved as `.thistle` JSON files; `.pprism` still loads).
- Statistics must be correct before they are pretty. When adding or changing a test, validate it against SciPy or
  statsmodels (generate reference numbers with Python), then add a regression test in `tests/stats.test.js`.
- Everything is **beta 0.x**. Do not call it validated; the Help says results must be spot-checked.
- Explain tests and options in the UI in plain words (blue hint box, `data-hint`, `CORR_HINT`); results must list the
  options used (`runOptionsSummary`). Keep wording consistent across similar tests.
- User-facing tone: bench scientists, not statisticians. British spelling is fine.

## Commands
```bash
npm install && npx playwright install chromium   # once
pip install markdown                              # for the Help build
npm test              # full suite (~2 min): smoke, stats, links, large data, export
npm run test:quick    # smoke + links only
python3 tools/build_help.py          # rebuild the in-app Help from docs/*.md
python3 tools/build_help.py --check  # CI check that Help is up to date
```
Open `index.html` directly in a browser to try it. Tests load the CDN libraries from `node_modules`, so they run offline.

## Release checklist (every change that users will see)
1. Bump the version everywhere: `<title>`, the header badge `#app-version`, `const APP_VERSION`
   (a smoke test checks these agree), `package.json`, and the `(vX.Y.Z)` mentions in `docs/help_quick.md` and `docs/help_full.md`
   ("Known limitations of vX.Y.Z" too).
2. Add a row at the top of `docs/help_hist.md` (version, date, `Thistle Plot`, what changed).
3. Edit manual text only in `docs/*.md`, then run `python3 tools/build_help.py`. Never edit the HTML between the
   `<!--HELP:..-->` markers by hand (it is regenerated).
4. `npm test` must pass. New feature means new test.
5. Commit with a message like `v0.8.3: <summary>`; tag releases `v0.8.3`.
Versioning: 0.MINOR.PATCH. Fixes bump PATCH, new features bump MINOR (0.8.2 -> 0.9.0 is the next big step; 1.0 only after validation).

## Architecture map (search for these names in index.html)
- **State:** `G = {nReps, groups:[{name, reps, data[row][rep]}], rowNames, nRows}` is the active data table; `datasets[]` holds
  several tables (`activeDS`, `addDataset`, `applyG`, `clearData`, `loadExample`, `loadExampleFor('stat'|'plot')`).
  Large tables use a virtualised grid (`VIRT_MIN=300`); paste grows the table.
- **Menus:** `ANALYSIS_TYPES` (statistical tests, `#asel`) and `PLOT_TYPES` (`#psel`); option panels are built by
  `renderAnalysisOpts` / `renderPlotOpts`; test descriptions in `HINTS`, option explanations in `OPT_HINTS` (referenced by `data-hint`); example datasets in
  `EXAMPLE_FOR_TEST`, `EXAMPLE_FOR_PLOT`, `EXAMPLE_GEN` (seeded with `_mulberry32`).
- **Tests run in `runAnalysis()`**, one big if/else chain on `atype`; each branch builds HTML, calls `addStatTab(title, html)`
  and sets `lastStatPairs` / `lastStatRowPairs` / `lastStatGeneSet` for significance marks. Tab-level data lives in `statTabs[]`
  (`sigPairs`, `rowPairs`, `geneSet`, `optState`, `linkedPlotId`) and `plotTabs[]` (`linkedStatId`, `optState`).
- **Plots:** `runPlot()` dispatches to `plotBarSD`, `plotHeatmapCustom`, `plotPCACustom`, ... built with `canvasTab` / `chartTab`.
- **Stat-to-figure links (important rule):** significance stars, brackets and gene lists belong ONLY to the figure
  made for a specific run of a test. `runPlot()` clears `lastStat*` unless `_linkedPlotCtx` is true, which only
  Auto-plot (end of `runAnalysis`) and `goLinkedPlot` set. A plot drawn by hand must never show a test's marks.
  `tests/links.test.js` guards this. 🔗 buttons: `goLinkedPlot(statId)` and `goLinkedStat(plotId)` re-create a closed partner from `optState`.
  `AUTO_PLOT_FOR_TYPE` maps test -> linked figure; Rank Product and large per-row t-tests link a heatmap of significant up/down genes.
- **Multiple comparisons:** `adjustP(p, method)` with bonferroni, holm, holm_sidak, fdr, none; labels in `CORR_LABEL/SHORT/HINT`, UI via `corrSelect`.
  Dunnett: `dunnettP` (numerical integral of the multivariate t); Tukey via `jStat.tukey`; ANOVA `onewayANOVA(groups, method, ctrls[])`;
  two-way ANOVA post-hoc uses pooled MSE; Kaplan-Meier `kaplanMeier`, `kmGroups`, `logRankK`; KS `ks2Sample` (exact), `lillieforsTest` (seeded Monte Carlo);
  Rank Product `rankProductTest(aRows, bRows, mode)` ranks up and down separately with exact product p-values and per-direction FDR.
  PCA: `pcaCompute` uses the Gram matrix + Jacobi (`_jacobiEig`) so it scales to tens of thousands of genes; `buildPCAMatrix`.
- **Results tables:** `table.rtbl`; long tables show `SHOW_ROWS=200` with a full CSV (`csvButton`, `downloadCSV`);
  `exportStatTables(tabId)` produces the per-result CSV.
- **Export:** `_renderExport(pageId, mode)`. App style = screen look at 2x on an opaque background (Chart.js canvases are transparent,
  so they are flattened). Publication (Prism-like) style redraws the chart at `PRISM_SCALE=3` with `_exportTheme=PRISM_THEME`
  via `_prismifyConfig`, a Proxy-wrapped `Chart` constructor, `_prismDotsPlugin` (beeswarm dots) and `_niceAxis`. SVG is an embedded raster.
- **Help:** a modal (F1 or the Help button) with three panes generated from `docs/*.md` (see Release checklist).

## Hard-won pitfalls (do not reintroduce)
- Setting Chart.js options through setters in the Prism export caused infinite recursion: modify the config BEFORE constructing the chart.
- Chart.js canvases are transparent: PNG export must composite on an opaque background (the App-style PNG was blank once).
- Kaplan-Meier must handle censoring correctly (plot on a time axis with censor ticks); the estimate was wrong before.
- Power-iteration PCA crashed the page on 20,000 rows; keep the Gram-matrix method.
- Heatmap labels must not overlap the colour key; Prism heatmap group strips are greyscale.
- Option IDs used by `captureOptState` / `restoreOptState` must be stable, or 🔗 re-creation breaks.
- Clear / new dataset must reset to the default empty 2-group table (names too).
- Do not fetch from the network at runtime beyond the three cdnjs libraries.

## Known gaps (candidates for future work)
Dunnett only for a single control; Kaplan-Meier has no Cox regression; two-way ANOVA needs a balanced design; SVG export is an
embedded raster; Prism style is greyscale only; project files store only the active dataset and plots only as snapshots;
Fisher/chi-square have no plot; paired rank-sum and Wilcoxon "by sample" figures are not specially handled; TP has not been formally validated.

## Testing notes
- `tests/helpers.js` provides `openApp()`, `selectTest`, `selectPlot`, `loadGenes(N)`. Tests drive the app through its global functions
  inside `page.evaluate`. Exported PNGs land in `test-output/` (git-ignored); look at them when changing plots or export.
- When fixing a bug, first write the failing test, then fix.
- Tests run in Chromium by default. Set `TP_BROWSER=firefox` (or `webkit`) to run the same suite in another engine
  (`npx playwright install firefox` once). Mouse/clipboard behaviour differs: Firefox keeps mouse events on the text box
  where a drag began, and ignores `clipboardData` passed to a synthetic `ClipboardEvent`. Lab users run Firefox and Safari.

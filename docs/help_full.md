### 1. Screen layout

TP has a header bar, a left panel for data and settings, and a right panel of result and plot tabs.

| Area | What it holds |
| --- | --- |
| Header | Name, BETA and version badges; ⬆ Open CSV…, 💾 Save project, 📂 Load project, 🗑 Clear; on the right ❓ Help and the 🌙/☀️ theme toggle |
| Left panel, top | Dataset tabs and the data grid |
| Left panel, Visualisation | Plot type, 📋 Example (data suited to that plot), plot options, Live update, 📈 Plot (↻ Update plot and + New when a figure of that type is open) |
| Left panel, Statistical Test | Test type, 📋 Example (data suited to that test), description, test options, ▶ Run Analysis |
| Right panel | One tab per result or plot; × closes a tab, 🔗 jumps between a test and its linked plot (and re-creates it if closed) |

### 2. How data is organised

Every dataset is one table: **groups** (conditions, such as Control or Treatment A) across the top, each split into **replicates** (Rep1, Rep2…), and **rows** (samples, genes, time points) down the side.

Most tests pool all values in a group's columns. Some tests read columns positionally instead (Col 1 = X, Col 2 = Y); the blue box under each test says which. The layouts for those tests are:

| Test or plot | Expected layout |
| --- | --- |
| Kaplan-Meier | Col 1 = time; each further column is one group holding 1 (event) or 0 (censored) for its own subjects, blank otherwise (one subject per row) |
| Dose-Response (5PL) | Col 1 = concentration, Col 2 = response |
| Volcano Plot | Col 1 = log2 fold change, Col 2 = p-value, one gene per row |
| Regression | Col 1 = X, Col 2 = Y |
| Multiple Testing Correction | Col 1 = p-values, Col 2 (optional) = labels |
| Fisher's Exact | 2×2 counts: 2 groups (columns) × 2 rows, one value per cell (a larger table is refused: use Chi-Square) |
| Chi-Square | Counts: columns = groups, rows = categories |
| PCA, Heatmap | Rows = features/genes, columns = groups/samples (PCA can use every replicate column as a sample) |
| Two-Way ANOVA | Balanced design, columns ordered A1B1, A1B2 … A2B1 …; set nA and nB in options so that nA × nB equals the number of groups |

### 3. Entering and editing data

- **Type** into any cell. Arrow keys move between cells.
- **Select** a block of cells by dragging across them with the mouse, or click one cell and Shift+click another.
- **Copy / cut** the selection with Ctrl/Cmd+C or X (or the right-click menu); it pastes into a spreadsheet as a table. Cut is undoable with Ctrl/Cmd+Z. **Delete** or Backspace clears selected cells.
- **Paste** a block from a spreadsheet or TP with Ctrl/Cmd+V; it fills from the selected cell (the top-left cell of a selected block), and the table grows to fit. Pasting a single value into a selected block fills every cell with it.
- **Resize** with Reps/group and Groups, or with +Grp, −Grp, +Row, −Row.
- **Rename** a group, row or dataset by double-clicking its name; Enter confirms, Esc cancels.
- **Undo / Redo** with the ↩/↪ buttons or Ctrl/Cmd+Z and Ctrl/Cmd+Y (or Shift+Ctrl/Cmd+Z).
- **Import CSV** with ⬆ Open CSV…. A first row of text becomes group names; a first column of text (such as `001_control.fcs`), or a first column headed Sample, Name or ID (such as `003`), becomes row names. Each column becomes a group with one replicate.
- **From Thistle Flow:** in Thistle Flow's Statistics, **📊 Open in Thistle Plot** opens TP in a new browser tab with the statistics table already in it: one row per sample, one column per statistic. It goes into a new dataset named after the Flow workspace, so the table you had open (and any work TP reopened from your last visit) stays as it was; blank cells stay blank. Only the Thistle Flow tab that opened TP can send a table.
- **⇄ Transpose** (in the Data bar) swaps rows and columns: each row becomes a group and each group becomes a row. With several replicates, each replicate column becomes its own row (named *Group · Rep*). Useful for tables with samples as rows, such as those from Thistle Flow, when you want the samples as groups. Ctrl/Cmd+Z undoes it. Tables of up to 500 rows can be transposed.
- **Paste a whole table**: the table grows to fit the pasted block. Paste into the **Row** column to use the first pasted column as row names (e.g. gene IDs) and the rest as values.
- **Multiple datasets:** click **+** beside the dataset tabs to add another table; it starts empty (Group1, Group2) and keeps its own data.
- **Clear** resets the current table to the empty default (2 groups × 3 replicates × 6 rows, names reset). Undo with Ctrl/Cmd+Z.
- **📋 Example** (beside the Visualisation and Statistical Test menus) loads a dataset suited to the chosen plot or test, for example survival times for Kaplan–Meier, a concentration series for dose–response, paired before/after values for the paired tests, or a gene × condition matrix for PCA and heatmaps. A note under the table says what was loaded; undo with Ctrl/Cmd+Z.

### 4. Visualisation

Choose a plot type, set its options, then click **📈 Plot**. The figure opens in its own tab, and you can keep as many open as you like.

**Adjusting a figure.** While a figure is open and the menu shows the same plot type, the button reads **↻ Update plot**: change the options (or the data) and click it to redraw that figure in place instead of opening another tab. **↻ Update** in the figure's own top bar does the same. To keep the current figure and draw another one, click **+ New** next to the button or **+** at the end of the plot tabs. Choosing a different plot type always makes a new tab. Clicking a plot tab puts its settings back into the options panel.

**Trying other plot types.** Your settings are kept per plot type for each result. Change a bar chart's settings, switch the menu to a heatmap, then back to Bar + SD + Dots: the same bar chart comes back with your settings (and ↻ Update redraws it). Settings you changed but did not draw yet are kept too. A new test run starts its figures from the defaults again.

**Live update.** Tick *Live update* under the plot options to redraw the open figure as you change them, with no button press. For very large tables (over 2,000 rows) heatmaps, PCA and volcano plots are not redrawn live because it would be slow; the ↻ Update button turns orange instead, and you click it when ready.

**Linked figures.** Updating a figure made by *Auto-plot* (or 🔗) keeps the test's stars, brackets and gene list as long as the data are unchanged. If you have edited the data since the test was run, the marks are removed, the figure is no longer linked, and a note says so: run the test again for an up-to-date figure. Figures you drew by hand never gain marks when updated.

| Plot | Best for | Main options |
| --- | --- | --- |
| Bar + SD + Dots | Group means with spread and individual points | Normalisation; Show data (Mean + dots, Mean only, Dots only); Dots show (Raw replicates, or Group mean = one dot per sample row); Group by (group or sample); Y-axis label |
| Boxplot | Distributions and outliers (red dots) | Same as Bar; significance brackets when made by a test's Auto-plot |
| Violin | Distribution shape | Same as Bar; significance brackets when made by a test's Auto-plot |
| Paired (before–after lines) | Matched measurements: each subject is a line, so you see every pair change (filled circle → open square) | Join: every group in order (before / day 1 / day 7), or groups in pairs 1–2, 3–4, … (e.g. control and treated at several ratios: order the groups so each pair sits side by side); show each group's mean; normalisation; Y-axis label. A subject is one row and replicate; a blank cell drops only that subject's line. Opens automatically after a paired t-test or Wilcoxon signed-rank, with its significance bracket |
| Scatter (X vs Y) | Two variables against each other | X group, Y group, optional trend line |
| Line | Values across rows (time course, samples) | Normalisation, Y-axis label, show points |
| Heatmap (Z-scored) | Many features × samples; significant genes from a gene-level test | Rows: most variable, or significant up (red bar) and down (blue bar) genes from the linked Rank Product / per-row t-test; how many (25–500); columns: group means or every replicate; row normalisation |
| Volcano Plot | Fold change vs significance | log2FC and p-value columns; &#124;log2FC&#124; and p-value cutoffs |
| PCA Scores | Sample clustering | Points show (Group means, All replicates); Color by (Group, Replicate); PC on each axis (X and Y, any component; also changeable on the plot) |
| Kaplan-Meier | Survival curves, one per group (censored subjects shown as tick marks) | Time column; every other column is a group |
| Dose-Response (5PL) | IC50/EC50 curves (log concentration axis) | Concentration column; response column |
| Q-Q Normal | Checking normality by eye | Group to test |
| Histogram | Value distribution | Group (or all groups); number of bins (0 = automatic) |
| Multiple Testing | Raw vs adjusted p-values with a p = 0.05 line | p-values column; correction shown |
| Cumulative Distribution (ECDF) | Comparing whole distributions (pairs with Kolmogorov–Smirnov) | Groups; normalisation; overlay fitted normal curve |

**Normalisation** options for group plots are None, log2, log10, Z-score and Min-Max.

### 5. Statistical tests

Choose a test, set its options, then click **▶ Run Analysis**. The blue box under the test menu says what the test does, how it reads the columns and which similar test to consider; each option shows a one-line explanation of the current choice. Every result tab starts with a grey header listing the test, all options used, the dataset and its size, and the time of the run.

Every result tab has a **⤓ Export CSV** button that saves all of its tables in one file (significance stars dropped so numbers stay numeric). Gene-level results (per-row t-test, Rank Product, Multiple Testing, Volcano, PCA loadings) also offer the **full table** for every row.

Tick **Auto-plot after run** to open a linked plot, and choose which figure in the menu next to it: it lists every plot that suits the test, with the recommended one first (the default). For example Mann–Whitney offers a box plot (recommended), bar chart or violin plot, and a paired t-test offers paired lines (recommended), bar chart or box plot. Bar, box, violin and paired plots carry the test's significance brackets. Significance marks and gene lists appear only on the figure created by that run (not on plots you make by hand later). The 🔗 button on a result jumps to its plot and on a plot jumps to its result. If the partner tab was closed, 🔗 re-creates it with the original settings (using the data as it is now).

| Category | Test | Key options |
| --- | --- | --- |
| Descriptive | Descriptive Statistics | — |
| Descriptive | Normality Test (Shapiro-Wilk) | Each column tested separately (Royston's method, 3 to 5000 values); skewness and excess kurtosis also shown |
| Parametric | Unpaired t-test (Welch) | Normalisation; control group; correction when 3+ groups (default Holm–Šídák); Run per row with its own correction (default FDR) |
| Parametric | Paired t-test | As above, plus Comparison: Difference (A−B), or Ratio (A/B) tested on log ratios and reported as a geometric mean ratio with 95% CI. Values are paired by row and replicate; a blank cell drops only its own pair Ratio cannot be combined with a normalization (it already works on the log scale; with log-transformed values choose Difference). Each row × replicate cell counts as a pair, so average technical repeats per row first. |
| Parametric | One-Way ANOVA | Comparisons: all pairs (Tukey HSD by default) or vs one or more ticked control groups (Dunnett for one control; Holm–Šídák etc. for several); also Holm, Bonferroni, FDR, none |
| Parametric | Two-Way ANOVA | nA, nB; post-hoc: simple effects (B within each A, or A within each B), all cell means, or main effects; Tukey, Holm–Šídák, Holm, Bonferroni, FDR. Balanced designs only The result names what each correction covers: Tukey corrects within each level of the other factor (no correction when a level holds one comparison), Holm, Holm–Šídák, Bonferroni and FDR across all the comparisons listed. |
| Non-parametric | Mann-Whitney U | Exact p-value up to 60 values in total (ties allowed), normal approximation with tie and continuity corrections above; Single pair, All pairs, or vs Control; correction for the multi-pair modes (default Holm–Šídák) |
| Non-parametric | Wilcoxon Signed-Rank | Exact p-value up to 60 non-zero pairs; zero differences left out; Mode and correction as above; Difference or Ratio (ranks log ratios) |
| Non-parametric | Kruskal-Wallis H | Dunn's post-hoc with a choice of correction (default Holm–Šídák) |
| Non-parametric | Rank Product | Group A (reference) vs Group B per row; up and down ranked separately, each with its own FDR; tied values share their average rank; p-values from random ranking within each replicate (cautious upper end shown, both ends in the CSV); optional minimum number of replicate pairs and one FDR for both directions; effect = difference (log data) or log2 ratio (linear data); linked heatmap of up/down genes; full gene table as CSV |
| Non-parametric | Kolmogorov–Smirnov | Two-sample (exact p for small samples) or one-sample vs normal (Lilliefors, p by simulation) The exact p assumes no tied values; the result says so when the data contain ties (the p-value is then conservative). |
| Correlation / XY | Pearson, Spearman | All pairs or vs Control; correction when there are several pairs X and Y are paired replicate by replicate: a row where the two columns hold values in different replicate columns is refused (fill in the missing value, or give both one value per row). Spearman's p-value is exact for 10 or fewer pairs (every ordering of the data) and uses the t approximation above that. |
| Correlation / XY | Regression / Curve Fitting | X and Y columns; Linear, Polynomial (degree 2–4), Logarithmic, Exponential, Power, 4PL, 5PL; fit and residual plots made automatically X and Y are paired as for correlation. A polynomial of degree d needs at least d + 1 different X values. |
| Multivariate | PCA | Samples = group means or every replicate column; optional Z-score per feature; reports variance explained and scores for every component, and top loadings for any chosen PC (CSV of the first 10) |
| Multivariate | Hierarchical Heatmap | Rows = features, columns = groups |
| Categorical | Fisher's Exact (2×2), Chi-Square | Counts tables (first replicate column). Chi-square has no continuity correction, ignores empty rows and columns, and warns when expected counts are below 5 Every cell inside the table must hold a whole-number count: a blank or text cell is refused, not read as 0 (enter 0 for a zero count). |
| Categorical | Multiple Testing Correction | Holm–Šídák, Holm, Bonferroni, FDR (BH) |
| Survival / XY | Kaplan-Meier + log-rank | Any number of groups: median survival, log-rank χ², hazard ratio (2 groups), corrected pairwise log-rank (3+ groups) |
| Survival / XY | Dose-Response (5PL) | Concentration and response columns (one concentration per row with replicate responses is fine); reports EC50 (X half-way between Bottom and Top) and the midpoint parameter C Needs at least 5 different concentrations (with fewer, many curves fit equally well); negative concentrations are refused, a zero dose is allowed. |
| Survival / XY | Volcano Plot | &#124;log2FC&#124; and p-value thresholds |

**Choosing between similar tests**

| If you are deciding between… | Use the first when… | Use the second when… |
| --- | --- | --- |
| Unpaired vs paired t-test | Groups are independent (different animals or samples) | Values are matched (same subject measured twice, or matched by row) |
| t-test vs Mann–Whitney / Wilcoxon | Data are roughly normal; you want to compare means | Data are skewed or have outliers; you compare ranks (medians/distributions) |
| Mann–Whitney vs Wilcoxon signed-rank | Groups are independent | Values are paired |
| One-way ANOVA vs Kruskal–Wallis | 3+ groups, roughly normal, similar spread | 3+ groups, skewed data or outliers |
| One-way vs two-way ANOVA | One factor (e.g. treatment) | Two factors (e.g. genotype × treatment) and their interaction |
| Pearson vs Spearman | The relationship is a straight line and data are roughly normal | The relationship is monotonic but curved, or there are outliers or ranks |
| Correlation vs regression | You only need the strength of association | You want an equation, parameters or predictions |
| Fisher's exact vs Chi-square | 2×2 table with small counts | Larger tables, all expected counts ≥ 5 |
| Mann–Whitney vs Kolmogorov–Smirnov | You expect one group to be shifted higher or lower | Distributions may differ in spread or shape, not just location |
| Shapiro–Wilk vs KS (Lilliefors) normality | Usual choice; more powerful | You want a test based on the whole cumulative distribution (plot it with ECDF) |
| 4PL vs 5PL dose–response | The curve is symmetric | The curve is asymmetric (needs more points) |

**Multiple-comparison corrections**

| Correction | Controls | When to use it |
| --- | --- | --- |
| Dunnett | Family-wise error, vs one control | Each group vs a single control after one-way ANOVA (exact multivariate t); more power than Tukey or Holm–Šídák for this design |
| Tukey HSD | Family-wise error, all pairs | After one-way ANOVA when you compare every pair of means (exact studentised range; Tukey–Kramer for unequal n) |
| Holm–Šídák | Family-wise error | Default for a few planned comparisons (control vs groups, all pairs after Kruskal–Wallis). Slightly more power than Holm; assumes tests are independent or positively correlated. |
| Holm–Bonferroni | Family-wise error | Same goal as Holm–Šídák with no assumption about how tests relate |
| Bonferroni | Family-wise error | Simplest and most conservative; fine for a handful of comparisons |
| Benjamini–Hochberg (FDR) | False discovery rate | Many tests (per-row, genes, screens): more power, accepts a small fraction of false positives. Default for per-row t-tests |
| None | Nothing | Single planned comparison, or exploratory use only |

**Significance brackets.** After you run a test that compares pairs, the linked bar, box, violin or paired plot shows brackets with stars using the corrected p-values: \* p < 0.05, \*\* p < 0.01, \*\*\* p < 0.001, \*\*\*\* p < 0.0001. Non-significant pairs get no bracket. A **per-row** t-test on up to 40 rows opens Bar + SD + Dots *By sample*, with brackets inside each sample; on larger tables it opens a heatmap of the significant up and down genes (or the top-ranked ones if none pass the cutoff).

### 5b. Large datasets (RNA-seq and similar)

TP handles tables with tens of thousands of rows (tested with 20,000 genes × 6 samples).

- The data table only draws the rows in view, so scrolling stays fast; the line under the table shows the full size.
- Paste the table straight from a spreadsheet (paste into the Row column to include gene IDs), or use ⬆ Open CSV….
- Per-row t-tests (with FDR by default) and Multiple Testing show the 200 most significant rows and offer the **full table as CSV**; Rank Product, Volcano and PCA loadings also export every gene.
- Rank Product and per-row t-tests open a heatmap of the significant up and down genes across every replicate.
- Heatmaps cluster and draw only the most variable rows (25–500, chosen in the plot options).
- PCA works on samples (group means or every replicate column) and lists the genes with the largest loadings.
- Bar/box plots *By sample* show the first 40 rows; use *By group* for an overview.
- Volcano, Rank Product, Scatter, Histogram and ECDF use all rows.
- Saved projects of this size are a few MB.

### 6. Exporting figures

Each plot tab has a style menu (**App style** or **Publication style**, shared by all plots) and a **⤓ Export** button that opens a small dialog with PNG, SVG and PDF.

| Style | Look | Size | File names |
| --- | --- | --- | --- |
| App | Exactly as on screen, in the current light or dark theme | Screen size | plot.png / plot.svg |
| Publication | White background; black L-shaped axes with outward ticks, no gridlines; greyscale bars with black outlines; black error bars and dots spread so they don't overlap; bold Arial labels; distinct marker shapes per series | About 300 dpi: bar charts narrow (width grows with the number of groups), other plots 4:3 | plot_publication.png / .svg |

- **PNG (high resolution)** saves a raster image. Use it for slides and most journal submissions.
- **SVG** saves an SVG file that holds the same high-resolution image. It opens in vector-drawing programs but is **not** editable vector art.
- **PDF** opens a print window; choose "Save as PDF". Allow pop-ups for TP if nothing happens.

### 7. Saving and loading projects

**💾 Save project** downloads `thistle_project.tplot`, a text (JSON) file holding the current dataset (values, group, replicate and row names), the result tabs, and a snapshot image of each plot tab. **📂 Load project** reopens it. Projects saved by earlier versions (`.thistle`, `.pprism`) still load.

Each app of the Thistle suite has its own file type: Thistle Plot projects are `.tplot` and Thistle Flow workspaces are `.tflow` (or `.zip` with the FCS files included). If you open a Thistle Flow file here, TP says so and leaves your table unchanged; open it in [Thistle Flow](https://actinomycetes.github.io/thistle-flow/) instead.

Only the dataset that is active when you click Save is stored, so save each dataset separately. Plot snapshots are pictures: to change or re-export a plot after loading, draw it again with 📈 Plot (↻ Update does not apply to snapshots).

**Your work is kept in this browser.** TP keeps a copy of all data tables, result tabs and figures in this browser on this computer, updated a moment after each change. If you refresh the page, close the tab by mistake or the browser restarts, your work reopens where you left off, and a note at the bottom says so. Figures come back as pictures; click **↻ Update** on one to draw it again with its settings. **Start fresh** in that note closes everything and starts with an empty table (🗑 Clear only empties the current table). The copy never leaves this computer and does not replace saving: save a `.tplot` project to keep your work for later, move it to another computer or share it.

- **Shared computers:** anyone who opens TP in the same browser on this computer sees the kept work. When you finish, use **Start fresh**. Private or incognito windows keep nothing after they close.
- **Two windows:** if TP is open in two browser windows or tabs, the one changed last is what reopens next time.
- Undo history is not kept. You are told if the browser could not keep a copy (storage full or blocked); then save a project.
- TP shown inside Thistle Notebook keeps and reopens nothing. On the Confluence wiki the copy depends on the browser's settings for embedded pages.

### 8. Light and dark theme

The 🌙/☀️ button switches the on-screen theme and redraws all open plots. It only affects App-style exports; Publication exports are always white.

### 9. Using TP on the Confluence wiki

1. Host the HTML at an https:// address, for example on GitHub Pages: upload it as `index.html` to a repository, then turn on Settings → Pages.
2. Ask the Confluence admin to allow these iFrame sandbox permissions: `allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox allow-modals`. Without allow-scripts TP does not start; without allow-downloads exports fail silently.
3. On the wiki page, go to Insert more content → Other macros → **iFrame**. Set URL to the hosted address, Width `100%`, Height `900px`, tick Allow Full-Screen Mode, then save.
4. To update TP, replace `index.html` in the repository; the wiki page picks up the new version automatically.

The Widget Connector macro cannot embed TP.

### 10. Troubleshooting and limitations

| Problem | Fix |
| --- | --- |
| Stuck on "Loading…" | TP cannot reach cdnjs.cloudflare.com. Check the internet connection or network firewall. |
| PDF export does nothing | Allow pop-ups for the page. |
| Blank frame on the wiki | Check the iFrame sandbox permissions and that the URL starts with https://. |
| No significance brackets | Run a pairwise test first with Auto-plot ticked, or 🔗 from its result; only corrected p < 0.05 gets a bracket. |
| Test gives an error or NaN | Check the column layout in section 2 and that cells hold numbers, not text. Click 📋 Example beside the test to see the expected layout. |

Known limitations of v0.19.0 (beta):

- Two-Way ANOVA supports balanced designs only (equal n in every cell). Its Tukey post-hoc corrects within each level of the other factor, not across all simple effects (the result says which).
- Exponential and power regression are fitted as straight lines on the log scale (not by non-linear least squares).
- Kolmogorov–Smirnov p-values are exact for data without ties. With tied values the p-value is calculated as if there were no ties (conservative), and the result says so.
- Dunnett's test is for one-way ANOVA with a single control; with several controls, or all pairs, choose another correction (TP refuses Dunnett there).
- One-way ANOVA leaves out a group with no values and names it in the result.
- Rank Product gives tied values (equal effects, e.g. many zeros) their average rank, so the result does not depend on the order of the rows. The current R package RankProd (3.x) instead breaks ties by row order, so rows with many tied values can rank differently there (RankProd 2.x used average ranks, as TP does).
- Rank Product estimates tail probabilities for the question "how often would a row rank this well if its rank in each replicate were drawn at random from that replicate's own ranks?". Tied values keep their shared rank and each replicate keeps its own number of measured rows, so ties and blanks are taken into account. TP shows the cautious upper end of a very narrow range around the exact value (so p is never too small) and the CSV gives both ends. By default every row is used and up and down are corrected separately; you can leave out rows measured in too few replicate pairs, or correct up and down together. Choose these before looking at the results. With many ties the smallest possible p can be large, and then no row may reach significance (for example, if only 2 of 36 rows change in 2 replicates, the best possible p is (2/36)² = 0.0031). RankProd's large-data p-values (Heskes et al. 2014) assume no ties and can be about 10% smaller with few rows.
- Kaplan–Meier assumes one subject per row; hazard ratios are log-rank estimates (no Cox regression).
- SVG export is an embedded image, not editable vectors.
- Publication style is greyscale only; there are no colour publication palettes yet.
- Project files store only the active dataset, and plots only as snapshot images.
- TP has not yet been formally validated against a reference package. Spot-check key results.

### 10b. Using TP on an iPad

TP runs in Safari on iPadOS 16 or later. It is laid out for a large screen, so it works best in landscape with a keyboard and trackpad (Magic Keyboard or similar); portrait works too, with a narrower left panel. Fingers work for buttons, menus and single cells; selecting a block of cells and dragging the panel dividers need the trackpad (or a mouse).

- **Shortcuts:** Cmd+C / Cmd+X / Cmd+V in the table, Cmd+Z / Cmd+Shift+Z for undo and redo. iPad keyboards have no F1 key, so open Help with **Cmd+/** (or the ❓ Help button).
- **Downloads** (PNG, SVG, CSV, 💾 Save project): Safari asks whether to download; tap **Download**. Files go to the Downloads folder in the Files app.
- **📂 Load project** and **⬆ Open CSV…** open the Files app; every file is selectable (iPadOS cannot filter on the `.tplot` extension), so pick the right one.
- **⤓ Export → PDF** opens the figure in a new tab with the print options; tap the Share button at the top of that sheet and choose **Save to Files** to keep a PDF. Close the tab to return to TP.
- Very large tables (tens of thousands of rows) are slower than on a computer, and an iPad has less memory, so close plot tabs you no longer need.

### 11. Checking the calculations

Every statistical test in TP has been compared with independent open-source software (SciPy and statsmodels for Python) on the same data: t-tests, Mann–Whitney, Wilcoxon, ANOVA with Tukey and Dunnett, Kruskal–Wallis and Dunn, two-way ANOVA, correlation and regression, 4PL/5PL fits, Shapiro–Wilk, Lilliefors and Kolmogorov–Smirnov, Fisher's exact, chi-square, Kaplan–Meier, log-rank and the multiple-comparison corrections. The script that does this is in the code repository, with step-by-step instructions: [tools/validate/README.md](https://github.com/actinomycetes/thistle-plot/blob/main/tools/validate/README.md). Agreement with these packages is not a formal validation, so keep spot-checking important results.

### 12. Source code and licences

TP is free and open source under the MIT licence: <https://github.com/actinomycetes/thistle-plot>. © 2026 Takanobu Tagawa (The University of Edinburgh). Report problems or suggestions there.

TP loads three open-source libraries from cdnjs, each under the MIT licence: [Chart.js](https://www.chartjs.org/) (© Chart.js contributors), [jStat](https://github.com/jstat/jstat) (© jStat contributors) and [PapaParse](https://www.papaparse.com/) (© Matthew Holt). Product names mentioned in this manual (for example Confluence) are trademarks of their owners; TP is not affiliated with them.

Methods follow their published descriptions, for example Shapiro–Wilk (Royston 1992, 1995), Dunnett (1955), Rank Product (Breitling et al. 2004; exact rank product distribution, Eisinga et al. 2013), Lilliefors (1967) and the 5-parameter logistic curve (Gottschalk & Dunn 2005).

### 1. Screen layout

TP has a header bar, a left panel for data and settings, and a right panel of result and plot tabs.

| Area | What it holds |
| --- | --- |
| Header | Name, BETA and version badges, 💾 Save, 📂 Load, ⬆ CSV, 🗑 Clear, ❓ Help, 🌙/☀️ theme toggle, Export style menu |
| Left panel, top | Dataset tabs and the data grid |
| Left panel, Visualisation | Plot type, 📋 Example (data suited to that plot), plot options, 📈 Plot |
| Left panel, Statistical Test | Test type, 📋 Example (data suited to that test), description, test options, ▶ Run Analysis |
| Right panel | One tab per result or plot; × closes a tab, 🔗 jumps between a test and its linked plot (and re-creates it if closed) |

### 2. How data is organised

Every dataset is one table: **groups** (conditions, such as Control or Treatment A) across the top, each split into **replicates** (Rep1, Rep2…), and **rows** (samples, genes, time points) down the side.

Most tests pool all values in a group's columns. Some tests read columns positionally instead (Col 1 = X, Col 2 = Y); the blue box under each test says which. The layouts for those tests are:

| Test or plot | Expected layout |
| --- | --- |
| Kaplan-Meier | Col 1 = time; each further column is one group holding 1 (event) or 0 (censored) for its own subjects, blank otherwise (one subject per row, as in Prism) |
| Dose-Response (5PL) | Col 1 = concentration, Col 2 = response |
| Volcano Plot | Col 1 = log2 fold change, Col 2 = p-value, one gene per row |
| Regression | Col 1 = X, Col 2 = Y |
| Multiple Testing Correction | Col 1 = p-values, Col 2 (optional) = labels |
| Fisher's Exact | 2×2 counts: 2 groups (columns) × 2 rows, one value per cell |
| Chi-Square | Counts: columns = groups, rows = categories |
| PCA, Heatmap | Rows = features/genes, columns = groups/samples (PCA can use every replicate column as a sample) |
| Two-Way ANOVA | Balanced design, columns ordered A1B1, A1B2 … A2B1 …; set nA and nB in options |

### 3. Entering and editing data

- **Type** into any cell. Arrow keys move between cells.
- **Paste** a block from Excel or Sheets with Ctrl/Cmd+V; it fills from the selected cell.
- **Copy / cut** a selection with Ctrl/Cmd+C or X. **Delete** or Backspace clears selected cells.
- **Resize** with Reps/group and Groups, or with +Grp, −Grp, +Row, −Row.
- **Rename** a group, row or dataset by double-clicking its name; Enter confirms, Esc cancels.
- **Undo / Redo** with the ↩/↪ buttons or Ctrl/Cmd+Z and Ctrl/Cmd+Y (or Shift+Ctrl/Cmd+Z).
- **Import CSV** with ⬆ CSV. A first row of text becomes group names; a first column of text becomes row names. Each column becomes a group with one replicate.
- **Paste a whole table**: the table grows to fit the pasted block. Paste into the **Row** column to use the first pasted column as row names (e.g. gene IDs) and the rest as values.
- **Multiple datasets:** click **+** beside the dataset tabs to add another table; it starts empty (Group1, Group2) and keeps its own data.
- **Clear** resets the current table to the empty default (2 groups × 3 replicates × 6 rows, names reset). Undo with Ctrl/Cmd+Z.
- **📋 Example** (beside the Visualisation and Statistical Test menus) loads a dataset suited to the chosen plot or test, for example survival times for Kaplan–Meier, a concentration series for dose–response, paired before/after values for the paired tests, or a gene × condition matrix for PCA and heatmaps. A note under the table says what was loaded; undo with Ctrl/Cmd+Z.

### 4. Visualisation

Choose a plot type, set its options, then click **📈 Plot**. Each plot opens in its own tab, and you can keep as many open as you like.

| Plot | Best for | Main options |
| --- | --- | --- |
| Bar + SD + Dots | Group means with spread and individual points | Normalisation; Show data (Mean + dots, Mean only, Dots only); Dots show (Raw replicates, or Group mean = one dot per sample row); Group by (group or sample); Y-axis label |
| Boxplot | Distributions and outliers (red dots) | Same as Bar |
| Violin | Distribution shape | Same as Bar |
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

Every result tab has a **⬇ Tables (CSV)** button that saves all of its tables in one file (significance stars dropped so numbers stay numeric). Gene-level results (per-row t-test, Rank Product, Multiple Testing, Volcano, PCA loadings) also offer the **full table** for every row.

Tick **Auto-plot after run** to open a linked plot. Significance marks and gene lists appear only on the figure created by that run (not on plots you make by hand later). The 🔗 button on a result jumps to its plot and on a plot jumps to its result. If the partner tab was closed, 🔗 re-creates it with the original settings (using the data as it is now).

| Category | Test | Key options |
| --- | --- | --- |
| Descriptive | Descriptive Statistics | — |
| Descriptive | Normality Test (Shapiro-Wilk) | Each column tested separately |
| Parametric | Unpaired t-test (Welch) | Normalisation; control group; correction when 3+ groups (default Holm–Šídák); Run per row with its own correction (default FDR) |
| Parametric | Paired t-test | As above, plus Comparison: Difference (A−B) or Ratio (A/B) |
| Parametric | One-Way ANOVA | Comparisons: all pairs (Tukey HSD by default) or vs one or more ticked control groups (Dunnett for one control; Holm–Šídák etc. for several); also Holm, Bonferroni, FDR, none |
| Parametric | Two-Way ANOVA | nA, nB; post-hoc: simple effects (B within each A, or A within each B), all cell means, or main effects; Tukey, Holm–Šídák, Holm, Bonferroni, FDR. Balanced designs only |
| Non-parametric | Mann-Whitney U | Single pair, All pairs, or vs Control; correction for the multi-pair modes (default Holm–Šídák) |
| Non-parametric | Wilcoxon Signed-Rank | Mode and correction as above; Difference or Ratio |
| Non-parametric | Kruskal-Wallis H | Dunn's post-hoc with a choice of correction (default Holm–Šídák) |
| Non-parametric | Rank Sum (paired) | Mode and correction as above; Difference or Ratio |
| Non-parametric | Rank Product | Group A (reference) vs Group B per row; up and down ranked separately, each with its own FDR; effect = difference (log data) or log2 ratio (linear data); linked heatmap of up/down genes; full gene table as CSV |
| Non-parametric | Kolmogorov–Smirnov | Two-sample (exact p for small samples) or one-sample vs normal (Lilliefors, p by simulation) |
| Correlation / XY | Pearson, Spearman | All pairs or vs Control; correction when there are several pairs |
| Correlation / XY | Regression / Curve Fitting | X and Y columns; Linear, Polynomial (degree 2–4), Logarithmic, Exponential, Power, 4PL, 5PL; fit and residual plots made automatically |
| Multivariate | PCA | Samples = group means or every replicate column; optional Z-score per feature; reports variance explained and scores for every component, and top loadings for any chosen PC (CSV of the first 10) |
| Multivariate | Hierarchical Heatmap | Rows = features, columns = groups |
| Categorical | Fisher's Exact (2×2), Chi-Square | Counts tables |
| Categorical | Multiple Testing Correction | Holm–Šídák, Holm, Bonferroni, FDR (BH) |
| Survival / XY | Kaplan-Meier + log-rank | Any number of groups: median survival, log-rank χ², hazard ratio (2 groups), corrected pairwise log-rank (3+ groups) |
| Survival / XY | Dose-Response (5PL) | Concentration and response columns |
| Survival / XY | Volcano Plot | &#124;log2FC&#124; and p-value thresholds |

**Choosing between similar tests**

| If you are deciding between… | Use the first when… | Use the second when… |
| --- | --- | --- |
| Unpaired vs paired t-test | Groups are independent (different animals or samples) | Values are matched (same subject measured twice, or matched by row) |
| t-test vs Mann–Whitney / Wilcoxon | Data are roughly normal; you want to compare means | Data are skewed or have outliers; you compare ranks (medians/distributions) |
| Mann–Whitney vs Wilcoxon signed-rank | Groups are independent | Values are paired |
| Wilcoxon signed-rank vs Rank Sum (paired) | You test the paired difference | You want to test ratios (fold changes) as well as differences |
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
| Holm–Šídák | Family-wise error | Default for a few planned comparisons (control vs groups, all pairs after Kruskal–Wallis). Slightly more power than Holm; assumes tests are independent or positively correlated. Prism's default |
| Holm–Bonferroni | Family-wise error | Same goal as Holm–Šídák with no assumption about how tests relate |
| Bonferroni | Family-wise error | Simplest and most conservative; fine for a handful of comparisons |
| Benjamini–Hochberg (FDR) | False discovery rate | Many tests (per-row, genes, screens): more power, accepts a small fraction of false positives. Default for per-row t-tests |
| None | Nothing | Single planned comparison, or exploratory use only |

**Significance brackets.** After you run a test that compares pairs, the linked Bar + SD + Dots plot shows brackets with stars using the corrected p-values: \* p < 0.05, \*\* p < 0.01, \*\*\* p < 0.001, \*\*\*\* p < 0.0001. Non-significant pairs get no bracket. A **per-row** t-test on up to 40 rows opens Bar + SD + Dots *By sample*, with brackets inside each sample; on larger tables it opens a heatmap of the significant up and down genes (or the top-ranked ones if none pass the cutoff).

### 5b. Large datasets (RNA-seq and similar)

TP handles tables with tens of thousands of rows (tested with 20,000 genes × 6 samples).

- The data table only draws the rows in view, so scrolling stays fast; the line under the table shows the full size.
- Paste the table straight from Excel (paste into the Row column to include gene IDs), or use ⬆ CSV.
- Per-row t-tests (with FDR by default) and Multiple Testing show the 200 most significant rows and offer the **full table as CSV**; Rank Product, Volcano and PCA loadings also export every gene.
- Rank Product and per-row t-tests open a heatmap of the significant up and down genes across every replicate.
- Heatmaps cluster and draw only the most variable rows (25–500, chosen in the plot options).
- PCA works on samples (group means or every replicate column) and lists the genes with the largest loadings.
- Bar/box plots *By sample* show the first 40 rows; use *By group* for an overview.
- Volcano, Rank Product, Scatter, Histogram and ECDF use all rows.
- Saved projects of this size are a few MB.

### 6. Exporting figures

The **Export** menu in the header sets the style for every download button.

| Style | Look | Size | File names |
| --- | --- | --- | --- |
| App | Exactly as on screen, in the current light or dark theme | Screen size | plot.png / plot.svg |
| Publication (Prism-like) | White background; black L-shaped axes with outward ticks, no gridlines; greyscale bars with black outlines; black error bars and dots spread so they don't overlap; bold Arial labels; distinct marker shapes per series | About 300 dpi: bar charts narrow (width grows with the number of groups), other plots 4:3 | plot_publication.png / .svg |

- **⬇ PNG** saves a raster image. Use it for slides and most journal submissions.
- **⬇ SVG** saves an SVG file that wraps the same high-resolution image. It opens in Illustrator or Inkscape but is **not** editable vector art.
- **⬇ PDF** opens a print window; choose "Save as PDF". Allow pop-ups for TP if nothing happens.

### 7. Saving and loading projects

**💾 Save** downloads `thistle_project.thistle`, a text (JSON) file holding the current dataset (values, group, replicate and row names), the result tabs, and a snapshot image of each plot tab. **📂 Load** reopens it. Projects saved by earlier versions (`.pprism`) still load.

Only the dataset that is active when you click Save is stored, so save each dataset separately. Plot snapshots are pictures: to change or re-export a plot after loading, click 📈 Plot again.

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

Known limitations of v0.8.2 (beta):

- Two-Way ANOVA supports balanced designs only (equal n in every cell).
- Dunnett's test is for one-way ANOVA with a single control; with several controls TP uses the chosen correction instead.
- Kaplan–Meier assumes one subject per row; hazard ratios are log-rank estimates (no Cox regression).
- SVG export is an embedded image, not editable vectors.
- Publication style is greyscale only; there are no colour publication palettes yet.
- Project files store only the active dataset, and plots only as snapshot images.
- TP has not yet been formally validated against a reference package. Spot-check key results.

## About TP

Thistle Plot (TP) is a free, single-file web app for bench statistics and publication-ready figures. It runs entirely in your web browser (no installation, no server) and never uploads your data anywhere. Source code: <https://github.com/actinomycetes/thistle-plot> (MIT licence).

TP is a **beta (v0.14.0)**. Its calculations are cross-checked against SciPy and statsmodels (see *Checking the calculations* in the Full Manual). This is not a formal validation, so important results should still be spot-checked against an established package before you rely on them in a publication.

**Opening TP:** use the hosted copy at <https://actinomycetes.github.io/thistle-plot/>, double-click a downloaded `index.html` to open it in Chrome, Edge, Firefox or Safari (Mac or iPad), or open the lab's hosted copy (for example the one embedded on the Confluence wiki). TP needs an internet connection the first time it loads because it fetches three helper libraries (Chart.js, jStat, PapaParse) from cdnjs.cloudflare.com.

## Quick Manual

From raw numbers to a journal-style figure in ten steps, about five minutes.

1. **Open TP**, pick a test or plot, and click the **📋 Example** button beside its menu to load data laid out for it. Click **🗑 Clear** when you are ready for your own data (it resets to an empty 2-group table).
2. **Set the shape of your table.** In the Data panel, set **Reps/group** (replicates per group) and **Groups** (conditions). Use **+Row / −Row** for samples.
3. **Enter data.** Paste a block straight from a spreadsheet with Ctrl/Cmd+V, or click **⬆ Open CSV…** to import a file. Double-click a group header or row name to rename it.
4. **Pick a test** under **Statistical Test**, for example *One-Way ANOVA* or *Unpaired t-test (Welch)*. Read the blue box under the menu: it says what the test does, how it expects the columns, and which similar test to use instead. Each option also shows a one-line explanation.
5. **Click ▶ Run Analysis.** Results appear in a new tab on the right, headed by the options and data used. With *Auto-plot after run* ticked, a linked plot opens too (pick which figure in the menu beside it; the recommended one is preselected); 🔗 jumps between them, and re-creates either one if you closed it.
6. **Pick a plot** under **Visualisation**, for example *Bar + SD + Dots*, set its options (normalisation, dots shown, Y-axis label) and click **📈 Plot**. To adjust it, change the options and click **↻ Update plot** (or tick *Live update* to redraw as you go); **+ New** keeps the figure and opens another tab.
7. **Check the figure.** Significance brackets (\*, \*\*, \*\*\*, \*\*\*\*) from your last test are drawn automatically on bar charts.
8. **Choose an export style** at the top of the plot tab: **App style** (what you see on screen) or **Publication style** (white background, black axes, bold Arial, greyscale, about 300 dpi).
9. **Download** with **⤓ Export** next to it and choose PNG, SVG or PDF.
10. **Save your work** with **💾 Save project**. This downloads a `.tplot` project file you can reopen later with **📂 Load project**. Until then, TP also keeps a copy in this browser, so a refresh or a closed tab reopens your work (use **Start fresh** in the note that appears to begin again).

Tip: Ctrl/Cmd+Z undoes and Ctrl/Cmd+Y redoes any change to the data table.

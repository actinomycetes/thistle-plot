// Thistle Flow layout: file actions next to the name, Help/theme on the right; each plot tab has the export
// style menu and one ⤓ Export button that opens a small dialog with PNG / SVG / PDF.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openApp, selectTest } = require('./helpers');

let app;
before(async () => { app = await openApp({ consoleErrors: true }); });
after(async () => { await app.close(); });

test('header: Open CSV, Save, Load, Clear beside the name; Help and theme at the right', async () => {
  const r = await app.page.evaluate(() => {
    const x = s => [...document.querySelectorAll('#hdr button')].find(b => b.textContent.includes(s)).getBoundingClientRect().left;
    return { title: document.querySelector('#hdr .title').getBoundingClientRect().right, open: x('Open CSV'), save: x('Save project'), load: x('Load project'),
      clear: x('Clear'), help: x('Help'), theme: document.getElementById('theme-btn').getBoundingClientRect().right, W: innerWidth, oldMenu: !!document.querySelector('#hdr select') };
  });
  assert.ok(r.title < r.open && r.open < r.save && r.save < r.load && r.load < r.clear, JSON.stringify(r));
  assert.ok(r.help > r.W / 2 && r.W - r.theme < 30, 'Help and theme at the right');
  assert.strictEqual(r.oldMenu, false, 'no export menu in the header');
});

test('⤓ Export dialog: three formats, the chosen style, closes on Escape, downloads', async () => {
  await selectTest(app.page, 'desc');
  await app.page.evaluate(async () => { loadExampleFor('stat'); await new Promise(r => setTimeout(r, 80)); runAnalysis(); await new Promise(r => setTimeout(r, 1200)); });
  const pid = await app.page.evaluate(() => activePT);
  const bar = `#${pid} .plot-topbar`;
  await app.page.selectOption(`${bar} select.exp-style`, 'publication');
  assert.strictEqual(await app.page.evaluate(() => getExportStyle()), 'publication');
  await app.page.click(`${bar} button:has-text("Export")`);
  const pop = await app.page.evaluate(() => { const p = document.querySelector('.popover'); return p && { t: p.textContent, n: p.querySelectorAll('[data-fmt]').length }; });
  assert.ok(pop && pop.n === 3 && /PNG \(high resolution\)/.test(pop.t) && /Publication style/.test(pop.t), JSON.stringify(pop));
  await app.page.keyboard.press('Escape');
  assert.strictEqual(await app.page.evaluate(() => !!document.querySelector('.popover')), false);
  await app.page.click(`${bar} button:has-text("Export")`);
  const [dl] = await Promise.all([app.page.waitForEvent('download'), app.page.click('.popover [data-fmt="png"]')]);
  assert.strictEqual(dl.suggestedFilename(), 'plot_publication.png');
  assert.strictEqual(await app.page.evaluate(() => !!document.querySelector('.popover')), false, 'closes after a choice');
  // a new plot tab shows the same style
  await app.page.evaluate(async () => { newPlot(); await new Promise(r => setTimeout(r, 300)); });
  assert.strictEqual(await app.page.evaluate(() => document.querySelector(`#${activePT} select.exp-style`).value), 'publication');
  await app.page.evaluate(() => setExportStyle('app'));
  assert.deepStrictEqual(app.errors, []);
});

test('Publication export: long x labels are angled, short ones stay level, the legend wraps inside the figure', async () => {
  const r = await app.page.evaluate(async () => {
    const long = ['JJhan_Uninfected.fcs', 'JJhan_P6 3dpi 1-4.fcs', 'JJhan_StA_P6_C1.fcs', 'JJhan_StA_P6_C2.fcs', 'JJhan_StA_P6_C3.fcs', 'JJhan_StA_P6_C4.fcs', 'JJhan_StA_P6_DMSO.fcs'];
    const cv = document.createElement('canvas').getContext('2d');
    _exportTheme = PUB_THEME;
    try {
      const a = _xLabelLayout(cv, long, 70, 420), b = _xLabelLayout(cv, ['WT', 'KO'], 200, 420);
      const lg = _legendLayout(cv, ['JJ/Singlets/GFP- RFP+ | % Parent', 'JJ/Singlets/GFP+ RFP+ | % Parent', 'JJ/Singlets/GFP+ RFP- | % Parent'], 520);
      // the by-sample bar chart from the report draws without errors in both styles
      applyG({ nReps: 1, nRows: 7, rowNames: long, groups: [0, 1, 2].map(k => ({ name: 'JJ/Singlets/G' + k + ' | % Parent', reps: ['Rep1'], data: long.map((_, i) => [i + k]) })) });
      return { a: a.rot, b: b.rot, lines: Math.max(...lg.items.map(i => i.line)) + 1, fits: lg.items.every(i => i.x < 520) };
    } finally { _exportTheme = null; }
  });
  assert.strictEqual(r.a, true, 'long labels angled'); assert.strictEqual(r.b, false, 'short labels level');
  assert.ok(r.lines >= 2 && r.fits, 'legend wraps');
  await app.page.evaluate(async () => { const ps = document.getElementById('psel'); ps.value = 'bar_sd'; renderPlotOpts('bar_sd'); document.getElementById('popt-groupby').value = 'sample'; runPlot(); await new Promise(r => setTimeout(r, 400)); _renderExport(activePT, 'publication'); });
  assert.deepStrictEqual(app.errors, []);
});

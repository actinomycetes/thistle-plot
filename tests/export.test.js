// PNG export works in both styles and is neither blank nor tiny.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { openApp, selectPlot, wait, OUT } = require('./helpers');

let app;
before(async () => { app = await openApp(); });
after(async () => { await app.close(); });

for (const plot of ['bar_sd', 'boxplot', 'scatter', 'heatmap', 'pca']) {
  for (const style of ['app', 'publication']) {
    test(`${plot} exports a PNG (${style} style)`, async () => {
      await selectPlot(app.page, plot);
      await app.page.evaluate(async () => { loadExampleFor('plot'); await new Promise(r => setTimeout(r, 80)); runPlot(); });
      await wait(app.page, 800);
      await app.page.selectOption('#export-style', style);
      const [dl] = await Promise.all([app.page.waitForEvent('download'),
        app.page.evaluate(() => downloadTabPlot(plotTabs[plotTabs.length - 1].id))]);
      const f = path.join(OUT, `${plot}_${style}.png`); await dl.saveAs(f);
      const buf = fs.readFileSync(f);
      assert.strictEqual(buf.slice(1, 4).toString(), 'PNG');
      assert.ok(buf.length > 6000, 'suspiciously small (blank?) PNG: ' + buf.length);
      assert.deepStrictEqual(app.errors, []);
    });
  }
}

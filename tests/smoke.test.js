// Every statistical test and every plot type must run on its own example data without errors.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openApp, selectTest, selectPlot, wait } = require('./helpers');

let app;
before(async () => { app = await openApp({ consoleErrors: true }); });
after(async () => { await app.close(); });

test('app loads, version is consistent', async () => {
  const v = await app.page.evaluate(() => ({ js: APP_VERSION, badge: document.getElementById('app-version').textContent, title: document.title }));
  assert.strictEqual(v.badge, 'v' + v.js);
  assert.ok(v.title.includes(v.js), 'document title carries the version: ' + v.title);
  assert.deepStrictEqual(app.errors, []);
});

test('every statistical test runs on its example data', async () => {
  const types = await app.page.evaluate(() => ANALYSIS_TYPES.map(t => t.v));
  assert.ok(types.length >= 20);
  const bad = [];
  for (const t of types) {
    await selectTest(app.page, t);
    const r = await app.page.evaluate(async () => {
      loadExampleFor('stat'); await new Promise(r => setTimeout(r, 80));
      const n0 = statTabs.length; runAnalysis(); await new Promise(r => setTimeout(r, 900));
      if (statTabs.length === n0) return { ok: false, why: 'no result tab' };
      const st = statTabs[statTabs.length - 1];
      const isErr = st.html.includes('class="ebox"') && !st.html.includes('scard');
      return { ok: !isErr, why: isErr ? st.html.replace(/<[^>]+>/g, ' ').slice(0, 140) : '' };
    });
    if (!r.ok) bad.push(t + ': ' + r.why);
  }
  assert.deepStrictEqual(bad, [], 'tests that failed on their example data');
  assert.deepStrictEqual(app.errors, []);
});

test('every plot type draws from its example data', async () => {
  const plots = await app.page.evaluate(() => PLOT_TYPES.map(t => t.v));
  const bad = [];
  for (const p of plots) {
    await selectPlot(app.page, p);
    const r = await app.page.evaluate(async () => {
      loadExampleFor('plot'); await new Promise(r => setTimeout(r, 80));
      const n0 = plotTabs.length; runPlot(); await new Promise(r => setTimeout(r, 700));
      return plotTabs.length > n0;
    });
    if (!r) bad.push(p);
  }
  assert.deepStrictEqual(bad, [], 'plots that did not open a tab');
  assert.deepStrictEqual(app.errors, []);
});

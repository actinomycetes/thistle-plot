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

test('Thistle suite icon: header logo and tab icon are the same thistle with the table badge', async () => {
  const r = await app.page.evaluate(() => {
    const fav = document.querySelector('link[rel="icon"]').getAttribute('href');
    const logo = document.querySelector('#hdr svg.app-logo');
    const touch = document.querySelector('link[rel="apple-touch-icon"]');
    return { fav, logo: logo && logo.innerHTML, viewBox: logo && logo.getAttribute('viewBox'), touch: touch && touch.getAttribute('href') };
  });
  // fully percent-encoded (no raw spaces or quotes), which Safari on iPad reads reliably
  assert.match(r.fav, /^data:image\/svg\+xml,%3Csvg[^ '"]*$/);
  const svg = decodeURIComponent(r.fav.slice('data:image/svg+xml,'.length));
  assert.match(svg, /viewBox="0 0 32 32"/);
  assert.match(svg, /<circle cx="9\.7" cy="12\.7" r="\.95"\/>/, 'dotted thistle head');
  assert.match(svg, /stroke="#2563eb"/, 'blue table badge');
  assert.strictEqual(r.viewBox, '0 0 32 32');
  const same = await app.page.evaluate(([a, b]) => {
    const d = s => new DOMParser().parseFromString(s, 'image/svg+xml').documentElement;
    const x = d(a), y = d(new XMLSerializer().serializeToString(new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + b + '</svg>', 'image/svg+xml').documentElement));
    return x.innerHTML === y.innerHTML;
  }, [svg, r.logo]);
  assert.ok(same, 'header logo draws the same picture as the tab icon');
  assert.match(r.touch || '', /^data:image\/png;base64,iVBOR/, 'apple-touch-icon PNG for Safari');
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

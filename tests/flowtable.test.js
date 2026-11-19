// Tables sent from Thistle Flow (📊 Open in Thistle Plot) and ⇄ Transpose.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const playwright = require('playwright');
const { openApp } = require('./helpers');

const ROOT = path.resolve(__dirname, '..');
const lib = rel => fs.readFileSync(path.join(ROOT, 'node_modules', rel));
let server, base;
before(async () => { // both pages on one local origin, like GitHub Pages
  server = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); res.end(fs.readFileSync(f));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function flowContext() {
  const dev = { ipad: 'iPad Pro 11 landscape', 'ipad-portrait': 'iPad Pro 11' }[process.env.TP_DEVICE || ''];
  const browser = await playwright[dev ? 'webkit' : (process.env.TP_BROWSER || 'chromium')].launch();
  const ctx = await browser.newContext(dev ? playwright.devices[dev] : { viewport: { width: 1400, height: 900 } });
  const libs = { chart: lib('chart.js/dist/chart.umd.js'), jstat: lib('jstat/dist/jstat.min.js'), papa: lib('papaparse/papaparse.min.js') };
  await ctx.route('**/cdnjs.cloudflare.com/**', r => { const u = r.request().url().toLowerCase();
    r.fulfill({ contentType: 'application/javascript', body: u.includes('chart') ? libs.chart : u.includes('jstat') ? libs.jstat : libs.papa }); });
  return { browser, ctx };
}

test('a statistics table from Thistle Flow opens as a new dataset', async () => {
  const { browser, ctx } = await flowContext();
  try {
    const flow = await ctx.newPage();
    await flow.goto(`${base}/tests/fixtures/fake-flow.html?target=${encodeURIComponent(base + '/index.html?nosession')}`);
    const [tp] = await Promise.all([ctx.waitForEvent('page'), flow.click('#open')]);
    const errors = []; tp.on('pageerror', e => errors.push(e.message));
    await flow.waitForFunction(() => window.__log.some(m => m.type === 'thistle-table-received'), null, { timeout: 20000 });
    const got = await flow.evaluate(() => window.__log.find(m => m.type === 'thistle-table-received'));
    assert.deepStrictEqual({ rows: got.rows, columns: got.columns }, { rows: 3, columns: 3 });
    const r = await tp.evaluate(() => ({ name: datasets[activeDS].name, n: datasets.length, rows: G.rowNames, groups: G.groups.map(g => g.name),
      missing: G.groups[1].data[1][0], hash: location.hash, note: document.getElementById('data-note').textContent }));
    assert.strictEqual(r.name, 'Workspace 1: statistics');
    assert.deepStrictEqual(r.rows, ['Unstimulated.fcs', 'Stim_6h.fcs', 'Stim_24h.fcs']);
    assert.deepStrictEqual(r.groups, ['Lymphocytes | %Parent', 'CD4+ | Median | FITC-A', 'CD8+ | Count']);
    assert.strictEqual(r.missing, '', 'an empty cell stays empty');
    assert.strictEqual(r.hash, '', 'the hash is cleared so a refresh does not wait for Flow');
    assert.match(r.note, /Imported 3 rows × 3 columns from Thistle Flow/);
    assert.strictEqual(r.n, 1, 'the empty starting table is reused, not left behind');
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); }
});

test('an existing table is kept: the Flow table goes into a new dataset; other senders are ignored', async () => {
  const { browser, ctx } = await flowContext();
  try {
    const flow = await ctx.newPage();
    await flow.goto(`${base}/tests/fixtures/fake-flow.html?target=${encodeURIComponent(base + '/index.html?nosession')}`);
    const [tp] = await Promise.all([ctx.waitForEvent('page'), flow.click('#open')]);
    await flow.waitForFunction(() => window.__log.some(m => m.type === 'thistle-table-received'), null, { timeout: 20000 });
    // a second table from a page that is not the opener is ignored
    const r = await tp.evaluate(async () => {
      loadExample(); const before = JSON.stringify(G);
      window.postMessage({ type: 'thistle-table', version: 1, title: 'Not Flow', csv: 'a,b\n1,2' }, '*');
      await new Promise(r => setTimeout(r, 200));
      return { same: JSON.stringify(G) === before, n: datasets.length };
    });
    assert.ok(r.same, 'a message from anyone but the Flow tab changes nothing');
    // now an import while a table is open goes into a new dataset
    const r2 = await tp.evaluate(() => { const n = datasets.length; const d0 = activeDS;
      importFlowTable({ title: 'Second', csv: 'Sample,X\ns1,1\ns2,2' }); return { added: datasets.length - n, other: datasets[d0].G.groups[0].name, name: datasets[activeDS].name }; });
    assert.strictEqual(r2.added, 1); assert.strictEqual(r2.other, 'Control'); assert.strictEqual(r2.name, 'Second');
  } finally { await browser.close(); }
});

test('⇄ Transpose swaps rows and groups, and undo puts it back', async () => {
  const app = await openApp({ consoleErrors: true });
  try {
    const r = await app.page.evaluate(() => {
      applyG({ nReps: 2, nRows: 3, rowNames: ['s1', 's2', 's3'], groups: [
        { name: 'A', reps: ['R1', 'R2'], data: [[1, 2], [3, ''], [5, 6]] }, { name: 'B', reps: ['R1', 'R2'], data: [[7, 8], [9, 10], [11, 12]] }] });
      const before = JSON.stringify(G);
      document.querySelector('button[onclick="transposeTable()"]').click();
      const t = { groups: G.groups.map(g => g.name), rows: G.rowNames, s2: G.groups[1].data.map(r => r[0]), nReps: G.nReps };
      undoAction();
      return { t, back: JSON.stringify(G) === before };
    });
    assert.deepStrictEqual(r.t.groups, ['s1', 's2', 's3']);
    assert.deepStrictEqual(r.t.rows, ['A · R1', 'A · R2', 'B · R1', 'B · R2']);
    assert.deepStrictEqual(r.t.s2, [3, '', 9, 10]);
    assert.strictEqual(r.t.nReps, 1);
    assert.ok(r.back, 'undo restores the original table');
    assert.deepStrictEqual(app.errors, []);
  } finally { await app.close(); }
});

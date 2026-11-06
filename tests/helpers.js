// Shared test harness: opens index.html in headless Chromium with the three CDN
// libraries served from node_modules (so tests run offline and with pinned versions).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const APP = process.env.TP_APP || path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'test-output');
fs.mkdirSync(OUT, { recursive: true });

function lib(rel) { return fs.readFileSync(path.join(ROOT, 'node_modules', rel)); }

async function openApp(opts = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  if (opts.consoleErrors) page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const libs = {
    chart: lib('chart.js/dist/chart.umd.js'),
    jstat: lib('jstat/dist/jstat.min.js'),
    papa: lib('papaparse/papaparse.min.js'),
  };
  await page.route('**/cdnjs.cloudflare.com/**', r => {
    const u = r.request().url().toLowerCase();
    const body = u.includes('chart') ? libs.chart : u.includes('jstat') ? libs.jstat : libs.papa;
    r.fulfill({ contentType: 'application/javascript', body });
  });
  await page.goto('file://' + APP);
  await page.waitForFunction(() => document.getElementById('hdr').style.display !== 'none');
  return { browser, page, errors, close: () => browser.close() };
}

// Select a Statistical Test (or Visualisation) and fire its change handler.
const selectTest = (page, v) => page.evaluate(async v => {
  const a = document.getElementById('asel'); a.value = v; a.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 60));
}, v);
const selectPlot = (page, v) => page.evaluate(async v => {
  const a = document.getElementById('psel'); a.value = v; a.dispatchEvent(new Event('change'));
  await new Promise(r => setTimeout(r, 60));
}, v);

// Fill the data table with a random-ish genes x (Control, Treated) matrix: first nUp rows up, next nDown down.
const loadGenes = (page, N, nUp = 400, nDown = 400) => page.evaluate(([N, nUp, nDown]) => {
  const rnd = _mulberry32(7);
  const g = () => { const u = Math.max(rnd(), 1e-9), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const G2 = { nReps: 3, nRows: N, rowNames: [], groups: [
    { name: 'Control', reps: ['R1', 'R2', 'R3'], data: [] }, { name: 'Treated', reps: ['R1', 'R2', 'R3'], data: [] }] };
  for (let i = 0; i < N; i++) {
    const base = 4 + rnd() * 8, eff = i < nUp ? 2 : i < nUp + nDown ? -1.5 : 0;
    G2.rowNames.push('GENE' + (i + 1));
    G2.groups[0].data.push([0, 1, 2].map(() => +(base + 0.3 * g()).toFixed(3)));
    G2.groups[1].data.push([0, 1, 2].map(() => +(base + eff + 0.3 * g()).toFixed(3)));
  }
  applyG(G2);
}, [N, nUp, nDown]);

const wait = (page, ms) => page.waitForTimeout(ms);

module.exports = { openApp, selectTest, selectPlot, loadGenes, wait, OUT, APP };

// Paired (before–after lines) plot: one line per subject (row × replicate), linked to paired tests.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openApp, selectTest, selectPlot } = require('./helpers');

let app;
before(async () => { app = await openApp({ consoleErrors: true }); });
after(async () => { await app.close(); });
const ev = (fn, arg) => app.page.evaluate(fn, arg);
const lastInfo = () => ev(() => { const t = plotTabs[plotTabs.length - 1]; const c = document.querySelector('#' + t.id + ' canvas'); return { info: c?._pairedInfo, psel: t.optState?.psel }; });
const fourGroups = { nReps: 1, nRows: 3, rowNames: ['D1', 'D2', 'D3'], groups: [
  { name: 'A 1:2', reps: ['R1'], data: [[10], [12], [9]] }, { name: 'B 1:2', reps: ['R1'], data: [[4], [5], ['']] },
  { name: 'A 1:1', reps: ['R1'], data: [[11], [13], [8]] }, { name: 'B 1:1', reps: ['R1'], data: [[3], [4], [2]] }] };

test('a paired t-test auto-plots paired lines with its significance bracket', async () => {
  await selectTest(app.page, 'ttest_rel');
  await ev(async () => { loadExampleFor('stat'); await new Promise(r => setTimeout(r, 80)); runAnalysis(); await new Promise(r => setTimeout(r, 1200)); });
  const { info } = await lastInfo();
  const n = await ev(() => pairedCells(0, 1).a.length);
  assert.ok(info, 'paired plot drawn');
  assert.strictEqual(info.lines, n); assert.strictEqual(info.brackets, 1);
});

test('"pairs" mode joins only groups 1-2 and 3-4, and a blank cell drops only its own line', async () => {
  await selectPlot(app.page, 'paired');
  await ev(async G2 => { applyG(G2); renderPlotOpts('paired'); document.getElementById('popt-pjoin').value = 'pairs'; runPlot(); await new Promise(r => setTimeout(r, 200)); }, fourGroups);
  const { info } = await lastInfo();
  assert.strictEqual(info.subjects, 3);
  assert.strictEqual(info.lines, 5); // D1, D2 in both pairs; D3 only in the second pair (B 1:2 is blank)
  assert.strictEqual(info.brackets, 0, 'a plot drawn by hand shows no test marks');
  assert.ok(info.pos[2] - info.pos[1] > info.pos[1] - info.pos[0], 'gap between the pairs');
  await ev(async () => { document.getElementById('popt-pjoin').value = 'all'; runPlot(); await new Promise(r => setTimeout(r, 200)); });
  assert.strictEqual((await lastInfo()).info.lines, 7); // D1, D2: 3 lines each; D3: only 1:1 A–B
});

test('per-row paired t-tests keep the By-sample bar chart', async () => {
  await selectTest(app.page, 'ttest_rel');
  await ev(async () => { loadExampleFor('stat'); await new Promise(r => setTimeout(r, 80)); document.getElementById('opt-perrow').checked = true; runAnalysis(); await new Promise(r => setTimeout(r, 1200)); });
  assert.strictEqual((await lastInfo()).psel, 'bar_sd');
});

test('publication export of the paired plot', async () => {
  await selectPlot(app.page, 'paired');
  const r = await ev(async G2 => { applyG(G2); renderPlotOpts('paired'); runPlot(); await new Promise(r => setTimeout(r, 200));
    const t = plotTabs[plotTabs.length - 1]; const c = _renderExport(t.id, 'publication'); return { w: c.width, h: c.height }; }, fourGroups);
  assert.ok(r.w > 0 && r.w < 600 * 3, JSON.stringify(r)); // narrower than the default 600-px figure
  assert.deepStrictEqual(app.errors, []);
});

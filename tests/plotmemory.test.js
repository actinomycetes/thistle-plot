// Browsing plot types for one result keeps each type's settings: bar → (change settings) → box → bar
// shows the same bar chart with its settings, not the defaults.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openApp, selectTest } = require('./helpers');

let app;
before(async () => { app = await openApp({ consoleErrors: true }); });
after(async () => { await app.close(); });
const ev = (fn, arg) => app.page.evaluate(fn, arg);
const pause = ms => new Promise(r => setTimeout(r, ms));
// change the plot type the way a user does (menu + change event)
const pickPlot = v => ev(async v => { const s = document.getElementById('psel'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 200)); }, v);
const setOpt = (id, v) => ev(([id, v]) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }, [id, v]);
const state = () => ev(() => ({ psel: document.getElementById('psel').value, ylab: document.getElementById('popt-ylab')?.value, disp: document.getElementById('popt-dispmode')?.value,
  active: activePT, activeType: plotTabs.find(t => t.id === activePT)?.ptype, btn: document.getElementById('plot-main-btn').textContent }));

test('bar settings survive a detour to another plot type', async () => {
  await selectTest(app.page, 'ttest_ind');
  await ev(async () => { loadExampleFor('stat'); await new Promise(r => setTimeout(r, 80)); runAnalysis(); await new Promise(r => setTimeout(r, 1200)); });
  const barTab = (await state()).active;
  await setOpt('popt-ylab', 'Expression (a.u.)'); await setOpt('popt-dispmode', 'reps');
  await ev(async () => { plotMainClick(); await new Promise(r => setTimeout(r, 300)); }); // ↻ Update the bar chart
  await pickPlot('boxplot');
  let s = await state();
  assert.strictEqual(s.ylab, '', 'a new plot type starts from its defaults');
  await ev(async () => { plotMainClick(); await new Promise(r => setTimeout(r, 300)); }); // draw the box plot
  assert.strictEqual((await state()).activeType, 'boxplot');
  await pickPlot('bar_sd'); await pause(150);
  s = await state();
  assert.strictEqual(s.active, barTab, 'the same bar chart is shown again');
  assert.strictEqual(s.ylab, 'Expression (a.u.)'); assert.strictEqual(s.disp, 'reps');
  assert.match(s.btn, /Update/);
});

test('settings changed but not yet drawn are remembered too', async () => {
  await pickPlot('violin');
  await setOpt('popt-ylab', 'Violin label');
  await pickPlot('bar_sd'); await pause(150);
  await pickPlot('violin'); await pause(150);
  assert.strictEqual((await state()).ylab, 'Violin label');
});

test('a new test run starts its figures from the defaults', async () => {
  await selectTest(app.page, 'ttest_ind');
  await ev(async () => { runAnalysis(); await new Promise(r => setTimeout(r, 1200)); });
  const s0 = await state();
  assert.strictEqual(s0.psel, 'bar_sd'); assert.strictEqual(s0.ylab, '');
  await pickPlot('violin'); await pause(150);
  assert.strictEqual((await state()).ylab, '', "the earlier result's violin settings stay with that result");
  assert.deepStrictEqual(app.errors, []);
});

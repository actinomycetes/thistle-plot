// Stacked bar chart: values as entered, or each bar as a fraction / percentage of its total.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openApp, selectPlot } = require('./helpers');

let app;
before(async () => { app = await openApp({ consoleErrors: true }); });
after(async () => { await app.close(); });
const ev = (fn, arg) => app.page.evaluate(fn, arg);
const quadrants = { nReps: 1, nRows: 3, rowNames: ['A01.fcs', 'A02.fcs', 'A03.fcs'], groups: [
  ['Lymphocytes/Singlets/Q1 GFP- RFP+ | % Parent', [0.04, 48.4, 2]], ['Lymphocytes/Singlets/Q2 GFP+ RFP+ | % Parent', [0, 44.1, 3]],
  ['Lymphocytes/Singlets/Q3 GFP+ RFP- | % Parent', [0.03, 1.0, '']], ['Lymphocytes/Singlets/Q4 GFP- RFP- | % Parent', [99.93, 6.5, 5]]]
  .map(([name, v]) => ({ name, reps: ['Rep1'], data: v.map(x => [x]) })) };

test('percentage and fraction modes make every bar add up to 100 or 1', async () => {
  const r = await ev(G2 => { applyG(G2);
    const pc = stackedData('rows', 'percent'), fr = stackedData('rows', 'fraction'), raw = stackedData('rows', 'raw');
    const sums = d => d.barNames.map((_, b) => d.vals.reduce((s, row) => s + row[b], 0));
    return { pc: sums(pc), fr: sums(fr), raw: sums(raw), note: pc.note, a03q1: pc.vals[0][2], bars: pc.barNames };
  }, quadrants);
  r.pc.forEach(s => assert.ok(Math.abs(s - 100) < 1e-9, 'percent ' + s));
  r.fr.forEach(s => assert.ok(Math.abs(s - 1) < 1e-12, 'fraction ' + s));
  assert.ok(Math.abs(r.raw[1] - 100) < 0.01, 'values as entered are only stacked');
  assert.ok(Math.abs(r.a03q1 - 20) < 1e-9, 'A03: 2 of a total of 10 = 20%');
  assert.match(r.note, /1 blank cell\(s\) count as 0/);
  assert.deepStrictEqual(r.bars, ['A01.fcs', 'A02.fcs', 'A03.fcs']);
});

test('one bar per group; negative values refuse fractions; legend names are shortened', async () => {
  const r = await ev(G2 => { applyG(G2);
    const byGroup = stackedData('groups', 'percent');
    const neg = JSON.parse(JSON.stringify(G2)); neg.groups[0].data[0][0] = -1; applyG(neg);
    return { bars: byGroup.barNames.length, segs: byGroup.segNames, err: stackedData('rows', 'percent').error, rawOk: !stackedData('rows', 'raw').error,
      short: _shortNames(G2.groups.map(g => g.name)), keep: _shortNames(['A', 'A']) };
  }, quadrants);
  assert.strictEqual(r.bars, 4); assert.deepStrictEqual(r.segs, ['A01.fcs', 'A02.fcs', 'A03.fcs']);
  assert.match(r.err, /≥ 0/); assert.ok(r.rawOk);
  assert.deepStrictEqual(r.short, ['Q1 GFP- RFP+', 'Q2 GFP+ RFP+', 'Q3 GFP+ RFP-', 'Q4 GFP- RFP-']);
  assert.deepStrictEqual(r.keep, ['A', 'A'], 'names are not shortened when that would make them clash');
});

test('the stacked bar plot draws on screen and in both export styles, with its example data', async () => {
  await selectPlot(app.page, 'stacked');
  const r = await ev(async () => {
    loadExampleFor('plot'); await new Promise(r => setTimeout(r, 80));
    document.getElementById('popt-stscale').value = 'percent'; newPlot(); await new Promise(r => setTimeout(r, 500));
    const ch = Object.values(Chart.instances).pop();
    const ex = ['app', 'publication'].map(m => _renderExport(activePT, m).width);
    return { n: ch.data.datasets.length, stacked: ch.options.scales.y.stacked, max: ch.options.scales.y.max, ex, rows: G.nRows };
  });
  assert.strictEqual(r.n, 4); assert.strictEqual(r.stacked, true); assert.strictEqual(r.max, 100);
  assert.ok(r.ex.every(w => w > 0)); assert.strictEqual(r.rows, 5);
  assert.deepStrictEqual(app.errors, []);
});

// ⬆ Open CSV… through the real file input. The documented fallback for Thistle Flow (Export CSV → Open CSV) must keep
// sample names that start with digits (001_control.fcs) and IDs with leading zeros (003) as row names (TP v0.17.3).
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openApp } = require('./helpers');

let app;
before(async () => { app = await openApp({ consoleErrors: true }); });
after(async () => { await app.close(); });

async function openCSV(name, csv) {
  await app.page.evaluate(() => clearData());
  await app.page.setInputFiles('#fi-csv', { name, mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await app.page.waitForFunction(() => /Imported/.test(document.getElementById('data-note').textContent));
  return app.page.evaluate(() => ({ rows: G.rowNames, groups: G.groups.map(g => g.name), data: G.groups.map(g => g.data.map(r => r[0])) }));
}

test('a Thistle Flow CSV keeps sample names that start with digits', async () => {
  const r = await openCSV('flow.csv', '﻿Sample,CD4+ | %Parent,CD8+ | Count\n001_control.fcs,62.5,4100\n002_treated.fcs,58.1,\n003,55,3600\n');
  assert.deepStrictEqual(r.rows, ['001_control.fcs', '002_treated.fcs', '003']);
  assert.deepStrictEqual(r.groups, ['CD4+ | %Parent', 'CD8+ | Count']);
  assert.deepStrictEqual(r.data, [[62.5, 58.1, 55], [4100, '', 3600]], 'values numeric, blank stays blank');
});

test('names that start with digits are names even without a Sample header', async () => {
  const r = await openCSV('ids.csv', 'Well,A,B\n1A_ctrl,1,2\n2B_ko,3,4\n');
  assert.deepStrictEqual(r.rows, ['1A_ctrl', '2B_ko']);
  assert.deepStrictEqual(r.groups, ['A', 'B']);
});

test('numeric first columns stay data (unchanged)', async () => {
  let r = await openCSV('dose.csv', 'Dose,Response\n1,2.5\n10,3.5\n');
  assert.deepStrictEqual(r.groups, ['Dose', 'Response']);
  assert.deepStrictEqual(r.data[0], [1, 10]);
  assert.deepStrictEqual(r.rows, ['Row 1', 'Row 2']);
  r = await openCSV('plain.csv', '1,2\n3,4\n');
  assert.deepStrictEqual(r.groups, ['Group1', 'Group2']);
  assert.deepStrictEqual(r.data, [[1, 3], [2, 4]]);
  r = await openCSV('genes.csv', 'Gene,WT,KO\nTP53,1.5,2\nMYC,3,4.25\n');
  assert.deepStrictEqual(r.rows, ['TP53', 'MYC']);
  assert.deepStrictEqual(r.data, [[1.5, 3], [2, 4.25]]);
});

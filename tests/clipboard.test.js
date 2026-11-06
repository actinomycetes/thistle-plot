// Data grid: drag-select a block of cells, then copy / cut / paste it (Excel-style TSV).
// Copy and cut must work without navigator.clipboard (blocked in iFrames such as the Confluence
// embed, and on non-secure pages), so they go through the standard copy/cut events.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openApp } = require('./helpers');

let app;
before(async () => { app = await openApp(); });
after(async () => { await app.close(); });

const cellSel = (g, row, r) => `#dtbl input[data-g="${g}"][data-row="${row}"][data-r="${r}"]`;

async function dragSelect(page, from, to) {
  const a = await page.locator(cellSel(...from)).boundingBox(), b = await page.locator(cellSel(...to)).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}
// Fire a clipboard event on the focused cell, as the browser does for Ctrl/Cmd+C / X / V or the right-click menu
const clip = (page, type, text = '') => page.evaluate(([type, text]) => {
  const dt = new DataTransfer(); if (text) dt.setData('text/plain', text);
  const ev = new ClipboardEvent(type, { clipboardData: dt, bubbles: true, cancelable: true });
  document.activeElement.dispatchEvent(ev);
  return { data: dt.getData('text/plain'), prevented: ev.defaultPrevented };
}, [type, text]);

test('drag-select then copy puts the block on the clipboard as TSV', async () => {
  const { page } = app;
  await page.evaluate(() => { loadExample(); navigator.clipboard && Object.defineProperty(navigator, 'clipboard', { value: undefined }); });
  await page.waitForTimeout(150);
  await dragSelect(page, [0, 0, 0], [0, 1, 2]); // Control Rep1..Rep3, rows 1-2
  const n = await page.evaluate(() => document.querySelectorAll('#dtbl input.sel-cell').length);
  assert.strictEqual(n, 6);
  const expected = await page.evaluate(() => [0, 1].map(row => G.groups[0].data[row].join('\t')).join('\n'));
  const r = await clip(page, 'copy');
  assert.ok(r.prevented, 'TP should handle the copy');
  assert.strictEqual(r.data, expected);
  // Ctrl/Cmd+C must not be cancelled on keydown, or the browser never fires the copy event
  const kd = await page.evaluate(() => { const e = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true }); document.activeElement.dispatchEvent(e); return e.defaultPrevented; });
  assert.strictEqual(kd, false);
  assert.deepStrictEqual(app.errors, []);
});

test('cut copies the block and clears it (undoable)', async () => {
  const { page } = app;
  await page.evaluate(() => loadExample()); await page.waitForTimeout(150);
  await dragSelect(page, [0, 2, 2], [0, 3, 0]); // dragged right-to-left and down
  const before = await page.evaluate(() => [2, 3].map(row => G.groups[0].data[row].join('\t')).join('\n'));
  const r = await clip(page, 'cut');
  assert.strictEqual(r.data, before);
  const after = await page.evaluate(() => [2, 3].map(row => G.groups[0].data[row].join('')).join('|'));
  assert.strictEqual(after, '|');
  const undone = await page.evaluate(() => { undoAction(); return [2, 3].map(row => G.groups[0].data[row].join('\t')).join('\n'); });
  assert.strictEqual(undone, before);
  assert.deepStrictEqual(app.errors, []);
});

test('paste fills from the top-left of the selection; copying text inside one cell stays native', async () => {
  const { page } = app;
  await page.evaluate(() => loadExample()); await page.waitForTimeout(150);
  await dragSelect(page, [0, 3, 2], [0, 2, 1]); // focus stays in the bottom-right cell where the drag began
  await clip(page, 'paste', '7\t8\n9\t10\n');
  const got = await page.evaluate(() => [G.groups[0].data[2].slice(1), G.groups[0].data[3].slice(1)]);
  assert.deepStrictEqual(got, [[7, 8], [9, 10]]);
  // Single cell with some of its text selected: leave the browser's own copy alone
  await page.locator(cellSel(0, 0, 0)).click();
  await page.evaluate(() => { const el = document.activeElement; el.setSelectionRange(0, 1); });
  const r = await clip(page, 'copy');
  assert.strictEqual(r.prevented, false);
  assert.deepStrictEqual(app.errors, []);
});

test('pasting one value into a selected block fills it', async () => {
  const { page } = app;
  await page.evaluate(() => loadExample()); await page.waitForTimeout(150);
  await dragSelect(page, [0, 0, 1], [0, 1, 2]);
  await clip(page, 'paste', '5\r\n');
  const got = await page.evaluate(() => [G.groups[0].data[0], G.groups[0].data[1]]);
  assert.deepStrictEqual(got.map(r => r.slice(1)), [[5, 5], [5, 5]]);
  assert.notStrictEqual(got[0][0], 5, 'cells outside the block are untouched');
  assert.deepStrictEqual(app.errors, []);
});

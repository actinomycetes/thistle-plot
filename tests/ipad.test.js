// Safari on iPad (WebKit with an iPad screen, touch and user agent). Run the whole suite this way with TP_DEVICE=ipad.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openApp, selectTest } = require('./helpers');

let app;
before(async () => { process.env.TP_DEVICE = process.env.TP_DEVICE || 'ipad'; app = await openApp({ consoleErrors: true }); delete process.env.TP_DEVICE; });
after(async () => { await app.close(); });

test('detected as iOS; the project picker accepts any file (iOS cannot filter .thistle)', async () => {
  const r = await app.page.evaluate(() => ({ ios: IS_IOS, accept: document.getElementById('fi-load').getAttribute('accept'), csv: document.getElementById('fi-csv').accept }));
  assert.strictEqual(r.ios, true);
  assert.strictEqual(r.accept, null);
  assert.match(r.csv, /text\/csv/);
});

test('drop-down menus are drawn by TP, not as native white Safari menus', async () => {
  const r = await app.page.evaluate(() => { const s = getComputedStyle(document.getElementById('asel')); return { ap: s.webkitAppearance || s.appearance, bg: s.backgroundColor }; });
  assert.strictEqual(r.ap, 'none');
  assert.notStrictEqual(r.bg, 'rgb(255, 255, 255)');
});

test('layout fits an upright iPad without sideways scrolling', async () => {
  await app.page.setViewportSize({ width: 834, height: 1194 });
  await selectTest(app.page, 'anova');
  const w = await app.page.evaluate(async () => { loadExampleFor('stat'); await new Promise(r => setTimeout(r, 80)); runAnalysis(); await new Promise(r => setTimeout(r, 1200));
    const ex = document.getElementById('theme-btn').getBoundingClientRect();
    return { sw: document.documentElement.scrollWidth, iw: innerWidth, exRight: ex.right }; });
  assert.ok(w.sw <= w.iw, JSON.stringify(w));
  assert.ok(w.exRight <= w.iw, 'Export menu visible ' + JSON.stringify(w));
  await app.page.setViewportSize({ width: 1194, height: 834 });
});

test('keyboard: Cmd+/ opens Help, Cmd+Shift+Z redoes', async () => {
  await app.page.keyboard.press('Meta+/');
  assert.ok(await app.page.evaluate(() => document.getElementById('help-ov').classList.contains('open')));
  await app.page.keyboard.press('Escape');
  const r = await app.page.evaluate(() => { let n = 0; const o = redoAction; redoAction = () => { n++; }; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', metaKey: true, shiftKey: true })); redoAction = o; return n; });
  assert.strictEqual(r, 1);
  assert.deepStrictEqual(app.errors, []);
});

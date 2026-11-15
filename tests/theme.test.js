// Readability in both themes: text contrast (WCAG AA) and no dark-mode colours left in light mode.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openApp } = require('./helpers');

// Readability check run inside the page: every visible text against its real (composited) background must meet
// WCAG AA (4.5:1, or 3:1 for large text), and in light mode no box may keep a dark grey/navy background (a dark-mode
// colour left hard-coded). `allow` lists CSS selectors that are dark on purpose (e.g. the BETA badge).
function themeAudit(allow) {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const blend = (t, b) => [0, 1, 2].map(i => t[i] * t[3] + b[i] * (1 - t[3])).concat(1);
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const shown = el => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; } const r = el.getBoundingClientRect(); return r.width >= 1 && r.height >= 1; };
  const bgOf = el => { const st = []; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== 'none') return null; const c = parse(s.backgroundColor); if (c && c[3] > 0) { st.push(c); if (c[3] >= 1) break; } } let bg = [255, 255, 255, 1]; for (let i = st.length - 1; i >= 0; i--) bg = blend(st[i], bg); return bg; };
  const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].join('.') : '');
  const ok = el => allow.some(s => el.closest(s));
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  const low = new Set(), dark = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const el = n.parentElement, t = n.textContent.trim();
    if (!t || !el || ['SCRIPT', 'STYLE', 'OPTION'].includes(el.tagName) || ok(el) || !shown(el)) continue;
    const cs = getComputedStyle(el), fg = parse(cs.color), bg = bgOf(el); if (!fg || !bg) continue;
    const size = parseFloat(cs.fontSize), big = size >= 24 || (+cs.fontWeight >= 700 && size >= 18.66);
    const r = ratio(blend(fg, bg), bg); if (r < (big ? 3 : 4.5)) low.add(`${name(el)} "${t.slice(0, 30)}" ${r.toFixed(2)}:1`);
  }
  if (light) for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') || ['CANVAS', 'IMG'].includes(el.tagName) || ok(el) || !shown(el)) continue;
    const c = parse(getComputedStyle(el).backgroundColor); if (!c || c[3] < 0.5) continue;
    if (lum(c) < 0.25 && Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) < 120) dark.add(`${name(el)} ${getComputedStyle(el).backgroundColor}`);
  }
  return { low: [...low], dark: [...dark] };
}

// Dark on purpose in both themes: the BETA badge, the coloured action buttons (white text), the Help backdrop.
const ALLOW = ['.badge.beta', '.btn-pri', '#plot-main-btn'];

let app;
before(async () => { app = await openApp(); });
after(async () => { await app.close(); });

async function check(label) {
  const r = await app.page.evaluate(`(${themeAudit})(${JSON.stringify(ALLOW)})`);
  // the Help backdrop (#help-ov) is a dimmed overlay, not a text box
  r.dark = r.dark.filter(x => !x.startsWith('div#help-ov'));
  assert.deepStrictEqual(r.low, [], label + ': text below WCAG AA contrast');
  assert.deepStrictEqual(r.dark, [], label + ': dark background left in light mode');
}

for (const theme of ['dark', 'light']) {
  test(`readable in ${theme} mode: start, every test's hint, a result and Help`, async () => {
    const p = app.page;
    await p.evaluate(t => { if ((document.documentElement.getAttribute('data-theme') === 'light') !== (t === 'light')) toggleTheme(); }, theme);
    await p.waitForTimeout(500); // let colour transitions finish
    await check(theme + ' start');
    const types = await p.evaluate(() => [...document.getElementById('asel').options].map(o => o.value).filter(Boolean));
    for (const v of types) {
      await p.evaluate(async v => { const a = document.getElementById('asel'); a.value = v; a.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 20)); }, v);
      await check(theme + ' ' + v);
    }
    await p.evaluate(async () => { const a = document.getElementById('asel'); a.value = 'anova'; a.dispatchEvent(new Event('change')); loadExampleFor('stat'); await new Promise(r => setTimeout(r, 100)); runAnalysis(); await new Promise(r => setTimeout(r, 800)); });
    await check(theme + ' ANOVA result');
    await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /Help/.test(b.textContent)).click());
    await p.waitForTimeout(200);
    await check(theme + ' Help');
    await p.keyboard.press('Escape');
  });
}

test('group colours are the Okabe–Ito colour-blind-safe palette (no red next to green)', async () => {
  const c = await app.page.evaluate(() => COLORS.slice(0, 6));
  assert.deepStrictEqual(c, ['#0072b2', '#e69f00', '#009e73', '#cc79a7', '#56b4e9', '#d55e00']);
});

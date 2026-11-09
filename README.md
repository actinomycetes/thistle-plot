# Thistle Plot (TP) — beta

Free, single-file web app for bench statistics and publication-style figures. Runs entirely in the browser; your data never leaves your computer.
**Use it online:** <https://actinomycetes.github.io/thistle-plot/> (hosted on GitHub Pages, always the latest release).
Or download `index.html` and open it in your browser. Press **F1** inside the app for the manuals.

**Status:** beta (0.x). Check important results against an established package before publishing.

## For developers
See `CLAUDE.md` for architecture, rules and the release checklist.

```bash
npm install && npx playwright install chromium
pip install markdown
npm test
```

Layout: `index.html` (the app) · `docs/` (manual sources) · `tools/build_help.py` (builds Help into `index.html`) ·
`tests/` (Playwright tests) · `.github/workflows/ci.yml` (runs everything on each push).

## Citing
See [`CITATION.cff`](CITATION.cff), or use GitHub's "Cite this repository" button.

## Licence
[MIT](LICENSE) © 2026 Takanobu Tagawa (The University of Edinburgh).
Bundled at runtime from cdnjs (each under its own MIT licence): Chart.js, jStat, PapaParse.

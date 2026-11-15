// Prints release notes (Markdown) for a version from the version history table in docs/help_hist.md.
// Usage: node tools/release-notes.mjs 0.13.4 [path/to/help_hist.md]
import { readFileSync } from 'node:fs';

const [version, histPath = new URL('../docs/help_hist.md', import.meta.url)] = process.argv.slice(2);
if (!version) { console.error('usage: node tools/release-notes.mjs <version> [help_hist.md]'); process.exit(1); }
const md = readFileSync(histPath, 'utf8');
const esc = version.replace(/\./g, '\\.');
const row = new RegExp(`^\\|\\s*${esc} \\(([^)]*)\\)\\s*\\|[^|]*\\|(.*)\\|\\s*$`, 'm').exec(md);
const lines = [];
if (row) {
  lines.push(`Released ${row[1]}.`, '');
  for (const item of row[2].trim().split(/;\s+/)) lines.push(`- ${item.charAt(0).toUpperCase()}${item.slice(1)}`);
} else lines.push(`Thistle Plot ${version}.`);
lines.push('', '**Beta software:** check important results against an established package before publishing.', '',
  'Download `thistle-plot.html` below and open it in a browser (no installation), or use the hosted app: https://actinomycetes.github.io/thistle-plot/');
console.log(lines.join('\n'));

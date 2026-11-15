// The release workflow (.github/workflows/release.yml) reads APP_VERSION from index.html and the release notes
// from the newest row of docs/help_hist.md; check both are in the shape it expects.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

test('release notes come from the help_hist.md row of the current version', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const v = /^const APP_VERSION='(\d+\.\d+\.\d+)';/m.exec(html)?.[1];
  assert.ok(v, 'index.html has a line "const APP_VERSION=\'x.y.z\';" (the workflow reads it)');
  const notes = execFileSync(process.execPath, [path.join(ROOT, 'tools/release-notes.mjs'), v], { encoding: 'utf8' });
  assert.match(notes, /^Released \d{1,2} \w{3} \d{4}\.\n\n- /, 'dated notes with bullet points');
  assert.match(notes, /Beta software/);
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/release.yml'), 'utf8');
  assert.match(wf, /workflows: \[CI\]/, 'runs after CI');
  assert.match(wf, /APP_VERSION/);
});

#!/usr/bin/env bash
# Cross-check Thistle Plot's statistics against SciPy and statsmodels on the same data (tools/validate/cases.json
# plus a few generated sets). Prints OK or CHECK for every quantity.
#
# Usage (from the repository folder, after `npm install`):
#   bash tools/validate/run.sh
#
# Needs Node 18+ and Python 3.9+. The first run installs numpy, scipy, pandas and statsmodels into
# tools/validate/.work/venv (internet needed once). Nothing is uploaded; the check runs on your computer.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
W="$HERE/.work"; mkdir -p "$W"
PY=""
for c in python3 python py; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' >/dev/null 2>&1; then PY="$c"; break; fi
done
[ -n "$PY" ] || { echo "Python 3.9 or newer is needed (https://www.python.org/downloads/)"; exit 1; }
command -v node >/dev/null || { echo "Node.js is needed (https://nodejs.org/)"; exit 1; }
if [ ! -d "$W/venv" ]; then echo "Setting up Python packages (first run only)…"; "$PY" -m venv "$W/venv"; fi
VPY="$W/venv/bin/python"; [ -x "$VPY" ] || VPY="$W/venv/Scripts/python.exe"   # Windows (Git Bash)
"$VPY" -m pip -q install --disable-pip-version-check numpy scipy pandas statsmodels
node "$HERE/dump_tp.js" > "$W/tp.json"
"$VPY" -I "$HERE/compare.py" < "$W/tp.json"

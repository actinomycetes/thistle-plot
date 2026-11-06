#!/usr/bin/env python3
"""Rebuild the in-app Help panes (Quick, Full, Version history) from docs/*.md.

Usage:  python3 tools/build_help.py [--check]
  --check  only report whether index.html is up to date (used by CI); exit 1 if not.

Requires:  pip install markdown
The panes in index.html are delimited by <!--HELP:hq--> ... <!--/HELP:hq--> markers
(hq = docs/help_quick.md, hf = docs/help_full.md, hv = docs/help_hist.md).
Edit the .md files, never the generated HTML between the markers.
"""
import re, sys, pathlib
import markdown

ROOT = pathlib.Path(__file__).resolve().parent.parent
PANES = {"hq": "help_quick.md", "hf": "help_full.md", "hv": "help_hist.md"}
HEADINGS = {"hq": "", "hf": "<h2>Full Manual</h2>", "hv": "<h2>Version History</h2>"}  # hq's md carries its own headings

def render(md_text):
    return markdown.markdown(md_text, extensions=["tables"])

def main():
    check = "--check" in sys.argv
    path = ROOT / "index.html"
    html = path.read_text(encoding="utf8")
    new = html
    for pid, fname in PANES.items():
        body = HEADINGS[pid] + render((ROOT / "docs" / fname).read_text(encoding="utf8"))
        pat = re.compile(r"(<!--HELP:%s-->)(.*?)(<!--/HELP:%s-->)" % (pid, pid), re.S)
        if not pat.search(new):
            sys.exit(f"marker for {pid} not found in index.html")
        new = pat.sub(lambda m: m.group(1) + body + m.group(3), new, count=1)
    if check:
        if new != html:
            print("Help panes are out of date: run  python3 tools/build_help.py")
            sys.exit(1)
        print("Help panes are up to date.")
        return
    if new != html:
        path.write_text(new, encoding="utf8")
        print("index.html: Help panes rebuilt.")
    else:
        print("index.html: Help panes already up to date.")

if __name__ == "__main__":
    main()

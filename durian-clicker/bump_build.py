#!/usr/bin/env python3
"""bump_build.py — run this before every deploy.

Sets one build id in three places that must agree:

  1. CONFIG.buildId in js/config.js   — what the running page believes it is
  2. version.json                     — what the server advertises
  3. ?v=... on every <script> and <link> in index.html

Point 3 is the one that actually fixes stale caches. GitHub Pages sends
JS and CSS with a long cache lifetime, so an ordinary refresh can keep
running yesterday's code even after a deploy — which is why players were
being told to press Ctrl+Shift+R. Changing the query string changes the URL,
so the browser has no choice but to fetch the new file. index.html itself is
sent with a short cache lifetime, so it comes through quickly on its own.

A forced reload is opt-in per deploy. Pass --force when everyone needs to be
on the new code immediately (a save-format change, a broken build); leave it
off for routine content, which just shows the banner.

Usage:
    python3 bump_build.py                          # banner only
    python3 bump_build.py --force                  # pull everyone across
    python3 bump_build.py 2026-09-01-hotfix "notes" --force
"""
import datetime
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as handle:
        return handle.read()


def write(path, text):
    with open(os.path.join(ROOT, path), 'w', encoding='utf-8') as handle:
        handle.write(text)


def current_build():
    match = re.search(r"buildId:\s*'([^']+)'", read('js/config.js'))
    return match.group(1) if match else ''


def next_build():
    today = datetime.date.today().isoformat()
    existing = current_build()
    if existing.startswith(today):
        tail = existing[len(today):].lstrip('-')
        counter = int(tail) + 1 if tail.isdigit() else 2
        return '%s-%d' % (today, counter)
    return today


def main():
    args = [a for a in sys.argv[1:] if a != '--force']
    force = '--force' in sys.argv

    build = args[0] if len(args) > 0 else next_build()
    notes = args[1] if len(args) > 1 else 'Content and fixes.'

    # 1. config
    config = read('js/config.js')
    config, n = re.subn(r"(buildId:\s*')[^']+(')", r'\g<1>%s\g<2>' % build, config, count=1)
    if not n:
        sys.exit('Could not find buildId in js/config.js')
    write('js/config.js', config)

    # 2. version.json
    write('version.json',
          '{\n  "build": "%s",\n  "notes": "%s",\n  "force": %s\n}\n'
          % (build, notes, 'true' if force else 'false'))

    # 3. cache-busting query on every local script and stylesheet
    html = read('index.html')

    def stamp(match):
        attr, url = match.group(1), match.group(2)
        if url.startswith('http') or url.startswith('//'):
            return match.group(0)          # leave CDNs and fonts alone
        clean = url.split('?')[0]
        return '%s="%s?v=%s"' % (attr, clean, build)

    html, script_count = re.subn(r'(src)="(js/[^"]+)"', stamp, html)
    html, css_count = re.subn(r'(href)="(css/[^"]+)"', stamp, html)
    write('index.html', html)

    print('build id : %s' % build)
    print('reload   : %s' % ('FORCED - everyone is pulled across'
                             if force else 'banner only, players refresh when ready'))
    print('stamped  : %d scripts, %d stylesheets' % (script_count, css_count))
    print('files    : js/config.js, version.json, index.html')
    print('\nCommit and push all three, plus whatever you changed.')


if __name__ == '__main__':
    main()

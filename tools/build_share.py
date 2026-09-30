#!/usr/bin/env python3
"""Build the standalone share files in share/: one self-contained .html per viewer, with the
JavaScript bundled, three.js inlined and every texture embedded, so the file opens offline by
double-clicking it. Needs esbuild (npx esbuild, or ESBUILD=/path/to/esbuild).

    python3 tools/build_share.py
"""
import base64, os, pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ESBUILD = os.environ.get('ESBUILD') or 'esbuild'
VIEWERS = [
    ('index.html', 'js/app.js', 'Goldie_Street_Build_Sequence.html'),
    ('fitout.html', 'js/fitout-app.js', 'Goldie_Street_House_Fitout.html'),
    ('walkthrough.html', 'js/walk-app.js', 'Goldie_Street_Walkthrough.html'),
]

def textures_script():
    tex = {}
    for f in sorted((ROOT / 'textures').glob('*.jpg')):
        tex[f.stem] = 'data:image/jpeg;base64,' + base64.b64encode(f.read_bytes()).decode()
    body = ','.join(f'"{k}":"{v}"' for k, v in tex.items())
    return f'<script>window.__GS_TEX={{{body}}};</script>'

def bundle(entry):
    out = subprocess.run([ESBUILD, str(ROOT / entry), '--bundle', '--format=iife', '--minify',
                          '--log-level=error', f'--alias:three={ROOT / "vendor/three.module.min.js"}'],
                         capture_output=True, text=True, cwd=ROOT)
    if out.returncode:
        sys.exit(out.stderr)
    return out.stdout.replace('</script', '<\\/script')

def main():
    tex = textures_script()
    (ROOT / 'share').mkdir(exist_ok=True)
    for page, entry, name in VIEWERS:
        html = (ROOT / page).read_text()
        html = re.sub(r'<script type="importmap">.*?</script>\n?', '', html, flags=re.S)
        js = bundle(entry)
        html = re.sub(r'<script type="module" src="[^"]+"></script>', lambda m: tex + '\n<script>' + js + '</script>', html)
        # links between viewers point at the sibling share files
        for p2, _, n2 in VIEWERS:
            html = html.replace(f'href="./{p2}"', f'href="./{n2}"')
        (ROOT / 'share' / name).write_text(html)
        print(f'{name}: {len(html) / 1e6:.1f} MB')

if __name__ == '__main__':
    main()

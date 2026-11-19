#!/usr/bin/env python3
"""
Step 2 of the hair pipeline: measures six landmarks on each head shape in
assets/heads/ and writes them to assets/landmarks.json, plus a visual check
page, scripts/debug_landmarks.html.

    python3 scripts/extract_landmarks.py

Standard library only. Coordinates are in the heads' own 512x512 viewBox
(the shared portrait frame), y pointing down.

How it measures. Each head is drawn as a dark outline silhouette (head, ears,
neck and shoulders) with the skin on top of it. The script flattens every
path in the head into polylines and scans it row by row (every 0.5 units),
keeping each row's outermost left and right edge: the visible outline of
the head. From those rows:

  crown_top      the first row of the silhouette, at the middle of that row.
  chin           where the jaw meets the neck (the narrowest row below the
                 ears, less 4, as the game's own head measurements do); used
                 only to scale the points below, not written out.
  forehead_mid   the centre line, FOREHEAD of the way from crown to chin.
  temple_*       the outer edges at brow height, BROW of the way from crown to
                 chin (the brow line on the template face every part is
                 fitted to), kept above the ears.
  ear_*          the outer edges of the head where the ears attach: the row
                 just above where the silhouette suddenly widens into the ears.

When it is done it runs scripts/select_base_head.py, which picks the base
head from these numbers and rewrites assets/CHATGPT_HAIR_PROMPT.md.
"""
import json, os, re, sys
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEADS = os.path.join(ROOT, 'assets', 'heads')
OUT_JSON = os.path.join(ROOT, 'assets', 'landmarks.json')
OUT_HTML = os.path.join(ROOT, 'scripts', 'debug_landmarks.html')

NAMES = ['pixie', 'sculpted', 'athletic', 'almond', 'cherubic', 'angular', 'dimple_oval', 'long_rectangle']
POINTS = ['crown_top', 'forehead_mid', 'temple_left', 'temple_right', 'ear_left', 'ear_right']
FOREHEAD = 0.22  # hairline: 20-25% of the way from the crown to the chin
BROW = 0.37      # template face: brows at y=254 between top 154 and chin 424
STEP = 0.5       # scan-row spacing
SVG_NS = '{http://www.w3.org/2000/svg}'

# ---------- Reading the outline ----------

TOKEN = re.compile(r'[MmLlHhVvQqTtCcSsZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?')


def flatten(d, steps=8):
    """An SVG path's d -> closed polylines [[(x, y), ...], ...]. Lines and curves, absolute or relative; no arcs."""
    toks, i = TOKEN.findall(d), 0
    polys, cur, pos, start, cmd, last_ctrl = [], [], (0.0, 0.0), (0.0, 0.0), None, None

    def nums(n):
        nonlocal i
        vals = [float(t) for t in toks[i:i + n]]
        i += n
        return vals

    def bez(pts):  # quadratic or cubic Bezier from pos through pts
        p = [pos] + pts
        for k in range(1, steps + 1):
            t = k / steps
            q = p
            while len(q) > 1:
                q = [((1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1]) for a, b in zip(q, q[1:])]
            cur.append(q[0])

    while i < len(toks):
        if toks[i].isalpha():
            cmd = toks[i]
            i += 1
            if cmd in 'Zz':
                if cur:
                    polys.append(cur)
                cur, pos = [], start
                continue
        elif cmd is None:
            raise ValueError('path data starts without a command')
        rel = cmd.islower()
        c = cmd.upper()
        ox, oy = pos if rel else (0.0, 0.0)
        if c == 'M':
            if cur:
                polys.append(cur)
            x, y = nums(2)
            pos = start = (ox + x, oy + y)
            cur = [pos]
            cmd = 'l' if rel else 'L'  # further pairs are lines
        elif c == 'L':
            x, y = nums(2)
            pos = (ox + x, oy + y)
            cur.append(pos)
        elif c == 'H':
            pos = ((ox if rel else 0) + nums(1)[0], pos[1])
            cur.append(pos)
        elif c == 'V':
            pos = (pos[0], (oy if rel else 0) + nums(1)[0])
            cur.append(pos)
        elif c in 'QT':
            if c == 'Q':
                x1, y1, x, y = nums(4)
                ctrl = (ox + x1, oy + y1)
            else:
                x, y = nums(2)
                ctrl = (2 * pos[0] - last_ctrl[0], 2 * pos[1] - last_ctrl[1]) if last_ctrl else pos
            end = (ox + x, oy + y)
            bez([ctrl, end])
            pos, last_ctrl = end, ctrl
            continue
        elif c in 'CS':
            if c == 'C':
                x1, y1, x2, y2, x, y = nums(6)
                c1 = (ox + x1, oy + y1)
            else:
                x2, y2, x, y = nums(4)
                c1 = (2 * pos[0] - last_ctrl[0], 2 * pos[1] - last_ctrl[1]) if last_ctrl else pos
            c2, end = (ox + x2, oy + y2), (ox + x, oy + y)
            bez([c1, c2, end])
            pos, last_ctrl = end, c2
            continue
        else:
            raise ValueError(f'unsupported path command {cmd!r}')
        last_ctrl = None
    if cur:
        polys.append(cur)
    return polys


def head_polys(path):
    """Every path drawn in the head's art group, flattened."""
    root = ET.parse(path).getroot()
    vb = [float(v) for v in root.get('viewBox', '0 0 512 512').split()]
    if vb != [0, 0, 512, 512]:
        print(f'warning: {os.path.basename(path)} has viewBox {vb}; coordinates are in that space', file=sys.stderr)
    polys = []
    for el in root.iter(f'{SVG_NS}path'):
        if el.get('transform'):
            raise ValueError(f'{os.path.basename(path)}: transformed paths are not supported')
        polys += flatten(el.get('d', ''))
    return polys


def scan(polys):
    """{row y: (leftmost x, rightmost x)} of the silhouette, every STEP units."""
    edges = [(a, b) for poly in polys for a, b in zip(poly, poly[1:] + poly[:1]) if a[1] != b[1]]
    ys = [p[1] for poly in polys for p in poly]
    rows, y = {}, int(min(ys) / STEP) * STEP
    while y <= max(ys):
        yc = y + STEP / 2  # sample between rows, so no vertex lies exactly on the line
        xs = [a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1]) for a, b in edges if min(a[1], b[1]) <= yc < max(a[1], b[1])]
        if xs:
            rows[y] = (min(xs), max(xs))
        y += STEP
    return rows

# ---------- Measuring ----------


def landmarks(rows):
    ys = sorted(rows)
    wid = lambda y: rows[y][1] - rows[y][0]
    near = lambda v: min(ys, key=lambda y: abs(y - v))
    top = ys[0]
    gap = int(6 / STEP)  # compare widths 6 units apart
    # The ears: the first place, well below the crown, where the outline suddenly gets wider.
    ear_top = next((y for k, y in enumerate(ys) if k >= gap and y > top + 60 and wid(y) - wid(ys[k - gap]) > 14), None)
    if ear_top is None:
        raise ValueError('no ears found')
    face_w = max(wid(y) for y in ys if y < ear_top)
    band = [y for y in ys if y >= ear_top and wid(y) > face_w + 8]
    band = [y for y in band if y - band[0] < 80]  # the ears only, not the shoulders
    ear_bottom = band[-1]
    # The chin: where the jaw meets the neck, the narrowest row between the ears and the shoulders.
    neck = min((y for y in ys if ear_bottom + 10 < y < 500), key=wid)
    chin = neck - 4
    span = chin - top
    cx = sum(sum(rows[y]) / 2 for y in ys if top + 16 < y < ear_top) / len([y for y in ys if top + 16 < y < ear_top])
    # Where the ears attach: the head's own edge just above the widening.
    attach = near(ear_top - 2)
    temple = near(min(top + BROW * span, attach - 8))
    r = lambda v: round(v, 1)
    pt = lambda x, y: {'x': r(x), 'y': r(y)}
    crown = rows[top]
    return {
        'crown_top': pt((crown[0] + crown[1]) / 2, top),
        'forehead_mid': pt(cx, top + FOREHEAD * span),
        'temple_left': pt(rows[temple][0], temple),
        'temple_right': pt(rows[temple][1], temple),
        'ear_left': pt(rows[attach][0], attach),
        'ear_right': pt(rows[attach][1], attach),
    }, {'chin': r(chin), 'cx': r(cx), 'ear_bottom': ear_bottom}

# ---------- The check page ----------

COLOURS = {'crown_top': '#ff1744', 'forehead_mid': '#ffd600', 'temple_left': '#00e5ff', 'temple_right': '#00e5ff',
           'ear_left': '#76ff03', 'ear_right': '#76ff03'}
SHORT = {'crown_top': 'crown', 'forehead_mid': 'forehead', 'temple_left': 'temple L', 'temple_right': 'temple R',
         'ear_left': 'ear L', 'ear_right': 'ear R'}


def card(name, path, marks, extra):
    if marks is None:
        return f'<figure class="missing"><div class="hole">no file<br><code>assets/heads/{name}.svg</code></div><figcaption>{name}</figcaption></figure>'
    art = open(path, encoding='utf-8').read()
    inner = re.sub(r'^.*?<svg[^>]*>|</svg>\s*$', '', art, flags=re.S)
    # Ids repeat between the heads on one page; give each head its own.
    inner = re.sub(r'id="([^"]+)"', lambda m: f'id="{name}-{m.group(1)}"', inner)
    guides = (f'<line x1="0" x2="512" y1="{extra["chin"]}" y2="{extra["chin"]}" class="guide"/>'
              f'<line x1="{extra["cx"]}" x2="{extra["cx"]}" y1="0" y2="512" class="guide"/>')
    dots = []
    for key in POINTS:
        x, y = marks[key]['x'], marks[key]['y']
        left = key.endswith('_left')
        tx, anchor = (x - 9, 'end') if left else (x + 9, 'start')
        if key in ('crown_top', 'forehead_mid'):
            tx, anchor = x + 9, 'start'
        ty = y - 7 if key == 'crown_top' else y + 4
        dots.append(f'<circle cx="{x}" cy="{y}" r="4.5" fill="{COLOURS[key]}" class="dot"><title>{key}: ({x}, {y})</title></circle>'
                    f'<text x="{tx}" y="{ty}" text-anchor="{anchor}" class="lbl">{SHORT[key]}</text>')
    rows = ''.join(f'<tr><td><i style="background:{COLOURS[k]}"></i>{k}</td><td>{marks[k]["x"]}</td><td>{marks[k]["y"]}</td></tr>' for k in POINTS)
    return (f'<figure><svg viewBox="0 0 512 512" role="img" aria-label="{name} head with landmarks">'
            f'<rect width="512" height="512" class="bg"/><g style="--skin-color:#e2b48c">{inner}</g>{guides}{"".join(dots)}</svg>'
            f'<figcaption>{name}</figcaption><table><tr><th>point</th><th>x</th><th>y</th></tr>{rows}</table></figure>')


def page(cards):
    legend = ''.join(f'<span><i style="background:{COLOURS[k]}"></i>{k}</span>' for k in ('crown_top', 'forehead_mid', 'temple_left', 'ear_left'))
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Head landmarks check</title>
<style>
  :root {{ --bg: #f4f4f6; --card: #ffffff; --ink: #1d1d22; --muted: #6b6b76; --line: #dcdce2; }}
  @media (prefers-color-scheme: dark) {{ :root {{ --bg: #16161a; --card: #222228; --ink: #ececf1; --muted: #a0a0ab; --line: #3a3a44; }} }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; padding: 20px 16px 40px; background: var(--bg); color: var(--ink); font: 14px/1.4 system-ui, sans-serif; }}
  h1 {{ font-size: 20px; margin: 0 0 4px; }}
  p {{ margin: 0 0 12px; color: var(--muted); max-width: 70ch; }}
  .legend {{ display: flex; flex-wrap: wrap; gap: 6px 16px; margin-bottom: 16px; }}
  .legend span, td:first-child {{ display: inline-flex; align-items: center; gap: 6px; }}
  i {{ display: inline-block; width: 11px; height: 11px; border-radius: 50%; border: 1.5px solid #000; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }}
  figure {{ margin: 0; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 10px; }}
  svg {{ display: block; width: 100%; height: auto; border-radius: 6px; }}
  .bg {{ fill: #c9ced8; }}
  .guide {{ stroke: #ff00e6; stroke-width: 1; stroke-dasharray: 4 4; opacity: .55; }}
  .dot {{ stroke: #000; stroke-width: 1.6; }}
  .lbl {{ font: 700 13px system-ui, sans-serif; fill: #000; paint-order: stroke; stroke: #fff; stroke-width: 3.5px; }}
  figcaption {{ font-weight: 600; margin: 8px 2px 4px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }}
  th, td {{ text-align: left; padding: 2px 4px; border-top: 1px solid var(--line); }}
  th {{ color: var(--muted); font-weight: 500; }}
  .hole {{ aspect-ratio: 1; display: grid; place-content: center; text-align: center; color: var(--muted); border: 2px dashed var(--line); border-radius: 6px; }}
</style>
</head>
<body>
<h1>Head landmarks check</h1>
<p>Generated by <code>scripts/extract_landmarks.py</code> from <code>assets/heads/</code>. Coordinates are in each head's 512&times;512 viewBox.
The dashed lines are the measured centre line and chin, which the forehead and temple heights are scaled from. Hover a dot for its exact value.</p>
<div class="legend">{legend}<span>(left and right share a colour)</span></div>
<div class="grid">
{chr(10).join(cards)}
</div>
</body>
</html>
'''

# ---------- Main ----------


def main():
    out, cards, missing = {}, [], []
    for name in NAMES:
        path = os.path.join(HEADS, f'{name}.svg')
        if not os.path.exists(path):
            missing.append(name)
            out[name] = {k: {'x': None, 'y': None} for k in POINTS}
            cards.append(card(name, path, None, None))
            continue
        marks, extra = landmarks(scan(head_polys(path)))
        out[name] = marks
        cards.append(card(name, path, marks, extra))
        print(f'{name:<12} ' + '  '.join(f'{k}=({v["x"]},{v["y"]})' for k, v in marks.items()))
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2)
        f.write('\n')
    with open(OUT_HTML, 'w', encoding='utf-8') as f:
        f.write(page(cards))
    if missing:
        print(f'no SVG for: {", ".join(missing)} (left as null in landmarks.json)', file=sys.stderr)
    print(f'wrote {os.path.relpath(OUT_JSON, ROOT)} and {os.path.relpath(OUT_HTML, ROOT)}')
    # The base head depends on these numbers, so choose it again (and rewrite the ChatGPT prompt).
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import select_base_head
    select_base_head.main()


if __name__ == '__main__':
    main()

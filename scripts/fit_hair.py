#!/usr/bin/env python3
"""
Step 4 of the hair pipeline: fits every raw hairstyle onto every head.

    npm run fit-hair            (or: python scripts/fit_hair.py)

Needs numpy, scipy and svgpathtools (pip install -r scripts/requirements.txt).

For each SVG in assets/hair_raw/ (drawn on the base head named in assets/landmarks.json):

  1. Every path is read with all its points: line ends, Bezier control points, arcs (turned into cubic
     Beziers first), and basic shapes (rect, circle, ellipse, line, polyline, polygon, turned into paths).
     Any transform on the element or its groups, and a viewBox other than the 512 frame, is applied first.
  2. A thin-plate-spline warp (scipy RBFInterpolator, kernel='thin_plate_spline') is fitted from the base
     head's six landmarks to each head's six, plus the four corners of the frame held still, so the warp
     stays local to the head and long hair is not flung about far from it. Every point goes through it.
  3. The file is written to assets/hair_fitted/<style>_<head>.svg with the same groups, ids, fills,
     strokes and stroke widths. Only the path data changes, and shapes become paths. Each colour also gets
     a style= with a CSS variable (main colour: var(--hair-color,<colour>); its shades: color-mix() of it),
     so the game can dye the hair. The fill/stroke attributes stay as they are and look identical without it.

Heads: the eight in assets/landmarks.json (a head with no SVG, null landmarks, is skipped), plus the game's
`kid` head, measured here the same way, because children wear their hairstyle on it.

It also writes:
  assets/hair_manifest.json      what the game reads (js/avatar/fittedHair.js loads it): every hairstyle, its name,
                                 whether it is clipped to the head, and the heads it was fitted to. A style added to
                                 assets/hair_raw/ is in the game as soon as this has run.
  scripts/debug_hair_fit.html    every style on every head, to check by eye

clipToHead: a buzz cut or skin fade must hug the skull, never stand off it, so the game clips the whole style
to the head's skin. It is on when the raw file's name contains "fade" or "buzz", or the raw SVG's root has
data-clip-to-head="true"; data-clip-to-head="false" turns it off whatever the name.

If assets/hair_raw/ is empty, it first writes a simple test hairstyle there (test_cap.svg), drawn from the
base head's landmarks, so the pipeline can be checked end to end.
"""
import colorsys, json, math, os, re, sys
import xml.etree.ElementTree as ET

try:
    import numpy as np
    from scipy.interpolate import RBFInterpolator
    from svgpathtools import Arc
    from svgpathtools.parser import parse_transform
except ImportError as err:
    sys.exit(f'{err}\nInstall the pipeline\'s Python packages first:  pip install -r scripts/requirements.txt')

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import extract_landmarks as EL  # noqa: E402  (the same measuring as the landmarks)

ASSETS = os.path.join(ROOT, 'assets')
RAW = os.path.join(ASSETS, 'hair_raw')
FITTED = os.path.join(ASSETS, 'hair_fitted')
HEADS = os.path.join(ASSETS, 'heads')
LANDMARKS = os.path.join(ASSETS, 'landmarks.json')
MANIFEST = os.path.join(ASSETS, 'hair_manifest.json')
DEBUG_HTML = os.path.join(HERE, 'debug_hair_fit.html')

POINTS = EL.POINTS
EXTRA_HEADS = ['kid']  # game heads measured here rather than kept in landmarks.json
LAYERS = ['hair_back', 'hair_base', 'hair_bangs', 'hair_lines']
FRAME = 512
PINS = [(0, 0), (FRAME, 0), (0, FRAME), (FRAME, FRAME)]  # held still: the warp fades out toward the frame's corners
SVG = 'http://www.w3.org/2000/svg'
NS = f'{{{SVG}}}'
ET.register_namespace('', SVG)
ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
OUTLINE = '#23140f'  # the heads' outline colour: left as it is, never dyed
SHAPES = {'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'}
GEOMETRY = {'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'points', 'd', 'transform'}

# ---------- Landmarks ----------


def load_heads():
    """-> (base head name, {head name: 6x2 array of landmarks}, [skipped names])."""
    with open(LANDMARKS, encoding='utf-8') as f:
        data = json.load(f)
    base = data.get('base_head')
    if not base:
        sys.exit('assets/landmarks.json has no base_head: run scripts/extract_landmarks.py first')
    heads, skipped = {}, []
    for name, marks in data.items():
        if name == 'base_head':
            continue
        if any(marks[p]['x'] is None for p in POINTS) or not os.path.exists(os.path.join(HEADS, f'{name}.svg')):
            skipped.append(name)
            continue
        heads[name] = np.array([[marks[p]['x'], marks[p]['y']] for p in POINTS], float)
    for name in EXTRA_HEADS:
        path = os.path.join(HEADS, f'{name}.svg')
        if name not in heads and os.path.exists(path):
            marks, _ = EL.landmarks(EL.scan(EL.head_polys(path)))
            heads[name] = np.array([[marks[p]['x'], marks[p]['y']] for p in POINTS], float)
    if base not in heads:
        sys.exit(f'the base head {base!r} has no landmarks')
    return base, heads, skipped


def warp_for(src, dst):
    """A function mapping an (n, 2) array of base-head points onto a head, by thin-plate spline."""
    pins = np.array(PINS, float)
    rbf = RBFInterpolator(np.vstack([src, pins]), np.vstack([dst, pins]), kernel='thin_plate_spline')
    return lambda pts: rbf(pts) if len(pts) else pts

# ---------- Reading paths ----------

TOKEN = re.compile(r'[MmLlHhVvQqTtCcSsAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?')
ARGS = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'Q': 4, 'T': 2, 'C': 6, 'S': 4, 'A': 7, 'Z': 0}


def arc_to_cubics(p0, rx, ry, rot, large, sweep, p1):
    """An SVG arc -> a list of cubic segments [(c1, c2, end), ...], via svgpathtools, one per <= 45 degrees."""
    if rx == 0 or ry == 0 or p0 == p1:
        return [(p0, p1, p1)]
    arc = Arc(complex(*p0), complex(abs(rx), abs(ry)), rot, bool(large), bool(sweep), complex(*p1))
    n = max(1, math.ceil(abs(arc.delta) / 45))
    out = []
    for i in range(n):
        t0, t1 = i / n, (i + 1) / n
        a, b = arc.point(t0), arc.point(t1)
        da, db = arc.derivative(t0) * (t1 - t0), arc.derivative(t1) * (t1 - t0)
        c1, c2 = a + da / 3, b - db / 3  # Hermite -> Bezier
        out.append(((c1.real, c1.imag), (c2.real, c2.imag), (b.real, b.imag)))
    return out


def parse_d(d):
    """Path data -> a list of absolute commands: ('M', p) ('L', p) ('Q', c, p) ('C', c1, c2, p) ('Z',).
    H/V become L, S/T become C/Q with their reflected control point, arcs become cubics."""
    toks, i = TOKEN.findall(d or ''), 0
    out, pos, start, cmd, last_c, last_q = [], (0.0, 0.0), (0.0, 0.0), None, None, None
    while i < len(toks):
        if toks[i].isalpha():
            cmd = toks[i]
            i += 1
        elif cmd is None:
            raise ValueError('path data does not start with a command')
        c, rel = cmd.upper(), cmd.islower()
        if c == 'Z':
            out.append(('Z',))
            pos, last_c, last_q = start, None, None
            continue
        n = ARGS[c]
        if i + n > len(toks):
            break
        v = [float(t) for t in toks[i:i + n]]
        i += n
        ox, oy = pos if rel else (0.0, 0.0)
        pt = lambda k: (ox + v[k], oy + v[k + 1])
        if c == 'M':
            pos = start = pt(0)
            out.append(('M', pos))
            cmd = 'l' if rel else 'L'
            last_c = last_q = None
        elif c in 'LHV':
            if c == 'L':
                pos = pt(0)
            elif c == 'H':
                pos = ((ox if rel else 0) + v[0], pos[1])
            else:
                pos = (pos[0], (oy if rel else 0) + v[0])
            out.append(('L', pos))
            last_c = last_q = None
        elif c in 'QT':
            ctrl = pt(0) if c == 'Q' else ((2 * pos[0] - last_q[0], 2 * pos[1] - last_q[1]) if last_q else pos)
            pos = pt(2) if c == 'Q' else pt(0)
            out.append(('Q', ctrl, pos))
            last_q, last_c = ctrl, None
        elif c in 'CS':
            c1 = pt(0) if c == 'C' else ((2 * pos[0] - last_c[0], 2 * pos[1] - last_c[1]) if last_c else pos)
            c2 = pt(2) if c == 'C' else pt(0)
            pos = pt(4) if c == 'C' else pt(2)
            out.append(('C', c1, c2, pos))
            last_c, last_q = c2, None
        else:  # A
            end = (ox + v[5], oy + v[6])
            for c1, c2, p in arc_to_cubics(pos, v[0], v[1], v[2], v[3], v[4], end):
                out.append(('C', c1, c2, p))
            pos, last_c, last_q = end, None, None
    return out


def shape_d(el, tag):
    """A basic shape's outline as path data."""
    g = lambda k, dflt=0.0: float(el.get(k, dflt) or dflt)
    if tag == 'rect':
        x, y, w, h = g('x'), g('y'), g('width'), g('height')
        rx, ry = el.get('rx'), el.get('ry')
        rx = float(rx if rx is not None else ry or 0)
        ry = float(ry if ry is not None else rx)
        rx, ry = min(rx, w / 2), min(ry, h / 2)
        if not rx or not ry:
            return f'M{x} {y}H{x + w}V{y + h}H{x}Z'
        return (f'M{x + rx} {y}H{x + w - rx}A{rx} {ry} 0 0 1 {x + w} {y + ry}V{y + h - ry}A{rx} {ry} 0 0 1 {x + w - rx} {y + h}'
                f'H{x + rx}A{rx} {ry} 0 0 1 {x} {y + h - ry}V{y + ry}A{rx} {ry} 0 0 1 {x + rx} {y}Z')
    if tag in ('circle', 'ellipse'):
        cx, cy = g('cx'), g('cy')
        rx, ry = (g('r'), g('r')) if tag == 'circle' else (g('rx'), g('ry'))
        return f'M{cx - rx} {cy}A{rx} {ry} 0 1 0 {cx + rx} {cy}A{rx} {ry} 0 1 0 {cx - rx} {cy}Z'
    if tag == 'line':
        return f'M{g("x1")} {g("y1")}L{g("x2")} {g("y2")}'
    nums = [float(t) for t in re.findall(r'[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?', el.get('points', ''))]
    pts = ' '.join(f'{nums[k]} {nums[k + 1]}' for k in range(0, len(nums) - 1, 2))
    return f'M{pts}' + ('Z' if tag == 'polygon' else '')


def points_of(cmds):
    return [p for c in cmds for p in c[1:]]


def with_points(cmds, pts):
    out, k = [], 0
    for c in cmds:
        n = len(c) - 1
        out.append((c[0], *pts[k:k + n]))
        k += n
    return out


def write_d(cmds):
    f = lambda v: f'{v:.2f}'.rstrip('0').rstrip('.').replace('-0', '0') if abs(v) >= 0.005 else '0'
    return ' '.join(c[0] + (' '.join(f'{f(x)} {f(y)}' for x, y in c[1:])) for c in cmds)

# ---------- Transforms ----------


def viewbox_matrix(root):
    vb = [float(v) for v in re.split(r'[\s,]+', (root.get('viewBox') or f'0 0 {FRAME} {FRAME}').strip())]
    if vb == [0, 0, FRAME, FRAME]:
        return np.identity(3)
    s = min(FRAME / vb[2], FRAME / vb[3])  # xMidYMid meet
    tx = (FRAME - vb[2] * s) / 2 - vb[0] * s
    ty = (FRAME - vb[3] * s) / 2 - vb[1] * s
    print(f'  note: viewBox {vb} is mapped into the 512 frame (scale {s:.3f}); stroke widths are not rescaled')
    return np.array([[s, 0, tx], [0, s, ty], [0, 0, 1]])


def apply(m, pts):
    if not len(pts) or np.allclose(m, np.identity(3)):
        return np.array(pts, float).reshape(-1, 2)
    a = np.array(pts, float)
    return a @ m[:2, :2].T + m[:2, 2]

# ---------- Colours (so the game can dye the hair) ----------


def hex_rgb(c):
    c = c.strip().lower()
    if re.fullmatch(r'#[0-9a-f]{3}', c):
        c = '#' + ''.join(ch * 2 for ch in c[1:])
    return tuple(int(c[k:k + 2], 16) for k in (1, 3, 5)) if re.fullmatch(r'#[0-9a-f]{6}', c) else None


def dye(colour, main):
    """A colour of the hairstyle -> a CSS value that follows --hair-color, or None to leave it as it is."""
    rgb, m = hex_rgb(colour or ''), hex_rgb(main)
    if rgb is None or colour.lower() == OUTLINE or sum(rgb) < 3 * 40:  # outlines and near-blacks stay
        return None
    if rgb == m:
        return f'var(--hair-color,{main})'
    h1, l1, _ = colorsys.rgb_to_hls(*[v / 255 for v in rgb])
    h2, l2, _ = colorsys.rgb_to_hls(*[v / 255 for v in m])
    if min(abs(h1 - h2), 1 - abs(h1 - h2)) > 0.12:  # not a shade of the main colour: an accessory, kept
        return None
    if l1 <= l2:  # darker: the main colour mixed with black
        p = sum(c / max(1, mm) for c, mm in zip(rgb, m)) / 3 * 100
        return f'color-mix(in srgb,var(--hair-color,{main}) {round(min(100, p))}%,#000)'
    p = sum((255 - c) / max(1, 255 - mm) for c, mm in zip(rgb, m)) / 3 * 100  # lighter: mixed with white
    return f'color-mix(in srgb,var(--hair-color,{main}) {round(min(100, p))}%,#fff)'


def main_colour(root):
    """The main hair colour: the fill of the first filled shape in hair_base (or anywhere, failing that)."""
    for scope in [g for g in root.iter(f'{NS}g') if g.get('id') == 'hair_base'] + [root]:
        for el in scope.iter():
            fill = el.get('fill')
            if hex_rgb(fill or '') and fill.lower() != OUTLINE:
                return fill.lower()
    return '#8f4b29'

# ---------- Fitting one file ----------


def drawable(root):
    """[(element, its tag, the matrix to the 512 frame)] for every path and basic shape, in document order."""
    out = []

    def walk(el, m):
        t = el.get('transform')
        if t:
            m = m @ parse_transform(t)
        tag = el.tag.replace(NS, '')
        if tag == 'path' or tag in SHAPES:
            out.append((el, tag, m))
        for child in el:
            if isinstance(child.tag, str) and child.tag.replace(NS, '') not in ('defs', 'clipPath', 'mask', 'symbol'):
                walk(child, m)
    walk(root, viewbox_matrix(root))
    return out


def fit_file(path, base, heads):
    """-> {head name: the fitted SVG text}."""
    name = os.path.basename(path)[:-4]
    parser = ET.XMLParser(target=ET.TreeBuilder(insert_comments=True))
    tree = ET.parse(path, parser)
    root = tree.getroot()
    found = [g.get('id') for g in root.iter(f'{NS}g') if g.get('id') in LAYERS]
    missing = [l for l in LAYERS if l not in found]
    if missing:
        print(f'  warning: {name} has no {", ".join(missing)} group(s); the game draws what is there')
    main = main_colour(root)
    # Read every shape once, in the 512 frame of the base head.
    items = []
    for el, tag, m in drawable(root):
        cmds = parse_d(el.get('d') if tag == 'path' else shape_d(el, tag))
        items.append((el, tag, cmds, apply(m, points_of(cmds))))
    # Colours: a style= that follows --hair-color, ahead of any style already there.
    for el in root.iter():
        if not isinstance(el.tag, str):
            continue
        css = []
        for prop in ('fill', 'stroke'):
            v = dye(el.get(prop), main)
            if v:
                css.append(f'{prop}:{v}')
        if css:
            el.set('style', ';'.join(css + ([el.get('style')] if el.get('style') else [])))
    out = {}
    for head, dst in heads.items():
        warp = warp_for(heads[base], dst)
        for el, tag, cmds, pts in items:
            moved = warp(pts) if len(pts) else pts
            if tag != 'path':
                el.tag = f'{NS}path'
            for k in [k for k in el.attrib if k in GEOMETRY]:
                del el.attrib[k]
            el.set('d', write_d(with_points(cmds, [tuple(p) for p in moved])))
        for g in root.iter():  # transforms are applied to the points
            if isinstance(g.tag, str) and 'transform' in g.attrib:
                del g.attrib['transform']
        root.set('viewBox', f'0 0 {FRAME} {FRAME}')
        root.set('width', str(FRAME))
        root.set('height', str(FRAME))
        root.set('data-hair', name)
        root.set('data-head', head)
        root.set('data-fitted-from', base)
        out[head] = '<!-- Generated by scripts/fit_hair.py from assets/hair_raw/%s.svg: do not edit by hand. -->\n%s\n' % (
            name, ET.tostring(root, encoding='unicode'))
    return out

# ---------- A test hairstyle, when there are none ----------


def test_cap(base_marks):
    """A plain short cap built from the base head's landmarks, in the four layers."""
    P = dict(zip(POINTS, base_marks.tolist()))
    (cx, top), (_, fy) = P['crown_top'], P['forehead_mid']
    (tl, ty), (tr, _) = P['temple_left'], P['temple_right']
    (el, ey), (er, _) = P['ear_left'], P['ear_right']
    o = 6  # just outside the outline
    outer = (f'M{el - o} {ey + 6} C{el - o - 2} {ty} {tl - o} {ty - 40} {tl + 20} {top + 30} '
             f'C{cx - 70} {top - 22} {cx + 70} {top - 22} {tr - 20} {top + 30} C{tr + o} {ty - 40} {er + o + 2} {ty} {er + o} {ey + 6}')
    inner = (f'L{er - 10} {ey + 4} C{er - 10} {ty} {tr - 30} {fy + 4} {cx} {fy} C{tl + 30} {fy + 4} {el + 10} {ty} {el + 10} {ey + 4} Z')
    bangs = f'M{tl + 22} {fy + 2} Q{cx - 40} {fy + 26} {cx - 10} {fy + 12} Q{cx + 30} {fy + 30} {tr - 22} {fy + 2} Q{cx} {fy - 14} {tl + 22} {fy + 2} Z'
    return f'''<svg xmlns="{SVG}" viewBox="0 0 512 512" width="512" height="512" data-type="any" data-length="short">
  <!-- A test hairstyle written by scripts/fit_hair.py because assets/hair_raw/ was empty. -->
  <g id="hair_back"><path fill="#6b3520" stroke="{OUTLINE}" stroke-width="6" stroke-linejoin="round" d="{outer} L{er} {ey + 20} Q{cx} {ey + 34} {el} {ey + 20} Z"/></g>
  <g id="hair_base"><path fill="#8f4b29" stroke="{OUTLINE}" stroke-width="6" stroke-linejoin="round" d="{outer} {inner}"/></g>
  <g id="hair_bangs"><path fill="#8f4b29" stroke="{OUTLINE}" stroke-width="6" stroke-linejoin="round" d="{bangs}"/></g>
  <g id="hair_lines" fill="none" stroke-linecap="round"><path stroke="#4a2414" stroke-width="3" d="M{cx - 30} {top + 12} Q{cx - 40} {top + 40} {cx - 46} {fy - 6} M{cx + 20} {top + 10} Q{cx + 24} {top + 40} {cx + 20} {fy - 8}"/></g>
</svg>
'''

# ---------- Outputs for the game and for checking ----------


def label(name):
    """'textured_crop' -> 'Textured Crop'."""
    return ' '.join(w.capitalize() for w in name.split('_') if w)


def clip_to_head(name, root):
    flag = (root.get('data-clip-to-head') or '').strip().lower()
    if flag in ('true', 'false'):
        return flag == 'true'
    return bool(re.search(r'fade|buzz', name))


def write_manifest(base, styles):
    with open(MANIFEST, 'w', encoding='utf-8') as f:
        json.dump({'generatedBy': 'scripts/fit_hair.py (do not edit by hand)', 'baseHead': base,
                   'hairstyles': [{'id': k, **v} for k, v in styles.items()]}, f, indent=2)
        f.write('\n')


def debug_page(base, heads, skipped, styles):
    head_svg = {}
    for h in list(heads) + skipped:
        p = os.path.join(HEADS, f'{h}.svg')
        if os.path.exists(p):
            inner = re.sub(r'^.*?<svg[^>]*>|</svg>\s*$', '', open(p, encoding='utf-8').read(), flags=re.S)
            head_svg[h] = re.sub(r'id="([^"]+)"', lambda m: f'id="{h}-head-{m.group(1)}"', inner)

    def groups(svg_text):
        found = {}
        for gid in LAYERS:
            m = re.search(rf'<g [^>]*id="{gid}".*?</g>|<g [^>]*id="{gid}"[^>]*/>', svg_text, flags=re.S)
            found[gid] = re.sub(r'\sid="[^"]+"', '', m.group(0)) if m else ''
        return found

    cols = list(heads) + skipped
    rows = []
    for style in styles:
        cells = []
        for h in cols:
            if h not in heads:
                cells.append(f'<td class="none">no head SVG<br>for <code>{h}</code></td>')
                continue
            g = groups(open(os.path.join(FITTED, f'{style}_{h}.svg'), encoding='utf-8').read())
            back, front = g['hair_back'], g['hair_base'] + g['hair_bangs'] + g['hair_lines']
            if styles[style]['clipToHead']:  # as the game draws it: clipped to this head's skin
                clip = f'clip-{style}-{h}'
                skin = re.search(rf'<path[^>]*id="{h}-head-skin"[^>]*/>', head_svg[h]).group(0)
                skin = re.sub(r'\s(id|style)="[^"]*"', '', skin)
                back = f'<clipPath id="{clip}">{skin}</clipPath><g clip-path="url(#{clip})">{back}</g>'
                front = f'<g clip-path="url(#{clip})">{front}</g>'
            cells.append(f'<td><svg viewBox="80 60 352 352" role="img" aria-label="{style} on {h}">{back}<g>{head_svg[h]}</g>'
                         f'{front}</svg></td>')
        tag = '<br><small>clipped to head</small>' if styles[style]['clipToHead'] else ''
        rows.append(f'<tr><th scope="row">{style}{tag}</th>{"".join(cells)}</tr>')
    head_row = ''.join(f'<th scope="col">{h}{" (base)" if h == base else ""}</th>' for h in cols)
    swatches = ''.join(f'<button type="button" data-c="{c}" style="background:{c}" aria-label="dye {n}"></button>'
                       for n, c in [('as drawn', ''), ('black', '#1f1a17'), ('blonde', '#e2c27a'), ('ginger', '#c4602d'), ('blue', '#3d6fd8')])
    with open(DEBUG_HTML, 'w', encoding='utf-8') as f:
        f.write(f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hair fit matrix</title>
<style>
  :root {{ --bg: #f4f4f6; --card: #ffffff; --ink: #1d1d22; --muted: #6b6b76; --line: #dcdce2; --skin-color: #e2b48c; }}
  @media (prefers-color-scheme: dark) {{ :root {{ --bg: #16161a; --card: #222228; --ink: #ececf1; --muted: #a0a0ab; --line: #3a3a44; }} }}
  body {{ margin: 0; padding: 20px 16px 40px; background: var(--bg); color: var(--ink); font: 14px/1.4 system-ui, sans-serif; }}
  h1 {{ font-size: 20px; margin: 0 0 4px; }}
  p {{ margin: 0 0 12px; color: var(--muted); max-width: 75ch; }}
  .wrap {{ overflow-x: auto; }}
  table {{ border-collapse: separate; border-spacing: 8px; }}
  th {{ font-weight: 600; text-align: left; white-space: nowrap; }}
  th[scope=row] {{ position: sticky; left: 0; background: var(--bg); padding-right: 6px; }}
  td {{ background: #c9ced8; border-radius: 8px; padding: 0; width: 180px; }}
  td svg {{ display: block; width: 180px; height: 180px; }}
  td.none {{ background: var(--card); border: 2px dashed var(--line); color: var(--muted); text-align: center; font-size: 12px; }}
  .dye {{ display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }}
  .dye button {{ width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--line); cursor: pointer; }}
  .dye button[data-c=""] {{ background: linear-gradient(135deg, #8f4b29 50%, #6b3520 50%) !important; }}
</style>
</head>
<body>
<h1>Hair fit matrix</h1>
<p>Generated by <code>scripts/fit_hair.py</code>: every hairstyle in <code>assets/hair_raw/</code>, warped from the base head
(<code>{base}</code>) onto each head. Drawn as the game draws it: <code>hair_back</code> behind the head, then
<code>hair_base</code>, <code>hair_bangs</code> and <code>hair_lines</code> in front. Check for scalp showing between hair and head,
and for hair cutting into the face or ears.</p>
<div class="dye">Dye: {swatches}</div>
<div class="wrap"><table>
<tr><th></th>{head_row}</tr>
{chr(10).join(rows)}
</table></div>
<script>
  for (const b of document.querySelectorAll('.dye button'))
    b.addEventListener('click', () => b.dataset.c ? document.body.style.setProperty('--hair-color', b.dataset.c) : document.body.style.removeProperty('--hair-color'));
</script>
</body>
</html>
''')

# ---------- Main ----------


def main():
    base, heads, skipped = load_heads()
    os.makedirs(RAW, exist_ok=True)
    os.makedirs(FITTED, exist_ok=True)
    raws = sorted(f for f in os.listdir(RAW) if f.lower().endswith('.svg'))
    if not raws:
        with open(os.path.join(RAW, 'test_cap.svg'), 'w', encoding='utf-8') as f:
            f.write(test_cap(heads[base]))
        raws = ['test_cap.svg']
        print('assets/hair_raw/ was empty: wrote a test hairstyle, test_cap.svg')
    styles, written = {}, set()
    for raw in raws:
        name = re.sub(r'[^a-z0-9]+', '_', raw[:-4].lower()).strip('_')
        print(f'{name}:')
        fitted = fit_file(os.path.join(RAW, raw), base, heads)
        for head, text in fitted.items():
            out = f'{name}_{head}.svg'
            with open(os.path.join(FITTED, out), 'w', encoding='utf-8') as f:
                f.write(text)
            written.add(out)
        root = ET.parse(os.path.join(RAW, raw)).getroot()
        styles[name] = {'name': root.get('data-name') or label(name), 'clipToHead': clip_to_head(name, root),
                        'length': root.get('data-length', 'short'), 'type': root.get('data-type', 'any'), 'heads': sorted(fitted)}
        print(f'  -> {len(fitted)} fitted: ' + ', '.join(sorted(fitted)))
    # Fitted files whose raw hairstyle has gone are removed, so the folder matches the index.
    for f in os.listdir(FITTED):
        if f.endswith('.svg') and f not in written:
            os.remove(os.path.join(FITTED, f))
            print(f'removed {f} (no raw hairstyle for it any more)')
    write_manifest(base, styles)
    debug_page(base, heads, skipped, styles)
    if skipped:
        print(f'skipped (no head SVG): {", ".join(skipped)}')
    print(f'wrote {len(written)} file(s) to assets/hair_fitted/, assets/hair_manifest.json and scripts/debug_hair_fit.html')


if __name__ == '__main__':
    main()

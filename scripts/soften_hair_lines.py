#!/usr/bin/env python3
"""
Softens the lines inside a hairstyle, so it reads as one volume rather than pieces with heavy outlines.

    python scripts/soften_hair_lines.py [files or folders]     (default: every SVG in assets/hair_raw/)
    npm run fit-hair                                          (then fit the softened styles to every head)

Raw hairstyles outline every shape with the heavy head outline (stroke #23140f, width 6). Where a shape's
edge lies over other hair (a fringe over the cap, front curls over the back of an afro, a hairline running
over a bun), that heavy line cuts the hair into separate pieces. This script looks at each edge of each
shape in hair_base and hair_bangs, along its length, and checks what is on either side of it:

  - hair on both sides           an internal line: softened to stroke #4a2414, width 3
  - face, ears or background     the outer silhouette: kept as stroke #23140f, width 6
    on one side

"Hair" is any filled shape in hair_base or hair_bangs, or in hair_back where it is not hidden behind the
head (hair_back is drawn behind the head; the head is the base head named in assets/landmarks.json).
Each shape keeps its fill exactly as it was, as one path with no stroke; its outline becomes stroke-only
paths drawn over it, the heavy and the soft runs made of the original curves, split exactly where an edge
passes from over the hair to the silhouette. hair_back is not
changed: its outline is the edge of the whole style.

One shade: every filled shape in hair_back, hair_base and hair_bangs is given the main hair colour (the
fill of hair_base), so no part of the hair is darker or lighter than the rest; the soft lines are what
separate the pieces. This is checked on every run, softened or not.

hair_lines: every line is stroke-width 2.5 with round caps and joins; dark lines become #4a2414 (light
highlight strokes keep their colour, so the hair keeps its shine).

A softened file is marked data-softened="1" on its <svg> and its outlines are not touched again on later
runs, so running it twice is safe. Standard library plus numpy (already needed by fit_hair.py).
"""
import json, os, sys
import xml.etree.ElementTree as ET
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import fit_hair as F  # noqa: E402  (the same path reading and writing as the fitting)

RAW = os.path.join(ROOT, 'assets', 'hair_raw')
NS = F.NS
HEAVY = ('#23140f', '6')
SOFT = ('#4a2414', '3')
LINES = ('#4a2414', '2.5')
SIDE = 4.0       # how far either side of an edge to look: just beyond half the heavy stroke
STEPS = 12      # each segment is looked at in this many pieces, and split exactly where its surroundings change

# ---------- Geometry ----------


def segments(cmds):
    """Absolute commands -> [(start, the command tuple)] for every drawn segment; Z becomes a line back to the start."""
    out, pos, start = [], None, None
    for c in cmds:
        if c[0] == 'M':
            pos = start = c[1]
        elif c[0] == 'Z':
            if pos is not None and pos != start:
                out.append((pos, ('L', start)))
            pos = start
        else:
            out.append((pos, c))
            pos = c[-1]
    return out


def point(start, c, t):
    p = [start, *c[1:]]
    while len(p) > 1:
        p = [((1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1]) for a, b in zip(p, p[1:])]
    return np.array(p[0])


def split(start, c, t0, t1):
    """The part of a segment between t0 and t1, as the same kind of segment (de Casteljau), and its start."""
    def cut(p, t):  # -> (the part before t, the part after t), as control polygons
        left, right, cur = [p[0]], [p[-1]], p
        while len(cur) > 1:
            cur = [((1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1]) for a, b in zip(cur, cur[1:])]
            left.append(cur[0])
            right.append(cur[-1])
        return left, right[::-1]
    p = [start, *c[1:]]
    if t1 < 1:
        p = cut(p, t1)[0]
    if t0 > 0:
        p = cut(p, t0 / t1)[1]
    return tuple(p[0]), (c[0], *[tuple(q) for q in p[1:]])


def polygon(cmds, steps=10):
    """A filled shape's outline as closed polygons, for testing whether points are inside it."""
    polys, cur = [], []
    for c in cmds:
        if c[0] == 'M':
            if len(cur) > 2:
                polys.append(np.array(cur))
            cur = [c[1]]
        elif c[0] == 'Z':
            if len(cur) > 2:
                polys.append(np.array(cur))
            cur = []
        elif c[0] == 'L':
            cur.append(c[1])
        else:
            start = cur[-1] if cur else c[-1]
            cur += [tuple(point(start, c, k / steps)) for k in range(1, steps + 1)]
    if len(cur) > 2:
        polys.append(np.array(cur))
    return polys


def inside(polys, pts, rule='nonzero'):
    """Which of the points (n, 2) are inside the shape, by SVG's fill rule."""
    pts = np.asarray(pts, float).reshape(-1, 2)
    wind = np.zeros(len(pts), int)
    for poly in polys:
        a, b = poly, np.roll(poly, -1, axis=0)
        for (x0, y0), (x1, y1) in zip(a, b):
            up = (y0 <= pts[:, 1]) & (y1 > pts[:, 1])
            down = (y0 > pts[:, 1]) & (y1 <= pts[:, 1])
            cross = (x1 - x0) * (pts[:, 1] - y0) - (pts[:, 0] - x0) * (y1 - y0)
            wind += (up & (cross > 0)).astype(int) - (down & (cross < 0)).astype(int)
    return (wind % 2 == 1) if rule == 'evenodd' else (wind != 0)

# ---------- One file ----------


def base_head_outline():
    with open(os.path.join(ROOT, 'assets', 'landmarks.json'), encoding='utf-8') as f:
        base = json.load(f)['base_head']
    root = ET.parse(os.path.join(ROOT, 'assets', 'heads', f'{base}.svg')).getroot()
    outline = next(p for p in root.iter(f'{NS}path') if p.get('id') != 'skin')  # the silhouette: head, ears, neck
    return polygon(F.parse_d(outline.get('d')))


def attr(el, group, name):
    return el.get(name) if el.get(name) is not None else group.get(name)


def soften(path, head):
    tree = ET.parse(path, ET.XMLParser(target=ET.TreeBuilder(insert_comments=True)))
    root = tree.getroot()
    groups = {g.get('id'): g for g in root.iter(f'{NS}g') if g.get('id') in F.LAYERS}
    shaded = one_shade(root, groups)
    if root.get('data-softened') == '1':
        if shaded:
            write(path, root)
        return {'shaded': shaded} if shaded else None
    filled = lambda g: [(p, F.parse_d(p.get('d'))) for p in (g.iter(f'{NS}path') if g is not None else [])
                        if (attr(p, g, 'fill') or '#000') != 'none']
    front = [polygon(c) for gid in ('hair_base', 'hair_bangs') for _, c in filled(groups.get(gid))]
    back = [polygon(c) for _, c in filled(groups.get('hair_back'))]

    def hair(pts):
        """Is there hair showing at each point: in front of the face, or behind the head where the head is not."""
        pts = np.asarray(pts, float).reshape(-1, 2)
        show = np.zeros(len(pts), bool)
        for poly in front:
            show |= inside(poly, pts)
        behind = np.zeros(len(pts), bool)
        for poly in back:
            behind |= inside(poly, pts)
        return show | (behind & ~inside(head, pts, 'evenodd'))

    def internal_at(start, c, t):
        """Is there hair on both sides of the edge at t?"""
        p = point(start, c, t)
        d = point(start, c, min(1, t + 0.01)) - point(start, c, max(0, t - 0.01))
        if not np.any(d):
            return False
        n = np.array([d[1], -d[0]]) / np.hypot(*d)
        return bool(hair(np.array([p + SIDE * n, p - SIDE * n])).all())

    def pieces(start, c):
        """A segment -> [(kind, start, segment)]: split where it passes from over hair to the silhouette or back."""
        kinds = ['soft' if internal_at(start, c, (k + 0.5) / STEPS) else 'heavy' for k in range(STEPS)]
        out, k0 = [], 0
        for k in range(1, STEPS + 1):
            if k == STEPS or kinds[k] != kinds[k0]:
                if k0 == 0 and k == STEPS:
                    out.append((kinds[0], start, c))
                else:
                    s0, part = split(start, c, k0 / STEPS, k / STEPS)
                    out.append((kinds[k0], s0, part))
                k0 = k
        return out

    counts = {'soft': 0, 'heavy': 0}
    for gid in ('hair_base', 'hair_bangs'):
        g = groups.get(gid)
        if g is None:
            continue
        for el in list(g):
            if not isinstance(el.tag, str) or el.tag != f'{NS}path':
                continue
            stroke = attr(el, g, 'stroke')
            if not stroke or stroke == 'none':
                continue
            cmds = F.parse_d(el.get('d'))
            runs = []  # [(kind, [(start, command)])], consecutive segments of one kind
            for s0, c0 in segments(cmds):
                for kind, start, c in pieces(s0, c0):
                    counts[kind] += 1
                    if runs and runs[-1][0] == kind and runs[-1][1][-1][1][-1] == start:
                        runs[-1][1].append((start, c))
                    else:
                        runs.append((kind, [(start, c)]))
            k = list(g).index(el)
            fill = attr(el, g, 'fill')
            new = []
            if fill and fill != 'none':  # the shape itself, filled, with no outline
                body = ET.Element(f'{NS}path', {a: v for a, v in el.attrib.items() if not a.startswith('stroke')})
                body.set('stroke', 'none')
                new.append(body)
            for kind, segs in runs:  # its outline, over it: the silhouette heavy, the lines inside the hair soft
                colour, width = HEAVY if kind == 'heavy' else SOFT
                d = F.write_d([('M', segs[0][0])] + [c for _, c in segs])
                new.append(ET.Element(f'{NS}path', {'fill': 'none', 'stroke': colour, 'stroke-width': width,
                                                   'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'd': d}))
            g.remove(el)
            for j, e in enumerate(new):
                g.insert(k + j, e)

    lines = groups.get('hair_lines')
    if lines is not None:
        lines.set('fill', 'none')
        lines.set('stroke-width', LINES[1])
        lines.set('stroke-linecap', 'round')
        lines.set('stroke-linejoin', 'round')
        for p in lines.iter(f'{NS}path'):
            p.attrib.pop('stroke-width', None)
            rgb = F.hex_rgb(attr(p, lines, 'stroke') or '#000')
            if rgb and sum(rgb) < 3 * 110:  # a dark line (a light one is a highlight, and keeps its colour)
                p.set('stroke', LINES[0])
    root.set('data-softened', '1')
    write(path, root)
    counts['shaded'] = shaded
    return counts


def one_shade(root, groups):
    """Gives every hair fill the main colour. -> how many fills changed."""
    main = F.main_colour(root)
    changed = 0
    for gid in ('hair_back', 'hair_base', 'hair_bangs'):
        g = groups.get(gid)
        if g is None:
            continue
        for el in [g, *g.iter(f'{NS}path')]:
            fill = el.get('fill')
            if fill and fill.lower() not in ('none', main) and F.hex_rgb(fill) and fill.lower() != F.OUTLINE:
                el.set('fill', main)
                changed += 1
    return changed


def write(path, root):
    text = ET.tostring(root, encoding='unicode')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text.replace('<svg:', '<').replace('</svg:', '</') + '\n')


def main(argv):
    targets = argv or [RAW]
    files = []
    for t in targets:
        files += sorted(os.path.join(t, f) for f in os.listdir(t) if f.endswith('.svg')) if os.path.isdir(t) else [t]
    head = base_head_outline()
    for f in files:
        counts = soften(f, head)
        name = os.path.basename(f)
        shade = f'; {counts["shaded"]} fill(s) set to the main colour' if counts and counts.get('shaded') else ''
        if counts is None:
            print(f'  {name}: already softened, one shade')
        elif 'soft' not in counts:
            print(f'  {name}: already softened{shade}')
        else:
            print(f'  {name}: {counts["soft"]} stretch(es) of edge inside the hair softened, {counts["heavy"]} kept as outline{shade}')
    print('Run `npm run fit-hair` to fit the softened styles to every head.')


if __name__ == '__main__':
    main(sys.argv[1:])

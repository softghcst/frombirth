#!/usr/bin/env python3
"""
Turns hairstyles drawn as PNG pictures into the game's hair SVGs, cleanly.

    npm run trace-hair          (or: python scripts/trace_hair_png.py [style names], then python scripts/fit_hair.py)

Needs numpy, scipy, scikit-image and Pillow (pip install -r scripts/requirements.txt).

Draw each hairstyle over assets/hair_png/TEMPLATE_base_head.png (the base head, at 2048 x 2048), hide the head, and
save the hair alone on a transparent background as assets/hair_png/<style>.png (see assets/hair_png/README.md).
Hair that goes BEHIND the head and neck (the back of long hair) can be drawn in a second picture,
<style>_back.png, on the same frame; the game draws it behind the head.

A general auto-tracer guesses at shapes from the pixels, which is what ruins hair: shading turns into blotches,
strands into specks, outlines wobble, and the colors split into dozens of shades the game cannot dye. This one
knows what hair in this game is made of, and rebuilds it from those parts instead:

  outline     the outer edge of everything drawn, redrawn as ONE clean #23140f band 6 units wide (the head's own
              outline), from a smoothed distance field of the silhouette, so it is even all the way round.
  main color  the hair's main tone (the middle one of shadow, main and highlight), which becomes exactly #8f4b29:
              the color the game dyes.
  shadows     shapes clearly darker than the main color, and highlights clearly lighter, each as one shade of the
              main color (so they dye with it); thin slivers along edges (anti-aliasing) are dropped.
  ink lines   dark strand lines drawn inside the hair: near-black ones in the outline color, dark brown ones as a
              shade of the main color (so they dye).
  wisps       anything thinner than the outline (a flyaway strand) is kept as ink, so nothing drawn is lost.

Front and back: everything above the ears is drawn in front of the head, and from the ears down only locks that
fall over the face; the lengths beside the jaw and neck go behind it (hair_back), so a wider jaw draws over them and a
narrower one shows hair beside it, never a gap (a hidden fill behind the jaw and neck, out of sight on the template
head, sees to that). The outline is an even filled band, so cutting the hair in two leaves no line along the cut.

Every edge is a smooth curve (Catmull-Rom through a simplified contour, turned into Bezier curves), with sharp points
kept sharp, as on the tips of locks. Specks smaller than a few units are dropped.

Writes assets/hair_raw/<style>.svg (marked data-from-png="1"), which `npm run fit-hair` then fits to every head, and
scripts/debug_hair_png.html: each picture next to its SVG, on the base head, to check by eye that nothing was lost.
A style whose SVG is newer than its PNG is skipped unless named on the command line.
"""
import os, sys, math

try:
    import numpy as np
    from PIL import Image
    from scipy import ndimage as ndi
    from skimage import measure
except ImportError as err:
    sys.exit(f'{err}\nInstall the pipeline\'s Python packages first:  pip install -r scripts/requirements.txt')

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PNG_DIR = os.path.join(ROOT, 'assets', 'hair_png')
RAW = os.path.join(ROOT, 'assets', 'hair_raw')
DEBUG_HTML = os.path.join(HERE, 'debug_hair_png.html')
TEMPLATE = os.path.join(PNG_DIR, 'TEMPLATE_base_head.png')
EAR_Y = 278          # the base head's ears (assets/landmarks.json): hair below this beside the head goes behind it
NECK_Y = 470         # the base of its neck: the filler behind the jaw and neck stops here
MIN_LOCK = 150       # a piece of hair over the face below the ears must be this big (square units) to stay in front
FACE_MARGIN = 12     # below the ears, hair stays in front of the face only this far inside the head's outline

SIZE = 2048                 # pictures are worked on at this size: 4 pixels to one unit of the 512 frame
PX = SIZE / 512
MAIN = (0x8f, 0x4b, 0x29)   # the color the game dyes
OUTLINE = '#23140f'
OUTLINE_W = 6
MIN_AREA = 6                # specks smaller than this (square units) are dropped
MIN_SHADE_AREA = 14         # shadow and highlight shapes smaller than this too
DISK3 = (lambda r: (np.add.outer(np.arange(-r, r + 1) ** 2, np.arange(-r, r + 1) ** 2) <= r * r))(3)
CORNER_DEG = 58             # a turn sharper than this stays a point (lock tips)


def hexc(rgb):
    return '#' + ''.join(f'{max(0, min(255, round(v))):02x}' for v in rgb)


def lum(rgb):
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


# ---------- Reading a picture ----------


def load(path):
    """RGB (float) and the drawn mask at SIZE x SIZE. A picture with no transparency has its flat background removed."""
    im = Image.open(path).convert('RGBA')
    if im.width != im.height:
        print(f'  warning: {os.path.basename(path)} is not square ({im.width} x {im.height}): it is stretched to fit the frame')
    if im.width != SIZE or im.height != SIZE:
        im = im.resize((SIZE, SIZE), Image.LANCZOS)
    a = np.asarray(im).astype(float)
    rgb, alpha = a[..., :3], a[..., 3]
    if alpha.min() > 250:  # no transparency: the background is the flat color touching the edges
        corners = np.array([rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]])
        bg = np.median(corners, axis=0)
        near = np.linalg.norm(rgb - bg, axis=-1) < 38
        lab, _ = ndi.label(near)
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        alpha = np.where(np.isin(lab, list(edge)), 0, 255).astype(float)
        print(f'  note: {os.path.basename(path)} has no transparent background; the background color {hexc(bg)} was removed')
    mask = alpha > 127
    skin = np.linalg.norm(rgb - np.array([0xda, 0x96, 0x5e]), axis=-1) < 22
    if (skin & mask).sum() > 0.04 * max(1, mask.sum()):
        print(f'  warning: {os.path.basename(path)} seems to include the template head (skin color): hide the head before saving')
    return rgb, mask


def clean(mask, min_units):
    """Drops specks and pinholes smaller than min_units square units."""
    px = min_units * PX * PX
    for value in (True, False):  # specks of hair, then pinholes in it
        sel = mask if value else ~mask
        lab, n = ndi.label(sel)
        if n:
            small = np.bincount(lab.ravel()) < px
            small[0] = False
            mask = np.where(small[lab], not value, mask)
    return mask


# ---------- Curves ----------


def contours(field, level):
    """Closed contours of field at level, in 512-frame units (x, y)."""
    f = np.pad(field, 2, mode='constant', constant_values=field.min())
    out = []
    for c in measure.find_contours(f, level):
        c = measure.approximate_polygon(c, tolerance=1.1)
        if len(c) < 4:
            continue
        pts = np.stack([(c[:, 1] - 2) / PX, (c[:, 0] - 2) / PX], axis=1)
        if np.allclose(pts[0], pts[-1]):
            pts = pts[:-1]
        if len(pts) >= 3 and abs(polygon_area(pts)) >= MIN_AREA * 0.5:
            out.append(pts)
    return out


def polygon_area(p):
    x, y = p[:, 0], p[:, 1]
    return 0.5 * (np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


def smooth_d(pts):
    """A closed polygon as a smooth path: Catmull-Rom through its points, with sharp turns kept as points."""
    n = len(pts)
    prev, nxt = np.roll(pts, 1, axis=0), np.roll(pts, -1, axis=0)
    a, b = pts - prev, nxt - pts
    na, nb = np.linalg.norm(a, axis=1) + 1e-9, np.linalg.norm(b, axis=1) + 1e-9
    turn = np.degrees(np.arccos(np.clip((a * b).sum(1) / (na * nb), -1, 1)))
    corner = turn > CORNER_DEG
    tan = (nxt - prev) / 2
    t_out = np.where(corner[:, None], b * 0.5, tan)
    t_in = np.where(corner[:, None], a * 0.5, tan)
    f = lambda v: f'{v:.1f}'.rstrip('0').rstrip('.')
    d = [f'M{f(pts[0][0])} {f(pts[0][1])}']
    for i in range(n):
        j = (i + 1) % n
        c1 = pts[i] + t_out[i] / 3
        c2 = pts[j] - t_in[j] / 3
        d.append(f'C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(pts[j][0])} {f(pts[j][1])}')
    return ''.join(d) + 'Z'


def path_d(field, level):
    return ' '.join(smooth_d(c) for c in contours(field, level))


def soft(mask, sigma=2.0):
    return ndi.gaussian_filter(mask.astype(float), sigma)


# ---------- One picture -> paths ----------


def trace(path):
    rgb, mask = load(path)
    mask = clean(mask, MIN_AREA)
    if not mask.any():
        print(f'  warning: nothing drawn in {os.path.basename(path)}')
        return [], mask, {}
    smooth_rgb = ndi.median_filter(rgb, size=(5, 5, 1))
    L = lum(smooth_rgb)

    # Main color: hair is usually drawn in two or three tones (shadow, main, highlight), and the shadow can cover more
    # of it than the main tone does. So the tones are found as the peaks of the brightness histogram, and the main
    # color is the middle one of three (or the bigger of two, or the only one).
    lums = L[mask]
    cand = lums > 55
    if not cand.any():
        print('  warning: the hair is almost black: draw it in a medium color (the game dyes it), with a near-black outline')
        cand = np.ones_like(lums, bool)
    hist = ndi.gaussian_filter1d(np.bincount(np.clip(lums[cand], 0, 255).astype(int), minlength=256).astype(float), 3)
    peaks = [i for i in range(1, 255) if hist[i] >= hist[i - 1] and hist[i] > hist[i + 1]]
    total = hist.sum()
    tones = []
    for i in peaks:  # each peak's share: the pixels within 12 levels of it
        share = hist[max(0, i - 12):i + 13].sum() / total
        if share >= 0.1 and all(abs(i - j) > 18 for j, _ in tones):
            tones.append((i, share))
    tones.sort()
    pick = tones[len(tones) // 2][0] if len(tones) % 2 else max(tones, key=lambda t: t[1])[0] if tones else int(np.median(lums[cand]))
    near = cand & (np.abs(lums - pick) <= 10)
    main_rgb = smooth_rgb[mask][near].mean(axis=0)
    main_l = float(lum(main_rgb[None])[0])

    ink = mask & (L < min(70, main_l * 0.55))
    sdf = ndi.distance_transform_edt(mask) - ndi.distance_transform_edt(~mask)  # inside > 0, in pixels
    sdf = ndi.gaussian_filter(sdf, 1.5)
    ow = OUTLINE_W * PX
    as_field = lambda m, sigma=2.0: (soft(m, sigma) - 0.5) * 8  # a mask as a field: > 0 inside, roughly in pixels

    # Each part of the hair as a field (> 0 inside) and its color; the outline is an even band 6 units wide just
    # inside the silhouette, drawn last, as a filled shape (so the hair can be cut in two with no outline along the cut).
    parts = [('main', sdf, hexc(MAIN))]
    inner = sdf > ow * 0.85
    ratio = L / max(1, main_l)
    stats = {}
    for name, sel in (('shadow', (ratio < 0.8) & ~ink), ('highlight', ratio > 1.16)):
        m = ndi.binary_opening(sel & inner, structure=DISK3)
        m = clean(m, MIN_SHADE_AREA)
        if m.any():
            r = float(np.median(ratio[m]))
            parts.append((name, as_field(m), hexc(np.array(MAIN) * min(r, 2.2))))  # same hue as the main color, so it dyes
            stats[name] = int(m.sum() / PX / PX)
    # Ink drawn inside the hair (strand lines), and wisps too thin for the outline band to hold.
    lines = clean(ink & (sdf > ow * 0.9), 2)
    wisps = clean(mask & (sdf < ow * 0.5) & ~ndi.binary_dilation(sdf > ow * 0.5, iterations=int(ow * 0.6)), 2)
    extra = lines | wisps
    if extra.any():
        # Near-black lines stay the outline color; dark brown ones become a shade of the main color, so they dye.
        r = float(np.median(L[extra])) / max(1, main_l)
        parts.append(('ink', as_field(extra, 1.2), OUTLINE if np.median(L[extra]) < 35 else hexc(np.array(MAIN) * r)))
        stats['ink'] = int(extra.sum() / PX / PX)
    parts.append(('outline', np.minimum(sdf, ow - sdf), OUTLINE))
    stats['main'] = hexc(main_rgb)
    return parts, mask, stats


def emit(parts, region=None):
    """Paths for the parts, cut to a region (a field, > 0 inside) if given: (main fill, [the rest])."""
    out = []
    for name, field, color in parts:
        f = field if region is None else np.minimum(field, region)
        d = path_d(f, 0)
        if d:
            out.append((name, f'<path fill="{color}" fill-rule="evenodd" d="{d}"/>'))
    return [p for n, p in out if n == 'main'], [p for n, p in out if n != 'main']


def regions(mask):
    """Where hair is in front of the head and where behind, from the template head (fields, > 0 inside), and the head."""
    head = np.asarray(Image.open(TEMPLATE).convert('RGBA').resize((SIZE, SIZE)))[..., 3] > 127
    head = ndi.binary_fill_holes(head)
    inside = ndi.distance_transform_edt(head)
    y = np.arange(SIZE)[:, None] * np.ones((1, SIZE))
    split = EAR_Y * PX
    # In front: everything above the ears, and below them only locks that fall well inside the face (over a cheek or
    # an eye): whole pieces of hair, not slivers or the ends of strand lines.
    over = mask & (y >= split) & (inside > FACE_MARGIN * PX)
    lab, n = ndi.label(over)
    if n:
        big = np.bincount(lab.ravel()) >= MIN_LOCK * PX * PX
        big[0] = False
        over = ndi.binary_dilation(big[lab], iterations=int(4 * PX)) & mask
    front = np.maximum(split - y, (soft(over) - 0.5) * 8)
    # Behind: everything from just above the ears down (its top edge hides under the front hair), so the lengths beside
    # the jaw and neck go behind them: a wider jaw draws over them, rather than being covered by them.
    back = y - (split - 15 * PX)
    return front, back, head, y


def build(style, force=False):
    front = os.path.join(PNG_DIR, f'{style}.png')
    back = os.path.join(PNG_DIR, f'{style}_back.png')
    out = os.path.join(RAW, f'{style}.svg')
    newest = max(os.path.getmtime(p) for p in (front, back) if os.path.exists(p))
    if not force and os.path.exists(out) and os.path.getmtime(out) > newest:
        return None
    print(f'{style}:')
    fparts, fmask, fstats = trace(front)
    front_r, back_r, head, y = regions(fmask)
    base, details = emit(fparts, front_r)
    bmain, bdetails = emit(fparts, back_r)
    # Behind it all: hair filling the space the drawing encloses between the hair and the head, from the ears down to
    # the neck, so a narrower jaw or neck than the template's shows hair beside it, not a gap. No outline; the head
    # covers it wherever the head is.
    gap = ndi.binary_fill_holes(fmask | head) & (y > EAR_Y * PX) & (y < NECK_Y * PX)
    hair_sdf = ndi.distance_transform_edt(fmask)
    gap &= ~fmask | (hair_sdf > OUTLINE_W * PX * 1.5)  # never out to the hair's own edge, where it could peek past it
    filler = emit([('fill', (soft(gap) - 0.5) * 8, hexc(np.array(MAIN) * 0.72))])[1]
    bshapes = filler + bmain + bdetails
    bstats = {}
    if os.path.exists(back):
        bparts, _, bstats = trace(back)
        m, rest = emit(bparts)
        bshapes = m + rest + bshapes
    # Its length and texture (data-length: short/medium/long/updo; data-type: any, or a texture such as wavy, coily,
    # locs) are set by hand on the traced SVG's root once, and kept when it is traced again.
    tags = 'data-length="short"'
    if os.path.exists(out):
        import re
        old = open(out, encoding='utf-8').read(400)
        found = re.findall(r'data-(?:length|type|min-age)="[a-z0-9]+"', old)
        tags = ' '.join(found) or tags
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" data-from-png="1" {tags}>
<!-- Traced from assets/hair_png/{style}.png by scripts/trace_hair_png.py. Redraw the PNG and trace again, rather than editing this. -->
<g id="hair_back">{''.join(bshapes)}</g>
<g id="hair_base">{''.join(base)}</g>
<g id="hair_bangs"></g>
<g id="hair_lines">{''.join(details)}</g>
</svg>
'''
    os.makedirs(RAW, exist_ok=True)
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(svg)
    print(f'  front: {fstats}' + (f'\n  back: {bstats}' if bstats else ''))
    print(f'  -> assets/hair_raw/{style}.svg ({len(svg) // 1024} KB)')
    return style


def debug_page(styles):
    rel = lambda p: os.path.relpath(p, HERE).replace(os.sep, '/')
    head = rel(os.path.join(ROOT, 'assets', 'heads', 'dimple_oval.svg'))
    cards = []
    for s in styles:
        back = os.path.join(PNG_DIR, f'{s}_back.png')
        png = (f'<img src="{rel(back)}">' if os.path.exists(back) else '') + f'<img src="{rel(os.path.join(PNG_DIR, s + ".png"))}">'
        cards.append(f'''<figure><div class="pair">
<div class="box"><img class="head" src="{head}">{png}</div>
<div class="box svg"><img class="head" src="{head}"><img src="{rel(os.path.join(RAW, s + '.svg'))}"></div>
</div><figcaption>{s}: your PNG (left), the traced SVG (right)</figcaption></figure>''')
    html = f'''<!doctype html><meta charset="utf-8"><title>Traced hair</title>
<style>body{{font:14px sans-serif;background:#eef;margin:16px}} .pair{{display:flex;gap:12px}}
.box{{position:relative;width:420px;height:420px;background:#fff;border-radius:8px}} .box img{{position:absolute;inset:0;width:100%;height:100%}}
.box .head{{z-index:0}} .box img:not(.head){{z-index:1}} figure{{margin:0 0 24px}}</style>
<h1>Traced hair</h1><p>Each PNG next to the SVG traced from it, on the base head. (The back hair sits on top here; in the game it goes behind the head.)</p>
{''.join(cards)}'''
    with open(DEBUG_HTML, 'w', encoding='utf-8') as fh:
        fh.write(html)


def main(args):
    if not os.path.isdir(PNG_DIR):
        sys.exit('No assets/hair_png/ folder.')
    named = [a[:-4] if a.endswith('.png') else a for a in args]
    styles = named or sorted(f[:-4] for f in os.listdir(PNG_DIR)
                             if f.endswith('.png') and not f.startswith('TEMPLATE') and not f.endswith('_back.png'))
    done = [s for s in styles if build(s, force=bool(named))]
    if styles:
        debug_page(styles)
    print(f'traced {len(done)} hairstyle(s); {len(styles) - len(done)} already up to date. Check scripts/debug_hair_png.html, then run: npm run fit-hair')


if __name__ == '__main__':
    main(sys.argv[1:])

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

Front and back: hair next to the jaw and neck (below the ear lobes, above the shoulders) goes behind the head
(hair_back), so a wider jaw draws over it and a narrower one shows hair beside it, never a gap; everything else, the
ears' cover and lengths over the shoulders included, stays in front (a hidden fill behind the jaw and neck, out of sight on the template
head, sees to that). The outline is an even filled band, so cutting the hair in two leaves no line along the cut.

Every edge is a smooth curve (Catmull-Rom through a simplified contour, turned into Bezier curves), with sharp points
kept sharp, as on the tips of locks. Specks smaller than a few units are dropped.

Which hair is in front and which behind depends on each head's own jaw, ears and shoulders, so it is worked out on
every head: the head's outline is mapped back onto the base head (the inverse of the fitting warp), its ear lobes and
shoulders measured from it, and a version of the style written for it.

Writes assets/hair_raw/<style>.svg (marked data-from-png="1"; the base head's version) and
assets/hair_raw/heads/<style>/<head>.svg (each other head's), which `npm run fit-hair` then fits to each head, and
scripts/debug_hair_png.html: each picture next to its SVG, on the base head, to check by eye that nothing was lost.
A style whose SVG is newer than its PNG is skipped unless named on the command line.
"""
import json, os, sys, math

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    import numpy as np
    from PIL import Image
    from scipy import ndimage as ndi
    from skimage import measure
    import extract_landmarks as EL  # noqa: E402  (head outlines)
    import fit_hair as FH  # noqa: E402  (heads, landmarks and the warp between them)
except ImportError as err:
    sys.exit(f'{err}\nInstall the pipeline\'s Python packages first:  pip install -r scripts/requirements.txt')

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PNG_DIR = os.path.join(ROOT, 'assets', 'hair_png')
RAW = os.path.join(ROOT, 'assets', 'hair_raw')
DEBUG_HTML = os.path.join(HERE, 'debug_hair_png.html')
TEMPLATE = os.path.join(PNG_DIR, 'TEMPLATE_base_head.png')
LANDMARKS = os.path.join(ROOT, 'assets', 'landmarks.json')
BASE_EAR_Y = 0.0     # where the ears join the head the style was drawn on, and their x: set by drawn_on()
EAR_X = (0.0, 0.0)
EAR_PAD = 7          # hair over an ear reaches this far past it, so no edge of the ear peeks out
GAP_REACH = 48       # the fill behind the jaw and neck reaches this far from hair drawn beside them
SIDES_ABOVE_EAR = 14  # data-sides="behind": from this far above the tops of the ears down
EDGE_START = 4       # that outline starts this far below the top of the shoulders, clear of the neck's own line
NECK_PAD = 0         # the neck band reaches this far past the neck's outline
LOCK_MAX_Y = 400     # ... and on the face (down to about the mouth): hair over the neck always goes behind it
MIN_LOCK = 150       # a piece of hair over the face below the ears must be this big (square units) to stay in front
TEMPLE_FRONT = 20    # hair over the face this far below the tops of the ears stays in front (every head is the same there)
WIDER_MIN = 10       # a cheek or jaw this much wider (units) than the drawn-on head's has the hair fall in front of it
FACE_MARGIN = 12     # below the ears, hair stays in front of the face only this far inside the head's outline

SIZE = 2048                 # pictures are worked on at this size: 4 pixels to one unit of the 512 frame
PX = SIZE / 512
MAIN = (0x8f, 0x4b, 0x29)   # the color the game dyes
OUTLINE = '#23140f'
OUTLINE_W = 6
MIN_AREA = 6                # specks smaller than this (square units) are dropped
MIN_INK = 5          # ink fragments (strand lines) smaller than this are dropped
MIN_SHADE_AREA = 14         # shadow and highlight shapes smaller than this too
DISK = lambda r: np.add.outer(np.arange(-r, r + 1) ** 2, np.arange(-r, r + 1) ** 2) <= r * r
DISK3, DISK5 = DISK(3), DISK(5)
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

    # Ink: dark enough, and joined to some truly dark ink (hysteresis), so a deep shadow tone that is nearly as dark as
    # the lines does not break up into specks of ink.
    # Measured on a slightly smoothed brightness, and thinner bits than a drawn line (grain) dropped first.
    Ls = ndi.gaussian_filter(L, 1.5)
    weak = ndi.binary_opening(mask & (Ls < min(70, main_l * 0.55)), structure=DISK(2))
    lab, n = ndi.label(weak)
    if n:
        strong = np.zeros(n + 1, bool)
        strong[np.unique(lab[weak & (Ls < min(45, main_l * 0.38))])] = True
        strong[0] = False
        weak = strong[lab]
    ink = weak
    sdf = ndi.distance_transform_edt(mask) - ndi.distance_transform_edt(~mask)  # inside > 0, in pixels
    sdf = ndi.gaussian_filter(sdf, 1.5)
    ow = OUTLINE_W * PX
    as_field = lambda m, sigma=2.0: (soft(m, sigma) - 0.5) * 8  # a mask as a field: > 0 inside, roughly in pixels

    # Each part of the hair as a field (> 0 inside) and its color; the outline is an even band 6 units wide just
    # inside the silhouette, drawn last, as a filled shape (so the hair can be cut in two with no outline along the cut).
    parts = [('main', sdf, hexc(MAIN))]
    inner = sdf > ow * 0.85
    # Tones are told apart on a smoothed brightness, so grain or texture in the picture does not flicker across the
    # line between two tones and leave specks.
    ratio = ndi.gaussian_filter(L, 3) / max(1, main_l)
    stats = {}
    for name, sel in (('shadow', (ratio < 0.8) & ~ink), ('highlight', ratio > 1.16)):
        m = ndi.binary_closing(ndi.binary_opening(sel & inner, structure=DISK5), structure=DISK3)
        m = clean(m, MIN_SHADE_AREA)
        if m.any():
            r = float(np.median(ratio[m]))
            parts.append((name, as_field(m), hexc(np.array(MAIN) * min(r, 2.2))))  # same hue as the main color, so it dyes
            stats[name] = int(m.sum() / PX / PX)
    # Ink drawn inside the hair (strand lines), and wisps too thin for the outline band to hold.
    lines = clean(ink & (sdf > ow * 0.9), MIN_INK)
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


def head_in_base(polys, warp=None):
    """A head's silhouette in the base head's frame (its outline mapped by `warp`, if given), as a mask at SIZE, with
    the bottom of its ear lobes and the top of its shoulders (in units), measured from the silhouette's row widths."""
    if warp is not None:
        polys = [[tuple(p) for p in warp(np.array(poly, float))] for poly in polys if len(poly) >= 3]
    rows = EL.scan(polys)
    mask = np.zeros((SIZE, SIZE), bool)
    for yy, (x0, x1) in rows.items():
        r0, r1 = int(yy * PX), int((yy + EL.STEP) * PX) + 1
        mask[max(0, r0):min(SIZE, r1), max(0, int(x0 * PX)):min(SIZE, int(x1 * PX) + 1)] = True
    width = lambda y: (lambda r: r[1] - r[0] if r else 0)(rows.get(round(y / EL.STEP) * EL.STEP))
    ear = BASE_EAR_Y + 15
    lobe = next((y for y in np.arange(ear, ear + 140, EL.STEP) if width(y) < width(ear) - 30), BASE_EAR_Y + 74)
    span = np.arange(lobe, lobe + 160, EL.STEP)
    neck_y = min(span, key=width)
    shoulder = next((y for y in np.arange(neck_y, 512, EL.STEP) if width(y) > width(neck_y) + 20), neck_y + 30)
    return mask, float(lobe), float(shoulder), float(neck_y)


_BASE_INSIDE = []


def drawn_on(name):
    """Measures from the head a style was drawn on (the base head when it was drawn, kept on its traced SVG)."""
    global BASE_EAR_Y, EAR_X
    marks = json.load(open(LANDMARKS))[name]
    BASE_EAR_Y = marks['ear_left']['y']
    EAR_X = (marks['ear_left']['x'], marks['ear_right']['x'])
    head = head_in_base(EL.head_polys(os.path.join(FH.HEADS, f'{name}.svg')))[0]
    _BASE_INSIDE[:] = [ndi.distance_transform_edt(head)]


def base_inside():
    """Distance inside the head the style was drawn on, in pixels."""
    return _BASE_INSIDE[0]


def regions(mask, head, lobe_y, shoulder_y, neck_y, sides='front', drawn=None):
    """Where hair is in front of a head and where behind it (fields, > 0 inside), in the base head's frame.

    Behind: only the hair next to the jaw and neck, below the ear lobes and above the shoulders, so the jaw draws over
    it (and a narrow one shows hair beside it, not a gap). Everything else stays in front: hair over the ears covers
    them whole, and lengths that reach the shoulders fall in front of them."""
    y = np.arange(SIZE)[:, None] * np.ones((1, SIZE))
    x = np.ones((SIZE, 1)) * np.arange(SIZE)[None, :]
    # On a head wider than the one the style was drawn on (a rounder cheek or jaw), hair goes behind only where it is
    # inside the drawn-on head too: where it falls over the extra cheek it stays in front of it, with an outline, as
    # hair framing a round face does, instead of being hidden behind the cheek and only its tips poking out past it.
    own = head
    wider = None
    if drawn is not None:
        # Only where it is clearly wider: a sliver (a jaw a few units wider) still takes the hair behind it.
        wider = ndi.binary_opening(head & ~drawn, iterations=int(WIDER_MIN / 2 * PX))
        head = head & ~wider
    inside = ndi.distance_transform_edt(head)
    # The neck: the head's columns where its neck is narrowest, carried straight down (with its outline, and a little
    # room). Hair there always goes behind, so the neck's outline shows all the way down to the shoulders.
    ncols = np.nonzero(head[min(SIZE - 1, int(neck_y * PX))])[0]
    nl, nr = (ncols.min(), ncols.max()) if ncols.size else (SIZE // 2, SIZE // 2)
    neck = (x > nl - NECK_PAD * PX) & (x < nr + NECK_PAD * PX) & (y > lobe_y * PX)
    # The shoulders: the head below the top of the shoulders, outside the neck. Hair over them stays in front.
    shoulders = head & (y > shoulder_y * PX) & ~neck
    # Below the ear lobes, hair over the jaw and neck goes behind them, cut along the head's own outline (which the head
    # draws, so the cut never shows); hair beside the head, and over the shoulders, stays in front.
    behind = (y > (lobe_y + 12) * PX) & head & ((y < shoulder_y * PX) | neck)
    # From the ears down, the face itself too (not the ears), so the cheek and jaw line runs unbroken up to the ear.
    # Beside the ears the face's edge is taken as running straight from the temples (just above them) to just below
    # the lobes; what sticks out past it there is ear, and hair over an ear stays in front of it.
    def edges(r):
        c = np.nonzero(head[min(SIZE - 1, max(0, r))])[0]
        return (c.min(), c.max()) if c.size else (SIZE // 2, SIZE // 2)
    r0, r1 = int((BASE_EAR_Y - 12) * PX), int((lobe_y + 14) * PX)
    (l0, rr0), (l1, rr1) = edges(r0), edges(r1)
    t = np.clip((y - r0) / max(1, r1 - r0), 0, 1)
    in_rows = (y >= r0) & (y <= r1)
    left = np.where(in_rows, l0 + (l1 - l0) * t, -1)
    right = np.where(in_rows, rr0 + (rr1 - rr0) * t, SIZE)
    face = head & (x > left) & (x < right) & (y > BASE_EAR_Y * PX) & (y < shoulder_y * PX) & ~shoulders
    ears = head & in_rows & ~((x > left) & (x < right))
    face &= ~ndi.binary_dilation(ears, iterations=int(EAR_PAD * PX))  # hair over an ear covers all of it, lobe included
    # Just below the tops of the ears every adult head is still the same (the shared skull), so hair drawn over the
    # temple there stays in front, as drawn, instead of being cut off in a step where the face's own region begins.
    face &= ~(mask & (y < (BASE_EAR_Y + TEMPLE_FRONT) * PX))
    behind |= face
    # A style marked data-sides="behind": all of it below the tops of the ears that overlaps the head (but not the
    # shoulders) goes behind the head, so the side lengths show only where they reach past each face's own cheek and
    # jaw, and long hair still falls in front of the shoulders. Every adult head has the same skull and ears
    # (scripts/share_adult_skull.mjs), so this is what fits one drawing to every face shape.
    # data-sides="jaw" (a bun or knot at the nape drawn beside the jaw): nothing below the ears is kept in front as a lock
    # over the face, so it goes behind the jaw and peeks out past it.
    if sides == 'behind':
        behind |= head & (y > (BASE_EAR_Y - SIDES_ABOVE_EAR) * PX) & ~shoulders
    # Locks drawn well over the face (not the neck) stay in front: whole pieces of hair, not slivers or the ends of strand lines.
    # Judged on the base head the hair was drawn on, so hair drawn beside a jaw is not taken for a lock on a wider one.
    over = mask & behind & (base_inside() > FACE_MARGIN * PX) & (y < LOCK_MAX_Y * PX) & (sides == 'front')  # the face, not the neck
    lab, n = ndi.label(over)
    if n:
        big = np.bincount(lab.ravel()) >= MIN_LOCK * PX * PX
        big[0] = False
        behind &= ~ndi.binary_dilation(big[lab], iterations=int(4 * PX))
    front = -(soft(behind, 3) - 0.5) * 8
    back = (soft(ndi.binary_dilation(behind, iterations=int(10 * PX)), 3) - 0.5) * 8  # reaches under the front hair
    # Behind it all: hair filling the space the drawing encloses between the hair and the head, from the ears down to
    # the neck, so a jaw or neck narrower than the hair's shows hair beside it, not a gap. It stops short of the hair's
    # own edge, where it could peek out, and the head covers the rest of it.
    gap = ndi.binary_fill_holes(mask | head) & (y > BASE_EAR_Y * PX) & (y < (shoulder_y + 14) * PX)
    gap &= ~mask | (ndi.distance_transform_edt(mask) > OUTLINE_W * PX * 1.5)
    gap &= ndi.distance_transform_edt(~mask) < GAP_REACH * PX  # only near hair that hangs there (none for short styles)
    gap &= ~(head & (y > shoulder_y * PX))
    # Where hair in front of the shoulders stops at the neck, it gets an outline, like the rest of its edge.
    edge = mask & (behind < 0.5) & (ndi.distance_transform_edt(~neck) < OUTLINE_W * PX) & (y > (shoulder_y + EDGE_START) * PX)
    edge &= ndi.distance_transform_edt(mask) > 0
    if wider is not None and wider.any():
        # Where the front hair stops over the extra cheek, it gets an outline (elsewhere the face's own outline hides it).
        cut = mask & (behind < 0.5) & (ndi.distance_transform_edt(behind < 0.5) < OUTLINE_W * PX)
        edge |= cut & ndi.binary_dilation(wider, iterations=int(OUTLINE_W * PX)) & own
    return front, back, gap, edge


def hair_svg(style, tags, fparts, fmask, head, lobe_y, shoulder_y, neck_y, extra_back, head_name, drawn=None):
    front_r, back_r, gap, edge = regions(fmask, head, lobe_y, shoulder_y, neck_y,
                                         'behind' if 'data-sides="behind"' in tags else 'jaw' if 'data-sides="jaw"' in tags else 'front',
                                         drawn)
    base, details = emit(fparts, front_r)
    if edge.any():
        details += emit([('edge', np.minimum((soft(edge, 1.5) - 0.5) * 8, front_r), OUTLINE)])[1]
    bmain, bdetails = emit(fparts, back_r)
    filler = emit([('fill', (soft(gap) - 0.5) * 8, hexc(np.array(MAIN) * 0.72))])[1] if gap.any() else []
    which = f' Front and back as they fall on the {head_name} head.' if head_name else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" data-from-png="1" {tags}>
<!-- Traced from assets/hair_png/{style}.png by scripts/trace_hair_png.py.{which} Redraw the PNG and trace again, rather than editing this. -->
<g id="hair_back">{''.join(extra_back + filler + bmain + bdetails)}</g>
<g id="hair_base">{''.join(base)}</g>
<g id="hair_bangs"></g>
<g id="hair_lines">{''.join(details)}</g>
</svg>
'''


def jaw_shift(drawn, target, drawn_lobe, target_lobe):
    """How far to move hair in at each row (pixels, left side and right side), so the lengths beside the jaw keep the
    distance from it they were drawn with, on a head whose jaw is narrower (or wider) than the one it was drawn on.

    The fitting warp only knows the crown, forehead, temples and ears, so below the ears hair keeps the width of the
    jaw it was drawn beside. Each row from just below the ear lobes down to the corner of the jaw it was drawn on
    compares the two heads' edges (both in the drawing's frame); the most it comes to so far is used, and held below
    the corner, so the lengths hang straight down from the jaw as they were drawn (rather than following a narrow
    chin in)."""
    def edges(mask):
        l = np.full(SIZE, np.nan); r = np.full(SIZE, np.nan)
        any_ = mask.any(axis=1)
        l[any_] = mask[any_].argmax(axis=1)
        r[any_] = SIZE - 1 - mask[any_][:, ::-1].argmax(axis=1)
        return l, r
    (dl, dr), (tl, tr) = edges(drawn), edges(target)
    y0 = int((max(drawn_lobe, target_lobe) + 8) * PX)
    w = (dr - dl)[y0:y0 + int(120 * PX)]
    widest = np.nanmax(w)
    narrowing = np.nonzero((w < widest - 10 * PX) & (np.arange(w.size) > np.nanargmax(w)))[0]
    corner = y0 + (narrowing.min() if narrowing.size else w.size - 1)  # where the drawn-on jaw turns in to the chin
    rows = np.arange(SIZE)
    out = []
    for diff in (tl - dl, dr - tr):
        d = np.zeros(SIZE)
        seg = np.nan_to_num(diff[y0:corner + 1])
        d[y0:corner + 1] = np.maximum.accumulate(np.clip(seg, -25 * PX, 40 * PX)) if seg.size else 0
        d[corner + 1:] = d[corner] if corner < SIZE else 0
        ramp = np.clip((rows - (y0 - 28 * PX)) / (28 * PX), 0, 1)  # eased in from above the lobes
        d = np.where(rows < y0, (d[y0] if y0 < SIZE else 0) * ramp, d)
        out.append(np.clip(ndi.gaussian_filter1d(d, 6 * PX), -25 * PX, 40 * PX))
    return out[0], out[1]


def widen_shift(drawn, target):
    """How far to move hair OUT at each row (pixels, left side and right side) on a head whose cheeks or jaw are wider
    than the one it was drawn on, so the hair keeps the same distance from that face it was drawn with.

    From the ears down, each row compares the two heads' edges; the most the target is wider so far is used and held
    below, so the whole side of the hair moves out together (keeping its shape) rather than bending around the cheek."""
    def edges(mask):
        l = np.full(SIZE, np.nan); r = np.full(SIZE, np.nan)
        any_ = mask.any(axis=1)
        l[any_] = mask[any_].argmax(axis=1)
        r[any_] = SIZE - 1 - mask[any_][:, ::-1].argmax(axis=1)
        return l, r
    (dl, dr), (tl, tr) = edges(drawn), edges(target)
    y0 = int(BASE_EAR_Y * PX)
    out = []
    for diff in (dl - tl, tr - dr):  # > 0 where the target reaches further out
        d = np.zeros(SIZE)
        seg = np.clip(np.nan_to_num(diff[y0:]), 0, 40 * PX)
        d[y0:] = np.maximum.accumulate(seg)
        out.append(ndi.gaussian_filter1d(d, 6 * PX))
    return out[0], out[1]


def squeeze(field, left, right):
    """Moves a field's left half right by `left` px and its right half left by `right` px, row by row."""
    if not (left.any() or right.any()):
        return field
    y, x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    side = 1 / (1 + np.exp(-(x - SIZE / 2) / (10 * PX)))  # 0 on the left, 1 on the right, eased across the middle
    shift = left[:, None] * (1 - side) - right[:, None] * side
    out = ndi.map_coordinates(field.astype(np.float32), [y, x - shift], order=1, mode='nearest')
    return out if field.dtype != bool else out > 0.5


def cover_crown(parts, mask, head):
    """Fills any scalp left showing above the hair's top edge (hair drawn a little low on the skull) with hair, so no
    bald band shows over the crown on any head: in each column the hair reaches, the head above the topmost hair."""
    cols = mask.any(axis=0)
    top = np.where(cols, mask.argmax(axis=0), SIZE)
    rows = np.arange(SIZE)[:, None]
    crown = head & (rows < top[None, :]) & cols[None, :] & (rows < BASE_EAR_Y * PX)
    crown = ndi.binary_dilation(crown, iterations=int(OUTLINE_W * PX))  # reaches over the head's own outline too
    crown &= ~mask
    if crown.sum() < MIN_AREA * PX * PX:
        return parts, mask
    print(f'  covered {int(crown.sum() / PX / PX)} square units of scalp left showing above the hair')
    # The fill and the drawn hair are blended as one smooth shape (a smooth union of their distance fields), so where
    # the fill runs out against hair that already sits higher there is a gentle curve, not a step.
    sd = lambda m: ndi.distance_transform_edt(m) - ndi.distance_transform_edt(~m)
    zone = (rows < BASE_EAR_Y * PX) & cols[None, :]
    hs = sd(mask)
    cap = head & (rows < top[None, :]) & zone  # the head above the hair's top edge only, never the face
    ds = sd(cap) + OUTLINE_W * PX
    k = 14 * PX
    h = np.clip(0.5 + 0.5 * (hs - ds) / k, 0, 1)
    new = (ds * (1 - h) + hs * h + k * h * (1 - h)) > 0
    new |= mask
    near = ndi.binary_dilation(crown, iterations=int(8 * PX))
    sdf = ndi.gaussian_filter(ndi.distance_transform_edt(new) - ndi.distance_transform_edt(~new), 1.5)
    ow = OUTLINE_W * PX
    out = []
    for n, f, c in parts:
        if n == 'main':
            f = sdf
        elif n == 'outline':
            f = np.minimum(sdf, ow - sdf)
        elif n == 'ink':  # the drawing's old top edge, now just inside the new one, must not poke through it
            f = np.where(near, np.minimum(f, sdf - ow * 0.9), f)
        out.append((n, f, c))
    return out, new


def build(style, force=False):
    front = os.path.join(PNG_DIR, f'{style}.png')
    back = os.path.join(PNG_DIR, f'{style}_back.png')
    out = os.path.join(RAW, f'{style}.svg')
    # A style may also be drawn separately for any face (assets/hair_png/heads/<style>/<head>.png, on that face's own
    # template in assets/hair_templates/faces/): that face then wears its own drawing as drawn, not one fitted to it.
    own_dir = os.path.join(PNG_DIR, 'heads', style)
    owns = {f[:-4]: os.path.join(own_dir, f) for f in sorted(os.listdir(own_dir)) if f.endswith('.png')} if os.path.isdir(own_dir) else {}
    newest = max(os.path.getmtime(p) for p in (front, back, *owns.values()) if os.path.exists(p))
    if not force and os.path.exists(out) and os.path.getmtime(out) > newest:
        return None
    print(f'{style}:')
    fparts, fmask, fstats = trace(front)
    bparts, bstats = [], {}
    if os.path.exists(back):
        bparts, _, bstats = trace(back)
    # Its length, texture and minimum age (data-length: short/medium/long/updo; data-type: any, or a texture such as
    # wavy, coily, locs; data-min-age) are set by hand on the traced SVG's root once, and kept when traced again.
    tags = 'data-length="short"'
    if os.path.exists(out):
        import re
        head400 = open(out, encoding='utf-8').read(600)
        found = re.findall(r'data-(?:length|type|min-age|drawn-on|elder|elder-ok|gender|sides|crown)="[a-z0-9_]+"', head400)
        found += re.findall(r'data-name="[^"<>]*"', head400)  # its name in the game, kept as written (spaces, capitals)
        tags = ' '.join(found) or tags
    # The head it was drawn on: kept from an earlier trace, or the base head now (a new style is drawn on the template).
    import re
    m = re.search(r'data-drawn-on="([a-z0-9_]+)"', tags)
    on = m.group(1) if m else json.load(open(LANDMARKS))['base_head']
    if not m:
        tags += f' data-drawn-on="{on}"'
    drawn_on(on)
    # Which hair goes in front of the head and which behind depends on the head's own jaw, ears and shoulders, so it
    # is worked out on each head (its outline mapped back onto the base head), and fit_hair.py fits each head's own
    # version (assets/hair_raw/heads/<style>/<head>.svg). The version for the head it was drawn on is assets/hair_raw/<style>.svg.
    _, heads, _ = FH.load_heads()
    base_name = on
    per = os.path.join(RAW, 'heads', style)
    os.makedirs(per, exist_ok=True)
    for f in os.listdir(per):
        os.remove(os.path.join(per, f))
    drawn_head, drawn_lobe = head_in_base(EL.head_polys(os.path.join(FH.HEADS, f'{base_name}.svg')))[:2]
    if 'data-crown="bare"' not in tags:  # a balding style (data-crown="bare") keeps its bare crown
        fparts, fmask = cover_crown(fparts, fmask, drawn_head)
    for name, marks in heads.items():
        polys = EL.head_polys(os.path.join(FH.HEADS, f'{name}.svg'))
        warp = None if name == base_name else FH.warp_for(marks, heads[base_name])
        head, lobe_y, shoulder_y, neck_y = head_in_base(polys, warp)
        # On a narrower (or wider) jaw than the one it was drawn beside, the lengths are brought in (or out) to it.
        # Only ever in: on a wider jaw the hair stays where it was drawn and falls in front of the extra cheek (regions()).
        if name in owns and name != base_name:
            # Drawn for this face: traced as it is, on this face (every adult head shares the frame, so no fitting).
            oparts, omask, ostats = trace(owns[name])
            if 'data-crown="bare"' not in tags:
                oparts, omask = cover_crown(oparts, omask, head)
            bm, brest = emit(bparts) if bparts else ([], [])
            svg = hair_svg(style, tags, oparts, omask, head, lobe_y, shoulder_y, neck_y, bm + brest, name)
            print(f'  {name}: its own drawing, {ostats}')
        else:
            if name != base_name:
                # In on a narrower jaw, out on rounder cheeks or a wider jaw: the hair keeps the spacing it was drawn with.
                inl, inr = (np.maximum(d, 0) for d in jaw_shift(drawn_head, head, drawn_lobe, lobe_y))
                outl, outr = widen_shift(drawn_head, head)
                left, right = inl - outl, inr - outr
            else:
                left, right = np.zeros(SIZE), np.zeros(SIZE)
            hparts = [(n, squeeze(f, left, right), c) for n, f, c in fparts]
            hmask = squeeze(fmask, left, right)
            bm, brest = emit([(n, squeeze(f, left, right), c) for n, f, c in bparts]) if bparts else ([], [])
            svg = hair_svg(style, tags, hparts, hmask, head, lobe_y, shoulder_y, neck_y, bm + brest, None if name == base_name else name)
        with open(out if name == base_name else os.path.join(per, f'{name}.svg'), 'w', encoding='utf-8') as fh:
            fh.write(svg)
    print(f'  front: {fstats}' + (f'\n  back: {bstats}' if bstats else ''))
    print(f'  -> assets/hair_raw/{style}.svg, and a version for each of {len(heads) - 1} other heads in assets/hair_raw/heads/{style}/')
    return style


def debug_page(styles):
    rel = lambda p: os.path.relpath(p, HERE).replace(os.sep, '/')
    cards = []
    for s in styles:
        import re
        raw = os.path.join(RAW, f'{s}.svg')
        m = re.search(r'data-drawn-on="([a-z0-9_]+)"', open(raw, encoding='utf-8').read(400)) if os.path.exists(raw) else None
        head = rel(os.path.join(ROOT, 'assets', 'heads', f'{m.group(1) if m else json.load(open(LANDMARKS))["base_head"]}.svg'))
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

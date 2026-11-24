#!/usr/bin/env python3
"""
Turns eyes drawn as PNG pictures into the game's eye SVGs (step 2 of the eye pipeline).

    npm run trace-eyes          (or: python scripts/trace_eyes_png.py [names], then python scripts/build-avatar-manifest.py)

Needs numpy, scipy, scikit-image and Pillow (pip install -r scripts/requirements.txt).

Draw a pair of eyes over assets/eyes_png/TEMPLATE_eyes.png (the base head at 2048 x 2048, with faint guide eyes), hide
the head, and save the eyes alone on a transparent background in assets/eyes_png/women/<name>.png or
assets/eyes_png/men/<name>.png (see assets/eyes_png/README.md). Women's eyes become eyes_f_<name>, men's eyes_m_<name>:
a woman is never drawn with men's eyes or a man with women's (eyesFor in js/avatar/catalog.js).

Every eye pair in the game is drawn once, in one template frame, and the game moves and scales each eye onto each
head, every face shape and age (fitTransforms in js/CharacterAvatar.js). So the picture is not fitted to each head
here: each eye is moved from where it sits on the base head back into that frame (assets/eyes_png/eye_frame.json,
written by scripts/make_eye_template.mjs), and the game does the rest.

What an eye is made of, read from the picture:
  white       the white of the eye (very light, not colored), var(--eye-white)
  iris        the colored part, which becomes the person's own eye color, var(--eye-color); darker parts of it
              (a ring, a shadow under the lid) one darker shade of it
  ink         outlines, lashes, lids, liner and the pupil: near-black, in the eyes' ink, which the game gives more
              weight on deep skin (the --line-ink / --line-width hooks)
  shine       small white spots inside the iris or pupil, pure white
Edges are smooth curves (the hair tracer's), specks are dropped.

Writes assets/avatars/eyes/eyes_<f|m>_<name>.svg, then run python3 scripts/build-avatar-manifest.py (npm run trace-eyes
does both), and scripts/debug_eyes_png.html: each picture next to the eyes drawn from it, on the base head.
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    import numpy as np
    from scipy import ndimage as ndi
    import trace_hair_png as H  # noqa: E402  (reading pictures, and smooth curves)
except ImportError as err:
    sys.exit(f'{err}\nInstall the pipeline\'s Python packages first:  pip install -r scripts/requirements.txt')

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PNG_DIR = os.path.join(ROOT, 'assets', 'eyes_png')
OUT = os.path.join(ROOT, 'assets', 'avatars', 'eyes')
FRAME = os.path.join(PNG_DIR, 'eye_frame.json')
DEBUG_HTML = os.path.join(HERE, 'debug_eyes_png.html')
GROUPS = {'women': 'f', 'men': 'm'}
PX, SIZE = H.PX, H.SIZE
INK = 'fill:#2d180e;stroke:var(--line-ink,currentColor);stroke-width:var(--line-width,0);stroke-linejoin:round'


def lum(rgb):
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def parts_of(path):
    """The picture's white, iris, iris shade, ink and shine, as masks at SIZE x SIZE."""
    rgb, mask = H.load(path)
    mask = H.clean(mask, 1)
    rgb = ndi.median_filter(rgb, size=(3, 3, 1))
    L = lum(rgb)
    sat = (rgb.max(axis=-1) - rgb.min(axis=-1)) / np.maximum(1, rgb.max(axis=-1))
    ink = mask & (L < 70)
    light = mask & (L > 200) & (sat < 0.18)
    iris = mask & ~ink & ~light
    # Shine: light spots small next to the white of their eye, and set in iris or pupil rather than against the outline.
    lab, n = ndi.label(light)
    white, shine = np.zeros_like(light), np.zeros_like(light)
    sizes = np.bincount(lab.ravel())
    for side in (lab[:, :SIZE // 2], lab[:, SIZE // 2:]):
        ids = [i for i in np.unique(side) if i]
        biggest = max((sizes[i] for i in ids), default=0)
        for i in ids:
            blob = lab == i
            ring = ndi.binary_dilation(blob, iterations=int(2 * PX)) & ~blob
            in_iris = (ring & (iris | ink)).sum() / max(1, ring.sum())
            near_iris = (ring & iris).sum() / max(1, ring.sum())
            (shine if sizes[i] < 0.3 * biggest and in_iris > 0.85 and near_iris > 0.15 else white)[blob] = True
    shade = np.zeros_like(iris)
    if iris.any():
        main = np.median(L[iris])
        shade = H.clean(ndi.binary_opening(iris & (ndi.gaussian_filter(L, 2) < main * 0.78), structure=H.DISK(2)), 3)
    return {'white': H.clean(white, 2), 'iris': H.clean(iris, 2), 'shade': shade, 'ink': H.clean(ink, 1), 'shine': H.clean(shine, 0.5)}


def to_template(d, frame):
    """A path's points, from the base head into the template frame, each closed shape by the eye it belongs to."""
    import re
    out = []
    for sub in re.findall(r'M[^M]+', d):
        nums = [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?', sub)]
        xs = nums[0::2]
        side = -1 if sum(xs) / len(xs) < frame['x'] else 1
        f = lambda v: f'{v:.1f}'.rstrip('0').rstrip('.')
        pts = iter(nums)
        def conv(match):
            x, y = float(match.group(1)), float(match.group(2))
            tx = (x - frame['x']) / frame['scale'] + 256 - side * frame['apart']
            ty = (y - frame['y']) / frame['scale'] + frame['anchorY']
            return f'{f(tx)} {f(ty)}'
        out.append(re.sub(r'(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)', conv, sub))
    return ' '.join(out)


def build(group, name, frame):
    path = os.path.join(PNG_DIR, group, f'{name}.png')
    print(f'{group}/{name}:')
    masks = parts_of(path)
    style = {
        'white': 'fill:var(--eye-white,#ffffff)',
        'iris': 'fill:var(--eye-color,#6b4a2e)',
        'shade': 'fill:color-mix(in srgb,var(--eye-color,#6b4a2e) 70%,#000)',
        'ink': INK,
        'shine': 'fill:#ffffff',
    }
    paths = []
    for key in ('white', 'iris', 'shade', 'ink', 'shine'):
        m = masks[key]
        if not m.any():
            continue
        d = H.path_d(H.soft(m, 1.2), 0.5)
        if d:
            paths.append(f'<path style="{style[key]}" fill-rule="evenodd" d="{to_template(d, frame)}"/>')
        print(f'  {key}: {int(m.sum() / PX / PX)} square units')
    if not masks['white'].any() or not masks['ink'].any():
        print('  warning: no white of the eye or no outline found: is it drawn on a transparent (or white) background?')
    eid = f'eyes_{GROUPS[group]}_{name}'
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" data-pathways="1" data-lines="1" data-from-png="1" data-gender="{'female' if group == 'women' else 'male'}"><g id="art">
<!-- Traced from assets/eyes_png/{group}/{name}.png by scripts/trace_eyes_png.py. Redraw the picture and trace again, rather than editing this. -->
{chr(10).join(paths)}
</g></svg>
'''
    with open(os.path.join(OUT, f'{eid}.svg'), 'w', encoding='utf-8') as fh:
        fh.write(svg)
    print(f'  -> assets/avatars/eyes/{eid}.svg')
    return group, name, eid


def debug_page(done):
    rel = lambda p: os.path.relpath(p, HERE).replace(os.sep, '/')
    cards = ''.join(f'''<figure><div class="pair"><div class="box"><img src="{rel(os.path.join(PNG_DIR, 'TEMPLATE_eyes.png'))}"><img src="{rel(os.path.join(PNG_DIR, g, n + '.png'))}"></div>
<div class="box"><img src="{rel(os.path.join(OUT, e + '.svg'))}" style="transform:scale(2.5);transform-origin:50% 57%"></div></div><figcaption>{g}/{n} -> {e}: your picture (left), the eyes made from it in the template frame (right)</figcaption></figure>'''
                    for g, n, e in done)
    with open(DEBUG_HTML, 'w', encoding='utf-8') as fh:
        fh.write(f'''<!doctype html><meta charset="utf-8"><title>Traced eyes</title><style>body{{font:14px sans-serif;background:#eef;margin:16px}}
.pair{{display:flex;gap:12px}} .box{{position:relative;width:420px;height:420px;background:#fff;overflow:hidden;border-radius:8px}}
.box img{{position:absolute;inset:0;width:100%;height:100%}} .box img + img{{z-index:1}} figure{{margin:0 0 24px}}</style><h1>Traced eyes</h1>{cards}''')


def main(args):
    with open(FRAME, encoding='utf-8') as fh:
        frame = json.load(fh)
    todo = []
    for group in GROUPS:
        folder = os.path.join(PNG_DIR, group)
        if os.path.isdir(folder):
            todo += [(group, f[:-4]) for f in sorted(os.listdir(folder)) if f.endswith('.png')]
    if args:
        todo = [(g, n) for g, n in todo if n in args or f'{g}/{n}' in args]
    done = [build(g, n, frame) for g, n in todo]
    if done:
        debug_page(done)
    print(f'traced {len(done)} pair(s) of eyes. Next: python3 scripts/build-avatar-manifest.py, then check scripts/debug_eyes_png.html')


if __name__ == '__main__':
    main(sys.argv[1:])

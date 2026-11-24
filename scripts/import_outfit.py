#!/usr/bin/env python3
"""
Imports an outfit drawn on one of the game's heads: an image from an image model (PNG, drawn on the head template,
full canvas), or an SVG drawn in a head's own 512 frame (strokes and all). Run from the repository root:

    python3 scripts/import_outfit.py drawing.png outfit_55_zip_hoodie --head athletic
    python3 scripts/import_outfit.py polo.svg outfit_57_polo --head dimple_oval

What it does:
  1. Draws the outfit as an image: an SVG is rendered at 4x (strokes become shapes); a PNG's white background is
     removed by flood fill from the edges.
  2. Flattens it to its few main colours (an image model's soft edges and stray tints go), and traces it to vector
     shapes with vtracer (pip install vtracer).
  3. Moves it from that head's frame into the template frame the game places outfits in, at the size it was drawn
     (not stretched to the usual outfit width), and saves it as assets/avatars/clothes/<name>.svg, marked
     data-as-drawn="1".
  4. Records the head in assets/clothes_drawn_for.json, runs the avatar build (recolours it and lists it in the
     manifest) and scripts/fit-clothes.mjs (fits it to every other head's neck).
Then add it to an outfit list in js/avatar/curation.js so it can be worn. Needs Pillow, vtracer and Node with Playwright.
"""
import argparse, json, os, re, subprocess, sys, tempfile
from collections import Counter

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLOTHES = os.path.join(ROOT, 'assets', 'avatars', 'clothes')
DRAWN_FOR = os.path.join(ROOT, 'assets', 'clothes_drawn_for.json')
SIDE = 2048  # pixels the 512 frame is drawn at
EXTRA = 400  # pixels drawn below the frame, for an SVG that runs past its bottom edge


def manifest():
    text = open(os.path.join(ROOT, 'js', 'avatarManifest.js'), encoding='utf-8').read()
    heads = {}
    for line in text.splitlines():
        line = line.strip().rstrip(',')
        if line.startswith('{"id": "head_'):
            e = json.loads(line)
            heads[os.path.basename(e['file'])[:-4]] = e['fit']
    template = json.loads(re.search(r'export const AVATAR_TEMPLATE = (\{.*\});', text).group(1))
    return heads, template


def render_svg(path, out):
    """Draws the SVG's 512 frame (and EXTRA below it) at SIDE pixels wide, on a transparent background."""
    js = r"""
const { chromium } = require('playwright'); const fs = require('fs');
const [src, out, side, extra] = process.argv.slice(1);
(async () => {
  let svg = fs.readFileSync(src, 'utf8');
  const h = 512 * (1 + Number(extra) / Number(side));
  svg = svg.replace(/<svg\b[^>]*>/, (t) => t.replace(/\s(width|height|viewBox)="[^"]*"/g, '').replace('<svg', `<svg width="${side}" height="${Number(side) + Number(extra)}" viewBox="0 0 512 ${h}"`));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: Number(side), height: Number(side) + Number(extra) } });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await p.locator('svg').screenshot({ path: out, omitBackground: true });
  await b.close();
})();
"""
    subprocess.run(['node', '-e', js, path, out, str(SIDE), str(EXTRA)], check=True, cwd=ROOT)


def load(path):
    """-> (RGBA image, pixels per frame unit)."""
    if path.lower().endswith('.svg'):
        tmp = os.path.join(tempfile.mkdtemp(), 'render.png')
        render_svg(path, tmp)
        return Image.open(tmp).convert('RGBA'), SIDE / 512
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    # An image model's background: white (or a transparent one), filled from the edges so whites inside stay.
    for pt in [(0, 0), (w - 1, 0), (0, h // 2), (w - 1, h // 2), (w // 2, 0)]:
        if im.getpixel(pt)[3] > 0:
            ImageDraw.floodfill(im, pt, (255, 0, 255, 0), thresh=40)
    px = im.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] == (255, 0, 255, 0):
                px[x, y] = (0, 0, 0, 0)
    return im, w / 512


NUMS = r'(-?\d*\.?\d+) (-?\d*\.?\d+)'


def widen(paths, T):
    """An image model draws the garment hugging the body, and skin shows at the shoulders' outer edges. Stretches it
    sideways beyond the collar only (95 template units either side of the middle), so its outer edge reaches past every
    body's shoulders (the portrait scales each body's shoulders to T['shoulderW']). The neckline stays as drawn."""
    need, a = T['shoulderW'] / 2 + 12, 95
    reach = max(abs(float(m.group(1)) - 256) for p in paths for m in re.finditer(NUMS, p.split(' d="')[1]))
    if reach >= need or reach <= a:
        return paths, 1.0
    k = (need - a) / (reach - a)
    def f(m):
        u = float(m.group(1)) - 256
        if abs(u) > a:
            u = (1 if u > 0 else -1) * (a + (abs(u) - a) * k)
        return f'{256 + u:.1f} {m.group(2)}'
    return [p.split(' d="')[0] + ' d="' + re.sub(NUMS, f, p.split(' d="')[1]) for p in paths], k


def flatten(im, exact=False):
    """Each opaque pixel to the nearest of the drawing's main colours; soft edges and stray tints go."""
    px = list(im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata())
    # A rendered SVG's colours are exact: keep each, however small (buttons). An image model's drift: merge near ones.
    share, merge = (0.0003, 10) if exact else (0.004, 40)
    solid = [p for p in px if p[3] > 128]
    bins = Counter((p[0] // 8 * 8 + 4, p[1] // 8 * 8 + 4, p[2] // 8 * 8 + 4) for p in solid)
    palette = []
    for c, n in bins.most_common():
        if n < len(solid) * share:
            break
        if all(sum((a - b) ** 2 for a, b in zip(c, q)) > merge ** 2 for q in palette):
            palette.append(c)
    near = {}
    def nearest(p):
        k = p[:3]
        if k not in near:
            near[k] = min(palette, key=lambda q: sum((a - b) ** 2 for a, b in zip(k, q)))
        return near[k]
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.putdata([nearest(p) + (255,) if p[3] > 128 else (0, 0, 0, 0) for p in px])
    rgb = out.convert('RGB').filter(ImageFilter.ModeFilter(3 if exact else 5))
    return Image.merge('RGBA', (*rgb.split(), out.split()[3])), palette


def trace(im):
    import vtracer
    d = tempfile.mkdtemp()
    src, dst = os.path.join(d, 'flat.png'), os.path.join(d, 'traced.svg')
    im.save(src)
    vtracer.convert_image_to_svg_py(src, dst, colormode='color', hierarchical='stacked', mode='spline', filter_speckle=6, color_precision=8,
                                    layer_difference=8, corner_threshold=60, length_threshold=4.0, splice_threshold=45, path_precision=2)
    return open(dst, encoding='utf-8').read()


def to_template(traced, per_unit, fit, T):
    """vtracer's paths (pixels, each with a translate) -> paths in the template frame, absolute, no transforms."""
    body = max(0.8, min(1.06, fit['shoulderW'] / T['shoulderW']))
    def point(x, y):
        X, Y = x / per_unit, y / per_unit  # the head's own frame
        return 256 + (X - fit.get('bodyX', fit['cx'])) / body, T['clothesTop'] + (Y - fit.get('collar', fit['chin'] + 8)) / body
    paths = []
    for m in re.finditer(r'<path d="([^"]*)" fill="(#[0-9A-Fa-f]{6})"(?: transform="translate\(([-\d.]+),([-\d.]+)\)")?', traced):
        d, fill = m.group(1), m.group(2).lower()
        tx, ty = float(m.group(3) or 0), float(m.group(4) or 0)
        bad = set(re.findall(r'[A-Za-z]', d)) - set('MLCZ')
        if bad:
            raise SystemExit(f'unexpected path commands {bad} from vtracer')
        res = ''
        for part in re.split(r'([MLCZ])', d):
            if part in ('M', 'L', 'C', 'Z'):
                res += part
                continue
            vals = [float(n) for n in re.findall(r'-?\d*\.?\d+', part)]
            pts = [point(vals[i] + tx, vals[i + 1] + ty) for i in range(0, len(vals) - 1, 2)]
            res += ' '.join(f'{x:.1f} {y:.1f}' for x, y in pts)
        paths.append(f'<path fill="{fill}" d="{res}"/>')
    return paths


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('source')
    ap.add_argument('name', help='e.g. outfit_55_zip_hoodie')
    ap.add_argument('--head', default='athletic', help='the head it was drawn on (a file name in assets/heads/)')
    ap.add_argument('--open', action='store_true', help='a V-neck or scoop neck: widened for thicker necks, never drawn in')
    ap.add_argument('--no-build', action='store_true', help='only write the SVG')
    a = ap.parse_args()
    if not re.fullmatch(r'outfit_[a-z0-9_]+', a.name):
        raise SystemExit('the name must look like outfit_55_zip_hoodie')
    heads, T = manifest()
    if a.head not in heads:
        raise SystemExit(f'no head {a.head}: one of {", ".join(sorted(heads))}')
    im, per_unit = load(a.source)
    flat, palette = flatten(im, exact=a.source.lower().endswith('.svg'))
    paths = to_template(trace(flat), per_unit, heads[a.head], T)
    if not a.source.lower().endswith('.svg'):  # an SVG drawn on the body covers what it means to (a tank top does not)
        fit = heads[a.head]
        body = max(0.8, min(1.06, fit['shoulderW'] / T['shoulderW']))
        paths, k = widen(paths, T)
        if k > 1:
            print(f'widened outside the collar by x{k:.2f}, to reach past the shoulders')
        # The drawing stops at the bottom of the canvas, and some portraits show a little below that: its hem is
        # moved down, so the outfit runs past the bottom of every portrait.
        hem = T['clothesTop'] + (512 - fit.get('collar', fit['chin'] + 8)) / body
        def lower(m):
            y = float(m.group(2))
            return f'{m.group(1)} {y + 24 if y >= hem - 1.5 else y:.1f}'
        paths = [p.split(' d="')[0] + ' d="' + re.sub(NUMS, lower, p.split(' d="')[1]) for p in paths]
    out = os.path.join(CLOTHES, f'{a.name}.svg')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" data-as-drawn="1">{"".join(paths)}</svg>\n')
    print(f'{a.name}: {len(paths)} shapes in {len(palette)} colours, drawn on {a.head}')
    drawn = json.load(open(DRAWN_FOR, encoding='utf-8')) if os.path.exists(DRAWN_FOR) else {}
    drawn[a.name] = {'head': a.head, 'neckline': 'open'} if a.open else a.head
    with open(DRAWN_FOR, 'w', encoding='utf-8') as f:
        json.dump(drawn, f, indent=2)
        f.write('\n')
    if a.no_build:
        return
    subprocess.run([sys.executable, os.path.join(ROOT, 'scripts', 'build-avatar-manifest.py')], check=True, cwd=ROOT)
    subprocess.run(['node', os.path.join(ROOT, 'scripts', 'fit-clothes.mjs')], check=True, cwd=ROOT)


if __name__ == '__main__':
    main()

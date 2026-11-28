# Repaints a drawn kid eye's iris as one smooth shade (darker at the top), keeping the lid, a round black pupil and the
# highlights, so the whole iris takes the kid's eye color. Usage: fix_iris.py <in.png> <out.png> [pupil_ratio]
import sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
PR = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
im = Image.open(src).convert('RGBA'); px = im.load()
brown = lambda p: p[3] > 128 and p[0] > 90 and 40 < p[1] < 120 and p[2] < 85 and p[0] - p[2] > 45
dark = lambda p: p[3] > 128 and sum(p[:3]) < 260
lerp = lambda a, b, t: tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
TOP = (88, 53, 28); BOT = (132, 82, 42)
for (a, b) in ((380, 627), (627, 880)):
    pts = [(x, y) for x in range(a, b) for y in range(690, 860) if brown(px[x, y])]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    cx = (min(xs) + max(xs)) / 2; r = (max(xs) - min(xs)) / 2; cy = max(ys) - r
    pr = r * PR; pcy = cy + 3
    for x in range(int(cx - r), int(cx + r) + 1):
        top = next((y for y in range(int(cy - r) - 30, int(cy + r)) if dark(px[x, y])), None)
        if top is None: continue
        for y in range(top + 12, int(cy + r) + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 > r * r * 0.86: continue
            if (x - cx) ** 2 + (y - pcy) ** 2 <= pr * pr: continue
            p = px[x, y]
            if p[3] <= 128 or sum(p[:3]) > 520: continue
            t = max(0, min(1, (y - (cy - r * 0.6)) / (r * 1.5)))
            px[x, y] = (*lerp(TOP, BOT, t), 255)
    print('iris', round(cx, 1), round(cy, 1), 'r', r)
im.save(out)

# Snaps a drawn kid eye to its few flat colors (outline/pupil, iris, crescent, catchlight, white), so the trace makes no
# thin in-between slivers that read as lines. The palette is read from the drawing itself.
# Usage: snap_eye.py <in.png> <out.png>
import sys
from collections import Counter
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGBA'); px = im.load(); W, H = im.size
cols = Counter(px[x, y][:3] for x in range(W) for y in range(600, 900) if px[x, y][3] > 200)
def near(target):  # the most common drawn color close to a style color
    cand = [(c, n) for c, n in cols.items() if sum((c[i] - target[i]) ** 2 for i in range(3)) < 45 ** 2]
    return max(cand, key=lambda t: t[1])[0] if cand else target
PAL = [near(t) for t in [(35, 20, 15), (122, 74, 42), (176, 122, 74), (245, 227, 206), (255, 255, 255)]]
print('palette', PAL)
for y in range(H):
    for x in range(W):
        p = px[x, y]
        if p[3] < 30: continue
        c = min(PAL, key=lambda q: sum((q[i] - p[i]) ** 2 for i in range(3)))
        px[x, y] = (*c, 255 if p[3] > 127 else p[3])
im.save(sys.argv[2])

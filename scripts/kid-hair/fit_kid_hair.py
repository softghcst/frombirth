# Fits a kid hairstyle drawn on the kid template to the face, without moving its crown or its sides.
#  1. lift: the fringe over the forehead is raised by LIFT (squashed between the top of the hair and the hairline, so the
#     crown stays where it is), fully across the middle of the face and fading out toward the temples;
#  2. close: between the hair's sides and the head (a sideburn flaring off the temple, a gap above the ear), hair is
#     filled in, with the head's outline inked where it runs, so the hair hugs the head.
# Usage: fit_kid_hair.py <plain kid head template> <hair.png> <out.png> <lift>
import sys
from collections import deque, Counter
from PIL import Image
tpl, src, out, LIFT = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
T = Image.open(tpl).convert('RGBA'); S = Image.open(src).convert('RGBA')
W, H = S.size; tp = T.load(); sp = S.load()
CX = 627
def weight(x):  # 1 across the forehead, 0 beyond the temples
    d = abs(x - CX)
    if d <= 190: return 1.0
    if d >= 300: return 0.0
    t = (d - 190) / 110; return 1 - t * t * (3 - 2 * t)
O = Image.new('RGBA', (W, H), (0, 0, 0, 0)); op = O.load()
for x in range(W):
    col = [y for y in range(H) if sp[x, y][3] > 0]
    if not col: continue
    w = weight(x)
    if w == 0 or LIFT == 0:
        for y in col: op[x, y] = sp[x, y]
        continue
    solid = [y for y in range(H) if sp[x, y][3] > 128]
    # the top of the hair: the first solid pixel with solid hair below it (not a stray speck)
    top = next((y for y in solid if all(sp[x, y + i][3] > 128 for i in range(6) if y + i < H)), None)
    # the hairline: the lowest hair above the eyes in this column
    above = [y for y in solid if y < 705]
    if top is None or not above:
        for y in col: op[x, y] = sp[x, y]
        continue
    hl = above[-1] + 1
    span = max(1, hl - top); d = w * LIFT
    k = max(0.2, (span - d) / span)  # squash within [top, hl]
    for y2 in range(H):
        if y2 < top:
            continue
        if y2 <= top + span * k: sy = top + (y2 - top) / k
        else: sy = y2 + d
        sy = int(round(sy))
        if 0 <= sy < H and sp[x, sy][3] > 0: op[x, y2] = sp[x, sy]
# 2. close the gaps between the hair's sides and the head
op = O.load()
dark = lambda p: p[3] > 128 and sum(p[:3]) < 200
wall = set()
for (xa, ya, xb, yb) in ((364, 750, 371, 834), (890, 750, 883, 834)):
    for i in range(101):
        x = round(xa + (xb - xa) * i / 100); y = round(ya + (yb - ya) * i / 100)
        for dx in range(-3, 4): wall.add((x + dx, y))
face = set(); q = deque([(CX, 760)])
while q:
    x, y = q.popleft()
    if (x, y) in face or not (0 <= x < W and 0 <= y < H): continue
    p = tp[x, y]
    if p[3] < 128 or dark(p) or (x, y) in wall: continue
    face.add((x, y)); q.extend([(x+1, y), (x-1, y), (x, y+1), (x, y-1)])
cols = Counter(op[x, y][:3] for x in range(0, W, 3) for y in range(0, H, 3) if op[x, y][3] > 200)
ink = min(cols, key=sum); mid = max((c for c in cols if sum(c) > 150), key=cols.get)
n = 0
for y in range(560, 900):
    for side in (-1, 1):
        x = 0 if side < 0 else W - 1; step = -side
        while 0 <= x < W and op[x, y][3] < 128: x += step
        if not (0 <= x < W) or abs(x - CX) < 200: continue
        while 0 <= x < W and op[x, y][3] >= 128: x += step
        run = []
        while 0 <= x < W and op[x, y][3] < 128 and (x, y) not in face:
            run.append(x); x += step
        if not run or len(run) > 140 or (x, y) not in face: continue
        k = len(run)
        while k > 0 and dark(tp[run[k - 1], y]) and len(run) - k < 16: k -= 1
        if k == len(run): k = max(0, len(run) - 9)
        for i, rx in enumerate(run):
            op[rx, y] = (*ink, 255) if i >= k else (*mid, 255); n += 1
O.save(out); print('lifted', LIFT, '; closed', n, 'px')

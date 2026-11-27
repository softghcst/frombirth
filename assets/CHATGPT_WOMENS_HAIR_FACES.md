# Women's hairstyles that fit every face (ChatGPT)

What worked for Storybook Waves: draw each style **once on the athletic head**, with its side hair kept clear of the
widest jaw, so the same picture fits every face; then ask, in the same chat, for a **cherubic** version (the roundest
face, the only one that needed its own picture). Everything else is automatic (`scripts/trace_hair_png.py`).

Files to attach: `assets/hair_templates/faces/adult_head_athletic.png` (same as `adult_head_template.png`) and
`assets/hair_templates/faces/adult_head_cherubic.png`.

Save the pictures as `assets/hair_png/<style>.png` (athletic) and `assets/hair_png/heads/<style>/cherubic.png`, or send
them to Claude to trace, tag and check on all 7 faces.

## 1. First message (new chat, attach the athletic template)

````text
This image is a cartoon adult's bald head, ears, neck and shoulders, on a transparent background, from a 2D
life-simulation game. For each hairstyle I describe after this message, draw ONE hairstyle for this head, for a
woman. Reply to this first message only with: Ready.

Before sending each picture, check three things:
* Top and sides: the hair hugs the skull just outside its outline, with no bald outline peeking out and no flare
  away from the head (unless the style is meant to have volume).
* Forehead: the eyebrows are completely uncovered.
* Jaw: from the ears down, there is a clear gap between the hair and the face on both sides. No hair lies over the
  cheeks, jaw or chin, and nothing curls in under the jaw.

EXACT SIZE AND POSITION (the image is 1254 x 1254 pixels; x is from the left, y is from the top; the head is centered
on x = 626):
- Output a PNG exactly 1254 x 1254 pixels, fully transparent background, with the hair in exactly this spot, so it
  lines up when laid on top of my image. Do not move, scale or recenter it.
- The hair sits ON this head. The top of the skull is at y = 367, and the skull is widest at y = 612, from x = 347 to
  x = 899. Wherever the hair covers the head, its outer edge must sit just OUTSIDE the head's dark outline (about 8 to
  20 pixels past it), so no bald outline peeks out at the top or sides. Volume (a puff, bun, curls, a top knot) may rise
  above the skull, but not above y = 60, and nothing goes past x = 120 or x = 1134.
- The natural hairline is at about y = 519 in the middle. Bangs and the hairline across the forehead end at y = 595 at
  the lowest. NEVER cover the eyebrows (y = 605 to 650) or the face below them.
- The ears stick out from x = 282 to 355 and x = 892 to 965, from y = 675 to y = 855. Hair may cover them or be tucked
  behind them.
- THE FACE AND JAW (very important; this head comes in several face shapes, from narrow and pointed to round and wide,
  and the hair must fit all of them): from the ears down, keep the inside edge of the hair beside the face OUTSIDE
  these points:
    y = 870: left of x = 335 and right of x = 915
    y = 930: left of x = 355 and right of x = 895
    y = 990: left of x = 400 and right of x = 850
    y = 1050 and below: only beside or behind the neck (the neck is x = 512 to 740); nothing over the chin.
  Inside those lines is face: leave it fully transparent. Never lay a lock over the cheek or curl hair in under the jaw.
- Long hair may fall past the jaw, over the front of the shoulders or behind them, down to the bottom edge (y = 1254).
  The shoulders reach x = 269 to 985 at the bottom edge.

STYLE:
- Draw ONLY the hair. No head, face, ears, neck or skin; leave all of that transparent. No hair accessories (no clips,
  flowers, bows, beads or scrunchies): the game re-colours the whole picture as hair.
- Colour all of the hair in ONE medium warm brown (#8f4b29), with a darker shadow tone and a lighter shine tone of that
  same brown as solid, clean-edged shapes. Flowing dark-brown strand lines inside the hair that follow its shape. A
  bold, smooth, near-black outline (#23140f), as thick as the head's outline. Flat colours, no gradients, no texture,
  no background, no shadow.
- An adult hairstyle in the cute, rounded, Disney-like cartoon style of the head.
````

## 2. One message per style (one at a time, same chat)

Start each with `Draw this hairstyle:` and the description.

| # | Save as | Message |
|---|---|---|
| 1 | `blunt_bob_bangs.png` | Draw this hairstyle: Blunt Bob with Bangs. A sleek, chin-length blunt bob, cut straight across just below the jaw, with full straight-across bangs that stop just above the eyebrows. Smooth and glossy; the sides fall straight down beside the face, outside the cheeks. The hair texture is straight. |
| 2 | `half_up_top_knot.png` | Draw this hairstyle: Half-Up Top Knot. Straight, shoulder-length hair with the top half pulled up into a small, neat knot on the crown; the rest hangs straight and smooth to the shoulders, beside the face. A soft center part and a natural hairline at the forehead. The hair texture is straight. |
| 3 | `french_twist.png` | Draw this hairstyle: French Twist. A smooth, elegant French twist: all the hair swept back and rolled up vertically at the back of the head, the roll showing at one side behind the ear, with a sleek, glossy top. Nothing hangs beside the face. The hair texture is straight. |
| 4 | `over_shoulder_waves.png` | Draw this hairstyle: Over-the-Shoulder Waves. Long waves all swept to one side with a deep side part: the hair falls in a full, wavy cascade beside the face and over one shoulder in front, while the other side is tucked behind the ear. The hair texture is wavy. |
| 5 | `wavy_shag_bangs.png` | Draw this hairstyle: Wavy Shag. A choppy, layered shag of shoulder-length waves with wispy, piecey bangs across the forehead (above the eyebrows) and lots of movement at the sides, outside the cheeks. The hair texture is wavy. |
| 6 | `wavy_side_bun.png` | Draw this hairstyle: Wavy Side Bun. Wavy hair swept to one side into a soft, loose bun low behind one ear, with a wavy side-swept fringe across the top of the forehead (above the eyebrows) and a single loose wave hanging beside the other ear, outside the cheek. The hair texture is wavy. |
| 7 | `curly_undercut_pixie.png` | Draw this hairstyle: Curly Undercut Pixie. A short curly pixie with one side buzzed very close to the head, and a sweep of defined curls on top falling to the other side and onto the forehead (above the eyebrows). The hair texture is curly. |
| 8 | `curly_shoulder_bob.png` | Draw this hairstyle: Curly Shoulder Bob. A rounded, shoulder-length bob of bouncy, defined ringlets with a center part, full and wide beside the cheeks and jaw (outside them), curls spilling to the shoulders. The hair texture is curly. |
| 9 | `long_curls_with_bangs.png` | Draw this hairstyle: Long Curls with Bangs. Long curly hair past the shoulders with a fringe of short, springy curly bangs across the forehead (above the eyebrows), the curls framing the face at both sides, outside the cheeks. The hair texture is curly. |
| 10 | `curly_side_updo.png` | Draw this hairstyle: Curly Side Updo. Curls gathered up and pinned high on one side of the crown in a full, romantic cluster, with a few ringlets spilling down toward that ear; the other side smoothed back close to the head. The hair texture is curly. |
| 11 | `tapered_coils.png` | Draw this hairstyle: Tapered Coils. A short, tapered natural cut: a rounded crown of tight coils on top, about two finger-widths high, tapering close to the head at the sides. The hair texture is coily. |
| 12 | `coily_frohawk.png` | Draw this hairstyle: Coily Frohawk. A coily frohawk: a tall, rounded strip of springy coils down the middle of the head from the forehead back, with the sides twisted flat and close to the scalp in neat rows. The hair texture is coily. |
| 13 | `long_coily_ponytail.png` | Draw this hairstyle: Long Coily Ponytail. Coily hair brushed back smoothly into a low ponytail with neat, laid edges at the hairline; the ponytail is a long, full, springy coily mass falling over one shoulder, outside the jaw. The hair texture is coily. |
| 14 | `bantu_knots.png` | Draw this hairstyle: Bantu Knots. Coily hair parted into neat sections, each twisted into a small coiled knot sitting on the head: about seven knots across the top and sides, the parts visible between them. The hair texture is coily. |

## 3. The cherubic version (right after each style, attach the cherubic template)

Only needed for styles with hair hanging beside the face (bobs, long hair, waves, curls). Skip it for updos and short
styles that stop above the ears (French Twist, Curly Undercut Pixie, Curly Side Updo, Tapered Coils, Coily Frohawk,
Bantu Knots). Save it as `heads/<style>/cherubic.png`.

````text
Here is the same head with a different face shape: CHERUBIC (attached). Same skull, same ears, same position; only
the cheeks, jaw and chin are rounder and wider. Redraw the SAME hairstyle you just drew for it: above the ears, copy
it exactly; from the ears down, keep the same length, waves and tips, and move only the side hair OUT so it clears
this rounder face. Keep the inside edge of the hair beside the face outside these points:
    y = 870: left of x = 330 and right of x = 922
    y = 930: left of x = 346 and right of x = 906
    y = 990: left of x = 392 and right of x = 859
    y = 1030: left of x = 455 and right of x = 797
    y = 1050 and below: only beside or behind the neck (x = 512 to 740), nothing over the chin.
Output the 1254 x 1254 transparent PNG, hair only.
````

# Kid eyes: template and prompt

For children aged 7 to 13, who all have the same head in the game: `assets/heads/kid.svg`. Each kid eye shape has a girl
version (with lashes) and a boy version (without), and each matches an eye shape family of the grown-up eyes, so a child
wears the kid version of the eyes they will have from 14.

**Template images** (1254 x 1254, the same size and framing as the kid hair and clothes):

- `assets/clothes_templates/kid_eyes_template.png`: the kid head with brows, nose and mouth but no eyes, on a
  transparent background. Upload this one to the image generator.
- `assets/clothes_templates/kid_eyes_guide.png`: the same, with the eye boxes marked. For you to check the result
  against; don't upload this one.

**Measurements** on the 1254 template (x from the left, y from the top):

| | where |
|---|---|
| each eye (the current kid eyes) | x 428 to 587 and x 668 to 827, y 696 to 832 |
| eye centres | x 507 and x 747, y 764 |
| most room an eye may take | x 403 to 612 and x 643 to 852, y 690 to 870 |
| eyebrows end | y 690 |

**Color.** Draw the irises in one warm brown: the game recolors them to each kid's own eye color (blue, green, hazel,
...), keeping the shading. Whites stay white, pupils and outlines dark, highlights white.

## Reference eyes (the easiest way to get the style right)

ChatGPT copies a picture far better than a description. Three references, each on the kid face (where the eyes sit)
and alone, at the template's size and position, all with a black iris:

| reference | files | for |
|---|---|---|
| eyes 8: almond, a black iris and pupil with a highlight, flicked lashes | `kid_eyes_reference_girl_on_face.png`, `kid_eyes_reference_girl.png` | girls' eyes |
| eyes 9: a heavy, relaxed upper lid, no lashes | `kid_eyes_reference_boy_on_face.png`, `kid_eyes_reference_boy.png` | boys' eyes |
| eyes 25: upturned almond with fluttery lashes (the shape to copy; it needs a full iris) | `kid_eyes_reference_shape_25_on_face.png`, `kid_eyes_reference_shape_25.png` | a shape idea |

Upload `kid_eyes_template.png` and the reference **on the face** together, with:

````text
The second image shows the eyes I want, on the face. Draw new eyes for the first image (the same face, with no eyes),
in EXACTLY the same style, size and position as the second image: the same lid line and lashes (or no lashes), the same
proportions, a BLACK iris with a black pupil inside it and one or two white highlights, and white around it. Change
ONLY the shape of the eyelids and corners, to make them [DESCRIBE THE SHAPE]. Output a 1254 x 1254 PNG with a fully
transparent background, with only the eyes drawn, in exactly the same place as in the second image.
````

For eyes 25's shape, upload its reference and say instead: "Keep this exact shape and these lashes, but give each eye a
full black iris with a pupil and white highlights, like normal eyes."

The shapes to describe are listed below. Girls' versions use the girl reference, boys' the boy reference.

## Prompt

Upload `kid_eyes_template.png` with this, and replace `[DESCRIBE THE EYES]`:

````text
This image is a cartoon child's face with no eyes, on a transparent background, from a 2D life-simulation game. The
child is about 7 to 13 years old. Draw ONE pair of eyes for this child: [DESCRIBE THE EYES].

EXACT SIZE AND POSITION (the image is 1254 x 1254 pixels; x is from the left, y is from the top):
- Output a PNG exactly 1254 x 1254 pixels, fully transparent background, with the eyes in exactly this spot, so they
  line up when laid on top of my image. Do not move, scale or recenter them.
- The left eye is centred at x = 507, y = 764, about 160 pixels wide (x = 428 to 587) and up to 136 pixels tall
  (y = 696 to 832). The right eye is its mirror image, centred at x = 747, y = 764 (x = 668 to 827).
- Lashes and lids may reach a little further, but stay within x = 403 to 612 and x = 643 to 852, and between y = 690
  and y = 870. Nothing touches the eyebrows (they end at y = 690) or the nose (between x = 600 and 655).
- Both eyes are the same size and shape, mirrored, looking straight ahead.
- Keep them at exactly this height: the middle of each eye at y = 764. Not lower.

STYLE:
- Draw ONLY the two eyes (with their lids and lashes). No eyebrows, nose, mouth, face or skin; leave all of that
  transparent.
- CUTE, NOT STARING. This is what makes a cartoon child's eyes sweet rather than scary:
  - The IRIS IS VERY LARGE: it fills most of the eye, about 75 to 85 percent of its height, and its top is tucked UNDER
    the upper lid (the upper lid line overlaps the top of the iris). NEVER a small iris floating in the middle with white
    showing all the way around it. Only a small crescent of white shows, at the sides and below.
  - A THICK, DARK UPPER LID / LASH LINE (#23140f) and a much THINNER lower line, or a lower line only at the outer half.
    Never one even, thick ring around the whole eye.
  - The iris in ONE warm brown (#7a4a2a), darker toward the top (the lid's shadow), with a large soft dark pupil that
    blends into it, and ONE BIG white highlight near the top (plus at most one small one). No hard tiny black dot pupil.
  - Soft and round, the same rounded cartoon style as the face. Flat colors, simple soft shading, no gradients, no
    texture, no background, no shadow.
- Every eye shape is drawn as friendly and appealing as every other, at the same size: a natural shape, never
  squinting, narrowed, sleepy or exaggerated.
````

Send the PNG it makes and say its number below. It is traced into the game's format (named
`eyes_kid_<shape>_<girl|boy>`) and placed exactly as drawn.

## Eye shapes (6 shapes, each a girl and a boy version: 12)

Girls' versions add a few soft lashes on the upper lid toward the outer corner; boys' versions have no lashes, just the
lid line.

1. **Round, girl** / 2. **Round, boy**: big, round, open eyes with the iris fully framed by white; a classic cartoon
   eye.
3. **Almond, girl** / 4. **Almond, boy**: almond-shaped, wider than tall, gently pointed at the inner and outer corners,
   with a softly curved upper lid.
5. **Monolid, girl** / 6. **Monolid, boy**: almond-shaped with a smooth upper lid that has no visible crease above the
   lash line, the lid line sweeping gently outward; just as large, open and bright as the other shapes.
7. **Hooded, girl** / 8. **Hooded, boy**: a soft fold of lid that sits low over the crease, partly covering the upper
   lid, with the eye still open and bright underneath.
9. **Upturned, girl** / 10. **Upturned, boy**: almond eyes whose outer corners lift slightly higher than the inner
   corners, for a cheerful look.
11. **Downturned, girl** / 12. **Downturned, boy**: eyes whose outer corners sit slightly lower than the inner corners,
    for a gentle, sweet look.

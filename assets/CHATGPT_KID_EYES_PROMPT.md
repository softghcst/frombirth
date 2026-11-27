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
and alone, at the template's size and position, each with a colored (brown) iris:

| reference | files | for |
|---|---|---|
| eyes 8: almond, a brown iris with a black pupil and a highlight, flicked lashes | `kid_eyes_reference_girl_on_face.png`, `kid_eyes_reference_girl.png` | girls' eyes |
| eyes 9: a heavy, relaxed upper lid, no lashes | `kid_eyes_reference_boy_on_face.png`, `kid_eyes_reference_boy.png` | boys' eyes |
| eyes 25: upturned almond with fluttery lashes (the shape to copy; it needs a pupil and highlights) | `kid_eyes_reference_shape_25_on_face.png`, `kid_eyes_reference_shape_25.png` | a shape idea |

Upload `kid_eyes_template.png` and the reference **on the face** together, with:

````text
The second image shows the eyes I want, on the face. Draw new eyes for the first image (the same face, with no eyes),
in EXACTLY the same style, size and position as the second image: the same lid line and lashes (or no lashes), the same
proportions, a COLORED iris in one warm brown (#7a4a2a) with a clearly visible round BLACK PUPIL in its center and one
or two white highlights, and white around it. Not a solid single-color iris: the black pupil must show. Change
ONLY the shape of the eyelids and corners, to make them [DESCRIBE THE SHAPE]. Output a 1254 x 1254 PNG with a fully
transparent background, with only the eyes drawn, in exactly the same place as in the second image.
````

For eyes 25's shape, upload its reference and say instead: "Keep this exact shape and these lashes, but give each eye a
brown iris with a clearly visible round black pupil in its center and white highlights, like normal eyes."

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

## Girls' eyes: the full prompt

Upload `kid_eyes_template.png` (first) and `kid_eyes_reference_girl_on_face.png` (second), with this, and replace
`[DESIGN]` with one of the designs below:

````text
I am making eyes for a cute 2D cartoon life-simulation game. The FIRST image is a cartoon girl's face (about 7 to 13
years old) with NO eyes. The SECOND image is the same face WITH the eyes whose STYLE I want.

Draw ONE pair of eyes for the first image, in EXACTLY the style of the second image, but in this shape: [DESIGN].

STYLE (copy it from the second image):
- A bold dark brown upper lid line (#23140f), thicker than the lower line; a thin lower line, or one only at the outer
  half of the eye.
- Small, neat girl's lashes: three or four short flicks at the outer corner of the upper lid. Small and cute, not long
  or dramatic. No lower lashes.
- A COLORED iris in one warm brown (#7a4a2a), with a clearly visible round BLACK PUPIL in its center (not a solid
  one-color iris), a slightly darker ring at the iris's edge, and one big white highlight near the top plus one small
  one. The iris is large: its top tucks just under the upper lid, and only a little white shows at the sides and below.
- White eye whites, flat colors, simple soft shading, no gradients, no texture, no shadow.
- Friendly, bright and appealing, like the second image. The eye is never squinting, sleepy, angry or exaggerated:
  every shape is drawn as cute and as open as every other.

EXACT SIZE AND POSITION:
- Output a PNG exactly 1254 x 1254 pixels with a FULLY TRANSPARENT background, with the eyes in exactly the same place
  as in the second image, so it lines up when laid on top of the first.
- Left eye centered at x = 507, y = 764; right eye centered at x = 747, y = 764 (x from the left, y from the top).
  Each eye about 160 pixels wide (x = 428 to 587, and x = 668 to 827) and up to 136 pixels tall (y = 696 to 832).
- Nothing above y = 690 (the eyebrows end there) or below y = 870, and nothing between x = 600 and x = 655 (the nose).
- Both eyes the same, mirrored, looking straight ahead.

Draw ONLY the two eyes (lids, lashes, whites, irises). No eyebrows, nose, mouth, skin or face: leave all of that
transparent.
````

## Girls' eye designs

Each design is a real, natural eye shape. The heritages after it are where the shape is **more common**, which tells
the game how often to give it: any child of any heritage can still have any of them. Several designs share heritages,
and every heritage has several designs.

1. **Round and open.** A round eye, almost as tall as it is wide, with a clear crease above the lid and the whole iris
   showing.
   *European, Latino, Middle Eastern & North African, Sub-Saharan African, South Asian, Pacific Islander*
2. **Classic almond.** Wider than tall, gently pointed at the inner and outer corners, a softly curved upper lid with a
   visible crease.
   *South Asian, Middle Eastern & North African, Latino, Southeast Asian, European, Sub-Saharan African*
3. **Monolid.** An almond eye with a smooth upper lid and no crease above the lash line; the lid line sweeps gently
   outward. Just as big, open and bright as the others.
   *East Asian, Central Asian, Southeast Asian, Indigenous American*
4. **Soft inner fold.** A gently rounded almond with a small, soft fold of skin over the inner corner (an epicanthic
   fold) and a low, faint crease.
   *East Asian, Southeast Asian, Central Asian, Indigenous American*
5. **Double crease almond.** An almond eye with a neat, clearly drawn crease line close above the lashes, slightly
   upturned at the outer corner.
   *East Asian, Southeast Asian, Pacific Islander, Central Asian*
6. **Hooded.** A soft fold of lid that sits low over the crease and partly covers the upper lid, with the eye still open
   and bright underneath.
   *European, East Asian, Middle Eastern & North African, Indigenous American, Central Asian*
7. **Upturned.** An almond whose outer corners lift a little higher than the inner corners, for a cheerful look.
   *East Asian, Southeast Asian, Latino, Middle Eastern & North African, European*
8. **Downturned.** Outer corners sitting a little lower than the inner corners, for a gentle, sweet look.
   *European, South Asian, Sub-Saharan African, Latino, Aboriginal & Torres Strait Islander*
9. **Deep-set and large.** A large eye set a little deeper under the brow, with a defined crease and a slightly heavier
   upper lid line; a big, dark-ringed iris.
   *South Asian, Middle Eastern & North African, Aboriginal & Torres Strait Islander, European*
10. **Wide and rounded.** A large, wide, rounded eye with a soft crease and a big iris, set a little further apart.
    *Sub-Saharan African, Pacific Islander, Latino, Aboriginal & Torres Strait Islander*
11. **Low-crease almond.** A long almond with a low crease close to the lashes and a gently flat upper lid line.
    *Indigenous American, Central Asian, Southeast Asian, East Asian*
12. **Upturned with fluttery lashes** (eyes 25's shape; upload `kid_eyes_reference_shape_25_on_face.png` as the second
    image for this one). Upturned almond with slightly fuller lashes, a brown iris and a clearly visible black pupil.
    *Latino, Middle Eastern & North African, South Asian, Southeast Asian, European*

How many designs each heritage has: East Asian 6, Southeast Asian 7, South Asian 5, Central Asian 6, Middle Eastern &
North African 7, Sub-Saharan African 5, European 7, Latino 7, Indigenous American 4, Pacific Islander 4, Aboriginal &
Torres Strait Islander 3.

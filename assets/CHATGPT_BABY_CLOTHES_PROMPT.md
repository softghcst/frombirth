# Baby clothes: template and prompt

For babies and toddlers (ages 0 to 6), who all have the same head in the game: `assets/heads/toddler.svg`.

**Template images** (1254 x 1254, the same size and framing as every outfit image):

- `assets/clothes_templates/baby_head_template.png`: the bare baby head, neck and shoulders, on a transparent
  background. Upload this one to the image generator.
- `assets/clothes_templates/baby_head_guide.png`: the same, with the chin, neck, shoulders and the area the clothes
  go in marked. For you to check the result against; don't upload this one.

**What shows in the game.** A baby has a big head and very little body in the picture: below the chin there is only
a strip of neck and the tops of the shoulders, down to the bottom edge. So a baby outfit is, in practice, its collar,
neckline and shoulders: put the details that matter (a collar, a bow, buttons, a bib's top edge, a hood's rim) there.
Anything drawn lower than the bottom edge of the image is never seen.

Measurements (in the game's 512 frame; multiply by 2.45 for the 1254 image):

| | 512 frame | 1254 image |
|---|---|---|
| chin (bottom of face) | y 456 | y 1117 |
| neck (narrowest, under the chin) | y 460, 48 wide | y 1127, 118 wide |
| body at y 1150 / 1190 / bottom | | 416 / 523 / 586 wide, centered on x 626 |
| outfit at y 1150 / 1190 / bottom | | 446 / 553 / 616 wide (the body plus about 15 each side) |
| bottom of the picture | y 512 | y 1254 |

## Prompt

Upload `baby_head_template.png` with this, and replace `[DESCRIBE THE OUTFIT]`. The sizes are the baby's body measured
at each height on the template, plus about 15 pixels each side so the outfit always covers the shoulder outline (the
cream onesie, `outfit_baby_01_cream_onesie`, matches them).

````text
This image is a cartoon baby's bare head, neck and shoulders, on a transparent background, from a 2D life-simulation
game. Draw ONE outfit for this baby: [DESCRIBE THE OUTFIT].

EXACT SIZE AND POSITION (the image is 1254 x 1254 pixels; x is from the left, y is from the top; everything is
centered on x = 626):
- Output a PNG exactly 1254 x 1254 pixels, fully transparent background, with the outfit in exactly this spot, so it
  lines up when laid on top of my image.
- Neckline: the top edge of the collar sits at y = 1122 to 1135, hugging the neck. The neck opening is about 220
  pixels wide (x = 516 to 736).
- At y = 1150 the outfit is 446 pixels wide (x = 404 to 850).
- At y = 1190 it is 553 pixels wide (x = 350 to 903).
- At the bottom edge (y = 1254) it is 616 pixels wide (x = 318 to 934), and it runs off the bottom of the image.
- The outfit must be WIDER than the baby's shoulders everywhere, covering them out past the dark outline on both
  sides. No skin or shoulder outline should show at the sides. It is fine to be a little too wide; it must never be
  too narrow.
- Nothing above y = 1110 except a collar, bow or strap that sits right at the neck.

STYLE:
- Draw ONLY the clothes. No head, face, ears, hair or skin; leave all of that transparent.
- Flat colours with a bold dark brown outline (#23140f), about as thick as the head's outline. Simple soft shading,
  no gradients, no texture, no background, no shadow.
- A baby's outfit: soft, simple and cute. Keep details (collar, bow, buttons, bib edge) near the neck and shoulders.
  Very little shows below y = 1200.
````

If an outfit still comes back too narrow, check it against `baby_head_guide.png`, or send it anyway: the fitting
script widens it to cover the shoulders. Drawn at the right width, its buttons and bows are not stretched.

Send the PNG it makes, and say if it's for royal babies. It is traced into the game's format (named `outfit_baby_...`)
and placed exactly as drawn; then `npm run fit-child-clothes` widens it a little if it came out narrower than the
shoulders.

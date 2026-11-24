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
| shoulders (at the bottom edge) | 225 wide, centred on x 255 | 550 wide, centred on x 626 |
| bottom of the picture | y 512 | y 1254 |

## Prompt

Upload `baby_head_template.png` with this, and replace `[DESCRIBE THE OUTFIT]`:

````text
This image is a cartoon baby's bare head, neck and shoulders, on a transparent background, from a 2D life-simulation
game. Draw ONE outfit for this baby: [DESCRIBE THE OUTFIT].

Rules:
1. Output a PNG exactly 1254 x 1254 pixels with a fully transparent background, in the SAME position and scale as the
   image I gave you, so it lines up when laid on top of it.
2. Draw ONLY the clothes. Do not draw the head, face, ears, hair, neck skin or shoulders' skin: leave all of that out,
   transparent.
3. The neckline sits around the baby's neck, just under the chin (around y 1120-1140), hugging it closely. The
   clothes cover the shoulders all the way out past the edges of the body and run off the bottom edge of the image.
4. Style: match the head exactly: flat colours, a bold dark brown outline (#23140f) about the same thickness as the
   head's outline, simple soft shading, no gradients, no texture, no shadow on the background.
5. It's a baby's outfit: soft, simple and cute (onesie, romper, little sweater, bib, sailor collar, etc.). Keep the
   important details near the neck and shoulders, since nothing much lower than that is visible.
````

Send the PNG it makes, and say if it's for royal babies. It is traced into the game's format (named `outfit_baby_...`)
and placed exactly as drawn; then `npm run fit-child-clothes` widens it a little if it came out narrower than the
shoulders.

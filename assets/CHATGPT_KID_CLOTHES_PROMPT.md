# Kid clothes: template and prompt

For children aged 7 to 13, who all have the same head in the game: `assets/heads/kid.svg`. (Babies and toddlers have
their own: `CHATGPT_BABY_CLOTHES_PROMPT.md`.)

**Template images** (1254 x 1254, the same size and framing as every outfit image):

- `assets/clothes_templates/kid_head_template.png`: the bare kid head, neck and shoulders, on a transparent background.
  Upload this one to the image generator.
- `assets/clothes_templates/kid_head_guide.png`: the same, with the chin, the neckline, the shoulders and the area the
  clothes go in marked. For you to check the result against; don't upload this one.

**What shows in the game.** A kid has a longer neck than a baby: it runs from the chin (y 1063) straight down to about
y 1120, where it widens into the shoulders. The neckline of an outfit sits there, at the base of the neck, not up under
the chin. Below it there is only the tops of the shoulders and a strip of chest down to the bottom edge, so a kid's
outfit is, in practice, its collar, neckline and shoulders: put the details that matter there.

Measurements, on the 1254 template (the outfit widths are the kid's body there plus about 15 pixels each side, so the
outfit always covers the shoulder outline):

| | kid's body | outfit |
|---|---|---|
| neck (y 1070 to 1120) | 195 wide, x 530 to 725 | neck opening about 225 wide, x 514 to 740 |
| y 1150 | 386 wide, x 435 to 821 | 416 wide, x 420 to 836 |
| y 1190 | 516 wide, x 369 to 885 | 546 wide, x 354 to 900 |
| bottom edge, y 1254 | 583 wide, x 336 to 919 | 613 wide, x 321 to 934 |

## Prompt

Upload `kid_head_template.png` with this, and replace `[DESCRIBE THE OUTFIT]`:

````text
This image is a cartoon child's bare head, neck and shoulders, on a transparent background, from a 2D life-simulation
game. The child is about 7 to 13 years old. Draw ONE outfit for this child: [DESCRIBE THE OUTFIT].

EXACT SIZE AND POSITION (the image is 1254 x 1254 pixels; x is from the left, y is from the top; everything is
centered on x = 627):
- Output a PNG exactly 1254 x 1254 pixels, fully transparent background, with the outfit in exactly this spot, so it
  lines up when laid on top of my image.
- Neckline: the collar sits at the BASE of the neck, at y = 1110 to 1125, hugging it. Leave the neck above that bare
  (the neck runs from the chin at y = 1063 down to y = 1120). The neck opening is about 225 pixels wide (x = 514 to 740).
  A hood, a tall collar or a bow may rise a little above y = 1110 beside the neck, but never onto the chin or face.
- At y = 1150 the outfit is 416 pixels wide (x = 420 to 836).
- At y = 1190 it is 546 pixels wide (x = 354 to 900).
- At the bottom edge (y = 1254) it is 613 pixels wide (x = 321 to 934), and it runs off the bottom of the image.
- The outfit must be WIDER than the child's shoulders everywhere, covering them out past the dark outline on both
  sides. No skin or shoulder outline should show at the sides. It is fine to be a little too wide; it must never be
  too narrow.

STYLE:
- Draw ONLY the clothes. No head, face, ears, hair, neck or skin; leave all of that transparent.
- Flat colors with a bold dark brown outline (#23140f), about as thick as the head's outline. Simple soft shading,
  no gradients, no texture, no background, no shadow.
- A child's outfit: casual and fun, not a grown-up's (a hoodie, a graphic tee, a school uniform, a sports jersey, a
  cardigan, overalls, a party dress, etc.). Keep details (collar, logo, buttons, zip, stripes) near the neck and
  shoulders: very little shows below y = 1200.
````

Send the PNG it makes, and say if it is for girls, boys or anyone, and if it is for royal children. It is traced into the
game's format (named `outfit_kid_...`) and placed exactly as drawn; then `npm run fit-child-clothes` widens it a little
if it came out narrower than the shoulders.

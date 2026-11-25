# Kid hair: template and prompt

For children aged 7 to 13, who all have the same head in the game: `assets/heads/kid.svg`. (Babies have their own hair,
drawn on the baby template; grown-ups' hair comes at 14.)

**Template images** (1254 x 1254, the same size and framing as every hair and outfit image):

- `assets/clothes_templates/kid_hair_template.png`: the bald kid head with a face (brows, eyes, nose, mouth), on a
  transparent background. Upload this one to the image generator.
- `assets/clothes_templates/kid_hair_guide.png`: the same, with the lines below marked. For you to check the result
  against; don't upload this one.

**Measurements** on the 1254 template (x from the left, y from the top; the head is centered on x = 627):

| | where |
|---|---|
| top of the skull | y 368 |
| skull, widest | x 324 to 929 (605 wide), at y 650 |
| eyebrows | y 598 to 690 |
| eyes | y 712 to 860 |
| ears | x 279 to 366 and 888 to 974, y 720 to 888 |
| chin | y 1080 |

**What shows in the game.** The hair is drawn behind the head, and again in front of it down to y 989 (about the
mouth). Above that line, everything you draw shows: bangs, side pieces, hair over the ears. Below it, hair only shows
behind the head and neck, and the kid's top covers the shoulders. So long hair, braids and ponytails hang down the back:
a braid lying over the front of a shoulder would disappear under the clothes. Pigtails, puffs and buns that stick out
to the sides or up on top show well.

**Color.** The hair is drawn in one brown, and the game recolors it to each kid's own hair color, keeping the shading.
Bows, clips and beads in a clearly different color (pink, purple, blue, teal, green or white) keep their colors. Red,
orange, yellow or brown ones would be recolored with the hair.

**Texture.** Each style is for one hair texture (straight, wavy, curly or coily). A kid only gets styles for their
texture, so each texture needs a few styles for girls and for boys.

## Prompt

Upload `kid_hair_template.png` with this, and replace `[DESCRIBE THE HAIRSTYLE]`:

````text
This image is a cartoon child's bald head with a face, on a transparent background, from a 2D life-simulation game.
The child is about 7 to 13 years old. Draw ONE hairstyle for this child: [DESCRIBE THE HAIRSTYLE].

EXACT SIZE AND POSITION (the image is 1254 x 1254 pixels; x is from the left, y is from the top; the head is centered
on x = 627):
- Output a PNG exactly 1254 x 1254 pixels, fully transparent background, with the hair in exactly this spot, so it
  lines up when laid on top of my image. Do not move, scale or recenter it.
- The hair sits ON this head. The top of the skull is at y = 368 and the skull is widest at y = 650, from x = 324 to
  x = 929. Wherever the hair covers the head, its outer edge must sit just OUTSIDE the head's dark outline (about 8 to
  20 pixels past it), so no bald outline peeks out at the top or sides. Volume (a puff, bun, curls, spikes) may rise
  above the skull, but not above y = 150, and nothing goes past x = 180 or x = 1074.
- Bangs and the hairline across the forehead end at y = 590 at the lowest. NEVER cover the eyebrows (y = 598 to 690)
  or the eyes (y = 712 to 860).
- The ears are at x = 279 to 366 and x = 888 to 974, y = 720 to 888. Hair may cover them or be tucked behind them.
- Beside the face, hair may come down to about y = 989. Long hair, braids and ponytails hang straight down BEHIND the
  shoulders, never in front of them over the chest.

STYLE:
- Draw ONLY the hair (and any hair accessory). No head, face, ears, neck or skin; leave all of that transparent,
  including the face showing through the hair.
- Color all of the hair in ONE medium brown (#804225), with darker and lighter shades of that same brown for strands
  and shine. A bold dark brown outline (#23140f), as thick as the head's outline. Flat colors, simple soft shading, no
  gradients, no texture, no background, no shadow.
- Any bow, clip, scrunchie, bobble, bead or headband must be pink, purple, blue, teal, green or white. Never red,
  orange, yellow or brown.
- A child's hairstyle, fun and age-appropriate, matching the cute rounded cartoon style of the head.
````

Send the PNG it makes and say its number below (or for girls or boys, and which texture). It is traced into the game's
format (named `hair_kid_girl_<texture>_NN_...` or `hair_kid_boy_...`) and placed exactly as drawn; then
`npm run fit-baby-hair` snaps it onto the kid head if it came out a little too narrow or wide.

## Girls (15)

Straight:

1. Long straight hair with thick blunt bangs, falling down behind the shoulders, with two little star-shaped clips
   (teal) on one side above the ear.
2. A high sporty ponytail at the crown with a pink scrunchie, the ponytail swinging out to one side behind the head,
   and side-swept bangs.
3. A chin-length bob with a rounded shape, the ends curving in at the jaw, and a lilac headband across the top.
4. Two space buns high on top of the head, with loose wispy strands framing the face and a few baby hairs at the
   forehead.

Wavy:

5. Shoulder-length waves with a deep side part, and one thin braid running back from the temple on the parted side.
6. Half-up, half-down waves: the top section pulled back with a big light-blue bow showing on top of the head, the
   rest falling behind the shoulders.
7. Two Dutch braids starting at the hairline and running back along each side of the head, the braid ends hanging
   down behind the shoulders.
8. High wavy pigtails sticking out to each side above the ears, tied with purple bobbles, with a wavy fringe.

Curly:

9. A big curly "pineapple" ponytail gathered high on top of the head, with a wide teal headwrap band around the
   hairline.
10. Shoulder-length ringlet curls with a soft curly fringe above the brows, a full rounded shape.
11. Two big curly puff pigtails at the sides of the head, tied with pink hair ties, and short curls at the forehead.

Coily:

12. Two round afro puffs high on top of the head, each tied with a chunky bobble (one blue, one purple), with neat
    laid edges.
13. Box braids half-up into a bun on top of the head, the rest of the braids hanging behind the shoulders, with
    white and pink beads on the braid ends that show beside the bun.
14. A big rounded afro with a wide purple headband across the top.
15. Bantu knots: six small neat knots spread over the head, with neat parts between them.

## Boys (15)

Straight:

1. A short crop with the front spiked up into a little gelled quiff.
2. A skater mop: a rounded bowl shape with straight bangs ending just above the brows, covering the tops of the ears.
3. A side-swept fringe swooping across the forehead (above the brows) with shorter sides.
4. A short buzz cut with a soft fade at the sides and a slightly longer top.

Wavy:

5. Messy wavy surfer hair down to the ears, tousled and a little windswept.
6. Wavy curtain bangs with a middle part, the bangs curving out to each side above the brows, medium length to the
   ears.
7. A short textured wavy crop with faded sides and a messy wavy top.
8. A neat smart side part, combed over, short at the sides, ready for school photos.

Curly:

9. Curly top with tapered faded sides: a tight cluster of curls on top, short sides.
10. A loose curly mop with curls tumbling onto the forehead (above the brows) and over the ears.
11. A curly frohawk: a strip of curls standing up down the middle, short faded sides.

Coily:

12. A short rounded afro with a crisp line-up at the forehead and temples.
13. A high-top fade: a tall flat-topped block of coily hair on top, faded sides.
14. Short twists on top (sponge twists) with faded sides.
15. Neat cornrows running straight back from the forehead over the whole head.

# Women's hairstyles: ChatGPT picture prompts

Drawn the way the baby hairstyles are: as **pictures** on a template of the head at the image tool's own size
(1254 x 1254) with exact pixel positions, then traced into game hair by `npm run trace-hair`
(`scripts/trace_hair_png.py`) and fitted to every adult head. Asking ChatGPT for SVG code gives much plainer hair.

**Template images** (`assets/hair_templates/`, 1254 x 1254, the game's 512 frame x 2.45, the same framing as every
hair picture):

- `adult_head_template.png`: the bare adult base head (`athletic`, with the shared neck), on a transparent background.
  Upload this one.
- `adult_head_guide.png`: the same with the top of the skull, hairline, eyebrows, temples, ears and the face area to
  keep clear marked. For you to check results against; don't upload it.

Measurements (512 frame -> 1254 image): top of skull y 150 -> 367; hairline y 212 -> 519; eyebrows y 254 -> 622;
temples x 142 / 367 -> 348 / 898; ears join x 145 / 364 at y 276 -> 355 / 892 at 675; face x 175-335, y 262-415 ->
x 429-820, y 642-1016; neck x 209-302 -> 512-740; shoulders at the bottom x 110-402 -> 269-985.

## How to use

1. Start a **new ChatGPT chat**. Attach `assets/hair_templates/adult_head_template.png` and two styles from
   `assets/hair_png/`: `storybook_waves.png` and `cloud_curls.png`. Paste the setup message and send. ChatGPT replies "Ready."
2. Send the style messages **one at a time**, in the same chat. Each reply is one picture of the hair alone.
3. Download each picture, name it as given (e.g. `blunt_bob_bangs.png`), and put it in `assets/hair_png/` (or send it
   to Claude to trace, tag and fit). Check it against `adult_head_guide.png` if in doubt.
4. If one comes out wrong, reply in the same chat, e.g. "Same hair, but remove the head completely", "Keep it at
   exactly 1254 x 1254 in the same position as the template", or "Lift the bangs above y = 610".

After tracing, each style is tagged on its traced SVG (`assets/hair_raw/<name>.svg`) with the attributes listed
under it, so the game knows who it is for.

## Setup message (attach the template and the two example styles)

````text
This image is a cartoon adult's bare, bald head, ears, neck and shoulders, on a transparent background, from a
2D life-simulation game. I've also attached two hairstyles already in the game (storybook_waves.png and
cloud_curls.png): match their art style exactly. For each hairstyle I describe after this message, draw ONE
hairstyle for this head.

EXACT SIZE AND POSITION (the image is 1254 x 1254 pixels; x is from the left, y is from the top; the head is
centered on x = 626):
- Output a PNG exactly 1254 x 1254 pixels, fully transparent background, with the hair in exactly the spot it sits
  on this head, so it lines up when laid on top of my image. Do not move, resize, crop or re-frame anything.
- The top of the skull is at y = 367: the hair covers it completely (volume may rise above it).
- The natural hairline is at about y = 519 in the middle.
- At the temples (x = 348 and x = 898, at y = 622) the hair wraps the skull closely, about 10 pixels outside its
  outline: no gap of bare scalp between hair and head anywhere.
- The ears join the head at x = 355 and x = 892, at y = 675. Hair may cover the ears or stop in front of them.
- The eyebrows are at y = 622: bangs stop above y = 610.
- Keep the face clear: nothing inside x = 429 to 820, y = 642 to 1016 (eyes, nose and mouth), except a fringe above
  the brows or a thin strand that falls at the very edge of the face.
- Long hair may fall past the jaw and over or behind the shoulders, down to the bottom edge (y = 1254). The neck is
  x = 512 to 740; the shoulders reach x = 269 to 985 at the bottom edge.

STYLE (copy the two example hairstyles):
- Draw ONLY the hair. No head, face, ears, neck, shoulders or skin: leave all of that transparent.
- Flat cartoon colouring: one medium warm-brown main colour, plus one darker shadow tone and one lighter highlight
  tone as solid, clean-edged shapes (like the swooshes in the examples). No gradients, no airbrush, no texture.
- Flowing dark-brown strand lines inside the hair that follow its shape, a few per section, clearly visible.
- One bold, smooth, near-black outline (#23140f) around the outside of the hair, about as thick as the head's outline.
- Always draw the hair in that same brown, whatever colour the style would normally be: the game re-colours it.

Reply to this first message only with: Ready.
````

## The 15 hairstyles

Straight: 4 · Wavy: 3 · Curly: 4 · Coily: 4. All women's styles, from age 13. Checked against the 43 women's and
unisex styles in the game: none repeats one.

### 1. Blunt Bob with Bangs (straight, short): `blunt_bob_bangs.png`

````text
Draw this hairstyle: Blunt Bob with Bangs. A sleek, chin-length blunt bob, cut straight across at the jaw, with full straight-across bangs that stop just above the eyebrows. Smooth and glossy, tucked neatly at the sides. The hair texture is straight.
````

Tags after tracing: `data-name="Blunt Bob with Bangs" data-gender="female" data-length="short" data-type="straight" data-min-age="13"`

### 2. Half-Up Top Knot (straight, medium): `half_up_top_knot.png`

````text
Draw this hairstyle: Half-Up Top Knot. Straight, shoulder-length hair with the top half pulled up into a small, neat knot on the crown; the rest hangs straight and smooth to the shoulders. A soft center part and a natural hairline at the forehead. The hair texture is straight.
````

Tags after tracing: `data-name="Half-Up Top Knot" data-gender="female" data-length="medium" data-type="straight" data-min-age="13"`

### 3. Long Curtain Bangs (straight, long): `long_curtain_bangs.png`

````text
Draw this hairstyle: Long Curtain Bangs. Long, straight, layered hair that falls well past the shoulders, with soft curtain bangs parted in the middle and sweeping out to frame the cheekbones (the eyes stay clear). The hair texture is straight.
````

Tags after tracing: `data-name="Long Curtain Bangs" data-gender="female" data-length="long" data-type="straight" data-min-age="13"`

### 4. French Twist (straight, updo): `french_twist.png`

````text
Draw this hairstyle: French Twist. A smooth, elegant French twist: all the hair swept back and rolled up vertically at the back of the head, the roll showing at one side behind the ear, with a sleek, glossy top. The hair texture is straight.
````

Tags after tracing: `data-name="French Twist" data-gender="female" data-length="updo" data-type="straight" data-min-age="13"`

### 5. Over-the-Shoulder Waves (wavy, long): `over_shoulder_waves.png`

````text
Draw this hairstyle: Over-the-Shoulder Waves. Long waves all swept to one side with a deep side part: the hair falls in a full, wavy cascade over one shoulder in front, while the other side is tucked behind the ear. The hair texture is wavy.
````

Tags after tracing: `data-name="Over-the-Shoulder Waves" data-gender="female" data-length="long" data-type="wavy" data-min-age="13"`

### 6. Wavy Shag (wavy, medium): `wavy_shag_bangs.png`

````text
Draw this hairstyle: Wavy Shag. A choppy, layered shag of shoulder-length waves with wispy, piecey bangs across the forehead (above the eyebrows) and lots of movement at the sides. The hair texture is wavy.
````

Tags after tracing: `data-name="Wavy Shag" data-gender="female" data-length="medium" data-type="wavy" data-min-age="13"`

### 7. Wavy Low Ponytail (wavy, updo): `wavy_low_ponytail.png`

````text
Draw this hairstyle: Wavy Low Ponytail. Wavy hair gathered loosely at the nape into a low ponytail whose wavy tail shows at one side of the neck, with soft face-framing waves left loose at both temples. The hair texture is wavy.
````

Tags after tracing: `data-name="Wavy Low Ponytail" data-gender="female" data-length="updo" data-type="wavy" data-min-age="13"`

### 8. Curly Undercut Pixie (curly, short): `curly_undercut_pixie.png`

````text
Draw this hairstyle: Curly Undercut Pixie. A short curly pixie with one side buzzed very close to the head, and a sweep of defined curls on top falling to the other side and onto the forehead. The hair texture is curly.
````

Tags after tracing: `data-name="Curly Undercut Pixie" data-gender="female" data-length="short" data-type="curly" data-min-age="13"`

### 9. Curly Shoulder Bob (curly, medium): `curly_shoulder_bob.png`

````text
Draw this hairstyle: Curly Shoulder Bob. A rounded, shoulder-length bob of bouncy, defined ringlets with a center part, full and wide at the cheeks and jaw, curls spilling to the shoulders. The hair texture is curly.
````

Tags after tracing: `data-name="Curly Shoulder Bob" data-gender="female" data-length="medium" data-type="curly" data-min-age="13"`

### 10. Long Curls with Bangs (curly, long): `long_curls_with_bangs.png`

````text
Draw this hairstyle: Long Curls with Bangs. Long curly hair past the shoulders with a fringe of short, springy curly bangs across the forehead (above the eyebrows), the curls framing the face at both sides. The hair texture is curly.
````

Tags after tracing: `data-name="Long Curls with Bangs" data-gender="female" data-length="long" data-type="curly" data-min-age="13"`

### 11. Curly Faux Hawk (curly, updo): `curly_faux_hawk.png`

````text
Draw this hairstyle: Curly Faux Hawk. Curls pinned up into a ridge that runs from the forehead back over the crown, tall and full in the middle, with the sides smoothed flat against the head. The hair texture is curly.
````

Tags after tracing: `data-name="Curly Faux Hawk" data-gender="female" data-length="updo" data-type="curly" data-min-age="13"`

### 12. Tapered Coils (coily, short): `tapered_coils.png`

````text
Draw this hairstyle: Tapered Coils. A short, tapered natural cut: a rounded crown of tight coils on top, about two finger-widths high, tapering close to the head at the sides. The hair texture is coily.
````

Tags after tracing: `data-name="Tapered Coils" data-gender="female" data-length="short" data-type="coily" data-min-age="13"`

### 13. Coily Frohawk (coily, medium): `coily_frohawk.png`

````text
Draw this hairstyle: Coily Frohawk. A coily frohawk: a tall, rounded strip of springy coils down the middle of the head from the forehead back, with the sides twisted flat and close to the scalp in neat rows. The hair texture is coily.
````

Tags after tracing: `data-name="Coily Frohawk" data-gender="female" data-length="medium" data-type="coily" data-min-age="13"`

### 14. Long Coily Ponytail (coily, long): `long_coily_ponytail.png`

````text
Draw this hairstyle: Long Coily Ponytail. Coily hair brushed back smoothly into a low ponytail with neat, laid edges at the hairline; the ponytail is a long, full, springy coily mass falling over one shoulder. The hair texture is coily.
````

Tags after tracing: `data-name="Long Coily Ponytail" data-gender="female" data-length="long" data-type="coily" data-min-age="13"`

### 15. Bantu Knots (coily, updo): `bantu_knots.png`

````text
Draw this hairstyle: Bantu Knots. Coily hair parted into neat sections, each twisted into a small coiled knot sitting on the head: about seven knots across the top and sides, the parts visible between them. The hair texture is coily.
````

Tags after tracing: `data-name="Bantu Knots" data-gender="female" data-length="updo" data-type="coily" data-min-age="13"`

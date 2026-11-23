# Drawing hair as a PNG

Draw hairstyles in any drawing app (Procreate, ibis Paint, Krita, Photoshop) or with an AI image tool, save them here
as PNGs, and `npm run trace-hair` turns them into clean game hair. It rebuilds the drawing from what hair in this game
is made of (one main color, a bold outline, a few shades and strand lines) instead of guessing at every pixel, then
fits the result to every head shape.

## Steps

1. Open `TEMPLATE_base_head.png` (2048 x 2048) as the bottom layer of a new 2048 x 2048 canvas.
2. Draw the hair on a layer above it, lined up on that head.
3. Hide the head layer and export the hair alone as a PNG with a transparent background, named after the style
   (lowercase, underscores), e.g. `wavy_bob.png`.
4. Long hair that hangs **behind** the neck and shoulders: draw that part on its own layer and export it as
   `wavy_bob_back.png` (same canvas). The game puts it behind the head. Short styles do not need one.
5. Run `npm run trace-hair`. Open `scripts/debug_hair_png.html` to compare your PNG with the traced version, and
   `scripts/debug_hair_fit.html` to see it on every head.

To redo a style, change the PNG and run it again. Don't edit the traced SVG by hand.

## What traces perfectly

- **Flat color.** Fill the hair with one medium color. Brown is easiest, but any color that isn't near-black works.
  The game re-dyes it to every hair color, so don't draw it blonde or black.
- **A bold near-black outline** around the outside, about as thick as the head's outline. The tracer redraws it
  perfectly even, so a slightly wobbly hand-drawn line is fine.
- **Strand lines** in near-black or dark brown, at least 2-3 px thick on the 2048 canvas.
- **A few shadow or highlight shapes**, if you like: solid areas clearly darker or lighter than the main color.
  Each becomes one shade, so keep it to one shadow tone and one highlight tone.

## What won't survive

- Soft airbrush shading, gradients and texture brushes. They get flattened to one color.
- Hairline-thin strokes and tiny specks. They get dropped.
- The head itself. Hide it before exporting, or the skin gets traced as hair.
- Painterly or realistic hair. Draw it like the rest of the game: flat, clean, cartoon.

A white or flat background works if transparency isn't possible; it gets removed. Any square size works, but 2048 is
best.

## Buzz cuts and fades

Put `fade` or `buzz` in the name (e.g. `low_fade.png`). The game then clips the hair to each head's outline so it
hugs the skull.

## Length

New styles count as short until tagged. To change that, add `data-length="medium"` (or `long`, `updo`) to the root
`<svg>` of the traced `assets/hair_raw/<style>.svg` once; the tag is kept when the style is traced again.

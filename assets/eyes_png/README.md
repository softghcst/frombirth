# Drawing eyes as a PNG

Draw a pair of eyes in any drawing app or with an AI image tool, save it here, and `npm run trace-eyes` turns it into
game eyes. They fit every face shape and age automatically: the game draws all eyes in one shared frame and moves
and scales them onto each head, so there is nothing to fit per head.

## Steps

1. Open `TEMPLATE_eyes.png` (2048 x 2048): the base head (athletic) with faint guide eyes, brows and nose.
2. Draw both eyes on a layer above it, roughly over the guide eyes: same place, about the same size.
3. Hide the template and export the eyes alone as a PNG with a transparent background (plain white also works).
4. Save it in `women/` or `men/`, named after the shape (lowercase, underscores), e.g. `women/doe_eyes.png`.
   Women's eyes are never drawn on men, and men's never on women.
5. Run `npm run trace-eyes`, then open `scripts/debug_eyes_png.html` to compare.

## What traces well

- **White of the eye:** plain white.
- **Iris:** any medium color. The game swaps it for each character's own eye color (brown, blue, green, and so on).
  A darker ring or a shadow under the lid in a darker shade of the same color is fine.
- **Outline, lids, lashes, liner and pupil:** near-black. Keep strokes at least 2-3 px thick on the 2048 canvas.
- **Shine:** small pure-white dots inside the iris or pupil.
- **Flat color only:** no gradients, glow or soft shading.

Draw only the eyes: no brows, skin, eyeshadow or nose. Men's eyes should have no lashes or winged liner.

If the template moves (a new base head), run `npm run eye-template` and turn `TEMPLATE_eyes.svg` into the PNG again.

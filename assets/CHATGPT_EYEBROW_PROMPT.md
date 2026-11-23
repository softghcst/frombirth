# ChatGPT eyebrow prompt

For new eyebrows. Written by hand (unlike the hair prompt): edit it if the face template changes
(`FACE` and `LAYOUT` in `scripts/build-avatar-manifest.py`).

**How eyebrows fit every face.** Unlike hair, eyebrows are not warped onto each head. They are drawn once,
on the game's template face, as a left brow and a right brow in one file. The game then places each brow
above its eye on every head: it scales them with the head, moves them with the eyes (so a wide-set or close-set
pair of eyes carries its brows with it), and lifts or lowers them with the eyes. So a brow drawn to sit well over
the template's eyes sits well on every face shape. Each half is shown on its own (the file is split down the
middle, x = 256), so the two brows must not touch or cross the center.

**How to use.** Copy everything inside the box below into ChatGPT and replace `[DESCRIBE THE EYEBROWS]`.
Ask for several at once if you like, each under its file name. Name each one
`brows_<shape>_<weight>.svg`, where weight is `fine`, `medium` or `bold` (for example
`brows_soft_arch_medium.svg`, `brows_straight_bold.svg`): the game can use the weight to choose who is given which.

Then:
1. Paste ChatGPT's whole reply into `assets/brows_batch.txt` and run
   `python scripts/split_batch.py assets/brows_batch.txt --out assets/avatars/eyebrows`
   (it saves each SVG under its file name; ignore its notes about missing hair groups).
2. Run `python3 scripts/build-avatar-manifest.py`: it fits each new brow to the template's brow box and makes its
   color follow the character's brow color.
3. To replace the old eyebrows, the old files are withdrawn and saves moved to the nearest new one
   (`WITHDRAWN.brows` in `js/avatar/curation.js`), and the brows given out at random are chosen (`RESTING.eyebrows`).
   Ask Claude to do this step.

````text
You are drawing one pair of eyebrows for a 2D cartoon game avatar. Draw ONLY the eyebrows, as a single standalone SVG.

EYEBROWS: [DESCRIBE THE EYEBROWS: shape (straight, soft arch, high arch, rounded, angled, tapered), thickness
(fine, medium, bold), and anything else (feathered, a slight gap, a scar)]

RULES (all required):
1. Output one complete SVG and nothing else: no explanation, no markdown fences.
2. Root element exactly: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
   No transform attributes, no <image>, <use>, <text>, filters, gradients, masks, clipPaths, <style> or groups.
   Only <path> elements.
3. Draw TWO brows, a left one and a right one, as mirror images of each other. A face at rest: relaxed, not angry,
   surprised or sad, unless the description asks for it.
4. Where they go (x, y in the 512 frame, y points down). The face's eyes are here:
   - left eye: x 177 to 244, top of the eye at about y 269
   - right eye: x 268 to 335, top of the eye at about y 269
   Each brow sits above its eye:
   - left brow inside x 163 to 249, right brow inside x 263 to 349 (a brow may be a little shorter than its eye,
     or a little longer at the outer end, but never cross into x 250 to 262: the middle stays clear)
   - the pair is centered on y 254, within y 231 to 277; the lowest point of each brow is no lower than y 270
     (just above the top of its eye), and the thickest part sits around y 245 to 260
   - the inner end (toward the nose) is usually a little lower or the same height as the outer end; the arch,
     if any, peaks about two thirds of the way out.
5. Color: every shape is filled with #49230c, no stroke. The game recolors it to the character's hair color, so use
   only that one color. For texture you may add thin hair strokes as narrow filled shapes in the same color;
   no other colors, no outlines.
6. Weight: fine brows are 4 to 7 units thick at their thickest; medium 8 to 12; bold 13 to 18.
7. Style: the flat, clean cartoon look of the example below: smooth curves, tapered ends, no specks or noise.

EXAMPLE of the format, size and placement (a medium, softly arched pair). Draw a different pair; do not return this one:

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<path fill="#49230c" d="M269.8 260.9C269.1 263.2 269.6 264.5 269.8 265.2C270 265.9 267.8 267 271.1 265.2C274.4 263.4 284.5 256.8 289.4 254.5C294.3 252.3 297.2 252.1 300.5 251.6C303.8 251 306.6 251 309.5 251.1C312.4 251.3 315.1 251.7 318 252.4C320.8 253.1 323.9 254.3 326.5 255.4C329.1 256.5 330.3 257 333.7 259.2C337.2 261.5 344.8 267.8 347 269C349.1 270.2 347.5 268.2 346.5 266.5C345.6 264.8 343.9 261.7 341.4 258.8C338.9 255.9 335.2 251.8 331.6 249C328 246.2 323.5 243.5 319.7 241.8C315.9 240 313.4 239.1 309 238.8C304.7 238.4 298.2 238.7 293.7 239.6C289.2 240.5 285.5 242.3 282.2 244.3C278.9 246.3 276.2 248.8 274.1 251.6C272 254.3 270.5 258.7 269.8 260.9Z"/>
<path fill="#49230c" d="M241.3 260.5C240.6 258.2 239.2 254.3 237 251.6C234.8 248.8 231.3 245.9 228.1 243.9C224.8 241.9 221.7 240.5 217.4 239.6C213.2 238.8 206.8 238.4 202.5 238.8C198.2 239.1 195.3 240 191.4 241.8C187.6 243.5 183.1 246.2 179.5 249C175.9 251.8 172.3 255.5 169.7 258.8C167.1 262.1 163 268.5 164.2 268.6C165.3 268.7 173.1 261.9 176.5 259.6C179.9 257.4 180.5 256.8 184.6 255.4C188.7 254 197 251.8 201.2 251.1C205.5 250.5 207 251.1 210.2 251.6C213.4 252.1 215.4 251.8 220.4 254.1C225.4 256.4 236.5 263.3 240 265.2C243.5 267 241.1 266 241.3 265.2C241.5 264.4 242 262.8 241.3 260.5Z"/>
</svg>
````

## The template face (for reference)

| What | x | y |
|---|---|---|
| Face width / top / chin | 238 wide, centered on 256 | 154 to 424 |
| Eyes (the pair) | 177 to 335 | 269 to 315, center 292 |
| Brow box (the game fits brows into it) | 164 to 348 (184 wide) | 231 to 277 (46 tall), center 254 |
| Middle line (each brow is shown separately either side) | 256 | |

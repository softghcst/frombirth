# One hairstyle, redrawn for each face shape (ChatGPT)

Every adult head has the same skull and ears (`scripts/share_adult_skull.mjs`); only the cheeks, jaw and chin differ.
A hairstyle that hangs beside the jaw can be drawn once on the base head (athletic) and fitted to the others, or drawn
for each face here, so it follows every jaw exactly. Put each face's picture in `assets/hair_png/heads/<style>/<face>.png`
and run `npm run trace-hair <style>`: a face with its own picture wears it as drawn (`scripts/trace_hair_png.py`).

Templates: `assets/hair_templates/faces/adult_head_<face>.png`, each face bald at 1254 x 1254, all in the same frame
as `assets/hair_templates/adult_head_template.png` (the athletic one is the same image).

## How to use

1. New ChatGPT chat. Attach `assets/hair_templates/faces/adult_head_athletic.png` and the style's finished picture on
   athletic (here `assets/hair_png/storybook_waves.png`). Send the first message. ChatGPT replies "Ready."
2. Send the face messages one at a time, each with that face's template attached.
3. Save each picture as named, into `assets/hair_png/heads/storybook_waves/`, or send them to Claude.

## First message

````text
The first image is a cartoon adult's bald head, ears, neck and shoulders (1254 x 1254, transparent) from a 2D
life-simulation game. The second image is a hairstyle drawn for exactly that head, in exactly that position.

This head comes in 7 face shapes. I'll send you the other 6 heads one at a time. They are IDENTICAL above the ears
(same skull, same ears, same size, same position in the image); only the cheeks, jaw and chin are different: some
narrow and pointed, some round and wide.

For each head I send, redraw THIS SAME hairstyle so it fits that face:
- Output a PNG exactly 1254 x 1254 pixels, fully transparent background, hair only (no head, face, ears, neck or
  skin), in exactly the same position. Do not move, resize, crop or re-frame anything.
- Above the ears (everything above y = 675) the hair must be the same as the second image: the same top, part,
  sweep and twist, the same outline, the same strand lines and the same shine shapes, in the same places. Copy it.
- From the ears down, keep the same waves: the same length, the same number of waves, the same curled tips at the
  same height, and the same outside silhouette as closely as possible. Change ONLY the inside edge of the side hair
  beside the face, so it follows THIS face's cheek and jaw with a clear gap (I'll give you the exact numbers).
- Never put hair over the cheeks, jaw or chin, and nothing curls in under the jaw.
- The same colours as the second image: one medium warm brown with a darker shadow tone, a lighter shine tone, dark
  brown strand lines, and the same bold near-black outline (#23140f). Flat colours, no gradients, no texture.
- No hair accessories (no clips, flowers or bows).

Reply to this first message only with: Ready.
````

## One message per face

### Dimple oval: attach `assets/hair_templates/faces/adult_head_dimple_oval.png`, save as `dimple_oval.png`

````text
Here is the next head: DIMPLE OVAL (attached). Same skull, same ears, same position as the first head; only the
cheeks, jaw and chin are different. Redraw the SAME hairstyle for it, following every rule from my first message.
This face's edges, with the gap the hair must keep from them:
    y = 870: hair only LEFT of x = 366 and RIGHT of x = 882
    y = 930: hair only LEFT of x = 390 and RIGHT of x = 858
    y = 990: hair only LEFT of x = 436 and RIGHT of x = 814
    y = 1030: hair only LEFT of x = 484 and RIGHT of x = 765
    y = 1050 and below: only beside or behind the neck (x = 512 to 740), nothing over the chin.
Output the 1254 x 1254 transparent PNG, hair only.
````

### Almond: attach `assets/hair_templates/faces/adult_head_almond.png`, save as `almond.png`

````text
Here is the next head: ALMOND (attached). Same skull, same ears, same position as the first head; only the
cheeks, jaw and chin are different. Redraw the SAME hairstyle for it, following every rule from my first message.
This face's edges, with the gap the hair must keep from them:
    y = 870: hair only LEFT of x = 365 and RIGHT of x = 874
    y = 930: hair only LEFT of x = 396 and RIGHT of x = 846
    y = 990: hair only LEFT of x = 441 and RIGHT of x = 802
    y = 1030: hair only LEFT of x = 488 and RIGHT of x = 756
    y = 1050 and below: only beside or behind the neck (x = 512 to 740), nothing over the chin.
Output the 1254 x 1254 transparent PNG, hair only.
````

### Cherubic: attach `assets/hair_templates/faces/adult_head_cherubic.png`, save as `cherubic.png`

````text
Here is the next head: CHERUBIC (attached). Same skull, same ears, same position as the first head; only the
cheeks, jaw and chin are different. Redraw the SAME hairstyle for it, following every rule from my first message.
This face's edges, with the gap the hair must keep from them:
    y = 870: hair only LEFT of x = 330 and RIGHT of x = 922
    y = 930: hair only LEFT of x = 346 and RIGHT of x = 906
    y = 990: hair only LEFT of x = 392 and RIGHT of x = 859
    y = 1030: hair only LEFT of x = 455 and RIGHT of x = 797
    y = 1050 and below: only beside or behind the neck (x = 512 to 740), nothing over the chin.
Output the 1254 x 1254 transparent PNG, hair only.
````

### Angular: attach `assets/hair_templates/faces/adult_head_angular.png`, save as `angular.png`

````text
Here is the next head: ANGULAR (attached). Same skull, same ears, same position as the first head; only the
cheeks, jaw and chin are different. Redraw the SAME hairstyle for it, following every rule from my first message.
This face's edges, with the gap the hair must keep from them:
    y = 870: hair only LEFT of x = 374 and RIGHT of x = 874
    y = 930: hair only LEFT of x = 405 and RIGHT of x = 841
    y = 990: hair only LEFT of x = 468 and RIGHT of x = 781
    y = 1030: hair only LEFT of x = 497 and RIGHT of x = 755
    y = 1050 and below: only beside or behind the neck (x = 512 to 740), nothing over the chin.
Output the 1254 x 1254 transparent PNG, hair only.
````

### Sculpted: attach `assets/hair_templates/faces/adult_head_sculpted.png`, save as `sculpted.png`

````text
Here is the next head: SCULPTED (attached). Same skull, same ears, same position as the first head; only the
cheeks, jaw and chin are different. Redraw the SAME hairstyle for it, following every rule from my first message.
This face's edges, with the gap the hair must keep from them:
    y = 870: hair only LEFT of x = 382 and RIGHT of x = 865
    y = 930: hair only LEFT of x = 413 and RIGHT of x = 836
    y = 990: hair only LEFT of x = 469 and RIGHT of x = 781
    y = 1030: hair only LEFT of x = 497 and RIGHT of x = 755
    y = 1050 and below: only beside or behind the neck (x = 512 to 740), nothing over the chin.
Output the 1254 x 1254 transparent PNG, hair only.
````

### Pixie: attach `assets/hair_templates/faces/adult_head_pixie.png`, save as `pixie.png`

````text
Here is the next head: PIXIE (attached). Same skull, same ears, same position as the first head; only the
cheeks, jaw and chin are different. Redraw the SAME hairstyle for it, following every rule from my first message.
This face's edges, with the gap the hair must keep from them:
    y = 870: hair only LEFT of x = 322 and RIGHT of x = 923
    y = 930: hair only LEFT of x = 396 and RIGHT of x = 851
    y = 990: hair only LEFT of x = 466 and RIGHT of x = 782
    y = 1030: hair only LEFT of x = 497 and RIGHT of x = 755
    y = 1050 and below: only beside or behind the neck (x = 512 to 740), nothing over the chin.
Output the 1254 x 1254 transparent PNG, hair only.
````

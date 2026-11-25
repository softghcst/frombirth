# Women's hairstyles: ChatGPT prompts

Generated from `assets/CHATGPT_HAIR_PROMPT.md`: the base head is `athletic` (the adult head with the shared neck).

## How to use

1. Start a **new ChatGPT chat** and paste **Message 1** (everything in its box, including the long head SVG). ChatGPT replies "Ready."
2. Then send the style messages **one at a time**, in the same chat. Each reply is one SVG. (A whole batch in one reply gets cut off part-way.)
3. Save each reply as the file name given above it, or paste the replies into `assets/raw_batch.txt`, each under its `### file_name.svg` line, and send them to Claude to fit to every head.
4. If a style comes back wrong, reply in the same chat: "Redo it following the rules: " and say what to fix (a gap of bare scalp, hair over the eyes, a darker shade, missing attributes).

## Message 1: the rules and the head

````text
You are drawing hairstyles for a 2D game avatar, one per message. I am giving you the exact bald base head every hairstyle
must fit. For each message I send after this one, draw ONLY that hairstyle, as a single standalone SVG file, in the same
coordinate system as the head. Follow every rule below for every hairstyle.

Reply to this first message only with: Ready.

RULES (all required):
1. Output one complete SVG and nothing else: no explanation, no markdown fences.
2. Root element exactly: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
   Use the head's coordinates directly. No transform attributes anywhere, no <image>, <use>, <text>, filters,
   gradients, masks, clipPaths or <style> blocks. Only <path> elements, inside these four groups, in this order:
     <g id="hair_back">   hair that is BEHIND the head: the back of the hair, and any lengths that fall behind the
                          neck and shoulders. Drawn behind the head, so it only shows outside it.
     <g id="hair_base">   the main mass in FRONT of the head: the cap over the skull from the crown down to the
                          hairline, and the sideburns or side lengths.
     <g id="hair_bangs">  the fringe/bangs and any locks that fall over the forehead or face (may be empty).
     <g id="hair_lines">  strand and texture lines, and highlights, drawn on top (fill="none", strokes only).
3. Do NOT include the head, face, ears, neck or any skin in your output. Hair only.
4. Fit the head exactly, using these landmarks of the base head (x, y in the 512 frame, y points down):
   - crown_top 255.6, 150.0: the hair must cover the top of the skull, sitting on or above this point.
   - forehead_mid 254.5, 211.9: the hairline. A fringe/bangs may come lower; otherwise keep the face below this clear.
   - temple_left 141.9, 254.0 and temple_right 366.8, 254.0: the hair must wrap the skull outline at these points, about 5 units outside it (never leave a gap of bare scalp).
   - ear_left 144.9, 275.5 and ear_right 364.3, 275.5: where the ears attach. Sideburns or the side hairline end here; longer hair may fall past it.
   - Keep the face itself (eyes, nose and mouth area, roughly x 175-335, y 250-415) clear, except for a fringe or strands that deliberately fall over it.
5. Long hair may fall behind the shoulders down to the bottom of the frame (y 512); keep everything within x 0-512.
6. Colours: the main hair colour is exactly #8f4b29 (the fill of the main shape in hair_base, and of hair_bangs).
   Every hair shape is that same #8f4b29, hair_back included: no darker shades for any part of the hair, so it reads as
   one head of hair. You may add a few small lighter highlight shapes (a streak of shine, fill #b8693d, no outline). Texture
   lines are a darker brown such as #4a2414, highlight lines a lighter brown such as #b8693d. The game dyes all of it together.
7. Outline: every hair shape is outlined with stroke="#23140f" stroke-width="6" stroke-linejoin="round" (the same
   dark brown and weight as the head's outline). Texture lines in hair_lines use stroke-width 3 with round caps.
8. Style: match the head's flat, clean cartoon look: smooth curves, bold outline, no texture noise, no tiny specks.
9. For a buzz cut or skin fade (hair that hugs the skull), add data-clip-to-head="true" to the root <svg>: the game
   then clips the hair to the head's exact outline, so it can be drawn slightly oversized with no overhang.

10. On the root <svg>, after its other attributes, add the attributes I give with each hairstyle, exactly as I give them:
   data-name (its name in the game), data-gender, data-length (short, medium, long or updo), data-type (its hair texture:
   straight, wavy, curly or coily) and data-min-age. They tell the game who the style is for.
11. Draw the texture so it reads at a glance: straight hair as smooth sheets with a few long strand lines; wavy as loose S-bends;
   curly as defined ringlets and spirals with a rounded outline; coily as a dense, springy, rounded mass with small tight
   coils along its edge (not separate spirals). Keep it the same flat cartoon style as the head, with bold outlines.

Here is the base head (`athletic`). Use it only as the reference shape; do not return it:

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" data-pathways="1" data-shared-neck="1" data-face-chin="422" data-outline-chin="431.5"><g id="art"><path style="fill:#23140f" fill-rule="evenodd" d="M335.32 404Q338.69 401.11 341.7 398.3L341.7 398.3Q349.2 391.2 350.1 389.9L350.1 389.9Q351 388.5 351.4 385L351.4 385Q351.9 381.5 352.3 381L352.3 381Q352.7 380.6 353.2 366.9L353.2 366.9Q353.6 353.2 354.1 352.8L354.1 352.8Q354.5 352.3 358.9 351.9L358.9 351.9Q363.3 351.4 366.9 349.7L366.9 349.7Q370.4 347.9 376.2 342.6L376.2 342.6Q381.9 337.3 385.9 330.7L385.9 330.7Q389.8 324 391.2 320.1L391.2 320.1Q392.5 316.1 392.5 314.8L392.5 314.8Q392.5 313.4 392.9 313L392.9 313Q393.4 312.6 393.4 309L393.4 309Q393.4 305.5 393.8 305L393.8 305Q394.3 304.6 393.8 304.2L393.8 304.2Q393.4 303.7 393.4 300.2L393.4 300.2Q393.4 296.7 392.5 294L392.5 294Q391.6 291.4 389.8 288.3L389.8 288.3Q388.1 285.2 384.5 282.1L384.5 282.1Q381 279 378.4 278.1L378.4 278.1Q375.7 277.2 370.4 277.2L370.4 277.2Q365.1 277.2 364.7 276.8L364.7 276.8Q364.2 276.3 364.2 273.7L364.2 273.7Q364.2 271 365.1 268.4L365.1 268.4Q366 265.7 366 261.8L366 261.8Q366 257.8 366.4 257.3L366.4 257.3Q366.9 256.9 366.9 247.2L366.9 247.2Q366.9 237.5 366.4 237L366.4 237Q366 236.6 366 233.5L366 233.5Q366 230.4 365.5 230L365.5 230Q365.1 229.5 365.1 227.7L365.1 227.7Q365.1 226 364.7 225.5L364.7 225.5Q364.2 225.1 364.2 223.3L364.2 223.3Q364.2 221.6 363.8 221.1L363.8 221.1Q363.3 220.7 362.9 218L362.9 218Q362.5 215.4 361.6 214.1L361.6 214.1Q360.7 212.7 359.8 209.6L359.8 209.6Q358.9 206.5 356.3 201.7L356.3 201.7Q353.6 196.8 350.5 192.4L350.5 192.4Q347.4 188 340.8 181.4L340.8 181.4Q334.2 174.7 329.3 171.2L329.3 171.2Q324.5 167.7 317.8 164.1L317.8 164.1Q311.2 160.6 306.8 159.3L306.8 159.3Q302.4 158 301.1 157.1L301.1 157.1Q299.7 156.2 298.4 156.2L298.4 156.2Q297.1 156.2 293.5 154.9L293.5 154.9Q290 153.5 286 153.1L286 153.1Q282.1 152.7 281.6 152.2L281.6 152.2Q281.2 151.8 274.6 151.3L274.6 151.3Q267.9 150.9 267.5 150.4L267.5 150.4Q267 150 255.6 150L255.6 150Q244.1 150 243.6 150.4L243.6 150.4Q243.2 150.9 238.8 150.9L238.8 150.9Q234.4 150.9 233.9 151.3L233.9 151.3Q233.5 151.8 228.6 152.2L228.6 152.2Q223.8 152.7 223.3 153.1L223.3 153.1Q222.9 153.5 221.1 153.5L221.1 153.5Q219.3 153.5 218.9 154L218.9 154Q218.5 154.4 217.1 154.4L217.1 154.4Q215.8 154.4 214 155.3L214 155.3Q212.3 156.2 210.9 156.2L210.9 156.2Q209.6 156.2 207 157.1L207 157.1Q204.3 158 193.7 163.3Q183.1 168.6 176.9 173.4L176.9 173.4Q170.7 178.3 165.9 183.6L165.9 183.6Q161 188.9 157.5 194.2L157.5 194.2Q154 199.5 151.3 204.8L151.3 204.8Q148.7 210.1 146.9 215.4L146.9 215.4Q145.1 220.7 144.7 223.8L144.7 223.8Q144.2 226.9 143.8 227.3L143.8 227.3Q143.4 227.7 142.9 233.9L142.9 233.9Q142.5 240.1 142 240.6L142 240.6Q141.6 241 141.6 247.6L141.6 247.6Q141.6 254.2 142 254.7L142 254.7Q142.5 255.1 142.5 259.1L142.5 259.1Q142.5 263.1 142.9 263.5L142.9 263.5Q143.4 264 143.4 266.2L143.4 266.2Q143.4 268.4 143.8 268.8L143.8 268.8Q144.2 269.3 144.7 273.2L144.7 273.2Q145.1 277.2 144.7 277.7L144.7 277.7Q144.2 278.1 139.8 277.7L139.8 277.7Q135.4 277.2 135 277.7L135 277.7Q134.5 278.1 131.4 278.5L131.4 278.5Q128.3 279 123.9 283L123.9 283Q119.5 286.9 118.2 289.6L118.2 289.6Q116.9 292.2 116.4 295.3L116.4 295.3Q116 298.4 115.5 298.9L115.5 298.9Q115.1 299.3 115.1 305.5L115.1 305.5Q115.1 311.7 115.5 312.1L115.5 312.1Q116 312.6 116 314.3L116 314.3Q116 316.1 117.3 320.1L117.3 320.1Q118.6 324 120.8 328.5L120.8 328.5Q123 332.9 126.1 336.9L126.1 336.9Q129.2 340.8 133.2 344.4L133.2 344.4Q137.2 347.9 140.7 349.7L140.7 349.7Q144.2 351.4 147.3 351.9L147.3 351.9Q150.4 352.3 150.9 352.8L150.9 352.8Q151.3 353.2 153.1 353.2L153.1 353.2Q154.8 353.2 155.3 353.6L155.3 353.6Q155.7 354.1 156.2 365.6L156.2 365.6Q156.6 377.1 157.1 377.5L157.1 377.5Q157.5 377.9 157.5 381L157.5 381Q157.5 384.1 158.8 387.7L158.8 387.7Q160.1 391.2 167.2 397.8L167.2 397.8Q170.34 400.72 174.25 404L174.2 404L174.8 404.4L175.4 405L176.9 406.1L178.7 407.7L178.8 407.8L180.3 409L180.4 409L181.9 410.2L183.3 411.1L183.8 411.6L183.9 411.6L184.4 412.1L186.6 413.8L189 416.1L189 416.2L189.8 416.9L190.5 417.8L190.5 417.9L191.3 418.7L191.4 419.1L192.6 420.8L193.1 421.8L193.4 422.6L193.8 423.2L193.8 423.5L197.6 425L197.8 425L197.9 425.1L198.4 425.3L198.6 425.4L199.1 425.5L199.8 425.8L200.1 425.9L200.2 426L200.7 426.1L200.8 426.2L201.3 426.4L202.1 426.7L202.3 426.8L202.4 426.9L202.9 427L204.3 427.6L204.6 427.6L204.7 427.7L205.1 427.8L205.3 427.6L206.6 427.6L206.8 427.8L207.8 428L208.2 428.3L208.9 428.6L209 428.7L209 445.9L208.7 446L208.6 446.2L208.4 447.3L208.1 447.9L207.1 449L205.1 450.3L202.4 451.6L197.8 453.2L191.2 455.4L172.2 461L163.1 463.9L157.4 465.8L147.2 469.4L143.1 471.2L136.9 474.4L132.1 477.1L129.8 478.6L127.7 480.3L123.1 484.4L120.3 487.3L116.9 491.4L114.9 494.3L113.6 496.3L110.5 502.3L109.4 504.9L108.9 506.6L108.6 507.7L108.6 509.1L109 510.6L109.8 511.4L110.4 511.6L111.4 511.7L112.4 511.6L113.7 511L115.3 510.9L130.3 510.6L172.2 511L208.7 511.1L260.8 511.1L343.9 511L368.1 510.8L386.9 510.6L397.7 511L398.1 511.1L398.4 511.5L398.7 511.6L399.4 511.8L400.3 512L401.3 511.9L402.2 511.3L402.6 510.9L403.1 510.2L403.3 509.1L403.4 508.3L403.2 507.3L402.6 505.4L401.2 502.3L399.2 498.3L397.2 494.6L395.6 492.1L394.4 490.7L391.3 487.6L385.1 481.8L380.3 477.9L378.4 476.5L375.1 474.3L370.9 471.9L365.8 469.4L361.6 467.8L357.6 466.5L355.2 465.6L353.7 465L352.1 464L350.8 463.6L349.7 463.6L347.1 463L343.3 461.4L342.2 461L340.2 460.9L339.4 460.6L337.2 459.6L335.7 459.1L334.4 459.1L333.2 458.9L328.2 456.9L326.8 456.5L325.1 456.4L324.2 456.1L322.1 455.2L321.2 454.9L318.7 454.6L316.7 454.1L313.1 453L308.7 451.5L306.3 450.5L304.8 449.7L303.3 448.6L301.9 447.2L301.8 447.1L302 446.9L302 429.2L303.2 428.7L303.6 428.5L303.8 428.5L304.3 428.1L304.7 428.1L304.8 428L305.2 428L305.3 427.9L305.9 427.8L307.4 427.9L316.8 422L317 421.8L317.6 420.4L319 418.4L319 418.3L320.8 416.2L322.4 414.6L322.6 414.5L323.9 413.1L324.1 413.1L325.1 412.3L325.2 412.2L327.8 410.1L327.9 410.1L329.1 409.2L330.8 407.6L331.1 407.6L331.6 407.2L333.9 405.1L334.9 404.3L335.25 404Z"/><path id="skin" style="fill:var(--skin-color,#da965e)" fill-rule="evenodd" d="M373.5 295.8Q376.6 295.8 377 296.2L377 296.2Q377.5 296.7 377.5 297.5L377.5 297.5Q377.5 298.4 377 298.9L377 298.9Q376.6 299.3 375.3 299.3L375.3 299.3Q373.9 299.3 372.2 300.2L372.2 300.2Q370.4 301.1 368.2 303.3L368.2 303.3Q366 305.5 364.2 308.6L364.2 308.6Q362.5 311.7 362.9 313.4L362.9 313.4Q363.3 315.2 362.9 315.6L362.9 315.6Q362.5 316.1 361.6 316.1L361.6 316.1Q360.7 316.1 359.8 317L359.8 317Q358.9 317.9 358 317.9L358 317.9Q357.2 317.9 356.7 317.4L356.7 317.4Q356.3 317 356.3 316.1L356.3 316.1Q356.3 315.2 356.7 314.8L356.7 314.8Q357.2 314.3 357.6 312.1L357.6 312.1Q358 309.9 359.8 306.8L359.8 306.8Q361.6 303.7 365.1 300.2L365.1 300.2Q368.6 296.7 369.5 296.2L369.5 296.2Q370.4 295.8 373.5 295.8ZM134.1 296.7Q135.4 295.8 138.1 296.2L138.1 296.2Q140.7 296.7 141.6 297.1L141.6 297.1Q142.5 297.5 145.6 300.6L145.6 300.6Q148.7 303.7 149.1 305L149.1 305Q149.5 306.4 150.9 308.1L150.9 308.1Q152.2 309.9 152.2 310.8L152.2 310.8Q152.2 311.7 153.1 313.4L153.1 313.4Q154 315.2 154 316.1L154 316.1Q154 317 153.5 317.4L153.5 317.4Q153.1 317.9 152.2 317.9L152.2 317.9Q151.3 317.9 149.5 316.5L149.5 316.5Q147.8 315.2 147.8 313.4L147.8 313.4Q147.8 311.7 146.9 309.9L146.9 309.9Q146 308.1 142.9 304.6L142.9 304.6Q139.8 301.1 138.9 301.1L138.9 301.1Q138.1 301.1 137.6 300.6L137.6 300.6Q137.2 300.2 135.4 300.2L135.4 300.2Q133.6 300.2 133.2 299.7L133.2 299.7Q132.8 299.3 132.8 298.4L132.8 298.4Q132.8 297.5 134.1 296.7ZM216.1 431.6L218.1 432.4L218.3 432.4L218.4 432.5L219.2 432.5L219.3 432.6L219.6 432.6L220.6 433.1L220.8 433.1L220.9 433.2L221.7 433.5L222.2 433.5L222.3 433.6L223.7 433.6L223.8 433.7L224.9 433.8L225.1 433.8L226.2 433.9L226.3 434L227.7 434L227.8 434.1L229.1 434.1L229.3 434.2L230.2 434.3L230.3 434.3L231.1 434.4L231.2 434.5L232.1 434.5L232.2 434.6L232.6 434.6L232.8 434.8L233.1 434.9L233.3 435.1L233.8 435.1L234.1 435.2L234.7 435.3L234.8 435.4L239.4 435.4L239.7 435.5L241.2 435.5L241.3 435.6L241.7 435.6L242.1 435.9L242.4 435.9L242.6 436L244.2 436L244.4 436.1L265.8 436.1L266.1 436L267.7 436L267.8 435.9L268.3 435.9L268.7 435.6L269.2 435.6L269.3 435.5L271.2 435.5L271.3 435.4L275.9 435.3L276.2 435.3L277.6 435.2L277.8 435.1L278.6 435.1L279.1 434.8L279.4 434.6L280.2 434.6L280.3 434.5L282.9 434.5L283.2 434.5L283.3 434.4L284.2 434.4L284.3 434.3L284.7 434.2L284.8 434.1L285.1 434.1L285.9 433.6L286.8 433.6L286.9 433.5L289.7 433.5L289.8 433.4L290.2 433.4L290.6 433L290.9 432.9L291.1 432.8L291.7 432.7L292.2 432.6L292.9 432.6L293.7 432.4L294.3 432L294.9 431.9L295 431.9L295 446.9L295.1 447L296.2 447L296.3 447.1L296.9 448.2L297.4 451.2L297.8 452.3L298.4 453.6L299.2 454.2L299.9 454.6L301.4 454.8L302.7 455L306.2 456.6L309.1 457.6L312.4 458.5L313.9 459L315.2 459.5L316.4 460.2L317.4 460.7L318.9 461.2L321.9 462L322.6 462.5L322.8 462.6L325.6 462.9L328.8 464.2L330.8 464.6L331.8 465.3L333.4 465.5L334.7 466.2L335.9 466.4L336.8 467L337.2 467.1L339.9 467.4L343.8 469L345.2 469.1L345.8 469.6L346.3 469.8L347.8 470L348.9 470.7L350.4 470.9L350.9 471.1L351.7 471.6L353.3 471.9L354.2 472.5L355.3 472.7L356.2 472.9L360.1 475L361.9 475.4L366.6 477.4L368.6 478.4L372.9 481.2L378.2 484.9L378.9 485.1L379.4 485.5L382.4 488.3L387.6 493.6L389 495.2L389.4 496.1L391.2 498.2L392.1 499.6L393 501.2L395.6 506.3L397 509.6L397.1 510.2L396.8 510.3L388.1 510.6L367.8 510.9L301.9 511L216.2 511.1L170.6 511L133.1 510.6L118.3 510.1L117.2 510L116.7 509.8L116.9 508.7L117.5 506.8L118.5 504.7L121 500.1L122.4 498.1L126 493.7L126.8 492.3L128.8 490.3L131.9 487.4L134.6 485.3L137.3 483.4L142.2 480.7L143.1 480.1L143.8 479.4L144.6 478.9L147.9 477.3L148.4 477.1L149.4 477L150.2 476.7L154.3 474.6L158.7 473.4L161.4 471.9L164.3 471.5L165.3 471.1L167.3 470.1L168.3 469.9L169.2 469.9L170.4 469.2L170.9 469L172.6 468.9L174.2 468.5L176.4 467.4L178.4 467.1L179.6 466.4L181.1 466.2L182.2 465.5L183.9 465.2L184.8 464.7L185.2 464.5L186.2 464.5L186.6 464.4L187.7 463.6L189.2 463.5L190.3 462.8L192.2 462.5L192.6 462.1L193.1 461.9L194.6 461.7L195.7 461L197.2 460.7L199.2 460L205.3 457L207.8 456.3L209.9 455.8L211.3 455.3L212.1 455L213 454.1L213.3 453.4L214.3 449.8L215 448.4L215.2 447.1L215.3 447L215.9 447L216 446.9L216 431.7L216.1 431.6ZM327.53 404Q328.95 402.7 329.3 402.7L329.3 402.7Q329.8 402.7 336.4 396.5L336.4 396.5Q343 390.3 343.9 389.9L343.9 389.9Q344.8 389.4 345.7 387.7L345.7 387.7Q346.6 385.9 346.6 384.1L346.6 384.1Q346.6 382.4 347 381.9L347 381.9Q347.4 381.5 347.4 377.1L347.4 377.1Q347.4 372.6 347.9 372.2L347.9 372.2Q348.3 371.7 348.3 362.9L348.3 362.9Q348.3 354.1 348.8 353.6L348.8 353.6Q349.2 353.2 349.2 343.9L349.2 343.9Q349.2 334.6 349.6 334.2L349.6 334.2Q350.1 333.8 350.1 326.3L350.1 326.3Q350.1 318.7 350.5 318.3L350.5 318.3Q351 317.9 351.9 317.9L351.9 317.9Q352.7 317.9 353.2 318.3L353.2 318.3Q353.6 318.7 353.6 323.2L353.6 323.2Q353.6 327.6 354.1 328L354.1 328Q354.5 328.5 354.5 333.3L354.5 333.3Q354.5 338.2 354.9 338.6L354.9 338.6Q355.4 339.1 355.4 343L355.4 343Q355.4 347 355.8 347.5L355.8 347.5Q356.3 347.9 356.7 347.5L356.7 347.5Q357.2 347 358.9 347L358.9 347Q360.7 347 361.1 346.6L361.1 346.6Q361.6 346.1 362.5 346.1L362.5 346.1Q363.3 346.1 365.1 345.2L365.1 345.2Q366.9 344.4 367.8 343.5L367.8 343.5Q368.6 342.6 369.1 342.6L369.1 342.6Q369.5 342.6 373.9 338.2L373.9 338.2Q378.4 333.8 381.9 327.6L381.9 327.6Q385.4 321.4 385.4 320.5L385.4 320.5Q385.4 319.6 386.3 317.9L386.3 317.9Q387.2 316.1 387.2 314.3L387.2 314.3Q387.2 312.6 387.6 312.1L387.6 312.1Q388.1 311.7 388.1 305L388.1 305Q388.1 298.4 387.6 298L387.6 298Q387.2 297.5 386.8 295.3L386.8 295.3Q386.3 293.1 385 291.4L385 291.4Q383.7 289.6 383.7 289.1L383.7 289.1Q383.7 288.7 381.5 286.9L381.5 286.9Q379.2 285.2 378.4 285.2L378.4 285.2Q377.5 285.2 375.7 284.3L375.7 284.3Q373.9 283.4 371.7 283.4L371.7 283.4Q369.5 283.4 369.1 283.8L369.1 283.8Q368.6 284.3 366.4 284.7L366.4 284.7Q364.2 285.2 363.3 286.1L363.3 286.1Q362.5 286.9 362 286.9L362 286.9Q361.6 286.9 358.9 289.6L358.9 289.6Q356.3 292.2 355.8 293.1L355.8 293.1Q355.4 294 354.5 294L354.5 294Q353.6 294 353.2 293.6L353.2 293.6Q352.7 293.1 352.7 292.2L352.7 292.2Q352.7 291.4 354.1 288.7L354.1 288.7Q355.4 286.1 356.3 285.2L356.3 285.2Q357.2 284.3 357.6 280.8L357.6 280.8Q358 277.2 358.5 276.8L358.5 276.8Q358.9 276.3 358.9 275L358.9 275Q358.9 273.7 359.4 273.2L359.4 273.2Q359.8 272.8 360.2 266.6L360.2 266.6Q360.7 260.4 361.1 260L361.1 260Q361.6 259.5 361.6 248.5L361.6 248.5Q361.6 237.5 361.1 237L361.1 237Q360.7 236.6 360.7 233.9L360.7 233.9Q360.7 231.3 360.2 230.8L360.2 230.8Q359.8 230.4 359.8 228.6L359.8 228.6Q359.8 226.9 359.4 226.4L359.4 226.4Q358.9 226 358.9 224.7L358.9 224.7Q358.9 223.3 358.5 222.9L358.5 222.9Q358 222.4 357.2 218.9L357.2 218.9Q356.3 215.4 355.4 214.1L355.4 214.1Q354.5 212.7 354.5 211.8L354.5 211.8Q354.5 211 352.3 206.5L352.3 206.5Q350.1 202.1 349.2 201.2L349.2 201.2Q348.3 200.4 346.6 197.3L346.6 197.3Q344.8 194.2 342.6 192L342.6 192Q340.4 189.8 340.4 189.3L340.4 189.3Q340.4 188.9 334.6 183.6L334.6 183.6Q328.9 178.3 328.4 178.3L328.4 178.3Q328 178.3 326.7 176.9L326.7 176.9Q325.4 175.6 322.7 174.3L322.7 174.3Q320.1 173 319.2 172.1L319.2 172.1Q318.3 171.2 313.9 169L313.9 169Q309.4 166.8 308.6 166.8L308.6 166.8Q307.7 166.8 306.4 165.9L306.4 165.9Q305 165 304.1 165L304.1 165Q303.3 165 302.8 164.6L302.8 164.6Q302.4 164.1 301.5 164.1L301.5 164.1Q300.6 164.1 298.8 163.3L298.8 163.3Q297.1 162.4 295.8 162.4L295.8 162.4Q294.4 162.4 294 161.9L294 161.9Q293.5 161.5 290.5 161L290.5 161Q287.4 160.6 286.9 160.2L286.9 160.2Q286.5 159.7 281.2 159.3L281.2 159.3Q275.9 158.8 275.4 158.4L275.4 158.4Q275 158 270.6 158L270.6 158Q266.2 158 265.7 157.5L265.7 157.5Q265.3 157.1 256 157.1L256 157.1Q246.7 157.1 246.3 157.5L246.3 157.5Q245.8 158 241 158L241 158Q236.1 158 235.7 158.4L235.7 158.4Q235.2 158.8 232.6 158.8L232.6 158.8Q229.9 158.8 229.5 159.3L229.5 159.3Q229.1 159.7 227.3 159.7L227.3 159.7Q225.5 159.7 225.1 160.2L225.1 160.2Q224.6 160.6 222.9 160.6L222.9 160.6Q221.1 160.6 220.7 161L220.7 161Q220.2 161.5 218.9 161.5L218.9 161.5Q217.6 161.5 215.8 162.4L215.8 162.4Q214 163.3 212.7 163.3Q211.4 163.3 210.1 164.1L210.1 164.1Q208.7 165 205.2 165.9L205.2 165.9Q201.7 166.8 193.7 171.2L193.7 171.2Q185.8 175.6 184.4 176.9L184.4 176.9Q183.1 178.3 182.7 178.3L182.7 178.3Q182.2 178.3 180.9 179.6L180.9 179.6Q179.6 180.9 179.1 180.9L179.1 180.9Q178.7 180.9 174.3 185.3L174.3 185.3Q169.9 189.8 169.9 190.2L169.9 190.2Q169.9 190.6 168.1 192.4L168.1 192.4Q166.3 194.2 166.3 194.6L166.3 194.6Q166.3 195.1 164.1 197.7L164.1 197.7Q161.9 200.4 158.4 207.4L158.4 207.4Q154.8 214.5 154.8 215.4L154.8 215.4Q154.8 216.3 154.4 216.7L154.4 216.7Q154 217.1 154 218L154 218Q154 218.9 153.1 220.7L153.1 220.7Q152.2 222.4 152.2 223.8L152.2 223.8Q152.2 225.1 151.8 225.5L151.8 225.5Q151.3 226 151.3 227.3L151.3 227.3Q151.3 228.6 150.9 229.1L150.9 229.1Q150.4 229.5 150.4 231.7L150.4 231.7Q150.4 233.9 150 234.4L150 234.4Q149.5 234.8 149.5 238.8L149.5 238.8Q149.5 242.8 149.1 243.2L149.1 243.2Q148.7 243.6 148.7 248.9L148.7 248.9Q148.7 254.2 149.1 254.7L149.1 254.7Q149.5 255.1 149.5 259.5L149.5 259.5Q149.5 264 150 264.4L150 264.4Q150.4 264.9 150.4 267.1L150.4 267.1Q150.4 269.3 150.9 269.7L150.9 269.7Q151.3 270.2 151.3 271.9L151.3 271.9Q151.3 273.7 151.8 274.1L151.8 274.1Q152.2 274.6 152.6 278.5L152.6 278.5Q153.1 282.5 153.5 283L153.5 283Q154 283.4 154.4 285.2L154.4 285.2Q154.8 286.9 156.2 288.7L156.2 288.7Q157.5 290.5 157.5 291.4L157.5 291.4Q157.5 292.2 157.1 292.7L157.1 292.7Q156.6 293.1 155.7 293.1L155.7 293.1Q154.8 293.1 152.2 290.5L152.2 290.5Q149.5 287.8 146 286.1L146 286.1Q142.5 284.3 138.5 284.3L138.5 284.3Q134.5 284.3 131.9 285.6L131.9 285.6Q129.2 286.9 127 289.6L127 289.6Q124.8 292.2 124.4 294L124.4 294Q123.9 295.8 123.5 296.2L123.5 296.2Q123 296.7 123 298L123 298Q123 299.3 122.6 299.7L122.6 299.7Q122.2 300.2 122.2 305.9L122.2 305.9Q122.2 311.7 122.6 312.1L122.6 312.1Q123 312.6 123 314.3L123 314.3Q123 316.1 123.5 316.5L123.5 316.5Q123.9 317 124.4 319.2L124.4 319.2Q124.8 321.4 127 325.8L127 325.8Q129.2 330.2 131.4 332.9L131.4 332.9Q133.6 335.5 133.6 336L133.6 336Q133.6 336.4 135.8 338.6L135.8 338.6Q138.1 340.8 138.5 340.8L138.5 340.8Q138.9 340.8 141.6 343L141.6 343Q144.2 345.2 146 345.7L146 345.7Q147.8 346.1 148.2 346.6L148.2 346.6Q148.7 347 149.5 347L149.5 347Q150.4 347 150.9 347.5L150.9 347.5Q151.3 347.9 153.5 347.9L153.5 347.9Q155.7 347.9 155.7 339.9L155.7 339.9Q155.7 332 156.2 331.6L156.2 331.6Q156.6 331.1 156.6 327.1L156.6 327.1Q156.6 323.2 157.1 322.7L157.1 322.7Q157.5 322.3 158.4 322.3L158.4 322.3Q159.3 322.3 159.7 322.7L159.7 322.7Q160.1 323.2 160.1 324.5L160.1 324.5Q160.1 325.8 160.6 326.3L160.6 326.3Q161 326.7 161 334.6L161 334.6Q161 342.6 161.5 343L161.5 343Q161.9 343.5 161.9 348.8L161.9 348.8Q161.9 354.1 162.4 354.5L162.4 354.5Q162.8 355 162.8 361.1L162.8 361.1Q162.8 367.3 163.2 367.8L163.2 367.8Q163.7 368.2 163.7 373.1L163.7 373.1Q163.7 377.9 164.1 378.4L164.1 378.4Q164.6 378.8 164.6 381.5L164.6 381.5Q164.6 384.1 165 384.6L165 384.6Q165.4 385 165.4 386.3L165.4 386.3Q165.4 387.7 173.4 395.2L173.4 395.2Q181.3 402.7 181.8 402.7L181.8 402.7Q182.2 402.7 183.6 404L183.58 404L184.7 405L186.1 405.7L188.2 407.6L188.7 408L189.4 408.3L191.7 410.3L193.1 410.9L195.8 413.3L198.2 414.6L199.3 415.4L204.3 419.2L205.3 419.7L206.8 420.4L209.1 422.1L211.7 423.6L213.8 424.6L215.8 425.4L216.7 425.6L218.2 425.7L219.2 426.2L219.7 426.4L221.2 426.5L224.4 426.5L225.2 426.6L226.2 427.1L227.8 427.4L234.6 427.5L235.4 427.6L236.3 428L238.4 428.1L250.3 428.3L267.5 428.2L273.2 428L274.2 427.7L275.2 427.5L282.6 427.3L284.1 427.1L285.2 426.6L286.1 426.5L289.7 426.5L291.4 426.4L293.2 425.6L294.8 425.5L296.4 425L300.2 423.5L303.1 422.1L305.1 421L307.1 419.4L310.1 417.7L310.9 417.1L313.1 415.1L314.2 414.6L316.1 412.9L316.7 412.5L317.6 412.1L320.1 409.9L320.9 409.5L324.3 406.5L325.7 405.8L327.58 404Z"/></g></svg>
````

## The 15 hairstyles

Straight: 4 · Wavy: 3 · Curly: 4 · Coily: 4. Every one is a women's style, from age 13 (as the other grown-up styles are).
Checked against the 43 women's and unisex styles in the game: none repeats one.

### 1. Blunt Bob with Bangs (straight, short): `blunt_bob_bangs.svg`

````text
HAIRSTYLE: A sleek, chin-length blunt bob, cut straight across at the jaw, with full straight-across bangs that stop just above the eyebrows. Smooth and glossy, tucked neatly at the sides.

Root attributes: data-name="Blunt Bob with Bangs" data-gender="female" data-length="short" data-type="straight" data-min-age="13"
File name: blunt_bob_bangs.svg
````

### 2. Half-Up Top Knot (straight, medium): `half_up_top_knot.svg`

````text
HAIRSTYLE: Straight, shoulder-length hair with the top half pulled up into a small, neat knot on the crown; the rest hangs straight and smooth to the shoulders, with a center part showing below the knot.

Root attributes: data-name="Half-Up Top Knot" data-gender="female" data-length="medium" data-type="straight" data-min-age="13"
File name: half_up_top_knot.svg
````

### 3. Long Curtain Bangs (straight, long): `long_curtain_bangs.svg`

````text
HAIRSTYLE: Long, straight, layered hair that falls well past the shoulders, with soft curtain bangs parted in the middle and sweeping out to frame the cheekbones (the eyes stay clear).

Root attributes: data-name="Long Curtain Bangs" data-gender="female" data-length="long" data-type="straight" data-min-age="13"
File name: long_curtain_bangs.svg
````

### 4. French Twist (straight, updo): `french_twist.svg`

````text
HAIRSTYLE: A smooth, elegant French twist: all the hair swept back and rolled up vertically at the back of the head, the roll showing at one side behind the ear, with a sleek, flat top and no loose strands.

Root attributes: data-name="French Twist" data-gender="female" data-length="updo" data-type="straight" data-min-age="13"
File name: french_twist.svg
````

### 5. Over-the-Shoulder Waves (wavy, long): `over_shoulder_waves.svg`

````text
HAIRSTYLE: Long waves all swept to one side with a deep side part: the hair falls in a full, wavy cascade over one shoulder in front, while the other side is tucked behind the ear and the neck shows.

Root attributes: data-name="Over-the-Shoulder Waves" data-gender="female" data-length="long" data-type="wavy" data-min-age="13"
File name: over_shoulder_waves.svg
````

### 6. Wavy Shag (wavy, medium): `wavy_shag_bangs.svg`

````text
HAIRSTYLE: A choppy, layered shag of shoulder-length waves with wispy, piecey bangs across the forehead and lots of movement at the sides.

Root attributes: data-name="Wavy Shag" data-gender="female" data-length="medium" data-type="wavy" data-min-age="13"
File name: wavy_shag_bangs.svg
````

### 7. Wavy Low Ponytail (wavy, updo): `wavy_low_ponytail.svg`

````text
HAIRSTYLE: Wavy hair gathered loosely at the nape into a low ponytail whose wavy tail shows behind the neck at one side, with soft face-framing waves left loose at both temples.

Root attributes: data-name="Wavy Low Ponytail" data-gender="female" data-length="updo" data-type="wavy" data-min-age="13"
File name: wavy_low_ponytail.svg
````

### 8. Curly Undercut Pixie (curly, short): `curly_undercut_pixie.svg`

````text
HAIRSTYLE: A short curly pixie with one side buzzed close (the shaved side hugs the skull), and a sweep of defined curls on top falling to the other side and onto the forehead.

Root attributes: data-name="Curly Undercut Pixie" data-gender="female" data-length="short" data-type="curly" data-min-age="13"
File name: curly_undercut_pixie.svg
````

### 9. Curly Shoulder Bob (curly, medium): `curly_shoulder_bob.svg`

````text
HAIRSTYLE: A rounded, shoulder-length bob of bouncy, defined ringlets with a center part, full and wide at the cheeks and jaw, curls spilling to the shoulders.

Root attributes: data-name="Curly Shoulder Bob" data-gender="female" data-length="medium" data-type="curly" data-min-age="13"
File name: curly_shoulder_bob.svg
````

### 10. Long Curls with Bangs (curly, long): `long_curls_with_bangs.svg`

````text
HAIRSTYLE: Long curly hair past the shoulders with a full fringe of short, springy curly bangs across the forehead (above the eyebrows), the curls framing the face at both sides.

Root attributes: data-name="Long Curls with Bangs" data-gender="female" data-length="long" data-type="curly" data-min-age="13"
File name: long_curls_with_bangs.svg
````

### 11. Curly Faux Hawk (curly, updo): `curly_faux_hawk.svg`

````text
HAIRSTYLE: Curls pinned up into a ridge that runs from the forehead back over the crown, tall and full in the middle, with the sides smoothed flat against the head.

Root attributes: data-name="Curly Faux Hawk" data-gender="female" data-length="updo" data-type="curly" data-min-age="13"
File name: curly_faux_hawk.svg
````

### 12. Tapered Coils (coily, short): `tapered_coils.svg`

````text
HAIRSTYLE: A short, tapered natural cut: a rounded crown of tight coils on top, about two finger-widths high, tapering close at the sides and the nape.

Root attributes: data-name="Tapered Coils" data-gender="female" data-length="short" data-type="coily" data-min-age="13"
File name: tapered_coils.svg
````

### 13. Coily Frohawk (coily, medium): `coily_frohawk.svg`

````text
HAIRSTYLE: A coily frohawk: a tall, rounded strip of springy coils down the middle of the head from the forehead to the nape, with the sides twisted flat and close to the scalp in neat rows.

Root attributes: data-name="Coily Frohawk" data-gender="female" data-length="medium" data-type="coily" data-min-age="13"
File name: coily_frohawk.svg
````

### 14. Long Coily Ponytail (coily, long): `long_coily_ponytail.svg`

````text
HAIRSTYLE: Coily hair brushed back smoothly into a low ponytail with neat, laid edges at the hairline; the ponytail is a long, full, springy coily mass falling behind one shoulder.

Root attributes: data-name="Long Coily Ponytail" data-gender="female" data-length="long" data-type="coily" data-min-age="13"
File name: long_coily_ponytail.svg
````

### 15. Bantu Knots (coily, updo): `bantu_knots.svg`

````text
HAIRSTYLE: Coily hair parted into neat sections, each twisted into a small coiled knot sitting on the scalp: about seven knots across the top and sides of the head, parts visible between them.

Root attributes: data-name="Bantu Knots" data-gender="female" data-length="updo" data-type="coily" data-min-age="13"
File name: bantu_knots.svg
````

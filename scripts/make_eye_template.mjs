// Writes the drawing template for eyes and the numbers the eye converter needs (step 1 of the eye pipeline):
//
//     node scripts/make_eye_template.mjs        (then turn the SVG into a 2048 x 2048 PNG; see assets/eyes_png/README.md)
//
// assets/eyes_png/eye_frame.json        where the base head's eyes sit: the game draws every eye pair in one template
//                                       frame and moves each eye onto each head (fitTransforms in js/CharacterAvatar.js),
//                                       so an eye drawn on the base head is turned back into that frame once, here
// assets/eyes_png/TEMPLATE_eyes.svg     the base head with faint guide eyes, brows and nose, to draw new eyes over
import { writeFileSync, readFileSync } from 'node:fs';
import { fitTransforms } from '../js/CharacterAvatar.js';
import { PART_BY_ID, AVATAR_TEMPLATE as T } from '../js/avatarManifest.js';

const root = new URL('../', import.meta.url);
const base = JSON.parse(readFileSync(new URL('assets/landmarks.json', root), 'utf8')).base_head;
const headId = Object.keys(PART_BY_ID).find((id) => /^head_/.test(id) && PART_BY_ID[id].file === `heads/${base}.svg`);
const f = fitTransforms(headId, 'adult', {}, {});
// eyesL: transform="translate(X Y) scale(S) translate(-256 -AY) translate(-APART 0)"
const m = f.eyesL.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\) translate\(-256 -([-\d.]+)\) translate\(([-\d.]+) 0\)/);
const [x, y, s, ay, apart] = m.slice(1).map(Number);
const frame = { head: base, headId, x, y, scale: s, anchorY: ay, apart: -apart,
  note: 'head point = (x, y) + scale * (template point - (256, anchorY) + (side * apart, 0)); side -1 for the eye left of x, +1 right' };
writeFileSync(new URL('assets/eyes_png/eye_frame.json', root), JSON.stringify(frame, null, 2) + '\n');

const inner = (file) => readFileSync(new URL(`assets/${file}`, root), 'utf8').replace(/^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g, '').replace(/id="([^"]+)"/g, 'id="t-$1"');
const use = (file, t, extra = '') => `<g${t}${extra}>${inner(file)}</g>`;
const ghost = 'opacity="0.28"';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="2048" height="2048" style="--skin-color:#da965e;--eye-color:#6b4a2e">
<defs><clipPath id="l"><rect x="-400" y="-400" width="656" height="1400"/></clipPath><clipPath id="r"><rect x="256" y="-400" width="656" height="1400"/></clipPath></defs>
${inner(`heads/${base}.svg`)}
<g ${ghost}>${use(PART_BY_ID.nose_10.file, f.nose)}${use(PART_BY_ID.brows_10.file, f.eyebrows)}
<g${f.eyesL} clip-path="url(#l)">${inner(PART_BY_ID.eyes_18.file)}</g><g${f.eyesR} clip-path="url(#r)">${inner(PART_BY_ID.eyes_18.file)}</g></g>
</svg>
`;
writeFileSync(new URL('assets/eyes_png/TEMPLATE_eyes.svg', root), svg);
console.log(`base head ${base}: eyes at y ${y}, scale ${s}, apart ${-apart}; wrote assets/eyes_png/eye_frame.json and TEMPLATE_eyes.svg`);

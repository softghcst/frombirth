// Prints, as JSON, where the game draws each named older hairstyle on one head: the fit from js/avatar/hairFit.js.
// Used by scripts/fit_hair.py to place an older style on the base head before anchoring it to every adult head.
// Run: node scripts/legacy-base-fit.mjs <head id> <hair id>...
import { hairFit } from '../js/avatar/hairFit.js';

const [head, ...hairs] = process.argv.slice(2);
console.log(JSON.stringify(Object.fromEntries(hairs.map((id) => [id, hairFit(id, head)]))));

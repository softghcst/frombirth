// CharacterAvatar: a portrait stacked from the SVG parts in assets/avatars/.
//
// Every part file has been normalised onto one 512x512 frame by
// scripts/build-avatar-manifest.py, so parts are stacked without any
// positioning here. Each layer is an SVG <use> pointing at the part's file
// (`file.svg#art`): the browser fetches each file once and caches it, and
// the colour variables set on the portrait (--skin-color, --hair-color, ...)
// reach into the referenced artwork.
//
// Layers, back to front:
//   back hair, head, make-up (clipped to the head), ageing, eyes, eyebrows,
//   nose, lips, facial hair, clothes, necklaces, front hair, earrings and
//   piercings, glasses, hat or crown, emotions.
// Hair is drawn twice: the whole style behind the head, and the part above
// the jaw again in front, so a fringe falls over the forehead while long
// lengths fall behind the shoulders and the outfit.
//
// Three ways to use it:
//   characterAvatarSvg(look, ctx)        -> markup string (what the game's screens use)
//   createCharacterAvatar(look, ctx)     -> an <svg> element
//   new CharacterAvatar(el, look, ctx)   -> mounted in `el`; .update(look, ctx) redraws
//
// `look` is a resolved look (see resolveLook in js/avatar/catalog.js):
//   { head, eyes, eyebrows, nose, lips, hair, facialHair, makeup: [], jewelry: [], glasses, clothes, hat, crown, emotion,
//     colors: { skin, hair, brow, eye, lip, blush, outfit } }
// `ctx` describes the moment: { age, gender, mood, jailed, royal: { rank }, career: { id, level }, label }.
import { PART_BY_ID } from './avatarManifest.js';
import { mixHex } from './avatar/color.js';
import { ROYAL, CAREER_DRESS, PRISON, EXPRESSION, ELDER_BROWS } from './avatar/curation.js';

/** Where the part files are, relative to the page (works from the site root on GitHub Pages). */
export const AVATAR_BASE = './assets/avatars/';
const href = (id) => (PART_BY_ID[id] ? `${AVATAR_BASE}${PART_BY_ID[id].file}#art` : null);

/** Where the jaw is, in the 512 frame: hair above this line is drawn again in front of the face. */
const FRONT_HAIR_CUT = 404;
/** Under a hat, hair above this line is hidden; bulky styles lose everything above the ears. */
const HAT_LINE = 262;
const BULKY_HAT_LINE = 316;

/** The stage of life a portrait shows. */
export function ageStage(age = 25) {
  if (age < 2) return 'baby';
  if (age < 5) return 'toddler';
  if (age < 13) return 'kid';
  if (age < 50) return 'adult';
  return 'older';
}
const STAGE_HEAD = { baby: 'head_00_baby', toddler: 'head_00_toddler', kid: 'head_00_kid' };

/** Lines that come with age, from fifty on. */
const AGING = [[50, 'aging_01_smile_lines'], [57, 'aging_02_crows_feet'], [64, 'aging_03_forehead_lines'], [71, 'aging_04_eyebags']];

/**
 * What the portrait actually wears at this moment: work clothes, royal dress,
 * prison orange, or the person's own outfit; and what hair, make-up and
 * jewellery suit their age.
 */
export function dressFor(look, ctx = {}) {
  const age = ctx.age ?? 25;
  const stage = ageStage(age);
  const gender = ctx.gender === 'female' ? 'female' : 'male';
  const out = { ...look, makeup: [...(look.makeup ?? [])], jewelry: [...(look.jewelry ?? [])], aging: [] };
  out.head = STAGE_HEAD[stage] ?? look.head;
  const young = stage === 'baby' || stage === 'toddler';
  if (young) {
    out.hair = look.babyHair ?? null;
    out.makeup = (look.marks ?? []).filter((m) => /freckle/.test(m));
    out.jewelry = []; out.glasses = null; out.facialHair = null; out.hat = null;
  } else if (stage === 'kid') {
    out.makeup = (look.marks ?? []).filter((m) => /freckle/.test(m));
    out.jewelry = out.jewelry.filter((j) => /stud/.test(j));
    out.facialHair = null;
  } else {
    out.makeup = [...new Set([...(look.marks ?? []), ...out.makeup])];
    if (age < 16) out.facialHair = null;
  }
  if (stage === 'older') {
    out.aging = AGING.filter(([from]) => age >= from).map(([, id]) => id);
    if (age >= 74 && out.eyebrows && !look.keepBrows) out.eyebrows = ELDER_BROWS;
  }
  // Clothes: prison, then crown, then work, then the person's own.
  if (young) out.clothes = look.babyClothes ?? 'outfit_baby_01_bib_onesie';
  const rank = ctx.royal?.rank;
  if (ctx.jailed) { out.clothes = PRISON; out.hat = null; out.crown = null; }
  else if (rank && ['monarch', 'heir', 'royal'].includes(rank)) {
    out.clothes = young ? ROYAL.outfits.baby : rank === 'monarch' ? ROYAL.outfits.monarch[gender] : look.royalOutfit ?? ROYAL.outfits[gender][0];
    out.crown = stage === 'adult' || stage === 'older' ? (ROYAL.crowns[rank]?.[gender] ?? null) : stage === 'kid' ? ROYAL.crowns.child : null;
    out.hat = null;
  } else if (rank === 'noble' && (stage === 'adult' || stage === 'older')) {
    out.crown = ROYAL.crowns.noble;
  } else if (ctx.career?.id && CAREER_DRESS[ctx.career.id] && !young) {
    const d = CAREER_DRESS[ctx.career.id];
    const pick = d.senior && (ctx.career.level ?? 0) >= d.senior.level ? d.senior : d;
    if (pick.outfit) out.clothes = pick.outfit;
    if (pick.hat) out.hat = pick.hat;
  }
  // Mood shows in the face.
  const mood = ctx.mood ?? 60;
  if (ctx.emotion) out.emotion = ctx.emotion;
  else if (mood <= 12 && !young) { out.emotion = 'emotion_02_tears'; }
  if (mood <= 12 && stage !== 'baby') out.eyes = EXPRESSION.crying;
  return out;
}

let serial = 0;
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const use = (id, extra = '') => { const h = href(id); return h ? `<use href="${h}"${extra}/>` : ''; };

/**
 * The colours, as CSS custom properties. Hair greys with age unless dyed;
 * brows grey more slowly.
 */
function colorVars(look, ctx) {
  const c = look.colors ?? {};
  const age = ctx.age ?? 25;
  const grey = c.dyed ? 0 : age >= 80 ? 0.9 : age >= 70 ? 0.72 : age >= 60 ? 0.45 : age >= 52 ? 0.18 : 0;
  const hair = grey ? mixHex(c.hair, '#dcd8d0', grey) : c.hair;
  const brow = c.brow ? mixHex(c.brow, '#d8d3c8', grey * 0.6) : mixHex(hair, '#1c1210', 0.25);
  const vars = { 'skin-color': c.skin, 'hair-color': hair, 'brow-color': brow, 'eye-color': c.eye, 'lip-color': c.lip, 'blush-color': c.blush };
  if (c.outfit) vars['outfit-color'] = c.outfit;
  return Object.entries(vars).filter(([, v]) => v).map(([k, v]) => `--${k}:${v}`).join(';');
}

/**
 * The portrait as SVG markup.
 * @param {object} look  a resolved look
 * @param {object} [ctx]
 * @param {{size?:number|string, className?:string, viewBox?:string}} [opts]  viewBox zooms in on part of the 512 frame
 */
export function characterAvatarSvg(look, ctx = {}, opts = {}) {
  const d = dressFor(look, ctx);
  const n = ++serial;
  const hatOn = !!d.hat;
  const bulky = !!PART_BY_ID[d.hair]?.tags?.bulky;
  const hairTop = hatOn ? (bulky ? BULKY_HAT_LINE : HAT_LINE) : 0;
  const defs = [
    `<clipPath id="pw-face-${n}"><use href="${href(d.head)?.replace('#art', '#skin')}"/></clipPath>`,
    `<clipPath id="pw-back-${n}"><rect x="-200" y="${hairTop}" width="912" height="${900 - hairTop}"/></clipPath>`,
    `<clipPath id="pw-front-${n}"><rect x="-200" y="${hairTop - 300}" width="912" height="${FRONT_HAIR_CUT - hairTop + 300}"/></clipPath>`,
  ];
  if (hatOn) defs[2] = `<clipPath id="pw-front-${n}"><rect x="-200" y="${hairTop}" width="912" height="${Math.max(0, FRONT_HAIR_CUT - hairTop)}"/></clipPath>`;
  const necklaces = d.jewelry.filter((j) => PART_BY_ID[j]?.tags?.kind === 'necklace');
  const earrings = d.jewelry.filter((j) => PART_BY_ID[j]?.tags?.kind !== 'necklace');
  const layers = [
    d.hair ? `<g clip-path="url(#pw-back-${n})">${use(d.hair)}</g>` : '',
    use(d.head),
    d.makeup.length ? `<g clip-path="url(#pw-face-${n})">${d.makeup.map((m) => use(m)).join('')}</g>` : '',
    d.aging.map((a) => use(a, ' opacity=".8"')).join(''),
    use(d.eyes), use(d.eyebrows), use(d.nose), use(d.lips),
    d.facialHair ? use(d.facialHair) : '',
    use(d.clothes),
    necklaces.map((j) => use(j)).join(''),
    d.hair ? `<g clip-path="url(#pw-front-${n})">${use(d.hair)}</g>` : '',
    earrings.map((j) => use(j)).join(''),
    d.glasses ? use(d.glasses) : '',
    d.hat ? use(d.hat) : d.crown ? use(d.crown) : '',
    d.emotion ? use(d.emotion) : '',
  ];
  const size = opts.size != null ? ` width="${opts.size}" height="${opts.size}"` : '';
  const label = ctx.label ? `<title>${esc(ctx.label)}</title>` : '';
  // A little headroom, so tall hair and crowns are not cut off at the top.
  const box = opts.viewBox ?? '-14 -22 540 540';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}"${size} class="character-avatar${opts.className ? ` ${esc(opts.className)}` : ''}" `
    + `role="img" aria-label="${esc(ctx.label ?? 'Portrait')}" style="${colorVars(look, ctx)}">${label}<defs>${defs.join('')}</defs>${layers.join('')}</svg>`;
}

/** The portrait as an element, ready to insert. */
export function createCharacterAvatar(look, ctx = {}, opts = {}) {
  const t = document.createElement('template');
  t.innerHTML = characterAvatarSvg(look, ctx, opts).trim();
  return t.content.firstElementChild;
}

/** A portrait mounted in an element, redrawn with update(). */
export class CharacterAvatar {
  constructor(el, look, ctx = {}, opts = {}) {
    this.el = el;
    this.opts = opts;
    this.update(look, ctx);
  }

  update(look = this.look, ctx = this.ctx) {
    this.look = look;
    this.ctx = ctx;
    this.el.replaceChildren(createCharacterAvatar(look, ctx, this.opts));
    return this;
  }
}

/** Every file a portrait uses, for preloading or caching offline. */
export function filesFor(look, ctx = {}) {
  const d = dressFor(look, ctx);
  return [d.hair, d.head, ...d.makeup, ...d.aging, d.eyes, d.eyebrows, d.nose, d.lips, d.facialHair, d.clothes, ...d.jewelry, d.glasses, d.hat, d.crown, d.emotion]
    .filter((id) => id && PART_BY_ID[id]).map((id) => `${AVATAR_BASE}${PART_BY_ID[id].file}`);
}

// The beauty salon: changing how the player wears what they were born with.
// Only the `style` half of an appearance ever changes here.
import { clamp, localMoney, fmtMoney, localCost } from '../util.js';
import { player, country, log, store } from '../state.js';
import { normalize, part, hairTextureOf } from '../avatar/catalog.js';
import { fitHairToTexture } from '../avatar/inherit.js';
import { TEXTURES } from '../avatar/curation.js';

// ---------- Hair texture treatments ----------
// Hair texture is genetic and never really changes (js/avatar/inherit.js childTexture). A salon can make it show another
// texture for a time: the treated hair holds its new shape, regrowth is touched up through the years paid for, and when
// they end the hair grows out in its natural texture again. Real treatments and what they do:
//   Japanese straightening (thermal reconditioning): permanently straightens wavy or curly hair that is treated; the
//     straightness lasts until that hair grows out or is cut, with regrowth touched up.
//   Relaxer: the chemical straightener for coily hair; grows out with new hair, touched up as it does.
//   Texturizer: a mild relaxer that loosens coily or curly hair into softer curls or waves.
//   Perm (body wave, spiral, tight curl): sets waves or curls into straighter hair.
// A keratin treatment (a "Brazilian blowout") only smooths hair for a few months, so it is not one of these.
/** How long a treatment can be paid for, in years: kept up with touch-ups, then left to grow out. */
export const TREATMENT_YEARS = [2, 4, 6];
/** Chemical treatments are for grown-ups. */
export const TREATMENT_MIN_AGE = 16;
const KINDS = {
  japanese: { name: 'Japanese straightening (thermal reconditioning)', short: 'Japanese straightening', perYear: 260 },
  relaxer: { name: 'Relaxer', short: 'Relaxer', perYear: 120 },
  texturizer: { name: 'Texturizer', short: 'Texturizer', perYear: 120 },
  body_wave: { name: 'Body wave perm', short: 'Body wave perm', perYear: 140 },
  spiral_perm: { name: 'Spiral perm', short: 'Spiral perm', perYear: 160 },
  tight_perm: { name: 'Tight curl perm', short: 'Tight curl perm', perYear: 180 },
};
/** The treatment that makes hair of one natural texture show another. */
export function treatmentFor(natural, target) {
  const n = TEXTURES.indexOf(natural); const t = TEXTURES.indexOf(target);
  if (n < 0 || t < 0 || n === t) return null;
  const kind = target === 'straight' ? (natural === 'coily' ? 'relaxer' : 'japanese')
    : t < n ? 'texturizer'  // loosening curls
      : target === 'wavy' ? 'body_wave' : target === 'curly' ? 'spiral_perm' : 'tight_perm';
  return { kind, ...KINDS[kind] };
}
/** What a treatment costs for so many years (longer is a little cheaper a year), in base units. */
export const treatmentCost = (kind, years) => Math.round(KINDS[kind].perYear * years * (years >= 6 ? 0.85 : years >= 4 ? 0.9 : 1));
export const treatmentName = (kind) => KINDS[kind]?.name ?? 'Treatment';
const sameTreatment = (x, y) => (x?.texture ?? null) === (y?.texture ?? null) && (x?.years ?? null) === (y?.years ?? null);

/**
 * Each year: a treatment whose years are up grows out, and the hair shows its natural texture again; and anyone whose
 * hairstyle is not of the texture their hair shows (a treatment grown out, a child grown up, an older save) is given one
 * that is (fitHairToTexture), the player and everyone else alike.
 */
export function tickHair(state = store.state) {
  const p = state.player;
  const tr = p.appearance?.style?.treatment;
  if (tr?.until != null && state.year >= tr.until) {
    p.appearance.style.treatment = null;
    const changed = fitHairToTexture(p.appearance, p.gender, p.id);
    log(`Your ${treatmentName(tr.kind).replace(/ \(.*\)/, '').toLowerCase()} has grown out: your hair is ${p.appearance.inherited.hairTexture} again${changed ? ', and cut to suit it' : ''}.`, 'system', 'neutral');
  } else fitHairToTexture(p.appearance, p.gender, p.id);
  for (const n of Object.values(state.npcs ?? {})) if (n?.alive !== false && n?.appearance?.style) fitHairToTexture(n.appearance, n.gender, n.id);
}


/** Prices in base units. A change back to "none" or "natural" is free, apart from a haircut. */
export const SALON_PRICES = { hair: 45, hairDye: 110, browStyle: 25, beard: 30, glasses: 180, makeup: 60, lipColor: 15, jewelry: 90, outfit: 80, outfitColor: 30 };
const LABELS = { hair: 'Haircut', hairDye: 'Color', browStyle: 'Eyebrow shaping', beard: 'Beard grooming', glasses: 'New glasses', makeup: 'Make-up', lipColor: 'Lip color',
  jewelry: 'Jewelry', outfit: 'New clothes', outfitColor: 'Dyeing' };
const same = (x, y) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);
/** Children do not pay: whoever looks after them does. */
const PAYS_FROM = 16;

export const canVisitSalon = () => player().age >= 3 && !player().legal.incarceration;

/**
 * What a new look would cost.
 * @returns {{lines:{label:string, cost:number}[], total:number, free:boolean, changed:boolean}}
 */
export function salonQuote(next) {
  const p = player();
  const c = country();
  const now = normalize(p.appearance, p.id).style;
  const lines = [];
  for (const key of Object.keys(SALON_PRICES)) {
    // Keeping her own style in old age (rather than an elder's) is a haircut too, even with the same style id.
    if (same(now[key], next.style[key]) && !(key === 'hair' && !!next.style.keepHair !== !!now.keepHair)) continue;
    const removing = next.style[key] == null || (Array.isArray(next.style[key]) && !next.style[key].length);
    lines.push({ label: LABELS[key], cost: removing ? 0 : localCost(SALON_PRICES[key], c) });
  }
  // A hair texture treatment: paid for the years chosen; stopping one early is free, and the years left are not refunded.
  const was = now.treatment; const want = next.style.treatment ?? null;
  if (!sameTreatment(was, want)) {
    if (want) lines.push({ label: `${treatmentName(want.kind)}, ${want.years} years`, cost: localCost(treatmentCost(want.kind, want.years), c) });
    else lines.push({ label: `Back to natural ${p.appearance?.inherited?.hairTexture ?? ''} hair (no refund)`.replace('  ', ' '), cost: 0 });
  }
  const free = p.age < PAYS_FROM;
  return { lines, total: free ? 0 : lines.reduce((s, l) => s + l.cost, 0), free, changed: lines.length > 0 };
}

/** One line describing the bill, for the editor. */
export function salonNote(next) {
  const q = salonQuote(next);
  if (!q.changed) return 'Nothing changed yet.';
  const what = q.lines.map((l) => l.label.toLowerCase()).join(', ');
  return q.free ? `${what.replace(/^./, (ch) => ch.toUpperCase())}. Your family pays.` : `${what.replace(/^./, (ch) => ch.toUpperCase())}: ${fmtMoney(q.total, country())}.`;
}

/** Pays for and applies a new look. What the player was born with is left untouched. */
export function applySalon(next) {
  const p = player();
  const c = country();
  const q = salonQuote(next);
  if (!canVisitSalon()) return { ok: false, text: 'The salon is not an option right now.', tone: 'neutral' };
  if (!q.changed) return { ok: false, text: 'You left the salon looking exactly as you went in.', tone: 'neutral' };
  if (p.finance.cash < q.total) return { ok: false, text: `That comes to ${fmtMoney(q.total, c)}. You do not have it.`, tone: 'neutral' };
  const want = next.style.treatment ?? null;
  if (want && p.age < TREATMENT_MIN_AGE) return { ok: false, text: `Hair treatments are for ${TREATMENT_MIN_AGE} and over.`, tone: 'neutral' };
  p.finance.cash -= q.total;
  const current = normalize(p.appearance, p.id);
  // A new treatment starts this year and lasts the years paid for; one kept as it was keeps its dates.
  const treatment = !want ? null : sameTreatment(current.style.treatment, want) ? current.style.treatment
    : { texture: want.texture, kind: want.kind, years: want.years, from: store.state.year, until: store.state.year + want.years };
  p.appearance = { v: 3, inherited: current.inherited, style: { ...current.style, ...next.style, treatment } };
  // The hairstyle is one of the texture the hair now shows.
  fitHairToTexture(p.appearance, p.gender, p.id);
  const first = p.flags.salonAge !== p.age;
  p.flags.salonAge = p.age;
  if (first) { p.stats.mood = clamp(p.stats.mood + 4); if (p.stats.charm < 80) p.stats.charm = clamp(p.stats.charm + 1); }
  const dye = q.lines.some((l) => l.label === 'Color') && next.style.hairDye ? ` Your hair is ${part('hairDye', next.style.hairDye).name.toLowerCase()} now.` : '';
  const tr = treatment && !sameTreatment(current.style.treatment, treatment) ? ` Your ${treatmentName(treatment.kind).replace(/ \(.*\)/, '')} will hold for ${treatment.years} years.`
    : !treatment && current.style.treatment ? ` Your natural ${current.inherited.hairTexture} hair will grow back.` : '';
  const text = `You walked out of the salon with a new look.${dye}${tr}${q.total ? ` It cost ${fmtMoney(q.total, c)}.` : ''}`;
  log(text, 'system', 'good');
  return { ok: true, text, tone: 'good' };
}

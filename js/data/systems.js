// How income is taxed, and how health care is paid for.
//
// GAMEPLAY SHAPES, NOT REAL SCHEDULES. A country's tax is its headline rate
// (data/countries.js) run through one of three shapes; the thresholds are
// multiples of that country's typical wage in the game, not real brackets.
// Which countries tax at one flat rate, the top rates and the health-care
// models are checked by scripts/verify-laws.py; whether a banded country's
// bands rise steeply or moderately is the author's judgment. Real systems
// have credits, deductions, contributions, regional taxes, co-payments and
// exceptions that are not modeled. Nothing here is tax or medical advice.

/**
 * allowance: income below this is untaxed. bands: [up to, multiple of the headline rate].
 * Amounts are multiples of the typical wage. The top marginal rate never exceeds `cap`.
 */
export const TAX_SHAPES = {
  none: { name: 'No income tax', allowance: 0, bands: [[Infinity, 0]], cap: 0 },
  flat: { name: 'One flat rate', allowance: 0, bands: [[Infinity, 1]], cap: 0.6 },
  moderate: { name: 'Rising bands', allowance: 0.2, bands: [[1.5, 1], [5, 1.15], [Infinity, 1.5]], cap: 0.6 },
  steep: { name: 'Steeply rising bands', allowance: 0.25, bands: [[1.2, 0.95], [3, 1.25], [8, 1.55], [Infinity, 1.8]], cap: 0.62 },
};

/** Countries that do not use the default ('moderate'). Unverified. */
export const TAX_SHAPE_OF = {
  // Steeply progressive
  uk: 'steep', ca: 'steep', fr: 'steep', de: 'steep', jp: 'steep', kr: 'steep', au: 'steep', se: 'steep', dk: 'steep', no: 'steep', fi: 'steep', be: 'steep', nl: 'steep', at: 'steep', ie: 'steep', it: 'steep', es: 'steep', pt: 'steep',
  // One rate for everyone
  ua: 'flat', hu: 'flat', ro: 'flat', ee: 'flat', ge: 'flat', kz: 'flat', mn: 'flat', bo: 'flat', bz: 'flat', sc: 'flat',
  // Russia replaced its flat 13% with bands up to 22% in 2025.
  ru: 'moderate',
};

/**
 * The highest rate on the highest incomes, from "List of countries by tax rates" rev 1385796804 (the "Highest" column; for
 * some countries it includes social contributions or the dearest local tax, as the table does; for the United States the
 * game uses the federal 37%, since state income tax runs from none to about 13%). The top band of a country's
 * schedule is set to it; lower bands keep their shape but never exceed it. See scripts/verify-laws.py.
 */
export const TAX_TOP = { ad: 0.1, ae: 0.0, af: 0.2, ao: 0.17, ar: 0.35, at: 0.55, au: 0.45, aw: 0.5895, bd: 0.25, be: 0.6045, bo: 0.25, br: 0.275, bs: 0.088, bz: 0.25, ca: 0.548, cd: 0.4, ch: 0.6285, cl: 0.4, cn: 0.45, co: 0.35, cr: 0.25, cu: 0.5, cz: 0.457, de: 0.45, dk: 0.5207, do: 0.25, dz: 0.35, ec: 0.35, ee: 0.236, eg: 0.275, es: 0.523, et: 0.35, fi: 0.5361, fr: 0.5534, ge: 0.2, gr: 0.44, gt: 0.07, gy: 0.35, hk: 0.15, hr: 0.4, ht: 0.3, hu: 0.15, id: 0.35, ie: 0.521, il: 0.5, in: 0.39, iq: 0.15, ir: 0.35, it: 0.43, jm: 0.3, jo: 0.25, jp: 0.505, ke: 0.35, kr: 0.534, kw: 0.0, kz: 0.1, lb: 0.25, ma: 0.38, mc: 0.0, mn: 0.1, mx: 0.35, my: 0.3, ng: 0.24, nl: 0.495, no: 0.474, np: 0.36, nz: 0.39, pa: 0.27, pe: 0.3, ph: 0.35, pk: 0.45, pl: 0.41, pr: 0.3334, pt: 0.5603, py: 0.1, qa: 0.0, ro: 0.45, rs: 0.25, ru: 0.22, sa: 0.0, se: 0.48, sg: 0.22, sk: 0.25, sv: 0.3, sy: 0.15, th: 0.35, tn: 0.35, tr: 0.4, tw: 0.4, ua: 0.18, uk: 0.47, us: 0.37, uy: 0.36, ve: 0.34, vn: 0.35, za: 0.45, zw: 0.45, fj: 0.2, mu: 0.15, sc: 0.15, mv: 0.15 };

/**
 * How care is paid for.
 *   share      the part of a bill the patient pays when covered
 *   uncovered  the part they pay when not
 *   premium    a yearly charge for cover, as a share of the typical wage (0: none)
 *   covers     who is covered: 'everyone', 'workers' (a full-time job brings cover), 'buyers' (cover must be bought, unless a job brings it)
 */
export const HEALTH_MODELS = {
  public: { name: 'Public', line: 'Paid for from taxes. Free, or nearly, when you need it.', share: 0.05, uncovered: 0.05, premium: 0, covers: 'everyone' },
  insurance: { name: 'Compulsory insurance', line: 'Everyone is insured by law. You pay a yearly contribution and a part of each bill.', share: 0.2, uncovered: 0.2, premium: 0.035, covers: 'everyone' },
  private: { name: 'Private insurance', line: 'Cover comes with a full-time job, or you buy it. Without it you pay the whole bill.', share: 0.2, uncovered: 1, premium: 0.12, covers: 'buyers' },
  employer: { name: 'Through your employer', line: 'A full-time job brings cover. Without one you pay the whole bill.', share: 0.1, uncovered: 1, premium: 0, covers: 'workers' },
  mixed: { name: 'Public clinics, private care', line: 'Basic public care exists, and most people pay for a good part of what they need.', share: 0.4, uncovered: 0.4, premium: 0, covers: 'everyone' },
  pocket: { name: 'Out of pocket', line: 'You pay for what you need, when you need it.', share: 1, uncovered: 1, premium: 0, covers: 'everyone' },
};

/**
 * Countries with a hand-picked model. Elsewhere: 'public' where the game
 * already treats care as free, 'pocket' where it does not. Unverified.
 */
export const HEALTH_MODEL_OF = {
  us: 'private', uk: 'public', ca: 'public', au: 'public', br: 'public', ie: 'public',
  de: 'insurance', fr: 'insurance', jp: 'insurance', kr: 'insurance', nl: 'insurance', ch: 'insurance',
  cn: 'insurance', id: 'insurance', sg: 'insurance', ee: 'insurance', pl: 'insurance', hr: 'insurance', rs: 'insurance',
  mx: 'mixed', in: 'mixed',
  ae: 'employer', // for expatriates: citizens are covered by the national scheme (engine/systems.js)
};

/**
 * Health care for people on a temporary visa, where care is for everyone
 * (public, compulsory insurance, mixed). GAMEPLAY RULE, unverified, the same
 * in every such country:
 *   charge   holders of these statuses pay a yearly visa health charge (a
 *            multiple of the typical wage) and are then covered like residents
 *   private  holders must buy private cover; without it they pay the whole bill
 * Permanent residents, citizens and people given protection are covered as residents.
 */
export const VISA_HEALTH = {
  worker: { kind: 'charge', rate: 0.03 },
  student: { kind: 'charge', rate: 0.02 },
  retiree: { kind: 'private', rate: 0.1 },
};
// China, Indonesia, Singapore, Ireland, Estonia, Poland, Croatia and Serbia checked against "Universal health care" (rev 1385246824)
// and "List of countries with universal health care" (rev 1384547493); see scripts/verify-laws.py.

// How income is taxed, and how health care is paid for.
//
// GAMEPLAY SHAPES, NOT REAL SCHEDULES. A country's tax is its headline rate
// (data/countries.js) run through one of three shapes; the thresholds are
// multiples of that country's typical wage in the game, not real brackets.
// Which shape a country gets, and which health-care model, is the author's
// coarse understanding of the mid-2020s and is unverified. Real systems
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
  ru: 'flat', ua: 'flat', hu: 'flat', ro: 'flat', ee: 'flat', ge: 'flat', kz: 'flat', mn: 'flat', bo: 'flat',
};

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
  us: 'private', uk: 'public', ca: 'public', au: 'public', br: 'public',
  de: 'insurance', fr: 'insurance', jp: 'insurance', kr: 'insurance', nl: 'insurance', ch: 'insurance',
  mx: 'mixed', in: 'mixed',
  ae: 'employer',
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

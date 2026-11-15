// Health care, cosmetic surgery, leisure, social media and emigration.
// Money is in base units.

/**
 * What a doctor can do for each condition. chance is the odds treatment works.
 * manage: true means it cannot be cured, only kept under control (most of
 * its yearly harm goes away for as long as you stay on treatment).
 */
export const TREATMENTS = {
  flu: { cost: 80, chance: 0.95 },
  ear_infection: { cost: 80, chance: 0.95 },
  broken_arm: { cost: 1500, chance: 0.95 },
  acne: { cost: 300, chance: 0.7 },
  asthma: { cost: 400, chance: 0.9, manage: true },
  anxiety: { cost: 900, chance: 0.6 },
  depression: { cost: 900, chance: 0.6 },
  back_pain: { cost: 1200, chance: 0.5 },
  high_bp: { cost: 500, chance: 0.9, manage: true },
  diabetes: { cost: 900, chance: 0.9, manage: true },
  broken_hip: { cost: 12000, chance: 0.8 },
  heart_disease: { cost: 25000, chance: 0.75, manage: true },
  cancer: { cost: 60000, chance: 0.55 },
  botched_surgery: { cost: 9000, chance: 0.7 },
};
/** Where health care is public, patients pay this share of the cost. */
export const PUBLIC_CARE_SHARE = 0.05;
export const CHECKUP_COST = 200;
export const THERAPY_COST = 1200;

/** Cosmetic procedures. gain: Charm added when it goes well. */
export const SURGERIES = [
  { id: 'teeth', name: 'Cosmetic dentistry', cost: 4000, gain: [3, 6], risk: 0.03, minAge: 18 },
  { id: 'nose', name: 'Nose reshaping', cost: 7000, gain: [4, 9], risk: 0.08, minAge: 18 },
  { id: 'lipo', name: 'Liposuction', cost: 6000, gain: [3, 8], risk: 0.1, minAge: 18 },
  { id: 'hair', name: 'Hair transplant', cost: 9000, gain: [3, 7], risk: 0.06, minAge: 25 },
  { id: 'facelift', name: 'Facelift', cost: 15000, gain: [6, 12], risk: 0.12, minAge: 40 },
];
/** Who holds the knife. cost and risk multiply the procedure's own. */
export const SURGEONS = [
  { id: 'budget', name: 'A cut-price clinic', cost: 0.45, risk: 2.6, blurb: 'Cheap, quick, and a long way from home.' },
  { id: 'standard', name: 'A reputable surgeon', cost: 1, risk: 1, blurb: 'Qualified, insured, booked up for months.' },
  { id: 'renowned', name: 'A renowned surgeon', cost: 3, risk: 0.3, blurb: 'Does the faces you see on screen.' },
];

/** Things to do, once a year each. */
export const GYM_COST = 400;
export const NIGHT_OUT_COST = 120;
export const NIGHTLIFE_AGE = 18;

export const HOLIDAYS = [
  { id: 'camping', name: 'A week camping', cost: 300, mood: 6, health: 2 },
  { id: 'city', name: 'A city break', cost: 1500, mood: 9, intellect: 1 },
  { id: 'beach', name: 'Two weeks at a beach resort', cost: 4500, mood: 13, health: 2 },
  { id: 'adventure', name: 'A trekking adventure', cost: 7000, mood: 12, health: 4, risky: 0.06 },
  { id: 'world', name: 'A month going round the world', cost: 22000, mood: 18, intellect: 3, charm: 2 },
];

/** Social media. */
export const SOCIAL_AGE = 13;
export const POSTS_PER_YEAR = 3;
export const FOLLOWER_PACKS = [
  { count: 1000, cost: 60 },
  { count: 10000, cost: 400 },
  { count: 100000, cost: 3000 },
];
export const FOLLOWER_MILESTONES = [10000, 100000, 1000000, 10000000];

/** Emigrating. fee covers visas, lawyers and shipping. */
export const EMIGRATION = { fee: 6000, minAge: 18 };

// Money data: how finely each currency divides, what a transaction can be
// filed under, the banks of the game and what they offer, and how lenders
// keep records in different places.
//
// EVERYTHING HERE IS FICTION. The banks are invented, the interest rates are
// game rates, and the grouping of countries by how lenders keep records is a
// simplification made for play. None of it describes a real institution,
// product, credit bureau or law.

/** Digits after the decimal point. Most currencies have two; these do not. */
const DECIMALS = { JPY: 0, KRW: 0, VND: 0, CLP: 0, PYG: 0, UGX: 0, DJF: 0, KWD: 3, JOD: 3, TND: 3, IQD: 3 };
export const decimalsOf = (code) => DECIMALS[code] ?? 2;

// What a transaction is filed under.
//   kind 'income'   money that arrived from outside
//   kind 'expense'  money that left for good
//   kind 'transfer' money that changed form: moved between accounts, borrowed,
//                   repaid, exchanged, or turned into something owned. Never income.
const I = 'income'; const E = 'expense'; const T = 'transfer';
export const CATEGORIES = {
  salary: { name: 'Salary', kind: I },
  partTime: { name: 'Part-time wages', kind: I },
  pension: { name: 'Pension', kind: I },
  gigs: { name: 'Freelance and one-off work', kind: I },
  rentIncome: { name: 'Rent from tenants', kind: I },
  interestIncome: { name: 'Interest earned', kind: I },
  giftIn: { name: 'Gifts and help received', kind: I },
  inheritance: { name: 'Inheritance', kind: I },
  winnings: { name: 'Winnings', kind: I },
  prizeMoney: { name: 'Prize money', kind: I },
  sponsorship: { name: 'Sponsorship', kind: I },
  debtRelief: { name: 'Debt written off', kind: I },
  claim: { name: 'Insurance payouts', kind: I },
  dividends: { name: 'Dividends and fund payouts', kind: I },
  supportIn: { name: 'Support received', kind: I },
  statePension: { name: 'State pension', kind: I },
  benefits: { name: 'Unemployment benefit', kind: I },
  distribution: { name: 'Profits taken from your business', kind: I },
  growth: { name: 'Pension pot: gains and losses', kind: I },
  otherIncome: { name: 'Other money in', kind: I },

  housing: { name: 'Housing', kind: E, budget: true },
  living: { name: 'Food and everyday spending', kind: E, budget: true },
  transport: { name: 'Transport', kind: E, budget: true },
  education: { name: 'Education', kind: E, budget: true },
  health: { name: 'Health care', kind: E, budget: true },
  childcare: { name: 'Children', kind: E, budget: true },
  insurance: { name: 'Insurance', kind: E, budget: true },
  leisure: { name: 'Leisure and hobbies', kind: E, budget: true },
  travel: { name: 'Travel', kind: E, budget: true },
  pets: { name: 'Pets', kind: E, budget: true },
  sport: { name: 'Sport: fees, coaching and kit', kind: E, budget: true },
  supportOut: { name: 'Support paid', kind: E },
  learning: { name: 'Learning about money', kind: E, budget: true },
  giftOut: { name: 'Gifts and giving', kind: E, budget: true },
  tax: { name: 'Tax', kind: E },
  interest: { name: 'Interest paid', kind: E },
  fees: { name: 'Bank fees', kind: E },
  legal: { name: 'Fines and legal costs', kind: E },
  losses: { name: 'Losses', kind: E },
  other: { name: 'Other spending', kind: E, budget: true },

  transfer: { name: 'Between your own accounts', kind: T },
  exchange: { name: 'Currency exchange', kind: T },
  borrowing: { name: 'Borrowing', kind: T },
  debt: { name: 'Debt repayment', kind: T },
  investments: { name: 'Investments bought and sold', kind: T },
  property: { name: 'Property bought and sold', kind: T },
  vehicle: { name: 'Vehicles bought and sold', kind: T },
  business: { name: 'Business bought, funded and sold', kind: T },
  trust: { name: 'Put into trust', kind: T },
  trustGrowth: { name: 'Growth inside a trust', kind: T },
  familyLoan: { name: 'Lent to family and friends', kind: T },
  jointPartner: { name: 'A partner\'s money in a joint account', kind: T },
  opening: { name: 'Opening balance', kind: T },
};
export const BUDGET_CATEGORIES = Object.keys(CATEGORIES).filter((k) => CATEGORIES[k].budget);

/** A guess at the category of a change in cash, from the journal line that came with it. First match wins. */
const HINTS = [
  [/\b(rent|deposit on|landlord|renovat|mortgage|utilities|bills)\b/i, 'housing'],
  [/\b(tuition|school|university|college|course|class|lesson|tutor|textbook|degree)\b/i, 'education'],
  [/\b(doctor|hospital|surgery|clinic|dentist|therap|treatment|medic|prescription|operation)\b/i, 'health'],
  [/\b(insurance|premium|cover)\b/i, 'insurance'],
  [/\b(flight|vacation|trip|visa|travel|abroad|hotel)\b/i, 'travel'],
  [/\b(car|bike|garage|fuel|driving|vehicle|boat|plane)\b/i, 'transport'],
  [/\b(dog|cat|pet|vet|puppy|kitten)\b/i, 'pets'],
  [/\b(gift|present|donat|charity|gave|lent|wedding|ring)\b/i, 'giftOut'],
  [/\b(fine|fined|lawyer|bail|court|bribe|legal)\b/i, 'legal'],
  [/\b(casino|bet|gambl|lottery|won|jackpot|prize)\b/i, 'leisure'],
  [/\b(child|baby|nursery|adopt|nanny)\b/i, 'childcare'],
  [/\b(gym|club|party|concert|cinema|restaurant|hobby|game|salon|spa|haircut|tattoo)\b/i, 'leisure'],
];
const HINTS_IN = [
  [/\b(won|jackpot|prize|lottery|winnings)\b/i, 'winnings'],
  [/\b(inherit|left you|estate)\b/i, 'inheritance'],
  [/\b(gift|gave you|sent you|allowance|allowance|birthday|grant|scholarship|bursary)\b/i, 'giftIn'],
  [/\b(shift|paid you|earned|gig|tips|fee for|freelance|commission|royalt)\b/i, 'gigs'],
];
export function guessCategory(text, moneyIn) {
  for (const [re, cat] of moneyIn ? HINTS_IN : HINTS) if (re.test(text ?? '')) return cat;
  return moneyIn ? 'otherIncome' : 'other';
}

// ---------- Banks ----------
// Rates are in basis points a year (100 = 1%). Amounts are in base units and
// are turned into local money when an account is opened; the terms of an
// account are fixed on the day it is opened.
//   since      the first year this kind of account exists at all
//   minAge / maxAge, needs   who may open one
//   term       years the money is locked away
export const PRODUCTS = {
  current: { name: 'Checking account', since: 1900, minAge: 18, rateBp: 0, fee: 0,
    blurb: 'For everyday money. Pays no interest.' },
  savings: { name: 'Savings account', since: 1820, minAge: 18, rateBp: 180, fee: 0,
    blurb: 'Money set aside. Take it out whenever you like.' },
  youth: { name: 'Young saver account', since: 1900, minAge: 7, maxAge: 17, needs: 'guardian', rateBp: 250, fee: 0, cap: 20000,
    blurb: 'Opened with a parent or guardian, who can see it but does not own it. Becomes an ordinary savings account at 18.' },
  student: { name: 'Student account', since: 1960, minAge: 17, needs: 'student', rateBp: 60, fee: 0,
    blurb: 'For people in higher education. No fees. Becomes a checking account when you leave.' },
  highyield: { name: 'High-interest savings', since: 1995, minAge: 18, rateBp: 320, fee: 0, min: 5000,
    blurb: 'Better interest, for a larger opening balance.' },
  term2: { name: 'Two-year fixed deposit', since: 1850, minAge: 18, rateBp: 380, fee: 0, min: 1000, term: 2,
    blurb: 'Locked away for two years. Breaking it early costs a year of interest.' },
  term5: { name: 'Five-year fixed deposit', since: 1850, minAge: 18, rateBp: 440, fee: 0, min: 1000, term: 5,
    blurb: 'Locked away for five years. Breaking it early costs a year of interest.' },
};

/**
 * Invented banks. `bonusBp` is added to (or taken from) every savings rate;
 * `fee` is a yearly charge on a checking account, in base units; `reach` is how
 * many places in every ten the bank has branches in.
 */
export const BANKS = [
  { id: 'commonwealth_post', name: 'Post Office Savings', reach: 10, bonusBp: -30, fee: 0, products: ['savings', 'youth', 'term2'],
    blurb: 'A counter in every town. Plain accounts, plain rates.' },
  { id: 'meridian', name: 'Meridian Bank', reach: 7, bonusBp: 0, fee: 0, products: ['current', 'savings', 'youth', 'student', 'term2', 'term5'],
    blurb: 'A large national bank. A little of everything.' },
  { id: 'harrowgate', name: 'Harrowgate & Lyle', reach: 4, bonusBp: 30, fee: 90, products: ['current', 'savings', 'highyield', 'term5'],
    blurb: 'An old name. Charges for a checking account, pays a little more on savings.' },
  { id: 'kestrel', name: 'Kestrel Mutual', reach: 5, bonusBp: 20, fee: 0, products: ['savings', 'youth', 'highyield', 'term2', 'term5'],
    blurb: 'Owned by its savers. No checking accounts.' },
  { id: 'brightline', name: 'Brightline', reach: 6, bonusBp: 45, fee: 0, since: 2005, products: ['current', 'savings', 'student', 'highyield'],
    blurb: 'No branches, only an app. Good rates while it is trying to grow.' },
  { id: 'ostrava', name: 'Ostrava Trust', reach: 3, bonusBp: 10, fee: 40, products: ['current', 'savings', 'term2', 'term5'],
    blurb: 'A quiet bank for people who do not like surprises.' },
];
export const BANK_BY_ID = Object.fromEntries(BANKS.map((b) => [b.id, b]));
export const MAX_ACCOUNTS = 6;

// ---------- How lenders keep records ----------
// A simplification for play, not a description of any country's system.
//   file      lenders share a full record, and the game shows a Pathways standing (0 to 100)
//   registry  only serious trouble is written down; there is no number
//   bank      no shared record: each bank goes on your income and your history with it
const FILE = 'us uk ca au nz ie za in mx br kr sg hk pr co cl pe';
const REGISTRY = 'fr de it es pt nl be at fi se no dk ch pl cz hu ro gr jp tw il tr ar';
export const CREDIT_MODEL_OF = {
  ...Object.fromEntries(FILE.split(' ').map((id) => [id, 'file'])),
  ...Object.fromEntries(REGISTRY.split(' ').map((id) => [id, 'registry'])),
};
export const CREDIT_MODELS = {
  file: { name: 'Shared lending record', line: 'Lenders here share a record of what you borrow and how you repay it.' },
  registry: { name: 'Register of defaults', line: 'Only serious trouble is written down here. Paying on time leaves no mark at all.' },
  bank: { name: 'No shared record', line: 'There is no shared record here. A bank goes on your income and on what it knows of you.' },
};

/** Savings goals to choose from. `base` is a suggested target in base units; 0 means it is worked out from the life. */
export const GOAL_KINDS = [
  { id: 'emergency', name: 'An emergency fund', base: 0, blurb: 'A few months of what you spend, in case the worst happens.' },
  { id: 'car', name: 'A first car', base: 6000, blurb: 'Enough to buy one outright.' },
  { id: 'study', name: 'University', base: 20000, blurb: 'Fees and somewhere to live.' },
  { id: 'wedding', name: 'A wedding', base: 15000, blurb: 'The day itself.' },
  { id: 'home', name: 'A deposit on a home', base: 40000, blurb: 'The first step onto the ladder.' },
  { id: 'travel', name: 'A long trip', base: 5000, blurb: 'Somewhere far away, for long enough to matter.' },
  { id: 'business', name: 'Starting something of your own', base: 25000, blurb: 'Money to live on while it finds its feet.' },
  { id: 'family', name: 'Help for someone in the family', base: 8000, blurb: 'Set aside for somebody else.' },
  { id: 'retire', name: 'Retirement', base: 150000, blurb: 'Money of your own, on top of any pension.' },
];

// ---------- Credit cards ----------
// Invented terms. `since` is the first year cards exist in the game at all.
// The least a statement asks for is the year's interest plus `minPay` of what is owed, so paying it always brings the balance down.
export const CARDS = { since: 1960, max: 2, minAge: 18, minPay: 0.03, minPayFloor: 300, lateFee: 40, advanceFee: 0.03, reward: 0.01,
  tiers: [ // by standing with lenders: share of yearly income offered as a limit, and the yearly rate in basis points
    { min: 80, limit: 0.3, rateBp: 1500, name: 'Platinum card' },
    { min: 65, limit: 0.2, rateBp: 1900, name: 'Classic card' },
    { min: 45, limit: 0.1, rateBp: 2400, name: 'Starter card' },
  ],
  starter: { limit: 0.08, rateBp: 2400, name: 'Starter card' } };

// ---------- When debts cannot be paid ----------
// A simplification for play. It is not a description of any country's law.
//   discharge  most debts are written off; no lender will deal with you for some years
//   plan       a court sets a plan: part is written off, the rest is repaid over years without interest
//   none       nothing is written off: what is owed becomes arrears, repaid with interest
const PLAN = 'de fr it es pt nl be at fi se no dk ch pl cz hu ro gr jp kr tw';
const NONE = 'cn vn cu ir sy af iq lb et cd dj ao dz sa kw qa ae jo eg pk bd np mn kz';
export const INSOLVENCY_OF = { ...Object.fromEntries(PLAN.split(' ').map((id) => [id, 'plan'])), ...Object.fromEntries(NONE.split(' ').map((id) => [id, 'none'])) };
export const INSOLVENCY = {
  discharge: { name: 'Bankruptcy with discharge', line: 'Most debts are written off. Student loans are not. No bank will lend to you for years afterwards.' },
  plan: { name: 'Court repayment plan', line: 'A court writes off part of what you owe and sets a plan to repay the rest, without interest, over six years.', keep: 0.6, years: 6 },
  none: { name: 'No release from debt', line: 'There is no way to have a debt written off here. What you cannot pay becomes arrears, and follows you.', rate: 0.1, years: 10, bar: 3 },
};

// ---------- Marriage and money ----------
// How a divorce treats what the two of you have. A simplification for play.
//   equal     everything either of you has is shared out evenly (the game's original rule)
//   separate  each keeps what is theirs; only what is held jointly is divided, by what each put in
const SEPARATE = 'uk in pk bd ng gh ke ug jm au nz sg hk my ae sa kw qa jo eg ir iq';
export const FAMILY_LAW_OF = Object.fromEntries(SEPARATE.split(' ').map((id) => [id, 'separate']));
export const FAMILY_LAW = {
  equal: { name: 'Shared equally', line: 'On divorce, what the two of you have is added up and divided evenly, unless you signed otherwise.' },
  separate: { name: 'Each keeps their own', line: 'On divorce, each of you keeps what is yours. Only what you hold jointly is divided, by what each of you put in.' },
};
/** Where children cannot be left out of a will: the share of an estate reserved for them. */
const FORCED = 'fr de it es pt be at gr br ar cl co pe mx jp kr ph sa eg ir iq jo kw qa ae ma dz tn';
export const RESERVED_SHARE_OF = Object.fromEntries(FORCED.split(' ').map((id) => [id, 0.5]));

// ---------- Saving for retirement ----------
// A plan of the player's own. An employer's pension is separate (engine/worklife.js).
export const PENSION_PLAN = { since: 1975, unlockAge: 60, earlyPenalty: 0.25, rates: [0, 0.03, 0.06, 0.1, 0.15], bondReturn: 0.03 };

// ---------- Insurance ----------
// premium and excess are shares of what is insured. Health cover is separate (engine/systems.js).
export const INSURANCE = {
  home: { name: 'Home insurance', since: 1850, premium: 0.003, excess: 0.01, blurb: 'Pays to put right damage to a property you own, above the excess.' },
  motor: { name: 'Vehicle insurance', since: 1920, premium: 0.04, excess: 0.05, blurb: 'Pays for damage to a vehicle you own, above the excess.' },
  life: { name: 'Life insurance', since: 1850, blurb: 'Pays a fixed sum when you die, to whoever you name or else to your estate.', covers: [5, 10, 20], load: 1.3 },
};
export const INSURERS = ['Granite Mutual', 'Hearth & Harbor', 'Northlight Assurance'];

// Businesses are engine/business.js and data/business.js; pets' costs and insurance are engine/animalCare.js.

// ---------- Payouts from investments ----------
// What each holding pays out a year, as a share of its price. The price then
// grows by that much less, so a holding returns the same in all; it simply
// comes partly as money. Invented figures.
export const YIELD = { index: 0.018, bonds: 0.03, cashfund: 0.024, dividend: 0.04, techfund: 0.004, smallcap: 0.01, emerging: 0.022,
  property_trust: 0.045, green: 0.006, healthfund: 0.014, halcyon: 0.035, brightwell: 0.03, atlas: 0.04, granite: 0.035, tidewater: 0.03, meadow: 0.032 };
/** Ready-made mixes to spread money across, for the "spread my investments" choice. */
export const MIXES = {
  cautious: { name: 'Cautious', blurb: 'Mostly bonds and cash. Small swings, small growth.', parts: { bonds: 0.5, cashfund: 0.2, index: 0.3 } },
  balanced: { name: 'Balanced', blurb: 'Shares and bonds about evenly. Middling swings.', parts: { index: 0.5, bonds: 0.3, dividend: 0.2 } },
  adventurous: { name: 'Adventurous', blurb: 'Nearly all shares. Big swings both ways, more growth over a long time.', parts: { index: 0.6, emerging: 0.2, smallcap: 0.2 } },
};

// ---------- State pensions ----------
// A pension from the state, from the age it starts, at a share of an ordinary
// wage where the player lives. Full after `full` years of work; less for fewer,
// down to a floor for those who barely worked. Simplified, and invented.
const GENEROUS = 'uk de fr nl be at ch se no dk fi ie it es pt pl cz jp nz au ca';
const MODEST = 'us kr br ar cl uy cr mx za ru tr gr hu ro sk ee hr il sg tw';
export const STATE_PENSION_OF = { ...Object.fromEntries(GENEROUS.split(' ').map((id) => [id, 0.3])), ...Object.fromEntries(MODEST.split(' ').map((id) => [id, 0.18])) };
export const STATE_PENSION = { age: 67, full: 35, floor: 0.4, fallback: 0.06 };

// ---------- After a divorce ----------
// Support is a game rule, not any country's law: a former spouse who earns much
// less is paid a share of the difference for half as many years as the marriage
// lasted (where what a couple has is shared equally); a parent who does not have
// the children pays toward them until they are grown.
export const SUPPORT = { spousalShare: 0.2, minYears: 5, maxYears: 10, childShare: 0.12 };

// ---------- Learning about money ----------
export const LESSONS = [
  { id: 'book', name: 'Read a book about money', cost: 25, gain: 4, minAge: 12, blurb: 'A plain guide to saving, borrowing and not being fooled.' },
  { id: 'course', name: 'Take an evening course in personal finance', cost: 400, gain: 10, minAge: 16, blurb: 'Ten weeks of budgets, interest and pensions, with homework.' },
  { id: 'adviser', name: 'Sit down with a financial adviser', cost: 900, gain: 6, minAge: 21, blurb: 'An hour on your own situation, with someone who does this all day.' },
];

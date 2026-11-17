// The world moving by itself: the numbers behind engine/economy.js.
//
// FICTION. None of this follows or predicts real events. A crisis that
// begins or ends in a save is the story of that save.

/** How a country's economy is doing. Effects apply to the country the player lives in. */
export const PHASES = {
  boom: { name: 'Boom', word: 'booming', hiring: 0.08, layoff: 0.004, housing: 0.025, fx: -0.05,
    start: 'The economy is booming. Firms are hiring, and house prices are climbing.' },
  steady: { name: 'Steady', word: 'steady', hiring: 0, layoff: 0.012, housing: 0, fx: 0,
    start: 'The economy has settled down.' },
  slump: { name: 'Recession', word: 'in recession', hiring: -0.12, layoff: 0.05, housing: -0.04, fx: 0.06,
    start: 'The economy has gone into recession. Firms are laying people off, and nobody is hiring.' },
};

/** Yearly chance of moving from one phase to another. */
export const TURN = {
  steady: { boom: 0.08, slump: 0.07 },
  boom: { steady: 0.25, slump: 0.06 },
  slump: { steady: 0.35 },
};

/** A year in which trouble spreads across borders: many economies fall at once. */
export const WORLD_DOWNTURN = { chance: 0.03, share: 0.4 };

/** Yearly chance that a crisis ends, and what is said when it does. */
export const CRISIS_END = {
  war: [0.06, 'The war in {place} is over. A ceasefire was signed, and people have begun to go home.'],
  collapse: [0.07, 'After years of collapse, the economy of {place} has started to work again. The shelves are filling.'],
  shortages: [0.12, 'Rationing has ended in {place}. The power stays on now.'],
  inflation: [0.12, 'Prices in {place} have been brought under control.'],
  sanctions: [0.05, 'Sanctions on {place} were lifted.'],
};

/** Crises that can begin where a country is already unstable (stability below `below`). */
export const CRISIS_START = {
  chance: 0.022,
  below: 50,
  kinds: {
    inflation: 'Prices in {place} have run out of control. Savings kept in cash are melting.',
    shortages: 'Food, fuel and medicine are being rationed in {place}.',
  },
};

/**
 * War can break out, rarely, in a country that is already deeply unstable. It is described as conflict within the
 * country, never as one named country attacking another: the game does not invent wars between real nations.
 */
export const WAR_START = {
  chance: 0.004,
  below: 32,
  text: 'Armed conflict has broken out in {place}. There is fighting in several regions, and the government has declared a state of emergency.',
};

/** How much a crisis weakens the currency (engine/currency.js pulls each rate towards 1 + this). */
export const CRISIS_FX = { war: 0.15, collapse: 0.3, shortages: 0.12, inflation: 0.3, sanctions: 0.15 };

/** People the player knows moving away, and coming back. Yearly chances. */
export const MOVES = {
  roles: ['sibling', 'friend', 'child', 'grandchild'],
  ages: [21, 50],
  leave: 0.008,
  crisisK: 4,       // times as likely from a country in crisis
  slumpK: 1.6,
  comeBack: 0.04,
  joinYou: 0.015,   // someone close, abroad, moving to where you are
};

/**
 * Families and couples that cross borders. Chances, not statistics: the same
 * everywhere, and the country someone comes from is drawn evenly from the
 * whole world so that no place is cast as a source of migrants.
 */
export const ROOTS = {
  parentFromAbroad: 0.1,   // a child is born to one parent who came from another country
  partnerFromAbroad: 0.08, // someone the player meets grew up somewhere else
  familyLeaves: 0.004,     // a year in which a child's family emigrates
  familyLeavesCrisisK: 6,
};

export const NEWS_MAX = 150;

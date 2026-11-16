// Monarchies: which countries have a crown, what the ranks are called there,
// and the rules that go with them. Every royal house and person in the game
// is invented; only the titles and the broad rules follow the real countries.
//
// ranks, highest first. Each is [id, title for a man, title for a woman].
//   'monarch', 'heir' and 'royal' are the royal family itself.
//   Everything after is the nobility (where the country still has one),
//   and 'knight' is an honour for a commoner, not inherited.
// rules:
//   maleOnly       only men can inherit the throne
//   leavesOnMarriage  a princess who marries a commoner leaves the royal family
//   honours        the crown gives titles to commoners for what they have done
//   type           'constitutional' | 'ceremonial' | 'executive' | 'absolute': how much the monarch governs
//   law            how the throne passes (see engine/succession.js):
//                    order 'absolute' (eldest child), 'malePreference' (sons first), 'maleOnly' (men, through fathers)
//                    adoption: adopted children can inherit; renounceCoversHeirs: giving up a place also
//                    takes out children born afterwards
//   reformed       daughters were given equal rights within living memory (told in the house's history)
// Countries that share another country's monarch (Canada, Australia, New
// Zealand, Jamaica) have no royal family of their own and are not listed.
export const MONARCHIES = {
  uk: { type: 'constitutional', law: { order: 'absolute', adoption: false, renounceCoversHeirs: false }, reformed: true, house: 'Royal House', honours: true,
    ranks: [['monarch', 'King', 'Queen'], ['heir', 'Prince', 'Princess'], ['royal', 'Prince', 'Princess'],
      ['duke', 'Duke', 'Duchess'], ['marquess', 'Marquess', 'Marchioness'], ['earl', 'Earl', 'Countess'],
      ['viscount', 'Viscount', 'Viscountess'], ['baron', 'Baron', 'Baroness'], ['knight', 'Sir', 'Dame']] },
  es: { type: 'constitutional', law: { order: 'malePreference', adoption: false, renounceCoversHeirs: false }, reformed: false, house: 'Royal House', honours: true,
    ranks: [['monarch', 'King', 'Queen'], ['heir', 'Prince', 'Princess'], ['royal', 'Infante', 'Infanta'],
      ['duke', 'Duke', 'Duchess'], ['marquess', 'Marquis', 'Marchioness'], ['earl', 'Count', 'Countess'], ['baron', 'Baron', 'Baroness'],
      ['knight', 'Don', 'Doña']] },
  se: { type: 'constitutional', law: { order: 'absolute', adoption: false, renounceCoversHeirs: false }, reformed: true, house: 'Royal House', honours: false,
    ranks: [['monarch', 'King', 'Queen'], ['heir', 'Crown Prince', 'Crown Princess'], ['royal', 'Prince', 'Princess'],
      ['duke', 'Duke', 'Duchess'], ['earl', 'Count', 'Countess'], ['baron', 'Baron', 'Baroness']] },
  no: { type: 'constitutional', law: { order: 'absolute', adoption: false, renounceCoversHeirs: false }, reformed: true, house: 'Royal House', honours: false,
    ranks: [['monarch', 'King', 'Queen'], ['heir', 'Crown Prince', 'Crown Princess'], ['royal', 'Prince', 'Princess']] },
  dk: { type: 'constitutional', law: { order: 'absolute', adoption: false, renounceCoversHeirs: false }, reformed: true, house: 'Royal House', honours: false,
    ranks: [['monarch', 'King', 'Queen'], ['heir', 'Crown Prince', 'Crown Princess'], ['royal', 'Prince', 'Princess'],
      ['earl', 'Count', 'Countess'], ['baron', 'Baron', 'Baroness']] },
  nl: { type: 'constitutional', law: { order: 'absolute', adoption: false, renounceCoversHeirs: false }, reformed: true, house: 'Royal House', honours: false,
    ranks: [['monarch', 'King', 'Queen'], ['heir', 'Prince', 'Princess'], ['royal', 'Prince', 'Princess'],
      ['earl', 'Count', 'Countess'], ['baron', 'Baron', 'Baroness'], ['knight', 'Jonkheer', 'Jonkvrouw']] },
  jp: { type: 'ceremonial', law: { order: 'maleOnly', adoption: false, renounceCoversHeirs: true }, reformed: false, house: 'Imperial House', honours: false, maleOnly: true, leavesOnMarriage: true,
    ranks: [['monarch', 'Emperor', 'Empress'], ['heir', 'Crown Prince', 'Crown Princess'], ['royal', 'Prince', 'Princess']] },
  th: { type: 'constitutional', law: { order: 'maleOnly', adoption: false, renounceCoversHeirs: true }, reformed: false, house: 'Royal House', honours: false, maleOnly: true,
    ranks: [['monarch', 'King', 'Queen'], ['heir', 'Crown Prince', 'Crown Princess'], ['royal', 'Prince', 'Princess']] },
  ma: { type: 'executive', law: { order: 'maleOnly', adoption: false, renounceCoversHeirs: true }, reformed: false, house: 'Royal House', honours: false, maleOnly: true,
    ranks: [['monarch', 'King', 'Queen'], ['heir', 'Crown Prince', 'Crown Princess'], ['royal', 'Prince', 'Princess']] },
  ae: { type: 'absolute', law: { order: 'maleOnly', adoption: false, renounceCoversHeirs: true }, reformed: false, house: 'Ruling House', honours: false, maleOnly: true,
    ranks: [['monarch', 'Emir', 'Sheikha'], ['heir', 'Crown Prince', 'Sheikha'], ['royal', 'Sheikh', 'Sheikha']] },
};

export const ROYAL_RANKS = ['monarch', 'heir', 'royal'];

/** What the crown pays each year, in base units, by rank. */
export const ALLOWANCE = { monarch: 9000000, heir: 2500000, royal: 600000, duke: 220000, marquess: 150000, earl: 110000,
  viscount: 75000, baron: 45000, knight: 0 };

/** How often a newborn in a monarchy is born into the royal family, or into the nobility. */
export const BORN_ROYAL = 0.012;
export const BORN_NOBLE = 0.03;

/** Public duties: a few a year. image: what it does for the public's opinion; cost: base units. */
export const DUTIES = [
  { id: 'opening', name: 'Open a hospital wing', image: [3, 6], mood: -1, text: 'You cut a ribbon, shook two hundred hands, and remembered every name you were told.' },
  { id: 'patron', name: 'Become patron of a charity', image: [5, 9], cost: 20000, karma: 6, text: 'Your name on the letterhead doubles what they raise this year.' },
  { id: 'tour', name: 'Go on a royal tour', image: [4, 10], mood: 2, text: 'Six cities in nine days, a great many children with flags, and one very long banquet.' },
  { id: 'troops', name: 'Visit the armed forces', image: [3, 6], text: 'You ate in the mess, asked the right questions, and stayed longer than the schedule allowed.' },
  { id: 'interview', name: 'Give a television interview', image: [-14, 14], risky: true, text: 'An hour on camera, with nowhere to hide.' },
  { id: 'walkabout', name: 'Meet the crowds', image: [2, 7], mood: 2, text: 'Flowers, phones held up, and an old woman who would not let go of your hand.' },
];
export const DUTIES_PER_YEAR = 3;

/** Below this, the palace acts: a royal by marriage or birth is removed from royal life. */
export const DISGRACE = 15;

/**
 * What a reign is remembered for. One is drawn for each past monarch. `standing`
 * moves how the public sees the house today, so a great-grandmother's choices
 * still colour how her descendants are received.
 */
export const REIGN_NOTES = [
  { text: 'kept the country out of a war that ruined its neighbours', standing: 6 },
  { text: 'was the first of the house to pay tax like anyone else', standing: 5 },
  { text: 'gave the first royal broadcast, and turned out to be a natural', standing: 4 },
  { text: 'married for love, against the advice of every minister', standing: 4 },
  { text: 'opened the palace gardens to the public every summer', standing: 3 },
  { text: 'survived an attempt on their life at the opera, and went back the next night', standing: 3 },
  { text: 'visited every town in the country at least once', standing: 3 },
  { text: 'sold a great deal of land to pay the family\'s debts', standing: 0 },
  { text: 'was said to prefer horses to people', standing: -1 },
  { text: 'had a quarrel with the heir that was never mended', standing: -2 },
  { text: 'barely appeared in public after the death of a child', standing: -2 },
  { text: 'was caught up in a spending scandal the newspapers never forgot', standing: -6 },
  { text: 'tried to keep a government in office against the voters, and nearly lost the throne for it', standing: -7 },
];

/** Things the newspapers find out about a royal. */
export const SCANDALS = [
  'was photographed leaving a casino at dawn', 'ran up debts that the palace quietly paid', 'gave an interview the palace had not approved',
  'was found to have a second family abroad', 'was caught speeding, three times in one month', 'fell out with the rest of the family in public',
  'took a paid seat on the board of a company that sells to the government', 'was secretly recorded being rude about the prime minister',
];

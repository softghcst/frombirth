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
// Countries that share another country's monarch (Canada, Australia, New
// Zealand, Jamaica) have no royal family of their own and are not listed.
export const MONARCHIES = {
  uk: { house: 'Royal House', honours: true,
    ranks: [['monarch', 'King', 'Queen'], ['heir', 'Prince', 'Princess'], ['royal', 'Prince', 'Princess'],
      ['duke', 'Duke', 'Duchess'], ['marquess', 'Marquess', 'Marchioness'], ['earl', 'Earl', 'Countess'],
      ['viscount', 'Viscount', 'Viscountess'], ['baron', 'Baron', 'Baroness'], ['knight', 'Sir', 'Dame']] },
  es: { house: 'Royal House', honours: true,
    ranks: [['monarch', 'King', 'Queen'], ['heir', 'Prince', 'Princess'], ['royal', 'Infante', 'Infanta'],
      ['duke', 'Duke', 'Duchess'], ['marquess', 'Marquis', 'Marchioness'], ['earl', 'Count', 'Countess'], ['baron', 'Baron', 'Baroness'],
      ['knight', 'Don', 'Doña']] },
  se: { house: 'Royal House', honours: false,
    ranks: [['monarch', 'King', 'Queen'], ['heir', 'Crown Prince', 'Crown Princess'], ['royal', 'Prince', 'Princess'],
      ['duke', 'Duke', 'Duchess'], ['earl', 'Count', 'Countess'], ['baron', 'Baron', 'Baroness']] },
  no: { house: 'Royal House', honours: false,
    ranks: [['monarch', 'King', 'Queen'], ['heir', 'Crown Prince', 'Crown Princess'], ['royal', 'Prince', 'Princess']] },
  dk: { house: 'Royal House', honours: false,
    ranks: [['monarch', 'King', 'Queen'], ['heir', 'Crown Prince', 'Crown Princess'], ['royal', 'Prince', 'Princess'],
      ['earl', 'Count', 'Countess'], ['baron', 'Baron', 'Baroness']] },
  nl: { house: 'Royal House', honours: false,
    ranks: [['monarch', 'King', 'Queen'], ['heir', 'Prince', 'Princess'], ['royal', 'Prince', 'Princess'],
      ['earl', 'Count', 'Countess'], ['baron', 'Baron', 'Baroness'], ['knight', 'Jonkheer', 'Jonkvrouw']] },
  jp: { house: 'Imperial House', honours: false, maleOnly: true, leavesOnMarriage: true,
    ranks: [['monarch', 'Emperor', 'Empress'], ['heir', 'Crown Prince', 'Crown Princess'], ['royal', 'Prince', 'Princess']] },
  th: { house: 'Royal House', honours: false, maleOnly: true,
    ranks: [['monarch', 'King', 'Queen'], ['heir', 'Crown Prince', 'Crown Princess'], ['royal', 'Prince', 'Princess']] },
  ma: { house: 'Royal House', honours: false, maleOnly: true,
    ranks: [['monarch', 'King', 'Queen'], ['heir', 'Crown Prince', 'Crown Princess'], ['royal', 'Prince', 'Princess']] },
  ae: { house: 'Ruling House', honours: false, maleOnly: true,
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

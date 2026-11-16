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
//   names          { male, female, house }: names for the royal house itself, where they differ from the country's at large
//   elective       { title, term, houses, realms }: (realms: the states the houses rule; the house in the game has one)
//                   the national throne is held in turn by several royal houses,
//                  each for `term` years; the house in the game takes its turn once every houses × term years
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
  be: { type: 'constitutional', law: { order: 'absolute', adoption: false, renounceCoversHeirs: false }, reformed: true, house: 'Royal House', honours: false,
    ranks: [['monarch', 'King', 'Queen'], ['heir', 'Crown Prince', 'Crown Princess'], ['royal', 'Prince', 'Princess'],
      ['earl', 'Count', 'Countess'], ['baron', 'Baron', 'Baroness']] },
  // A principality: the sovereign is a prince, not a king.
  mc: { type: 'executive', law: { order: 'malePreference', adoption: false, renounceCoversHeirs: false }, reformed: false, house: 'Princely House', honours: false,
    ranks: [['monarch', 'Prince', 'Princess'], ['heir', 'Hereditary Prince', 'Hereditary Princess'], ['royal', 'Prince', 'Princess']] },
  jo: { type: 'executive', law: { order: 'maleOnly', adoption: false, renounceCoversHeirs: true }, reformed: false, house: 'Royal House', honours: false, maleOnly: true,
    ranks: [['monarch', 'King', 'Queen'], ['heir', 'Crown Prince', 'Crown Princess'], ['royal', 'Prince', 'Princess']] },
  sa: { type: 'absolute', law: { order: 'maleOnly', adoption: false, renounceCoversHeirs: true }, reformed: false, house: 'Royal House', honours: false, maleOnly: true,
    ranks: [['monarch', 'King', 'Princess'], ['heir', 'Crown Prince', 'Princess'], ['royal', 'Prince', 'Princess']] },
  kw: { type: 'executive', law: { order: 'maleOnly', adoption: false, renounceCoversHeirs: true }, reformed: false, house: 'Ruling House', honours: false, maleOnly: true,
    ranks: [['monarch', 'Emir', 'Sheikha'], ['heir', 'Crown Prince', 'Sheikha'], ['royal', 'Sheikh', 'Sheikha']] },
  qa: { type: 'absolute', law: { order: 'maleOnly', adoption: false, renounceCoversHeirs: true }, reformed: false, house: 'Ruling House', honours: false, maleOnly: true,
    ranks: [['monarch', 'Emir', 'Sheikha'], ['heir', 'Heir Apparent', 'Sheikha'], ['royal', 'Sheikh', 'Sheikha']] },
  // A federation of nine royal houses. The house in the game is one of them: its sultan rules a state by
  // inheritance, and every so often takes a five-year turn as king of the whole country (`elective`).
  my: { type: 'constitutional', law: { order: 'maleOnly', adoption: false, renounceCoversHeirs: true }, reformed: false, house: 'Royal House', honours: false, maleOnly: true,
    elective: { title: ['King', 'Queen'], term: 5, houses: 9, realms: ['Johor', 'Kedah', 'Kelantan', 'Pahang', 'Perak', 'Selangor', 'Terengganu', 'Perlis', 'Negeri Sembilan'] },
    // The country has many peoples; its royal houses are Malay, and are named so.
    names: { male: ['Ahmad', 'Iskandar', 'Ibrahim', 'Abdullah', 'Azlan', 'Ismail', 'Mahmud', 'Mizan', 'Sharafuddin', 'Nazrin', 'Muhammad', 'Sallehuddin', 'Hassanal', 'Idris', 'Yahya', 'Zainal', 'Faris', 'Aminuddin', 'Hisham', 'Sulaiman'],
      female: ['Azizah', 'Zarith', 'Haminah', 'Aminah', 'Nur', 'Siti', 'Zara', 'Aishah', 'Fatimah', 'Maimunah', 'Norashikin', 'Bahiyah', 'Intan', 'Salehah', 'Kalsom', 'Mariam', 'Zanariah', 'Afzan', 'Iman', 'Jihan'],
      house: ['Temenggong', 'Bendahara', 'Jamalullail', 'Siak', 'Mahawangsa', 'Opu Daeng', 'Pagaruyung', 'Long Yunus', 'Bugis'] },
    ranks: [['monarch', 'Sultan', 'Sultanah'], ['heir', 'Raja Muda', 'Raja Puan Muda'], ['royal', 'Tengku', 'Tengku']] },
};

export const ROYAL_RANKS = ['monarch', 'heir', 'royal'];

/** What the crown pays each year, in base units, by rank. */
export const ALLOWANCE = { monarch: 9000000, heir: 2500000, royal: 600000, duke: 220000, marquess: 150000, earl: 110000,
  viscount: 75000, baron: 45000, knight: 0 };

/** How often a newborn in a monarchy is born into the royal family, or into the nobility. */
export const BORN_ROYAL = 0.012;
export const BORN_NOBLE = 0.03;

/**
 * Public duties: a few a year, of four kinds. image: what it does for the public's opinion; family: for the
 * family's regard; support: for the monarchy itself; cost: base units; text: one of these is told each time.
 */
export const DUTIES = [
  // Charity and public service
  { id: 'opening', kind: 'Public service', name: 'Open a hospital wing', image: [3, 6], mood: -1, text: ['You cut a ribbon, shook two hundred hands, and remembered every name you were told.', 'The ribbon would not cut. You laughed, somebody found better scissors, and the photograph of you laughing is the one they used.'] },
  { id: 'patron', kind: 'Public service', name: 'Become patron of a charity', image: [5, 9], cost: 20000, karma: 6, text: ['Your name on the letterhead doubles what they raise this year.', 'You ask to see the accounts before you agree. They are impressed, and a little frightened.'] },
  { id: 'disaster', kind: 'Public service', name: 'Visit people after a disaster', image: [5, 10], karma: 5, mood: -3, support: 2, text: ['You stand in what was somebody\'s kitchen and listen. There is nothing to say, and you do not try to say it.', 'A man shows you a photograph of his house as it was. You stay with him an hour longer than the schedule allowed.'] },
  { id: 'walkabout', kind: 'Public service', name: 'Meet the crowds', image: [2, 7], mood: 2, text: ['Flowers, phones held up, and an old woman who would not let go of your hand.', 'A child asks whether you have a crown at home. You say it is very heavy and mostly kept in a cupboard.'] },
  // Ceremonial
  { id: 'troops', kind: 'Ceremonial', name: 'Visit the armed forces', image: [3, 6], text: ['You ate in the mess, asked the right questions, and stayed longer than the schedule allowed.', 'A sergeant teaches you to strip a rifle. You are slow, and he is tactful about it.'] },
  { id: 'memorial', kind: 'Ceremonial', name: 'Lead a service of remembrance', image: [3, 6], support: 2, family: 2, text: ['Two minutes of silence in the rain, and a wreath laid without a single wrong step.', 'An old soldier in the front row salutes you from a wheelchair. You salute back, which is not in the order of service.'] },
  { id: 'investiture', kind: 'Ceremonial', name: 'Present honours', image: [2, 5], family: 2, mood: 2, text: ['Ninety people, ninety medals, and a different sentence for each of them.', 'A lollipop lady of forty years\' service tells you off for standing in a draught.'] },
  // Diplomatic
  { id: 'tour', kind: 'Diplomatic', name: 'Go on a royal tour', image: [4, 10], mood: 2, support: 1, text: ['Six cities in nine days, a great many children with flags, and one very long banquet.', 'You are garlanded, fed, danced at and rained on, and you would not have missed a minute.'] },
  { id: 'banquet', kind: 'Diplomatic', name: 'Host a state dinner', image: [2, 6], support: 2, family: 3, text: ['A hundred and seventy guests, six courses, and a toast you gave in the visitor\'s own language.', 'The visiting president\'s wife turns out to keep bees. You talk about nothing else, and a treaty is signed in the morning.'] },
  { id: 'abroad', kind: 'Diplomatic', name: 'Represent the country abroad', image: [-8, 12], risky: true, support: 2, text: ['A week of handshakes in a country that does not much like yours.', 'Every word you say abroad is weighed twice: once there, and once at home.'] },
  { id: 'interview', kind: 'Diplomatic', name: 'Give a television interview', image: [-14, 14], risky: true, text: ['An hour on camera, with nowhere to hide.'] },
  // Family
  { id: 'standin', kind: 'Family', name: 'Stand in for an older relative', image: [2, 5], family: 6, text: ['You take the engagements they can no longer manage, and say each time that they send their love.', 'You read the speech they would have given, in their words. Half the hall is in tears.'] },
  { id: 'mentor', kind: 'Family', name: 'Prepare a younger royal for the work', image: [0, 2], family: 5, karma: 3, text: ['You take them on their first walkabout and stand half a step behind. They do well. You tell them so.', 'You teach them the trick of it: ask a question, and listen to the answer.'] },
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

/**
 * Affairs of state: what a reigning monarch can do with a year. kind 'advise'
 * is for crowns that do not govern (ceremonial, constitutional); 'rule' for
 * those that do (executive, absolute).
 *   support  the country's support for the monarchy; image/family/press: the monarch's own reputations
 *   risky    { base, stat }: it can fail, and `fail` then replaces the fields it names
 *   gives    the kind of monarchy this turns the country into
 */
export const POWERS = [
  { id: 'address', kind: 'advise', name: 'Address the nation', note: 'A broadcast in a hard year. It can steady a country, or fall flat.',
    risky: { base: 0.6, stat: 'charm' }, support: 5, image: 5, text: 'You speak for nine minutes about what the country has been through, and it listens.',
    fail: { support: -2, image: -4, text: 'The words are right and the delivery is wooden. It is mocked by breakfast.' } },
  { id: 'honours', kind: 'advise', name: 'Honour people nobody has heard of', note: 'Nurses, lollipop ladies, a man who has run a youth club for forty years.',
    support: 3, image: 3, karma: 3, text: 'You give the highest honours to people who never expected a letter from a palace. It is the most popular list in memory.' },
  { id: 'books', kind: 'advise', name: 'Open the palace accounts', note: 'Publish what the crown costs, and cut it. The family will hate it.',
    support: 9, family: -12, press: 5, chronicle: 'opened the palace accounts to the public and cut the cost of the crown', text: 'Every bill, published. Three residences are given up. The family eats in silence; the country approves.' },
  { id: 'counsel', kind: 'advise', name: 'Press the government in private', note: 'Your right to advise and to warn. If it leaks, it is meddling.',
    risky: { base: 0.55, stat: 'intellect' }, support: 3, karma: 4, text: 'A quiet word, at the right moment. A bad law is made a little less bad, and nobody ever knows.',
    fail: { support: -6, press: -6, text: 'Your letter to a minister is in the newspapers by Friday. "The crown should know its place," says the editorial.' } },
  { id: 'refuse', kind: 'advise', name: 'Refuse to sign a law', note: 'No monarch has done it in living memory. A constitutional crisis either way.',
    risky: { base: 0.3, stat: 'charm' }, support: 12, image: 10, karma: 6, chronicle: 'refused to sign a law, and the country backed the crown', text: 'You will not sign. The government blusters, the country takes your side, and the law is withdrawn.',
    fail: { support: -18, image: -12, press: -10, text: 'You will not sign. The government calls it an attack on democracy, and most of the country agrees.' } },

  { id: 'spend', kind: 'rule', name: 'Build hospitals and schools', note: 'Popular, and what a ruler is for.',
    support: 6, image: 4, karma: 6, text: 'A hospital in every province, begun this year. Your name is on none of them, at your own order.' },
  { id: 'purge', kind: 'rule', name: 'Dismiss corrupt officials', note: 'They have friends. Some of the friends are your relatives.',
    risky: { base: 0.6, stat: 'intellect' }, support: 7, family: -8, karma: 5, text: 'Forty officials gone in a morning, two of them cousins. The markets and the street both approve.',
    fail: { support: -3, family: -12, text: 'The ones you dismissed were the ones who could be spared. The real thieves send their congratulations.' } },
  { id: 'kin', kind: 'rule', name: 'Give ministries to your relatives', note: 'The family will be delighted. Nobody else will.',
    support: -6, family: 12, karma: -5, text: 'Three ministries, three cousins. The family toasts you. In the cafés they are counting on their fingers.' },
  { id: 'silence', kind: 'rule', name: 'Silence your critics', note: 'It works, for a while, and it is remembered for ever.',
    support: -4, press: -15, image: -6, karma: -18, text: 'Two newspapers closed and a poet in prison. It is quieter. That is not the same as calmer.' },
  { id: 'assembly', kind: 'rule', name: 'Hand power to an elected parliament', note: 'You would reign, and no longer rule. It cannot be taken back.', gives: 'constitutional',
    support: 16, image: 10, family: -20, karma: 15, text: 'You sign away the power your family has held for centuries, in front of the cameras, with a borrowed pen. The family will never forgive you. The country may never forget it.' },
];
export const POWERS_PER_YEAR = 2;

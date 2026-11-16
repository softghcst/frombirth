// Politics: how each country is governed, which offices can be run for and
// what they are called there, and what campaigning and governing involve.
// Parties, opponents and office-holders are all invented.
//
// kind:
//   'presidential'   voters elect a president directly
//   'parliamentary'  voters elect a parliament; its leader is the head of government
//   'party'          one party rules; offices are given by its committees, not by voters
//   'none'           no elections at all; power is inherited
// rigged: elections are held, but the count leans heavily towards those already in power
// region: what the head of a state or province is called (left out where the country has none)
// seat:   what a member of the national legislature is called
// head:   what the head of government is called
// nativeOnly: only someone born in the country may hold the top office
const P = (head, seat, region, extra = {}) => ({ kind: 'presidential', head, seat, region, limit: 2, ...extra });
const M = (head, seat, region, extra = {}) => ({ kind: 'parliamentary', head, seat, region, ...extra });
const MP = 'Member of Parliament';

export const SYSTEMS = {
  us: P('President', 'Senator', 'Governor', { nativeOnly: true }),
  br: P('President', 'Senator', 'Governor', { nativeOnly: true }),
  mx: P('President', 'Senator', 'Governor', { nativeOnly: true, limit: 1 }),
  ar: P('President', 'Senator', 'Governor', { nativeOnly: true }),
  co: P('President', 'Senator', 'Governor', { nativeOnly: true, limit: 1 }),
  cl: P('President', 'Senator', 'Regional Governor', { limit: 1 }),
  pe: P('President', 'Member of Congress', 'Regional Governor', { nativeOnly: true, limit: 1 }),
  do: P('President', 'Senator', 'Governor'),
  ph: P('President', 'Senator', 'Governor', { nativeOnly: true, limit: 1 }),
  kr: P('President', 'Member of the National Assembly', 'Governor', { limit: 1 }),
  ng: P('President', 'Senator', 'Governor', { nativeOnly: true }),
  ke: P('President', 'Senator', 'Governor', { nativeOnly: true }),
  gh: P('President', MP, 'Regional Minister', { nativeOnly: true }),
  id: P('President', 'Member of the People\'s Representative Council', 'Governor', { nativeOnly: true }),
  tr: P('President', 'Member of the Grand National Assembly', 'Governor'),
  fr: P('President', 'Deputy', 'Regional President'),
  ua: P('President', 'People\'s Deputy', 'Governor'),
  za: P('President', MP, 'Premier'),
  ru: P('President', 'Deputy of the State Duma', 'Governor', { rigged: true, limit: 0 }),
  ve: P('President', 'Deputy', 'Governor', { rigged: true, limit: 0 }),
  eg: P('President', 'Member of the House of Representatives', 'Governor', { rigged: true, limit: 0 }),

  uk: M('Prime Minister', MP, 'First Minister'),
  ca: M('Prime Minister', MP, 'Premier'),
  au: M('Prime Minister', MP, 'Premier'),
  nz: M('Prime Minister', MP, null),
  in: M('Prime Minister', MP, 'Chief Minister'),
  pk: M('Prime Minister', 'Member of the National Assembly', 'Chief Minister'),
  jp: M('Prime Minister', 'Member of the Diet', 'Governor'),
  de: M('Chancellor', 'Member of the Bundestag', 'Minister-President'),
  it: M('Prime Minister', 'Deputy', 'Regional President'),
  es: M('Prime Minister', 'Deputy', 'Regional President'),
  pt: M('Prime Minister', 'Deputy', null),
  se: M('Prime Minister', 'Member of the Riksdag', null),
  no: M('Prime Minister', 'Member of the Storting', null),
  dk: M('Prime Minister', 'Member of the Folketing', null),
  nl: M('Prime Minister', MP, 'King\'s Commissioner'),
  ie: M('Taoiseach', 'Teachta Dála', null),
  gr: M('Prime Minister', MP, 'Regional Governor'),
  pl: M('Prime Minister', 'Member of the Sejm', 'Marshal of the Voivodeship'),
  ch: M('President of the Confederation', 'National Councillor', 'Cantonal President'),
  jm: M('Prime Minister', MP, null),
  th: M('Prime Minister', MP, 'Governor'),
  sg: M('Prime Minister', MP, null),
  ma: M('Head of Government', MP, 'Regional President'),

  cn: { kind: 'party', head: 'President', seat: 'Delegate to the National People\'s Congress', region: 'Provincial Party Secretary' },
  vn: { kind: 'party', head: 'General Secretary', seat: 'Delegate to the National Assembly', region: 'Provincial Party Secretary' },
  cu: { kind: 'party', head: 'President', seat: 'Deputy to the National Assembly', region: 'Provincial Governor' },

  ae: { kind: 'none' },
  sa: { kind: 'none' },
  qa: { kind: 'none' },
  be: M('Prime Minister', MP, 'Minister-President'),
  mc: M('Minister of State', 'National Councillor', null),
  jo: M('Prime Minister', MP, 'Governor'),
  kw: M('Prime Minister', 'Member of the National Assembly', 'Governor'),
  my: M('Prime Minister', MP, 'Chief Minister'),
};

/**
 * The ladder. tier: how high the office is. base: how hard it is for an
 * unknown to win (higher is easier). cost and salary are in base units.
 * fullTime offices replace an ordinary job.
 */
export const OFFICES = [
  { id: 'council', tier: 1, minAge: 18, base: 46, cost: 1500, salary: 14000, term: 4, fullTime: false },
  { id: 'mayor', tier: 2, minAge: 21, base: 40, cost: 12000, salary: 95000, term: 4, fullTime: true },
  { id: 'seat', tier: 3, minAge: 25, base: 37, cost: 50000, salary: 150000, term: 5, fullTime: true },
  { id: 'region', tier: 4, minAge: 30, base: 36, cost: 140000, salary: 165000, term: 4, fullTime: true },
  { id: 'head', tier: 5, minAge: 35, base: 30, cost: 450000, salary: 380000, term: 4, fullTime: true },
];

/** What you stand for. One of these is what the voters happen to want this year. */
export const PLATFORMS = [
  { id: 'jobs', name: 'Jobs and wages' },
  { id: 'order', name: 'Law and order' },
  { id: 'health', name: 'Hospitals and schools' },
  { id: 'taxes', name: 'Lower taxes' },
  { id: 'green', name: 'Clean air and water' },
  { id: 'change', name: 'Throw the old lot out' },
  { id: 'silly', name: 'A free pony for every household', silly: true },
];

/** How much is spent, as a multiple of the office's basic cost, and what it buys. */
export const BUDGETS = [
  { id: 'shoestring', name: 'A shoestring', times: 1, boost: 0, desc: 'Leaflets, a borrowed van, and your own two feet.' },
  { id: 'proper', name: 'A proper campaign', times: 4, boost: 5, desc: 'Staff, posters, and an office with a kettle.' },
  { id: 'lavish', name: 'Money no object', times: 14, boost: 10, desc: 'Your face on every screen and every bus.' },
];

/** Things to do on the campaign trail. Two can be chosen. */
export const MOVES = [
  { id: 'doors', name: 'Knock on every door', boost: [3, 7], factor: 'discipline', text: 'You wear out two pairs of shoes.' },
  { id: 'rally', name: 'Hold big rallies', boost: [1, 9], factor: 'charm', text: 'The crowds are loud, and some of them are even there for you.' },
  { id: 'debate', name: 'Challenge your opponent to a debate', boost: [-6, 12], factor: 'intellect', text: 'An hour under the lights, with nowhere to hide.' },
  { id: 'babies', name: 'Kiss babies and eat local food', boost: [2, 5], factor: 'charm', text: 'You eat nine regional delicacies in one day and smile through all of them.' },
  { id: 'smear', name: 'Run attack adverts', boost: [-8, 12], dirty: true, karma: -6, text: 'Your opponent\'s worst photograph is on every channel.' },
  { id: 'buy', name: 'Hand out envelopes on polling day', boost: [8, 18], illegal: true, karma: -12, text: 'A great many people are suddenly very keen to vote.' },
];

/** What an office-holder can do with a year. Two a year. tier: the lowest office that can do it. */
export const ACTIONS = [
  { id: 'meet', tier: 1, name: 'Hold open meetings', approval: [2, 5], text: 'You sit in draughty halls and listen to people complain about bins, and it does you good.' },
  { id: 'build', tier: 1, name: 'Build something people can see', approval: [3, 8], text: 'There is a ribbon, a pair of giant scissors, and your name on a brass plate.' },
  { id: 'cut', tier: 2, name: 'Cut taxes', approval: [5, 10], debt: true, text: 'Everyone has a little more in their pocket. The treasury has a good deal less.' },
  { id: 'reform', tier: 2, name: 'Push through a hard reform', approval: [-9, -2], karma: 6, lasting: true, text: 'It is needed, it is right, and nobody thanks you for it. Not yet.' },
  { id: 'favours', tier: 1, name: 'Steer contracts to your friends', approval: [0, 0], graft: true, text: 'A contract goes to a company owned by a man you play golf with.' },
  { id: 'holiday', tier: 5, name: 'Declare a national holiday', approval: [4, 9], text: 'Nobody has ever voted against a day off.' },
  { id: 'statue', tier: 5, name: 'Put up a statue of yourself', approval: [-10, -3], mood: 8, text: 'It is forty feet high, and the pigeons have already found it.' },
  { id: 'pardon', tier: 5, name: 'Pardon yourself of everything', approval: [-14, -6], pardon: true, text: 'With one signature, your record is as clean as the day you were born.' },
  { id: 'seize', tier: 5, name: 'Seize emergency powers', approval: [0, 0], seize: true, text: '' },
];
export const ACTIONS_PER_YEAR = 2;

/** Below this approval, the people (or the party) move to throw an office-holder out. */
export const REMOVAL = 22;

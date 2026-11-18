// History, for lives that begin in the past: what prices were, and what
// happened. Prices are shown at the level of their year (data from the
// overall shape of consumer prices, rounded; one index for every country, a
// simplification). The game's sums are kept at today's values underneath, so
// everything stays in proportion; only what is shown changes with the year.
// Events are the large ones that changed ordinary lives: wars and call-ups,
// depressions and crashes, and a few moments everyone remembers.
// GAMEPLAY CONFIGURATION: simplified history, written neutrally.

/** The year the game's prices are written for. From it on, prices are shown as they are. */
export const PRESENT = 2025;

/** Prices in a year as a share of PRESENT's. Between the years listed, the level is read in a straight line. */
export const PRICE_INDEX = [
  [1920, 0.063], [1925, 0.055], [1930, 0.052], [1933, 0.041], [1940, 0.044], [1945, 0.056], [1950, 0.075], [1955, 0.084],
  [1960, 0.092], [1965, 0.098], [1970, 0.121], [1975, 0.168], [1980, 0.257], [1985, 0.336], [1990, 0.408], [1995, 0.476],
  [2000, 0.536], [2005, 0.608], [2010, 0.68], [2015, 0.738], [2020, 0.807], [2022, 0.91], [2025, 1],
];

// The second world war: fought at home (bombing, occupation, the front line) in some countries, far away in others.
const AT_HOME = ['uk', 'fr', 'pl', 'nl', 'be', 'no', 'gr', 'ru', 'cn', 'de', 'it', 'jp', 'ph'];
const ABROAD = ['ca', 'au', 'nz', 'in', 'za'];

/**
 * Events. year (and until, for those that last); places: country ids, or 'all'.
 *   slump:        the economy turns down, for the years given
 *   war:          a war at home: a crisis, call-up papers for men of age
 *   draft:        men of age are called up to fight abroad (conscription for those years); maxAge, the oldest called
 *   conscription: compulsory military service in peacetime, for those years
 *   news:         something everyone heard about
 */
export const HISTORY = [
  { year: 1929, until: 1933, kind: 'slump', places: 'all', text: 'The stock market has crashed. Banks are failing, and work is disappearing everywhere: the Great Depression has begun.', end: 'The worst of the Depression is over, though few would call it good times.' },
  { year: 1939, until: 1945, kind: 'war', places: AT_HOME, text: 'War has been declared. Within weeks, much of the world is at war.', end: 'The war is over. People pour into the streets.' },
  { year: 1939, until: 1945, kind: 'draft', maxAge: 45, places: ABROAD, text: 'War has been declared, and men are being called up to fight overseas.', end: 'The war is over. People pour into the streets.' },
  { year: 1941, until: 1945, kind: 'draft', maxAge: 45, places: ['us'], text: 'After an attack on its fleet, the United States has entered the war.', end: 'The war is over. People pour into the streets.' },
  { year: 1940, until: 1973, kind: 'conscription', places: ['us'], text: 'Men of military age must register for the draft.' },
  { year: 1939, until: 1960, kind: 'conscription', places: ['uk'], text: 'Every young man will do national service.' },
  { year: 1950, until: 1953, kind: 'draft', places: ['us', 'uk', 'au', 'ca', 'kr', 'tr'], text: 'War has broken out in Korea, and troops are being sent.', end: 'An armistice is signed in Korea.' },
  { year: 1965, until: 1973, kind: 'draft', places: ['us', 'au', 'nz', 'kr'], text: 'More troops are being sent to Vietnam, and young men are being called up.', end: 'The last combat troops come home from Vietnam.' },
  { year: 1964, until: 1972, kind: 'conscription', places: ['au'], text: 'A ballot by birth date now decides which young men are called up.' },
  { year: 1956, until: 2011, kind: 'conscription', places: ['de'], text: 'Military service is compulsory for young men again.' },
  { year: 1974, until: 1975, kind: 'slump', places: 'all', text: 'An oil embargo has sent prices soaring; economies are stalling everywhere.', end: 'The oil shock has eased.' },
  { year: 1981, until: 1982, kind: 'slump', places: ['us', 'uk', 'ca', 'mx', 'br', 'ar'], text: 'Interest rates are punishing, and a recession has set in.', end: 'The recession has lifted.' },
  { year: 2008, until: 2009, kind: 'slump', places: 'all', text: 'A banking crisis has spread across the world. Banks are being rescued, and jobs are being cut.', end: 'The worst of the financial crisis has passed.' },
  { year: 2020, until: 2020, kind: 'slump', places: 'all', text: 'A pandemic has closed borders, schools and businesses around the world.', end: 'Life is slowly opening up again after the pandemic.', mood: -8 },
  { year: 1945, kind: 'news', places: 'all', text: 'The United Nations has been founded.' },
  { year: 1953, kind: 'news', places: ['uk'], text: 'Crowds line the streets for the coronation.' },
  { year: 1957, kind: 'news', places: 'all', text: 'A satellite is circling the Earth: the space age has begun.' },
  { year: 1963, kind: 'news', places: ['us'], text: 'The President has been assassinated. The country is in shock.' },
  { year: 1969, kind: 'news', places: 'all', text: 'People have walked on the Moon. Half the world watched it live.' },
  { year: 1989, kind: 'news', places: 'all', text: 'The Berlin Wall has come down.' },
  { year: 1990, kind: 'news', places: ['de'], text: 'Germany is one country again.' },
  { year: 1991, kind: 'news', places: 'all', text: 'The Soviet Union has dissolved.' },
  { year: 1994, kind: 'news', places: ['za'], text: 'South Africa has held its first election open to all, and has a new president.' },
  { year: 2001, kind: 'news', places: 'all', text: 'Terrorist attacks in New York and Washington have shaken the world.' },
  { year: 2002, kind: 'news', places: ['de', 'fr', 'it', 'es', 'nl', 'be', 'at', 'pt', 'ie', 'fi', 'gr'], text: 'Euro notes and coins are in everyone\'s pockets now.' },
];

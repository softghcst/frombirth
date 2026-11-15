// What can be bought on the market. All names are fictional.
// price: starting price per unit in base units. drift: average yearly return.
// vol: how wildly it swings. beta: how much it follows the wider market.
// bust: yearly chance of collapsing to almost nothing.
export const SECURITIES = [
  { id: 'index', name: 'Global Index Fund', kind: 'fund', price: 100, drift: 0.07, vol: 0.14, beta: 1, bust: 0,
    blurb: 'A slice of thousands of companies. Slow, steady, dull.' },
  { id: 'bonds', name: 'Government Bond Fund', kind: 'fund', price: 50, drift: 0.035, vol: 0.04, beta: 0.1, bust: 0,
    blurb: 'Lends money to the government. Barely moves.' },
  { id: 'halcyon', name: 'Halcyon Energy', kind: 'stock', price: 40, drift: 0.06, vol: 0.22, beta: 1, bust: 0.002,
    blurb: 'Power stations and wind farms.' },
  { id: 'brightwell', name: 'Brightwell Foods', kind: 'stock', price: 25, drift: 0.05, vol: 0.16, beta: 0.7, bust: 0.001,
    blurb: 'Breakfast cereal and frozen peas.' },
  { id: 'nimbus', name: 'Nimbus Software', kind: 'stock', price: 80, drift: 0.11, vol: 0.34, beta: 1.4, bust: 0.004,
    blurb: 'Fast-growing, expensive, much talked about.' },
  { id: 'corvid', name: 'Corvid Motors', kind: 'stock', price: 15, drift: 0.04, vol: 0.4, beta: 1.3, bust: 0.015,
    blurb: 'A carmaker with big promises and bigger debts.' },
  { id: 'larkspur', name: 'Larkspur Pharma', kind: 'stock', price: 60, drift: 0.08, vol: 0.3, beta: 0.8, bust: 0.005,
    blurb: 'Lives and dies on its drug trials.' },
  { id: 'atlas', name: 'Atlas Bank', kind: 'stock', price: 50, drift: 0.06, vol: 0.24, beta: 1.2, bust: 0.003,
    blurb: 'Fine, until it is not.' },
  { id: 'orbit', name: 'Orbit Coin', kind: 'crypto', price: 1000, drift: 0.15, vol: 0.6, beta: 0.5, bust: 0.012,
    blurb: 'The biggest digital coin. Wild swings.' },
  { id: 'ember', name: 'Ember Token', kind: 'crypto', price: 2, drift: 0.2, vol: 0.8, beta: 0.4, bust: 0.03,
    blurb: 'A smaller coin with a passionate following.' },
  { id: 'dogfish', name: 'Dogfish Coin', kind: 'crypto', price: 0.05, drift: 0.25, vol: 1.0, beta: 0.3, bust: 0.06,
    blurb: 'Started as a joke. Still is, mostly.' },
];
export const SECURITY_BY_ID = Object.fromEntries(SECURITIES.map((s) => [s.id, s]));

/** Amounts offered when buying, in base units. */
export const INVEST_AMOUNTS = [500, 2000, 10000, 50000, 250000, 1000000];

/** Bank lending. rate is yearly; years is the term. */
export const BANK_LOAN = { rate: 0.09, years: 5, amounts: [2000, 10000, 30000, 80000, 200000], maxShare: 0.4 };
/** Interest on a negative balance, per year. */
export const OVERDRAFT_RATE = 0.18;
/** Years a bankruptcy blocks borrowing. */
export const BANKRUPTCY_YEARS = 7;

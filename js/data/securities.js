// What can be bought on the market. All names are fictional.
// price: starting price per unit in base units. drift: average yearly return.
// vol: how wildly it swings. beta: how much it follows the wider market.
// bust: yearly chance of collapsing to almost nothing.
export const SECURITIES = [
  // ---------- Funds: many things in one, so they rarely collapse ----------
  { id: 'index', name: 'Global Index Fund', kind: 'fund', price: 100, drift: 0.07, vol: 0.14, beta: 1, bust: 0,
    blurb: 'A slice of thousands of companies. Slow, steady, dull.' },
  { id: 'bonds', name: 'Government Bond Fund', kind: 'fund', price: 50, drift: 0.035, vol: 0.04, beta: 0.1, bust: 0,
    blurb: 'Lends money to the government. Barely moves.' },
  { id: 'cashfund', name: 'Money Market Fund', kind: 'fund', price: 10, drift: 0.025, vol: 0.005, beta: 0, bust: 0,
    blurb: 'Barely better than a savings account, and just as calm.' },
  { id: 'dividend', name: 'Dividend Income Fund', kind: 'fund', price: 60, drift: 0.06, vol: 0.11, beta: 0.8, bust: 0,
    blurb: 'Old, dull companies that pay out every year.' },
  { id: 'techfund', name: 'Technology Growth Fund', kind: 'fund', price: 120, drift: 0.1, vol: 0.26, beta: 1.4, bust: 0,
    blurb: 'Every fashionable tech company in one basket.' },
  { id: 'smallcap', name: 'Small Companies Fund', kind: 'fund', price: 40, drift: 0.085, vol: 0.22, beta: 1.2, bust: 0,
    blurb: 'Tomorrow\'s giants, and a lot of tomorrow\'s failures.' },
  { id: 'emerging', name: 'Emerging Markets Fund', kind: 'fund', price: 35, drift: 0.085, vol: 0.24, beta: 1.1, bust: 0,
    blurb: 'Fast-growing economies. Bumpy.' },
  { id: 'property_trust', name: 'Property Trust', kind: 'fund', price: 75, drift: 0.06, vol: 0.16, beta: 0.7, bust: 0,
    blurb: 'Offices, warehouses and shopping centers, without the tenants ringing you.' },
  { id: 'green', name: 'Clean Energy Fund', kind: 'fund', price: 45, drift: 0.08, vol: 0.28, beta: 1.1, bust: 0,
    blurb: 'Wind, solar and batteries. Popular one year, forgotten the next.' },
  { id: 'gold', name: 'Gold Fund', kind: 'fund', price: 180, drift: 0.04, vol: 0.15, beta: -0.3, bust: 0,
    blurb: 'Tends to rise when everything else is falling.' },
  { id: 'healthfund', name: 'Healthcare Fund', kind: 'fund', price: 90, drift: 0.07, vol: 0.13, beta: 0.6, bust: 0,
    blurb: 'People get ill in good years and bad.' },

  // ---------- Shares in single companies ----------
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
  { id: 'pinecone', name: 'Pinecone Devices', kind: 'stock', price: 150, drift: 0.1, vol: 0.28, beta: 1.2, bust: 0.002,
    blurb: 'Phones and laptops people queue overnight for.' },
  { id: 'quill', name: 'Quill Search', kind: 'stock', price: 110, drift: 0.1, vol: 0.26, beta: 1.2, bust: 0.002,
    blurb: 'Knows what everyone is looking for, and sells the answer.' },
  { id: 'voltaic', name: 'Voltaic Electric Cars', kind: 'stock', price: 200, drift: 0.13, vol: 0.42, beta: 1.6, bust: 0.005,
    blurb: 'Worth more than every other carmaker put together, on a good day.' },
  { id: 'parcelbird', name: 'Parcelbird', kind: 'stock', price: 95, drift: 0.09, vol: 0.27, beta: 1.2, bust: 0.002,
    blurb: 'Whatever you ordered, it is on a van.' },
  { id: 'looplane', name: 'Looplane Streaming', kind: 'stock', price: 70, drift: 0.08, vol: 0.38, beta: 1.1, bust: 0.006,
    blurb: 'One hit series away from greatness, every year.' },
  { id: 'saffron', name: 'Saffron Air', kind: 'stock', price: 12, drift: 0.05, vol: 0.34, beta: 1.5, bust: 0.014,
    blurb: 'An airline. They go bust more often than you would think.' },
  { id: 'granite', name: 'Granite Insurance', kind: 'stock', price: 55, drift: 0.055, vol: 0.15, beta: 0.7, bust: 0.001,
    blurb: 'Collects premiums, argues about claims.' },
  { id: 'tidewater', name: 'Tidewater Shipping', kind: 'stock', price: 30, drift: 0.05, vol: 0.32, beta: 1.1, bust: 0.006,
    blurb: 'Rises and falls with world trade.' },
  { id: 'meadow', name: 'Meadow Supermarkets', kind: 'stock', price: 20, drift: 0.045, vol: 0.13, beta: 0.5, bust: 0.001,
    blurb: 'People always need milk.' },
  { id: 'ironbridge', name: 'Ironbridge Construction', kind: 'stock', price: 35, drift: 0.055, vol: 0.27, beta: 1.2, bust: 0.006,
    blurb: 'Builds when times are good, waits when they are not.' },
  { id: 'kestrel', name: 'Kestrel Defense', kind: 'stock', price: 85, drift: 0.07, vol: 0.2, beta: 0.4, bust: 0.002,
    blurb: 'Does best in the years everyone else would rather forget.' },
  { id: 'fizzwick', name: 'Fizzwick Drinks', kind: 'stock', price: 45, drift: 0.06, vol: 0.12, beta: 0.5, bust: 0.0005,
    blurb: 'The same fizzy drink since your grandparents were young.' },
  { id: 'cinder', name: 'Cinder Games', kind: 'stock', price: 28, drift: 0.09, vol: 0.45, beta: 1.0, bust: 0.012,
    blurb: 'A games studio. Everything rides on the next release.' },
  { id: 'helix', name: 'Helix Biotech', kind: 'stock', price: 8, drift: 0.12, vol: 0.7, beta: 0.7, bust: 0.04,
    blurb: 'One drug, not yet approved. A lottery ticket with a laboratory.' },
  { id: 'marigold', name: 'Marigold Fashion', kind: 'stock', price: 38, drift: 0.06, vol: 0.3, beta: 1.0, bust: 0.007,
    blurb: 'In every wardrobe this year. Next year, who knows.' },
  { id: 'beacon', name: 'Beacon Telecom', kind: 'stock', price: 22, drift: 0.04, vol: 0.14, beta: 0.6, bust: 0.001,
    blurb: 'Phone masts and monthly bills.' },

  // ---------- Coins: anything can happen ----------
  { id: 'orbit', name: 'Orbit Coin', kind: 'crypto', price: 1000, drift: 0.15, vol: 0.6, beta: 0.5, bust: 0.012,
    blurb: 'The biggest digital coin. Wild swings.' },
  { id: 'aether', name: 'Aether', kind: 'crypto', price: 120, drift: 0.17, vol: 0.58, beta: 0.5, bust: 0.014,
    blurb: 'The second-biggest coin, and the one programmers like.' },
  { id: 'mooring', name: 'Mooring Dollar', kind: 'crypto', price: 1, drift: 0.0, vol: 0.004, beta: 0, bust: 0.006,
    blurb: 'Meant to be worth exactly one dollar, always. Usually is.' },
  { id: 'ember', name: 'Ember Token', kind: 'crypto', price: 2, drift: 0.2, vol: 0.8, beta: 0.4, bust: 0.03,
    blurb: 'A smaller coin with a passionate following.' },
  { id: 'lantern', name: 'Lantern', kind: 'crypto', price: 15, drift: 0.2, vol: 0.7, beta: 0.4, bust: 0.028,
    blurb: 'Promises to be faster than all the others. So do the others.' },
  { id: 'glacier', name: 'Glacier Privacy Coin', kind: 'crypto', price: 60, drift: 0.16, vol: 0.65, beta: 0.3, bust: 0.025,
    blurb: 'Nobody can see who holds it, which regulators dislike.' },
  { id: 'dogfish', name: 'Dogfish Coin', kind: 'crypto', price: 0.05, drift: 0.25, vol: 1.0, beta: 0.3, bust: 0.06,
    blurb: 'Started as a joke. Still is, mostly.' },
  { id: 'moonpug', name: 'Moonpug', kind: 'crypto', price: 0.0004, drift: 0.3, vol: 1.3, beta: 0.2, bust: 0.12,
    blurb: 'A cartoon dog in a space helmet. Up a thousandfold or gone by spring.' },
  { id: 'pixelapes', name: 'Pixel Ape Tokens', kind: 'crypto', price: 400, drift: 0.1, vol: 0.9, beta: 0.3, bust: 0.07,
    blurb: 'A picture of a monkey that you, and only you, own. In a sense.' },
];
/** How the market is grouped on screen. */
export const SECURITY_KINDS = [
  { id: 'fund', name: 'Funds', blurb: 'Baskets of many things. The steadiest choice.' },
  { id: 'stock', name: 'Shares', blurb: 'One company each. They swing, and some go under.' },
  { id: 'crypto', name: 'Coins', blurb: 'Digital coins. Fortunes made and lost in a year.' },
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

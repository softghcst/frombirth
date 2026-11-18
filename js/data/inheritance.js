// Estate and inheritance tax, country by country.
//
// Sources: PwC Worldwide Tax Summaries, "Individual - Other taxes" and the
// "Inheritance and gift tax rates" chart (pages last reviewed in 2026), and
// Wikipedia's "Inheritance tax" (rev 1381640707) and "Taxation in the
// Philippines" (rev 1382124373). scripts/verify-laws.py checks each country
// against the PwC chart. `src` says where an entry comes from:
//   pwc / wiki   the rates and tax-free amounts are stated there
//   partial      the source gives the range or the top rate; the bands in
//                between are the author's reading of the law, consistent with it
//   author       no source here covers it; the author's understanding
// Simplified: one scale per country (regional taxes use the region named in
// `note`), no reliefs for family homes, farms or businesses, no gifts made
// before death, and three kinds of heir: a spouse, a child (or grandchild)
// and anyone else. Nothing here is tax advice.
//
// kind 'estate': one tax on the whole estate before it is shared out.
//   free      untaxed amount (plus `perHeir` for each heir)
//   bands     [up to, rate]: `up to` counts the taxable amount above `free`
//   spouse    'exempt': what a spouse inherits is not taxed; a number: that much more is free when a spouse inherits
//   split     the bands apply to each heir's part of the taxable estate (Japan's method)
//   otherAdd  extra charged on the part going to someone who is not a spouse or child (Japan: a fifth more)
// kind 'heir': each heir pays on what they receive.
//   child / spouse / other: { free, bands } or 0 (not taxed)
// kind 'none': nothing is charged at death.
// `wage`: amounts are multiples of the game's typical wage, where the source gives no figure in money.

const B = (...pairs) => pairs.map(([upTo, r]) => [upTo ?? Infinity, r]);
const flat = (r, free = 0) => ({ free, bands: B([null, r]) });
const E = (free, bands, o = {}) => ({ kind: 'estate', free, bands, spouse: 'exempt', ...o });
const H = (child, spouse, other, o = {}) => ({ kind: 'heir', child, spouse, other, ...o });
const NONE = (o = {}) => ({ kind: 'none', src: 'pwc', ...o });

export const INHERITANCE = {
  // ---------- An estate tax, paid before the estate is shared ----------
  us: E(15000000, B([null, 0.4]), { src: 'pwc', note: 'Federal estate tax: USD 15 million exempt from 2026; a spouse who is a US citizen inherits free of it. A few states add their own.' }),
  uk: E(325000, B([null, 0.4]), { src: 'pwc', note: 'The nil-rate band; the extra band for a home left to children is not modelled. A spouse inherits free of tax.' }),
  dk: E(392300, B([null, 0.15]), { src: 'pwc', other: 0.3625, note: 'Children pay 15% above DKK 392,300 (2026); a spouse nothing; others 36.25% in all.' }),
  ph: E(5000000, B([null, 0.06]), { spouse: 0, src: 'wiki', note: 'A flat 6% on the net estate after a PHP 5 million standard deduction.' }),
  za: E(3500000, B([30000000, 0.2], [null, 0.25]), { src: 'pwc', note: 'Estate duty after a ZAR 3.5 million abatement; what passes to a spouse is deductible (not stated by the source).' }),
  tw: E(13330000, B([56210000, 0.1], [112420000, 0.15], [null, 0.2]), { spouse: 5530000, src: 'pwc', note: 'From 2025; the deductions for each child, parent and the funeral are not modelled.' }),
  kr: E(500000000, B([100000000, 0.1], [500000000, 0.2], [1000000000, 0.3], [3000000000, 0.4], [null, 0.5]), { spouse: 500000000, src: 'partial', note: 'The source gives 10% to 50%; the lump-sum deduction of KRW 500 million and a spouse deduction of at least as much.' }),
  jp: E(30000000, B([10000000, 0.1], [30000000, 0.15], [50000000, 0.2], [100000000, 0.3], [200000000, 0.4], [300000000, 0.45], [600000000, 0.5], [null, 0.55]),
    { perHeir: 6000000, split: true, otherAdd: 0.2, src: 'pwc', note: 'JPY 30 million plus 6 million per heir is free; the scale applies to each heir\'s part. A spouse\'s credit is treated as covering their part; heirs who are not family pay a fifth more.' }),
  jm: E(10000000, B([null, 0.015]), { spouse: 0, src: 'pwc', note: 'Not an inheritance tax: a 1.5% transfer tax on death on estates over JMD 10 million.' }),
  zw: E(0, B([null, 0.05]), { src: 'author', note: 'Estate duty; not covered by the sources here.' }),

  // ---------- Each heir pays on what they receive ----------
  de: H({ free: 400000, bands: B([75000, 0.07], [300000, 0.11], [600000, 0.15], [6000000, 0.19], [13000000, 0.23], [26000000, 0.27], [null, 0.3]) },
    { free: 500000, bands: B([75000, 0.07], [300000, 0.11], [600000, 0.15], [6000000, 0.19], [13000000, 0.23], [26000000, 0.27], [null, 0.3]) },
    { free: 20000, bands: B([6000000, 0.3], [null, 0.5]) }, { src: 'partial', note: 'The source gives 7% to 50% and allowances of EUR 20,000 to 500,000; the class I and III scales.' }),
  fr: H({ free: 100000, bands: B([8072, 0.05], [12109, 0.1], [15932, 0.15], [552324, 0.2], [902838, 0.3], [1805677, 0.4], [null, 0.45]) }, 0,
    { free: 1594, bands: B([null, 0.6]) }, { src: 'partial', note: 'The source gives EUR 100,000 free for a child and 45% above EUR 1.8 million; the bands between are the direct-line scale. Unrelated heirs pay 60%.' }),
  nl: H({ free: 26230, bands: B([152368, 0.1], [null, 0.2]) }, { free: 828035, bands: B([152368, 0.1], [null, 0.2]) },
    { free: 2658, bands: B([152368, 0.3], [null, 0.4]) }, { src: 'partial', note: 'The source gives 10% to 40%; the 2025 allowances and band.' }),
  be: H({ free: 15000, bands: B([50000, 0.03], [100000, 0.08], [175000, 0.09], [250000, 0.18], [500000, 0.24], [null, 0.3]) },
    { free: 15000, bands: B([50000, 0.03], [100000, 0.08], [175000, 0.09], [250000, 0.18], [500000, 0.24], [null, 0.3]) },
    { free: 0, bands: B([50000, 0.4], [75000, 0.55], [175000, 0.65], [null, 0.8]) }, { src: 'author', note: 'Set by each region; the Brussels-Capital scales. The source confirms only that rates vary by region, amount and relationship.' }),
  es: H({ free: 15956.87, bands: B([7993.46, 0.0765], [15980.91, 0.085], [23968.36, 0.0935], [31955.81, 0.102], [39943.26, 0.1105], [47930.72, 0.119], [55918.17, 0.1275], [63905.62, 0.136], [71893.07, 0.1445], [79880.52, 0.153], [119757.67, 0.1615], [159634.83, 0.187], [239389.13, 0.2125], [398777.54, 0.255], [797555.08, 0.2975], [null, 0.34]) },
    'child', { free: 0, bands: B([7993.46, 0.13], [15980.91, 0.1445], [23968.36, 0.159], [31955.81, 0.1734], [39943.26, 0.1879], [47930.72, 0.2023], [55918.17, 0.2168], [63905.62, 0.2312], [71893.07, 0.2457], [79880.52, 0.2601], [119757.67, 0.2746], [159634.83, 0.3179], [239389.13, 0.3613], [398777.54, 0.4335], [797555.08, 0.5058], [null, 0.578]) },
    { src: 'partial', note: 'The state scale, which applies where a region has set none; most regions give children and spouses large reductions not modelled here. Others pay the scale times 1.7.' }),
  it: H(flat(0.04, 1000000), 'child', flat(0.08), { src: 'pwc', note: 'EUR 1 million free for a spouse or child, then 4%; others 8% (siblings 6% above EUR 100,000, not modelled).' }),
  ie: H(flat(0.33, 400000), 0, flat(0.33, 20000), { src: 'partial', note: 'Group A threshold EUR 400,000 from October 2024 (Wikipedia gives 2022\'s EUR 335,000); group C EUR 20,000; a spouse is exempt.' }),
  fi: H({ free: 30000, bands: B([10000, 0.07], [30000, 0.1], [170000, 0.13], [970000, 0.16], [null, 0.19]) }, 'child',
    { free: 30000, bands: B([10000, 0.19], [30000, 0.25], [170000, 0.29], [null, 0.33]) }, { src: 'partial', note: 'The close-family scale is from the source; Wikipedia gives 19% to 33% for others, and the bands between are the author\'s. A spouse\'s extra deduction is not modelled.' }),
  gr: H({ free: 150000, bands: B([150000, 0.01], [450000, 0.05], [null, 0.1]) }, 'child',
    { free: 6000, bands: B([66000, 0.2], [261000, 0.3], [null, 0.4]) }, { src: 'pwc', note: 'Category A for a spouse and children, C for others.' }),
  ch: H(0, 0, flat(0.25), { src: 'partial', note: 'Cantonal: a spouse is exempt everywhere and children in most cantons; others pay a cantonal rate, taken here as 25%.' }),
  hu: H(0, 0, flat(0.18), { src: 'wiki', note: 'Close relatives are exempt; others 18% (9% on a home, not modelled).' }),
  pl: H(0, 0, { free: 5733, bands: B([11833, 0.12], [23665, 0.16], [null, 0.2]) }, { src: 'partial', note: 'Close family is exempt if the tax office is told in time; group III pays 12% to 20% (Wikipedia gives 3% to 20%).' }),
  pt: H(0, 0, flat(0.1), { src: 'wiki', note: 'Stamp duty of 10%; spouses, children, grandchildren, parents and grandparents are exempt.' }),
  hr: H(0, 0, flat(0.04), { src: 'partial', note: 'The source gives 4% with "certain exemptions"; first-line heirs (spouse, children, parents) are exempt.' }),
  rs: H(0, 0, flat(0.025), { src: 'wiki', note: 'First line (spouse, children, parents) 0%, second 1.5%, others 2.5%.' }),
  ua: H(0, 0, flat(0.05), { src: 'pwc', note: 'Taxed as income: close family 0%, others 5% (a military levy and the 18% for non-residents are not modelled).' }),
  tr: H({ free: 2606184, bands: B([2400000, 0.01], [5700000, 0.03], [12000000, 0.05], [24000000, 0.07], [null, 0.1]) }, 'child',
    { free: 61982, bands: B([2400000, 0.01], [5700000, 0.03], [12000000, 0.05], [24000000, 0.07], [null, 0.1]) }, { src: 'partial', note: 'The source gives 10% as the top rate on inheritance; the 2025 allowances and bands are the author\'s.' }),
  th: H({ free: 100000000, bands: B([null, 0.05]) }, 0, { free: 100000000, bands: B([null, 0.1]) }, { src: 'pwc', note: 'Only on what one heir receives above THB 100 million: 5% for descendants, 10% for others; a spouse is exempt.' }),
  br: H(flat(0.04), 'child', flat(0.04), { src: 'partial', note: 'A state tax capped at 8%; the São Paulo rate of 4%.' }),
  cl: H({ free: 41000000, bands: B([65600000, 0.01], [131200000, 0.025], [262400000, 0.05], [393600000, 0.075], [524800000, 0.1], [656000000, 0.15], [984000000, 0.2], [null, 0.25]) }, 'child',
    { free: 0, bands: B([65600000, 0.014], [131200000, 0.035], [262400000, 0.07], [393600000, 0.105], [524800000, 0.14], [656000000, 0.21], [984000000, 0.28], [null, 0.35]) },
    { src: 'partial', note: 'The source gives 25% at the top; the scale in UTA, converted at about CLP 820,000 to the UTA; unrelated heirs pay 40% more.' }),
  co: H(flat(0.15), 'child', flat(0.15), { src: 'pwc', note: 'An inheritance is an occasional gain of the heir, taxed at 15%; the exemptions for a home and small amounts are not modelled.' }),
  ec: H({ free: 75000, bands: B([75000, 0.025], [225000, 0.05], [425000, 0.075], [725000, 0.1], [1125000, 0.125], [null, 0.175]) }, 'child',
    { free: 75000, bands: B([75000, 0.05], [225000, 0.1], [425000, 0.15], [725000, 0.2], [1125000, 0.25], [null, 0.35]) },
    { src: 'author', note: 'The source gives 35% at the top; children pay half the scale. The bands are the author\'s.' }),
  do: H(flat(0.03), 'child', flat(0.03), { src: 'pwc', note: 'A flat 3%.' }),
  bo: H(flat(0.01), 'child', flat(0.2), { src: 'partial', note: 'The source gives 1, 10 and 20%: 1% for a spouse, children and parents, 10% for siblings, 20% for others.' }),
  ve: H({ free: 0, bands: B([3, 0.01], [10, 0.05], [30, 0.1], [null, 0.25]) }, 'child', { free: 0, bands: B([3, 0.1], [10, 0.25], [30, 0.4], [null, 0.55]) },
    { wage: true, src: 'author', note: 'The source says rates depend on kinship; amounts are in tax units that inflation has made meaningless, so these bands are in typical wages.' }),
  ni: H(flat(0.15), 'child', flat(0.15), { src: 'partial', note: 'The source gives one rate of 15%.' }),
  lb: H({ free: 2, bands: B([5, 0.03], [15, 0.06], [40, 0.09], [null, 0.12]) }, 'child', { free: 0, bands: B([5, 0.16], [15, 0.25], [40, 0.35], [null, 0.45]) },
    { wage: true, src: 'author', note: 'The source gives 45% at the top; children pay 3% to 12%. Amounts are in typical wages, since the pound\'s collapse has left the legal ones meaningless.' }),
  iq: H({ free: 20000000, bands: B([10000000, 0.03], [40000000, 0.04], [70000000, 0.05], [null, 0.06]) }, 'child', { free: 20000000, bands: B([10000000, 0.03], [40000000, 0.04], [70000000, 0.05], [null, 0.06]) },
    { src: 'pwc', note: 'The scale is taken to apply to each heir\'s share.' }),
  ao: H({ free: 0, bands: B([5000000, 0.005], [null, 0.01]) }, 'child', { free: 0, bands: B([5000000, 0.01], [null, 0.02]) }, { src: 'pwc', note: 'On movable property.' }),
  tn: H(flat(0.025), 'child', flat(0.35), { src: 'pwc', note: 'A registration fee of 2.5% between ancestors and descendants; up to 35% for others.' }),
  vn: H(flat(0.1, 10000000), 'child', flat(0.1, 10000000), { src: 'partial', note: 'Taxed as income at 10% above VND 10 million; homes passing within the close family are exempt (not modelled).' }),
  mc: H(0, 0, flat(0.16), { src: 'author', note: 'The direct line and a spouse pay nothing; others 8% to 16%.' }),

  // ---------- Nothing is charged at death ----------
  ca: NONE({ note: 'No inheritance tax; capital gains are taxed on the final return as if everything had been sold (not modelled).' }),
  au: NONE(), at: NONE(), se: NONE(), no: NONE(), nz: NONE(), ee: NONE(), cz: NONE(), sk: NONE(), ro: NONE(),
  cn: NONE(), in: NONE(), id: NONE(), my: NONE(), sg: NONE(), hk: NONE(), pk: NONE(), bd: NONE(), kz: NONE(), mn: NONE(),
  ae: NONE(), sa: NONE(), kw: NONE(), qa: NONE(), jo: NONE(), il: NONE(), eg: NONE(), ng: NONE(), et: NONE(), cd: NONE(), ug: NONE(), pg: NONE(),
  ge: NONE(), gy: NONE(), pa: NONE(), py: NONE(), uy: NONE(), cr: NONE(), sv: NONE(), bs: NONE(), pr: NONE({ note: 'No local tax; the US federal estate tax may apply to some residents (not modelled).' }),
  mx: NONE({ note: 'Inheritances are reported as income but generally exempt for residents.' }),
  ar: NONE({ note: 'No national tax; the province of Buenos Aires has its own (not modelled).' }),
  gh: NONE({ note: 'Not provided for in the tax laws.' }),
  ke: NONE({ src: 'wiki', note: 'Estate duty was abolished in 1982.' }),
  ru: NONE({ src: 'author' }), pe: NONE({ src: 'author' }), ma: NONE({ src: 'author', note: 'Registration duties on property are not modelled.' }),
  gt: NONE({ src: 'author' }), cu: NONE({ src: 'author' }), ht: NONE({ src: 'author' }), ad: NONE({ src: 'author' }), ws: NONE({ src: 'author' }),
  aw: NONE({ src: 'author' }), bz: NONE({ src: 'author' }), dj: NONE({ src: 'author' }), ir: NONE({ src: 'author' }), sy: NONE({ src: 'author' }),
  af: NONE({ src: 'author' }), np: NONE({ src: 'author' }), dz: NONE({ src: 'author' }),
};

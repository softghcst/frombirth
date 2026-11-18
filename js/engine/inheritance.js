// Estate and inheritance tax: what a country takes when someone dies, and
// from whom. The rules, and where each comes from, are in data/inheritance.js.
import { INHERITANCE } from '../data/inheritance.js';
import { typicalWage } from './systems.js';
import { fmtMoney } from '../util.js';

/** A country's rule; a country with none recorded charges nothing. */
export const lawOf = (id) => INHERITANCE[id] ?? { kind: 'none', src: 'author' };

/** How an heir counts for tax: a spouse, a child (grandchildren with them), or anyone else. */
export const relationOf = (role) => (['spouse'].includes(role) ? 'spouse' : ['child', 'grandchild', 'greatgrandchild'].includes(role) ? 'child' : 'other');

const money = (law, c, x) => (law.wage ? x * typicalWage(c) : x);

/** Tax on `taxable` (already above any free amount) through a scale of [up to, rate] bands. */
function onBands(taxable, bands, law, c) {
  let tax = 0;
  let from = 0;
  for (const [upTo, r] of bands) {
    const to = upTo === Infinity ? Infinity : money(law, c, upTo);
    const part = Math.min(taxable, to) - from;
    if (part > 0) tax += part * r;
    from = to;
    if (taxable <= to) break;
  }
  return tax;
}

/** The rule for one kind of heir under an inheritance tax: { free, bands }, or null when they pay nothing. */
function classOf(law, relation) {
  const k = law[relation] === 'child' ? law.child : law[relation];
  return k ? k : null;
}

/** What one heir pays on what they receive, under an inheritance tax. */
export function heirTax(amount, relation, c) {
  const law = lawOf(c.id);
  if (law.kind !== 'heir' || amount <= 0) return 0;
  const k = classOf(law, relation);
  if (!k) return 0;
  return onBands(amount - money(law, c, k.free), k.bands, law, c);
}

/**
 * The tax on an estate of `gross` (local money) in country `c`, shared among `heirs`:
 * [{ relation, share }], shares of the whole; what is not shared (charity) is not taxed.
 */
export function estateTax(gross, c, heirs) {
  const law = lawOf(c.id);
  if (gross <= 0 || !heirs.length || law.kind === 'none') return 0;
  if (law.kind === 'heir') return Math.round(heirs.reduce((s, h) => s + heirTax(gross * h.share, h.relation, c), 0));
  // An estate tax: on the estate as a whole, less what a spouse takes where that is exempt.
  const spouse = law.spouse === 'exempt' ? 0 : 1;
  const taxed = heirs.map((h) => ({ ...h, value: gross * h.share * (h.relation === 'spouse' ? spouse : 1) }));
  const value = taxed.reduce((s, h) => s + h.value, 0);
  const free = money(law, c, law.free + (law.perHeir ?? 0) * heirs.length + (typeof law.spouse === 'number' && heirs.some((h) => h.relation === 'spouse') ? law.spouse : 0));
  const taxable = Math.max(0, value - free);
  if (!taxable || !value) return 0;
  let tax = 0;
  if (law.split) {
    // The scale applies to each heir's part of what is taxable (Japan).
    for (const h of taxed) { const t = onBands(taxable * h.value / value, law.bands, law, c); tax += h.relation === 'other' ? t * (1 + (law.otherAdd ?? 0)) : t; }
  } else {
    tax = onBands(taxable, law.bands, law, c);
    const toOthers = taxed.filter((h) => h.relation === 'other').reduce((s, h) => s + h.value, 0) / value;
    if (law.other != null && toOthers) tax = tax * (1 - toOthers) + taxable * toOthers * law.other;
  }
  return Math.round(tax);
}

/** The rate a child pays at the top of the scale, for a short label. */
export function topRate(c, relation = 'child') {
  const law = lawOf(c.id);
  if (law.kind === 'none') return 0;
  if (law.kind === 'estate') return relation === 'other' && law.other != null ? law.other : law.bands.at(-1)[1] * (relation === 'other' ? 1 + (law.otherAdd ?? 0) : 1);
  const k = classOf(law, relation);
  return k ? k.bands.at(-1)[1] : 0;
}

const pct = (r) => `${Math.round(r * 1000) / 10}%`;
function scaleText(k, law, c) {
  if (!k) return 'nothing';
  const rates = k.bands.map(([, r]) => r);
  const lo = Math.min(...rates), hi = Math.max(...rates);
  const free = money(law, c, k.free);
  return `${lo === hi ? pct(hi) : `${pct(lo)} to ${pct(hi)}`}${free > 0 ? ` above ${fmtMoney(Math.round(free), c)}` : ''}`;
}

/** One line on how a country taxes what is left at death. */
export function inheritanceLine(c) {
  const law = lawOf(c.id);
  if (law.kind === 'none') return 'None';
  if (law.kind === 'estate') {
    const free = money(law, c, law.free);
    const rates = law.bands.map(([, r]) => r);
    const lo = Math.min(...rates), hi = Math.max(...rates);
    return `Estate tax of ${lo === hi ? pct(hi) : `${pct(lo)} to ${pct(hi)}`}${free > 0 ? ` above ${fmtMoney(Math.round(free), c)}${law.perHeir ? ` plus ${fmtMoney(money(law, c, law.perHeir), c)} for each heir` : ''}` : ''}${law.spouse === 'exempt' ? '; a spouse inherits free of it' : ''}`;
  }
  const spouse = law.spouse === 'child' ? 'the same as a child' : scaleText(classOf(law, 'spouse'), law, c);
  return `A child pays ${scaleText(classOf(law, 'child'), law, c)}; a spouse ${spouse}; anyone else ${scaleText(classOf(law, 'other'), law, c)}`;
}

/** A few words for a list: what a child pays at most, and what others pay. */
export function inheritanceShort(c) {
  const law = lawOf(c.id);
  if (law.kind === 'none') return 'none';
  const child = topRate(c, 'child'), other = topRate(c, 'other');
  if (law.kind === 'estate') return `${pct(child)} on large estates`;
  return child === other ? `up to ${pct(child)}` : `${child ? `up to ${pct(child)}` : 'none'} for a child, up to ${pct(other)} for others`;
}

/** Where an entry comes from, for the world-data screen. */
export const inheritanceSource = (id) => ({ pwc: 'PwC tax summaries', wiki: 'Wikipedia', partial: 'partly sourced', author: 'unsourced' }[lawOf(id).src] ?? 'unsourced');

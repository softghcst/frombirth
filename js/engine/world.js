// The Living World engine's reading side: one place to ask "what is this
// place, and what is life like there?" Every screen and system that needs to
// describe a place asks here, so the answer is the same everywhere.
//
// A profile keeps three kinds of statement apart:
//   reference   real-world facts about the place (data/world.js)
//   game        how the game models living there (data/countries.js, living.js): estimates, not statistics
//   yourWorld   what has happened there in this save (the political world, engine/polity.js): fiction
import { SOURCES } from '../data/worldVerification.js';
const SOURCE_LINE = `ISO 3166-1, ISO 4217 and the Unicode CLDR, the IANA time-zone database (${SOURCES.tzdata}) and GeoNames`;
const CHECK_NAME = { codes: 'ISO codes', name: 'Name', currency: 'Currency', timeZone: 'Time zone', capital: 'Capital', unRegion: 'UN region', languages: 'Official languages', cities: 'Cities', regions: 'Regions of cities' };
const CHECK_WORD = { ok: 'Confirmed', review: 'Differs on purpose', unconfirmed: 'Not confirmed', mismatch: 'Disagrees with the source' };
import { healthLine, taxLine } from './systems.js';
import { outlook } from './economy.js';
import { cityLine } from './cities.js';
import { sheet, reforms } from './rules.js';
import { store } from '../state.js';
import { COUNTRIES, COUNTRY_LIST, propertyTaxLabel } from '../data/countries.js';
import { PLACES, GROUPS, placesIn } from '../data/world.js';
import { SYSTEMS } from '../data/politics.js';
import { MONARCHIES } from '../data/royalty.js';
import { HAZARDS, CRISES } from '../data/living.js';
import { schoolModel } from '../data/education.js';
import { SPOKEN } from '../data/skills.js';

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Other names people search by. */
const ALIASES = { us: 'usa america united states of america', uk: 'britain great britain england scotland wales', cz: 'czechia', cd: 'drc congo kinshasa dr congo', ae: 'uae emirates dubai',
  kr: 'korea', nl: 'holland', tr: 'türkiye turkiye', tw: 'republic of china', hk: 'hong kong sar', ru: 'russian federation', sy: 'syrian arab republic', ir: 'persia', pr: 'porto rico' };

/** Every place, for browsing: [{ group, places: [country records] }]. */
export const browse = () => GROUPS.map((group) => ({ group, places: placesIn(group).map((id) => COUNTRIES[id]).filter(Boolean) }));

/** Places matching what was typed: by name, alias, city, capital, language, currency or code. Accents are ignored. */
export function search(text) {
  const q = fold(text.trim());
  if (!q) return COUNTRY_LIST;
  return COUNTRY_LIST.filter((c) => {
    const p = PLACES[c.id];
    return [c.name, ALIASES[c.id] ?? '', ...c.cities, p.capital, ...p.languages, c.currency.code, p.iso2, p.iso3].some((s) => fold(s).includes(q));
  });
}

const level = (v, words) => words[v >= 80 ? 0 : v >= 60 ? 1 : v >= 40 ? 2 : v >= 20 ? 3 : 4];
const times = (k) => (k >= 0.95 && k <= 1.05 ? 'about the same as' : k > 1 ? `${k.toFixed(1)} times` : `${Math.round(k * 100)}% of`);

/**
 * Everything worth knowing about a place.
 * @returns {{id, name, flag, typeLabel, status, reference:[string,string][], game:[string,string][], school:[string,string][],
 *            politics:[string,string][], laws:[string,string][], cities:string[], yourWorld:?{lines:[string,string][], news:string[]}, notes:string[]}}
 */
export function profile(id) {
  const c = COUNTRIES[id];
  const p = PLACES[id];
  if (!c || !p) return null;
  const L = c.living;
  const parent = p.parentId ? COUNTRIES[p.parentId] : null;
  const reference = [
    ['Kind of place', p.typeLabel],
    ...(parent ? [['Tied to', `${parent.flag} ${parent.name}`]] : []),
    ['Capital', p.capital],
    ['Languages', p.languages.join(', ')],
    ['Currency', `${c.currency.code} (${c.currency.symbol})`],
    ['Government', p.government],
    ['Region', p.unRegion === p.group ? p.group : `${p.unRegion} (listed under ${p.group})`],
    ['Time zone', p.timeZone.replace(/_/g, ' ')],
  ];
  const game = [
    ['Typical pay', `${times(L.wage)} pay in the United States`],
    ['Local prices', `${times(L.cost)} prices in the United States`],
    ['Income tax', `${Math.round(c.incomeTax * 100)}%`],
    ['Inheritance tax', c.estateTax ? `${Math.round(c.estateTax * 100)}%` : 'none'],
    ['Property tax', propertyTaxLabel(c)],
    ['Health care', healthLine(c)],
    ['How income is taxed', taxLine(c)],
    ['University', c.freeUniversity ? 'Free at public universities' : 'Tuition is charged'],
    ['Safety', level(L.safety, ['Very safe', 'Safe', 'Mixed', 'Dangerous in places', 'Dangerous'])],
    ['Standard of care', level(L.health, ['Excellent', 'Good', 'Uneven', 'Poor', 'Very poor'])],
    ['Power, water, roads', level(L.infra, ['Reliable', 'Mostly reliable', 'Patchy', 'Unreliable', 'Failing'])],
    ['Stability', level(L.stability, ['Very stable', 'Stable', 'Tense', 'Unstable', 'In turmoil'])],
    ['Prices over time', { low: 'Steady', high: 'Rising fast', extreme: 'Out of control' }[L.inflation]],
    ...(L.hazards.length ? [['Natural hazards', L.hazards.map((h) => HAZARDS[h].name ?? h).join(', ')]] : []),
    ...(L.crisis ? [['Ongoing', CRISES[L.crisis].name]] : []),
    ...(store.state ? [['Economy now', outlook(id).name]] : []),
  ];
  const m = schoolModel(id);
  const school = [
    ...m.stages.map((s) => [s.name, `from age ${s.start}`]),
    ['Leaves school with', m.leaving],
  ];
  const sys = SYSTEMS[id] ?? { kind: 'none' };
  const crown = MONARCHIES[id];
  const politics = [
    ['Who governs', { presidential: 'An elected president', parliamentary: 'A parliament, and the leader it chooses', party: 'One ruling party', none: 'No national elections' }[sys.kind]],
    ...(sys.head ? [['Head of government', sys.head]] : []),
    ...(sys.seat ? [['National legislator', sys.seat]] : []),
    ...(sys.region ? [['Regional leader', sys.region]] : []),
    ...(sys.rigged ? [['Elections', 'Held, but the count leans toward those in power']] : []),
    ...(sys.nativeOnly ? [['Top office', 'Open only to people born here']] : []),
    ...(crown ? [['Crown', `A ${crown.type} monarchy you can be born into or marry into`]] : []),
  ];
  const laws = sheet(id, { region: null }).map((r) => [r.name, r.note ? `${r.text} (${r.note})` : r.text]);
  const spoken = Object.entries(SPOKEN).filter(([, ids]) => ids.includes(id)).map(([k]) => k);
  // What has happened here in this save, if anything has: never invents a government just because the page was opened.
  let yourWorld = null;
  const w = store.state?.polities?.[id];
  if (w) {
    const head = w.figures?.[w.govt?.headId] ?? null;
    const lead = w.parties?.find((x) => x.id === w.govt?.lead);
    yourWorld = {
      lines: [
        ...(head ? [[SYSTEMS[id]?.head ?? 'Head of government', head.isPlayer ? 'You' : head.name]] : []),
        ...(lead ? [['Governing party', lead.name]] : []),
        ...(w.calendar?.general ? [['Next general election', String(w.calendar.general)]] : []),
        ...(w.approval != null ? [['Approval of the government', `${Math.round(w.approval)}%`]] : []),
      ],
      news: [...(w.laws ?? [])].slice(-4).reverse().map((l) => `${l.year}: ${l.text}`),
    };
  }
  const dyn = store.state?.dynasties?.[id];
  if (dyn && yourWorld) yourWorld.lines.push(['Royal house', `${dyn.name}${dyn.status === 'abolished' ? ' (the monarchy was abolished)' : ''}`]);
  return { id, name: c.name, flag: c.flag, typeLabel: p.typeLabel, status: p.status, reference, game, school, politics, cityLines: c.cities.map((n) => [n, cityLine(id, n)]), laws, lawChanges: store.state ? reforms(id).slice(0, 5).map((e) => `${e.year}: ${e.text}`) : [], cities: c.cities, capital: p.capital, spoken, yourWorld,
    checks: Object.entries(p.checked ?? {}).sort(([a], [b]) => Object.keys(CHECK_NAME).indexOf(a) - Object.keys(CHECK_NAME).indexOf(b)).filter(([, v]) => v.status !== 'unchecked').map(([k, v]) => [CHECK_NAME[k] ?? k, CHECK_WORD[v.status] + (v.status === 'ok' || !v.note ? '' : `: ${v.note}`)]),
    notes: [p.verification === 'verified' ? `Reference facts were checked against ${SOURCE_LINE}. ${p.status ? 'Form of government and status are' : 'Form of government is'} written by hand.`
      : p.verification === 'partly verified' ? `Most reference facts were checked against ${SOURCE_LINE}; anything marked "not confirmed" was not. ${p.status ? 'Form of government and status are' : 'Form of government is'} written by hand.`
        : 'Reference facts were compiled by hand and have not been checked against official sources.',
      'Pay, prices, taxes, scores and the laws listed are simplified for play. They are not statistics or legal information.'] };
}

/** Two places side by side on the things that differ most. No ranking: what suits one life does not suit another. */
export function compare(a, b) {
  const pa = profile(a);
  const pb = profile(b);
  const pick = (list, label) => list.find(([k]) => k === label)?.[1] ?? '—';
  const rows = ['Typical pay', 'Local prices', 'Income tax', 'Health care', 'University', 'Safety', 'Stability'].map((k) => [k, pick(pa.game, k), pick(pb.game, k)]);
  rows.unshift(['Currency', pick(pa.reference, 'Currency'), pick(pb.reference, 'Currency')], ['Languages', pick(pa.reference, 'Languages'), pick(pb.reference, 'Languages')]);
  return { a: pa, b: pb, rows };
}

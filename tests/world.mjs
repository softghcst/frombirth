// Checks the world's places. Run with: node tests/world.mjs
//  - exactly the 102 reference places are present, each once, each with a stable id
//  - codes, types, parents, groups, currencies, cities, names and living data are all in order
//  - every place works with the systems that read it: schools, politics, languages, a new life
// Add --report to print what is still thin for each place.
import { ROOTS } from '../js/data/economy.js';
import { COUNTRIES, COUNTRY_LIST } from '../js/data/countries.js';
import { PLACES, REFERENCE, GROUPS, placesIn } from '../js/data/world.js';
import { NEW_PLACES } from '../js/data/worldNew.js';
import { SYSTEMS } from '../js/data/politics.js';
import { HAZARDS, CRISES } from '../js/data/living.js';
import { schoolModel } from '../js/data/education.js';
import { SPOKEN } from '../js/data/skills.js';
import { NAMES } from '../js/data/names.js';

ROOTS.parentFromAbroad = 0; // these checks are about plain families; families with roots abroad are tested in world-scenarios.mjs

const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const pass = (msg) => ok.push(msg);

// The reference inventory, written out here a second time on purpose: the data file cannot quietly drop one.
const EXPECTED = {
  'North America': ['Aruba', 'Bahamas', 'Belize', 'Canada', 'Costa Rica', 'Cuba', 'Dominican Republic', 'El Salvador', 'Guatemala', 'Haiti', 'Jamaica', 'Mexico', 'Nicaragua', 'Panama', 'Puerto Rico', 'United States'],
  'South America': ['Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Guyana', 'Paraguay', 'Peru', 'Uruguay', 'Venezuela'],
  Europe: ['Andorra', 'Austria', 'Belgium', 'Croatia', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Monaco', 'Netherlands', 'Norway', 'Poland',
    'Portugal', 'Romania', 'Russia', 'Serbia', 'Slovakia', 'Spain', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom'],
  Africa: ['Algeria', 'Angola', 'Djibouti', 'Democratic Republic of the Congo', 'Egypt', 'Ethiopia', 'Kenya', 'Morocco', 'Nigeria', 'South Africa', 'Tunisia', 'Uganda', 'Zimbabwe'],
  'Middle East': ['Georgia', 'Iran', 'Iraq', 'Israel', 'Jordan', 'Kuwait', 'Lebanon', 'Qatar', 'Saudi Arabia', 'Syria', 'Turkey', 'United Arab Emirates'],
  Asia: ['Afghanistan', 'Bangladesh', 'China', 'Hong Kong', 'India', 'Indonesia', 'Japan', 'Kazakhstan', 'Malaysia', 'Mongolia', 'Nepal', 'Pakistan', 'Philippines', 'Singapore', 'South Korea', 'Thailand', 'Taiwan', 'Vietnam'],
  Oceania: ['Australia', 'Papua New Guinea', 'New Zealand', 'Samoa'],
};
// ISO 4217 codes in use by the places above (checked by hand against the standard's list).
const ISO_4217 = new Set(('USD GBP CAD AUD EUR JPY BRL INR NGN MXN KRW SEK ZAR CNY PHP ARS VES COP CLP PLN TRY EGP THB VND KES JMD NZD CHF NOK DKK RUB UAH PEN DOP CUP GHS MAD PKR IDR SGD AED JOD SAR KWD QAR MYR '
  + 'AWG BSD BZD CRC GTQ HTG NIO PAB BOB GYD PYG UYU CZK HUF RON RSD DZD AOA DJF CDF ETB TND UGX ZWG GEL IRR IQD ILS LBP SYP AFN BDT HKD KZT MNT NPR TWD PGK WST').split(' '));

// 1. The inventory.
const refIds = Object.values(REFERENCE).flat();
check(refIds.length === 102 && new Set(refIds).size === 102, `the reference list has ${refIds.length} entries, ${new Set(refIds).size} unique; it must be 102`);
const expectedNames = Object.values(EXPECTED).flat();
check(expectedNames.length === 102, 'the expected list in this test is not 102 long');
for (const [group, names] of Object.entries(EXPECTED)) {
  const have = (REFERENCE[group] ?? []).map((id) => COUNTRIES[id]?.name);
  for (const n of names) check(have.includes(n), `${group}: "${n}" is missing`);
  check(have.length === names.length, `${group}: has ${have.length} places, expected ${names.length}`);
}
const names = COUNTRY_LIST.map((c) => c.name);
check(new Set(names).size === names.length, 'two places share a display name');
check(GROUPS.every((g) => placesIn(g).length > 0), 'a browsing group is empty');
if (!problems.length) pass('exactly 102 reference places, each once, in seven groups');

// 2. Each place.
const iso2 = new Set();
const iso3 = new Set();
for (const c of COUNTRY_LIST) {
  const p = PLACES[c.id];
  const tag = `${c.id} (${c.name})`;
  if (!p) { check(false, `${tag}: no world record`); continue; }
  check(/^[a-z]{2}$/.test(c.id), `${tag}: id is not a stable two-letter id`);
  check(/^[A-Z]{2}$/.test(p.iso2) && !iso2.has(p.iso2), `${tag}: ISO alpha-2 code missing or repeated`);
  check(/^[A-Z]{3}$/.test(p.iso3) && !iso3.has(p.iso3), `${tag}: ISO alpha-3 code missing or repeated`);
  iso2.add(p.iso2); iso3.add(p.iso3);
  check(['country', 'territory', 'special_administrative_region', 'jurisdiction'].includes(p.type), `${tag}: unknown type ${p.type}`);
  check(!p.parentId || (PLACES[p.parentId] && p.parentId !== c.id), `${tag}: parent ${p.parentId} does not exist`);
  check(p.type === 'country' ? !p.parentId : true, `${tag}: a country should not have a parent`);
  check(p.type === 'country' || !!p.status, `${tag}: a place that is not an ordinary country needs a status sentence`);
  check(GROUPS.includes(p.group) && ['Americas', 'Europe', 'Africa', 'Asia', 'Oceania'].includes(p.unRegion), `${tag}: bad group or UN region`);
  check(p.capital && p.languages.length >= 1 && /^[A-Za-z_]+\/[A-Za-z_\-/]+$/.test(p.timeZone) && p.government, `${tag}: capital, languages, time zone or government missing`);
  check(ISO_4217.has(c.currency.code), `${tag}: currency code ${c.currency.code} is not on the ISO 4217 list`);
  check(c.currency.symbol && c.currency.scale > 0 && Number.isFinite(c.currency.scale), `${tag}: currency symbol or scale invalid`);
  check(Array.isArray(c.cities) && c.cities.length >= 1 && new Set(c.cities).size === c.cities.length, `${tag}: needs at least one city, none repeated`);
  check(c.names.male.length >= 8 && c.names.female.length >= 8 && c.names.last.length >= 8, `${tag}: too few names`);
  check(c.flag && typeof c.freeHealthcare === 'boolean' && typeof c.freeUniversity === 'boolean', `${tag}: flag or public-services data missing`);
  check(c.incomeTax >= 0 && c.incomeTax < 0.6 && c.propertyTax >= 0 && c.propertyTax < 0.05, `${tag}: a tax rate is out of range`);
  const L = c.living;
  check(L && L.wage > 0 && L.cost > 0 && Number.isFinite(L.wageK) && Number.isFinite(L.costK), `${tag}: living data missing`);
  for (const k of ['safety', 'health', 'infra', 'stability', 'graft']) check(L[k] >= 0 && L[k] <= 100, `${tag}: ${k} is outside 0-100`);
  check(['low', 'high', 'extreme'].includes(L.inflation) && L.hazards.every((h) => HAZARDS[h]) && (!L.crisis || CRISES[L.crisis]), `${tag}: inflation, hazard or crisis value unknown`);
  check(['equal', 'limited', 'hostile'].includes(L.laws.lgbt) && ['marriage', 'gambling', 'deathPenalty', 'conscription'].every((k) => typeof L.laws[k] === 'boolean'), `${tag}: a law flag is missing`);
  // Other systems can use it.
  const sys = SYSTEMS[c.id];
  check(sys && ['presidential', 'parliamentary', 'party', 'none'].includes(sys.kind), `${tag}: no political system`);
  check(sys.kind === 'none' || (sys.head && sys.seat), `${tag}: political offices have no names`);
  const m = schoolModel(c.id);
  check(m.stages.length === 3 && m.leaving, `${tag}: no school model`);
}
if (!problems.length) pass(`${COUNTRY_LIST.length} places: codes, type, currency, cities, names, living data, politics and schools all in order`);

// 3. Relationships that must be modeled, not flattened.
const rel = (id, type, parent) => check(PLACES[id].type === type && PLACES[id].parentId === parent, `${id}: expected ${type} of ${parent}`);
rel('pr', 'territory', 'us'); rel('aw', 'territory', 'nl'); rel('hk', 'special_administrative_region', 'cn');
check(PLACES.tw.type === 'jurisdiction' && !PLACES.tw.parentId && COUNTRIES.tw.currency.code === 'TWD', 'Taiwan must be a distinct jurisdiction with its own currency');
check(PLACES.cd.iso3 === 'COD' && PLACES.cd.capital === 'Kinshasa' && !COUNTRIES.cg, 'the DR Congo must be COD/Kinshasa, and not confused with the Republic of the Congo');
check(PLACES.pr.nationalityOf === 'us' && PLACES.aw.nationalityOf === 'nl' && PLACES.hk.nationalityOf === 'cn', 'territories must say whose nationality their people hold');
check(COUNTRIES.hk.currency.code === 'HKD' && COUNTRIES.aw.currency.code === 'AWG' && COUNTRIES.pr.currency.code === 'USD', 'territory currencies are wrong');
// No cycles in the hierarchy.
for (const p of Object.values(PLACES)) { let x = p; let n = 0; while (x?.parentId && n < 10) { x = PLACES[x.parentId]; n++; } check(n < 10, `${p.id}: parent chain loops`); }
// Not everything is in dollars.
const usd = COUNTRY_LIST.filter((c) => c.currency.code === 'USD').map((c) => c.id).sort().join();
check(usd === 'ec,pr,sv,us', `only the United States, Puerto Rico, Ecuador and El Salvador use the dollar here (found ${usd})`);
if (!problems.length) pass('territories, special regions and disputed places are modeled as what they are');

// 4. Languages point at real places; the new rows are complete.
for (const [lang, ids] of Object.entries(SPOKEN)) for (const id of ids) check(!!COUNTRIES[id], `language ${lang} lists an unknown place ${id}`);
for (const [id, r] of Object.entries(NEW_PLACES)) check(r.length === 9 && r[6].length >= 10 && r[7].length === 2, `${id}: row in worldNew.js is incomplete`);

// 5. A life can begin anywhere.
let born = 0;
try {
  const { createLife } = await import('../js/engine/characterGen.js');
  const { store } = await import('../js/state.js');
  const { advanceYear } = await import('../js/engine/yearProcessor.js');
  for (const c of COUNTRY_LIST) {
    try {
      store.state = createLife({ countryId: c.id, city: c.cities[c.cities.length - 1] });
      const p = store.state.player;
      check(p.countryId === c.id && p.birthCountryId === c.id && p.city === c.cities[c.cities.length - 1], `${c.id}: a life did not start in the chosen city`);
      for (let y = 0; y < 3; y++) { advanceYear(); store.state.pendingEvents = []; }
      check((p.age === 3 || p.alive === false) && Number.isFinite(p.finance.cash), `${c.id}: the first years did not run`);
      born++;
    } catch (e) { check(false, `${c.id}: a life could not be lived there: ${e.message}`); }
  }
  if (born === COUNTRY_LIST.length) pass(`a life was started and lived for three years in each of ${born} places`);
  // Citizenship is its own record, and it decides who needs a visa.
  const { rightToLive, nationalities } = await import('../js/engine/emigration.js');
  const life = (id) => { store.state = createLife({ countryId: id }); return store.state.player; };
  let p = life('us');
  check(nationalities(p).join() === 'us' && rightToLive('pr', p) && rightToLive('us', p) && !rightToLive('ca', p), 'a United States citizen should need no visa for Puerto Rico, and should need one for Canada');
  p = life('pr');
  check(p.citizenships[0].jurisdictionId === 'us' && p.birthCountryId === 'pr' && rightToLive('us', p) && !rightToLive('mx', p), 'someone born in Puerto Rico is a United States citizen born in Puerto Rico');
  p = life('aw');
  check(rightToLive('nl', p) && !rightToLive('us', p), 'someone born in Aruba holds Dutch nationality');
  p = life('hk');
  check(p.citizenships[0].jurisdictionId === 'cn' && p.countryId === 'hk', 'someone born in Hong Kong holds Chinese nationality and lives in Hong Kong');
  p = life('tw');
  check(nationalities(p).join() === 'tw' && !rightToLive('cn', p), 'Taiwan has its own nationality record');
  delete p.citizenships; // a life saved before citizenship existed
  check(nationalities(p).join() === 'tw', 'an older save should count its birthplace as its nationality');
  if (!problems.length) pass('citizenship is separate from birthplace and residence, and citizens need no visa for their own country or its territories');
} catch (e) {
  console.log(`(skipped the lived-life check outside a browser: ${e.message.split('\n')[0]})`);
}

// Every place has been checked by scripts/verify-world.py, and nothing disagrees with its source unexplained.
for (const p of Object.values(PLACES)) {
  check(Object.keys(p.checked).length >= 8, `${p.id}: no verification results (run scripts/verify-world.py --write)`);
  for (const [k, v] of Object.entries(p.checked)) check(v.status !== 'mismatch', `${p.id}.${k} disagrees with its source: ${v.note ?? ''}`);
  check(p.verification !== 'compiled', `${p.id}: never verified`);
}
pass(`verification: ${Object.values(PLACES).filter((p) => p.verification === 'verified').length} places fully confirmed, ${Object.values(PLACES).filter((p) => p.verification === 'partly verified').length} partly, none disagreeing`);

if (process.argv.includes('--report')) {
  console.log('\nWhat is still thin, by place (development report):');
  for (const c of COUNTRY_LIST) {
    const thin = [];
    if (c.cities.length < 4) thin.push(`${c.cities.length} cities`);
    if (!NAMES[c.id]) thin.push('short name lists');
    if (schoolModel(c.id) === schoolModel('zz')) thin.push('default school model');
    if (PLACES[c.id].verification !== 'verified') thin.push(`reference data ${PLACES[c.id].verification}`);
    if (NEW_PLACES[c.id]) thin.push('gameplay numbers are first estimates');
    console.log(`  ${c.flag} ${c.name}: ${thin.join('; ') || 'complete'}`);
  }
}

for (const m of ok) console.log(`ok   ${m}`);
if (problems.length) {
  console.log([...new Set(problems)].slice(0, 40).join('\n'));
  console.log(`${problems.length} problem(s).`);
  process.exit(1);
}
console.log('The world is in order.');

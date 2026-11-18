// One place to ask what the law is.
//
// Every legal question the game asks (how old to vote, drive, drink or
// gamble; whether two men can marry; whether a murderer can be executed)
// goes through rule(). The answer is built in layers: a default, the state
// a territory belongs to, the place itself, a region inside it, and
// finally anything changed during this life. See data/rules.js.
//
// The world also changes its own laws, slowly (tickRules), so a long life
// does not end under the laws it began with.
import { pastLaw, historyHolds, worldYear } from './history.js';
import { rng } from '../rng.js';
import { theCountry } from '../util.js';
import { store, player } from '../state.js';
import { post } from './economy.js';
import { COUNTRIES, COUNTRY_LIST } from '../data/countries.js';
import { LIVING } from '../data/living.js';
import { regionOf } from '../data/cities.js';

/** The region whose law applies in a city: a recorded state or province, or else the area around the city itself. */
export const lawRegion = (placeId, city) => (city ? regionOf(placeId, city) ?? `around:${city}` : null);
import { RULES, PLACE_RULES, REGION_RULES, REFORM, REGIONAL_RULES, REGIONAL_COUNTRIES } from '../data/rules.js';

const here = () => player().countryId;
const parentOf = (placeId) => COUNTRIES[placeId]?.place?.parentId ?? null;
const book = () => (store.state ? (store.state.rules ??= {}) : {});

/**
 * Where a rule's value comes from.
 * @param {string} id       a key of RULES
 * @param {string} [placeId]
 * @param {{region?:string}} [opts]
 * @returns {{value:any, source:'default'|'parent'|'place'|'region'|'enacted', year?:number, by?:string}}
 */
export function source(id, placeId = here(), opts = {}) {
  const def = RULES[id];
  if (!def) throw new Error(`Unknown rule: ${id}`);
  const now = modernSource(id, placeId, opts, def);
  // A law made during this life stands. Otherwise, before a law changed, the old law applies (Historical Eras, data/history.js).
  if (now.source === 'enacted' || now.source === 'enacted region') return now;
  const past = pastLaw(id, placeId, worldYear(), now.value);
  return past ? { value: past.value, source: past.note } : now;
}

/** Today's law, through its layers (laws made in this life, region, place, parent state, default). */
function modernSource(id, placeId, opts, def) {
  const me = store.state?.player;
  const region = opts.region !== undefined ? opts.region : placeId === me?.countryId ? me.regionId ?? lawRegion(placeId, me.city) : null;
  // Law made during this life: national, or by the region. Whichever was made more recently stands.
  const enacted = book()[placeId]?.[id];
  const regional = region ? book().regions?.[`${placeId}/${region}`]?.[id] : null;
  if (regional && (!enacted || regional.year >= enacted.year)) return { value: regional.value, source: 'enacted region', year: regional.year, by: regional.by };
  if (enacted) return { value: enacted.value, source: 'enacted', year: enacted.year, by: enacted.by };
  const local = region ? REGION_RULES[`${placeId}/${region}`]?.[id] : undefined;
  if (local !== undefined) return { value: local, source: 'region' };
  if (PLACE_RULES[placeId]?.[id] !== undefined) return { value: PLACE_RULES[placeId][id], source: 'place' };
  if (def.from && LIVING[placeId]) return { value: LIVING[placeId].laws[def.from], source: 'place' };
  if (def.derive && COUNTRIES[placeId]) return { value: def.derive(placeId), source: 'place' };
  const up = parentOf(placeId);
  if (up && PLACE_RULES[up]?.[id] !== undefined) return { value: PLACE_RULES[up][id], source: 'parent' };
  return { value: def.default, source: 'default' };
}

/** What the law says. */
export const rule = (id, placeId, opts) => source(id, placeId, opts).value;

/** The five flags older code knows, in their old shape. */
export const lawsOf = (placeId = here()) => ({ marriage: rule('sameSexMarriage', placeId), lgbt: rule('lgbt', placeId), gambling: rule('gambling', placeId),
  deathPenalty: rule('deathPenalty', placeId), conscription: rule('conscription', placeId) });

const WORDS = (def, v) => (def.kind === 'age' ? String(v) : def.kind === 'flag' ? def.words[v ? 1 : 0] : def.words[v]);

/**
 * Whether the player may do something where they live, and if not, why.
 * @param {'vote'|'drive'|'drink'|'gamble'|'marry'|'leaveSchool'|'divorce'} action
 * @param {{person?:object, partner?:object}} [opts]
 * @returns {{ok:boolean, why:string}}
 */
export function may(action, opts = {}) {
  const p = opts.person ?? player();
  const id = p.countryId ?? here();
  const name = theCountry(COUNTRIES[id].name);
  const no = (why) => ({ ok: false, why });
  const age = (ruleId, what) => (p.age < rule(ruleId, id) ? no(`You have to be ${rule(ruleId, id)} to ${what} in ${name}.`) : null);
  switch (action) {
    case 'vote': return age('votingAge', 'vote') ?? ((p.flags?.trueGender ?? p.gender) === 'female' && !rule('womenVote', id) ? no(`Women cannot vote in ${name} yet.`) : { ok: true, why: '' });
    case 'drive': return age('drivingAge', 'drive') ?? { ok: true, why: '' };
    case 'drink': return !rule('alcohol', id) ? no(`Alcohol is banned in ${name}.`) : age('drinkingAge', 'drink') ?? { ok: true, why: '' };
    case 'gamble': return !rule('gambling', id) ? no(`Gambling is against the law in ${name}.`) : age('gamblingAge', 'gamble') ?? { ok: true, why: '' };
    case 'leaveSchool': return age('schoolLeavingAge', 'leave school') ?? { ok: true, why: '' };
    case 'divorce': return rule('divorce', id) ? { ok: true, why: '' } : no(`There is no divorce in ${name}. A marriage can only be annulled, and that is slow and rare.`);
    case 'marry': {
      const o = opts.partner;
      if (age('marriageAge', 'marry')) return age('marriageAge', 'marry');
      if (o && o.gender === p.gender && !rule('sameSexMarriage', id)) return no(`Two ${p.gender === 'male' ? 'men' : p.gender === 'female' ? 'women' : 'people of the same gender'} cannot marry in ${name}.`);
      return { ok: true, why: '' };
    }
    default: throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Every rule for a place, for showing.
 * @returns {{id, name, value, text:string, source:string, note:string}[]}
 */
export function sheet(placeId = here(), opts = {}) {
  return Object.entries(RULES).map(([id, def]) => {
    const s = source(id, placeId, opts);
    const up = parentOf(placeId);
    return { id, name: def.name, value: s.value, text: WORDS(def, s.value), source: s.source,
      note: s.source === 'enacted' ? `changed in ${s.year}` : s.source === 'enacted region' ? `changed by the region in ${s.year}` : s.source === 'parent' ? `as in ${theCountry(COUNTRIES[up].name)}` : s.source === 'region' ? 'local law' : s.source === 'history' ? 'the law of the time' : s.source === 'era' ? 'the usual law of the period' : '' };
  });
}

// ---------- Laws that change ----------

/** Records a change of law. Returns the entry. */
export function enact(placeId, id, value, by = 'the legislature') {
  const def = RULES[id];
  if (!def || !COUNTRIES[placeId]) throw new Error(`Cannot enact ${id} in ${placeId}`);
  const was = rule(id, placeId, { region: null });
  const b = book();
  (b[placeId] ??= {})[id] = { value, year: store.state.year, by };
  const entry = { placeId, id, from: was, to: value, year: store.state.year, by, text: describe(placeId, id, was, value) };
  const list = (b.history ??= []);
  list.push(entry);
  if (list.length > 80) list.shift();
  return entry;
}

function describe(placeId, id, was, value) {
  const name = theCountry(COUNTRIES[placeId].name).replace(/^the/, 'The');
  const lines = {
    sameSexMarriage: value ? `${name} legalized same-sex marriage.` : `${name} ended same-sex marriage. Existing marriages stand.`,
    lgbt: RULES.lgbt.levels.indexOf(value) > RULES.lgbt.levels.indexOf(was) ? `${name} passed a law protecting gay and transgender people.` : `${name} rolled back its protections for gay and transgender people.`,
    deathPenalty: value ? `${name} brought back the death penalty.` : `${name} abolished the death penalty.`,
    conscription: value ? `${name} brought in compulsory military service.` : `${name} ended compulsory military service.`,
    gambling: value ? `${name} legalized gambling.` : `${name} banned gambling.`,
    alcohol: value ? `${name} lifted its ban on alcohol.` : `${name} banned alcohol.`,
    divorce: value ? `${name} legalized divorce.` : `${name} abolished divorce.`,
    juryTrials: value ? `${name} brought in jury trials for serious crimes.` : `${name} ended jury trials: judges now decide.`,
    cashBail: value ? `${name} made release before trial depend on money bail.` : `${name} ended money bail: release before trial now depends on conditions.`,
    recordSealing: value ? `${name} now lets old criminal records be sealed.` : `${name} stopped the sealing of criminal records.`,
    sentencing: RULES.sentencing.levels.indexOf(value) > RULES.sentencing.levels.indexOf(was) ? `${name} passed a law for longer prison sentences.` : `${name} passed a law for shorter prison sentences.`,
    prisonEducation: RULES.prisonEducation.levels.indexOf(value) > RULES.prisonEducation.levels.indexOf(was) ? `${name} is putting more money into education in its prisons.` : `${name} cut education in its prisons.`,
  };
  return lines[id] ?? `${name} changed its ${RULES[id].name.toLowerCase()} from ${WORDS(RULES[id], was)} to ${WORDS(RULES[id], value)}.`;
}

/**
 * Every change of law a government could put to its legislature now.
 *   wants: how parties judge it, on the issues they hold positions on (data/parties.js):
 *          'open' is immigration and freedoms, 'order' is law and order, 'services' is public provision
 *   liked: what the public makes of it, in points of approval. Where the law is hostile to gay and transgender
 *          people, liberal reforms cost a government support; where it protects them, they win it.
 * @returns {{rule:string, value:any, name:string, wants:Object<string,number>, liked:number}[]}
 */
export function choices(placeId = here(), opts = {}) {
  const r = (id) => rule(id, placeId, { region: opts.region ?? null });
  const climate = { equal: 2, limited: 0, hostile: -3 }[r('lgbt')];
  const out = [];
  const add = (id, value, name, wants, liked) => { if (r(id) !== value) out.push({ rule: id, value, name, wants, liked }); };
  if (!r('sameSexMarriage')) add('sameSexMarriage', true, 'legalize same-sex marriage', { open: 1 }, climate);
  else add('sameSexMarriage', false, 'end same-sex marriage', { open: -1 }, -climate);
  const at = RULES.lgbt.levels.indexOf(r('lgbt'));
  if (at < 2) add('lgbt', RULES.lgbt.levels[at + 1], at === 0 ? 'stop treating gay and transgender people as criminals' : 'protect gay and transgender people in law', { open: 1 }, at === 0 ? -2 : climate);
  if (at > 0) add('lgbt', RULES.lgbt.levels[at - 1], 'roll back protections for gay and transgender people', { open: -1 }, -climate - 1);
  if (r('deathPenalty')) add('deathPenalty', false, 'abolish the death penalty', { order: -1, open: 1 }, -1); else add('deathPenalty', true, 'bring back the death penalty', { order: 1, open: -1 }, 0);
  if (r('conscription')) add('conscription', false, 'end compulsory military service', { order: -1, open: 1 }, 2); else add('conscription', true, 'bring in compulsory military service', { order: 1, open: -1 }, -4);
  if (r('gambling')) add('gambling', false, 'ban gambling', { order: 1, open: -1 }, -1); else add('gambling', true, 'legalize gambling', { open: 1 }, 1);
  if (r('alcohol')) add('alcohol', false, 'ban alcohol', { order: 1, open: -1 }, -5); else add('alcohol', true, 'lift the ban on alcohol', { open: 1 }, climate);
  if (!r('divorce')) add('divorce', true, 'legalize divorce', { open: 1 }, 1);
  if (r('votingAge') > 16) add('votingAge', 16, 'lower the voting age to 16', { open: 1 }, 0); else add('votingAge', 18, 'raise the voting age to 18', { open: -1 }, -1);
  if (r('drinkingAge') > 18) add('drinkingAge', 18, 'lower the drinking age to 18', { open: 1, order: -1 }, 1); else add('drinkingAge', 21, 'raise the drinking age to 21', { order: 1 }, -2);
  if (r('retirementAge') < 72) add('retirementAge', r('retirementAge') + 1, `raise the pension age to ${r('retirementAge') + 1}`, { services: -1, tax: -1 }, -4);
  if (r('retirementAge') > 58) add('retirementAge', r('retirementAge') - 1, `lower the pension age to ${r('retirementAge') - 1}`, { services: 1, tax: 1 }, 3);
  // Justice. Every one has costs as well as benefits; no party is right about all of them.
  if (r('juryTrials')) add('juryTrials', false, 'end jury trials and let judges decide', { order: 1, open: -1 }, -2); else add('juryTrials', true, 'bring in jury trials for serious crimes', { open: 1 }, 1);
  if (r('cashBail')) add('cashBail', false, 'end money bail', { open: 1, order: -1 }, 0); else add('cashBail', true, 'make release before trial depend on money bail', { order: 1 }, -1);
  if (r('recordSealing')) add('recordSealing', false, 'stop the sealing of criminal records', { order: 1, open: -1 }, 0); else add('recordSealing', true, 'let old criminal records be sealed', { open: 1, order: -1 }, 1);
  const sen = RULES.sentencing.levels.indexOf(r('sentencing'));
  if (sen < 2) add('sentencing', RULES.sentencing.levels[sen + 1], 'pass longer prison sentences', { order: 1, open: -1, tax: -1 }, 1);
  if (sen > 0) add('sentencing', RULES.sentencing.levels[sen - 1], 'pass shorter prison sentences', { order: -1, open: 1 }, -1);
  const edu = RULES.prisonEducation.levels.indexOf(r('prisonEducation'));
  if (edu < 2) add('prisonEducation', RULES.prisonEducation.levels[edu + 1], 'pay for more education in prisons', { services: 1, tax: 1, order: -1 }, 0);
  if (edu > 0) add('prisonEducation', RULES.prisonEducation.levels[edu - 1], 'cut education in prisons', { services: -1, tax: -1, order: 1 }, 0);
  return out;
}

/** The reforms a place is ripe for, given how settled it is. */
function reformsFor(placeId) {
  const L = LIVING[placeId];
  if (!L) return [];
  const r = (id) => rule(id, placeId, { region: null });
  const out = [];
  if (!r('sameSexMarriage') && (r('lgbt') === 'equal' || (r('lgbt') === 'limited' && L.stability >= 62))) out.push(['sameSexMarriage', true]);
  if (r('lgbt') === 'limited' && L.stability >= 60) out.push(['lgbt', 'equal']);
  if (r('lgbt') === 'hostile' && L.stability >= 55) out.push(['lgbt', 'limited']);
  if (r('lgbt') === 'equal' && !r('sameSexMarriage') && L.stability < 45) out.push(['lgbt', 'limited']);
  if (r('deathPenalty') && L.stability >= 55) out.push(['deathPenalty', false]);
  if (r('conscription') && L.stability >= 70 && L.crisis !== 'war') out.push(['conscription', false]);
  if (!r('conscription') && L.crisis === 'war') out.push(['conscription', true]);
  if (!r('gambling') && L.stability >= 60 && r('alcohol')) out.push(['gambling', true]);
  if (!r('divorce')) out.push(['divorce', true]);
  if (r('retirementAge') < 70 && L.wage >= 0.5) out.push(['retirementAge', r('retirementAge') + 1]);
  if (!r('recordSealing') && L.stability >= 60) out.push(['recordSealing', true]);
  if (r('prisonEducation') !== 'extensive' && L.stability >= 60 && L.wage >= 0.5) out.push(['prisonEducation', RULES.prisonEducation.levels[RULES.prisonEducation.levels.indexOf(r('prisonEducation')) + 1]]);
  if (r('sentencing') !== 'tough' && L.crisis) out.push(['sentencing', RULES.sentencing.levels[RULES.sentencing.levels.indexOf(r('sentencing')) + 1]]);
  return out;
}

/**
 * Yearly: now and then, somewhere, the law changes. The player hears of it
 * when it is where they live or a country they are a citizen of.
 * @returns {?object} the change, if there was one
 */
export function tickRules() {
  if (!rng.chance(REFORM.chance)) return null;
  const p = player();
  const placeId = rng.chance(REFORM.homeBias) ? p.countryId : rng.pick(COUNTRY_LIST).id;
  const options = reformsFor(placeId);
  if (!options.length) return null;
  const open = options.filter(([id]) => !historyHolds(id, placeId));
  if (!open.length) return null;
  const [id, value] = rng.pick(open);
  // Where this life has a political world for the country, a government does not pass what it opposes.
  const w = store.state.polities?.[placeId];
  const lead = w?.parties?.find((x) => x.id === w.govt?.lead);
  const bill = choices(placeId).find((c) => c.rule === id && c.value === value);
  if (lead && bill && Object.entries(bill.wants).reduce((sum, [issue, dir]) => sum + dir * (lead.positions?.[issue] ?? 0), 0) < 0 && rng.chance(0.8)) return null; // now and then a government is pushed into it
  const e = enact(placeId, id, value, lead ? `the government of ${lead.name}` : undefined);
  post(placeId, 'law', `${e.text}${id === 'retirementAge' ? '' : placeId === p.countryId ? ' It is the law where you live now.' : ''}`);
  return e;
}

/** Changes of law in this life, newest first; for one place, or everywhere. */
export const reforms = (placeId) => [...(book().history ?? [])].filter((e) => !placeId || e.placeId === placeId).reverse();

// ---------- Regional law ----------

/** Whether the regions of a country make any of their own law. */
export const regionsLegislate = (placeId) => REGIONAL_COUNTRIES.includes(placeId);

/** The changes of law a regional government could make now, for its own region. */
export function regionalChoices(placeId, region) {
  if (!regionsLegislate(placeId) || !region) return [];
  return choices(placeId, { region }).filter((c) => REGIONAL_RULES.includes(c.rule));
}

/** Records a regional change of law. Applies to people living in that region only. */
export function enactRegional(placeId, region, id, value, regionName, by = 'the regional assembly') {
  if (!REGIONAL_RULES.includes(id) || !regionsLegislate(placeId)) throw new Error(`${id} is not regional law in ${placeId}`);
  const was = rule(id, placeId, { region });
  const b = book();
  ((b.regions ??= {})[`${placeId}/${region}`] ??= {})[id] = { value, year: store.state.year, by };
  const text = describe(placeId, id, was, value).replace(/^(The )?[A-Z][^ ]*( [A-Z][a-z]+)*?( (legalized|banned|brought|abolished|lifted|changed|ended|rolled|passed))/, `${regionName}$3`);
  const entry = { placeId, region, id, from: was, to: value, year: store.state.year, by, text };
  const list = (b.history ??= []);
  list.push(entry);
  if (list.length > 80) list.shift();
  return entry;
}

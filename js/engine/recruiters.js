// Recruiters and headhunters: people (ordinary NPCs, kept for good) who
// bring openings to someone with a record worth bringing them to. Every lead
// is a real opening at a real employer, the same as the job board's; a lead
// never guarantees a job. Some are in another city, a few in another country,
// where moving, and the right to work there, come first.
//
//   p.career.recruiterIds  the recruiters who know the player
//   p.career.leads         [{ id, from (npc id), postingId, age, text, abroad, seen, bonus }]
import { rng } from '../rng.js';
import { clamp, fmtMoney, uid } from '../util.js';
import { store, player, country, livingNpcs, log } from '../state.js';
import { COUNTRIES, COUNTRY_LIST } from '../data/countries.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { FAMILY_BY_ID } from '../data/occupations.js';
import { makeNpc } from './npcFactory.js';
import { ensureLife } from './npcLives.js';
import { employer, posting, cityEmployers, openPosting, isOpen, fillPosting, cultureOf } from './employers.js';
import { career as careerState } from './worklife.js';
import { mentorLead } from './workplace.js';
import { routes } from './immigration.js';
import { relocate, moveBlock } from './cities.js';
import { emigrate } from './emigration.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const an = (noun) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
const theCountry = (name) => (/^(United|Netherlands|Philippines|Czech|Dominican|Bahamas)/.test(name) ? `the ${name}` : name);

/** A recruiter who works this family of jobs, met once and kept. */
function recruiterFor(family) {
  const p = player();
  const c = careerState();
  const known = c.recruiterIds.map((id) => store.state.npcs[id]).find((n) => n?.alive && n.flags.recruits === family);
  if (known) return known;
  const n = makeNpc({ role: 'colleague', countryId: p.countryId, age: rng.int(27, 55), relationship: rng.int(40, 55) });
  n.flags.title = `Recruiter (${FAMILY_BY_ID[family]?.name.toLowerCase() ?? 'all fields'})`;
  n.flags.recruits = family;
  n.flags.tag = 'recruiter';
  n.occupation = 'recruiter';
  n.lastInteractionAge = p.age;
  store.state.npcs[n.id] = n;
  p.npcIds.push(n.id);
  c.recruiterIds.push(n.id);
  return n;
}

/** Where a lead might be: here, elsewhere in the country, or abroad. */
function leadPlace(c) {
  const p = player();
  const roll = rng.next();
  const cities = COUNTRIES[p.countryId].cities.filter((x) => x !== p.city);
  if (roll < 0.5 || !cities.length) return { countryId: p.countryId, city: p.city };
  if (roll < 0.86 || c.level < 1) return { countryId: p.countryId, city: rng.pick(cities) };
  // Abroad: somewhere the player could plausibly get a work visa.
  const options = COUNTRY_LIST.filter((x) => x.id !== p.countryId && x.cities.length && x.living?.crisis == null);
  const dest = rng.pick(options);
  return dest ? { countryId: dest.id, city: dest.cities[0] } : { countryId: p.countryId, city: p.city };
}

/**
 * Once a year: someone with a record may be approached. A former mentor may
 * come back with an offer. @returns {string[]} journal lines
 */
export function tickRecruiters() {
  const p = player();
  const c = careerState();
  const lines = [];
  // Old leads lapse with the year they came in.
  c.leads = c.leads.filter((l) => l.age >= p.age - 1 && isOpen(posting(l.postingId)));
  const car = CAREER_BY_ID[c.careerId];
  const years = Object.values(c.experience).reduce((a, b) => a + b, 0);
  const lead = mentorLead();
  if (lead) { c.leads.push({ id: uid('lead'), age: p.age, abroad: false, seen: false, ...lead }); lines.push(lead.text); }
  if (!car || car.type === 'military' || years < 2 || p.age < 20) return lines;
  const odds = clamp(0.12 + (c.performance - 50) / 250 + Math.min(0.2, years / 60) + c.level * 0.04 + p.hidden.fame / 400, 0.04, 0.5);
  if (!rng.chance(odds)) return lines;
  const r = recruiterFor(car.family);
  const where = leadPlace(c);
  const list = cityEmployers(where.countryId, where.city).filter((e) => e.id !== c.employerId);
  const e = list.find((x) => x.tracks.includes(car.id)) ?? list.find((x) => x.family === car.family);
  if (!e) return lines;
  if (!e.tracks.includes(car.id)) e.tracks.push(car.id);
  const level = Math.min(car.levels.length - 1, c.level + (rng.chance(0.55) ? 1 : 0));
  const post = openPosting(e, { careerId: car.id, level });
  if (!post) return lines;
  const abroad = where.countryId !== p.countryId;
  const place = abroad ? `${where.city}, ${theCountry(COUNTRIES[where.countryId].name)}` : where.city === p.city ? 'here in town' : where.city;
  const text = `${r.firstName} ${r.lastName}, a recruiter, has been in touch: ${e.name} (${place}) is looking for ${an(post.title.toLowerCase())}, at ${fmtMoney(post.pay[0], COUNTRIES[post.countryId])}–${fmtMoney(post.pay[1], COUNTRIES[post.countryId])} a year.`;
  c.leads.push({ id: uid('lead'), from: r.id, postingId: post.id, age: p.age, text, abroad, seen: false, bonus: 0.12 });
  r.lastInteractionAge = p.age;
  lines.push(text);
  return lines;
}

/** The leads the player has, with what is known about each. */
export function leads() {
  const c = careerState();
  return c.leads.map((l) => {
    const post = posting(l.postingId);
    const e = employer(post?.employerId);
    return { ...l, post, employer: e, from: store.state.npcs[l.from], culture: e ? cultureOf(e) : null, open: isOpen(post) };
  }).filter((l) => l.open);
}

/** Asks for more about a lead: the employer, its culture, the pay band. */
export function details(leadId) {
  const l = leads().find((x) => x.id === leadId);
  if (!l) return result(false, 'That opening has gone.', 'neutral');
  careerState().leads.find((x) => x.id === leadId).seen = true;
  const cty = COUNTRIES[l.post.countryId];
  const route = l.abroad ? routes(l.post.countryId).find((r) => r.id === 'work' || r.id === 'right' || r.id === 'free') : null;
  const visa = !l.abroad ? '' : route?.id === 'right' ? ' You could live there as a citizen.' : route?.id === 'free' ? ' Free movement means no visa is needed.'
    : route?.eligible ? ' The employer would sponsor a work visa; it is not certain.' : ` You would need a work visa, and: ${route?.why ?? 'you are not eligible'}.`;
  return result(true, `${l.employer.name} is ${l.culture.label.toLowerCase()}: ${l.culture.blurb} The role pays ${fmtMoney(l.post.pay[0], cty)}–${fmtMoney(l.post.pay[1], cty)} a year for ${l.post.hours} hours a week.${visa}`, 'neutral');
}

export function declineLead(leadId) {
  const c = careerState();
  const l = c.leads.find((x) => x.id === leadId);
  c.leads = c.leads.filter((x) => x.id !== leadId);
  const r = store.state.npcs[l?.from];
  if (r) r.meters.relationship = clamp(r.meters.relationship - 2);
  return result(true, 'You say thank you, but no.', 'neutral');
}

/** Puts a friend forward instead. They may get it. */
export function referFriend(leadId, friendId) {
  const c = careerState();
  const l = leads().find((x) => x.id === leadId);
  const f = store.state.npcs[friendId];
  if (!l || !f?.alive) return result(false, 'That is no longer possible.', 'neutral');
  ensureLife(f);
  c.leads = c.leads.filter((x) => x.id !== leadId);
  const r = store.state.npcs[l.from];
  if (r) r.meters.relationship = clamp(r.meters.relationship + 4);
  const able = f.life?.edu && (f.meters.intellect >= 45 || f.life.job?.careerId === l.post.careerId);
  if (!able || !rng.chance(0.55)) return result(false, `You put ${f.firstName} forward. They interviewed, but it went to someone else. ${f.firstName} thanks you all the same.`, 'neutral');
  fillPosting(l.post.id, f.id);
  if (l.post.countryId === player().countryId) {
    f.life.job = { careerId: l.post.careerId, level: l.post.level, title: l.post.title, salary: l.post.pay[0], years: 0, employerId: l.employer.id };
    f.occupation = l.post.title.toLowerCase();
    l.employer.staff.push(f.id);
  } else f.flags.abroad = l.post.countryId;
  f.meters.relationship = clamp(f.meters.relationship + 12);
  const text = `You put ${f.firstName} forward, and ${l.employer.name} hired them. They will not forget it.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** Friends the player could refer. */
export const referable = () => livingNpcs().filter((n) => ['friend', 'colleague', 'sibling'].includes(n.role) && n.age >= 18 && n.age < 66 && !n.flags.recruits);

/**
 * Before applying for a lead in another place: what moving involves.
 * @returns {{ok:boolean, text:string, route?:object}}
 */
export function moveCheck(leadId) {
  const p = player();
  const l = leads().find((x) => x.id === leadId);
  if (!l) return result(false, 'That opening has gone.', 'neutral');
  if (!l.abroad && l.post.city === p.city) return result(true, '');
  if (!l.abroad) { const block = moveBlock(); return block ? result(false, block, 'neutral') : result(true, `This job is in ${l.post.city}. Taking it means moving there.`); }
  const r = routes(l.post.countryId).find((x) => ['right', 'free'].includes(x.id) && x.eligible) ?? routes(l.post.countryId).find((x) => x.id === 'work');
  if (!r?.eligible) return result(false, `To work in ${theCountry(COUNTRIES[l.post.countryId].name)} you would need a work visa, and ${r?.why ?? 'you are not eligible for one'}`.replace(/\.?$/, '.'), 'neutral');
  return { ...result(true, `This job is in ${theCountry(COUNTRIES[l.post.countryId].name)}. ${r.id === 'work' ? 'The employer would sponsor your work visa if you are offered it.' : 'You have the right to live and work there.'}`), route: r };
}

/**
 * After an offer from a lead in another place: move, then start. A visa can
 * still be refused. @returns the hire result, or why it could not happen
 */
export function moveForOffer(offer, acceptOffer) {
  const p = player();
  const post = posting(offer.postingId);
  if (!post) return result(false, 'That opening has gone.', 'neutral');
  if (post.countryId !== p.countryId) {
    const best = routes(post.countryId).find((x) => ['right', 'free'].includes(x.id) && x.eligible);
    p.flags.sponsor = post.countryId; // an employer is behind the application
    const moved = emigrate(post.countryId, { route: best ? best.id : 'work' });
    delete p.flags.sponsor;
    if (!moved.ok) return moved;
    p.city = post.city;
  } else if (post.city !== p.city) {
    const moved = relocate(post.city);
    if (!moved.ok) return moved;
  }
  return acceptOffer(offer.id);
}

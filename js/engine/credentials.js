// Qualifications that are only good where they are recognized. A doctor,
// nurse, lawyer, teacher or licensed electrician trained in one country may
// not practice in another until that country's professional body has
// recognized the qualification. A job offer does not do it, and neither does
// a visa (engine/immigration.js decides who may work at all; this decides who
// may practice a regulated profession).
//
//   p.credentials  [{ id, profession, jurisdictionId, status, since, via, history:[] }]
//     status: 'licensed' | 'pending' | 'conditional' | 'refused' | 'failed'
//     via:    'trained' (qualified there) | 'mutual' (a recognition area) | 'recognition' (an application)
//
// Where someone trained is what the save shows: the country they lived in when
// they finished the qualification, and anywhere they have practiced. Nothing is
// invented: a life saved before this kept practicing where it practiced.
//
// GAMEPLAY RULES, unverified, the same in every country: which professions are
// regulated, the fee, the language a profession asks for, and the odds of a full
// license, an adaptation year with an exam, or a refusal.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, theCountry, uid } from '../util.js';
import { store, player, country, log } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { FREE_MOVEMENT } from '../data/immigration.js';
import { speaks } from './languages.js';
import { charge, recordEvent } from './chronicle.js';
import { today } from './documents.js';

const nameOf = (id) => theCountry(COUNTRIES[id]?.name ?? id);
const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });

/**
 * Professions a country regulates, by career. `profession` groups careers that
 * share one license (a nurse and a midwife are both registered nurses).
 * language: the level (0-100) of the local language the profession asks for.
 * exam: whether the adaptation route ends in an exam. Gameplay configuration.
 */
export const REGULATED = {
  doctor: { profession: 'medicine', name: 'Medicine', body: 'the medical council', language: 70, exam: true },
  podiatrist: { profession: 'podiatry', name: 'Podiatric medicine', body: 'the podiatry board', language: 65, exam: true },
  dentist: { profession: 'dentistry', name: 'Dentistry', body: 'the dental council', language: 65, exam: true },
  pharmacist: { profession: 'pharmacy', name: 'Pharmacy', body: 'the pharmacy board', language: 65, exam: true },
  nurse: { profession: 'nursing', name: 'Nursing', body: 'the nursing council', language: 60, exam: true },
  midwife: { profession: 'nursing', name: 'Nursing', body: 'the nursing council', language: 60, exam: true },
  adv_nurse: { profession: 'nursing', name: 'Nursing', body: 'the nursing council', language: 60, exam: true },
  physio: { profession: 'physiotherapy', name: 'Physiotherapy', body: 'the health professions council', language: 60, exam: true },
  vet: { profession: 'veterinary', name: 'Veterinary medicine', body: 'the veterinary board', language: 60, exam: true },
  lawyer: { profession: 'law', name: 'Law', body: 'the bar', language: 80, exam: true },
  teacher: { profession: 'teaching', name: 'Teaching', body: 'the teaching council', language: 70, exam: false },
  primary: { profession: 'teaching', name: 'Teaching', body: 'the teaching council', language: 70, exam: false },
  accountant: { profession: 'accountancy', name: 'Chartered accountancy', body: 'the accountancy institute', language: 55, exam: true },
  civil_eng: { profession: 'engineering', name: 'Chartered engineering', body: 'the engineering council', language: 50, exam: false },
  electrician: { profession: 'electrical', name: 'Electrical work', body: 'the licensing authority', language: 40, exam: true },
  plumber: { profession: 'plumbing', name: 'Plumbing', body: 'the licensing authority', language: 40, exam: true },
  pilot: { profession: 'aviation', name: 'Airline flying', body: 'the aviation authority', language: 60, exam: true },
};
/** Fictional numbers: the fee (base units) and the odds once the language is there. */
export const RECOGNITION = { fee: 650, full: 0.5, conditional: 0.4, examPass: 0.7 };

const creds = (p) => (p.credentials ??= []);
/** The license a career needs, if any. */
export const regulation = (careerId) => REGULATED[careerId] ?? null;
const areaOf = (a, b) => FREE_MOVEMENT.find((x) => x.members.includes(a) && x.members.includes(b)) ?? null;

/** Where the save shows someone qualified in a profession: the country they lived in when they finished it. */
function trainedIn(p, profession) {
  const careers = Object.entries(REGULATED).filter(([, r]) => r.profession === profession).map(([id]) => id);
  const out = new Set();
  // Practicing it, or having practiced it, somewhere: they were licensed there.
  const hist = p.career?.history ?? [];
  if (careers.includes(p.career?.careerId) && !p.career.retired) out.add(p.career.countryId ?? p.countryId);
  for (const h of hist) if (careers.includes(h.careerId) && h.countryId) out.add(h.countryId);
  // Where they lived when they finished the training.
  const born = p.birthYear ?? store.state.year - p.age;
  for (const d of p.education?.degrees ?? []) {
    if (d.age == null) continue;
    const y = born + d.age;
    const at = (p.locations ?? []).filter((l) => (l.from ?? -Infinity) <= y && (l.to ?? Infinity) >= y).at(-1);
    out.add(at?.countryId ?? (p.locations?.length ? p.locations[0].countryId : p.countryId));
  }
  return [...out].filter(Boolean);
}

/** Whether someone may practice a regulated career in a country. Careers that are not regulated: always. */
export function licensedIn(p, careerId, countryId = p.countryId) {
  const r = regulation(careerId);
  if (!r) return true;
  const mine = creds(p).filter((c) => c.profession === r.profession && c.status === 'licensed').map((c) => c.jurisdictionId);
  const trained = trainedIn(p, r.profession);
  return [...mine, ...trained].some((j) => j === countryId);
}

/** Why someone may not practice a career where they live, or ''. Read by career.unmet. */
export function licenseBlock(careerId, p = player()) {
  const r = regulation(careerId);
  if (!r || licensedIn(p, careerId)) return '';
  const c = creds(p).find((x) => x.profession === r.profession && x.jurisdictionId === p.countryId && ['pending', 'conditional'].includes(x.status));
  if (c?.status === 'pending') return `Your ${r.name.toLowerCase()} qualification is with ${r.body} in ${nameOf(p.countryId)}: a decision comes when the year turns.`;
  if (c?.status === 'conditional') return `You are in your adaptation year with ${r.body}. You can practice once you pass.`;
  return `Your ${r.name.toLowerCase()} qualification is not recognized in ${nameOf(p.countryId)}. Apply to ${r.body} for recognition (Explore the World, Immigration).`;
}

/**
 * The regulated professions someone holds, with where they may practice and
 * what recognition here would involve.
 */
export function qualifications(p = player()) {
  const seen = new Map();
  for (const [careerId, r] of Object.entries(REGULATED)) {
    const trained = trainedIn(p, r.profession);
    const licensed = creds(p).filter((c) => c.profession === r.profession && c.status === 'licensed').map((c) => c.jurisdictionId);
    if (!trained.length && !licensed.length && !creds(p).some((c) => c.profession === r.profession)) continue;
    if (seen.has(r.profession)) continue;
    const here = p.countryId;
    const may = [...new Set([...trained, ...licensed])];
    const open = creds(p).find((c) => c.profession === r.profession && c.jurisdictionId === here && ['pending', 'conditional'].includes(c.status));
    const lang = speaks(here, p);
    const area = may.map((j) => areaOf(j, here)).find(Boolean);
    seen.set(r.profession, { profession: r.profession, careerId, name: r.name, body: r.body, practice: may, here: may.includes(here), open,
      language: { needed: lang == null ? 0 : r.language, have: lang ?? 100 }, mutual: area?.name ?? null, fee: localMoney(RECOGNITION.fee, country()),
      history: creds(p).filter((c) => c.profession === r.profession) });
  }
  return [...seen.values()];
}

/**
 * Applies for a qualification to be recognized where the player lives. In a
 * recognition area it is a registration, done at once. Anywhere else it is
 * decided when the year turns. The decision is made once.
 */
export function applyRecognition(profession, p = player()) {
  const q = qualifications(p).find((x) => x.profession === profession);
  if (!q) return result(false, 'You hold no such qualification.', 'neutral');
  if (q.here) return result(false, `You can already practice ${q.name.toLowerCase()} here.`, 'neutral');
  if (q.open) return result(false, q.open.status === 'pending' ? 'Your application is already with them.' : 'You are already in your adaptation year.', 'neutral');
  const year = store.state.year;
  if (creds(p).some((c) => c.profession === profession && c.jurisdictionId === p.countryId && c.status === 'refused' && c.year === year)) return result(false, 'Refused this year. You can apply again next year.', 'neutral');
  const paid = charge({ amount: q.fee, kind: 'recognition', memo: `Recognition of ${q.name.toLowerCase()} by ${q.body}, ${COUNTRIES[p.countryId].name}`, key: `cred:${profession}:${p.countryId}:${year}` });
  if (!paid.ok) return result(false, `The fee is ${fmtMoney(q.fee, country())}. You do not have it.`, 'neutral');
  const c = { id: uid('cred'), profession, careerId: q.careerId, jurisdictionId: p.countryId, status: 'pending', year, since: null, via: 'recognition', history: [{ year, date: today(), status: 'submitted' }] };
  creds(p).push(c);
  if (q.mutual) {
    c.status = 'licensed'; c.since = year; c.via = 'mutual';
    c.history.push({ year, status: 'licensed', note: `recognized under ${q.mutual}` });
    const text = `${q.body.replace(/^./, (x) => x.toUpperCase())} registered you: under the ${q.mutual}, your ${q.name.toLowerCase()} qualification is recognized. You can practice here.`;
    log(text, 'system', 'good');
    return result(true, text);
  }
  const text = `Your application to ${q.body} in ${nameOf(p.countryId)} is in. They will decide when the year turns.${q.language.have < q.language.needed ? ' Your command of the language is below what they ask for.' : ''}`;
  log(text);
  return result(true, text, 'neutral');
}

/** Yearly: applications are decided; adaptation years end in an exam where the profession sets one. */
export function tickCredentials(p = player()) {
  const year = store.state.year;
  const out = [];
  for (const c of creds(p)) {
    const r = Object.values(REGULATED).find((x) => x.profession === c.profession);
    if (!r) continue;
    const where = nameOf(c.jurisdictionId);
    if (c.status === 'pending' && c.year < year) {
      const lang = speaks(c.jurisdictionId, p);
      if (lang != null && lang < r.language) {
        c.status = 'refused'; c.reason = 'The language level asked for was not met.';
      } else {
        const roll = rng.next();
        const exp = Math.min(0.15, (p.career?.yearsInField ?? 0) / 60);
        if (roll < RECOGNITION.full + exp) { c.status = 'licensed'; c.since = year; }
        else if (roll < RECOGNITION.full + exp + RECOGNITION.conditional) { c.status = 'conditional'; c.adaptStart = year; }
        else { c.status = 'refused'; c.reason = 'The training was judged too different from the training here.'; }
      }
      c.year = year;
      c.history.push({ year, status: c.status, note: c.reason ?? '' });
      out.push(c.status === 'licensed' ? { text: `${r.body.replace(/^./, (x) => x.toUpperCase())} in ${where} recognized your ${r.name.toLowerCase()} qualification. You can practice.`, tone: 'good' }
        : c.status === 'conditional' ? { text: `${r.body.replace(/^./, (x) => x.toUpperCase())} in ${where} will recognize your ${r.name.toLowerCase()} qualification after a year of supervised practice${r.exam ? ' and an exam' : ''}.`, tone: 'neutral' }
          : { text: `${r.body.replace(/^./, (x) => x.toUpperCase())} in ${where} refused to recognize your ${r.name.toLowerCase()} qualification. ${c.reason}`, tone: 'bad' });
      continue;
    }
    if (c.status === 'conditional' && c.adaptStart < year) {
      const pass = !r.exam || rng.chance(clamp(RECOGNITION.examPass + (p.stats.intellect - 50) / 200, 0.3, 0.95));
      c.status = pass ? 'licensed' : 'failed';
      if (pass) c.since = year;
      c.year = year;
      c.history.push({ year, status: c.status });
      out.push(pass ? { text: `You passed${r.exam ? ' the exam' : ''} at the end of your adaptation year. ${r.body.replace(/^./, (x) => x.toUpperCase())} has licensed you in ${where}.`, tone: 'good' }
        : { text: `You did not pass the exam at the end of your adaptation year. You can apply again.`, tone: 'bad' });
    }
  }
  for (const c of creds(p)) if (c.status === 'licensed' && c.since === year && c.via !== 'mutual') recordEvent({ key: `cred:${c.id}`, type: 'qualification', title: `Licensed in ${COUNTRIES[c.jurisdictionId].name}: ${Object.values(REGULATED).find((x) => x.profession === c.profession)?.name}`, place: { countryId: c.jurisdictionId }, privacy: 'private' });
  return out;
}

export { CAREER_BY_ID };

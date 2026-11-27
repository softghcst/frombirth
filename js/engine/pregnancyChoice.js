// When a pregnancy is announced, it is a decision: to carry on with it, or not. It is asked of anyone, at any age that
// can be pregnant in the game, and the answer is the pregnant person's. Told plainly, with nothing described.
//
//   p.flags.pregnancy = { dueAge, otherId, decided?: 'keep' | 'unable' }     p.flags.pregnancyEnded = year
//
// Where the player is the one who is pregnant the choice is theirs. Where a partner is, the player says what they hope
// (or that they will stand by her choice) and she decides: what she decides depends on who she is and how things are
// between them. Not continuing costs money, and in countries where it is against the law (a short list, modern years)
// it means traveling abroad, which costs a lot more; if the money is not there the pregnancy simply goes on.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, log } from '../state.js';
import { book } from './ledger.js';
import * as bonds from './bonds.js';
import { pregnancyGoesOn, dropStageScenes } from './pregnancyStages.js';

const npcOf = (id) => store.state.npcs[id];
const bump = (npc, d) => { if (npc) npc.meters.relationship = clamp(npc.meters.relationship + d); };

/** Countries where ending a pregnancy is (nearly) banned. A small list of the clearest cases, modern years only. */
export const RESTRICTED = new Set(['sv', 'ni', 'do', 'ht', 'eg', 'iq', 'ph', 'pl', 'ad']);
export const FEE = 700;        // a clinic, at home
export const FEE_ABROAD = 4500; // the journey and the clinic, from a country where it is not allowed
export const restricted = (countryId = player().countryId) => store.state.year >= 1970 && RESTRICTED.has(countryId);
export const cost = () => (restricted() ? localMoney(FEE_ABROAD, country()) : player().age < 18 ? 0 : localMoney(FEE, country())); // a young person's clinic arranges it at home

const iAmPregnant = () => (player().flags.bornAs ?? player().gender) === 'female';

/** Tell the player the news and ask. Called wherever a pregnancy starts. */
export function announce(npc, said) {
  store.state.pendingEvents.push({ id: iAmPregnant() ? 'pregnancy_choice' : 'pregnancy_partner', cast: { them: npc?.id, words: { who: said } } });
}

function stopIt(them) {
  const p = player();
  const teen = p.flags.teenPregnancy;
  p.flags.pregnancy = null;
  p.flags.pregnancyEnded = store.state.year;
  dropStageScenes();
  if (teen) { teen.done = store.state.year; teen.plan = 'ended'; }
  const b = them && bonds.bondWith(them.id);
  if (b) delete b.pregnancy;
}

/** The player's own choice, when they are the one who is pregnant. */
function mine(choice, them) {
  const p = player();
  const preg = p.flags.pregnancy;
  if (!preg) return '';
  if (choice === 'keep') {
    preg.decided = 'keep';
    pregnancyGoesOn();
    p.stats.mood = clamp(p.stats.mood + 4);
    if (them?.alive) bump(them, 2);
    return 'You decide to go on with the pregnancy.';
  }
  const price = cost();
  if (p.finance.cash < price) {
    preg.decided = 'unable';
    pregnancyGoesOn();
    const where = restricted() ? 'It is not allowed here, and getting away to somewhere it is costs more than you have.' : 'You cannot find the money for it.';
    p.stats.mood = clamp(p.stats.mood - 5);
    return `${where} (${fmtMoney(price, country())} was needed.) The pregnancy goes on. If you want help with what comes next, there are people whose job it is to give it.`;
  }
  if (price) { p.finance.cash -= price; book({ cat: 'health', src: 'action', desc: restricted() ? 'Care, abroad' : 'Care' }); }
  stopIt(them);
  p.stats.mood = clamp(p.stats.mood - 12);
  p.stats.health = clamp(p.stats.health - 2);
  if (them?.alive) bump(them, them.flags?.heart?.commitment >= 60 ? -8 : -2);
  const text = restricted() ? 'You travel to a country where you can end it, and come home. It is over, and it is yours to carry.' : 'You end the pregnancy. It is over, and you are all right, and it is yours to carry.';
  log(text, 'system', 'neutral');
  return text;
}

/** A partner's choice, after the player has said what they hope. */
function theirs(hope, them) {
  const p = player();
  const preg = p.flags.pregnancy;
  if (!preg || !them?.alive) return '';
  const h = bonds.heart(them);
  let keep = 0.55 + (h.commitment - 50) / 200 + (them.meters.relationship - 50) / 250;
  keep += hope === 'wantkeep' ? 0.25 : hope === 'wantend' ? -0.25 : 0;
  keep = clamp(keep, 0.08, 0.95);
  const goesOn = rng.chance(keep);
  if (goesOn || (restricted() && rng.chance(0.6))) {
    preg.decided = 'keep';
    pregnancyGoesOn();
    bump(them, hope === 'wantend' ? -8 : 4);
    p.stats.mood = clamp(p.stats.mood + (hope === 'wantend' ? -3 : 3));
    return hope === 'wantend' ? `${them.firstName} has decided to go on with the pregnancy, whatever you hoped. It is theirs to decide.` : `${them.firstName} has decided to go on with the pregnancy.`;
  }
  stopIt(them);
  bump(them, hope === 'wantkeep' ? -10 : -2);
  p.stats.mood = clamp(p.stats.mood - 6);
  const text = `${them.firstName} has decided not to go on with the pregnancy. It was theirs to decide, and you say you understand.`;
  log(text, 'system', 'neutral');
  return text;
}

/** The effect: 'keep' / 'end' for a pregnant player; 'support' / 'wantkeep' / 'wantend' when it is a partner's. */
export function decide(choice, cast = {}) {
  const p = player();
  if (!p.flags.pregnancy) return '';
  const them = npcOf(cast.them) ?? npcOf(p.flags.pregnancy.otherId);
  if (iAmPregnant()) return mine(choice === 'end' || choice === 'wantend' ? 'end' : 'keep', them);
  return theirs(choice === 'end' ? 'wantend' : choice === 'keep' ? 'wantkeep' : choice, them);
}

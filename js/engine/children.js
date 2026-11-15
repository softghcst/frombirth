// Children: pregnancy, birth, adoption, growing up, and grandchildren. Also
// getting a pet. Children carry their own stats and talents so a later phase
// can let the player continue as one of them.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, npcsByRole, log, milestone } from '../state.js';
import { makeNpc, makePet } from './npcFactory.js';
import { inheritAppearance, inheritTraits, inheritTalents, inheritStats } from './genetics.js';
import { spendAction, PET_PRICE, canGetPet } from './relationships.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

export const ADOPTION_FEE = 15000;
export const CHILD_COST = 5000; // per child under 18, per year, base units
const MAX_CHILDBEARING_AGE = 47;

function addNpc(npc) {
  store.state.npcs[npc.id] = npc;
  player().npcIds.push(npc.id);
  npc.lastInteractionAge = player().age;
  return npc;
}

/** The player as a set of genes, in the shape genetics.js expects of a parent. */
const playerGenes = () => {
  const p = player();
  return { appearance: p.appearance, traits: p.traits, talents: p.talents,
    meters: { intellect: p.stats.intellect, charm: p.stats.charm, health: p.stats.health, crazy: p.hidden.crazy } };
};
const npcGenes = (npc) => ({ appearance: npc.appearance, traits: npc.traits ?? [], talents: npc.talents ?? {}, meters: npc.meters });

/** True when the player and this person could have a baby together. */
export function canConceive(npc) {
  const p = player();
  const pair = [p.gender, npc.gender].sort().join('+');
  if (pair !== 'female+male') return false;
  if (p.age < 18 || npc.age < 18) return false;
  const motherAge = p.gender === 'female' ? p.age : npc.age;
  return motherAge <= MAX_CHILDBEARING_AGE;
}

/** Starts a pregnancy. @returns {string} what the player is told */
export function conceive(npc, planned) {
  const p = player();
  p.flags.pregnancy = { dueAge: p.age + 1, otherId: npc.id };
  if (p.gender === 'female') return planned ? 'You are pregnant.' : 'A few weeks later, the test is positive. You are pregnant.';
  return planned ? `${npc.firstName} is pregnant.` : `A few weeks later, ${npc.firstName} tells you they are pregnant.`;
}

export const canTryForBaby = (npc) =>
  (npc.role === 'spouse' || npc.role === 'partner') && canConceive(npc) && !player().flags.pregnancy
  && !player().legal.incarceration;

export function tryForBaby(npcId) {
  const p = player();
  const npc = store.state.npcs[npcId];
  if (!canTryForBaby(npc)) return result(false, 'That is not possible right now.', 'neutral');
  if (!spendAction(npc, 'baby')) return result(false, 'You have been trying all year.', 'neutral');
  const motherAge = p.gender === 'female' ? p.age : npc.age;
  const chance = clamp(p.hidden.fertility / 100 * (motherAge > 38 ? 0.45 : 0.85), 0.03, 0.9);
  if (!rng.chance(chance)) {
    const text = `You and ${npc.firstName} tried for a baby this year. It has not happened yet.`;
    log(text);
    return result(false, text, 'neutral');
  }
  const text = `You and ${npc.firstName} tried for a baby. ${conceive(npc, true)}`;
  log(text, 'system', 'good');
  return result(true, text);
}

function newborn(other) {
  const p = player();
  const me = playerGenes();
  const them = other?.appearance ? npcGenes(other) : me;
  const [mother, father] = p.gender === 'female' ? [me, them] : [them, me];
  const child = makeNpc({ role: 'child', countryId: p.countryId, lastName: p.lastName, age: 0,
    relationship: rng.int(75, 95), appearance: inheritAppearance(mother, father) });
  const born = inheritStats(mother, father);
  child.stats = born.stats;
  child.hidden = born.hidden;
  child.talents = inheritTalents(mother, father);
  child.traits = inheritTraits(mother, father).traits;
  child.meters.intellect = born.stats.intellect;
  child.meters.charm = born.stats.charm;
  child.meters.health = born.stats.health;
  child.parentIds = other ? [other.id] : [];
  return addNpc(child);
}

function birth() {
  const p = player();
  const other = store.state.npcs[p.flags.pregnancy.otherId];
  p.flags.pregnancy = null;
  const babies = [newborn(other)];
  if (rng.chance(0.025)) babies.push(newborn(other));
  const kind = (n) => (n.gender === 'male' ? 'boy' : 'girl');
  const text = babies.length === 2
    ? `${p.gender === 'female' ? 'You gave birth to' : `${other?.firstName ?? 'Your partner'} gave birth to`} twins: ${babies[0].firstName} and ${babies[1].firstName}.`
    : `${p.gender === 'female' ? 'You gave birth to' : `${other?.firstName ?? 'Your partner'} gave birth to`} a baby ${kind(babies[0])}, ${babies[0].firstName}.`;
  log(`${text} You can change the name from the People tab.`, 'system', 'good');
  milestone(babies.length === 2 ? `Twins ${babies[0].firstName} and ${babies[1].firstName} were born.` : `${babies[0].firstName} was born.`, 'family');
  p.stats.mood = clamp(p.stats.mood + 14);
  if (other?.alive && (other.role === 'spouse' || other.role === 'partner')) {
    other.meters.relationship = clamp(other.meters.relationship + 6);
  }
}

export const canAdopt = () => {
  const p = player();
  return p.age >= 21 && !p.legal.incarceration && npcsByRole('child').filter((k) => k.age < 18).length < 6;
};

export function adopt() {
  const p = player();
  const c = country();
  const fee = localMoney(ADOPTION_FEE, c);
  if (!canAdopt()) return result(false, 'You cannot adopt right now.', 'neutral');
  if (p.finance.cash < fee) return result(false, `Adoption costs ${fmtMoney(fee, c)} in fees. You do not have it.`, 'neutral');
  if (p.flags.adoptedAtAge === p.age) return result(false, 'The agency handles one application a year.', 'neutral');
  p.flags.adoptedAtAge = p.age;
  p.finance.cash -= fee;
  const child = addNpc(makeNpc({ role: 'child', countryId: p.countryId, lastName: p.lastName, age: rng.int(0, 8),
    relationship: rng.int(45, 70) }));
  child.adopted = true;
  child.stats = { mood: 60, health: child.meters.health, intellect: child.meters.intellect, charm: child.meters.charm };
  child.talents = { music: rng.int(0, 60), sports: rng.int(0, 60), acting: rng.int(0, 60), crime: rng.int(0, 60),
    singing: rng.int(0, 60), dance: rng.int(0, 60) };
  p.stats.mood = clamp(p.stats.mood + 12);
  p.hidden.karma = clamp(p.hidden.karma + 8);
  const text = `After a year of forms and home visits, you adopted ${child.firstName}, age ${child.age}. The fees came to ${fmtMoney(fee, c)}.`;
  log(text, 'system', 'good');
  milestone(`Adopted ${child.firstName}.`, 'family');
  return result(true, text);
}

/** Only babies can be renamed. */
export const canRename = (npc) => npc.role === 'child' && npc.age <= 1 && !npc.adopted;
export function renameChild(npcId, name) {
  const npc = store.state.npcs[npcId];
  const clean = String(name ?? '').trim().slice(0, 20);
  if (!clean || !canRename(npc)) return result(false, 'That name will not do.', 'neutral');
  const old = npc.firstName;
  npc.firstName = clean;
  const text = `${old} is now called ${clean}.`;
  log(text);
  return result(true, text, 'neutral');
}

export function getPet() {
  const p = player();
  const c = country();
  const price = localMoney(PET_PRICE, c);
  if (!canGetPet()) return result(false, 'You cannot take on another animal.', 'neutral');
  if (p.finance.cash < price) return result(false, 'You cannot afford the adoption fee.', 'neutral');
  p.finance.cash -= price;
  const pet = addNpc(makePet(p.countryId, p.lastName, rng.int(55, 75)));
  p.stats.mood = clamp(p.stats.mood + 8);
  const text = `You came home from the shelter with a ${pet.species} called ${pet.firstName}.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** What the children cost this year, in local money. */
export function childCosts() {
  const minors = npcsByRole('child').filter((k) => k.age < 18).length;
  return minors * localMoney(CHILD_COST, country());
}

/** Yearly: births. What children go on to do is in npcLives.js. */
export function tickChildren() {
  const p = player();
  if (p.flags.pregnancy && p.age >= p.flags.pregnancy.dueAge) birth();
}

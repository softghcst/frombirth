// Everyone in the player's life: aging, mortality, inheritance, relationship
// decay, and the everyday interactions. Romance is in romance.js and
// children in children.js.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, theCountry } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { store, player, country, livingNpcs, npcsByRole, log } from '../state.js';
import { mortalityChance } from './death.js';
import { remember } from './conditions.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const byGender = (npc, male, female, other) => (npc.gender === 'male' ? male : npc.gender === 'female' ? female : other);

export function roleLabel(npc) {
  if (npc.flags.title) return npc.flags.title;
  switch (npc.role) {
    case 'parent': return byGender(npc, 'Father', 'Mother', 'Parent');
    case 'sibling': {
      const kind = byGender(npc, 'brother', 'sister', 'sibling');
      return npc.flags.twin ? `Twin ${kind}` : kind.charAt(0).toUpperCase() + kind.slice(1);
    }
    case 'grandparent': return byGender(npc, 'Grandfather', 'Grandmother', 'Grandparent');
    case 'child': return byGender(npc, 'Son', 'Daughter', 'Child') + (npc.adopted ? ' (adopted)' : '');
    case 'grandchild': return byGender(npc, 'Grandson', 'Granddaughter', 'Grandchild');
    case 'greatgrandchild': return byGender(npc, 'Great-grandson', 'Great-granddaughter', 'Great-grandchild');
    case 'niece': return byGender(npc, 'Nephew', 'Niece', 'Sibling\'s child');
    case 'inlaw': {
      // Someone who came into the family through a relative's relationship.
      const of = store.state.npcs[npc.flags.partnerOf];
      if (!of) return 'In-law';
      if (npc.flags.former) return `${of.firstName}'s ex`;
      if (!npc.flags.married) return `${of.firstName}'s partner`;
      if (of.role === 'child') return byGender(npc, 'Son-in-law', 'Daughter-in-law', 'Child-in-law');
      if (of.role === 'sibling') return byGender(npc, 'Brother-in-law', 'Sister-in-law', 'Sibling-in-law');
      return `${of.firstName}'s ${byGender(npc, 'husband', 'wife', 'spouse')}`;
    }
    case 'spouse': return byGender(npc, 'Husband', 'Wife', 'Spouse');
    case 'partner': return npc.flags.engaged ? byGender(npc, 'Fiancé', 'Fiancée', 'Betrothed')
      : byGender(npc, 'Boyfriend', 'Girlfriend', 'Partner');
    case 'ex': return npc.flags.wasSpouse ? byGender(npc, 'Ex-husband', 'Ex-wife', 'Ex-spouse') : 'Ex';
    case 'pet': return `Pet ${npc.species}`;
    case 'clinician': return npc.occupation ?? 'Clinician';
    case 'groupmate': return 'From your group';
    default: return npc.role.charAt(0).toUpperCase() + npc.role.slice(1);
  }
}

const DECAY = { mentor: 1, parent: 1, grandparent: 2, sibling: 2, friend: 4, classmate: 5, coworker: 4, partner: 3,
  spouse: 2, child: 2, grandchild: 2, greatgrandchild: 2, niece: 3, relative: 3, inlaw: 2, pet: 1, enemy: 0, ex: 0, boss: 2, cellmate: 3, clinician: 0, groupmate: 2 };

export const removeNpc = (npc) => {
  const p = player();
  p.npcIds = p.npcIds.filter((id) => id !== npc.id);
  delete store.state.npcs[npc.id];
};

/** A parent's estate goes to the other parent if living, otherwise to the children. */
function inheritFrom(npc) {
  const p = player();
  const c = country();
  if (npc.role !== 'parent' || !npc.savings) return;
  const other = npcsByRole('parent').find((n) => n.id !== npc.id);
  if (other) { other.savings = (other.savings ?? 0) + npc.savings; return; }
  if (npc.meters.relationship < 15) {
    log(`${npc.firstName} left you out of the will.`, 'system', 'bad');
    return;
  }
  const heirs = npcsByRole('sibling').length + 1;
  const gross = Math.round(npc.savings / heirs);
  // An estate is taxed where the person who died lived.
  const where = typeof npc.flags.abroad === 'string' && COUNTRIES[npc.flags.abroad] ? COUNTRIES[npc.flags.abroad] : c;
  const tax = Math.round(gross * where.estateTax);
  p.finance.cash += gross - tax;
  log(`You inherited ${fmtMoney(gross - tax, c)} from ${npc.firstName}'s estate${tax ? ` after ${fmtMoney(tax, c)} in estate tax${where !== c ? ` in ${theCountry(where.name)}` : ''}` : ''}${heirs > 1 ? `, split ${heirs} ways` : ''}.`, 'system', 'good');
}

export function tickRelationships() {
  const p = player();
  for (const npc of livingNpcs()) {
    npc.age += 1;

    // Mortality. People who matter to a storyline (tagged contacts) and young
    // children are spared random deaths, so later scenes can still find them.
    const spared = (npc.flags.tag && npc.age < 70) || (['child', 'grandchild', 'greatgrandchild', 'niece'].includes(npc.role) && npc.age < 40);
    const dies = npc.role === 'pet'
      ? npc.age >= npc.lifespan || rng.chance(0.01)
      : !spared && rng.chance(mortalityChance(npc.age, npc.meters.health));
    if (dies) {
      npc.alive = false;
      const who = `${roleLabel(npc).toLowerCase()} ${npc.firstName}`;
      log(`Your ${who} died at age ${npc.age}.`, 'system', 'bad');
      p.stats.mood = clamp(p.stats.mood - Math.round(8 + npc.meters.relationship / 5));
      inheritFrom(npc);
      continue;
    }
    if (npc.role !== 'pet' && npc.age > 60) {
      npc.meters.health = clamp(npc.meters.health - rng.int(0, 3));
    }

    // Decay: closeness fades unless you put time in. People you live with are spared.
    const neglected = npc.lastInteractionAge < p.age - 1;
    const away = npc.role === 'parent' && npc.gender === 'male' && p.flags.parentsStatus === 'separated';
    const family = npc.role === 'parent' || npc.role === 'sibling';
    const atHome = (p.flags.livesWithParents && !away && family)
      || npc.role === 'pet' || npc.role === 'spouse' || (npc.role === 'child' && npc.age < 18);
    if (neglected && !atHome) {
      npc.meters.relationship = clamp(npc.meters.relationship - (DECAY[npc.role] ?? 2) - (npc.flags.abroad ? 2 : 0));
    }
    if ((npc.role === 'friend' || npc.role === 'classmate') && npc.meters.relationship < 10 && !npc.flags.tag) {
      log(`You and ${npc.firstName} drifted apart.`);
      removeNpc(npc);
    }
  }
}

// ---------- Everyday interactions ----------

const GIVERS = ['parent', 'grandparent', 'sibling', 'spouse', 'partner', 'friend', 'child', 'grandchild'];

/** Gift tiers, in base units. */
export const GIFTS = [
  { id: 'small', name: 'Something small', cost: 30, gain: [3, 6] },
  { id: 'nice', name: 'Something thoughtful', cost: 250, gain: [7, 12] },
  { id: 'lavish', name: 'Something lavish', cost: 2500, gain: [13, 20] },
];

/**
 * The everyday things the player can do with this person right now.
 * @returns {{id:string, label:string, danger?:boolean}[]}
 */
export function basicActions(npc) {
  const p = player();
  const a = [];
  if (p.age >= 3) a.push({ id: 'spendTime', label: npc.role === 'pet' ? 'Play together' : 'Spend time' });
  if (npc.role === 'pet') { if (p.age >= 4) a.push({ id: 'treat', label: 'Give a treat' }); return a; }
  // A clinician is a professional relationship: care happens in My Health, not over coffee.
  if (npc.role === 'clinician') return [];
  if (p.age >= 4 && npc.age >= 2) a.push({ id: 'talk', label: 'Have a conversation' });
  if (p.age >= 5 && npc.age >= 3) a.push({ id: 'compliment', label: 'Compliment' });
  if (p.age >= 6) a.push({ id: 'gift', label: 'Give a gift' });
  if (p.age >= 8 && GIVERS.includes(npc.role) && npc.age >= 18) a.push({ id: 'askMoney', label: 'Ask for money' });
  if (npc.role === 'enemy' || npc.role === 'ex') a.push({ id: 'makePeace', label: 'Try to make peace' });
  if (p.age >= 6 && npc.age >= 5) {
    a.push({ id: 'argue', label: 'Argue', danger: true }, { id: 'insult', label: 'Insult', danger: true });
  }
  return a;
}

/** One use of each action per person per year. Marks it used when allowed. */
export function spendAction(npc, action) {
  const p = player();
  npc.flags.acts ??= {};
  if (npc.flags.acts[action] === p.age) return false;
  npc.flags.acts[action] = p.age;
  npc.lastInteractionAge = p.age;
  return true;
}

const bump = (npc, d) => { npc.meters.relationship = clamp(npc.meters.relationship + d); };

/** A friendship that hits the floor turns into something worse. */
function sour(npc) {
  if (['friend', 'classmate', 'coworker'].includes(npc.role) && npc.meters.relationship < 12) {
    npc.role = 'enemy';
    return ` ${npc.firstName} is not your friend any more.`;
  }
  return '';
}

/**
 * @param {string} npcId
 * @param {string} action  one of basicActions()
 * @param {string} [option]  gift tier id
 * @returns {{ok:boolean, text:string, tone:string}}
 */
export function interact(npcId, action, option) {
  const p = player();
  const c = country();
  const npc = store.state.npcs[npcId];
  if (!npc?.alive) return result(false, 'They are gone.');
  if (action === 'gift') {
    const gift = GIFTS.find((g) => g.id === option);
    if (p.finance.cash < localMoney(gift.cost, c)) return result(false, 'You cannot afford that.', 'neutral');
  }
  if (!spendAction(npc, action)) return result(false, `You already did that with ${npc.firstName} this year.`, 'neutral');
  const name = npc.firstName;
  let text; let tone = 'good';

  switch (action) {
    case 'spendTime': {
      bump(npc, rng.int(3, 9));
      p.stats.mood = clamp(p.stats.mood + rng.int(1, 4));
      text = npc.role === 'pet' ? `You spent the afternoon with ${name}. Tail-level approval.` : `You spent time with ${name}.`;
      break;
    }
    case 'treat':
      bump(npc, rng.int(4, 8));
      npc.meters.health = clamp(npc.meters.health - 1);
      text = `${name} inhaled the treat and looked at you as if there might be another.`;
      break;
    case 'talk': {
      const went = rng.chance(0.35 + (p.stats.charm + npc.meters.relationship) / 200 * 0.6);
      bump(npc, went ? rng.int(2, 7) : -rng.int(1, 5));
      tone = went ? 'good' : 'bad';
      text = went ? `You and ${name} had a good talk.` : `Your conversation with ${name} turned awkward.`;
      break;
    }
    case 'compliment': {
      const went = rng.chance(0.45 + (p.stats.charm - 50) / 120);
      bump(npc, went ? rng.int(3, 7) : -2);
      tone = went ? 'good' : 'neutral';
      text = went ? `You paid ${name} a compliment and watched it land.` : `Your compliment came out wrong. ${name} is still working out what you meant.`;
      break;
    }
    case 'gift': {
      const gift = GIFTS.find((g) => g.id === option);
      const cost = localMoney(gift.cost, c);
      p.finance.cash -= cost;
      const liked = rng.chance(0.85);
      bump(npc, liked ? rng.int(gift.gain[0], gift.gain[1]) : 1);
      p.hidden.karma = clamp(p.hidden.karma + 1);
      if (gift.id === 'lavish' && liked) remember(npc, 'lavishGift', 'You once gave them a gift they still talk about.');
      tone = liked ? 'good' : 'neutral';
      text = liked ? `You spent ${fmtMoney(cost, c)} on a gift for ${name}. They loved it.`
        : `You spent ${fmtMoney(cost, c)} on a gift for ${name}. They said thank you twice, which is never a good sign.`;
      break;
    }
    case 'askMoney': {
      const m = npc.meters;
      const chance = clamp((m.generosity * 0.5 + m.relationship * 0.4 + m.money * 0.2 - 35) / 100, 0.03, 0.9);
      if (rng.chance(chance)) {
        const scale = npc.role === 'parent' || npc.role === 'grandparent' ? 25 : npc.role === 'spouse' ? 20 : 8;
        let amount = localMoney(Math.max(20, m.money * scale * (0.4 + rng.next())) * (p.age < 16 ? 0.05 : 1), c);
        if (npc.life) { // people with lives of their own give from their own savings
          amount = Math.min(amount, Math.max(localMoney(20, c), Math.round(npc.life.savings * 0.15)));
          npc.life.savings -= amount;
        }
        p.finance.cash += amount;
        bump(npc, -3);
        text = `${name} gave you ${fmtMoney(amount, c)}.`;
      } else {
        bump(npc, -5);
        tone = 'bad';
        text = `${name} said no, and looked at you a little differently for asking.`;
      }
      break;
    }
    case 'makePeace': {
      const went = rng.chance(clamp(0.3 + (p.stats.charm - 50) / 150 + (p.hidden.karma - 50) / 200, 0.05, 0.85));
      if (went && npc.role === 'enemy') {
        npc.role = 'friend';
        npc.meters.relationship = Math.max(40, npc.meters.relationship);
        remember(npc, 'madePeace', 'You were enemies once, until you made the first move.');
        text = `It took some swallowing of pride, but you and ${name} have buried it. You are friends.`;
      } else if (went) {
        bump(npc, 18);
        text = `You and ${name} managed a civil conversation. It is a start.`;
      } else {
        bump(npc, -3);
        tone = 'bad';
        text = `${name} was not ready to hear it.`;
      }
      break;
    }
    case 'argue':
      bump(npc, -rng.int(5, 14));
      p.stats.mood = clamp(p.stats.mood - 3);
      tone = 'bad';
      text = `You and ${name} had a blazing row.${sour(npc)}`;
      break;
    case 'insult':
      bump(npc, -rng.int(10, 22));
      p.hidden.karma = clamp(p.hidden.karma - 3);
      tone = 'bad';
      text = `You told ${name} exactly what you think of them.${sour(npc)}`;
      break;
    default:
      return result(false, 'You cannot do that.');
  }
  log(text, 'system', tone);
  return { ok: tone !== 'bad', text, tone };
}

// ---------- Pets ----------

export const PET_PRICE = 150;
export const canGetPet = () => player().age >= 18 && npcsByRole('pet').length < 3;

/** The numbers that can be edited on anyone but the player. */
export const EDITABLE_METERS = [['relationship', 'Relationship'], ['health', 'Health'], ['intellect', 'Intellect'], ['charm', 'Charm'],
  ['money', 'Money'], ['generosity', 'Generosity'], ['crazy', 'Crazy']];
export const EDITABLE_TALENTS = [['music', 'Music'], ['singing', 'Singing'], ['dance', 'Dance'], ['acting', 'Acting'], ['sports', 'Sports'], ['crime', 'Mischief']];

/**
 * Sets someone's stats and talents directly. Open to the player for anyone
 * in their life: a spouse, a child, a friend, a pet.
 * @param {string} npcId
 * @param {{meters?:Object<string,number>, talents?:Object<string,number>}} values  each 0–100
 */
export function editNpc(npcId, values) {
  const npc = store.state.npcs[npcId];
  if (!npc) return { ok: false, text: 'There is nobody to change.', tone: 'neutral' };
  for (const [k, v] of Object.entries(values.meters ?? {})) if (k in npc.meters) npc.meters[k] = Math.round(clamp(Number(v)));
  if (values.talents && npc.role !== 'pet') {
    npc.talents ??= {};
    for (const [k, v] of Object.entries(values.talents)) npc.talents[k] = Math.round(clamp(Number(v)));
  }
  if (npc.wealth != null) npc.wealth = npc.meters.money;
  if (npc.stats) Object.assign(npc.stats, { health: npc.meters.health, intellect: npc.meters.intellect, charm: npc.meters.charm });
  const text = `You changed ${npc.firstName}'s stats.`;
  return { ok: true, text, tone: 'neutral' };
}

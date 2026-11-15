// Builds the family a life starts in, and runs the family's yearly business:
// pocket money and new siblings.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, localWage } from '../util.js';
import { store, player, country, npcsByRole, livingNpcs, log } from '../state.js';
import { makeNpc, makePet } from './npcFactory.js';
import { inheritAppearance, unknownParent } from './genetics.js';
import { skinDepth } from '../avatar/catalog.js';

/**
 * @param {object} c  country record
 * @param {string} lastName
 * @param {{background?:string, skinHint?:number, avoidNames?:string[]}} [opts]
 * @returns {{mother:object, father:?object, siblings:object[], grandparents:object[],
 *            pets:object[], status:'together'|'separated'|'single', twin:?object}}
 */
export function generateFamily(c, lastName, opts = {}) {
  const status = rng.weighted(['together', 'separated', 'single'],
    (s) => ({ together: 78, separated: 14, single: 8 })[s]);
  const common = { countryId: c.id, background: opts.background };
  const used = new Set(opts.avoidNames ?? []);
  /** makeNpc, but nobody in the family shares a first name. */
  const member = (o) => {
    const pool = (c.names[o.gender] ?? [...c.names.male, ...c.names.female]).filter((n) => !used.has(n));
    const npc = makeNpc({ ...o, firstName: pool.length ? rng.pick(pool) : undefined });
    used.add(npc.firstName);
    return npc;
  };

  // Better-off backgrounds mean established careers, so older parents.
  const youngest = { wealthy: 30, comfortable: 24 }[opts.background] ?? 19;
  const mother = member({ ...common, role: 'parent', gender: 'female', lastName,
    age: rng.int(youngest, 40), relationship: rng.int(65, 100), skinHint: opts.skinHint });
  const father = status === 'single' ? null : member({ ...common, role: 'parent', gender: 'male', lastName,
    age: Math.max(youngest, mother.age + rng.int(-3, 8)), skinHint: opts.skinHint ?? skinDepth(mother.appearance),
    relationship: status === 'separated' ? rng.int(25, 70) : rng.int(55, 100) });
  const genes = father ?? unknownParent(mother);

  const kid = (age, extra = {}) => member({ role: 'sibling', countryId: c.id, lastName, age,
    gender: rng.pick(['male', 'female']), relationship: rng.int(40, 90),
    appearance: inheritAppearance(mother, genes), ...extra });

  // Older siblings: each a different age, none born before the mother was 18.
  const siblings = [];
  const ages = [];
  for (let a = 1; a <= Math.min(14, mother.age - 18); a++) ages.push(a);
  const count = Math.min(ages.length, rng.weighted([0, 1, 2, 3], (n) => [35, 38, 20, 7][n]));
  for (let i = 0; i < count; i++) {
    siblings.push(kid(ages.splice(rng.int(0, ages.length - 1), 1)[0]));
  }
  siblings.sort((a, b) => b.age - a.age);
  const twin = rng.chance(0.025) ? kid(0, { relationship: rng.int(70, 100) }) : null;
  if (twin) { twin.flags.twin = true; siblings.push(twin); }

  // Grandparents: each one may or may not still be around.
  const grandparents = [];
  for (const [parent, side] of [[mother, 'maternal'], [father, 'paternal']]) {
    if (!parent) continue;
    const surname = side === 'paternal' ? lastName : rng.pick(c.names.last);
    for (const gender of ['female', 'male']) {
      const age = parent.age + rng.int(21, 35);
      if (age > 88 || !rng.chance(clamp(1.35 - age / 70, 0.05, 0.95))) continue;
      const g = member({ role: 'grandparent', countryId: c.id, gender, lastName: surname, age,
        relationship: rng.int(45, 90), skinHint: skinDepth(parent.appearance) });
      g.flags.side = side;
      grandparents.push(g);
    }
  }

  const pets = [];
  if (rng.chance(0.38)) pets.push(makePet(c.id, lastName));
  if (pets.length && rng.chance(0.2)) pets.push(makePet(c.id, lastName));

  return { mother, father, siblings, grandparents, pets, status, twin };
}

/** Yearly family step. Runs after everyone has aged. */
export function tickFamily() {
  const p = player();
  const c = country();
  const parents = npcsByRole('parent');
  if (!p.flags.livesWithParents) return;

  // Pocket money, sized by what the parents have and how freely they give.
  if (p.age >= 6 && p.age <= 17 && parents.length) {
    const share = parents.reduce((s, n) => s + (n.wealth / 100) * (n.meters.generosity / 100), 0) / parents.length;
    const amount = localWage(share * (p.age < 12 ? 500 : 1500), c);
    if (amount > 0) {
      p.finance.cash += amount;
      if (!p.flags.gotPocketMoney) {
        p.flags.gotPocketMoney = true;
        log(`Your parents started giving you pocket money: ${fmtMoney(amount, c)} this year.`, 'system', 'good');
      }
    }
  }

  // A new baby in the house.
  const mother = parents.find((n) => n.gender === 'female');
  const father = parents.find((n) => n.gender === 'male');
  const siblings = npcsByRole('sibling').length;
  if (mother && father && p.flags.parentsStatus === 'together'
      && mother.age <= 42 && p.age <= 14 && siblings < 4 && rng.chance(0.07)) {
    const taken = new Set([p.firstName, ...livingNpcs().map((n) => n.firstName)]);
    const gender = rng.pick(['male', 'female']);
    const free = c.names[gender].filter((n) => !taken.has(n));
    const baby = makeNpc({ role: 'sibling', countryId: p.countryId, lastName: p.lastName, age: 0, gender,
      firstName: free.length ? rng.pick(free) : undefined,
      relationship: rng.int(55, 85), appearance: inheritAppearance(mother, father) });
    store.state.npcs[baby.id] = baby;
    p.npcIds.push(baby.id);
    const kind = baby.gender === 'male' ? 'brother' : 'sister';
    log(`Your mother gave birth to a baby ${kind}, ${baby.firstName}.`, 'system', 'good');
    p.stats.mood = clamp(p.stats.mood + (p.age < 6 ? -4 : 4));
  }
}

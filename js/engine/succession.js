// The line of succession, worked out from a family tree and a country's law.
// Pure functions with no imports, so the rules can be tested on their own
// (tests/succession.mjs).
//
// A person (see engine/dynasty.js for the full record):
//   { id, gender, born, died, parents: [id, …], blood, adopted, out, outYear }
//     blood    descends from the house (people who married in are not)
//     adopted  legally the child of their parents, not by birth
//     out      'renounced' | 'removed' | 'left' | null: has no place in the line
//     abdicated  the year they gave up the throne; they do not come back into the line
// A law:
//   { order: 'absolute' | 'malePreference' | 'maleOnly',
//     adoption: bool            adopted children can inherit
//     renounceCoversHeirs: bool descendants born after a renunciation are out too }
//   'maleOnly' is agnatic: only men, and only through fathers.

const alive = (p) => p && p.died == null;

/** The parent through whom someone belongs to the house. */
export function bloodParent(people, p) {
  return (p.parents ?? []).map((id) => people[id]).find((x) => x?.blood) ?? null;
}

/** Children of a person, eldest first. */
export function childrenOf(people, id) {
  return Object.values(people).filter((p) => p.parents?.includes(id)).sort((a, b) => a.born - b.born || (a.id < b.id ? -1 : 1));
}

/**
 * Why someone cannot inherit, or '' if they can. Does not look at whether
 * they are alive: the dead keep their branch's place for their descendants.
 */
export function barred(people, p, law) {
  if (!p.blood) return 'married into the family';
  if (p.adopted && !law.adoption) return 'adopted, and the law passes the throne by birth';
  if (law.order === 'maleOnly' && p.gender !== 'male') return 'only men inherit the throne';
  if (law.order === 'maleOnly') {
    const via = bloodParent(people, p);
    if (via && via.gender !== 'male') return 'the throne passes only through fathers';
  }
  if (p.abdicated) return `gave up the throne in ${p.abdicated}`;
  if (p.out === 'renounced') return `gave up their place${p.outYear ? ` in ${p.outYear}` : ''}`;
  if (p.out === 'removed') return `removed from the succession${p.outYear ? ` in ${p.outYear}` : ''}`;
  if (p.out === 'left') return 'left the royal family on marrying';
  return '';
}

/** Whether a branch can pass the throne on through this person at all. */
function carries(people, p, law) {
  if (!p.blood) return false;
  if (p.adopted && !law.adoption) return false;
  if (law.order === 'maleOnly' && p.gender !== 'male') return false;
  if (p.out === 'left') return false;
  return true;
}

/** Children in the order the law takes them. */
function inOrder(kids, law) {
  if (law.order !== 'malePreference') return kids;
  return [...kids.filter((k) => k.gender === 'male'), ...kids.filter((k) => k.gender !== 'male')];
}

/** Everyone's children, eldest first, looked up by parent. Built once per calculation. */
function childIndex(people) {
  const index = {};
  for (const p of Object.values(people)) for (const id of p.parents ?? []) (index[id] ??= []).push(p);
  for (const list of Object.values(index)) list.sort((a, b) => a.born - b.born || (a.id < b.id ? -1 : 1));
  return index;
}

/** Everyone descended from `root` who can inherit, in order. `seen` stops anyone being counted twice. */
function descend(people, root, law, seen, out, index) {
  for (const kid of inOrder(index[root.id] ?? [], law)) {
    if (seen.has(kid.id)) continue;
    seen.add(kid.id);
    if (!carries(people, kid, law)) continue;
    // A renunciation takes the person out; whether it takes their later children depends on the law.
    const parentOut = root.out === 'renounced' || root.out === 'removed';
    if (parentOut && law.renounceCoversHeirs && root.outYear != null && kid.born >= root.outYear) continue;
    if (alive(kid) && !barred(people, kid, law)) out.push(kid.id);
    descend(people, kid, law, seen, out, index);
  }
}

/**
 * The line of succession: ids of the living people who would inherit, first
 * to last. The monarch's own descendants come first, then the descendants of
 * the monarch's parent, grandparent and so on up the house.
 * @param {Object<string, object>} people
 * @param {string} monarchId
 * @param {{order:string, adoption?:boolean, renounceCoversHeirs?:boolean}} law
 * @returns {string[]}
 */
export function lineOfSuccession(people, monarchId, law) {
  const monarch = people[monarchId];
  if (!monarch) return [];
  const seen = new Set([monarchId]);
  const out = [];
  const index = childIndex(people);
  descend(people, monarch, law, seen, out, index);
  let at = monarch;
  for (let up = 0; up < 12; up++) {
    const parent = bloodParent(people, at);
    if (!parent || seen.has(`up:${parent.id}`)) break;
    seen.add(`up:${parent.id}`);
    // A former monarch who is still alive (after an abdication) does not come back into the line.
    seen.add(parent.id);
    descend(people, parent, law, seen, out, index);
    at = parent;
  }
  return out;
}

/** Who takes the throne if the monarch goes now, or null if the line is empty. */
export const successor = (people, monarchId, law) => lineOfSuccession(people, monarchId, law)[0] ?? null;

const ORD = ['', 'eldest', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
const kin = (p, male, female, other) => (p.gender === 'male' ? male : p.gender === 'female' ? female : other);

/**
 * How someone is related to the monarch, in plain words: "eldest child",
 * "granddaughter", "brother", "niece", "cousin".
 */
export function relationTo(people, monarchId, id) {
  const p = people[id];
  const up = (x) => { const chain = []; let at = x; for (let i = 0; i < 12 && at; i++) { chain.push(at.id); at = bloodParent(people, at); } return chain; };
  const mine = up(p);
  const theirs = up(people[monarchId]);
  const common = mine.find((x) => theirs.includes(x));
  if (!common) return 'relative';
  const a = mine.indexOf(common); // generations from p up to the shared ancestor
  const b = theirs.indexOf(common); // generations from the monarch up to it
  if (b === 0) {
    if (a === 1) {
      const sibs = childrenOf(people, monarchId);
      const n = sibs.findIndex((s) => s.id === id) + 1;
      return `${sibs.length > 1 && ORD[n] ? `${ORD[n]} ` : ''}${kin(p, 'son', 'daughter', 'child')}`;
    }
    if (a === 2) return kin(p, 'grandson', 'granddaughter', 'grandchild');
    return `${'great-'.repeat(a - 2)}${kin(p, 'grandson', 'granddaughter', 'grandchild')}`;
  }
  if (a === 0) return b === 1 ? kin(p, 'father', 'mother', 'parent') : `${'great-'.repeat(Math.max(0, b - 2))}${kin(p, 'grandfather', 'grandmother', 'grandparent')}`;
  if (b === 1 && a === 1) return kin(p, 'brother', 'sister', 'sibling');
  if (b === 1 && a === 2) return kin(p, 'nephew', 'niece', 'sibling\'s child');
  if (b === 1 && a >= 3) return `${'great-'.repeat(a - 2)}${kin(p, 'nephew', 'niece', 'sibling\'s grandchild')}`;
  if (b === 2 && a === 1) return kin(p, 'uncle', 'aunt', 'parent\'s sibling');
  if (b >= 3 && a === 1) return `${'great-'.repeat(b - 2)}${kin(p, 'uncle', 'aunt', 'grandparent\'s sibling')}`;
  return a === b ? (a === 2 ? 'cousin' : 'distant cousin') : 'cousin, once or more removed';
}

/**
 * Checks a house for things that must never be true. Returns a list of
 * problems (empty when sound). Used by tests and after long simulations.
 */
export function audit(people, monarchId) {
  const problems = [];
  const list = Object.values(people);
  for (const p of list) {
    for (const pid of p.parents ?? []) {
      const par = people[pid];
      if (!par) { problems.push(`${p.id} has a parent that does not exist`); continue; }
      if (par.born >= p.born) problems.push(`${p.id} was born before their parent ${pid}`);
    }
    if ((p.parents ?? []).length > 2) problems.push(`${p.id} has more than two parents`);
    if (p.spouseId) {
      const s = people[p.spouseId];
      if (!s) problems.push(`${p.id} is married to someone who does not exist`);
      else if (s.spouseId !== p.id && s.died == null && p.died == null) problems.push(`${p.id} and ${s.id} disagree about being married`);
      if (p.parents?.includes(p.spouseId)) problems.push(`${p.id} is married to their own parent`);
    }
    if (p.died != null && p.died < p.born) problems.push(`${p.id} died before being born`);
    // No one is their own ancestor.
    const seen = new Set();
    const stack = [...(p.parents ?? [])];
    while (stack.length) {
      const id = stack.pop();
      if (id === p.id) { problems.push(`${p.id} is their own ancestor`); break; }
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(people[id]?.parents ?? []));
    }
  }
  if (monarchId) {
    const m = people[monarchId];
    if (!m) problems.push('the monarch does not exist');
    else if (m.died != null) problems.push('the monarch is dead');
    else if (!m.blood) problems.push('the monarch is not of the house');
  }
  return problems;
}

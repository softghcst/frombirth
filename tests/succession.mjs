// The rules of succession, checked on small hand-built families.
// Run with: node tests/succession.mjs
import { lineOfSuccession, successor, barred, relationTo, audit } from '../js/engine/succession.js';

let failed = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failed += 1; console.log(`FAIL ${name}\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`); } else console.log(`ok   ${name}`);
};

const ABS = { order: 'absolute' };
const PREF = { order: 'malePreference' };
const MALE = { order: 'maleOnly' };

/** Builds a family from rows: [id, gender, born, parents, extra]. Everyone is of the blood unless told otherwise. */
function family(rows) {
  const people = {};
  for (const [id, gender, born, parents = [], extra = {}] of rows) people[id] = { id, gender, born, died: null, parents, blood: true, ...extra };
  return people;
}

// King Edward; children Amelia (f, eldest), Henry (m), Clara (f). Amelia has Rose (f) and Leo (m); Henry has Max (m).
const base = () => family([
  ['edward', 'male', 1950, [], { spouseId: 'queen' }], ['queen', 'female', 1952, [], { blood: false, spouseId: 'edward' }],
  ['amelia', 'female', 1975, ['edward', 'queen']], ['henry', 'male', 1978, ['edward', 'queen']], ['clara', 'female', 1982, ['edward', 'queen']],
  ['rose', 'female', 2000, ['amelia']], ['leo', 'male', 2003, ['amelia']], ['max', 'male', 2005, ['henry']],
]);

eq('absolute: first child and her line come first', lineOfSuccession(base(), 'edward', ABS), ['amelia', 'rose', 'leo', 'henry', 'max', 'clara']);
eq('male preference: sons before daughters at each step', lineOfSuccession(base(), 'edward', PREF), ['henry', 'max', 'amelia', 'leo', 'rose', 'clara']);
eq('male only: men, through fathers', lineOfSuccession(base(), 'edward', MALE), ['henry', 'max']);

{ // A new baby enters after its parent, ahead of the parent's younger siblings.
  const p = base();
  p.baby = { id: 'baby', gender: 'female', born: 2026, died: null, parents: ['amelia'], blood: true };
  eq('a new baby joins behind its parent and ahead of uncles', lineOfSuccession(p, 'edward', ABS), ['amelia', 'rose', 'leo', 'baby', 'henry', 'max', 'clara']);
}
{ // The heir dies: her descendants keep the branch's place.
  const p = base(); p.amelia.died = 2020;
  eq('descendants keep their branch when the heir dies', lineOfSuccession(p, 'edward', ABS), ['rose', 'leo', 'henry', 'max', 'clara']);
}
{ // The heir dies with no descendants: the next sibling moves up.
  const p = base(); delete p.rose; delete p.leo; p.amelia.died = 2020;
  eq('a younger sibling inherits when the senior branch is empty', lineOfSuccession(p, 'edward', ABS), ['henry', 'max', 'clara']);
}
{ // Changing the law changes the order.
  const p = base();
  eq('a change of law reorders the line', [successor(p, 'edward', PREF), successor(p, 'edward', ABS)], ['henry', 'amelia']);
}
{ // Renunciation: the person is out; children already born stay unless the law says otherwise.
  const p = base(); p.amelia.out = 'renounced'; p.amelia.outYear = 2010;
  eq('renouncing removes the person, not children already born', lineOfSuccession(p, 'edward', ABS), ['rose', 'leo', 'henry', 'max', 'clara']);
  p.late = { id: 'late', gender: 'male', born: 2015, died: null, parents: ['amelia'], blood: true };
  eq('children born after stay in, where the law allows', lineOfSuccession(p, 'edward', ABS), ['rose', 'leo', 'late', 'henry', 'max', 'clara']);
  eq('children born after are out, where the law says so', lineOfSuccession(p, 'edward', { order: 'absolute', renounceCoversHeirs: true }), ['rose', 'leo', 'henry', 'max', 'clara']);
}
{ // Adoption follows the law.
  const p = base(); p.adoptee = { id: 'adoptee', gender: 'male', born: 1970, died: null, parents: ['edward', 'queen'], blood: true, adopted: true };
  eq('an adopted child is out where the throne passes by birth', lineOfSuccession(p, 'edward', ABS).includes('adoptee'), false);
  eq('an adopted child is in where the law allows, by age', lineOfSuccession(p, 'edward', { order: 'absolute', adoption: true })[0], 'adoptee');
  eq('and the reason is given', barred(p, p.adoptee, ABS), 'adopted, and the law passes the throne by birth');
}
{ // A spouse never inherits by marriage.
  const p = base();
  p.consort = { id: 'consort', gender: 'male', born: 1974, died: null, parents: [], blood: false, spouseId: 'amelia' }; p.amelia.spouseId = 'consort';
  eq('a spouse is never in the line', [lineOfSuccession(p, 'edward', ABS).includes('consort'), lineOfSuccession(p, 'edward', ABS).includes('queen')], [false, false]);
  eq('and is told why', barred(p, p.consort, ABS), 'married into the family');
}
{ // Abdication: the successor is the first in line, and the old monarch does not return to it.
  const p = base();
  const next = successor(p, 'edward', ABS);
  eq('abdication hands the throne to the first in line', next, 'amelia');
  eq('a living former monarch is not in the new line', lineOfSuccession(p, 'amelia', ABS), ['rose', 'leo', 'henry', 'max', 'clara']);
}
{ // A monarch with no children abdicates in favor of a cousin, and stays out of the line.
  const p = family([['old', 'male', 1900, [], { died: 1970 }], ['a', 'female', 1930, ['old'], { abdicated: 1990 }], ['b', 'male', 1933, ['old'], { died: 1985 }], ['c', 'male', 1960, ['b']], ['d', 'female', 1990, ['c']]]);
  eq('someone who abdicated never returns to the line', lineOfSuccession(p, 'c', ABS), ['d']);
}
{ // One throne, one monarch: the monarch is never in their own line.
  const p = base();
  eq('the monarch is not their own heir', lineOfSuccession(p, 'edward', ABS).includes('edward'), false);
  eq('nobody appears twice', new Set(lineOfSuccession(p, 'edward', ABS)).size, lineOfSuccession(p, 'edward', ABS).length);
}
{ // An extinct line.
  const p = family([['last', 'female', 1960]]);
  eq('an empty line has no successor', successor(p, 'last', ABS), null);
}
{ // Collateral lines: a childless monarch is followed by siblings, then uncles and cousins.
  const p = family([
    ['old', 'male', 1900, [], { died: 1970 }],
    ['elder', 'male', 1925, ['old'], { died: 1990 }], ['uncle', 'male', 1930, ['old']],
    ['king', 'male', 1950, ['elder']], ['sister', 'female', 1953, ['elder']],
    ['cousin', 'female', 1955, ['uncle']],
  ]);
  eq('siblings, then uncles and cousins', lineOfSuccession(p, 'king', ABS), ['sister', 'uncle', 'cousin']);
  eq('relations are named', ['sister', 'uncle', 'cousin'].map((id) => relationTo(p, 'king', id)), ['sister', 'uncle', 'cousin']);
}
{ // A princess who leaves the family takes her branch with her.
  const p = base(); p.amelia.out = 'left';
  eq('leaving the family takes the branch out', lineOfSuccession(p, 'edward', ABS), ['henry', 'max', 'clara']);
}
eq('relations to the monarch', ['amelia', 'henry', 'rose', 'max'].map((id) => relationTo(base(), 'edward', id)), ['eldest daughter', 'second son', 'granddaughter', 'grandson']);
eq('a sound family passes the audit', audit(base(), 'edward'), []);
{
  const p = base(); p.edward.parents = ['rose'];
  eq('the audit catches someone who is their own ancestor', audit(p, 'edward').some((x) => /own ancestor/.test(x)), true);
  const q = base(); q.edward.died = 2020;
  eq('the audit catches a dead monarch', audit(q, 'edward'), ['the monarch is dead']);
}

console.log(failed ? `${failed} failed.` : 'The rules of succession hold.');
process.exit(failed ? 1 : 0);

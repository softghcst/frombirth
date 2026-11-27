// Who is invited to the player's wedding, and who comes. Guests are the people in the player's life (and the
// partner's family the player knows): parents, step-parents, guardians, brothers and sisters of every kind,
// grandparents, children, friends, old roommates, colleagues. The size of the wedding sets how many are asked;
// the closest are asked first. Whether each comes depends on them: alive, free to travel, close enough to want to,
// and near enough to make it. Nobody is invented to fill a seat. Kept on the spouse: flags.wedding.guestList =
// { invited:[ids], came:[ids], couldNot:[{ id, why }] }.
import { store, player } from '../state.js';
import { remember } from './conditions.js';
import { keyedDice } from './keyedDice.js';

const npc = (id) => store.state.npcs[id] ?? null;

/** Who is asked first: family, then those closest. */
const ORDER = ['child', 'parent', 'stepparent', 'guardian', 'sibling', 'stepsibling', 'grandparent', 'ward', 'grandchild', 'niece', 'relative', 'inlaw', 'friend', 'roommate', 'mentor', 'coworker', 'boss', 'neighbor', 'classmate', 'teammate'];
const rank = (n) => { const i = ORDER.indexOf(n.role); return i < 0 ? ORDER.length : i; };

/** The guest list for a wedding of this many people (two of them are the couple). */
export function guestList(partner, count = 40) {
  const p = player();
  const seats = Math.max(0, count - 2);
  if (!seats) return [];
  const people = p.npcIds.map(npc).filter((n) => n && n.alive && n.id !== partner.id && n.role !== 'pet' && n.role !== 'ex' && n.role !== 'enemy'
    && (ORDER.includes(n.role) || n.flags?.title === 'Former roommate') && (n.meters.relationship >= 30 || ['parent', 'child', 'sibling'].includes(n.role)));
  // The partner's own family, where the player knows them (engine/together.js meetFamily, in-laws).
  return people.sort((a, b) => rank(a) - rank(b) || b.meters.relationship - a.meters.relationship).slice(0, seats).map((n) => n.id);
}

/** Why someone could not come, or '' if they come. */
function absence(n, d, here) {
  if (!n?.alive) return 'had died';
  if (n.flags.inmate && !n.flags.inmate.released) return 'was in prison';
  if (n.flags.serving) return 'was serving a sentence';
  if (n.age < 4 && n.role !== 'child') return 'was too little to travel';
  const far = n.flags.abroad || (n.city && here && n.city !== here);
  const want = 0.55 + (n.meters.relationship - 50) / 100 + (['parent', 'child', 'sibling', 'stepparent', 'grandparent'].includes(n.role) ? 0.25 : 0);
  const can = far ? (n.flags.abroad ? 0.55 : 0.8) : 0.97;
  if (!d.chance(Math.min(0.98, want))) return 'did not come';
  if (!d.chance(can)) return n.flags.abroad ? 'could not travel from abroad' : 'could not make the journey';
  if (n.age >= 85 && d.chance(0.3)) return 'was not well enough to come';
  return '';
}

/** Sends the invitations and settles who came. Once a wedding: kept on the spouse's record. */
export function holdWedding(partner, count) {
  const p = player();
  const w = (partner.flags.wedding ??= { year: store.state.year });
  if (w.guestList) return w.guestList;
  const d = keyedDice(`wedding/${store.state.slotId}/${p.id}/${partner.id}/${store.state.year}`);
  const invited = guestList(partner, count);
  const came = [];
  const couldNot = [];
  for (const id of invited) {
    const n = npc(id);
    const why = absence(n, d, p.city);
    if (why) couldNot.push({ id, why }); else came.push(id);
  }
  w.guestList = { invited, came, couldNot };
  for (const id of came) remember(npc(id), 'cameToWedding', `Was at your wedding to ${partner.firstName}.`);
  return w.guestList;
}

/** "Your mother, your stepfather and 12 friends came. Your brother could not travel from abroad." */
export function guestLine(guests) {
  if (!guests?.invited?.length) return 'Just the two of you.';
  const names = (ids) => ids.map(npc).filter(Boolean);
  const came = names(guests.came);
  const fam = came.filter((n) => rank(n) <= ORDER.indexOf('relative'));
  const others = came.length - fam.length;
  const said = [...fam.slice(0, 4).map((n) => n.firstName), ...(fam.length > 4 ? [`${fam.length - 4} more of the family`] : []), ...(others ? [`${others} friend${others === 1 ? '' : 's'} and colleague${others === 1 ? '' : 's'}`] : [])];
  const missed = guests.couldNot.slice(0, 2).map((x) => `${npc(x.id)?.firstName ?? 'Someone'} ${x.why}`);
  return `${said.length ? `${said.slice(0, -1).join(', ')}${said.length > 1 ? ' and ' : ''}${said.at(-1)} came.` : 'Nobody you invited could come.'}${missed.length ? ` ${missed.join('; ')}.` : ''}`;
}

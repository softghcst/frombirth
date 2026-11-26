// Where the legal career meets the investigations career (engine/investigations): the police who built a criminal case
// are real officers and detectives of the local department, not strangers made up for the case; and a player who
// served as an officer or detective before law carries that past into court, including the people they worked beside.
import { rng } from '../rng.js';
import { store, player } from '../state.js';
import { agencyOf, kindsIn, agency } from './investigations/agencies.js';

const alive = (id) => !!store.state.npcs[id]?.alive;

/** The player's years in law enforcement, if any: { years, detective, agencyName, colleagueIds }. */
export function pastPolicing(p = player()) {
  const r = p.investigator;
  if (!r || !(r.stats?.years > 0 || r.job)) return null;
  const ag = agency(r.job?.agencyId ?? r.stats?.agencies?.at(-1));
  const colleagueIds = [r.people?.partnerId, r.people?.ftoId, r.people?.supervisorId, ...(r.people?.formerPartnerIds ?? []), ...(r.people?.classmateIds ?? [])].filter((id) => id && alive(id));
  return { years: r.stats?.years ?? 0, detective: !!(r.job?.detective || r.stats?.units?.length), agencyName: ag?.name ?? null, colleagueIds: [...new Set(colleagueIds)] };
}

/**
 * A real officer or detective of the local department to stand as a police witness in a criminal case. Someone the
 * player once worked beside turns up now and then. Null where the investigations world has no department here.
 * @returns {{ id:string, known:boolean } | null}
 */
export function policeWitness(countryId, city, detective) {
  const past = pastPolicing();
  if (past?.colleagueIds.length && rng.chance(0.3)) return { id: rng.pick(past.colleagueIds), known: true };
  const kinds = kindsIn(countryId);
  if (!kinds?.length || !city) return null;
  let a;
  try { a = agencyOf(kinds[0], countryId, city); } catch { return null; }
  const me = player().id;
  const pool = detective ? Object.values(a.units ?? {}).flatMap((u) => u.memberIds) : a.officerIds ?? [];
  const ids = pool.filter((id) => id !== me && alive(id));
  return ids.length ? { id: rng.pick(ids), known: false, agency: a.name } : null;
}

// Two shared records that the travel, immigration and family-history systems
// write to, so that every screen reads the same thing:
//
//   p.finance.ledger   every payment and refund they make, once each, with an
//                      id. A booking points at its transaction; paying twice is
//                      refused because the transaction already exists.
//
//   state.canon        canonical life events: one record per thing that
//                      happened (a first trip abroad, a move, a child born
//                      abroad, a naturalisation). Each has a stable id and a
//                      `key` that makes recording it again a no-op. Journals,
//                      the Travel Journal, Places I've Lived and Our Global
//                      Story are views of this list; none keeps its own copy.
//
//   state.archive      people who have left the live save (a player whose life
//                      ended, carried forward when the family continues): their
//                      birth, the places they lived, and their papers. Living
//                      people are read from where they live in the save.
//
// Identity across generations: a person's archive id is their id at first
// sight. The player's is p.archiveId (set when an heir continues: it is the
// id the heir had as a relative), falling back to p.id.
import { store, player } from '../state.js';
import { uid } from '../util.js';

/** The id a person is known by in the family's history. */
export const archiveIdOf = (person) => person?.archiveId ?? person?.flags?.archiveId ?? person?.id ?? null;

// ---------- The ledger ----------

const ledgerOf = (p) => (p.finance.ledger ??= []);

/**
 * Takes money from the player's everyday account and writes it down.
 * Refused (nothing paid) if `key` was already paid: the same booking is never charged twice.
 * @param {{amount:number, kind:string, memo:string, ref?:object, key?:string, payer?:string}} o  amount: positive, local money
 * @returns {{ok:boolean, tx?:object, why?:string}}
 */
export function charge(o, p = player()) {
  const amount = Math.round(o.amount);
  if (!(amount >= 0)) return { ok: false, why: 'That amount is not valid.' };
  const ledger = ledgerOf(p);
  if (o.key && ledger.some((t) => t.key === o.key && t.amount < 0)) return { ok: false, why: 'Already paid.' };
  const payer = o.payer ?? 'player';
  if (payer === 'player' && p.finance.cash < amount) return { ok: false, why: 'Not enough money.' };
  if (payer === 'player') p.finance.cash -= amount;
  const tx = { id: uid('tx'), year: store.state.year, date: store.state.today ?? null, kind: o.kind, amount: -amount, currency: o.currency ?? null,
    memo: o.memo, ref: o.ref ?? null, key: o.key ?? null, payer };
  ledger.push(tx);
  return { ok: true, tx };
}

/** Returns part of an earlier payment. Each transaction can be refunded once. */
export function refund(txId, fraction, memo, p = player()) {
  const ledger = ledgerOf(p);
  const tx = ledger.find((t) => t.id === txId);
  if (!tx || tx.amount >= 0) return { ok: false, why: 'Nothing to refund.' };
  if (ledger.some((t) => t.refundOf === txId)) return { ok: false, why: 'Already refunded.' };
  const back = Math.floor(-tx.amount * Math.max(0, Math.min(1, fraction)));
  if (tx.payer === 'player') p.finance.cash += back;
  const r = { id: uid('tx'), year: store.state.year, date: store.state.today ?? null, kind: 'refund', amount: back, currency: tx.currency, memo, ref: tx.ref, refundOf: txId, payer: tx.payer };
  ledger.push(r);
  return { ok: true, tx: r, amount: back };
}

/** Everything paid for one thing (a trip, an application), net of refunds, by the player. */
export function spentOn(refKey, refId, p = player()) {
  return -(p.finance.ledger ?? []).filter((t) => t.payer === 'player' && t.ref?.[refKey] === refId).reduce((s, t) => s + t.amount, 0);
}

// ---------- Canonical events ----------

const canon = () => (store.state.canon ??= { events: [] });

/**
 * Records something that happened, once. Returns the event (the existing one if `key` was recorded before).
 * @param {{key:string, type:string, title:string, text?:string, year?:number, date?:string, subject?:string,
 *          people?:string[], place?:{countryId:string, city?:string}, tripId?:string, moveId?:string,
 *          propertyId?:string, significance?:number, privacy?:'public'|'family'|'private'|'restricted'}} e
 */
export function recordEvent(e) {
  const list = canon().events;
  const had = e.key ? list.find((x) => x.key === e.key) : null;
  if (had) return had;
  const ev = { id: uid('ev'), year: store.state.year, date: store.state.today ?? null, subject: archiveIdOf(player()), people: [], significance: 1, privacy: 'family', ...e };
  if (!ev.people.includes(ev.subject)) ev.people = [ev.subject, ...ev.people];
  list.push(ev);
  return ev;
}
export const events = (filter = () => true) => canon().events.filter(filter);
export const eventById = (id) => canon().events.find((e) => e.id === id) ?? null;
export const hasEvent = (key) => canon().events.some((e) => e.key === key);

/**
 * Whether a viewer may see an event. Public and family history is open to
 * the family; private events only to the people in them; restricted ones
 * (legal papers, applications) only to the subject while they live.
 */
export function visible(ev, viewerId = archiveIdOf(player())) {
  if (ev.privacy === 'restricted') return ev.subject === viewerId;
  if (ev.privacy === 'private') return ev.people.includes(viewerId);
  return true;
}

// ---------- The archive ----------

const archive = () => (store.state.archive ??= { people: {} });

/**
 * Puts a person who is leaving the live save into the archive: birth, the
 * places they lived, and (restricted) their papers. Called when a life ends
 * and the family carries on. Records only what the save already holds.
 */
export function archivePerson(person, extra = {}) {
  const id = archiveIdOf(person);
  const a = archive();
  for (const asset of person.assets ?? []) rememberHome(asset, person);
  a.people[id] = {
    id, firstName: person.firstName, lastName: person.lastName, gender: person.gender,
    born: { year: person.birthYear ?? null, countryId: person.birthCountryId ?? person.bornIn ?? null, city: person.birthCity ?? null },
    died: extra.died ?? null, generation: person.generation ?? 1,
    parents: extra.parents ?? [],
    places: (person.locations ?? []).map((l) => ({ ...l })),
    citizenships: (person.citizenships ?? []).map((c) => ({ ...c })),
    appearance: person.appearance ?? null,
    ...extra.more,
  };
  return a.people[id];
}
export const archivedPeople = () => Object.values(archive().people);

/**
 * Remembers a home the family has had: its name and where it stands, so the
 * House Chronicle can still say what and where it was after it is sold or
 * passes out of the family. Ownership is not recorded here: only identity.
 */
export function rememberHome(asset, p = player()) {
  if (!asset || asset.kind !== 'property') return;
  const homes = (archive().homes ??= {});
  const at = homes[asset.id] ?? { id: asset.id };
  homes[asset.id] = { ...at, name: asset.name, countryId: asset.countryId ?? p.countryId, city: asset.city ?? (asset.countryId && asset.countryId !== p.countryId ? null : p.city) ?? null };
}
export const homeOnRecord = (id) => archive().homes?.[id] ?? null;
export const archived = (id) => archive().people[id] ?? null;

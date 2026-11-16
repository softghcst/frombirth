// "People you know": names the player has added in Settings. They turn up in
// lives as friends, classmates, colleagues, dates and strangers. The list is
// kept in this browser (localStorage), separate from any one life. It goes to
// another device only in a transfer code, or to the player's own account when
// they have signed in to cloud saves.
import { changed, rememberDeleted } from './sync/bundle.js';

const KEY = 'pathways.people';
export const MAX_PEOPLE = 80;
export const GENDERS = [['female', 'Woman'], ['male', 'Man'], ['nonbinary', 'Non-binary']];

/** @returns {{id:string, first:string, last:string, gender:'female'|'male'|'nonbinary'}[]} */
export function getPeople() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((x) => x && typeof x.first === 'string' && x.first) : [];
  } catch { return []; }
}

function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { return false; }
  changed();
  return true;
}

const tidy = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Adds someone. @returns {{ok:boolean, text:string}} */
export function addPerson(first, last, gender) {
  const list = getPeople();
  const f = tidy(first, 20);
  const l = tidy(last, 24);
  if (!f) return { ok: false, text: 'They need a first name.' };
  if (list.length >= MAX_PEOPLE) return { ok: false, text: `The list holds ${MAX_PEOPLE} people. Remove someone first.` };
  if (list.some((x) => x.first.toLowerCase() === f.toLowerCase() && (x.last ?? '').toLowerCase() === l.toLowerCase())) return { ok: false, text: 'They are already on the list.' };
  list.push({ id: `kp_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, first: f, last: l, gender: GENDERS.some((g) => g[0] === gender) ? gender : 'female' });
  return save(list) ? { ok: true, text: '' } : { ok: false, text: 'This browser would not save the list.' };
}

export function removePerson(id) {
  rememberDeleted('people', id);
  save(getPeople().filter((x) => x.id !== id));
}

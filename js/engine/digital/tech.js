// Technology across time and place: the centralized registry check every
// digital feature goes through. What exists in a given year and country,
// what a character can actually get their hands on, and which platforms are
// open to them.
import { rng } from '../../rng.js';
import { clamp, localMoney, fmtMoney } from '../../util.js';
import { store, player, country, log } from '../../state.js';
import { COUNTRIES } from '../../data/countries.js';
import { COMM_TECH, TECH_BY_ID, ADOPTION, DEVICES, DEVICE_BY_ID, ACCESS_POINTS, PLATFORMS, PLATFORM_BY_ID, DIGITAL_AGES } from '../../data/digital.js';
import { world, newId, charOf, acts, result, recordEvent } from './core.js';

export const infraOf = (countryId) => COUNTRIES[countryId]?.living?.infra ?? 50;

/**
 * Share of people in a country who have this technology in a given year, 0–1.
 * The only place in the game that turns a year into "does this exist yet".
 */
export function adoption(techId, yr = store.state.year, countryId = player().countryId) {
  const t = TECH_BY_ID[techId];
  if (!t) return 0;
  if (t.from <= -1000) return 1;
  const infra = infraOf(countryId);
  const lag = (1 - infra / 100) * ADOPTION.maxLag;
  const since = yr - t.from - lag;
  if (since < 0) return 0;
  const ceiling = infra >= t.infra ? 1 : 0.35 + 0.65 * (infra / Math.max(1, t.infra));
  let share = Math.min(1, (since + 1) / (t.span + 1)) * ceiling;
  if (t.declines && yr >= t.declines) share *= Math.max(0.12, 1 - (yr - t.declines) / 25);
  return Math.round(share * 1000) / 1000;
}

/** True when a technology has reached ordinary people in this country this year. */
export const techAvailable = (techId, yr, countryId) => adoption(techId, yr, countryId) >= ADOPTION.available;

/** Every technology and where it stands, for the Digital History page. */
export function technologies(yr = store.state.year, countryId = player().countryId) {
  return COMM_TECH.map((t) => {
    const share = adoption(t.id, yr, countryId);
    const status = share < ADOPTION.available ? (yr < t.from ? 'future' : 'arriving')
      : t.declines && yr >= t.declines ? 'declining' : share < 0.5 ? 'spreading' : 'common';
    return { tech: t, share, status };
  });
}

/** True when the online world exists here at all. */
export const digitalEra = (yr, countryId) => COMM_TECH.some((t) => t.digital && techAvailable(t.id, yr, countryId));

// ---------- Platforms ----------

/**
 * Where a platform stands in a given year and country.
 * @returns {'unlaunched'|'unavailable'|'new'|'popular'|'declining'|'closed'}
 */
export function platformStatus(platformId, yr = store.state.year, countryId = player().countryId) {
  const pl = PLATFORM_BY_ID[platformId];
  if (!pl || yr < pl.launch) return 'unlaunched';
  if (pl.closes && yr >= pl.closes) return 'closed';
  if (!techAvailable(pl.tech, yr, countryId) || infraOf(countryId) < (pl.minInfra ?? 0)) return 'unavailable';
  if (pl.declines && yr >= pl.declines) return 'declining';
  return yr < pl.launch + 3 ? 'new' : 'popular';
}
export const isOpen = (status) => status === 'new' || status === 'popular' || status === 'declining';
export const platformOpen = (platformId, yr, countryId) => isOpen(platformStatus(platformId, yr, countryId));
/** Platforms people can sign up to here and now. */
export const openPlatforms = (yr, countryId) => PLATFORMS.filter((pl) => platformOpen(pl.id, yr, countryId));
/** How busy a platform is: grows after launch, fades as it declines. 0–1. */
export function platformActivity(platformId, yr = store.state.year, countryId = player().countryId) {
  const pl = PLATFORM_BY_ID[platformId];
  const st = platformStatus(platformId, yr, countryId);
  if (!isOpen(st)) return 0;
  let a = Math.min(1, (yr - pl.launch + 1) / 5) * adoption(pl.tech, yr, countryId);
  if (st === 'declining') a *= Math.max(0.1, 1 - (yr - pl.declines) / 12);
  return Math.round(a * 1000) / 1000;
}

// ---------- Devices and access ----------

/** Devices a character owns that still work. */
export function devicesOf(charId) {
  const y = store.state.year;
  return world().devices.filter((d) => d.ownerId === charId && !d.gone && y - d.boughtYear < DEVICE_BY_ID[d.type].life * 1.6);
}

/** How worn a device is, 0–100: new is 100; past its expected life it is worn out, and soon after it stops working. */
export function condition(dev) {
  const def = DEVICE_BY_ID[dev.type];
  return Math.max(0, Math.round(100 - (store.state.year - dev.boughtYear) / def.life * 100));
}

/** Keeps the player's inventory listing their working devices (the inventory is what the rest of the game shows as belongings). */
export function syncInventory(p = player()) {
  p.inventory ??= [];
  const working = devicesOf(p.id);
  p.inventory = p.inventory.filter((it) => it.kind !== 'device' || working.some((d) => d.id === it.id));
  for (const d of working) {
    const def = DEVICE_BY_ID[d.type];
    const item = p.inventory.find((it) => it.id === d.id);
    const value = Math.round(d.cost * condition(d) / 100);
    if (item) { item.value = value; item.condition = condition(d); } else p.inventory.push({ id: d.id, name: def.name, kind: 'device', value, condition: condition(d) });
  }
}

/** Device kinds on sale this year in this country. */
export const devicesForSale = (yr, countryId) => DEVICES.filter((d) => techAvailable(d.tech, yr, countryId));

/** Whether the household the player grew up in has a device of this kind. Access, not ability: it says nothing about the child. */
function householdHas(deviceType) {
  const p = player();
  if (!p.flags.livesWithParents) return false;
  const def = DEVICE_BY_ID[deviceType];
  const share = adoption(def.tech);
  if (share < ADOPTION.available) return false;
  const parents = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.role === 'parent');
  const means = parents.length ? parents.reduce((s, n) => s + (n.meters?.money ?? 40), 0) / parents.length / 100 : 0.3;
  // Common things are in most homes; newer, costlier ones in the homes that can afford them first.
  return share >= 0.85 || share + means * 0.6 >= 0.75;
}

/**
 * How a character can do something that needs a capability ('web', 'photo', 'video', 'stream', 'call'…),
 * or null when they cannot. Own devices first, then the household's, then a school, library or workplace.
 * @returns {?{via:'own'|'household'|'access', name:string, quality:number}}
 */
export function accessFor(cap, charId = player().id) {
  const own = devicesOf(charId).map((d) => DEVICE_BY_ID[d.type]).filter((d) => d.can.includes(cap)).sort((a, b) => b.quality - a.quality);
  if (own.length) return { via: 'own', name: own[0].name, quality: own[0].quality };
  const p = player();
  if (charId === p.id) {
    const home = DEVICES.filter((d) => d.can.includes(cap) && !['camera', 'microphone', 'webcam', 'presence_set'].includes(d.id) && householdHas(d.id)).sort((a, b) => b.quality - a.quality);
    if (home.length) return { via: 'household', name: `the family ${home[0].name.toLowerCase()}`, quality: home[0].quality * 0.8 };
    if (cap === 'web') {
      const point = ACCESS_POINTS.find((a) => techAvailable(a.tech) && a.when(p));
      if (point) return { via: 'access', name: point.name, quality: 0.2 };
    }
  }
  return null;
}

/** What a platform needs from a device, as a capability. */
export function platformNeeds(platformId) {
  const pl = PLATFORM_BY_ID[platformId];
  if (pl.type === 'live') return 'stream';
  if (pl.tech === 'presence') return 'presence';
  if (pl.tech === 'smartphone') return 'photo';
  return 'web';
}

/** Every reason this character cannot use a platform right now ([] = they can). Covers era, place, age and devices. */
export function platformBlocks(platformId, charId = player().id) {
  const pl = PLATFORM_BY_ID[platformId];
  const c = charOf(charId);
  const why = [];
  if (!pl || !c) return ['There is no such service.'];
  const st = platformStatus(platformId, store.state.year, c.countryId ?? player().countryId);
  if (st === 'unlaunched') why.push(`${pl.name} does not exist yet.`);
  else if (st === 'closed') why.push(`${pl.name} has shut down.`);
  else if (st === 'unavailable') why.push(`${pl.name} is not available where you live yet.`);
  if (c.age < pl.minAge) why.push(`${pl.name} is for people ${pl.minAge} and over.`);
  if (charId === player().id && !accessFor(platformNeeds(platformId), charId)) {
    const need = platformNeeds(platformId);
    why.push(need === 'photo' ? 'You need a smartphone or tablet for this.' : need === 'stream' ? 'You need a computer or phone that can stream.' : need === 'presence' ? 'You need a presence set.' : 'You have no way to get online.');
  }
  if (charId === player().id && player().legal?.incarceration) why.push('Not from a cell.');
  return why;
}

/** Buys a device with the player's own money. */
export function buyDevice(type) {
  const p = player();
  const def = DEVICE_BY_ID[type];
  if (!def) return result(false, 'There is no such thing.');
  if (!techAvailable(def.tech)) return result(false, `There is no such thing as a ${def.name.toLowerCase()} yet.`);
  if (def.minAge && p.age < def.minAge) return result(false, 'You are too young for one of your own.');
  if (p.legal?.incarceration) return result(false, 'Not from a cell.');
  const cost = localMoney(def.cost, country());
  if (p.finance.cash < cost) return result(false, `A ${def.name.toLowerCase()} costs ${fmtMoney(cost, country())}. You do not have it.`);
  if (devicesOf(p.id).some((d) => d.type === type && store.state.year - d.boughtYear < def.life)) return result(false, `Your ${def.name.toLowerCase()} still works fine.`);
  p.finance.cash -= cost;
  const dev = { id: newId('dv'), type, ownerId: p.id, boughtYear: store.state.year, cost, via: 'bought' };
  world().devices.push(dev);
  syncInventory(p);
  const first = !world().devices.some((d) => d.ownerId === p.id && d.id !== dev.id && DEVICE_BY_ID[d.type].tech === def.tech);
  const text = `You bought a ${def.name.toLowerCase()} for ${fmtMoney(cost, country())}.`;
  if (first && ['smartphone', 'mobile_phone', 'desktop', 'laptop'].includes(type)) {
    recordEvent({ kind: 'first_device', charIds: [p.id], summary: `${text} Your first of its kind.`, visibility: 'family', once: `first_${def.tech}_${p.id}`, tone: 'good' });
  } else log(text);
  return result(true, text, 'good', { device: dev });
}

/** A child asks their parents for a phone (or, earlier, a turn on the family computer). Once a year. */
export function askForPhone() {
  const p = player();
  const a = acts();
  if (a.askedPhone) return result(false, 'You already asked this year. The answer has not changed.');
  if (!p.flags.livesWithParents) return result(false, 'You do not live with your parents.');
  const kind = techAvailable('smartphone') ? 'smartphone' : techAvailable('mobile') ? 'mobile_phone' : null;
  if (!kind) return result(false, 'There are no phones you could carry around yet.');
  if (p.age < DIGITAL_AGES.phoneFromParents) return result(false, `Your parents say you can have a phone when you are ${DIGITAL_AGES.phoneFromParents}.`);
  if (devicesOf(p.id).some((d) => d.type === kind)) return result(false, 'You already have one.');
  a.askedPhone = true;
  const parents = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.role === 'parent');
  if (!parents.length) return result(false, 'There is nobody to ask.');
  const means = parents.reduce((s, n) => s + (n.meters?.money ?? 40), 0) / parents.length;
  const strict = parents.reduce((s, n) => s + (n.strictness ?? 50), 0) / parents.length;
  const fond = parents.reduce((s, n) => s + n.meters.relationship, 0) / parents.length;
  const chance = clamp((means / 100) * 0.5 + adoption(DEVICE_BY_ID[kind].tech) * 0.4 + (fond - strict) / 300 + (p.age - 11) * 0.06, 0.05, 0.95);
  if (!rng.chance(chance)) return result(false, 'Your parents said not yet.', 'neutral');
  world().devices.push({ id: newId('dv'), type: kind, ownerId: p.id, boughtYear: store.state.year, cost: localMoney(DEVICE_BY_ID[kind].cost, country()), via: 'gift' });
  syncInventory(p);
  return result(true, `Your parents gave you a ${DEVICE_BY_ID[kind].name.toLowerCase()}, with rules about when it goes in the drawer at night.`, 'good');
}

// Yearly body upkeep: natural stat drift, new conditions, recoveries.
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { player, log } from '../state.js';
import { ILLNESSES, ILLNESS_BY_ID } from '../data/illnesses.js';
import { LEGACY_IDS, CONDITION_BY_ID } from '../data/health/conditions.js';
import { begin } from './health/course.js';
import { hasCondition } from './health/record.js';
import { PHYSICAL_LEGACY } from '../data/health/conditions.js';
import { foundByDoctor } from './health/care.js';
import { admit } from './health/hospital.js';

export function addCondition(id) {
  const p = player();
  // Mental health conditions belong to the health engine: an event can start one, never diagnose it.
  if (LEGACY_IDS[id] || CONDITION_BY_ID[id]) {
    const cid = LEGACY_IDS[id] ?? id;
    if (hasCondition(cid)) return false;
    const rec = begin(CONDITION_BY_ID[cid], p, { attack: cid === 'heart_disease' });
    // A scene that brings on a physical condition is one where a doctor found it (the tests, the ambulance).
    if (PHYSICAL_LEGACY.includes(cid)) foundByDoctor(rec, cid === 'heart_disease' ? 'hospital' : 'primary', cid === 'heart_disease' ? 'cardiologist' : 'gp', p);
    return true;
  }
  const def = ILLNESS_BY_ID[id];
  if (!def || p.conditions.some((c) => c.id === id)) return false;
  p.conditions.push({ id, name: def.name, severity: def.severity, chronic: !!def.chronic,
    sinceAge: p.age, treated: false });
  if (id === 'broken_hip') admit('hip', {}, p);
  return true;
}

export function cureCondition(id) {
  const p = player();
  const before = p.conditions.length;
  p.conditions = p.conditions.filter((c) => c.id !== id);
  return p.conditions.length < before;
}

const bump = (stats, key, delta) => { stats[key] = clamp(stats[key] + delta); };

export function tickHealth() {
  const p = player();
  const s = p.stats;
  const age = p.age;

  // Natural drift
  bump(s, 'mood', Math.sign(55 - s.mood) * 2 + rng.int(-4, 4));
  if (age < 30) bump(s, 'health', rng.int(-1, 2));
  else if (age < 50) bump(s, 'health', rng.int(-1, 1));
  else if (age < 70) bump(s, 'health', rng.int(-2, 1));
  else bump(s, 'health', rng.int(-4, 0));
  if (age < 18) bump(s, 'charm', rng.int(-1, 2));
  else if (age < 40) bump(s, 'charm', rng.int(-1, 1));
  else bump(s, 'charm', rng.int(-2, 0));
  if (!p.education.enrolled) bump(s, 'intellect', age >= 75 ? rng.int(-2, 0) : rng.int(-1, 1));
  p.hidden.fertility = clamp(p.hidden.fertility - (age > 35 ? rng.int(2, 6) : 0));

  // Existing conditions take their toll, then may clear up.
  for (const cond of [...p.conditions]) {
    const def = ILLNESS_BY_ID[cond.id];
    if (!def) continue;
    if (cond.sinceAge < age) {
      if (rng.chance(def.recover)) {
        cureCondition(cond.id);
        // Getting over a cold or the flu goes without saying; getting over something serious does not.
        if (def.chronic || def.recover < 0.8) log(`You recovered from ${def.name}.`, 'system', 'good');
        continue;
      }
      if (!def.chronic) log(`You are still suffering from ${def.name}.`, 'system', 'bad');
    }
    // A condition under treatment does a fraction of its harm.
    for (const [k, v] of Object.entries(def.yearly)) bump(s, k, cond.treated ? Math.ceil(v * 0.25) : v);
  }

  // New conditions. Poor health makes everything more likely.
  // Poor mood wears the body down; a recent check-up catches things early.
  const frailty = (1.6 - s.health / 100) * (p.flags.checkupAge === age - 1 ? 0.6 : 1) * (s.mood < 25 ? 1.3 : 1);
  for (const def of ILLNESSES) {
    if (LEGACY_IDS[def.id]) continue; // these now begin in engine/health/course.js
    if (age < def.ages[0] || age > def.ages[1] || !def.chance) continue; // never drawn (sports injuries): no roll
    if (rng.chance(def.chance * frailty) && addCondition(def.id)) {
      log(`You came down with ${def.name}.`, 'system', 'bad');
      for (const [k, v] of Object.entries(def.yearly)) bump(s, k, v);
    }
  }
}

// The legal career meets the investigations career: criminal cases call the local department's real officers and
// detectives; a lawyer who served on the force brings the years with them, and sometimes faces a former partner.
// Run with: node tests/law-police.mjs
import { store, rng, ls, lc, check, finish, lawyer } from './helpers/lawSetup.mjs';
const { agencyOf, kindsIn } = await import('../js/engine/investigations/agencies.js');
const { I } = await import('../js/engine/investigations/core.js');
rng.seed(71);

lawyer('lawyer', { city: 'Chicago' });
const p = store.state.player;
p.city = 'Chicago';
const a = agencyOf(kindsIn('us')[0], 'us', p.city);
const dets = new Set(Object.values(a.units).flatMap((u) => u.memberIds));
const c = lc.createCase('homicide');
const det = c.witnesses.find((w) => /detective/i.test(w.role));
check(det && dets.has(det.npcId), `the lead detective is a real detective of ${a.name}`);
const b = lc.createCase('drug_supply');
const off = b.witnesses.find((w) => /officer/i.test(w.role));
check(off && a.officerIds.includes(off.npcId), 'the arresting officer is one of the department\'s officers');

// A former detective becomes a lawyer.
lawyer('lawyer');
store.state.player.city = 'Chicago';
const q = store.state.player;
delete q.law;
const r = I(q);
r.stats.years = 8;
const partner = Object.values(store.state.npcs).find((n) => n.alive && n.id !== q.id);
r.people.partnerId = partner.id;
const L = ls.lawOf(q);
check(L.policeYears === 8 && L.skills.courtroom > 20, `eight years on the force come into court (${L.skills.courtroom})`);
let met = null;
for (let i = 0; i < 40 && !met; i++) { const x = lc.createCase('homicide'); if (x.knownOfficer) met = x; }
check(met && met.knownOfficer.id === partner.id, 'sometimes the detective on the other side is a former partner');
check(met && met.history.some((h) => /worked beside/.test(h.text)), 'and the case file says so');
met.awaiting = { what: 'trial', since: ls.nowM(), turn: ls.nowM() };
const cross = lc.courtroom(met).phases.find((x) => x.id === 'cross');
check(!cross || !cross.title.includes(store.state.npcs[met.knownOfficer.id].lastName) || /rode with them/.test(cross.text), 'cross-examining someone you rode with is not like cross-examining a stranger');
finish('The police in a case are real, and a past on the force follows a lawyer into court.');

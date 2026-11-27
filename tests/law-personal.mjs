// Law and the people you know: a relative charged with a crime can be defended by the lawyer in the family; relatives
// and friends ask for help with the kind of case the practice takes; how it goes changes the relationship.
// Run with: node tests/law-personal.mjs
import { store, rng, ls, lp, lc, k, check, finish, lawyer, playCase } from './helpers/lawSetup.mjs';
const kin = await import('../js/engine/kinCases.js');
const { EVENT_BY_ID } = await import('../js/data/events/index.js');
rng.seed(83);

// A relative is charged: a lawyer in the family is asked to defend them.
lawyer('lawyer');
const p = store.state.player;
const sib = p.npcIds.map((id) => store.state.npcs[id]).find((n) => n?.alive && ['sibling', 'parent'].includes(n.role)) ?? store.state.npcs[p.npcIds[0]];
sib.age = Math.max(sib.age, 30);
store.state.pendingEvents = [];
let c = null;
for (let i = 0; i < 6 && !c; i++) c = kin.charge(sib, { offenseId: 'theft' });
check(c && store.state.pendingEvents.some((e) => e.id === 'kin_charged_lawyer'), 'a lawyer is asked to defend their own relative');
check(EVENT_BY_ID.kin_charged_lawyer.choices[0].label === 'Defend them yourself', 'and the first choice is to defend them');
const before = sib.meters.relationship;
const text = kin.standBy('kin_defend', sib.id);
check(/You defended/.test(text) && k.J().cases[c.id].defenseId === p.id, `the player is their counsel (${text})`);
check(ls.lawOf().history.some((h) => h.personal), 'the case is on the player\'s own record');
check(sib.meters.relationship !== before, 'and the relationship is not the same afterward');
// Not for a non-lawyer.
const { graduate } = await import('./helpers/lawSetup.mjs');
graduate();
const rel = store.state.npcs[store.state.player.npcIds.find((id) => store.state.npcs[id]?.alive)];
rel.age = Math.max(rel.age, 30);
store.state.pendingEvents = [];
let c2 = null;
for (let i = 0; i < 6 && !c2; i++) c2 = kin.charge(rel, { offenseId: 'theft' });
check(c2 && store.state.pendingEvents.some((e) => e.id === 'kin_charged') && !store.state.pendingEvents.some((e) => e.id === 'kin_charged_lawyer'), 'someone who is not a lawyer gets the usual call');

// Relatives and friends ask for help with the practice's kind of case.
lawyer('lawyer');
lp.chooseSpecialty('estate');
const q = store.state.player;
for (const id of q.npcIds) { const n = store.state.npcs[id]; if (n) n.age = Math.max(n.age, 25); }
let offer = null;
for (let i = 0; i < 60 && !offer; i++) { ls.lawOf().window = -1; ls.lawOf().offers = []; lp.refreshOpportunities(); offer = ls.lawOf().offers.find((o) => o.personal); store.state.year += 1; }
check(offer && /asks for your help/.test(offer.summary) && offer.fee === 0, `a relative or friend asks for help (${offer?.summary?.slice(0, 90)})`);
const who = store.state.npcs[offer.clientId];
const r = lp.accept(offer.id);
if (!r.ok) console.log(r.text);
const pc = lc.caseById(r.caseId);
check(pc.personal && pc.clientId === who.id && pc.fee.model === 'pro_bono', 'taken without a fee, for the person who asked');
const rel0 = who.meters.relationship;
playCase(pc);
check(pc.done && who.meters.relationship !== rel0, `how it goes changes the relationship (${rel0} → ${who.meters.relationship})`);
finish('The people you know come to you, and remember how it went.');

// Family Law and Divorce Law are different practices: their own cases, played to an end, with outcomes worded for
// each, real laws on the case, and what the result changes for the people in it. Run with: node tests/law-family.mjs
import { store, rng, ls, lp, lc, check, finish, lawyer, playCase } from './helpers/lawSetup.mjs';
const { caseLaws } = await import('../js/engine/realLaw.js');
const { SPECIALTY_BY_ID } = await import('../js/data/law.js');
const npc = (id) => store.state.npcs[id];
rng.seed(41);

check(['prenup', 'support_change'].every((id) => SPECIALTY_BY_ID.divorce.cases.includes(id)) && !SPECIALTY_BY_ID.family.cases.includes('prenup'), 'Divorce Law takes prenups and support changes');
check(['protective_order', 'adoption', 'guardianship'].every((id) => SPECIALTY_BY_ID.family.cases.includes(id)) && !SPECIALTY_BY_ID.divorce.cases.includes('adoption'), 'Family Law takes protective orders, adoptions and guardianships');

lawyer('lawyer');
store.state.player.age = 35;
const outs = {};
for (const id of ['prenup', 'support_change', 'protective_order', 'adoption', 'guardianship']) {
  const c = lc.createCase(id, { specialty: SPECIALTY_BY_ID.family.cases.includes(id) ? 'family' : 'divorce' });
  check(!/\{\w+\}/.test(c.title + c.summary), `${id}: the title and summary are filled in (${c.title})`);
  const o = playCase(c);
  outs[id] = c;
  check(o?.kind && !/\{\w+\}/.test(o.text), `${id}: played to an end (${o?.kind}: ${o?.text})`);
}
const ad = outs.adoption;
check(npc(ad.parties.otherId)?.flags.title === 'Birth parent' && npc(ad.clientId)?.flags.spouseId !== ad.parties.otherId, 'an adoption is not a marriage between the stepparent and the birth parent');
if (ad.outcome.favorable > 0) check(npc(ad.parties.childId).flags.parentIds.includes(ad.clientId), 'a granted adoption makes the stepparent a parent');
const po = outs.protective_order;
if (po.outcome.favorable > 0) check(npc(po.parties.otherId).flags.protectiveOrder?.protects === po.clientId, 'a protective order goes on the other person\'s record');
const gd = outs.guardianship;
check(npc(gd.clientId).age >= 55 && npc(gd.parties.childId).flags.grandparentId === gd.clientId, 'a guardianship case is brought by a grandparent');
check(lc.currentOffer(lc.createCase('guardianship')).text.includes('visits'), 'a guardianship can be agreed, with visits');
// Real laws on the file.
store.state.year = 2015;
check(caseLaws(lc.createCase('prenup')).some((x) => /Uniform Premarital/.test(x.law.name)), 'a prenup cites the Uniform Premarital Agreement Act');
check(caseLaws(lc.createCase('protective_order')).some((x) => /Violence Against Women/.test(x.law.name)), 'a protective order cites the Violence Against Women Act');
lawyer('lawyer', { countryId: 'uk' });
store.state.year = 2015;
check(caseLaws(lc.createCase('guardianship')).some((x) => /special guardianship/.test(x.law.name)), 'in England a grandparent may be a special guardian');
check(caseLaws(lc.createCase('prenup')).some((x) => /Radmacher/.test(x.law.name)), 'and a prenup is weighed under Radmacher v Granatino');
store.state.year = 2005;
check(!caseLaws(lc.createCase('prenup')).some((x) => /Radmacher/.test(x.law.name)), 'not before 2010');
// Offers come from the practice area.
lawyer('lawyer');
lp.chooseSpecialty('divorce');
const seen = new Set();
for (let i = 0; i < 12; i++) { ls.lawOf().offerWindow = -1; ls.lawOf().offers = []; ls.lawOf().window = -1; lp.refreshOpportunities(); for (const o of lp.offers()) seen.add(o.templateId); store.state.year += 1; }
check([...seen].every((id) => SPECIALTY_BY_ID.divorce.cases.includes(id)) && seen.size >= 2, `a divorce practice is offered divorce work (${[...seen].join(', ')})`);
finish('Family Law and Divorce Law each have their own cases.');

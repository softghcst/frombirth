// Every practice area has more than one kind of case, and the new ones play to an end from each side that takes them,
// with their own outcomes, real laws on the file, and what they change for the people in them.
// Run with: node tests/law-variety.mjs
import { store, rng, lc, check, finish, lawyer, playCase } from './helpers/lawSetup.mjs';
const { caseLaws } = await import('../js/engine/realLaw.js');
const { SPECIALTIES, CASE_TEMPLATES } = await import('../js/data/law.js');
rng.seed(52);

const thin = SPECIALTIES.filter((s) => s.id !== 'appellate' && new Set(s.cases).size < 2);
check(!thin.length, `every practice area but appellate has two kinds of case or more (${thin.map((s) => s.id).join(', ') || 'all do'})`);
check(SPECIALTIES.every((s) => s.cases.every((id) => CASE_TEMPLATES[id])), 'every case a practice area takes exists');

const NEW = { fraud: ['defense', 'prosecution'], drug_supply: ['defense', 'prosecution'], reunification: [], juvenile_fight: [], asylum: [], car_crash: [], wage_claim: [], housing_bias: [], pollution: [], records_request: [], eviction: [] };
const played = {};
for (const [id, roles] of Object.entries(NEW)) {
  for (const role of roles.length ? roles : [undefined]) {
    lawyer(role === 'prosecution' ? 'prosecutor' : 'lawyer');
    store.state.year = 2020;
    const c = lc.createCase(id, role ? { role } : {});
    check(!/\{\w+\}/.test(c.title + c.summary), `${id}${role ? ` (${role})` : ''}: filled in: ${c.title}`);
    const o = playCase(c);
    check(o?.kind && o.text && !/\{\w+\}/.test(o.text), `${id}${role ? ` (${role})` : ''}: played to an end (${o?.kind}: ${o?.text})`);
    played[id] = c;
    c.clientNpc = store.state.npcs[c.clientId]; // each case starts a new life: keep the person
  }
}
const lawOn = (id, re) => caseLaws(played[id], 2020).some((x) => re.test(x.law.name));
check(lawOn('wage_claim', /Fair Labor Standards/) && lawOn('housing_bias', /Fair Housing/) && lawOn('pollution', /Clean Water/) && lawOn('records_request', /Freedom of Information/) && lawOn('asylum', /Refugee Act/), 'the new cases cite their real laws');
const ds = played.drug_supply;
check(ds.evidence.some((e) => e.basis === 'unlawful_search') && lawOn('drug_supply', /Mapp/), 'a search without a warrant brings in the exclusionary rule (Mapp v. Ohio)');
const as = played.asylum;
const client = as.clientNpc;
check(client && client.residency.asylumPending === false && (as.outcome.favorable <= 0 || client.flags.refugee), 'an asylum decision is kept on the client\'s own papers');
const rec = played.records_request;
check(rec.role === 'agency' && !rec.clientId, 'a records request is answered for the agency, not a client');
const ru = played.reunification;
check(ru.role === 'parentAttorney' && ru.clientId === ru.parties.otherId, 'in a reunification review, the client is the parent');
const cc = lc.createCase('car_crash');
check(lc.currentOffer(cc).claim > lc.currentOffer(lc.createCase('contract_dispute')).claim, 'a serious injury is worth more than an unpaid invoice');
finish('Every practice area has variety.');

// Flows for health care, cosmetic surgery, holidays, social media and
// emigrating. The Self and Pursuits tabs call into these.
import { player, country } from '../state.js';
import { fmtMoney, theCountry, esc } from '../util.js';
import { propertyTaxLabel, COUNTRIES } from '../data/countries.js';
import { summary, mayLeave } from '../engine/living.js';
import { roleLabel } from '../engine/relationships.js';
import * as med from '../engine/medical.js';
import * as fun from '../engine/activities.js';
import * as net from '../engine/social.js';
import * as move from '../engine/emigration.js';
import { messageModal, pickModal, confirmModal, inputModal, openModal } from './modals.js';

async function report(api, r) {
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
}

export async function seeDoctor(api) {
  const c = country();
  const list = med.treatable();
  const pick = await pickModal({
    title: 'The doctor',
    body: player().legal.incarceration ? 'The prison doctor costs you nothing.' : c.freeHealthcare ? 'Health care here is public: you pay very little.' : 'Health care here is private: you pay the full cost.',
    options: [
      ...list.map((x) => ({ value: x.id, label: `Treat your ${x.name.replace(/^an? /, '')}`, disabled: x.seen || !x.affordable || (x.manage && x.managed),
        sub: x.manage && x.managed ? 'Under control. Nothing more to do.' : x.seen ? 'Already seen this year.'
          : `${x.cost ? fmtMoney(x.cost, c) : 'Free'}${x.manage ? '. Cannot be cured, only managed.' : '.'}` })),
      { value: 'checkup', label: 'Have a check-up', sub: `${fmtMoney(med.careCost(200), c)}. Makes illness less likely next year.` },
      { value: 'therapy', label: 'See a therapist', sub: `${fmtMoney(med.careCost(1200), c)} for a year of sessions. Lifts your mood.` },
    ],
  });
  if (!pick) return undefined;
  if (pick === 'checkup') return report(api, med.checkUp());
  if (pick === 'therapy') return report(api, med.therapy());
  return report(api, med.seeDoctor(pick));
}

export async function cosmeticSurgery(api) {
  const c = country();
  const proc = await pickModal({
    title: 'Cosmetic surgery',
    body: 'It can raise your Charm. It can also go wrong, permanently.',
    options: med.surgeryOptions().map((s) => ({ value: s.id, label: s.name })),
  });
  if (!proc) return undefined;
  const surgeon = await pickModal({
    title: 'Who does it?',
    options: med.surgeonOptions(proc).map((s) => ({ value: s.id, label: s.name, disabled: !s.affordable,
      sub: `${s.blurb} ${fmtMoney(s.cost, c)}. Risk of it going wrong: ${s.risk}.` })),
  });
  return surgeon ? report(api, med.haveSurgery(proc, surgeon)) : undefined;
}

export async function takeHoliday(api) {
  const c = country();
  const family = fun.companions();
  const kind = await pickModal({
    title: 'Take a holiday',
    body: `One a year. You have ${fmtMoney(player().finance.cash, c)}.`,
    options: fun.holidayKinds().map((k) => ({ value: k.id, label: k.name, sub: k.blurb })),
  });
  if (!kind) return undefined;
  let id; let trip = {};
  if (kind === 'flight') {
    const countryId = await pickModal({ title: 'Where to?',
      options: fun.flightDestinations().map((d) => ({ value: d.id, label: `${d.flag} ${d.name}`,
        sub: [d.family.length ? `${d.family.join(', ')} live${d.family.length === 1 ? 's' : ''} here.` : '', d.ownHome ? 'You have a place of your own to stay.' : '',
          d.visited ? 'You have been before.' : 'Somewhere new.'].filter(Boolean).join(' ') })) });
    if (!countryId) return undefined;
    const cabin = await pickModal({ title: 'Which seat?', body: 'The price covers the flights and a fortnight there, for one.',
      options: fun.cabinOptions().map((k) => ({ value: k.id, label: k.name, sub: `${k.blurb} ${fmtMoney(k.cost, c)}.`, disabled: !k.affordable })) });
    if (!cabin) return undefined;
    id = 'flight'; trip = { countryId, cabin };
  } else {
    id = await pickModal({ title: fun.holidayKinds().find((k) => k.id === kind).name,
      options: fun.holidayOptions(kind).map((h) => ({ value: h.id, label: h.name, sub: `${fmtMoney(h.cost, c)} for one. ${h.note}`, disabled: !h.affordable })) });
    if (!id) return undefined;
  }
  let bring = false;
  if (family.length) {
    bring = await confirmModal({
      title: 'Bring the family?',
      body: `${family.map((n) => n.firstName).join(', ')} could come. It costs more for each person, and brings you closer.`,
      yes: 'Bring them', no: 'Go alone',
    });
  }
  return report(api, fun.holiday(id, bring, trip));
}

export async function openAccount(api) {
  const handle = await inputModal({ title: 'Open an account', label: 'Choose a username', value: player().firstName.toLowerCase(), maxLength: 20 });
  return handle ? report(api, net.createAccount(handle)) : undefined;
}

export async function buyFollowers(api) {
  const c = country();
  const amount = await pickModal({
    title: 'Buy followers',
    body: 'They are not real people. If too much of your audience is bought, someone may notice.',
    options: net.followerPacks().map((f) => ({ value: f.count, label: `${f.count.toLocaleString('en-US')} followers`, sub: fmtMoney(f.cost, c), disabled: !f.affordable })),
  });
  return amount ? report(api, net.buyFollowers(amount)) : undefined;
}

export async function moveAbroad(api) {
  const c = country();
  if (!mayLeave().ok) return messageModal({ body: mayLeave().reason });
  const pct = (x) => `${Math.round(x * 100)}%`;
  const id = await pickModal({
    title: 'Move abroad',
    body: `Visas and lawyers cost ${fmtMoney(move.emigrationFee(), c)}. You leave your job. Property you own stays yours, and your vehicles can be shipped.`,
    options: move.destinations().map((d) => ({ value: d.id, label: `${d.flag} ${d.name}`,
      sub: `${d.currency} · income tax ${pct(d.incomeTax)} · property tax ${propertyTaxLabel(d)} · ${d.freeHealthcare ? 'public' : 'private'} health care`
        + ` · ${summary(COUNTRIES[d.id]).short.toLowerCase()}${d.family ? ` · ${d.family} of your family live${d.family === 1 ? 's' : ''} here` : ''}${d.ownsHome ? ' · you own a home here' : ''}${d.language ? ` · ${d.language}` : ''}` })),
  });
  if (!id) return undefined;
  const dest = move.destinations().find((d) => d.id === id);

  // Parents, grandparents, grown children and siblings stay unless asked.
  for (;;) {
    const list = move.askable();
    if (!list.length) break;
    const coming = move.household().map((n) => n.firstName);
    const who = await pickModal({
      title: 'Who comes with you?',
      body: `${coming.length ? `Coming: ${coming.join(', ')}.` : 'So far, you would go alone.'} Others usually stay, but you can ask.`,
      options: [{ value: 'go', label: 'That is everyone', sub: 'Carry on with the application.' },
        ...list.map((x) => ({ value: x.npc.id, label: `Ask ${x.npc.firstName} ${x.npc.lastName}`, disabled: x.asked,
          sub: `${roleLabel(x.npc)}, age ${x.npc.age}.${x.coming ? ' Has said yes.' : x.asked ? ' Has said no.' : ''}` }))],
    });
    if (!who) return undefined;
    if (who === 'go') break;
    const r = move.askToCome(who);
    api.changed();
    await messageModal({ body: r.text, tone: r.tone });
  }

  let shipVehicles = true;
  const shipping = move.shippingCost();
  if (shipping) {
    const choice = await pickModal({ title: 'Your vehicles', options: [
      { value: 'ship', label: `Ship them over (${fmtMoney(shipping, c)})`, sub: 'They arrive a few weeks after you do.' },
      { value: 'sell', label: 'Sell them before you go', sub: 'For whatever they fetch today.' },
    ] });
    if (!choice) return undefined;
    shipVehicles = choice === 'ship';
  }
  const total = move.emigrationFee() + (shipVehicles ? shipping : 0);
  const sure = await confirmModal({ title: `Apply to move to ${theCountry(dest.name)}?`,
    body: `${dest.outlook} It comes to ${fmtMoney(total, c)} in all. A fifth of the visa cost is gone even if they say no.`, yes: 'Apply' });
  return sure ? report(api, move.emigrate(id, { shipVehicles })) : undefined;
}

/** The passport: every country lived in or visited. */
export function openPassport() {
  const book = move.passport();
  const p = player();
  const when = (e) => (e.first.age == null ? '' : `, first at age ${e.first.age}`);
  const stamps = book.countries.map((e, i) => `
    <div class="stamp ${e.lived ? 'lived' : ''}" style="transform:rotate(${[-3, 2, -1, 3, -2, 1][i % 6]}deg)">
      <span class="flag">${e.flag}</span>
      <strong>${esc(e.name)}</strong>
      <small>${esc(e.born ? `Born here ${p.birthYear}` : e.lived ? `Lived here${e.first.age == null ? '' : ` from age ${e.first.age}`}` : `Visited${e.visits > 1 ? ` ${e.visits} times` : ''}${when(e)}`)}${e.lives ? ' · home now' : ''}</small>
    </div>`).join('');
  const m = openModal(`
    <h2>Passport</h2>
    <p class="body muted">${esc(p.firstName)} ${esc(p.lastName)} · ${book.countries.length} of ${book.total} countries</p>
    <div class="passport">${stamps}</div>
    <button class="btn" data-close style="margin-top:14px">Close</button>`, { dismissable: true });
  m.el.querySelector('[data-close]').addEventListener('click', () => m.close());
}

/** Simple once-a-year activities, keyed by id. */
export const quick = (api) => ({
  gym: () => report(api, fun.gym()),
  library: () => report(api, fun.library()),
  meditate: () => report(api, fun.meditate()),
  night: () => report(api, fun.nightOut()),
  holiday: () => takeHoliday(api),
  post: () => report(api, net.post()),
});

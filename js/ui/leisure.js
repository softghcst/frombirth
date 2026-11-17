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
import { openAppearanceEditor } from '../avatar/editor.js';
import * as papersOf from '../engine/citizenship.js';
import * as money from '../engine/currency.js';
import { statusLine } from '../engine/immigration.js';
import * as towns from '../engine/cities.js';

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
  // Reshaping: choose the new proportions first, on your own face.
  let tweaks;
  if (proc === 'reshape') {
    const p = player();
    const next = await openAppearanceEditor({ title: 'Reshape your features', appearance: p.appearance, age: p.age, gender: p.gender, seed: p.id, scope: 'tweaks',
      confirm: 'Choose a surgeon', note: () => 'Eye spacing, eye size and height, nose and mouth size.' });
    if (!next) return undefined;
    tweaks = next.inherited.tweaks;
  }
  const surgeon = await pickModal({
    title: 'Who does it?',
    options: med.surgeonOptions(proc).map((s) => ({ value: s.id, label: s.name, disabled: !s.affordable,
      sub: `${s.blurb} ${fmtMoney(s.cost, c)}. Risk of it going wrong: ${s.risk}.` })),
  });
  return surgeon ? report(api, med.haveSurgery(proc, surgeon, tweaks)) : undefined;
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
    const d = fun.flightDestinations().find((x) => x.id === countryId);
    let purpose = 'holiday';
    if (!move.rightToLive(countryId, player()) || d.family.length) {
      purpose = await pickModal({ title: 'What is the trip for?', options: [
        { value: 'holiday', label: 'A holiday', sub: 'Rest, and see the place.' },
        ...(d.family.length ? [{ value: 'family', label: `To see ${d.family.join(', ')}`, sub: 'Most of the fortnight with them. Brings you closer.' }] : []),
        ...(move.rightToLive(countryId, player()) ? [] : [{ value: 'scouting', label: 'To look, with a move in mind', sub: 'Less of a rest. Helps a later application to live there.' }]),
      ] });
      if (!purpose) return undefined;
    }
    id = 'flight'; trip = { countryId, cabin, purpose };
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
    body: 'There is more than one way in: as a citizen, through family, work, study, investment or a settlement programme. You leave your job. Property you own stays yours, and your vehicles can be shipped.',
    options: move.destinations().map((d) => ({ value: d.id, label: `${d.flag} ${d.name}`,
      sub: `${d.currency} · income tax ${pct(d.incomeTax)} · property tax ${propertyTaxLabel(d)} · ${d.freeHealthcare ? 'public' : 'private'} health care`
        + ` · ${summary(COUNTRIES[d.id]).short.toLowerCase()}${d.family ? ` · ${d.family} of your family live${d.family === 1 ? 's' : ''} here` : ''}${d.ownsHome ? ' · you own a home here' : ''}${d.language ? ` · ${d.language}` : ''}${d.route ? ` · best route: ${d.route.toLowerCase()}` : ''}` })),
  });
  if (!id) return undefined;
  const dest = move.destinations().find((d) => d.id === id);

  // How: every route, with the ones that are closed and why.
  const ways = move.routes(id);
  let route = ways[0];
  if (ways.length > 1) {
    const pick = await pickModal({ title: `How will you move to ${theCountry(dest.name)}?`, body: 'One application a year. Each route has its own conditions, and gives a different status when you arrive.',
      options: ways.map((r) => ({ value: r.id, label: r.name, disabled: !r.eligible,
        sub: r.eligible ? `${r.blurb} ${r.outlook} ${r.fee ? fmtMoney(r.fee, c) : 'No fee'}${r.years ? ` · ${r.years} years, then it must be renewed` : ' · no end date'}.` : `${r.blurb} ${r.why}` })) });
    if (!pick) return undefined;
    route = ways.find((r) => r.id === pick);
  }
  // Where: cities differ in what homes cost and what work pays.
  let city;
  if (COUNTRIES[id].cities.length > 1) {
    city = await pickModal({ title: `Where in ${theCountry(dest.name)}?`, body: 'Compared with the country as a whole.',
      options: COUNTRIES[id].cities.map((n) => ({ value: n, label: n, sub: towns.cityLine(id, n) })) });
    if (!city) return undefined;
  }
  const staying = move.stayingBehind(id);
  if (staying.length) {
    const go = await confirmModal({ title: `${staying[0].firstName} will not come`, yes: 'Go anyway', no: 'Stay',
      body: `${staying[0].firstName} has thought about it and is not leaving ${theCountry(c.name)}. If you go, you will be married in two countries. They may follow later, or the distance may wear at it.` });
    if (!go) return undefined;
  }

  // Parents, grandparents, grown children and siblings stay unless asked.
  for (;;) {
    const list = move.askable();
    if (!list.length) break;
    const coming = move.household(id).map((n) => n.firstName);
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
  // Money: take it all, or leave some behind in the old currency.
  let keep = 0;
  if (player().finance.cash > route.fee * 3 + 1 && dest.currency !== c.currency.code) {
    const k = await pickModal({ title: 'Your money', body: `Your savings are in ${c.currency.code}. In ${dest.name} everyday money is ${dest.currency}. What you take is changed at today's rate; what you leave stays in ${c.currency.code} in an account you can change later.`,
      options: [{ value: '0', label: `Change all of it into ${dest.currency}` }, { value: '0.25', label: `Leave a quarter in ${c.currency.code}` }, { value: '0.5', label: `Leave half in ${c.currency.code}` }] });
    if (k == null) return undefined;
    keep = Number(k);
  }
  const total = route.fee + (shipVehicles ? shipping : 0);
  const sure = await confirmModal({ title: `Apply to move to ${theCountry(dest.name)}?`,
    body: `${route.name}. ${route.outlook} It comes to ${fmtMoney(total, c)} in all.${route.chance < 1 && route.fee ? ' A fifth of the visa cost is gone even if they say no.' : ''}`, yes: route.chance >= 1 ? 'Move' : 'Apply' });
  return sure ? report(api, move.emigrate(id, { shipVehicles, keep, route: route.id, city })) : undefined;
}

/** Moving to another city in the same country. */
export async function moveCity(api) {
  const c = country();
  const block = towns.moveBlock();
  if (block) return messageModal({ body: block });
  const now = towns.hereCity();
  const name = await pickModal({ title: 'Move to another city',
    body: `You live in ${now.name}${now.region && now.region !== now.name ? `, ${now.region}` : ''}: homes ${now.housingWord}, pay ${now.payWord}. Moving costs ${fmtMoney(towns.moveCost(), c)}. Your job comes too if your employer has a place for you there.`,
    options: towns.moveOptions().map((k) => ({ value: k.name, label: k.name, sub: `${k.line}. ${k.versus}${k.ownsHome ? ' You own a home here.' : ''}${k.lawDiffers ? ' Some laws differ.' : ''}` })) });
  if (!name) return undefined;
  const sure = await confirmModal({ title: `Move to ${name}?`, body: `It costs ${fmtMoney(towns.moveCost(), c)}. Property you own stays where it is.`, yes: 'Move' });
  return sure ? report(api, towns.relocate(name)) : undefined;
}

/** The passport: every country lived in or visited. */
export function openPassport(api) {
  const book = move.passport();
  const p = player();
  const doc = papersOf.papers(p);
  const nat = doc.naturalisation;
  const kvRow = (a, b) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`;
  const papers = `<div class="card"><h3>Your papers</h3>
    ${kvRow('Born in', `${doc.born.flag} ${doc.born.name}`)}
    ${doc.citizenships.map((c) => kvRow(c.lost ? 'Former citizen of' : 'Citizen of', `${c.flag} ${c.name}, ${c.how}${c.lost ? ` (until ${c.lost})` : ''}`)).join('')}
    ${kvRow('Lives in', `${doc.residency.flag} ${doc.residency.name}`)}
    ${kvRow('Status there', `${doc.residency.word}${doc.residency.status === 'citizen' ? '' : ` since ${doc.residency.since}`}`)}
    ${statusLine(p) ? kvRow('Permission', statusLine(p)) : ''}
    ${doc.residency.status === 'citizen' ? '' : `<p class="muted" style="margin-top:6px">${esc(nat.possible ? `You can apply for citizenship. ${nat.outlook}` : nat.why)}</p>`}
    ${nat.possible ? '<div class="btn-stack" style="margin-top:8px"><button class="btn primary" data-naturalise>Apply for citizenship</button></div>' : ''}</div>
    ${doc.locations.length > 1 ? `<div class="card"><h3>Where you have lived</h3>${doc.locations.map((l) => kvRow(`${l.from ?? ''}${l.to ? `–${l.to}` : l.from ? ' to now' : ''}`, `${l.flag} ${l.city ? `${l.city}, ` : ''}${l.name}`)).join('')}</div>` : ''}`;
  const journeys = fun.trips(p);
  const tripCard = journeys.length ? `<div class="card"><h3>Trips abroad</h3>${journeys.slice(0, 12).map((t) => kvRow(`${t.year} · ${t.what}`, `${t.flag} ${t.city ? `${t.city}, ` : ''}${t.name}`)).join('')}${journeys.length > 12 ? `<p class="muted">and ${journeys.length - 12} earlier.</p>` : ''}</div>` : '';
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
    ${papers}
    <div class="passport">${stamps}</div>
    ${tripCard}
    <button class="btn" data-close style="margin-top:14px">Close</button>`, { dismissable: true });
  m.el.querySelector('[data-close]').addEventListener('click', () => m.close());
  m.el.querySelector('[data-naturalise]')?.addEventListener('click', async () => {
    const c = country();
    const gone = [...nat.mustRenounce, ...nat.willLose].map((j) => COUNTRIES[j]?.name ?? j);
    const sure = await confirmModal({ title: 'Apply for citizenship?', yes: 'Apply',
      body: `The fee is ${fmtMoney(nat.fee, c)}, and there is a test. ${nat.outlook}${gone.length ? ` ${nat.mustRenounce.length ? 'You would have to give up' : 'By its own law you would lose'} your citizenship of ${gone.join(' and ')}.` : ' You would keep the citizenship you have.'}` });
    if (!sure) return;
    m.close();
    const r = papersOf.naturalise();
    api?.changed();
    await messageModal({ body: r.text, tone: r.tone });
  });
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

/** Money in other currencies: what is held, changing it, and the record of every exchange. */
export async function openCurrencies(api) {
  const c = country();
  const home = c.currency.code;
  const list = money.balances();
  const log = [...(player().finance.fxLog ?? [])].reverse().slice(0, 8);
  const pickFrom = await pickModal({
    title: 'Currencies',
    body: `Everyday money is in ${home}. You can hold other currencies too. Changing money costs ${(money.FX_FEE * 100).toFixed(1)}%. Rates here belong to the game, not the real world.`
      + (log.length ? ` Recent: ${log.slice(0, 3).map((e) => `${e.year}: ${money.fmt(e.paid, e.from)} → ${money.fmt(e.received, e.to)} at ${e.rate}`).join('; ')}.` : ''),
    options: list.map((b) => ({ value: b.code, label: `${money.fmt(b.amount, b.code)} in ${b.code}${b.home ? ' (everyday money)' : ''}`,
      sub: b.home ? 'Change some into another currency.' : `Worth about ${money.fmt(b.worth, home)} today.`, disabled: b.amount < 1 })),
    cancel: 'Close',
  });
  if (!pickFrom) return undefined;
  const have = list.find((b) => b.code === pickFrom).amount;
  // From everyday money: any currency. From an account: back into everyday money, or onwards.
  const targets = money.currencies().filter((x) => x.code !== pickFrom);
  const held = new Set(list.map((b) => b.code));
  const to = await pickModal({ title: `Change ${pickFrom} into`, options: targets.sort((a, b) => Number(held.has(b.code)) - Number(held.has(a.code)) || a.code.localeCompare(b.code))
    .map((x) => ({ value: x.code, label: `${x.code} (${x.symbol})`, sub: `1 ${pickFrom} buys ${money.rate(pickFrom, x.code).toPrecision(4)} ${x.code} today${x.code === home ? ' · your everyday money' : held.has(x.code) ? ' · you hold some' : ''}` })) });
  if (!to) return undefined;
  const part = await pickModal({ title: 'How much?', options: [0.1, 0.25, 0.5, 1].map((f) => ({ value: String(f), label: `${f === 1 ? 'All of it' : `${Math.round(f * 100)}%`}: ${money.fmt(Math.floor(have * f), pickFrom)}`,
    sub: `About ${money.fmt(Math.floor(money.convert(Math.floor(have * f), pickFrom, to) * (1 - money.FX_FEE)), to)} after the fee.`, disabled: Math.floor(have * f) < 1 })) });
  if (!part) return undefined;
  return report(api, money.exchange(pickFrom, to, Math.floor(have * Number(part))));
}

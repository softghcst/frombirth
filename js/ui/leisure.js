// Flows for health care, cosmetic surgery, holidays, social media and
// emigrating. The Self and Pursuits tabs call into these.
import { player, country } from '../state.js';
import { fmtMoney, theCountry } from '../util.js';
import * as med from '../engine/medical.js';
import * as fun from '../engine/activities.js';
import * as net from '../engine/social.js';
import * as move from '../engine/emigration.js';
import { messageModal, pickModal, confirmModal, inputModal } from './modals.js';

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
      options: fun.flightDestinations().map((d) => ({ value: d.id, label: `${d.flag} ${d.name}`, sub: d.visited ? 'You have been before.' : 'Somewhere new.' })) });
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
  const pct = (x) => `${Math.round(x * 100)}%`;
  const who = move.household();
  const id = await pickModal({
    title: 'Move abroad',
    body: `It costs ${fmtMoney(move.emigrationFee(), c)}. You will sell any property and vehicles, leave your job, and start again. ${who.length ? `${who.map((n) => n.firstName).join(', ')} would come with you.` : 'You would go alone.'}`,
    options: move.destinations().map((d) => ({ value: d.id, label: `${d.flag} ${d.name}`,
      sub: `${d.currency} · income tax ${pct(d.incomeTax)} · ${d.freeHealthcare ? 'public' : 'private'} health care` })),
  });
  if (!id) return undefined;
  const dest = move.destinations().find((d) => d.id === id);
  const sure = await confirmModal({ title: `Apply to move to ${theCountry(dest.name)}?`, body: `${dest.outlook} A fifth of the cost is gone even if they say no.`, yes: 'Apply' });
  return sure ? report(api, move.emigrate(id)) : undefined;
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

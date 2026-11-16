// Governing, on screen: choosing a cabinet, taking a bill through the
// legislature, and presenting the budget. Rules: engine/government.js.
import { player } from '../state.js';
import { esc } from '../util.js';
import * as gov from '../engine/government.js';
import * as world from '../engine/polity.js';
import { openModal, messageModal, pickModal, confirmModal } from './modals.js';

/** How a vote went, party by party. Resolves when closed. */
function tallyModal(title, t) {
  if (!t) return Promise.resolve();
  return new Promise((resolve) => {
    const m = openModal(`<div class="eyebrow">The vote</div><h2>${esc(title)}</h2>
      <div class="pol-night"><strong>For ${t.for}</strong><span>Against ${t.against}</span></div>
      <p class="muted">${t.need} needed to pass.</p>
      ${t.rows.map((r) => `<div class="pol-result"><span>${esc(r.name)}</span><span class="pol-track"><i style="width:${Math.round(r.for / Math.max(1, r.for + r.against) * 100)}%;background:${r.colour}"></i></span><span class="num">${r.for}</span><span class="num">${r.against} no</span></div>`).join('')}
      <button class="btn primary" data-ok style="margin-top:14px">Continue</button>`);
    m.el.querySelector('[data-ok]').addEventListener('click', () => { m.close(); resolve(); });
  });
}

const who = (x) => `${x.party ? `${x.party.name}. ` : ''}Age ${world.ageOf(x.figure)}. ${x.sketch[0].toUpperCase()}${x.sketch.slice(1)}.`;

/** The cabinet: every department, who runs it, and the chance to change that. */
export async function openCabinet(api) {
  for (;;) {
    const posts = gov.cabinetView();
    const id = await pickModal({ title: 'Your cabinet', cancel: 'Close', body: 'Able ministers make a government popular and get its bills through. An empty department drags everything down.',
      options: posts.map((d) => ({ value: d.id, label: `${d.title}: ${d.minister ? d.minister.name : 'empty'}`, sub: d.minister ? `${d.party ? `${d.party.name}. ` : ''}${d.sketch[0].toUpperCase()}${d.sketch.slice(1)}.` : 'Nobody is running this department.' })) });
    if (!id) return undefined;
    const post = posts.find((d) => d.id === id);
    let action = 'appoint';
    if (post.minister) {
      action = await pickModal({ title: `${post.title}`, cancel: 'Back', body: `${post.minister.name} holds the post.`,
        options: [{ value: 'appoint', label: 'Replace them', sub: 'They will not thank you.' }, { value: 'dismiss', label: 'Dismiss them and leave the post empty' }] });
      if (!action) continue;
    }
    if (action === 'dismiss') {
      const r = gov.dismiss(id); api.changed(); await messageModal({ body: r.text, tone: r.tone });
      continue;
    }
    const list = gov.shortlist(id);
    const pick = await pickModal({ title: `Choose a ${post.title}`, cancel: 'Back', body: 'These are the names put in front of you this year. What is said of them is mostly true.',
      options: list.map((x) => ({ value: x.figure.id, label: x.figure.name, sub: who(x) })) });
    if (!pick) continue;
    const r = gov.appoint(id, pick);
    api.changed();
    await messageModal({ body: r.text, tone: r.tone });
  }
}

/** Choosing how hard to push before a vote. */
const pushModal = (title, body) => pickModal({ title, cancel: 'Not yet', body, options: gov.voteOptions().map((o) => ({ value: o.id, label: o.name, sub: o.sub })) });

/** A bill: bring it in, get it through committee, and put it to the vote. */
export async function lawFlow(api) {
  const w = world.polity(player().countryId);
  if (!gov.bill()) {
    if (gov.billsLeft() <= 0) return messageModal({ body: 'The legislature has no more time for your bills this year.' });
    const mine = world.membership(w.countryId);
    const seats = mine ? w.seats[mine.id] ?? 0 : 0;
    const options = gov.billOptions();
    const pick = await pickModal({ title: 'Bring in a law', cancel: 'Back',
      body: `${mine ? `Your party holds ${seats} of ${w.seatCount} seats.` : 'You have no party behind you.'} The public finances are ${w.budget <= -3 ? 'deep in deficit' : w.budget < 0 ? 'in deficit' : 'sound'}. A bill goes to committee, then to a vote. You can bring in ${gov.billsLeft()} more this year.`,
      options: options.map((o, i) => ({ value: i, label: o.name, sub: `${o.sub}${o.minister ? '' : ' No minister to carry it.'}` })) });
    if (pick == null) return undefined;
    const r = gov.introduce(options[pick].lever, options[pick].dir);
    api.changed();
    await messageModal({ body: r.text, tone: r.tone });
    if (!r.ok) return undefined;
  }
  if (gov.bill()?.stage === 'amend') {
    const ask = world.party(w, gov.bill().ask);
    const yes = await pickModal({ title: 'The committee\'s price', cancel: 'Decide later', body: `${world.the(ask).replace(/^t/, 'T')} holds ${w.seats[ask.id] ?? 0} seats, and will back the bill if money for its own districts is written in.`,
      options: [{ value: 'yes', label: 'Accept the amendment', sub: 'Their votes, at the treasury\'s expense.' }, { value: 'no', label: 'Refuse', sub: 'The bill stays clean. They will vote against it.' }] });
    if (!yes) return undefined;
    const r = gov.concede(yes === 'yes');
    api.changed();
    await messageModal({ body: r.text, tone: r.tone });
  }
  if (gov.bill()?.stage === 'floor') {
    const move = await pushModal('The vote', 'The bill is out of committee and on the floor. How hard will you push?');
    if (!move) return undefined;
    const r = gov.putToVote(move);
    api.changed();
    await tallyModal(r.ok ? 'The bill passes' : r.tally && r.tally.for >= r.tally.need ? 'Passed, but not law' : 'The bill is defeated', r.tally);
    await messageModal({ body: r.text, tone: r.tone });
  }
  return undefined;
}

const LEVEL = ['Cut to the bone', 'Squeezed', 'As it has long been', 'Generous', 'Lavish'];
const TAX = ['Very low', 'Low', 'As it has long been', 'High', 'Very high'];
const state = (balance) => (balance <= -3 ? 'deep in deficit' : balance < 0 ? 'in deficit' : balance === 0 ? 'in balance' : 'in surplus');

/** The year's budget: every department on one page, then a single vote. */
export async function budgetFlow(api) {
  const v = gov.budgetView();
  if (v.presented) return messageModal({ body: 'This year\'s budget has already been presented.' });
  const changes = await new Promise((resolve) => {
    const picked = {};
    const m = openModal(`<div class="eyebrow">The budget</div><h2>The year's money</h2>
      <p class="body">Tax brings money in; everything else spends it. One step each way at most, and one vote on the whole of it.</p>
      ${v.rows.map((r) => `<div class="bud-row" data-row="${r.lever}">
        <div class="main"><strong>${esc(r.name)}</strong><small>${esc((r.lever === 'tax' ? TAX : LEVEL)[r.at + 2])}${r.minister ? ` · ${esc(r.minister.name)}` : r.dept ? ' · no minister' : ''}</small></div>
        <div class="seg"><button data-dir="-1" ${r.canCut ? '' : 'disabled'}>${r.lever === 'tax' ? 'Cut' : 'Cut'}</button><button data-dir="0" class="on">Hold</button><button data-dir="1" ${r.canRaise ? '' : 'disabled'}>${r.lever === 'tax' ? 'Raise' : 'Spend'}</button></div></div>`).join('')}
      <div class="kv" style="margin-top:10px"><span>The public finances now</span><span>${state(v.balance)}</span></div>
      <div class="kv"><span>After this budget</span><span data-after>${state(v.balance)}</span></div>
      <div class="kv"><span>National debt</span><span>${v.debt >= 12 ? 'Alarming' : v.debt >= 6 ? 'Heavy' : v.debt > 0 ? 'Manageable' : 'None to speak of'}</span></div>
      <div class="btn-row" style="margin-top:14px"><button class="btn" data-cancel>Not yet</button><button class="btn primary" data-go>Put it to the vote</button></div>`, { dismissable: true, onDismiss: () => resolve(null) });
    m.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-cancel]')) { m.close(); return resolve(null); }
      if (e.target.closest('[data-go]')) { m.close(); return resolve(Object.fromEntries(Object.entries(picked).filter(([, d]) => d))); }
      const b = e.target.closest('[data-dir]');
      if (!b || b.disabled) return undefined;
      const row = b.closest('[data-row]');
      picked[row.dataset.row] = Number(b.dataset.dir);
      row.querySelectorAll('[data-dir]').forEach((x) => x.classList.toggle('on', x === b));
      const after = gov.balanceAfter(Object.fromEntries(Object.entries(picked).filter(([, d]) => d)));
      const out = m.el.querySelector('[data-after]');
      out.textContent = after < -5 ? 'more than the country can borrow' : state(after);
      return undefined;
    });
  });
  if (!changes) return undefined;
  let move = 'none';
  if (Object.keys(changes).length) {
    move = await pushModal('The budget vote', v.fragile ? 'You have no majority of your own. If the budget is lost, the government falls and you face the voters. How hard will you push?' : 'A government that loses its budget is in serious trouble. How hard will you push?');
    if (!move) return undefined;
    if (move === 'confidence' && !(await confirmModal({ title: 'Stake the government on it?', body: 'If the budget is lost, the government falls and you face the voters at once.', yes: 'Stake it', danger: true }))) return undefined;
  }
  const r = gov.presentBudget(changes, move);
  api.changed();
  await tallyModal(r.ok ? 'The budget passes' : 'The budget is defeated', r.tally);
  await messageModal({ body: r.text, tone: r.tone });
  return undefined;
}

/** Buttons for the head of government's card. */
export function governButtons() {
  const posts = gov.cabinetView();
  const empty = posts.filter((d) => !d.minister).length;
  const v = gov.budgetView();
  const b = gov.bill();
  return `<button class="btn ${empty ? 'primary' : ''}" data-pol="cabinet">Your cabinet <small>${empty ? `${empty} ${empty === 1 ? 'post' : 'posts'} empty` : 'all posts filled'}</small></button>
    <button class="btn" data-pol="budget">The budget <small>${v.presented ? 'presented for this year' : 'not yet presented'}</small></button>
    <button class="btn" data-pol="law">${b ? 'Carry on with your bill' : 'Bring in a law'} <small>${b ? (b.stage === 'amend' ? 'in committee' : 'awaiting a vote') : `${gov.billsLeft()} left this year`}</small></button>`;
}

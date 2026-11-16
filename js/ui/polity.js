// The political world of the country, as a book: who governs, the parties
// and where they stand, every election with its figures, and the laws that
// have changed daily life. Tap a politician for their portrait and career.
// The player can join or leave a party here.
import { player, country } from '../state.js';
import { esc, theCountry } from '../util.js';
import * as world from '../engine/polity.js';
import * as dyn from '../engine/dynasty.js';
import { monarchy } from '../engine/royalty.js';
import { avatarSvg } from './avatar.js';
import { openModal, confirmModal, messageModal } from './modals.js';
import { cabinetView } from '../engine/government.js';
import { DEPARTMENTS } from '../data/parties.js';

const KIND = {
  presidential: 'A presidential republic: the voters elect the president and the legislature separately.',
  parliamentary: 'A parliamentary system: the voters elect the legislature, and whoever can command it governs.',
  party: 'A one-party state: the party chooses its own leaders, and they govern.',
  none: 'No elections are held. Ministers are appointed by the ruler and serve at the ruler\'s pleasure.',
};
const GOVT = { majority: 'a majority government', coalition: 'a coalition', minority: 'a minority government', divided: 'a president facing a legislature held by opponents', 'one party': 'one-party rule', appointed: 'appointed by the crown' };

const face = (f) => avatarSvg({ age: Math.max(18, world.ageOf(f)), gender: f.gender, appearance: f.look, seed: f.id, mood: 60 });
const num = (n) => Math.round(n).toLocaleString('en');

function personRow(w, f, side = '') {
  const pa = world.party(w, f.partyId);
  return `<button class="row dyn-row ${f.died != null ? 'gone' : ''} ${f.isPlayer ? 'you' : ''}" data-figure="${f.id}">
    <div class="avatar">${face(f)}</div>
    <div class="main"><strong>${esc(f.name)}</strong><small>${esc(pa ? pa.name : 'No party')}${f.isPlayer ? ' · you' : ''}</small></div>
    <div class="side">${side || `age ${world.ageOf(f)}`}</div></button>`;
}

/** The legislature as a single bar, one block per party. */
function seatBar(o) {
  if (!o.parties.length) return '';
  return `<div class="pol-bar" role="img" aria-label="Seats in the legislature">${o.parties.filter((p) => p.seats).map((p) => `<i style="flex:${p.seats};background:${p.colour}" title="${esc(p.name)}: ${p.seats}"></i>`).join('')}</div>
    <div class="pol-key">${o.parties.map((p) => `<span><i style="background:${p.colour}"></i>${esc(p.name)} ${p.seats}</span>`).join('')}</div>`;
}

function pageGovernment(w, o) {
  const c = country();
  const crown = monarchy(c);
  const mon = crown ? dyn.monarchOf(dyn.house(c.id)) : null;
  return `<p class="muted" style="margin-bottom:8px">${esc(KIND[o.kind])}</p>
    ${mon ? `<div class="kv"><span>Head of state</span><span>${esc(dyn.nameOf(dyn.house(c.id), mon))}</span></div>` : ''}
    <div class="section-label" style="margin-top:8px">${esc(o.headTitle)}</div>
    ${o.head ? personRow(w, o.head, `since ${o.since}`) : ''}
    <div class="kv"><span>The government</span><span>${esc(GOVT[o.govtKind] ?? o.govtKind)}</span></div>
    ${o.kind !== 'none' ? `<div class="kv"><span>How it is doing</span><span>${o.approval >= 60 ? 'Popular' : o.approval >= 45 ? 'Holding its own' : o.approval >= 32 ? 'Unpopular' : 'Deeply unpopular'} (${Math.round(o.approval)}% approve)</span></div>
    <div class="kv"><span>Next general election</span><span>${o.nextElection}${o.yearsToElection <= 1 ? ' (this coming year)' : ''}</span></div>` : ''}
    <div class="kv"><span>The public finances</span><span>${o.budget <= -3 ? 'Deep in deficit' : o.budget < 0 ? 'In deficit' : o.budget === 0 ? 'In balance' : 'In surplus'}</span></div>
    <div class="kv"><span>National debt</span><span>${o.debt >= 12 ? 'Alarming' : o.debt >= 6 ? 'Heavy' : o.debt > 0 ? 'Manageable' : 'None to speak of'}</span></div>
    <div class="section-label">The cabinet</div>
    ${cabinetView(c.id).map((d) => (d.minister ? personRow(w, d.minister, esc(d.title.replace(' Minister', ''))) : `<div class="kv"><span>${esc(d.title)}</span><span>Empty</span></div>`)).join('')}
    ${o.parties.length ? `<div class="section-label">The legislature, ${o.seatCount} seats</div>${seatBar(o)}` : ''}
    <div class="section-label">What its governments have changed</div>
    ${o.policies.length ? o.policies.map((t) => `<p class="dyn-reach">${esc(t)}</p>`).join('') : '<p class="muted">Taxes, tuition, medical bills and rents are as they have long been.</p>'}`;
}

function pageParties(w, o, mine) {
  if (!o.parties.length) return '<p class="muted">There are no political parties here.</p>';
  return o.parties.map((p) => `
    <div class="card pol-party" style="border-left:5px solid ${p.colour}">
      <h3>${esc(p.name)}${mine?.id === p.id ? ' <small>(your party)</small>' : ''}</h3>
      <p class="muted">${esc(p.says)}</p>
      <div class="kv"><span>Seats</span><span>${p.seats} of ${o.seatCount}${p.inGovt ? ' · in government' : ''}</span></div>
      <div class="kv"><span>At the last election</span><span>${p.share}%</span></div>
      <div class="kv"><span>Stands for</span><span>${esc(p.stances.slice(0, 4).join('; ') || 'things much as they are')}</span></div>
      ${p.leader ? personRow(w, p.leader, 'leader') : ''}
      ${player().age >= 16 && o.kind !== 'none' ? `<button class="btn" data-join="${p.id}" ${mine?.id === p.id ? 'disabled' : ''}>${mine?.id === p.id ? 'You are a member' : mine ? 'Leave yours and join this one' : 'Join this party'}</button>` : ''}
    </div>`).join('')
    + (mine ? '<button class="btn" data-leave style="margin-top:6px">Leave your party and sit as an independent</button>' : '');
}

function myRaces(countryId) {
  const races = (player().flags.races ?? []).filter((r) => r.countryId === countryId).reverse();
  if (!races.length) return '';
  return `<div class="section-label">Your own races</div>${races.map((r) => `<div class="card"><h3>${r.year} · ${esc(r.title)} <small>(${r.won ? 'won' : 'lost'})</small></h3>
    <div class="pol-result"><span>You${r.party ? `, ${esc(r.party)}` : ''}</span><span class="pol-track"><i style="width:${r.share}%;background:${r.colour}"></i></span><span class="num">${r.share}%</span><span class="num">${num(r.votes.me)}</span></div>
    <div class="pol-result"><span>${esc(r.rival)}${r.rivalParty ? `, ${esc(r.rivalParty)}` : ''}</span><span class="pol-track"><i style="width:${Math.round((100 - r.share) * 10) / 10}%;background:${r.rivalColour}"></i></span><span class="num">${Math.round((100 - r.share) * 10) / 10}%</span><span class="num">${num(r.votes.rival)}</span></div>
    <div class="kv"><span>Votes cast</span><span>${num(r.total)} (${r.turnout}% turnout)</span></div>
    ${r.platform ? `<div class="kv"><span>You stood for</span><span>${esc(r.platform)}</span></div>` : ''}
    ${r.debated ? `<div class="kv"><span>The debate</span><span>${{ won: 'You won it', lost: 'You lost it', drawn: 'A draw', ducked: 'You declined it' }[r.debated]}</span></div>` : ''}
    ${r.lastPoll != null ? `<div class="kv"><span>The last poll said</span><span>${r.lastPoll}%</span></div>` : ''}</div>`).join('')}
    <div class="section-label">General elections</div>`;
}

function pageElections(w, o) {
  if (!o.elections.length) return '<p class="muted">No elections are held here.</p>';
  return myRaces(w.countryId) + o.elections.map((e, i) => {
    const order = Object.entries(e.shares).sort((a, b) => b[1] - a[1]);
    const lead = world.party(w, e.govt.lead);
    return `<div class="card"><h3>${e.year}${i === 0 ? ' <small>(the most recent)</small>' : ''}</h3>
      ${order.map(([id, s]) => { const p = world.party(w, id); return p ? `<div class="pol-result"><span>${esc(p.name)}</span><span class="pol-track"><i style="width:${s}%;background:${p.colour}"></i></span><span class="num">${s}%</span><span class="num">${e.seats[id] ?? 0} seats</span></div>` : ''; }).join('')}
      <div class="kv"><span>Votes cast</span><span>${num(e.total)} (${e.turnout}% turnout)</span></div>
      ${e.runoff ? `<div class="kv"><span>Run-off</span><span>${Object.entries(e.runoff.shares).sort((a, b) => b[1] - a[1]).map(([id, s]) => `${esc(world.party(w, id)?.name ?? '')} ${s}%`).join(' to ')}</span></div>` : ''}
      <div class="kv"><span>Outcome</span><span>${esc(e.govt.headName)}${lead ? `, ${esc(lead.name)}` : ''}: ${esc(GOVT[e.govt.kind] ?? e.govt.kind)}${e.govt.partners.length ? ` with ${esc(e.govt.partners.map((id) => world.party(w, id)?.name).join(' and '))}` : ''}</span></div>
      ${i === 0 && e.byGroup ? `<div class="section-label">How the country divided</div>${Object.entries(e.byGroup).map(([g, by]) => { const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0]; return `<div class="kv"><span>${esc({ young: 'Younger voters', workers: 'Working households', professionals: 'Professionals and business', older: 'Older voters', rural: 'Rural and small towns' }[g] ?? g)}</span><span>${esc(world.party(w, top[0])?.name ?? '')} ${top[1]}%</span></div>`; }).join('')}` : ''}
    </div>`;
  }).join('');
}

function pageLaws(o) {
  return o.laws.length ? o.laws.map((l) => `<div class="dyn-event"><span class="num">${l.year}</span><span>${l.over ? `${esc(l.by.replace(/^t/, 'T'))} ${esc(l.text)}` : `${esc(l.by)}'s government ${esc(l.text)}`}${l.vote ? `, ${l.vote[0]} votes to ${l.vote[1]}` : ''}.</span></div>`).join('')
    : '<p class="muted">No changes to the law have been recorded yet.</p>';
}

function pageFigure(w, f) {
  const pa = world.party(w, f.partyId);
  const post = { head: world.headTitle(w.countryId), leader: 'Party leader', deputy: 'Deputy leader', 'former head': `Former ${world.headTitle(w.countryId)}`, 'former leader': 'Former party leader', local: 'Local politician', 'former minister': 'Former minister', backbench: 'Member of the legislature',
    minister: DEPARTMENTS.find((d) => w.cabinet?.[d.id] === f.id)?.title ?? 'Minister' }[f.post] ?? 'Politician';
  const t = f.t;
  const words = [t.charisma >= 70 ? 'a natural on a platform' : t.charisma <= 38 ? 'no speaker' : null, t.integrity >= 70 ? 'scrupulously honest' : t.integrity <= 38 ? 'known to cut corners' : null, t.ambition >= 72 ? 'openly ambitious' : t.ambition <= 38 ? 'without much appetite for the top' : null].filter(Boolean);
  return `<div class="dyn-hero"><div class="avatar dyn-portrait">${face(f)}</div>
      <div><h3>${esc(f.name)}</h3><p class="muted">${f.born}–${f.died ?? ''} · ${f.died != null ? `lived ${world.ageOf(f)} years` : `age ${world.ageOf(f)}`}</p>
        <p>${esc(post)}${pa ? `<br><em>${esc(pa.name)}</em>` : ''}</p></div></div>
    ${words.length ? `<div class="kv"><span>Said to be</span><span>${esc(words.join(', '))}</span></div>` : ''}
    ${f.post === 'minister' && t.skill != null ? `<div class="kv"><span>As a minister</span><span>${t.skill >= 72 ? 'Very able' : t.skill >= 55 ? 'Capable' : t.skill >= 40 ? 'Adequate' : 'Out of their depth'}</span></div>` : ''}
    <div class="section-label">A career</div>
    ${f.history.length ? f.history.map((h) => `<div class="dyn-event"><span class="num">${h.year}</span><span>${esc(h.text)}</span></div>`).join('') : '<p class="muted">Nothing on the record yet.</p>'}`;
}

/** Opens the political world of the country the player lives in. `onChange` is called when the player's party changes. */
export function openPolity(onChange) {
  const c = country();
  const w = world.polity(c.id);
  const tabs = [['government', 'Government'], ['parties', 'Parties'], ['elections', 'Elections'], ['laws', 'Laws']];
  let tab = 'government';
  let viewing = null;
  const m = openModal(`
    <div class="dyn-head"><div><div class="eyebrow">${esc(theCountry(c.name))}</div><h2>Politics</h2></div>
      <button class="icon-btn" data-close aria-label="Close">✕</button></div>
    <div class="dyn-tabs" role="tablist">${tabs.map(([id, label]) => `<button role="tab" data-tab="${id}">${label}</button>`).join('')}</div>
    <div class="dyn-body" data-body></div>`, { dismissable: true });
  m.el.classList.add('dyn-modal');
  const body = m.el.querySelector('[data-body]');
  function draw() {
    const o = world.overview(c.id);
    const mine = world.membership(c.id);
    m.el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', !viewing && b.dataset.tab === tab));
    body.innerHTML = viewing ? `<button class="btn dyn-back" data-back>← Back</button>${pageFigure(w, viewing)}`
      : tab === 'government' ? pageGovernment(w, o) : tab === 'parties' ? pageParties(w, o, mine) : tab === 'elections' ? pageElections(w, o) : pageLaws(o);
    body.scrollTop = 0;
  }
  m.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) return m.close();
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; viewing = null; return draw(); }
    if (e.target.closest('[data-back]')) { viewing = null; return draw(); }
    const join = e.target.closest('[data-join]');
    if (join) {
      const had = world.membership(c.id);
      if (had && !(await confirmModal({ title: 'Change parties?', body: 'People who cross the floor are not quickly trusted by either side.', yes: 'Change' }))) return undefined;
      const r = world.joinParty(join.dataset.join);
      onChange?.();
      await messageModal({ body: r.text, tone: r.tone });
      return draw();
    }
    if (e.target.closest('[data-leave]')) { const r = world.leaveParty(); onChange?.(); await messageModal({ body: r.text, tone: r.tone }); return draw(); }
    const who = e.target.closest('[data-figure]');
    if (who && w.figures[who.dataset.figure]) { viewing = w.figures[who.dataset.figure]; return draw(); }
    return undefined;
  });
  draw();
}

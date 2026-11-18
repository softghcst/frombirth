// My Fame: your work, your audience, your legacy. One screen for the fame
// profile, the casting board, the work in progress, representation, the press,
// awards, the people met through the work, and the archive of credits.
// Records link to each other: a credit opens its production, a production its
// cast, a castmate their profile; an award opens its season and the other
// nominees. "Back" returns to where you were.
import { player, country, store } from '../state.js';
import { esc, fmtMoney, localWage } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { PRODUCTION_KINDS, TIERS, ROLE_KINDS, ACCURACY, AWARD_BODIES, MUSIC_AWARD, RELEASE_TYPES, VENUES, MUSIC_GENRES } from '../data/fame.js';
import { openModal, messageModal, pickModal, confirmModal } from './modals.js';
import { meterHtml } from './meter.js';
import { avatarSvg } from './avatar.js';
import { openNpc } from './tabs/people.js';
import * as fame from '../engine/fame.js';
import * as ent from '../engine/entertainment.js';
import * as press from '../engine/press.js';
import * as awards from '../engine/awards.js';
import * as skills from '../engine/skills.js';
import * as music from '../engine/music.js';
import * as sports from '../engine/sports.js';
import * as modelling from '../engine/modelling.js';
import * as pub from '../engine/publishing.js';
import * as celebs from '../engine/celebs.js';
import * as agents from '../engine/agents.js';
import { SPORTS, BOOKINGS, BOOK_KINDS, BOOK_GENRES, BOOK_AWARD } from '../data/fame.js';

const BODIES = [...AWARD_BODIES, MUSIC_AWARD, BOOK_AWARD];
const aRelease = (k) => ({ single: 'a single', ep: 'an EP', album: 'an album' }[k]);

const kv = (rows) => rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
const btn = (act, label, o = {}) => `<button type="button" class="btn ${o.cls ?? ''}" data-act="${act}"${o.arg != null ? ` data-arg="${esc(o.arg)}"` : ''}${o.disabled ? ' disabled' : ''}>${esc(label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`;
const face = (n) => `<div class="avatar">${avatarSvg({ age: n.age, gender: n.gender, appearance: n.appearance, seed: n.id, mood: n.meters.relationship, label: n.firstName })}</div>`;
const money = (n, c = country()) => fmtMoney(n, c);
const nameOf = (who) => (who === 'player' ? 'You' : who ? `${store.state.npcs[who]?.firstName ?? ''} ${store.state.npcs[who]?.lastName ?? ''}`.trim() || 'Someone' : '');
const kindName = (prod) => `${TIERS[prod.tier].name} ${PRODUCTION_KINDS[prod.kind].name.toLowerCase()}`;
const row = (act, arg, main, sub, side = '', n = null) => `<button type="button" class="row world-row" data-act="${act}" data-arg="${esc(arg)}">${n ? face(n) : ''}
  <div class="main"><strong>${esc(main)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>${side ? `<div class="side">${esc(side)}</div>` : ''}</button>`;

const TABS = [['overview', 'Overview'], ['casting', 'Opportunities'], ['music', 'Music'], ['sport', 'Sport'], ['modelling', 'Modeling'], ['writing', 'Writing'], ['work', 'Current work'], ['representation', 'Representation'], ['image', 'Public image'],
  ['awards', 'Awards'], ['connections', 'Connections'], ['archive', 'Archive'], ['family', 'Family']];

function tabsFor(p) {
  const f = ent.workOf(p);
  return TABS.filter(([id]) => {
    if (id === 'work') return ent.activeWork(p).length > 0 || f.contracts.some((c) => c.status === 'signed');
    if (id === 'representation') return p.age >= 12;
    if (id === 'music') return p.age >= 12 && fame.exists('concert');
    if (id === 'sport') return sports.isAthlete(p) || sports.isCoach(p) || !!p.sport || !!p.coach;
    if (id === 'modelling') return modelling.isModel(p) || modelling.portfolio(p).length > 0;
    if (id === 'writing') return p.age >= 14 && fame.exists('publishing');
    if (id === 'family') return (store.state.careerRecord ?? []).length > 0;
    if (id === 'awards') return awards.myAwards(p).length > 0;
    if (id === 'connections') return connections(p).length > 0;
    if (id === 'archive') return f.credits.length > 0 || (p.flags.performances ?? []).length > 0 || music.discography(p).length > 0 || pub.bibliography(p).length > 0;
    return true;
  });
}

const connections = (p = player()) => p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && (n.flags.star || n.flags.workedWith && ent.creditsOf(n.id).length));

/** Opens My Fame. api: the tab api ({ changed }). */
export function openFame(api, start = 'overview') {
  const st = { stack: [{ view: start, arg: null }] };
  const modal = openModal('<div data-fame></div>', { dismissable: true });
  modal.el.classList.add('world-modal');
  const root = modal.el.querySelector('[data-fame]');
  const top = () => st.stack[st.stack.length - 1];
  const render = () => {
    const p = player();
    const t = top();
    const tabs = tabsFor(p);
    const deep = st.stack.length > 1;
    root.innerHTML = `
      <h2 style="margin:0">My Fame</h2><p class="muted" style="margin:0 0 6px">Your work. Your audience. Your legacy.</p>
      ${deep ? '<button type="button" class="btn small" data-back>← Back</button>' : `<div class="world-groups" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" class="world-group av-chip ${id === t.view ? 'on' : ''}" aria-selected="${id === t.view}" data-tab="${id}">${esc(label)}</button>`).join('')}</div>`}
      <div style="margin-top:10px">${(VIEWS[t.view] ?? VIEWS.overview)(p, t.arg)}</div>
      <div class="btn-stack" style="margin-top:12px"><button type="button" class="btn" data-close>Close</button></div>`;
  };
  const refresh = () => { api.changed(); render(); };
  const say = async (r) => { refresh(); if (r?.text) await messageModal({ body: r.text, tone: r.tone }); render(); };
  const go = (view, arg) => { st.stack.push({ view, arg }); render(); modal.el.scrollTop = 0; };
  root.addEventListener('click', async (e) => {
    const tt = e.target;
    if (tt.closest('[data-close]')) return modal.close();
    if (tt.closest('[data-back]')) { st.stack.pop(); render(); return undefined; }
    const tab = tt.closest('[data-tab]');
    if (tab) { st.stack = [{ view: tab.dataset.tab, arg: null }]; render(); return undefined; }
    const b = tt.closest('[data-act]');
    if (!b || b.disabled) return undefined;
    const fn = ACTIONS[b.dataset.act];
    if (fn) await fn(b.dataset.arg, { st, say, refresh, render, go, api });
    return undefined;
  });
  render();
  return modal;
}

// ---------- Agents ----------

/** Who else an agent represents: the names that tell you what kind of agent they are. */
function agentClients(n) {
  const list = agents.clientsOf(n);
  if (!list.length) return '<p class="muted" style="margin:4px 0">No other clients you would know.</p>';
  return `<div class="section-label">Also represents</div>${list.slice(0, 6).map((c) => {
    const st = c.flags.star ?? {};
    const known = st.fame >= 60 ? 'A household name' : st.fame >= 35 ? 'Well known' : st.fame >= 15 ? 'Known in the business' : 'Up and coming';
    const credits = ent.creditsOf(c.id);
    const sub = st.kind === 'author' ? `${known} · author of ${(st.books ?? []).length} ${(st.books ?? []).length === 1 ? 'book' : 'books'}${st.bestseller ? ', bestselling' : ''}${st.books?.[0] ? `, including ${st.books[0]}` : ''}`
      : `${known} · ${credits.length ? `${credits.length} ${credits.length === 1 ? 'credit' : 'credits'}, latest ${credits.at(-1).production.title}` : `${c.age >= 40 ? 'a long career' : 'a working actor'}`}`;
    return row('person', c.id, `${c.firstName} ${c.lastName}`, sub, '', c);
  }).join('')}`;
}

/** An agent on offer: their terms, their pull, their clients, and the choice. */
function agentOffer(n, agency, signAct, passAct, againAct, left) {
  const a = n.flags.agent;
  return `<div class="card" style="margin-top:8px"><h3>${esc(`${n.firstName} ${n.lastName}`)}</h3>
    ${kv([['Agency', agency], ['Kind of agency', agents.tierLabel(a.tier)], ['Their cut', `${Math.round(a.commission * 100)}%`], ['Pull with the people who hire', a.clout >= 1.25 ? 'A lot' : a.clout >= 0.9 ? 'Some' : 'Not much'], ['Clients', String(agents.clientsOf(n).length)]])}
    ${agentClients(n)}
    <div class="btn-stack">${btn(signAct, 'Sign with them', { cls: 'primary' })}${btn(againAct, 'Look for another', { disabled: left <= 0, sub: left > 0 ? `${left} ${left === 1 ? 'look' : 'looks'} left this year` : 'No more looks this year' })}${btn(passAct, 'Say no')}</div></div>`;
}

// ---------- Views ----------

const VIEWS = {
  overview(p) {
    const f = fame.fameOf(p);
    const w = ent.workOf(p);
    const sc = fame.scope(p);
    const auds = fame.topAudiences(p);
    const regions = fame.topRegions(p, 5);
    const act = skills.levelOf('acting');
    const sing = skills.levelOf('singing');
    const dance = skills.levelOf('dance');
    const recent = w.credits.slice(-3).reverse().map((c) => ent.production(c.productionId)).filter(Boolean);
    const upcoming = w.contracts.filter((c) => c.status === 'signed').map((c) => ent.production(c.productionId)).filter(Boolean);
    return `<div class="card"><h3>${esc(sc.name)}</h3>
      ${kv([['Known to', auds.length ? auds.map((a) => `${a.name.toLowerCase()} (${a.value})`).join(', ') : 'Hardly anyone yet'],
    ['Where', regions.length ? regions.map(([c, v]) => `${COUNTRIES[c]?.name ?? c} ${Math.round(v)}`).join(', ') : '—'],
    ...(f.family ? [['Through your family', `${Math.round(f.family)}: people know the name, not your work`]] : []),
    ...(f.provenance ? [['Carried over', `${f.provenance.migratedFrom}, from before this record was kept`]] : [])])}
      <div style="margin-top:8px">${meterHtml('In the news now', f.attention, true)}${meterHtml('What lasts', f.legacy, true)}${meterHtml('Public regard', f.favour, true)}${meterHtml('Standing in the industry', f.credibility, true)}</div></div>
      <div class="card"><h3>Your craft</h3>${kv([['Acting', `${act} (${skills.levelName(act)})`], ['Singing', `${sing} (${skills.levelName(sing)})`], ['Dance', `${dance} (${skills.levelName(dance)})`],
    ['Professional credits', String(ent.proCredits(p))]])}<p class="muted" style="margin-top:6px">Practice on the Pursuits tab: skill is what gets you the part, not fame.</p></div>
      ${upcoming.length ? `<div class="card"><h3>Signed for</h3>${upcoming.map((x) => row('production', x.id, x.title, `${kindName(x)} · ${x.workYear > store.state.year ? 'starts next year' : 'now'}`)).join('')}</div>` : ''}
      ${recent.length ? `<div class="card"><h3>Recent work</h3>${recent.map((x) => row('production', x.id, x.title, `${kindName(x)} · ${x.workYear}`)).join('')}</div>` : ''}
      ${(() => { const offers = celebs.comebackOffers(p); const phase = celebs.phaseName(p);
    const say = { reality: ['A reality show', 'Ten weeks on camera. The money is good; the respect is not.'], tribute: ['A tribute evening', 'Your work, celebrated.'], memoir: ['Write your memoir', 'Publishers want your story. Starts a memoir on the Writing tab.'], reunion: ['Get the band back together', 'One more time.'] };
    return phase || offers.length ? `<div class="card"><h3>${esc(phase ?? 'Your story')}</h3>${offers.length ? `<p class="muted" style="margin:0 0 6px">People have stopped asking about you. Some ways back:</p><div class="btn-stack">${offers.map((o) => btn('comeback', say[o.kind][0], { arg: o.kind, sub: say[o.kind][1] })).join('')}</div>` : ''}</div>` : ''; })()}
      ${celebs.news(5).length ? `<div class="card"><h3>Celebrity news</h3>${celebs.news(5).map((a) => { const n = store.state.npcs[a.about]; return row('person', n.id, a.text, `${a.year}${a.accuracy === 'rumour' ? ' · unconfirmed' : ''}`, '', n); }).join('')}</div>` : ''}
      ${f.log.length ? `<div class="card"><h3>Why people know you</h3>${f.log.slice(-5).reverse().map((l) => `<p style="margin:3px 0">${l.year}: ${esc(l.why || l.audience)} (${l.delta > 0 ? '+' : ''}${l.delta} ${esc(l.audience)})</p>`).join('')}</div>` : ''}`;
  },

  casting(p) {
    const board = ent.castingBoard(p);
    const offers = ent.workOf(p).contracts.filter((c) => c.status === 'offered');
    return `${offers.length ? `<div class="section-label">Offers</div>${offers.map((c) => { const x = ent.production(c.productionId); const r = x.cast[c.idx];
      return `<div class="card"><h3>${esc(x.title)}</h3>${kv([['Part', `${ROLE_KINDS[r.kind].name}: ${r.character}`], ['What it is', kindName(x)], ['Fee', c.fee ? `${money(c.fee, COUNTRIES[x.countryId])}${x.runYears > 1 ? ` a year, for ${x.runYears} years` : ''}` : 'Unpaid'],
        ['Time', `${c.weeks} weeks at about ${c.hours} hours a week, in ${x.workYear}`], ...(c.agent ? [['Your agent takes', `${Math.round(c.agent.commission * 100)}%`]] : []), ...(p.age < 18 ? [['Held in trust until you are 18', '15% of the fee']] : [])])}
        <div class="btn-stack" style="margin-top:6px">${btn('sign', 'Sign the contract', { cls: 'primary', arg: c.id })}${btn('negotiate', 'Ask for more', { arg: c.id, disabled: c.asked || !c.fee })}${btn('decline', 'Turn it down', { arg: c.id })}</div></div>`; }).join('')}` : ''}
      <div class="section-label">Casting notices</div>
      <p class="muted" style="margin:0 0 6px">Real parts in real productions. Most auditions do not go your way; that is the work.</p>
      ${board.length ? board.map((x) => row('notice', `${x.production.id}:${x.role.idx}`, `${x.production.title}: ${ROLE_KINDS[x.role.kind].name.toLowerCase()}`,
    `${kindName(x.production)} · ${x.role.character}, ${x.role.ages[0]}–${x.role.ages[1]} · ${x.applied ? 'You have auditioned' : x.why || 'You can audition'}`, x.role.fee ? money(Math.round(localWage(x.role.fee, COUNTRIES[x.production.countryId])), COUNTRIES[x.production.countryId]) : 'Unpaid')).join('')
    : '<p class="empty">No casting notices where you live right now.</p>'}`;
  },

  work(p) {
    const now = ent.activeWork(p);
    const later = ent.workOf(p).contracts.filter((c) => c.status === 'signed').map((c) => ent.production(c.productionId)).filter((x) => x && !now.includes(x));
    return `${now.map((x) => { const w = ent.workOf(p).work[x.id]; const done = w?.age === p.age ? w.done : [];
      return `<div class="card"><h3>${esc(x.title)}</h3>${kv([['What it is', kindName(x)], ['Your part', `${ROLE_KINDS[x.cast.find((r) => r.who === 'player').kind].name}: ${x.cast.find((r) => r.who === 'player').character}`], ['Directed by', nameOf(x.directorId)]])}
        <div class="btn-stack" style="margin-top:6px">${Object.entries(ent.SET_ACTIONS).map(([id, a]) => btn('set', a.name, { arg: `${x.id}:${id}`, disabled: done.includes(id) || done.length >= 2 })).join('')}
        ${btn('production', 'The production and its company', { arg: x.id })}</div></div>`; }).join('') || '<p class="muted">Nothing being made right now.</p>'}
      ${later.length ? `<div class="section-label">Coming up</div>${later.map((x) => row('production', x.id, x.title, `${kindName(x)} · ${x.workYear}`)).join('')}` : ''}`;
  },

  representation(p) {
    const w = ent.workOf(p);
    const agent = w.agent ? store.state.npcs[w.agent.npcId] : null;
    const offer = press.agentOnOffer();
    const left = press.agentTriesLeft();
    const pub = w.publicist ? store.state.npcs[w.publicist.npcId] : null;
    return `<div class="card"><h3>Agent</h3>${agent ? `${row('person', agent.id, `${agent.firstName} ${agent.lastName}`, `${ent.org(w.agent.orgId)?.name ?? ''} · since ${w.agent.since} · takes ${Math.round(w.agent.commission * 100)}%`, '', agent)}
      ${agentClients(agent)}${btn('endagent', 'End the representation', { cls: 'danger' })}`
    : '<p class="muted">An agent finds parts, puts you up for them, and negotiates. Each takes their own cut, and some carry more weight than others. They guarantee nothing.</p>'}
      ${offer ? agentOffer(offer, ent.org(offer.flags.agent.orgId)?.name ?? '', 'signagent', 'passagent', 'findagent', left) : `<div class="btn-stack">${btn('findagent', agent ? 'Look for a different agent' : 'Look for an agent', { disabled: left <= 0, sub: left > 0 ? `${left} ${left === 1 ? 'look' : 'looks'} left this year` : 'You have looked twice this year' })}</div>`}</div>
      <div class="card"><h3>Publicist</h3>${pub ? `${row('person', pub.id, `${pub.firstName} ${pub.lastName}`, `${money(w.publicist.fee)} a year`, '', pub)}${btn('nopub', 'Let them go')}` : btn('pub', 'Hire a publicist', { sub: 'Helps you say things well. Cannot change what happened.' })}</div>
      <p class="muted">Lawyers and accountants are separate professions; nothing here gives legal or financial representation.</p>`;
  },

  image(p) {
    const f = fame.fameOf(p);
    const w = ent.workOf(p);
    const items = ent.myPress(p).slice(0, 25);
    const invites = (w.offers ?? []).filter((o) => o.status === 'open');
    const deals = (w.deals ?? []).filter((d) => ['offered', 'signed'].includes(d.status));
    return `<div class="card"><h3>How you are seen</h3><div>${meterHtml('Public regard', f.favour, true)}${meterHtml('Standing in the industry', f.credibility, true)}${meterHtml('In the news now', f.attention, true)}</div>
      ${kv([['Privacy', { open: 'You talk about your life freely', guarded: 'Your work, not your life', private: 'Your private life is private' }[f.privacy]]])}${btn('privacy', 'Change how much you share')}</div>
      ${invites.length ? `<div class="section-label">Invitations</div>${invites.map((o) => `<div class="card"><p style="margin:0">${esc(press.APPEARANCES[o.kind].name)}${o.productionId ? `: ${esc(ent.production(o.productionId)?.title ?? '')}` : ent.org(o.outletId) ? `, ${esc(ent.org(o.outletId).name)}` : ''}</p>
        <div class="btn-stack" style="margin-top:6px">${btn('attend', 'Accept', { cls: 'primary', arg: o.id })}${btn('noattend', 'Decline', { arg: o.id })}</div></div>`).join('')}` : ''}
      ${deals.length ? `<div class="section-label">Brand deals</div>${deals.map((d) => `<div class="card">${kv([[d.brand, d.status === 'signed' ? `Under contract until ${d.from + d.years - 1}` : `Offered: ${money(d.fee)} a year for ${d.years}`]])}${d.status === 'offered' ? `<div class="btn-stack">${btn('deal', 'Accept', { arg: d.id, cls: 'primary' })}${btn('nodeal', 'Decline', { arg: d.id })}</div>` : ''}</div>`).join('')}` : ''}
      <div class="section-label">In the press</div>
      ${items.length ? items.map((a) => `<div class="contact"><strong>${esc(a.text)}</strong><small>${a.year} · ${esc(ent.org(a.outletId)?.name ?? 'The press')} · ${esc(ACCURACY[a.accuracy])}${a.corrected ? ' · corrected' : ''}</small>
        ${['rumor', 'speculation', 'allegation'].includes(a.accuracy) && a.about === 'player' && !a.answered ? `<div class="btn-stack" style="margin-top:4px">${btn('answer', 'Say it is not true', { arg: `${a.id}:clarify` })}${btn('answer', 'Ask for a correction', { arg: `${a.id}:correction` })}${btn('answer', 'Say nothing', { arg: `${a.id}:ignore` })}</div>` : ''}</div>`).join('')
    : '<p class="muted">Nothing has been written about you.</p>'}`;
  },

  awards(p) {
    const list = awards.myAwards(p);
    return list.map((a) => row('season', a.season.id, `${a.won ? 'Won' : 'Nominated'}: ${a.cat.name}`, `${awards.bodyName(a.body, a.season.scope)}, ${a.season.ceremony} · ${ent.production(a.productionId)?.title ?? a.cat.nominees.find((n) => n.who === 'player')?.title ?? ''}`, a.won ? '★' : '')).join('')
      || '<p class="empty">No nominations yet. They come from the work, judged once a year.</p>';
  },

  connections(p) {
    return connections(p).map((n) => row('person', n.id, `${n.firstName} ${n.lastName}`, `${n.flags.title ?? n.occupation ?? ''} · ${ent.creditsOf(n.id).length} credits`, `${Math.round(n.meters.relationship)}%`, n)).join('')
      || '<p class="empty">You have not worked with anyone yet.</p>';
  },

  archive(p) {
    const w = ent.workOf(p);
    const credits = w.credits.map((c) => ({ c, x: ent.production(c.productionId) })).filter((y) => y.x);
    const group = (kinds, name) => { const list = credits.filter((y) => kinds.includes(y.x.kind)); return list.length ? `<div class="section-label">${name}</div>${list.map(({ c, x }) => row('production', x.id, x.title, `${c.year} · ${ROLE_KINDS[x.cast[c.idx].kind].name}: ${x.cast[c.idx].character} · ${TIERS[x.tier].name}`, x.awards.some((a) => a.won) ? '★' : '')).join('')}` : ''; };
    const school = (p.flags.performances ?? []).map((x) => `<div class="kv"><span>${esc(x.show)}${x.where ? `, ${esc(x.where)}` : ''}</span><span>${esc(x.role)}, ${x.year}</span></div>`).join('');
    const disc = music.discography(p);
    const records = disc.length ? `<div class="section-label">Records</div>${disc.map((r) => row('release', r.id, r.title, `${r.released} · ${RELEASE_TYPES[r.type].name} · ${music.act(r.actId)?.name ?? ''}${r.chart ? ` · chart #${r.chart}` : ''}`, (r.awards ?? []).some((a) => a.won) ? '★' : '')).join('')}` : '';
    const books = pub.bibliography(p);
    const shelf = books.length ? `<div class="section-label">Books</div>${books.map((b) => row('bookview', b.id, b.title, `${b.released} · ${BOOK_KINDS[b.kind].name}${b.list ? ` · bestseller #${b.list}` : ''}`, b.awards.some((x) => x.won) ? '★' : '')).join('')}` : '';
    return `${group(['film'], 'Films')}${group(['tv'], 'Television')}${group(['stage', 'musical'], 'Theater')}${group(['voice'], 'Voice work')}${group(['commercial'], 'Commercials')}${records}${shelf}
      ${school ? `<div class="section-label">At school and university</div>${school}` : ''}${!credits.length && !school && !disc.length && !books.length ? '<p class="empty">No credits yet.</p>' : ''}`;
  },

  production(p, id) {
    const x = ent.production(id);
    if (!x) return '<p class="empty">That production is no longer on record.</p>';
    const R = x.reception;
    const o = ent.org(x.orgId);
    return `<div class="card"><h3>${esc(x.title)}</h3>${kv([['What it is', `${kindName(x)}, ${x.genre}`], ['Made by', o?.name ?? '—'], ['Where', `${x.city}, ${COUNTRIES[x.countryId]?.name ?? ''}`], ['Directed by', nameOf(x.directorId)], ...(x.basedOn ? [['Based on', `the book by ${x.basedOn.author}`]] : []),
      ['When', `${x.workYear}${x.runYears > 1 ? `–${x.workYear + x.runYears - 1}` : ''}`], ['Status', { casting: 'Casting', production: 'In production', running: 'Running', released: 'Released', closed: 'Closed' }[x.status]],
      ...(R ? [['Critics', `${R.critics}/100`], ['Audiences', `${R.audience}/100`], [R.profit >= 0 ? 'Made' : 'Lost', money(Math.abs(R.profit), COUNTRIES[x.countryId])], ...(x.abroad.length ? [['Seen in', `${x.abroad.length} other ${x.abroad.length === 1 ? 'country' : 'countries'}`]] : [])] : [])])}</div>
      <div class="section-label">Cast</div>${x.cast.filter((r) => r.who).map((r) => { const n = r.who === 'player' ? null : store.state.npcs[r.who];
      return n ? row('person', n.id, `${n.firstName} ${n.lastName}`, `${ROLE_KINDS[r.kind].name}: ${r.character}${r.score != null ? ` · reviews ${r.score}` : ''}`, '', n) : r.who === 'player' ? `<div class="kv"><span>You</span><span>${esc(ROLE_KINDS[r.kind].name)}: ${esc(r.character)}${r.score != null ? ` · reviews ${r.score}` : ''}</span></div>` : ''; }).join('')}
      ${store.state.npcs[x.directorId] ? `<div class="section-label">Director</div>${row('person', x.directorId, nameOf(x.directorId), `Directed ${x.title}`, '', store.state.npcs[x.directorId])}` : ''}
      ${x.awards.length ? `<div class="section-label">Awards</div>${x.awards.map((a) => { const s = ent.ent().seasons[a.seasonId]; const body = BODIES.find((b) => b.id === s?.bodyId); return s ? row('season', s.id, `${a.won ? 'Won' : 'Nominated'}: ${s.categories[a.catId]?.name ?? ''}`, `${awards.bodyName(body, s.scope)}, ${s.ceremony}`) : ''; }).join('')}` : ''}`;
  },

  season(p, id) {
    const s = ent.ent().seasons[id];
    if (!s) return '<p class="empty">No record of that ceremony.</p>';
    const body = BODIES.find((b) => b.id === s.bodyId);
    return `<div class="card"><h3>${esc(awards.bodyName(body, s.scope))}, ${s.ceremony}</h3><p class="muted" style="margin:0">For work released or opened in ${s.year}. Decided once; this is the record.</p></div>
      ${Object.entries(s.categories).map(([catId, cat]) => `<div class="section-label">${esc(cat.name)}</div>${cat.nominees.map((n) => { const won = n.productionId === cat.winner.productionId && n.who === cat.winner.who;
        const who = n.who ? (n.who === 'player' ? 'You' : n.name ?? nameOf(n.who)) : null;
        if (n.bookId) { const bw = n.bookId === cat.winner.bookId; return row(pub.book(n.bookId) ? 'bookview' : 'none', n.bookId, `${bw ? '★ ' : ''}${n.title}`, `${n.name}${bw ? ' · winner' : ''}`); }
        if (n.releaseId) { const rwon = n.releaseId === cat.winner.releaseId; return row(music.release(n.releaseId) ? 'release' : 'none', n.releaseId, `${rwon ? '★ ' : ''}${n.name}, ${n.title}`, `${rwon ? 'Winner' : 'Nominee'}${n.who === 'player' ? ' · your act' : ''}`); }
        return row(ent.production(n.productionId) ? 'production' : 'none', n.productionId, `${won ? '★ ' : ''}${who ? `${who}, ` : ''}${n.title ?? ent.production(n.productionId)?.title ?? ''}`, won ? 'Winner' : 'Nominee'); }).join('')}`).join('')}`;
  },

  music(p) {
    const a = music.myAct(p);
    const f = music.musicOf(p);
    const c = country();
    const past = f.acts.map(music.act).filter((x) => x && x !== a);
    if (!a) {
      return `<div class="card"><h3>Your music</h3><p class="muted" style="margin:0">Songwriting ${music.songwriting(p)} · performing ${music.performing(p)}. Start on your own, or find people to play with.</p></div>
        <div class="btn-stack">${btn('solo', 'Perform as a solo artist')}${btn('band', 'Form a band', { sub: 'Choose from musicians looking for one.' })}</div>
        ${VIEWS.songcraft(p)}
        ${past.length ? `<div class="section-label">Acts you were in</div>${past.map((x) => row('act', x.id, x.name, `${x.kind === 'solo' ? 'Solo' : 'Band'} · ${x.formed}–${x.status === 'split' ? (x.history.at(-1)?.year ?? '') : 'still going'}`, x.status === 'split' ? 'Split' : 'Without you')).join('')}` : ''}`;
    }
    const fans = music.fanTotal(a);
    const rels = a.releases.map(music.release).filter(Boolean);
    const pending = rels.filter((r) => r.released == null);
    const deal = a.deal ? ent.org(a.deal.labelId) : null;
    const offerL = a.offer ? ent.org(a.offer.labelId) : null;
    const tours = a.tours.map(music.tour).filter(Boolean).slice(-3).reverse();
    const scales = Object.entries(VENUES).filter(([k]) => k !== 'bar');
    return `<div class="card"><h3>${esc(a.name)}</h3>${kv([['Act', `${a.kind === 'solo' ? 'Solo artist' : `Band of ${music.members(a).length}`}, ${a.genre}`], ['Since', String(a.formed)], ['Status', a.status === 'hiatus' ? 'On hiatus' : 'Active'],
      ['Fans', fans.toLocaleString('en-US')], ['Songs ready', String(f.songs.length)], ['Label', deal ? `${deal.name} (${Math.round(a.deal.royalty * 100)}%, ${a.deal.albumsOwed} albums owed${a.deal.unrecouped > 0 ? `, ${money(a.deal.unrecouped, COUNTRIES[a.countryId])} of the advance still to earn back` : ''})` : 'Independent']])}</div>
      ${offerL ? `<div class="card"><h3>A record deal</h3><p class="muted" style="margin:0">${esc(offerL.name)} (${offerL.tier === 'major' ? 'a major label' : 'an independent label'}) offers ${money(a.offer.advance, COUNTRIES[a.countryId])} up front, ${Math.round(a.offer.royalty * 100)}% royalties, ${a.offer.albums} albums. The advance is paid back from royalties first.</p>
        <div class="btn-stack">${btn('lawyer', 'Have a lawyer read it', { disabled: a.offer.lawyer })}${btn('negdeal', 'Ask for better terms', { disabled: a.offer.asked })}${btn('signdeal', 'Sign', { cls: 'primary' })}${btn('nodeal2', 'Turn it down')}</div></div>` : ''}
      ${a.status === 'active' ? `<div class="btn-stack">${btn('write', 'Write a song', { sub: `${2 - f.musicActs.writes} left this year` })}${btn('gig', 'Play a gig', { sub: `${4 - f.musicActs.gigs} left this year` })}
        ${Object.entries(RELEASE_TYPES).map(([k, t]) => btn('record', `Record ${aRelease(k)}`, { arg: k, disabled: f.songs.length < t.songs, sub: `${t.songs} ${t.songs === 1 ? 'song' : 'songs'}${a.deal ? ', label pays' : `, ${money(Math.round(localWage(t.cost, c)))}`}` })).join('')}
        ${scales.map(([k, v]) => btn('tour', `Tour: ${v.name.toLowerCase()}`, { arg: k, disabled: fans < v.fans, sub: fans < v.fans ? `Needs about ${v.fans.toLocaleString('en-US')} fans` : `${v.capacity.toLocaleString('en-US')} a night` })).join('')}
        ${a.kind === 'band' ? btn('addmember', 'Bring in a new member') : ''}</div>` : ''}
      ${VIEWS.songcraft(p)}
      <div class="btn-stack">${btn('hiatus', a.status === 'hiatus' ? 'End the hiatus' : 'Take a break')}${btn('leaveact', a.kind === 'solo' ? 'Stop performing' : 'Leave the band', { cls: 'danger' })}</div>
      ${pending.length ? `<p class="muted">Coming out at the turn of the year: ${pending.map((r) => esc(r.title)).join(', ')}.</p>` : ''}
      ${a.kind === 'band' ? `<div class="section-label">The band</div>${music.members(a).filter((m) => m.who !== 'player').map((m) => { const n = store.state.npcs[m.who]; return n ? row('person', n.id, `${n.firstName} ${n.lastName}`, `${m.role} · since ${m.from}`, `${Math.round(n.meters.relationship)}%`, n) : ''; }).join('') || '<p class="empty">Just you, for now.</p>'}` : ''}
      ${tours.length ? `<div class="section-label">Tours</div>${tours.map((t) => row('tourview', t.id, t.title, `${t.year} · ${t.dates.length} dates`, t.net == null ? 'Booked' : money(t.net, COUNTRIES[a.countryId]))).join('')}` : ''}
      ${rels.filter((r) => r.released != null).length ? `<div class="section-label">Releases</div>${rels.filter((r) => r.released != null).reverse().map((r) => row('release', r.id, r.title, `${RELEASE_TYPES[r.type].name}, ${r.released}${r.chart ? ` · chart #${r.chart}` : ''}`, `${r.critics}/100`)).join('')}` : ''}
      ${row('act', a.id, 'The story so far', `${a.history.length} moments`)}
      ${past.length ? `<div class="section-label">Acts you were in</div>${past.map((x) => row('act', x.id, x.name, `${x.formed}`, x.status === 'split' ? 'Split' : 'Without you')).join('')}` : ''}`;
  },

  sport(p) {
    const s = p.sport;
    const coaching = sports.isCoach(p) || p.coach ? VIEWS.coaching(p) : '';
    if (!sports.isAthlete(p) && !s?.seasons.length) return coaching;
    if (!s || (s.retiredYear && !s.seasons.length) || (!s.seasons.length && sports.isAthlete(p))) {
      const div = sports.divOf(p);
      return `<div class="card"><h3>Your sport</h3><p class="muted" style="margin:0">You play professionally. Rating ${sports.rating(p)}. ${s ? `Now: ${SPORTS[s.sport].name}, ${div === 'women' ? "women's" : "men's"}. ` : ''}You can change before your first season. Results are played out over each year, and your name is made by them.</p></div>
        <div class="btn-stack">${btn('sportdiv', div === 'women' ? "Compete in men's sport instead" : "Compete in women's sport instead", { sub: 'Whichever fits you' })}</div>
        <div class="btn-stack">${Object.entries(SPORTS).map(([k, d]) => btn('sport', d.name, { arg: k, disabled: !sports.playedIn(k, store.state.year, div), sub: !sports.playedIn(k, store.state.year, div) ? 'Not played professionally yet' : d.team ? 'A club, a league, a season' : d.fights ? 'Fights, a ranking, a title' : 'Tournaments against the same rivals' })).join('')}</div>${coaching}`;
    }
    const d = SPORTS[s.sport];
    const L = s.leagueId ? store.state.sports.leagues[s.leagueId] : null;
    const t = L ? sports.team(L.id, s.teamId) : null;
    const offer = s.offer ? sports.team(L.id, s.offer.teamId) : null;
    const last = L?.seasons.at(-1);
    return `<div class="card"><h3>${esc(d.name)}${t ? `: ${esc(t.name)}` : ''}</h3>${kv([['Status', s.retiredYear ? `Retired in ${s.retiredYear}` : 'Playing'], ['Rating', String(sports.rating(p))], ['Seasons', String(s.seasons.length)], ['Titles', String(s.titles.length)],
      ...(s.caps ? [['International caps', String(s.caps)]] : []), ...(s.medals.length ? [['Medals', s.medals.map((m) => `${m.medal} (${m.year})`).join(', ')]] : [])])}</div>
      ${offer ? `<div class="card"><h3>${esc(offer.name)} want you</h3><div class="btn-stack">${btn('transfer', `Move to ${offer.name}`, { cls: 'primary' })}${btn('notransfer', 'Stay')}</div></div>` : ''}
      ${last ? `<div class="section-label">${esc(L.name)}, ${last.year}</div>${last.table.slice(0, 12).map((r, i) => { const tm = sports.team(L.id, r[0]); return `<div class="kv"><span>${i + 1}. ${tm.id === s.teamId ? '<strong>' : ''}${esc(tm.name)}${tm.id === s.teamId ? '</strong>' : ''}</span><span>${L.sport === 'football' ? `${r[1]}-${r[2]}-${r[3]} · ${r[6]} pts` : `${r[1]}-${r[3]}`}</span></div>`; }).join('')}
        <p class="muted">Top scorer: ${esc(last.top.name)} (${last.top.value}). Player of the year: ${esc(last.best.name)}.</p>` : ''}
      ${s.seasons.length ? `<div class="section-label">Your seasons</div>${[...s.seasons].reverse().map((x) => `<div class="kv"><span>${x.year}${x.team ? ` · ${esc(x.team)}` : ''}</span><span>${d.team ? `${x.apps} games, ${x.stat} ${d.statName.toLowerCase()}, ${x.pos}${x.champion ? ' ★' : ''}` : `${x.stat} won · ranked ${x.rank}${x.medal ? ` · ${x.medal}` : ''}`}</span></div>`).join('')}` : ''}
      ${s.titles.length ? `<div class="section-label">Titles</div>${s.titles.map((x) => `<div class="kv"><span>${x.year}</span><span>${esc(x.name)}</span></div>`).join('')}` : ''}
      ${(s.injuries ?? []).length ? `<div class="section-label">Injuries</div>${s.injuries.map((x) => `<div class="kv"><span>${x.year}</span><span>${esc(x.what)}, ${x.weeks} weeks</span></div>`).join('')}` : ''}${coaching}`;
  },

  coaching(p) {
    const c = p.coach;
    const sportId = c?.sport ?? p.sport?.sport ?? 'football';
    const jobs = sports.isCoach(p) ? sports.coachingJobs(sportId, c?.div ?? sports.divOf(p), p) : [];
    return `<div class="card"><h3>Coaching</h3>${kv([['Coaching ability', String(sports.coachSkill(p))], ['Club', c?.teamId ? c.clubs.at(-1)?.name ?? '' : 'None'], ['Seasons in charge', String(c?.seasons.length ?? 0)]])}</div>
      ${!c?.teamId && jobs.length ? `<div class="section-label">Clubs looking for a head coach (${esc(SPORTS[sportId].name)})</div><div class="btn-stack">${jobs.map((j) => btn('coachjob', j.team.name, { arg: `${sportId}:${j.team.id}`, sub: j.league.name })).join('')}</div>` : ''}
      ${c?.seasons.length ? `<div class="section-label">In charge</div>${[...c.seasons].reverse().map((x) => `<div class="kv"><span>${x.year} · ${esc(x.team)}</span><span>${x.pos} of ${x.of}${x.champion ? ' ★' : ''}</span></div>`).join('')}` : ''}`;
  },

  modelling(p) {
    const m = modelling.modelOf(p);
    const ag = m.agencyId ? ent.org(m.agencyId) : null;
    const can = modelling.isModel(p);
    const list = can ? modelling.castings(p) : [];
    const willing = can && !ag ? modelling.agenciesWilling(p) : [];
    return `<div class="card"><h3>Modeling</h3>${kv([['Agency', ag?.name ?? 'None'], ['Your look', String(modelling.look(p))], ['Bookings', String(m.portfolio.length)]])}${can ? '' : '<p class="muted">You are not working as a model now.</p>'}</div>
      ${willing.length ? `<div class="section-label">Agencies that would take you</div><div class="btn-stack">${willing.map((a) => btn('agency', a.name, { arg: a.id, sub: `Reputation ${a.reputation}` })).join('')}</div>` : ''}
      ${list.length ? `<div class="section-label">Castings this year (${3 - m.castings.went} you can still go to)</div>${list.map((c) => (c.status === 'open' ? row('casting2', c.id, `${BOOKINGS[c.kind].name}: ${c.client}`, `${c.city}`, '') : `<div class="kv"><span>${esc(BOOKINGS[c.kind].name)}: ${esc(c.client)}</span><span>${c.status === 'booked' ? 'Booked' : 'Not this time'}</span></div>`)).join('')}` : ''}
      ${m.portfolio.length ? `<div class="section-label">Portfolio</div>${modelling.portfolio(p).map((x) => `<div class="kv"><span>${x.year} · ${esc(BOOKINGS[x.kind].name)}</span><span>${esc(x.client)}, ${esc(x.city)}</span></div>`).join('')}` : ''}`;
  },

  writing(p) {
    const w = pub.writingOf(p);
    const d = w.draft;
    const mine = w.books.map(pub.book).filter(Boolean);
    const unpublished = mine.filter((b) => b.status !== 'published');
    return `<div class="card"><h3>Writing</h3>${kv([['Your craft', String(pub.craft(p))], ['Books out', String(pub.published(p).length)], ['Writing now', d ? `${BOOK_KINDS[d.kind].name} (${d.genre}), ${d.sessions} of ${BOOK_KINDS[d.kind].sessions} seasons done` : 'Nothing']])}</div>
      <div class="btn-stack">${d ? btn('wsession', 'Write', { sub: `${3 - w.acts.sessions} seasons of work left this year` }) : btn('draft', 'Start a book')}</div>
      ${unpublished.map((b) => `<div class="card"><h3>${esc(b.title)}</h3><p class="muted" style="margin:0">${esc(BOOK_KINDS[b.kind].name)}, ${esc(b.genre)}, finished ${b.written}.</p>
        ${b.offers?.length ? `<div class="section-label">Offers</div><div class="btn-stack">${b.offers.map((o) => btn('bookoffer', ent.org(o.publisherId)?.name ?? 'A publisher', { arg: `${b.id}:${o.publisherId}`, sub: `${money(o.advance)} advance, ${Math.round(o.royalty * 100)}% royalties` })).join('')}</div>` : ''}
        <div class="btn-stack">${b.status === 'manuscript' && !pub.litAgentOnOffer() ? btn('queryagent', w.agent ? 'Look for a different literary agent' : 'Look for a literary agent', { arg: b.id, disabled: pub.litTriesLeft() <= 0, sub: pub.litTriesLeft() > 0 ? `Each takes their own cut. ${pub.litTriesLeft()} ${pub.litTriesLeft() === 1 ? 'look' : 'looks'} left this year.` : 'You have looked twice this year.' }) : ''}${btn('submit', w.agent ? `Have ${w.agent.name} send it out` : 'Send it to publishers', { arg: b.id, disabled: w.acts.queries >= 2 })}${btn('selfpub', 'Publish it yourself', { arg: b.id })}</div></div>`).join('')}
      ${pub.litAgentOnOffer() ? agentOffer(pub.litAgentOnOffer(), pub.litAgentOnOffer().flags.agent.agency, 'signlit', 'passlit', 'queryagent2', pub.litTriesLeft()) : ''}
      ${w.agent ? `<div class="card"><h3>Your agent</h3>${kv([['Agent', `${w.agent.name}, ${w.agent.agency}`], ['Their cut', `${Math.round((w.agent.commission ?? pub.AGENT_SHARE) * 100)}%`], ['Since', String(w.agent.since)]])}${store.state.npcs[w.agent.npcId] ? agentClients(store.state.npcs[w.agent.npcId]) : ''}${store.state.npcs[w.agent.npcId] ? row('person', w.agent.npcId, w.agent.name, 'Literary agent', '', store.state.npcs[w.agent.npcId]) : ''}<div class="btn-stack">${btn('dropagent', 'Part ways')}</div></div>` : ''}
      ${pub.bibliography(p).length ? `<div class="section-label">Your books</div>${[...pub.bibliography(p)].reverse().map((b) => row('bookview', b.id, b.title, `${b.released} · ${BOOK_KINDS[b.kind].name}${b.list ? ` · bestseller #${b.list}` : ''}`, `${b.critics}/100`)).join('')}` : ''}`;
  },

  bookview(p, id) {
    const b = pub.book(id);
    if (!b) return '<p class="empty">That book is no longer on record.</p>';
    const units = Object.values(b.units).reduce((s, n) => s + n, 0);
    return `<div class="card"><h3>${esc(b.title)}</h3>${kv([['By', b.authorName], ['What it is', `${BOOK_KINDS[b.kind].name}, ${b.genre}`], ['Publisher', b.publisherId ? ent.org(b.publisherId)?.name ?? '' : 'Self-published'], ['Out', b.released != null ? String(b.released) : 'Not yet'],
      ...(b.released != null ? [['Reviews', `${b.critics}/100`], ['Copies', units.toLocaleString('en-US')], ['Bestseller list', b.list ? `Number ${b.list}` : 'No'], ...(b.author === 'player' ? [['Earned', money(b.revenue.reduce((s, x) => s + x.toAuthor, 0) + (b.advance ?? 0))]] : [])] : [])])}</div>
      ${(b.foreign ?? []).length ? `<div class="section-label">Translations</div>${b.foreign.map((fr) => `<div class="kv"><span>${esc(COUNTRIES[fr.countryId]?.name ?? '')}</span><span>${fr.year} · ${money(fr.advance)}</span></div>`).join('')}` : ''}
      ${(b.options ?? []).length ? `<div class="section-label">On screen</div>${b.options.map((o) => { const pr = o.made ? ent.production(o.made) : null; return pr ? row('production', pr.id, `Film: ${pr.title}`, `${ent.org(o.orgId)?.name ?? ''} · ${pr.status}`) : `<div class="kv"><span>Optioned by ${esc(ent.org(o.orgId)?.name ?? 'a studio')}</span><span>until ${o.until}</span></div>`; }).join('')}` : ''}
      ${b.awards.length ? `<div class="section-label">Prizes</div>${b.awards.map((x) => { const s = ent.ent().seasons[x.seasonId]; return s ? row('season', s.id, `${x.won ? 'Won' : 'Shortlisted'}: ${s.categories[x.catId]?.name ?? ''}`, `${BOOK_AWARD.name}, ${s.ceremony}`) : ''; }).join('')}` : ''}`;
  },

  family(p) {
    const rec = [...(store.state.careerRecord ?? [])].reverse();
    const E = ent.ent();
    return `<p class="muted">The family's public lives. What each of them did is kept on the record; none of it is yours unless you did it.</p>
      ${rec.map((r) => {
    const id = r.npcId;
    const credits = id ? ent.creditsOf(id) : [];
    const acts = id ? Object.values(E.acts ?? {}).filter((a) => a.members.some((m) => m.who === id)) : [];
    const books = id ? Object.values(E.books ?? {}).filter((b) => b.author === id) : [];
    const wins = id ? Object.values(E.seasons).flatMap((s) => Object.values(s.categories).filter((c) => c.nominees.some((n) => n.who === id)).map((c) => ({ s, c, won: c.winner.who === id }))) : [];
    const sp = r.sport;
    const n = id ? store.state.npcs[id] : null;
    return `<div class="card"><h3>${esc(r.name)}</h3><p class="muted" style="margin:0">Generation ${r.gen} · ${r.born}–${r.died ?? ''}${r.topTitle ? ` · ${esc(r.topTitle)}` : ''}${r.fame?.legacy ? ` · remembered ${Math.round(r.fame.legacy)}/100` : ''}</p>
      ${credits.length ? `<div class="section-label">Credits</div>${credits.map((c) => row('production', c.production.id, c.production.title, `${c.production.workYear} · ${ROLE_KINDS[c.role.kind].name}`)).join('')}` : (r.credits?.length ? `<p class="muted">${r.credits.length} credits.</p>` : '')}
      ${acts.length ? `<div class="section-label">Music</div>${acts.map((a) => row('act', a.id, a.name, `${a.formed} · ${a.releases.length} records`)).join('')}` : ''}
      ${books.length ? `<div class="section-label">Books</div>${books.map((b) => row('bookview', b.id, b.title, `${b.released ?? ''}`)).join('')}` : ''}
      ${sp ? `<div class="section-label">Sport</div><div class="kv"><span>${esc(SPORTS[sp.sport]?.name ?? '')}</span><span>${sp.seasons} seasons, ${sp.titles} titles${sp.medals.length ? `, medals: ${sp.medals.join(', ')}` : ''}${sp.caps ? `, ${sp.caps} caps` : ''}</span></div>` : ''}
      ${wins.length ? `<div class="section-label">Awards</div>${wins.map((x) => row('season', x.s.id, `${x.won ? 'Won' : 'Nominated'}: ${x.c.name}`, `${x.s.ceremony}`)).join('')}` : ''}
      ${(r.businesses ?? []).length ? `<div class="section-label">Businesses</div>${r.businesses.map((b) => `<div class="kv"><span>${esc(b.name)}</span><span>from ${b.from}</span></div>`).join('')}` : ''}
      ${n ? row('person', n.id, 'Their page', 'Family and relationships', '', n) : ''}</div>`;
  }).join('') || '<p class="empty">No one before you is on the record.</p>'}`;
  },

  songcraft(p) {
    const f = music.musicOf(p);
    const credits = f.songCredits ?? [];
    return `<div class="section-label">Writing for others, and session work</div><div class="btn-stack">
      ${music.myAct(p) ? '' : btn('write', 'Write a song', { sub: `${2 - f.musicActs.writes} left this year · ${f.songs.length} ready` })}
      ${btn('pitch', 'Offer a song to another act', { disabled: !f.songs.length || !!f.musicActs.pitched, sub: f.songs.length ? 'Your best unused song. A fee now, a writer\'s share later.' : 'Write one first.' })}
      ${btn('session', 'Play a session', { sub: `On someone else's record, for a fee · ${3 - (f.musicActs.sessions ?? 0)} left this year` })}</div>
      ${credits.length ? `<div class="section-label">Songs you wrote for others</div>${credits.map((c) => { const r = music.release(c.releaseId); return r ? row('release', r.id, r.title, `${music.act(r.actId)?.name ?? ''} · ${r.released ?? 'coming out'}${r.chart ? ` · #${r.chart}` : ''}`) : ''; }).join('')}` : ''}`;
  },

  act(p, id) {
    const a = music.act(id);
    if (!a) return '<p class="empty">No record of that act.</p>';
    const all = [...new Map(a.members.map((m) => [m.who + m.from, m])).values()];
    return `<div class="card"><h3>${esc(a.name)}</h3>${kv([['Act', `${a.kind === 'solo' ? 'Solo artist' : 'Band'}, ${a.genre}`], ['Formed', String(a.formed)], ['Status', { active: 'Active', hiatus: 'On hiatus', split: 'Split up' }[a.status]]])}</div>
      ${a.kind === 'band' ? `<div class="section-label">Everyone who was in it</div>${all.map((m) => { const n = m.who === 'player' ? null : store.state.npcs[m.who]; const when = `${m.from}–${m.to ?? 'now'}`;
        return n ? row('person', n.id, `${n.firstName} ${n.lastName}`, `${m.role} · ${when}`, n.alive ? '' : 'Died', n) : `<div class="kv"><span>You</span><span>${esc(m.role)} · ${when}</span></div>`; }).join('')}` : ''}
      <div class="section-label">History</div>${a.history.map((h) => `<div class="kv"><span>${h.year}</span><span>${esc(h.text)}</span></div>`).join('')}
      ${a.releases.map(music.release).filter((r) => r?.released != null).length ? `<div class="section-label">Releases</div>${a.releases.map(music.release).filter((r) => r?.released != null).map((r) => row('release', r.id, r.title, `${RELEASE_TYPES[r.type].name}, ${r.released}`)).join('')}` : ''}
      ${a.status === 'split' && a.members.some((m) => m.who === 'player') && !music.myAct(p) ? `<div class="btn-stack">${btn('reunite', 'Try to get everyone back together', { arg: a.id })}</div>` : ''}`;
  },

  release(p, id) {
    const r = music.release(id);
    if (!r) return '<p class="empty">That record is no longer on file.</p>';
    const a = music.act(r.actId);
    const units = Object.values(r.units).reduce((s, n) => s + n, 0);
    const l = r.labelId ? ent.org(r.labelId) : null;
    const earned = r.revenue.reduce((s, x) => s + x.toAct, 0);
    return `<div class="card"><h3>${esc(r.title)}</h3>${kv([['By', a?.name ?? ''], ['What it is', `${RELEASE_TYPES[r.type].name}, ${r.songs} ${r.songs === 1 ? 'song' : 'songs'}`], ['Recorded', String(r.made)], ['Released', r.released != null ? String(r.released) : 'Not yet'], ['Label', l?.name ?? 'Self-released'],
      ...(r.released != null ? [['Critics', `${r.critics}/100`], ['Chart', r.chart ? `Number ${r.chart}` : 'Did not chart'], ['Bought or streamed', units.toLocaleString('en-US')], ['Countries', String(Object.keys(r.units).length)], ...(a && !a.npc || r.revenue.length ? [['Earned for the act', money(earned, COUNTRIES[a?.countryId] ?? country())]] : [])] : [])])}</div>
      ${a ? row('act', a.id, a.name, 'The act') : ''}
      ${(r.awards ?? []).length ? `<div class="section-label">Awards</div>${r.awards.map((x) => { const s = ent.ent().seasons[x.seasonId]; return s ? row('season', s.id, `${x.won ? 'Won' : 'Nominated'}: ${s.categories[x.catId]?.name ?? ''}`, `${MUSIC_AWARD.name}, ${s.ceremony}`) : ''; }).join('')}` : ''}`;
  },

  tourview(p, id) {
    const t = music.tour(id);
    if (!t) return '<p class="empty">No record of that tour.</p>';
    const a = music.act(t.actId);
    return `<div class="card"><h3>${esc(t.title)}</h3>${kv([['Year', String(t.year)], ['Venues', VENUES[t.scale].name], ['Dates', String(t.dates.length)], ...(t.net != null ? [['Tickets sold', t.dates.reduce((s, d) => s + d.sold, 0).toLocaleString('en-US')], ['Takings', money(t.gross, COUNTRIES[a.countryId])], ['Costs', money(t.cost, COUNTRIES[a.countryId])], [t.net >= 0 ? 'Made' : 'Lost', money(Math.abs(t.net), COUNTRIES[a.countryId])]] : [['Status', 'Booked; the shows happen this year']])])}</div>
      <div class="section-label">Dates</div>${t.dates.map((d) => `<div class="kv"><span>${esc(d.city)}, ${esc(COUNTRIES[d.countryId]?.name ?? '')}</span><span>${d.sold != null ? `${d.sold.toLocaleString('en-US')} of ${d.capacity.toLocaleString('en-US')}` : `${d.capacity.toLocaleString('en-US')} capacity`}</span></div>`).join('')}`;
  },
};

// ---------- Actions ----------

const ACTIONS = {
  production: (id, x) => x.go('production', id),
  release: (id, x) => x.go('release', id),
  act: (id, x) => x.go('act', id),
  bookview: (id, x) => x.go('bookview', id),
  sport: (k, x) => x.say(sports.chooseSport(k, sports.divOf())),
  sportdiv: (_, x) => { const p = player(); const div = sports.divOf(p) === 'women' ? 'men' : 'women'; p.flags.sportDiv = div; return x.say(p.sport ? sports.chooseSport(p.sport.sport, div) : { ok: true, text: `You will compete in ${div === 'women' ? "women's" : "men's"} sport.`, tone: 'neutral' }); },
  coachjob: (arg, x) => { const [sp, id] = arg.split(':'); return x.say(sports.takeCoachingJob(sp, id)); },
  transfer: (_, x) => x.say(sports.acceptTransfer()),
  notransfer: (_, x) => x.say(sports.declineTransfer()),
  agency: (id, x) => x.say(modelling.joinAgency(id)),
  async casting2(id, x) {
    const c = modelling.castings().find((y) => y.id === id);
    if (!c) return undefined;
    const v = await pickModal({ title: `${BOOKINGS[c.kind].name}: ${c.client}`, body: `${c.city}. The brief: ${c.brief ?? '(none given)'}`, cancel: 'Back',
      options: Object.entries(modelling.APPROACHES).map(([k, a]) => ({ value: k, label: a.label, sub: a.sub })) });
    if (v) await x.say(modelling.attendCasting(id, v));
    return undefined;
  },
  async draft(_, x) {
    const kind = await pickModal({ title: 'What kind of book?', options: Object.entries(BOOK_KINDS).map(([k, b]) => ({ value: k, label: b.name, sub: `${b.sessions} seasons of work` })) });
    if (!kind) return undefined;
    let genre = null;
    if (['novel', 'nonfiction'].includes(kind)) { genre = await pickModal({ title: 'About what?', options: BOOK_GENRES.filter((g) => !['memoir', 'poetry'].includes(g)).map((g) => ({ value: g, label: g })) }); if (!genre) return undefined; }
    return x.say(pub.startDraft(kind, genre));
  },
  wsession: (_, x) => x.say(pub.writeSession()),
  submit: (id, x) => x.say(pub.submit(id)),
  queryagent: (id, x) => x.say(pub.queryAgents(id)),
  queryagent2: (_, x) => { const b = pub.writingOf().books.map(pub.book).find((y) => y?.status === 'manuscript'); return b ? x.say(pub.queryAgents(b.id)) : undefined; },
  signlit: async (_, x) => { if (await confirmModal({ title: 'Sign with this agent?', body: pub.writingOf().agent ? 'They replace your current agent for anything not yet sold.' : 'They take their cut of everything your books earn from now on.', yes: 'Sign' })) await x.say(pub.signLitAgent()); },
  passlit: (_, x) => x.say(pub.passOnLitAgent()),
  findagent: (_, x) => x.say(press.findAgent()),
  signagent: async (_, x) => { const n = press.agentOnOffer(); if (n && await confirmModal({ title: `Sign with ${n.firstName} ${n.lastName}?`, body: ent.workOf().agent ? 'They replace your current agent. Contracts already signed still pay the old one.' : `They take ${Math.round(n.flags.agent.commission * 100)}% of what you earn through them.`, yes: 'Sign' })) await x.say(press.signAgent(n.id)); },
  passagent: (_, x) => x.say(press.passOnAgent()),
  dropagent: async (_, x) => { if (await confirmModal({ title: 'Part ways with your agent?', body: 'Books already sold stay as they are.', yes: 'Part ways' })) await x.say(pub.dropAgent()); },
  selfpub: async (id, x) => { if (await confirmModal({ title: 'Publish it yourself?', body: 'You keep more of each sale, and sell far fewer.', yes: 'Publish' })) await x.say(pub.selfPublish(id)); },
  bookoffer: (arg, x) => { const [b, o] = arg.split(':'); return x.say(pub.acceptOffer(b, o)); },
  async comeback(kind, x) {
    if (kind === 'memoir') { celebs.declineComeback('memoir'); return x.say(pub.startDraft('memoir')); }
    if (kind === 'reunion') { const o = celebs.comebackOffers().find((y) => y.kind === 'reunion'); celebs.declineComeback('reunion'); return x.say(music.reunite(o?.actId)); }
    return x.say(celebs.takeComeback(kind));
  },
  tourview: (id, x) => x.go('tourview', id),
  solo: (_, x) => x.say(music.formAct('solo')),
  async band(_, x) {
    const ms = music.musicians(player().countryId).slice(0, 8);
    const picked = [];
    for (let i = 0; i < 3; i++) {
      const v = await pickModal({ title: i ? 'Anyone else?' : 'Who do you play with?', body: 'Musicians looking for a band.', cancel: i ? 'That is the band' : 'Cancel',
        options: ms.filter((n) => !picked.includes(n.id)).map((n) => ({ value: n.id, label: `${n.firstName} ${n.lastName}, ${n.age}`, sub: `Sings ${n.flags.star.skill.singing} · plays ${n.flags.star.skill.music}` })) });
      if (!v) break;
      picked.push(v);
    }
    if (!picked.length) return undefined;
    const genre = await pickModal({ title: 'What do you play?', options: MUSIC_GENRES.map((g) => ({ value: g, label: g })) });
    if (!genre) return undefined;
    return x.say(music.formAct('band', { with: picked, genre }));
  },
  async addmember(_, x) {
    const a = music.myAct();
    const v = await pickModal({ title: 'A new member', cancel: 'Back', options: music.musicians(player().countryId).filter((n) => !a.members.some((m) => m.who === n.id)).slice(0, 8).map((n) => ({ value: n.id, label: `${n.firstName} ${n.lastName}, ${n.age}`, sub: `Sings ${n.flags.star.skill.singing} · plays ${n.flags.star.skill.music}` })) });
    if (v) await x.say(music.addMember(v));
  },
  write: (_, x) => x.say(music.writeSong()),
  pitch: (_, x) => x.say(music.pitchSong()),
  session: (_, x) => x.say(music.session()),
  gig: (_, x) => x.say(music.gig()),
  async record(type, x) {
    const vid = fame.exists('music_video');
    const v = await pickModal({ title: `Record ${aRelease(type)}`, body: 'Your best songs go on it. It comes out at the turn of the year.', cancel: 'Not yet',
      options: [{ value: 'plain', label: 'Record it' }, ...(vid ? [{ value: 'video', label: 'Record it, and make a video', sub: music.myAct()?.deal ? 'The label pays.' : 'Costs more; reaches more people.' }] : [])] });
    if (v) await x.say(music.record(type, { video: v === 'video' }));
    return undefined;
  },
  async tour(scale, x) {
    const a = music.myAct();
    const places = music.tourPlaces(a, scale).filter((c) => c !== player().countryId);
    const chosen = [player().countryId];
    if (places.length) {
      const v = await pickModal({ title: 'Where?', body: 'Places where enough people know your music.', cancel: 'Cancel', options: [{ value: 'home', label: 'At home only' }, { value: 'all', label: `At home and in ${places.length} ${places.length === 1 ? 'country' : 'countries'} abroad`, sub: places.slice(0, 5).map((c) => COUNTRIES[c].name).join(', ') }] });
      if (!v) return undefined;
      if (v === 'all') chosen.push(...places);
    }
    return x.say(music.planTour(scale, chosen));
  },
  lawyer: (_, x) => x.say(music.lawyer()),
  negdeal: (_, x) => x.say(music.negotiateDeal()),
  signdeal: async (_, x) => { if (await confirmModal({ title: 'Sign the deal?', body: 'The label will own the recordings you make for it.', yes: 'Sign' })) await x.say(music.signDeal()); },
  nodeal2: (_, x) => x.say(music.declineDeal()),
  hiatus: (_, x) => x.say(music.hiatus(music.myAct()?.status !== 'hiatus')),
  leaveact: async (_, x) => { if (await confirmModal({ title: 'Walk away?', body: 'The records stay on the record. The act may carry on without you.', yes: 'Leave', danger: true })) await x.say(music.leaveAct()); },
  reunite: (id, x) => x.say(music.reunite(id)),
  season: (id, x) => x.go('season', id),
  none: () => {},
  person: (id, x) => { const n = store.state.npcs[id]; if (n) openNpc(n, x.api); },
  async notice(arg, x) {
    const [pid, idx] = arg.split(':');
    const prod = ent.production(pid);
    const r = prod?.cast[Number(idx)];
    if (!r) return;
    const why = ent.whyNot(prod, r);
    const local = COUNTRIES[prod.countryId];
    const body = `${kindName(prod)}, ${prod.genre}, from ${ent.org(prod.orgId)?.name ?? 'a company'} in ${prod.city}. The part: ${ROLE_KINDS[r.kind].name.toLowerCase()}, ${r.character}, aged about ${r.ages[0]}–${r.ages[1]}. ${prod.workYear} work: ${PRODUCTION_KINDS[prod.kind].weeks} weeks${prod.runYears > 1 ? ` a year for ${prod.runYears} years` : ''}. ${r.fee ? `Pays about ${money(Math.round(localWage(r.fee, local)), local)}.` : 'Unpaid.'}${why ? ` ${why}` : ''}`;
    const go = await pickModal({ title: prod.title, body, cancel: 'Back', options: [{ value: 'go', label: 'Audition', disabled: !!why || !!ent.workOf().applied[arg], sub: ent.workOf().applied[arg] ? 'You have auditioned.' : '' }, { value: 'view', label: 'Look at the production and its cast' }] });
    if (go === 'view') return x.go('production', pid);
    if (go !== 'go') return undefined;
    const prep = await pickModal({ title: 'Preparing', options: [{ value: 'study', label: 'Learn the sides and make choices', sub: 'Free. Time well spent.' }, { value: 'coach', label: 'Work with a coach', sub: `About ${money(Math.round(600 * country().currency.scale))}.` }, { value: 'none', label: 'Go in fresh' }] });
    if (!prep) return undefined;
    const approach = await pickModal({ title: 'In the room', body: 'How do you play it? Directors see parts their own way; there is no one right answer.',
      options: [{ value: 'restrained', label: 'Quietly, from the inside' }, { value: 'bold', label: 'Big and brave' }, { value: 'playful', label: 'With a light touch, finding the humour' }] });
    if (!approach) return undefined;
    await x.say(ent.audition(pid, Number(idx), prep, approach));
    return undefined;
  },
  sign: async (id, x) => { if (await confirmModal({ title: 'Sign the contract?', body: 'You are committing the time. Pulling out later is not an option this contract gives you.', yes: 'Sign' })) await x.say(ent.sign(id)); },
  negotiate: (id, x) => x.say(ent.negotiate(id)),
  decline: (id, x) => x.say(ent.decline(id)),
  set: (arg, x) => { const [pid, a] = arg.split(':'); return x.say(ent.onSet(pid, a)); },
  agent: (id, x) => x.say(press.signAgent(id)),
  endagent: async (_, x) => { if (await confirmModal({ title: 'End the representation?', body: 'Your agent stops finding you work.', yes: 'End it', danger: true })) await x.say(press.endAgent()); },
  pub: (_, x) => x.say(press.hirePublicist()),
  nopub: (_, x) => x.say(press.letPublicistGo()),
  async privacy(_, x) {
    const v = await pickModal({ title: 'How much do you share?', options: [{ value: 'open', label: 'Openly', sub: 'Your relationships and life are part of the story.' }, { value: 'guarded', label: 'Your work, not your life' }, { value: 'private', label: 'Private', sub: 'Your private life stays private. The press respects it, mostly.' }] });
    if (v) await x.say(press.setPrivacy(v));
  },
  attend: (id, x) => x.say(press.attend(id)),
  noattend: (id, x) => x.say(press.declineOffer(id)),
  deal: (id, x) => x.say(press.acceptDeal(id)),
  nodeal: (id, x) => x.say(press.declineDeal(id)),
  answer: (arg, x) => { const [id, how] = arg.split(':'); return x.say(press.answer(id, how)); },
};

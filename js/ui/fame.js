// My Fame: your work, your audience, your legacy. One screen for the fame
// profile, the casting board, the work in progress, representation, the press,
// awards, the people met through the work, and the archive of credits.
// Records link to each other: a credit opens its production, a production its
// cast, a castmate their profile; an award opens its season and the other
// nominees. "Back" returns to where you were.
import { player, country, store } from '../state.js';
import { esc, fmtMoney, localWage } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { PRODUCTION_KINDS, TIERS, ROLE_KINDS, ACCURACY, AWARD_BODIES } from '../data/fame.js';
import { openModal, messageModal, pickModal, confirmModal } from './modals.js';
import { meterHtml } from './meter.js';
import { avatarSvg } from './avatar.js';
import { openNpc } from './tabs/people.js';
import * as fame from '../engine/fame.js';
import * as ent from '../engine/entertainment.js';
import * as press from '../engine/press.js';
import * as awards from '../engine/awards.js';
import * as skills from '../engine/skills.js';

const kv = (rows) => rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
const btn = (act, label, o = {}) => `<button type="button" class="btn ${o.cls ?? ''}" data-act="${act}"${o.arg != null ? ` data-arg="${esc(o.arg)}"` : ''}${o.disabled ? ' disabled' : ''}>${esc(label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`;
const face = (n) => `<div class="avatar">${avatarSvg({ age: n.age, gender: n.gender, appearance: n.appearance, seed: n.id, mood: n.meters.relationship, label: n.firstName })}</div>`;
const money = (n, c = country()) => fmtMoney(n, c);
const nameOf = (who) => (who === 'player' ? 'You' : who ? `${store.state.npcs[who]?.firstName ?? ''} ${store.state.npcs[who]?.lastName ?? ''}`.trim() || 'Someone' : '');
const kindName = (prod) => `${TIERS[prod.tier].name} ${PRODUCTION_KINDS[prod.kind].name.toLowerCase()}`;
const row = (act, arg, main, sub, side = '', n = null) => `<button type="button" class="row world-row" data-act="${act}" data-arg="${esc(arg)}">${n ? face(n) : ''}
  <div class="main"><strong>${esc(main)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>${side ? `<div class="side">${esc(side)}</div>` : ''}</button>`;

const TABS = [['overview', 'Overview'], ['casting', 'Opportunities'], ['work', 'Current work'], ['representation', 'Representation'], ['image', 'Public image'],
  ['awards', 'Awards'], ['connections', 'Connections'], ['archive', 'Archive']];

function tabsFor(p) {
  const f = ent.workOf(p);
  return TABS.filter(([id]) => {
    if (id === 'work') return ent.activeWork(p).length > 0 || f.contracts.some((c) => c.status === 'signed');
    if (id === 'representation') return p.age >= 12;
    if (id === 'awards') return awards.myAwards(p).length > 0;
    if (id === 'connections') return connections(p).length > 0;
    if (id === 'archive') return f.credits.length > 0 || (p.flags.performances ?? []).length > 0;
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
    ['Professional credits', String(ent.proCredits(p))]])}<p class="muted" style="margin-top:6px">Practise on the Pursuits tab: skill is what gets you the part, not fame.</p></div>
      ${upcoming.length ? `<div class="card"><h3>Signed for</h3>${upcoming.map((x) => row('production', x.id, x.title, `${kindName(x)} · ${x.workYear > store.state.year ? 'starts next year' : 'now'}`)).join('')}</div>` : ''}
      ${recent.length ? `<div class="card"><h3>Recent work</h3>${recent.map((x) => row('production', x.id, x.title, `${kindName(x)} · ${x.workYear}`)).join('')}</div>` : ''}
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
    const willing = press.agentsWilling(p).filter((x) => x.npc.id !== w.agent?.npcId);
    const pub = w.publicist ? store.state.npcs[w.publicist.npcId] : null;
    return `<div class="card"><h3>Agent</h3>${agent ? `${row('person', agent.id, `${agent.firstName} ${agent.lastName}`, `${ent.org(w.agent.orgId)?.name ?? ''} · since ${w.agent.since} · ${Math.round(w.agent.commission * 100)}%`, '', agent)}${btn('endagent', 'End the representation', { cls: 'danger' })}`
    : '<p class="muted">An agent finds parts, puts you up for them, and negotiates. They take a share, and guarantee nothing.</p>'}
      ${willing.length ? `<div class="section-label">Would take you on</div>${willing.map((x) => btn('agent', `${x.npc.firstName} ${x.npc.lastName}, ${x.org.name}`, { arg: x.npc.id, sub: `${x.org.tier === 'top' ? 'A leading agency' : x.org.tier === 'mid' ? 'A solid agency' : 'A small agency'} · ${x.npc.flags.agent.clients.length} clients you know of` })).join('')}`
    : !agent ? '<p class="muted">No agent will take you on yet. Credits, skill and a little recognition change that.</p>' : ''}</div>
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
    return `${group(['film'], 'Films')}${group(['tv'], 'Television')}${group(['stage', 'musical'], 'Theatre')}${group(['voice'], 'Voice work')}${group(['commercial'], 'Commercials')}
      ${school ? `<div class="section-label">At school and university</div>${school}` : ''}${!credits.length && !school ? '<p class="empty">No credits yet.</p>' : ''}`;
  },

  production(p, id) {
    const x = ent.production(id);
    if (!x) return '<p class="empty">That production is no longer on record.</p>';
    const R = x.reception;
    const o = ent.org(x.orgId);
    return `<div class="card"><h3>${esc(x.title)}</h3>${kv([['What it is', `${kindName(x)}, ${x.genre}`], ['Made by', o?.name ?? '—'], ['Where', `${x.city}, ${COUNTRIES[x.countryId]?.name ?? ''}`], ['Directed by', nameOf(x.directorId)],
      ['When', `${x.workYear}${x.runYears > 1 ? `–${x.workYear + x.runYears - 1}` : ''}`], ['Status', { casting: 'Casting', production: 'In production', running: 'Running', released: 'Released', closed: 'Closed' }[x.status]],
      ...(R ? [['Critics', `${R.critics}/100`], ['Audiences', `${R.audience}/100`], [R.profit >= 0 ? 'Made' : 'Lost', money(Math.abs(R.profit), COUNTRIES[x.countryId])], ...(x.abroad.length ? [['Seen in', `${x.abroad.length} other ${x.abroad.length === 1 ? 'country' : 'countries'}`]] : [])] : [])])}</div>
      <div class="section-label">Cast</div>${x.cast.filter((r) => r.who).map((r) => { const n = r.who === 'player' ? null : store.state.npcs[r.who];
      return n ? row('person', n.id, `${n.firstName} ${n.lastName}`, `${ROLE_KINDS[r.kind].name}: ${r.character}${r.score != null ? ` · reviews ${r.score}` : ''}`, '', n) : r.who === 'player' ? `<div class="kv"><span>You</span><span>${esc(ROLE_KINDS[r.kind].name)}: ${esc(r.character)}${r.score != null ? ` · reviews ${r.score}` : ''}</span></div>` : ''; }).join('')}
      ${store.state.npcs[x.directorId] ? `<div class="section-label">Director</div>${row('person', x.directorId, nameOf(x.directorId), `Directed ${x.title}`, '', store.state.npcs[x.directorId])}` : ''}
      ${x.awards.length ? `<div class="section-label">Awards</div>${x.awards.map((a) => { const s = ent.ent().seasons[a.seasonId]; const body = AWARD_BODIES.find((b) => b.id === s?.bodyId); return s ? row('season', s.id, `${a.won ? 'Won' : 'Nominated'}: ${s.categories[a.catId]?.name ?? ''}`, `${awards.bodyName(body, s.scope)}, ${s.ceremony}`) : ''; }).join('')}` : ''}`;
  },

  season(p, id) {
    const s = ent.ent().seasons[id];
    if (!s) return '<p class="empty">No record of that ceremony.</p>';
    const body = AWARD_BODIES.find((b) => b.id === s.bodyId);
    return `<div class="card"><h3>${esc(awards.bodyName(body, s.scope))}, ${s.ceremony}</h3><p class="muted" style="margin:0">For work released or opened in ${s.year}. Decided once; this is the record.</p></div>
      ${Object.entries(s.categories).map(([catId, cat]) => `<div class="section-label">${esc(cat.name)}</div>${cat.nominees.map((n) => { const won = n.productionId === cat.winner.productionId && n.who === cat.winner.who;
        const who = n.who ? (n.who === 'player' ? 'You' : n.name ?? nameOf(n.who)) : null;
        return row(ent.production(n.productionId) ? 'production' : 'none', n.productionId, `${won ? '★ ' : ''}${who ? `${who}, ` : ''}${n.title ?? ent.production(n.productionId)?.title ?? ''}`, won ? 'Winner' : 'Nominee'); }).join('')}`).join('')}`;
  },
};

// ---------- Actions ----------

const ACTIONS = {
  production: (id, x) => x.go('production', id),
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

// My Idol Life: from trainee to the spotlight. One screen for auditions,
// training, evaluations, survival programs, the group and its positions,
// performances and ending fairies, comebacks, the fandom, the agency and its
// contracts, and the whole idol history. Tabs appear only when they apply.
import { player, store } from '../state.js';
import { esc } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { FOCUSES, CONCEPTS, POSITIONS, APPROACHES, FAIRY_STYLES, RELEASE_KINDS, MISSIONS } from '../data/kpop.js';
import { openModal, messageModal, pickModal, confirmModal } from './modals.js';
import { avatarSvg } from './avatar.js';
import { openNpc } from './tabs/people.js';
import * as kp from '../engine/kpop.js';

const kv = (rows) => rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
const btn = (act, label, o = {}) => `<button type="button" class="btn ${o.cls ?? ''}" data-act="${act}"${o.arg != null ? ` data-arg="${esc(o.arg)}"` : ''}${o.disabled ? ' disabled' : ''}>${esc(label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`;
const face = (n) => `<div class="avatar">${avatarSvg({ age: n.age, gender: n.gender, appearance: n.appearance, seed: n.id, mood: n.meters.relationship, label: n.firstName })}</div>`;
const row = (act, arg, main, sub, side = '', n = null) => `<button type="button" class="row world-row" data-act="${act}" data-arg="${esc(arg)}">${n ? face(n) : ''}
  <div class="main"><strong>${esc(main)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>${side ? `<div class="side">${esc(side)}</div>` : ''}</button>`;
const npc = (id) => store.state.npcs[id] ?? null;
const name = (who) => (who === 'player' ? 'You' : npc(who) ? `${npc(who).firstName} ${npc(who).lastName}` : 'A former member');
const badges = (g, who) => (g.positions[who] ?? []).map((l) => `<span class="av-chip" style="display:inline-block;padding:1px 8px;margin:2px 4px 0 0">${esc(POSITIONS[l].name)}</span>`).join('');
const K = () => store.state.kpop;

const TABS = [['overview', 'Overview'], ['auditions', 'Auditions'], ['training', 'Training'], ['evaluations', 'Evaluations'], ['survival', 'Survival Academy'], ['group', 'My Group'],
  ['positions', 'Positions'], ['performances', 'Performances'], ['comebacks', 'Comebacks'], ['fandom', 'Fandom'], ['agency', 'Agency & Contracts'], ['history', 'Idol Career History']];

function tabsFor(p) {
  const i = kp.idolOf(p);
  const g = kp.myGroup(p) ?? kp.group(i.groupId);
  return TABS.filter(([id]) => ({
    auditions: !kp.trainee(p) && !kp.myGroup(p),
    training: !!kp.trainee(p) || !!kp.myGroup(p),
    evaluations: (i.trainee?.evals ?? []).length > 0,
    survival: kp.era('survival'),
    group: !!g,
    positions: !!g,
    performances: !!g?.performances.length,
    comebacks: !!kp.myGroup(p)?.debut,
    fandom: !!g?.debut,
    agency: (i.contracts ?? []).length > 0,
    history: i.history.length > 0,
  }[id] ?? true));
}

/** Opens My Idol Life. api: the tab api ({ changed }). */
export function openIdol(api, start = 'overview') {
  kp.world();
  const st = { stack: [{ view: start, arg: null }] };
  const modal = openModal('<div data-idol></div>', { dismissable: true });
  modal.el.classList.add('world-modal');
  const root = modal.el.querySelector('[data-idol]');
  const top = () => st.stack[st.stack.length - 1];
  const render = () => {
    const p = player();
    const t = top();
    const deep = st.stack.length > 1;
    const tabs = tabsFor(p);
    root.innerHTML = `<h2 style="margin:0">My Idol Life</h2><p class="muted" style="margin:0 0 6px">From trainee to the spotlight.</p>
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
    if (fn) await fn(b.dataset.arg, { say, render, go, api });
    return undefined;
  });
  render();
  return modal;
}

// ---------- Views ----------

const VIEWS = {
  overview(p) {
    if (!kp.available()) return `<div class="card"><h3>Become a K-pop Idol</h3><p class="muted">The modern idol industry has not begun yet in ${store.state.year}. It takes shape in Korea in the late 1990s.</p></div>`;
    const i = kp.idolOf(p);
    const t = kp.trainee(p);
    const g = kp.myGroup(p);
    const offer = kp.debutOffer(p);
    const fairies = kp.pendingFairies(p);
    const renew = kp.renewalDue(p);
    const s = kp.skillsOf();
    const skills = kv([['Vocals', String(s.vocal)], ['Dance', String(s.dance)], ['Rap', String(s.rap)], ['Stage presence', String(s.stage)], ['Camera', String(s.camera)], ['Media training', String(s.media)], ['Korean', String(s.korean)]]);
    const urgent = `${offer ? `<div class="card"><h3>You are in a debut line-up</h3><p>${esc(kp.agency(offer.agencyId).name)} wants you in its new ${offer.gender === 'female' ? 'girl' : 'boy'} group: ${offer.lineup.length} members, a ${esc(CONCEPTS[offer.concept].toLowerCase())} concept.</p>
        <div class="section-label">With</div>${offer.lineup.filter((w) => w !== 'player').map((w) => row('person', w, name(w), `${COUNTRIES[npc(w)?.bornIn]?.name ?? ''} · readiness ${kp.readiness(w)}`, '', npc(w))).join('')}
        <div class="btn-stack">${btn('debutyes', 'Accept: debut with them', { cls: 'primary' })}${btn('debutno', 'Turn it down')}</div></div>` : ''}
      ${fairies.length ? `<div class="card"><h3>You're this week's ending fairy!</h3><p class="muted" style="margin:0">${esc(fairies[0].show)}, ${esc(fairies[0].song)}. The producer has chosen you for the final close-up.</p><div class="btn-stack">${btn('fairy', 'Choose how to finish', { arg: fairies[0].id, cls: 'primary' })}</div></div>` : ''}
      ${kp.openRumor(p) ? `<div class="card"><h3>In the press</h3><p>${esc(kp.openRumor(p).text)}</p><div class="btn-stack">${btn('rumor', 'Confirm it', { arg: 'confirm', disabled: !kp.openRumor(p).true })}${btn('rumor', 'Deny it', { arg: 'deny', disabled: kp.openRumor(p).true, sub: kp.openRumor(p).true ? 'It is true: you will not lie about it.' : '' })}${btn('rumor', 'Say nothing', { arg: 'silence' })}</div></div>` : ''}
      ${renew ? `<div class="card"><h3>Your contract is up</h3><div class="btn-stack">${btn('renew', 'Decide', { cls: 'primary' })}</div></div>` : ''}`;
    if (g) {
      const a = kp.agency(g.agencyId);
      const last = K().releases[g.releases.at(-1)];
      return `${urgent}<div class="card"><h3>${esc(g.name)}</h3>${kv([['Agency', a.name], ['Status', g.status === 'preparing' ? 'Preparing to debut' : g.status], ['Your positions', (g.positions.player ?? []).map((l) => POSITIONS[l].name).join(' · ') || 'None official'],
        ['Fandom', g.fandom.name ? `${g.fandom.name}, about ${g.fandom.size.toLocaleString('en-US')}` : `about ${g.fandom.size.toLocaleString('en-US')} fans`], ['Your own following', String(Math.round(i.pop))],
        ['Latest release', last ? `${last.title} (${last.year}), ${last.reception ?? ''}` : 'None yet'], ['Music show wins', String(g.wins.length)], ...(i.hiatus ? [['You', `On a break ${i.hiatus.public}`]] : [])])}</div>
        ${g.status === 'preparing' ? `<div class="btn-stack">${btn('concept', 'Suggest a concept')}${btn('debut', 'Debut', { cls: 'primary', sub: 'The first release, and the first stages.' })}</div>` : ''}
        <div class="card"><h3>Your skills</h3>${skills}<p class="muted">A title is not a ceiling: you can be good at far more than your positions say.</p></div>`;
    }
    if (t) {
      const ev = K().evals[i.trainee.evals.at(-1)];
      return `${urgent}<div class="card"><h3>Trainee at ${esc(t.agency.name)}</h3>${kv([['Since', String(i.trainee.since)], ['Years trained', String(store.state.year - i.trainee.since)], ['This year\'s focus', FOCUSES[i.focus].name], ['Last evaluation', ev ? `${ev.outcome}, ${ev.rank} of ${ev.of}` : 'Not yet'],
        ['Next contract review', String(t.contract.reviewAt)], ['Where you live', i.residence ? `${t.contract.housing === 'dorm' ? 'The trainee dorm' : 'A room'} in ${i.residence.city} (${i.residence.visa})` : 'At home']])}<p class="muted">Debut is not promised, and no one knows when.</p></div>
        <div class="card"><h3>Your skills</h3>${skills}</div>`;
    }
    return `${urgent}<div class="card"><h3>Become a K-pop Idol</h3><p class="muted" style="margin:0">Audition. Train. Debut. Find your spotlight.</p></div>
      <div class="btn-stack">${btn('tab', 'View global auditions', { arg: 'auditions' })}${btn('tab', 'Explore agencies', { arg: 'agencies' })}${btn('tab', 'Survival programs', { arg: 'survival' })}${btn('practise', 'Improve audition skills', { sub: 'Singing, dance, rap: on the Pursuits tab.' })}${btn('about', 'Learn about trainee life')}</div>
      <div class="card"><h3>Your skills</h3>${skills}</div>`;
  },

  agencies() {
    return kp.agencies().map((a) => row('agencyview', a.id, a.name, `${a.kind === 'label' ? `A label of ${kp.agency(a.parent)?.name ?? ''}` : a.kind === 'joint' ? 'A joint venture' : 'Entertainment company'} · ${a.city} · strongest at ${a.focus}`, `${a.groups.length} groups`)).join('');
  },

  agencyview(p, id) {
    const a = kp.agency(id);
    if (!a) return '';
    const groups = a.groups.map(kp.group).filter(Boolean);
    return `<div class="card"><h3>${esc(a.name)}</h3>${kv([['Based in', `${a.city}, ${COUNTRIES[a.countryId].name}`], ['Founded', String(a.founded)], ['Training', `strongest at ${a.focus}`], ['Typical concepts', a.concepts.map((c) => CONCEPTS[c]).join(', ')],
      ['Trainees', `${a.trainees.length}, ${a.trainee.housing === 'dorm' ? 'in a dorm' : 'living at home'}`], ['Trainee costs', a.trainee.costs === 'covered' ? `Covered by the company${a.trainee.allowance ? ', with a small allowance' : ''}` : 'Shared'],
      ['Artist contracts', `${a.artist.years} years; members share ${Math.round(a.artist.artistShare * 100)}% of what is left after costs`], ['Solo work', a.artist.soloAllowed ? 'Allowed' : 'Not in the contract'], ['Rest and welfare', a.welfare >= 70 ? 'Taken seriously' : a.welfare >= 55 ? 'Average' : 'Demanding']])}</div>
      <div class="section-label">Staff</div>${Object.entries(a.staff).map(([job, sid]) => row('person', sid, name(sid), npc(sid)?.occupation ?? job, '', npc(sid))).join('')}
      <div class="section-label">Groups</div>${groups.map((g) => row('groupview', g.id, g.name, `${g.debut ? `debuted ${g.debut.year}` : 'preparing'} · ${g.status}`, `${g.fandom.size.toLocaleString('en-US')} fans`)).join('') || '<p class="empty">None yet.</p>'}`;
  },

  auditions(p) {
    if (!kp.available()) return '<p class="empty">There are no idol auditions yet.</p>';
    const list = kp.auditions();
    const mine = kp.idolOf(p).apps.map((id) => K().apps[id]).filter(Boolean).reverse();
    return `<p class="muted">Each agency runs its own calls. Passing the first round is not a place: there is a callback, an assessment, and the company's decision.</p>
      ${list.map((au) => { const why = kp.whyNotApply(au, p); const a = kp.agency(au.agencyId); return row('audition', au.id, `${a.name}: ${{ online: 'Online audition', in_person: 'In-person audition', global_casting: 'Global casting' }[au.format]}`, `Ages ${au.ages[0]}–${au.ages[1]} · ${au.lineup === 'any' ? 'any line-up' : au.lineup === 'female' ? 'girl group' : 'boy group'} · ${au.places === 'worldwide' ? 'open worldwide' : `in ${COUNTRIES[au.places[0]].name}`}${why ? ` · ${why}` : ''}`, why ? '' : 'Open'); }).join('')}
      ${mine.length ? `<div class="section-label">My applications</div>${mine.map((app) => row('application', app.id, kp.agency(app.agencyId).name, `${app.year} · ${app.category} · ${app.stage === 'callback' ? 'Callback waiting' : app.stage === 'offered' ? 'Offer waiting' : app.outcome ?? app.stage}`, app.stage === 'callback' || app.stage === 'offered' ? '!' : '')).join('')}` : ''}`;
  },

  application(p, id) {
    const app = K().apps[id];
    const a = kp.agency(app.agencyId);
    const o = app.offer;
    return `<div class="card"><h3>${esc(a.name)}</h3>${kv([['Applied', String(app.year)], ['Category', app.category], ['Stage', app.stage], ...Object.entries(app.scores).map(([k, v]) => [`${k} score`, String(v)])])}</div>
      ${app.stage === 'callback' ? `<div class="btn-stack">${btn('callback', 'Attend the callback', { arg: id, cls: 'primary' })}</div>` : ''}
      ${app.stage === 'offered' && o ? `<div class="card"><h3>The trainee agreement</h3>${kv([['Reviewed after', `${o.review} ${o.review === 1 ? 'year' : 'years'}`], ['Training costs', o.costs === 'covered' ? 'Covered by the company' : 'Shared'], ['Allowance', o.allowance ? 'A small monthly allowance' : 'None'], ['Housing', o.housing === 'dorm' ? `The trainee dorm in ${a.city}` : 'You live at home'], ['Leaving', o.exit]])}
        <div class="section-label">Rules</div>${o.rules.map((r) => `<p style="margin:2px 0">• ${esc(r)}</p>`).join('')}<p class="muted">Nobody promises a debut.</p>
        <div class="btn-stack">${p.age < 18 ? btn('guardian', kp.guardianOk(p) ? 'Your family has agreed' : 'Talk to your family', { arg: id, disabled: kp.guardianOk(p) }) : ''}${btn('accept', 'Accept', { arg: id, cls: 'primary', disabled: !kp.guardianOk(p) })}${btn('decline', 'Decline', { arg: id })}</div></div>` : ''}`;
  },

  training(p) {
    const t = kp.trainee(p);
    const g = kp.myGroup(p);
    const a = t?.agency ?? kp.agency(g?.agencyId);
    const i = kp.idolOf(p);
    const peers = t ? a.trainees.filter((id) => npc(id)?.flags.idol?.status === 'trainee').slice(0, 10) : kp.current(g).map((m) => m.who).filter((w) => w !== 'player');
    return `${t ? `<div class="card"><h3>This year's focus</h3><div class="btn-stack">${Object.entries(FOCUSES).map(([k, f]) => btn('focus', f.name, { arg: k, cls: i.focus === k ? 'primary' : '' })).join('')}</div></div>` : ''}
      <div class="card"><h3>Extra practice</h3><p class="muted" style="margin:0">${4 - i.acts.sessions} sessions left this year.</p><div class="btn-stack">${['vocal', 'dance', 'rap', 'korean', 'media', 'stage'].map((k) => btn('train', { vocal: 'Practice vocals', dance: 'Practice dance', rap: 'Practice rap', korean: 'Practice Korean', media: 'Media training', stage: 'Stage and camera' }[k], { arg: k })).join('')}${t ? btn('train', 'Speak with your coach', { arg: 'coach' }) : ''}</div></div>
      <div class="card"><h3>Your wellbeing</h3><div class="btn-stack">${btn('rest', 'Ask for rest or a lighter schedule', { sub: 'Asking is never held against you.' })}${i.hiatus ? btn('endhiatus', 'Return to activities') : btn('hiatus', 'Take a break')}</div></div>
      <div class="section-label">${t ? 'Fellow trainees' : 'Your members'}</div>${peers.map((id) => { const n = npc(id); return n ? row('peer', id, name(id), `${COUNTRIES[n.bornIn]?.name ?? ''} · ${['vocal', 'dance', 'rap'].sort((x, y) => n.flags.idol.sk[y] - n.flags.idol.sk[x])[0]} · rank ${n.flags.idol.lastRank ?? '–'}`, `${Math.round(n.meters.relationship)}%`, n) : ''; }).join('')}`;
  },

  evaluations(p) {
    const evs = (kp.idolOf(p).trainee?.evals ?? []).map((id) => K().evals[id]).filter(Boolean).reverse();
    return evs.map((e) => `<div class="card"><h3>${e.year}: ${esc(e.outcome)}</h3>${kv([['Rank', `${e.rank} of ${e.of}`], ...['vocal', 'dance', 'rap', 'stage', 'camera', 'team', 'growth'].map((k) => [k[0].toUpperCase() + k.slice(1), String(e.scores[k])])])}
      <p style="margin:6px 0 2px">"${esc(e.feedback[0])}"</p><p style="margin:2px 0">"${esc(e.feedback[1])}"</p>
      <div class="section-label">Evaluators</div>${e.evaluators.map((id) => row('person', id, name(id), npc(id)?.occupation ?? '', '', npc(id))).join('')}</div>`).join('') || '<p class="empty">No evaluations yet.</p>';
  },

  survival(p) {
    const now = kp.programs();
    const past = Object.values(K()?.programs ?? {}).filter((x) => x.year < store.state.year && x.contestants.some((c) => c.who === 'player'));
    return `<p class="muted">Survival programs are optional: most idols never appear on one.</p>
      ${now.map((pr) => { const why = kp.whyNotEnter(pr, p); const me = pr.contestants.find((c) => c.who === 'player'); return row('program', pr.id, pr.name, `Season ${pr.season} · ${pr.size} contestants · ${pr.slots} to debut · ${kp.votingLine(pr)}`, me ? (me.out ? (me.out === 'debut' ? 'Debut' : 'Out') : 'In it') : why ? '' : 'Casting'); }).join('') || '<p class="empty">No program is casting this year.</p>'}
      ${past.length ? `<div class="section-label">Past seasons</div>${past.map((pr) => row('program', pr.id, pr.name, `${pr.year} · ${pr.contestants.find((c) => c.who === 'player').out ?? ''}`)).join('')}` : ''}`;
  },

  program(p, id) {
    const pr = K().programs[id];
    const me = pr.contestants.find((c) => c.who === 'player');
    const why = kp.whyNotEnter(pr, p);
    const lastOrder = pr.log.at(-1)?.order ?? pr.contestants.map((c) => c.who);
    return `<div class="card"><h3>${esc(pr.name)}</h3>${kv([['Season', String(pr.season)], ['Run by', kp.agency(pr.agencyId).name], ['Where', COUNTRIES[pr.location]?.name ?? ''], ['How it decides', kp.votingLine(pr)], ['Status', pr.status], ...(me ? [['You', me.out ?? `still in, after ${pr.mission} missions`]] : [])])}</div>
      ${pr.status === 'casting' && !why ? `<div class="btn-stack">${btn('enter', 'Apply to be a contestant', { arg: id, cls: 'primary' })}</div>` : ''}
      ${pr.status === 'airing' && me && !me.out ? `<div class="card"><h3>Next: ${esc(MISSIONS[pr.mission].name)}</h3><div class="btn-stack">${Object.entries(APPROACHES).map(([k, a]) => btn('mission', a.name, { arg: `${id}:${k}` })).join('')}</div></div>` : ''}
      <div class="section-label">${pr.status === 'finished' ? 'The final ranking' : 'The ranking'}</div>${lastOrder.map((w, idx) => { const c = pr.contestants.find((x) => x.who === w); return row(w === 'player' ? 'none' : 'person', w, `${idx + 1}. ${name(w)}`, `${COUNTRIES[w === 'player' ? p.countryId : npc(w)?.bornIn]?.name ?? ''}${c?.out ? ` · ${c.out}` : ''}`, '', w === 'player' ? null : npc(w)); }).join('')}`;
  },

  group(p, id) {
    const g = id ? kp.group(id) : (kp.myGroup(p) ?? kp.group(kp.idolOf(p).groupId));
    if (!g) return '<p class="empty">No group.</p>';
    const cur = kp.current(g);
    const past = g.members.filter((m) => !cur.includes(m));
    const maknae = kp.maknaeOf(g);
    return `<div class="card"><h3>${esc(g.name)}</h3>${kv([['Agency', kp.agency(g.agencyId).name], ['Debut', g.debut ? String(g.debut.year) : 'Not yet'], ['Concept', CONCEPTS[g.concept]], ['Fandom', g.fandom.name ?? 'Not named yet'], ['Status', g.status], ['Releases', String(g.releases.length)], ['Music show wins', String(g.wins.length)], ['Awards', String(g.awards.length)]])}</div>
      <div class="section-label">Members</div>${cur.map((m) => { const n = m.who === 'player' ? null : npc(m.who); const age = m.who === 'player' ? p.age : store.state.year - (n?.flags.idol?.born.year ?? 0);
        return `<div class="card" style="padding:8px">${n ? row('person', n.id, name(m.who), `${age} · ${COUNTRIES[n.bornIn]?.name ?? ''}${n.flags.idol?.hiatus ? ` · on a break (${n.flags.idol.hiatus.kind === 'service' ? 'military service' : 'personal'})` : ''}`, `${Math.round(n.meters.relationship)}%`, n) : `<strong>You</strong> <small class="muted">${age} · ${COUNTRIES[p.countryId]?.name ?? ''}</small>`}<div>${badges(g, m.who)}${m.who === maknae && !(g.positions[m.who] ?? []).includes('maknae') ? '' : ''}</div></div>`; }).join('')}
      ${past.length ? `<div class="section-label">Former members</div>${past.map((m) => row(m.who === 'player' ? 'none' : 'person', m.who, name(m.who), `${m.from}–${m.to}${m.why ? ` · ${m.why}` : ''}`, '', m.who === 'player' ? null : npc(m.who))).join('')}` : ''}
      <div class="section-label">History</div>${g.history.slice(-15).reverse().map((h) => `<div class="kv"><span>${h.year}</span><span>${esc(h.text)}</span></div>`).join('')}
      ${g.status === 'disbanded' && g.members.some((m) => m.who === 'player') ? `<div class="btn-stack">${btn('reunion', 'Suggest a reunion', { arg: g.id })}</div>` : ''}`;
  },
  groupview: (p, id) => VIEWS.group(p, id),

  positions(p) {
    const g = kp.myGroup(p) ?? kp.group(kp.idolOf(p).groupId);
    if (!g) return '';
    const cur = kp.current(g);
    return `<p class="muted">One or two official positions each, never contradictory. The maknae is simply the youngest, from birth dates. A position is not the limit of what someone can do.</p>
      ${g.config.none ? '<p>This group has no fixed official positions.</p>' : ''}
      ${cur.map((m) => `<div class="kv"><span>${esc(name(m.who))}</span><span>${(g.positions[m.who] ?? []).map((l) => POSITIONS[l].name).join(' · ') || '—'}</span></div>`).join('')}
      <div class="section-label">How the positions have changed</div>${g.positionHistory.slice().reverse().map((h) => `<div class="card" style="padding:8px"><strong>${h.year}</strong> <small class="muted">${esc(h.reason)}</small>${Object.entries(h.positions).map(([w, l]) => `<div class="kv"><span>${esc(name(w))}</span><span>${l.map((x) => POSITIONS[x].name).join(' · ')}</span></div>`).join('')}</div>`).join('')}`;
  },

  performances(p) {
    const g = kp.myGroup(p) ?? kp.group(kp.idolOf(p).groupId);
    const list = (g?.performances ?? []).map((id) => K().performances[id]).filter(Boolean).reverse().slice(0, 40);
    return list.map((x) => row('perf', x.id, `${x.song} on ${x.show}`, `${x.year}, week ${x.week} · ending fairy: ${name(x.fairy)}${x.win ? ' · WIN' : ''}`, x.fairy === 'player' && !x.fairyStyle ? 'Choose!' : x.win ? '🏆' : '')).join('') || '<p class="empty">No stages yet.</p>';
  },

  perf(p, id) {
    const x = K().performances[id];
    const r = K().releases[x.releaseId];
    const parts = r?.songs[0]?.parts ?? {};
    return `<div class="card"><h3>${esc(x.song)}, ${esc(x.show)}</h3>${kv([['When', `${x.year}, week ${x.week}`], ['The stage', x.fans], ['Highlighted', name(x.highlight)], ['Ending fairy', name(x.fairy)], ...(x.fairyStyle ? [['Their finish', FAIRY_STYLES[x.fairyStyle].name], ['Fans', x.fairyResult]] : []), ['Result', x.win ? 'Won the week' : 'Did not win']])}</div>
      ${x.fairy === 'player' && !x.fairyStyle ? `<div class="btn-stack">${btn('fairy', 'Choose your ending fairy', { arg: id, cls: 'primary' })}</div>` : ''}
      <div class="section-label">Line distribution</div>${Object.entries(parts).sort((a2, b2) => b2[1].share - a2[1].share).map(([w, pt]) => `<div class="kv"><span>${esc(name(w))}</span><span>${pt.share}%${pt.climax ? ' · the climax' : ''}${pt.rap ? ' · rap' : ''}${pt.danceBreak ? ' · dance break' : ''}${pt.center ? ' · center' : ''}</span></div>`).join('')}`;
  },

  comebacks(p) {
    const g = kp.myGroup(p);
    const rels = g.releases.map((id) => K().releases[id]).filter(Boolean).reverse();
    return `<div class="card"><h3>Plan a comeback</h3><p class="muted" style="margin:0">A new release, promoted on the shows. Up to two a year. Not every comeback wins.</p><div class="btn-stack">${Object.entries(RELEASE_KINDS).map(([k, r]) => btn('comeback', r.name, { arg: k })).join('')}</div></div>
      <div class="card"><h3>More music</h3><div class="btn-stack">${btn('subunit', 'Propose a subunit', { sub: 'Two or three of you, a smaller group. The main group carries on.' })}${btn('japan', 'A Japanese release', { sub: 'For your fans in Japan. Japanese lessons help.' })}</div>
        ${kp.subunits(g).map((u) => row('groupview', u.id, u.name, `${u.formed} · ${u.status}`)).join('')}</div>
      <div class="card"><h3>Beyond music</h3><div class="btn-stack">${btn('acting', 'Look for acting work', { sub: 'Dramas cast known idols without an audition.' })}${btn('host', 'Host a music show', { sub: 'A year as a weekly live MC.' })}</div></div>
      <div class="card"><h3>Solo work</h3><p class="muted" style="margin:0">${esc(kp.soloOk(p) || 'You can release solo music and stay in the group.')}</p><div class="btn-stack">${btn('solo', 'Release a solo single', { disabled: !!kp.soloOk(p) })}</div></div>
      <div class="section-label">Discography</div>${rels.map((r) => `<div class="kv"><span>${r.year} · ${esc(r.title)}${r.solo ? ' (solo)' : ''}</span><span>${esc(RELEASE_KINDS[r.kind]?.name ?? 'Special')} · ${esc(r.reception ?? '')}${r.wins.length ? ` · ${r.wins.length} wins` : ''}</span></div>`).join('')}`;
  },

  fandom(p) {
    const g = kp.myGroup(p) ?? kp.group(kp.idolOf(p).groupId);
    const f = g.fandom;
    const regions = Object.entries(f.regions).sort((a2, b2) => b2[1] - a2[1]).slice(0, 6);
    return `<div class="card"><h3>${esc(f.name ?? 'Your fans')}</h3>${kv([['Fans, roughly', f.size.toLocaleString('en-US')], ['The devoted core', f.core.toLocaleString('en-US')], ['Engagement', `${f.engagement}/100`], ['Where they are', regions.map(([c]) => COUNTRIES[c]?.name).filter(Boolean).join(', ') || '—'], ['Fans of you in particular', String(Math.round(kp.idolOf(p).pop))]])}
      ${!f.name && g.debut ? btn('fandomname', 'Suggest a fandom name') : ''}</div>
      <div class="card"><h3>Lightstick and fan club</h3>${kv([['Lightstick', g.merch?.lightstick ? `A ${g.merch.lightstick.color} ${g.merch.lightstick.shape}${g.merch.lightstick.byMembers ? ', designed with the members' : ''}` : 'None yet'], ['Fan club', g.merch?.fanclub ? `${g.merch.fanclub.members.toLocaleString('en-US')} members, generation ${g.merch.fanclub.generations}` : 'Not open']])}
        ${(() => { const y = Object.keys(g.merch?.sales ?? {}).at(-1); const m = y ? g.merch.sales[y] : null; return m ? `<p class="muted" style="margin:4px 0">${y}: merchandise brought the group ${(m.lightsticks + m.fanclub + m.goods).toLocaleString('en-US')} (in its accounts, before the members' share).</p>` : ''; })()}
        <div class="btn-stack">${!g.merch?.lightstick ? btn('lightstick', 'Design the lightstick', { disabled: f.size < 15000, sub: f.size < 15000 ? 'Needs about 15,000 fans' : '' }) : ''}${!g.merch?.fanclub ? btn('fanclub', 'Open the official fan club', { disabled: f.size < 20000, sub: f.size < 20000 ? 'Needs about 20,000 fans' : '' }) : ''}</div></div>
      <div class="card"><h3>Out in public</h3><div class="btn-stack">${[['interview', 'Interview'], ['variety', 'Variety show'], ['radio', 'Radio'], ['fanmeeting', 'Fan meeting'], ['fansign', 'Fansign'], ['fancall', 'Fan call'], ['livestream', 'Livestream']].map(([k, l]) => btn('appear', l, { arg: k })).join('')}</div></div>
      <div class="card"><h3>Touring</h3><div class="btn-stack">${Object.entries(kp.TOURS).map(([k, t]) => btn('tour', t.name, { arg: k, disabled: f.size < t.fans, sub: f.size < t.fans ? `Needs about ${t.fans.toLocaleString('en-US')} fans` : `${t.shows} shows` })).join('')}</div>
      ${g.tours.slice(-4).reverse().map((t) => `<div class="kv"><span>${t.year} · ${esc(t.name)}</span><span>${t.sold ? `${t.sold.toLocaleString('en-US')} tickets` : 'Booked'}</span></div>`).join('')}</div>`;
  },

  agency(p) {
    const i = kp.idolOf(p);
    const cs = i.contracts.map((id) => K().contracts[id]).filter(Boolean).reverse();
    return `${cs.map((c) => `<div class="card"><h3>${c.kind === 'trainee' ? 'Trainee agreement' : 'Exclusive artist agreement'}: ${esc(kp.agency(c.agencyId).name)}</h3>${kv([['From', String(c.start)], ['Status', c.status], ...(c.kind === 'trainee' ? [['Review', `every ${c.review} ${c.review === 1 ? 'year' : 'years'}`], ['Training costs', c.costs], ['Housing', c.housing]] : [['Ends', String(c.ends)], ['Your share', `${Math.round(c.artistShare * 100)}% of what is left after costs, split between members`], ['Solo work', c.soloAllowed ? 'Allowed' : 'Not allowed']]), ...(c.ended ? [['Ended', `${c.ended.year}: ${c.ended.how}`]] : [])])}</div>`).join('')}
      ${kp.myGroup(p) ? `<div class="card"><h3>Your private life</h3><p class="muted" style="margin:0">${esc(kp.datingRuleText(kp.myGroup(p)))} Whatever a contract says, your life is your own.</p></div>` : ''}
      ${(kp.trainee(p) || kp.myGroup(p)) && p.countryId !== (kp.trainee(p)?.agency ?? kp.agency(kp.myGroup(p)?.agencyId))?.countryId ? `<div class="btn-stack">${btn('relocate', 'Move there properly', { sub: p.age >= 18 ? 'A work visa, sponsored by the agency.' : 'From eighteen.' , disabled: p.age < 18 })}</div>` : ''}
      <div class="btn-stack">${kp.trainee(p) ? btn('leave', 'Leave the trainee program', { cls: 'danger', sub: 'With notice. Nothing is charged back.' }) : ''}${btn('rest', 'Discuss your workload')}</div>`;
  },

  history(p) {
    const i = kp.idolOf(p);
    const fairies = i.fairies.map((id) => K().performances[id]).filter(Boolean);
    return `${fairies.length ? `<div class="section-label">Ending fairy archive</div>${fairies.reverse().map((x) => row('perf', x.id, `${x.song}, ${x.show}`, `${x.year} · ${FAIRY_STYLES[x.fairyStyle]?.name ?? ''} · ${x.fairyResult}`)).join('')}` : ''}
      <div class="section-label">Your story</div>${kp.arcs(p).filter((a) => a.status !== 'not begun').map((a) => `<div class="kv"><span>${esc(a.name)}</span><span>${a.status}${a.year ? `, ${a.year}` : ''}</span></div>`).join('') || '<p class="empty">Your story has not begun.</p>'}
      <div class="section-label">Your idol life</div>${i.history.slice().reverse().map((h) => `<div class="kv"><span>${h.year}</span><span>${esc(h.text)}</span></div>`).join('')}
      ${i.groups.length ? `<div class="section-label">Groups</div>${i.groups.map((id) => kp.group(id)).filter(Boolean).map((g) => row('groupview', g.id, g.name, `${g.formed} · ${g.status}`)).join('')}` : ''}`;
  },
};

// ---------- Actions ----------

const ACTIONS = {
  none: () => {},
  tab: (id, x) => x.go(id),
  about: () => messageModal({ title: 'Trainee life', body: 'Trainees practise singing, dance and sometimes rap, learn Korean and media skills, and are evaluated regularly. Some debut within a year; many train for several; many never debut. A trainee agreement is not a debut contract, and leaving is allowed. Agencies differ a great deal in how they treat their trainees.' }),
  practise: () => messageModal({ body: 'Singing, dance, rapping and public speaking are practised on the Pursuits tab, like any other skill.' }),
  agencyview: (id, x) => x.go('agencyview', id),
  groupview: (id, x) => x.go('groupview', id),
  person: (id, x) => { const n = npc(id); if (n) openNpc(n, x.api); },
  peer: async (id, x) => {
    const v = await pickModal({ title: name(id), options: [{ value: 'friend', label: 'Spend time together' }, { value: 'help', label: 'Ask for help' }, { value: 'support', label: 'Support them before an evaluation' }, { value: 'resolve', label: 'Clear the air' }, { value: 'profile', label: 'Open their profile' }] });
    if (v === 'profile') return ACTIONS.person(id, x);
    if (v) await x.say(kp.trainAction(v, id));
    return undefined;
  },
  audition: async (id, x) => {
    const au = K().auditions[id];
    const why = kp.whyNotApply(au);
    if (why) return messageModal({ body: why });
    const prep = await pickModal({ title: kp.agency(au.agencyId).name, body: 'Prepare first? A prepared tape is a better tape.', options: [{ value: 'prep', label: 'Prepare the audition properly' }, { value: 'go', label: 'Send it as it is' }] });
    if (!prep) return undefined;
    if (prep === 'prep') kp.prepare(id);
    const cat = await pickModal({ title: 'Which category?', options: au.categories.map((c) => ({ value: c, label: { vocal: 'Vocal', dance: 'Dance', rap: 'Rap', multi: 'Vocal, dance and performance' }[c] })) });
    if (cat) await x.say(kp.apply(id, cat));
    return undefined;
  },
  application: (id, x) => x.go('application', id),
  callback: (id, x) => x.say(kp.attendCallback(id)),
  guardian: (id, x) => x.say(kp.askGuardian(id)),
  accept: async (id, x) => { if (await confirmModal({ title: 'Become a trainee?', body: 'You can leave later with notice. Nobody promises you a debut.', yes: 'Accept' })) await x.say(kp.acceptOffer(id)); },
  decline: (id, x) => x.say(kp.declineOffer(id)),
  focus: (id, x) => x.say(kp.setFocus(id)),
  train: (k, x) => x.say(kp.trainAction(k)),
  rest: (_, x) => x.say(kp.requestRest()),
  hiatus: async (_, x) => { const v = await pickModal({ title: 'A break', body: 'You stay a member. The reason stays as private as you want.', options: [{ value: 'rest', label: 'To rest' }, { value: 'health', label: 'For my health' }, { value: 'personal', label: 'For personal reasons' }] }); if (v) await x.say(kp.startHiatus(v)); },
  endhiatus: (_, x) => x.say(kp.endHiatus()),
  leave: async (_, x) => { if (await confirmModal({ title: 'Leave the program?', body: 'You give notice. Nothing is charged back.', yes: 'Leave', danger: true })) await x.say(kp.leaveTraining()); },
  program: (id, x) => x.go('program', id),
  enter: (id, x) => x.say(kp.enterProgram(id)),
  mission: (arg, x) => { const [id, ap] = arg.split(':'); return x.say(kp.playMission(id, ap)); },
  debutyes: (_, x) => x.say(kp.acceptDebut()),
  debutno: async (_, x) => { if (await confirmModal({ title: 'Turn down the debut?', body: 'The group will debut without you.', yes: 'Turn it down', danger: true })) await x.say(kp.declineDebut()); },
  concept: async (_, x) => { const v = await pickModal({ title: 'A concept', options: Object.entries(CONCEPTS).map(([k, n]) => ({ value: k, label: n })) }); if (v) await x.say(kp.suggestConcept(v)); },
  debut: (_, x) => x.say(kp.debut()),
  fairy: async (id, x) => {
    const perf = K().performances[id];
    const v = await pickModal({ title: "You're this week's ending fairy!", body: `${perf.show}, ${perf.song}. The producer has chosen you for the final close-up. How will you finish?`, options: Object.entries(FAIRY_STYLES).map(([k, f]) => ({ value: k, label: f.name })) });
    if (v) await x.say(kp.chooseFairy(id, v));
  },
  perf: (id, x) => x.go('perf', id),
  comeback: async (kind, x) => {
    const c = await pickModal({ title: 'The concept', body: 'The agency has the final say, but may take your idea.', options: Object.entries(CONCEPTS).map(([k, n]) => ({ value: k, label: n })) });
    if (!c) return undefined;
    const lyrics = await confirmModal({ title: 'Write lyrics?', body: 'If your writing is good enough, you get a credit.', yes: 'Try', no: 'Leave it to the producers' });
    return x.say(kp.comeback(kind, c, { lyrics }));
  },
  solo: (_, x) => x.say(kp.soloRelease()),
  fandomname: async (_, x) => { const v = await pickModal({ title: 'A name for the fans', options: ['Lumi', 'Orbiters', 'Halos', 'Blooms', 'Wavers', 'Sparks', 'Petals', 'Comets'].map((n2) => ({ value: n2, label: n2 })) }); if (v) await x.say(kp.nameFandom(v)); },
  appear: async (kind, x) => { const v = await pickModal({ title: 'How do you play it?', options: [{ value: 'professional', label: 'Answer professionally' }, { value: 'funny', label: 'Go for the laugh' }, { value: 'leader', label: 'Let the leader speak' }, { value: 'member', label: 'Highlight another member' }, { value: 'music', label: 'Talk about the music' }] }); if (v) await x.say(kp.appearance(kind, v)); },
  tour: (k, x) => x.say(kp.planTour(k)),
  renew: async (_, x) => { const v = await pickModal({ title: 'Your contract is up', body: 'Every member decides for themselves.', options: [{ value: 'renew', label: 'Renew with the agency' }, { value: 'keep_group', label: 'Leave the agency, keep doing group activities', sub: 'If they agree.' }, { value: 'leave', label: 'Leave' }] }); if (v) await x.say(kp.decideRenewal(v)); },
  reunion: (id, x) => x.say(kp.proposeReunion(id)),
  rumor: (how, x) => x.say(kp.answerRumor(how)),
  async subunit(_, x) {
    const g = kp.myGroup();
    const picked = [];
    for (let n = 0; n < 2; n++) {
      const v = await pickModal({ title: n ? 'And one more?' : 'Who with?', cancel: n ? 'Just the two of us' : 'Cancel', options: kp.current(g).filter((m) => m.who !== 'player' && !picked.includes(m.who)).map((m) => ({ value: m.who, label: name(m.who), sub: (g.positions[m.who] ?? []).map((l) => POSITIONS[l].name).join(' · ') })) });
      if (!v) break;
      picked.push(v);
    }
    if (!picked.length) return undefined;
    return x.say(kp.formSubunit(picked));
  },
  japan: (_, x) => x.say(kp.japaneseRelease()),
  acting: async (_, x) => x.say(await kp.actingOffer()),
  host: (_, x) => x.say(kp.hostShow()),
  async lightstick(_, x) {
    const shape = await pickModal({ title: 'The shape', options: kp.LIGHTSTICK_SHAPES.map((v) => ({ value: v, label: v })) });
    if (!shape) return undefined;
    const color = await pickModal({ title: 'The color', options: kp.LIGHTSTICK_COLORS.map((v) => ({ value: v, label: v })) });
    if (color) await x.say(kp.designLightstick(shape, color));
    return undefined;
  },
  fanclub: (_, x) => x.say(kp.launchFanclub()),
  relocate: async (_, x) => { if (await confirmModal({ title: 'Move there for good?', body: 'You move your life: your home, your money into the local currency, your status to a sponsored work visa.', yes: 'Move' })) await x.say(await kp.relocate()); },
};

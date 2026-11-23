// Screens for royalty and nobility: the card on the Self tab, public duties,
// and giving up a title. The rules live in engine/royalty.js.
import { store, player, country } from '../state.js';
import { esc, fmtMoney, theCountry } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { ROYAL_RANKS } from '../data/royalty.js';
import * as crown from '../engine/royalty.js';
import { meterHtml } from './meter.js';
import { messageModal, pickModal, confirmModal } from './modals.js';
import { openDynasty } from './dynasty.js';
import * as dyn from '../engine/dynasty.js';
import * as fame from '../engine/reputation.js';
import * as throne from '../engine/reign.js';
import * as home from '../engine/household.js';
import * as peers from '../engine/peerage.js';
import * as royalEd from '../engine/royaled.js';
import { MONARCHIES } from '../data/royalty.js';
import { openModal } from './modals.js';
import { icon } from './kit.js';

const mood = (v) => (v >= 80 ? 'adored' : v >= 62 ? 'well liked' : v >= 45 ? 'tolerated' : v >= 28 ? 'unpopular' : 'in disgrace');

/** The card on the Self tab. Empty for a commoner in a country without a crown. */
export function royalCard() {
  const p = player();
  const r = p.royal;
  const m = crown.monarchy();
  if (!r) {
    const fallen = !m && MONARCHIES[country().id] ? dyn.house() : null;
    const far = !fallen && p.flags.formerRoyal ? store.state.dynasties?.[p.flags.formerRoyal.countryId] : null;
    const gone = fallen ?? far;
    if (gone && throne.abolished(gone)) {
      const head = dyn.monarchOf(gone);
      return `<div class="card"><h3>The former royal house</h3>
        <div class="kv"><span>The house</span><span>${esc(gone.name)}</span></div>
        <div class="kv"><span>The monarchy</span><span>Abolished in ${gone.abolishedYear}</span></div>
        <div class="kv"><span>Head of the house</span><span>${head.isPlayer ? 'You' : `${esc(head.name)}, age ${dyn.ageOf(head)}`}</span></div>
        ${p.flags.formerRoyal ? `<div class="kv"><span>You</span><span>${p.flags.exile ? 'In exile' : 'A private citizen, once royal'}</span></div>` : ''}
        
        <div class="btn-stack" style="margin-top:10px"><button class="btn" data-dynasty="${gone.countryId}">The family and its history</button>${head.isPlayer ? '<button class="btn" data-household>The family\'s own property</button>' : ''}</div></div>`;
    }
    if (!m) return '';
    const k = crown.court().monarch;
    return `<div class="card"><h3>The crown</h3>
      <div class="kv"><span>On the throne</span><span>${esc(crown.titleOf(country().id, 'monarch', k.gender))} ${esc(k.name)}, age ${k.age}</span></div>
      <div class="kv"><span>The house</span><span>${esc(dyn.house().name)}</span></div>
      <div class="kv"><span>You</span><span>A commoner</span></div>
      
      <div class="btn-stack" style="margin-top:10px"><button class="btn" data-dynasty>The royal family and its history</button></div></div>`;
  }
  const inFamily = ROYAL_RANKS.includes(r.rank);
  const pay = crown.allowance();
  const d = inFamily ? dyn.house(r.countryId) : null;
  const mon = d ? dyn.monarchOf(d) : null;
  const rows = [['Title', crown.standing(p)], ...(d ? [['House', d.name], ...(mon && !mon.isPlayer ? [['On the throne', `${dyn.nameOf(d, mon)}, age ${dyn.ageOf(mon)}`]] : [])] : []), ['How you came by it', { birth: 'By birth', marriage: 'By marriage', honor: 'Given by the crown' }[r.by]]];
  if (r.line && r.rank !== 'monarch') rows.push(['Place in line to the throne', String(r.line)]);
  if (pay && p.age >= 18) rows.push(['Allowance from the crown', `${fmtMoney(pay, country())} a year`]);
  if (inFamily) rows.push(['Home', 'A royal residence, rent free']);
  if (d) rows.push(['The crown', throne.typeWords(d).replace(/^an? /, '').replace(/^./, (ch) => ch.toUpperCase())]);
  if (r.countryId !== country().id) rows.push(['Held in', theCountry(COUNTRIES[r.countryId].name)]);
  return `<div class="card"><h3>${inFamily ? 'Royal life' : 'Your title'}</h3>
    ${rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('')}
    ${inFamily ? (() => {
    const rep = fame.summary();
    const loud = rep.stories[0];
    return `<div style="margin-top:10px">${rep.meters.map((m) => meterHtml(m.name, m.value, true)).join('')}${meterHtml('Support for the monarchy', d.standing, true)}</div>
      <p class="muted" style="margin-top:6px">${esc(rep.meters.map((m) => m.word).join('; ').replace(/^./, (c) => c.toUpperCase()))}.${loud ? ` In the newspapers: ${esc(loud.label)}, ${esc(loud.loud)}.` : ''}</p>`;
  })() : ''}
    <div class="btn-stack" style="margin-top:10px">
      ${inFamily ? `<button class="btn primary" data-dynasty>${icon('crown')}The Dynasty</button><button class="btn" data-reputation>${icon('news')}Reputation</button>` : ''}
      ${inFamily ? `<button class="btn" data-household>${icon('home')}Household and Residences</button>` : ''}
      ${peers.nobleRanks(r.countryId).length ? `<button class="btn" data-titles>${icon('medal')}Titles and Honors</button>` : ''}
      ${throne.canGovern() ? `<button class="btn" data-state>${icon('briefcase')}Affairs of State <small>${throne.powersLeft()} left this year</small></button>` : ''}
      ${royalEd.royalChild() && p.age >= 8 ? `<button class="btn" data-lessons>${icon('book')}Royal Lessons <small>${royalEd.lessonTaken() ? 'Done this year' : 'One this year'}</small></button>` : ''}
      ${crown.canDoDuties() && inFamily ? `<button class="btn" data-duties>${icon('people')}Public Duties <small>${crown.dutiesLeft()} left this year</small></button>` : ''}
      ${p.age >= 18 && !r.waiting ? `<button class="btn" data-renounce>${icon('exit')}${r.rank === 'monarch' && r.reigning ? 'Abdicate' : inFamily ? 'Step back from royal life' : 'Give up the title'}</button>` : ''}
    </div></div>`;
}

/** Wires the card's buttons. Call after the Self tab has drawn it. */
export function bindRoyalCard(el, api) {
  const book = el.querySelector('[data-dynasty]');
  if (book) book.onclick = () => openDynasty(undefined, book.dataset.dynasty || undefined);
  const titlesBtn = el.querySelector('[data-titles]');
  if (titlesBtn) titlesBtn.onclick = () => openTitles(api);
  const homeBtn = el.querySelector('[data-household]');
  if (homeBtn) homeBtn.onclick = () => openHousehold(api);
  const stateBtn = el.querySelector('[data-state]');
  if (stateBtn) stateBtn.onclick = () => openAffairs(api);
  const repBtn = el.querySelector('[data-reputation]');
  if (repBtn) repBtn.onclick = () => openReputation();
  const duties = el.querySelector('[data-duties]');
  if (duties) duties.onclick = () => openDuties(api);
  const lessons = el.querySelector('[data-lessons]');
  if (lessons) lessons.onclick = () => openLessons(api);
  const out = el.querySelector('[data-renounce]');
  if (out) out.onclick = () => openRenounce(api);
}

async function openLessons(api) {
  if (royalEd.lessonTaken()) return messageModal({ body: 'The palace schedule has room for one of these a year. The next is next year.' });
  const pick = await pickModal({
    title: 'Royal lessons',
    body: 'Lessons nobody else at school has. One a year, on top of ordinary school. Whether you take to them is up to you, not your title.',
    options: royalEd.lessonOptions().map((l) => ({ value: l.id, label: l.name, sub: l.why || `${l.sub}${l.years ? ` ${l.years} ${l.years === 1 ? 'year' : 'years'} so far.` : ''}`, disabled: !!l.why })),
  });
  if (!pick) return undefined;
  const r = royalEd.takeLesson(pick);
  api.changed();
  return messageModal({ body: r.text, tone: r.tone });
}

async function openDuties(api) {
  const c = country();
  if (crown.dutiesLeft() <= 0) return messageModal({ body: 'Your diary is full for the year.' });
  const pick = await pickModal({
    title: 'Public duties',
    body: `You can carry out ${crown.dutiesLeft()} more this year. Do none, and it will be noticed.`,
    options: crown.dutyOptions().map((d) => ({ value: d.id, label: d.name,
      sub: `${d.kind}.${d.risky ? ' It could go very well or very badly. Charm and wits help.' : d.cost ? ` Costs ${fmtMoney(d.cost, c)} of your own money.` : ''}` })),
  });
  if (!pick) return undefined;
  const r = crown.doDuty(pick);
  api.changed();
  return messageModal({ body: r.text, tone: r.tone });
}

async function openRenounce(api) {
  const r = player().royal;
  const monarch = r.rank === 'monarch' && r.reigning;
  const sure = await confirmModal({
    title: monarch ? 'Abdicate the throne?' : 'Give it all up?',
    body: `${monarch ? 'The crown will pass to someone else.' : 'You will be a private citizen.'} The allowance${ROYAL_RANKS.includes(r.rank) ? ' and the residence go' : ' goes'} with it, and it cannot be undone.`,
    yes: monarch ? 'Abdicate' : 'Give it up', danger: true,
  });
  if (!sure) return undefined;
  const res = crown.renounce();
  api.changed();
  return messageModal({ body: res.text, tone: res.tone });
}

/** The three reputations, what the newspapers are saying, and why each last moved. */
export function openReputation() {
  const rep = fame.summary();
  if (!rep) return;
  const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
  const m = openModal(`
    <h2>Reputation</h2>
    ${rep.meters.map((x) => `${meterHtml(x.name, x.value, true)}<p class="muted" style="margin:2px 0 10px">${esc(x.word[0].toUpperCase() + x.word.slice(1))}.</p>`).join('')}
    ${(() => { const d = dyn.house(player().royal.countryId); return `${meterHtml('Support for the monarchy', d.standing, true)}<p class="muted" style="margin:2px 0 10px">${esc(throne.supportWord(d))}. If it stays very low, the country will be asked whether it wants a crown at all.</p>`; })()}
    
    <div class="section-label">In the newspapers</div>
    ${rep.stories.length ? rep.stories.map((s) => `<div class="kv"><span>${esc(s.label[0].toUpperCase() + s.label.slice(1))}${s.truth ? '' : ' <em>(untrue)</em>'}</span><span>${esc(s.loud)}</span></div>`).join('') : '<p class="muted">Nothing about you, for once.</p>'}
    <div class="section-label">What changed, and why</div>
    ${rep.why.length ? rep.why.map((w) => `<div class="kv"><span>${w.year} · ${esc(w.name)} ${sign(w.delta)}</span><span>${esc(w.text)}</span></div>`).join('') : '<p class="muted">Nothing yet.</p>'}
    <button class="btn" data-close style="margin-top:14px">Close</button>`, { dismissable: true });
  m.el.querySelector('[data-close]').addEventListener('click', () => m.close());
}

/** What a reigning monarch can do this year. */
async function openAffairs(api) {
  if (throne.powersLeft() <= 0) return messageModal({ body: 'The red boxes are done for the year.' });
  const d = dyn.house(player().royal.countryId);
  const pick = await pickModal({
    title: 'Affairs of state',
    body: `This is ${throne.typeWords(d)}. You can do ${throne.powersLeft()} more ${throne.powersLeft() === 1 ? 'thing' : 'things'} this year.`,
    options: throne.powerOptions().map((x) => ({ value: x.id, label: x.name, sub: x.note })),
  });
  if (!pick) return undefined;
  if (pick === 'assembly' || pick === 'refuse' || pick === 'silence') {
    const sure = await confirmModal({ title: 'Are you certain?', body: pick === 'assembly' ? 'You will reign, and no longer rule. It cannot be undone.' : pick === 'refuse' ? 'If the country does not back you, the crown itself will be in question.' : 'It will be remembered for as long as your house is.', yes: 'Do it', danger: true });
    if (!sure) return undefined;
  }
  const r = throne.usePower(pick);
  api.changed();
  return messageModal({ body: r.text, tone: r.tone });
}

/** Where the family lives, and who works for the player. */
async function openHousehold(api) {
  for (;;) {
    const c = country();
    const res = home.residenceRows();
    const staff = home.canKeepStaff() ? home.staffRows() : [];
    const head = home.isHead();
    const money = (n) => (n === 0 ? '' : n > 0 ? `brings in ${fmtMoney(n, c)} a year` : `costs ${fmtMoney(-n, c)} a year`);
    const pick = await pickModal({
      title: 'Household and Residences',
      body: head ? 'As head of the family, its own houses are yours to keep up, open, restore or sell. The palaces belong to the country.' : 'The palaces belong to the country, and the family\'s own houses to its head. Your staff are yours.',
      cancel: 'Done',
      options: [
        ...res.map((r) => ({ value: `res:${r.id}`, label: r.name, disabled: r.state || !head,
          sub: `${r.note}${r.state ? '' : ` Worth about ${fmtMoney(r.value, c)}${money(r.yearly) ? `; ${money(r.yearly)}` : ''}.`}` })),
        ...staff.map((x) => ({ value: `staff:${x.id}`, label: x.name ? `${x.title}: ${x.name}` : `${x.title}: nobody`,
          sub: x.name ? `${x.skill[0].toUpperCase()}${x.skill.slice(1)}. With you ${x.years} ${x.years === 1 ? 'year' : 'years'}. ${fmtMoney(x.pay, c)} a year.` : `${x.does} ${fmtMoney(x.pay, c)} a year.` })),
      ],
    });
    if (!pick) return;
    const [kind, id] = pick.split(':');
    if (kind === 'res') {
      const act = await pickModal({ title: res.find((r) => r.id === id).name, options: home.residenceActions(id).map((a) => ({ value: a.id, label: a.label, sub: a.sub })), cancel: 'Back' });
      if (!act) continue;
      if (act === 'sell' && !(await confirmModal({ title: 'Sell it?', body: 'It has been the family\'s for generations, and it will not come back.', yes: 'Sell', danger: true }))) continue;
      const r = home.manageResidence(id, act);
      api.changed();
      await messageModal({ body: r.text, tone: r.tone });
    } else {
      const row = staff.find((x) => x.id === id);
      const what = row.name ? await pickModal({ title: `${row.title}: ${row.name}`, body: row.does, cancel: 'Back',
        options: [{ value: 'replace', label: 'Look for someone else', sub: 'Interview three people for the post.' }, { value: 'dismiss', label: 'Let them go', sub: 'Someone who leaves unhappy knows a great deal.' }] }) : 'replace';
      if (!what) continue;
      if (what === 'dismiss') { const r = home.dismiss(id); api.changed(); await messageModal({ body: r.text, tone: r.tone }); continue; }
      const who = await pickModal({ title: `A new ${row.title.toLowerCase()}`, body: 'Three people have been put forward. How good they are shows at interview. How loyal they will be does not.', cancel: 'Appoint nobody',
        options: home.candidates(id).map((x) => ({ value: x.index, label: `${x.name}, ${x.age}`, sub: `${x.skill[0].toUpperCase()}${x.skill.slice(1)}. ${x.manner}` })) });
      if (who == null) continue;
      const r = home.hire(id, who);
      api.changed();
      await messageModal({ body: r.text, tone: r.tone });
    }
  }
}

/** The nobility of the country: every title, who holds it, and its history. A monarch can create and revoke. */
async function openTitles(api) {
  const cid = player().royal.countryId;
  for (;;) {
    const list = peers.roll(cid);
    const can = peers.mayGrant();
    const pick = await pickModal({
      title: 'Titles and Honors',
      body: can ? 'As monarch you may create one title a year, and take any away. Titles pass to the eldest child unless they are given for life.' : 'The titles of the realm. Only the monarch can create or revoke them.',
      cancel: 'Done',
      options: [
        ...(can ? [{ value: 'new', label: 'Create a title', sub: 'For a relative, or for someone in your life.' }] : []),
        ...list.map((t) => ({ value: t.id, label: t.name,
          sub: t.status === 'active' ? `${t.isPlayer ? 'Yours' : `Held by ${t.holder}`}. Created ${t.created}${t.hereditary ? '' : ', for life'}.` : t.status === 'extinct' ? 'Extinct: the line ended.' : 'Revoked.' })),
      ],
    });
    if (!pick) return;
    if (pick === 'new') {
      const people = peers.candidates();
      if (!people.length) { await messageModal({ body: 'There is nobody suitable just now: grown relatives, friends, mentors and members of your household can be raised.' }); continue; }
      const who = await pickModal({ title: 'Who is to be raised?', cancel: 'Back', options: people.map((x, i) => ({ value: i, label: x.name, sub: `${x.kind === 'family' ? 'Family' : 'A commoner'}: ${x.sub}.` })) });
      if (who == null) continue;
      const rank = await pickModal({ title: 'What rank?', cancel: 'Back', options: peers.nobleRanks(cid).map((r) => ({ value: r[0], label: r[1] === r[2] ? r[1] : `${r[1]} or ${r[2]}` })) });
      if (!rank) continue;
      const kind = await pickModal({ title: 'For how long?', cancel: 'Back', options: [{ value: 'h', label: 'Hereditary', sub: 'It passes to their eldest child, and on down the family.' }, { value: 'l', label: 'For life', sub: 'It ends when they die.' }] });
      if (!kind) continue;
      const r = peers.grant(people[who].ref, rank, kind === 'h');
      api.changed();
      await messageModal({ body: r.text, tone: r.tone });
      continue;
    }
    const t = list.find((x) => x.id === pick);
    const act = await pickModal({ title: t.name, cancel: 'Back',
      body: `${t.history.map((h) => `${h.year}: ${h.text}`).join(' ')}`,
      options: t.canRevoke ? [{ value: 'revoke', label: 'Revoke this title', sub: 'It is your right. It is rarely forgiven.' }] : [] });
    if (act !== 'revoke') continue;
    if (!(await confirmModal({ title: `Revoke ${t.name}?`, body: `${t.holder} will lose it, and it will not be given again.`, yes: 'Revoke', danger: true }))) continue;
    const r = peers.revoke(t.id);
    api.changed();
    await messageModal({ body: r.text, tone: r.tone });
  }
}

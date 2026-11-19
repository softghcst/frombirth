// My Moments: what this year holds, the family's traditions, and what past
// years held. No calendar: everything here is this year, resolved at once.
import { store, player, country } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import { openModal, messageModal, pickModal, confirmModal } from './modals.js';
import * as mo from '../engine/moments.js';
import { OCCASIONS, STYLES, HOLIDAYS } from '../data/occasions.js';
import { roleLabel } from '../engine/relationships.js';
import { portrait, openNpc } from './tabs/people.js';

const GROUPS = [['birthdays', 'Birthdays'], ['school', 'School'], ['family', 'Family occasions'], ['holidays', 'Holidays'],
  ['traditions', 'Family traditions'], ['invitations', 'Invitations'], ['social', 'With friends']];
const ICON = { birthdays: '🎂', school: '🎓', family: '🏡', holidays: '🕯️', traditions: '🧺', invitations: '✉️', social: '🎲', none: '🔒' };

/** Chooses guests from people the player really knows. Resolves the chosen ids, or null. */
function chooseGuests(title, pool, chosen, one = false) {
  return new Promise((resolve) => {
    const picked = new Set(chosen);
    const m = openModal(`
      <h2>${esc(title)}</h2>
      <p class="body">${one ? 'Choose who goes with you, or nobody.' : 'Tick everyone who is coming.'}</p>
      <div class="mo-guests" role="group" aria-label="Guests">${pool.map((n) => `
        <label class="row mo-guest">${portrait(n)}
          <span class="main"><strong>${esc(n.firstName)} ${esc(n.lastName)}</strong><small>${esc(roleLabel(n))}, age ${n.age}</small></span>
          <input type="${one ? 'radio' : 'checkbox'}" name="g" value="${n.id}" ${picked.has(n.id) ? 'checked' : ''}></label>`).join('') || '<p class="muted">There is nobody to invite.</p>'}</div>
      <div class="btn-row" style="margin-top:12px"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-ok>Next</button></div>`,
    { dismissable: true, onDismiss: () => resolve(null) });
    m.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-cancel]')) { m.close(); return resolve(null); }
      if (e.target.closest('[data-ok]')) { const ids = [...m.el.querySelectorAll('input:checked')].map((x) => x.value); m.close(); return resolve(ids); }
      return undefined;
    });
  });
}

/** Choose occasion → choose guests → choose style → confirm. */
async function plan(item, api) {
  const c = country();
  const o = OCCASIONS[item.occasion] ?? {};
  const holiday = item.holiday ? HOLIDAYS.find((h) => h.id === item.holiday) : null;
  // Guests: some occasions have none to choose; a dance takes a date; the rest take whoever the player asks.
  let guests = mo.suggestedGuests(item);
  const kind = holiday || item.traditionId ? 'family' : o.guests;
  if (kind && item.occasion !== 'anniversary' && item.occasion !== 'visit_grandparents') {
    const pool = mo.guestPool(kind === true ? 'all' : kind);
    const ids = await chooseGuests(kind === 'date' ? 'Who are you going with?' : `Who is coming to ${item.label.charAt(0).toLowerCase() + item.label.slice(1)}?`, pool, guests, kind === 'date');
    if (ids == null) return undefined;
    guests = ids;
  }
  // Style, where there is a choice.
  let style = null;
  if (o.styles) {
    style = await pickModal({ title: 'How big?', options: o.styles.map((id) => ({ value: id, label: STYLES[id].name,
      sub: `${STYLES[id].blurb} About ${fmtMoney(mo.costOf(item, guests.length, id), c)}.` })) });
    if (!style) return undefined;
  }
  // A tradition, if this could become one.
  let makeTradition = false;
  if (mo.canFound(item)) {
    const t = await pickModal({ title: 'Every year?', body: 'Some families do this every year without fail. It would happen each year from now on, unless you skip it.',
      options: [{ value: 'no', label: 'Just this once' }, { value: 'yes', label: 'Make it a family tradition', sub: 'It carries on each year, and passes down the family.' }] });
    if (!t) return undefined;
    makeTradition = t === 'yes';
  }
  const cost = mo.costOf(item, guests.length, style);
  const who = guests.map((id) => store.state.npcs[id]?.firstName).filter(Boolean);
  const sure = await confirmModal({ title: item.label, yes: 'Go ahead',
    body: `${who.length ? `With ${who.join(', ')}. ` : ''}${style ? `${STYLES[style].name}. ` : ''}${cost ? `About ${fmtMoney(cost, c)}${mo.familyPays() ? ', which your family will pay' : ''}.` : 'It costs nothing.'}${makeTradition ? ' And every year after.' : ''}` });
  if (!sure) return undefined;
  return mo.celebrate({ key: item.key, guests, style, makeTradition });
}

async function traditionFlow(t, api) {
  const item = mo.thisYear().find((x) => x.traditionId === t.id);
  const act = await pickModal({ title: t.name, body: `Begun in ${t.founded} by ${t.founder.name}. Kept ${t.count} ${t.count === 1 ? 'time' : 'times'}.`,
    options: [
      { value: 'keep', label: 'Keep it this year', disabled: !item || item.done, sub: item?.done ? 'Done for this year.' : 'Choose who comes, now.' },
      { value: 'skip', label: 'Skip it this year', disabled: !item || item.done, sub: `Skip ${3} years running and it fades.` },
      ...(t.hostId !== 'you' ? [{ value: 'host', label: 'Offer to host it', disabled: player().age < 18 }] : []),
      { value: 'history', label: 'Its history' }] });
  if (act === 'keep') return plan(item, api);
  if (act === 'skip') return mo.skipTradition(t.id);
  if (act === 'host') return mo.takeOver(t.id);
  if (act === 'history') return messageModal({ title: t.name, body: t.history.map((h) => `${h.year}: ${h.text}`).join(' ') });
  return undefined;
}

export function openMoments(api) {
  let tab = 'year';
  const m = openModal('<div class="mm" data-mo></div>', { dismissable: true });
  m.el.classList.add('mm-modal');
  const root = m.el.querySelector('[data-mo]');

  const yearHtml = () => {
    const items = mo.thisYear();
    if (!items.length) return '<p class="empty">Nothing to mark yet.</p>';
    return GROUPS.map(([g, title]) => {
      const list = items.filter((x) => x.group === g);
      if (!list.length) return '';
      return `<div class="section-label">${esc(title)}</div>${list.map((x) => `
        <button class="row ${x.done ? 'mo-done' : ''}" data-key="${esc(x.key)}" ${x.done || !x.ok ? 'aria-disabled="true"' : ''}>
          <div class="avatar glyph" aria-hidden="true">${x.done ? '✓' : ICON[g]}</div>
          <div class="main"><strong>${esc(x.label)}</strong><small>${esc(x.done ? 'Done this year.' : x.ok ? x.sub : x.reason)}</small></div>
        </button>`).join('')}`;
    }).join('') + '';
  };
  const traditionsHtml = () => {
    const list = mo.traditions();
    if (!list.length) return '<p class="empty">Your family has no traditions yet. Celebrate a holiday, or bring everyone together, and you can make it one.</p>';
    return list.map((t) => { const host = t.hostId === 'you' ? 'You host it' : t.hostId ? `${store.state.npcs[t.hostId]?.firstName ?? 'Someone'} hosts it` : 'Nobody hosts it';
      return `<button class="row" data-trad="${t.id}"><div class="avatar glyph" aria-hidden="true">🧺</div>
        <div class="main"><strong>${esc(t.name)}</strong><small>${t.status === 'active' ? `${host} · since ${t.founded} · kept ${t.count} ${t.count === 1 ? 'time' : 'times'}` : t.status === 'lapsed' ? `Faded · last kept ${t.lastYear}` : 'Ended'}</small></div></button>`; }).join('')
      + '';
  };
  const pastHtml = () => {
    const years = [...(player().momentsYears ?? [])].reverse();
    return years.length ? `<div class="card">${years.map((y) => `<div class="kv"><span>${y.year}, age ${y.age}</span><span>${esc(y.lines.join(' · '))}</span></div>`).join('')}</div>`
      : '<p class="empty">Nothing yet. Each year you age up, what it held is kept here.</p>';
  };

  function render() {
    const tabs = [['year', 'This Year'], ['traditions', 'Traditions'], ['past', 'Past years']];
    root.innerHTML = `
      <div class="mm-head"><div><h2>My Moments</h2><p class="muted">${store.state.year}: what this year holds.</p></div>
        <button class="icon-btn" data-close aria-label="Close My Moments">✕</button></div>
      <nav class="mm-nav" aria-label="My Moments sections">${tabs.map(([id, name]) => `<button class="mm-chip ${id === tab ? 'on' : ''}" data-tab="${id}" ${id === tab ? 'aria-current="page"' : ''}>${name}</button>`).join('')}</nav>
      <div class="mm-body">${{ year: yearHtml, traditions: traditionsHtml, past: pastHtml }[tab]()}</div>`;
  }
  async function settle(r) {
    api.changed();
    if (!player().alive) return m.close();
    render();
    if (r?.text) await messageModal({ body: r.text, tone: r.tone });
    return undefined;
  }
  root.addEventListener('click', async (e) => {
    const on = (sel) => e.target.closest(sel);
    if (on('[data-close]')) return m.close();
    if (on('[data-tab]')) { tab = on('[data-tab]').dataset.tab; return render(); }
    const key = on('[data-key]')?.dataset.key;
    if (key) {
      const item = mo.thisYear().find((x) => x.key === key);
      if (!item) return undefined;
      if (item.done) return messageModal({ body: 'That is done for this year.' });
      if (!item.ok) return messageModal({ body: item.reason });
      if (item.inviteId) {
        const yes = await pickModal({ title: item.label, body: item.sub, options: [{ value: 'yes', label: 'Go' }, { value: 'no', label: 'Send your apologies' }] });
        return yes ? settle(mo.answerInvite(item.inviteId, yes === 'yes')) : undefined;
      }
      if (item.traditionId) return settle(await traditionFlow(mo.traditions().find((t) => t.id === item.traditionId), api));
      return settle(await plan(item, api));
    }
    const tid = on('[data-trad]')?.dataset.trad;
    if (tid) {
      const t = mo.traditions().find((x) => x.id === tid);
      if (t.status === 'lapsed') { const back = await confirmModal({ title: t.name, body: `It faded after ${t.lastYear}. Bring it back, with you hosting?`, yes: 'Bring it back' }); return back ? settle(mo.revive(tid)) : undefined; }
      return settle(await traditionFlow(t, api));
    }
    const nid = on('[data-npc]')?.dataset.npc;
    if (nid && store.state.npcs[nid]) openNpc(store.state.npcs[nid], api);
    return undefined;
  });
  render();
}

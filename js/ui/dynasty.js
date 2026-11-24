// The dynasty journal: the royal house of the country, as a book you can
// leaf through. Monarchs back to the founder, the living family, the line of
// succession with the reason for each place, and the house's history year by
// year. Tap anyone, living or long dead, for their portrait and their story.
import { store, player, country } from '../state.js';
import { esc, theCountry } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import * as dyn from '../engine/dynasty.js';
import { relationTo } from '../engine/succession.js';
import { avatarSvg, royalDress } from './avatar.js';
import { openModal } from './modals.js';

const ORD = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4]}`;
const LAW = {
  absolute: 'The eldest child inherits, son or daughter.',
  malePreference: 'Sons inherit before daughters; a daughter inherits where there is no son.',
  maleOnly: 'Only men inherit, and only through their fathers.',
};
const list = (words) => (words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);

const face = (x, year, d) => avatarSvg({ age: Math.max(0, dyn.ageOf(x, year)), gender: x.gender, appearance: x.look, seed: x.id, mood: 62, royal: d ? royalDress(dyn.rankOf(d, x), false, d.countryId) : null });
const years = (x) => `${x.born}–${x.died ?? ''}`;

/** What someone is to the player: "your grandmother", "your cousin", or '' for no relation worth naming. */
function kin(d, me, x) {
  if (!me || me.id === x.id) return me ? 'you' : '';
  if (me.spouseId === x.id || x.spouseId === me.id || me.widowOf === x.id) return x.gender === 'male' ? 'your husband' : x.gender === 'female' ? 'your wife' : 'your spouse';
  const up = dyn.generationsUp(d, me.id, x.id);
  const g = (m, f, o) => (x.gender === 'male' ? m : x.gender === 'female' ? f : o);
  if (up === 1) return `your ${g('father', 'mother', 'parent')}`;
  if (up >= 2) return `your ${'great-'.repeat(up - 2)}${g('grandfather', 'grandmother', 'grandparent')}`;
  const down = dyn.generationsUp(d, x.id, me.id);
  if (down === 1) return `your ${g('son', 'daughter', 'child')}`;
  if (down >= 2) return `your ${'great-'.repeat(down - 2)}${g('grandson', 'granddaughter', 'grandchild')}`;
  if (!me.blood) {
    const sp = d.people[me.spouseId ?? me.widowOf];
    if (!sp || !x.blood) return '';
    const r = sp.id === x.id ? '' : relationTo(d.people, sp.id, x.id).replace(/^(eldest|second|third|fourth|fifth|sixth) /, '');
    return r && r !== 'relative' ? `your ${sp.gender === 'male' ? 'husband' : 'wife'}'s ${r}` : '';
  }
  if (!x.blood) {
    const of = d.people[x.spouseId ?? x.widowOf];
    const r = of ? kin(d, me, of) : '';
    return r && r !== 'you' ? `married to ${r}` : '';
  }
  const r = relationTo(d.people, me.id, x.id).replace(/^(eldest|second|third|fourth|fifth|sixth) /, '');
  return r === 'relative' ? '' : `your ${r}`;
}

function row(d, x, me, side = '') {
  const k = kin(d, me, x);
  return `<button class="row dyn-row ${x.died != null ? 'gone' : ''} ${x.isPlayer ? 'you' : ''}" data-person="${x.id}">
    <div class="avatar">${face(x, undefined, d)}</div>
    <div class="main"><strong>${esc(dyn.nameOf(d, x))}</strong>
      <small>${esc(dyn.standingOf(d, x))}${k ? ` · ${esc(k)}` : ''}</small></div>
    <div class="side">${side || esc(x.died != null ? years(x) : `age ${dyn.ageOf(x)}`)}</div>
  </button>`;
}

// ---------- The four pages ----------

function pageMonarchs(d, me) {
  const s = dyn.stats(d);
  const name = (r) => (r ? esc(dyn.nameOf(d, d.people[r.id])) : '');
  const reigns = [...d.reigns].reverse().map((r) => {
    const x = d.people[r.id];
    const span = (r.to ?? store.state.year) - r.from;
    return row(d, x, me, `${r.from}–${r.to ?? ''}<br><small>${span} ${span === 1 ? 'year' : 'years'}</small>`);
  }).join('');
  const fallen = d.status === 'abolished';
  return `
    <div class="dyn-stats">
      <div><strong>${s.years}</strong><small>years on the throne</small></div>
      <div><strong>${s.monarchs}</strong><small>monarchs</small></div>
      <div><strong>${s.generations}</strong><small>generations</small></div>
      <div><strong>${s.livingMembers}</strong><small>living members</small></div>
    </div>
    <div class="kv"><span>Longest reign</span><span>${name(s.longest)}, ${s.longest.years} years</span></div>
    ${s.shortest ? `<div class="kv"><span>Shortest reign</span><span>${name(s.shortest)}, ${s.shortest.years} ${s.shortest.years === 1 ? 'year' : 'years'}</span></div>` : ''}
    ${fallen ? `<div class="kv"><span>The monarchy</span><span>Abolished in ${d.abolishedYear}</span></div>` : ''}
    <div class="kv"><span>${fallen ? 'How the old house is remembered' : 'Support for the monarchy'}</span><span>${s.standing >= 70 ? 'With affection' : s.standing >= 55 ? 'Warmly enough' : s.standing >= 40 ? 'With mixed feelings' : 'With little patience'}</span></div>
    <div class="section-label">Every monarch of the house</div>${reigns}`;
}

/** A person, their husband or wife, and their descendants, indented by generation. */
function branch(d, me, x, depth, seen) {
  if (seen.has(x.id)) return '';
  seen.add(x.id);
  const partner = d.people[x.spouseId] ?? (x.died != null ? null : Object.values(d.people).find((p) => p.widowOf === x.id && p.died == null));
  const kids = dyn.childrenOf(d.people, x.id);
  // Long-dead branches with nobody living are left out of the family page: the Monarchs page has the ancestors.
  const alive = (p) => p.died == null || dyn.childrenOf(d.people, p.id).some(alive);
  const wrap = (html) => `<div class="dyn-indent" style="margin-left:${Math.min(depth, 5) * 14}px">${html}</div>`;
  return wrap(row(d, x, me) + (partner && !seen.has(partner.id) ? (seen.add(partner.id), row(d, partner, me)) : ''))
    + kids.filter(alive).map((k) => branch(d, me, k, depth + 1, seen)).join('');
}

function pageFamily(d, me) {
  // Start from the nearest ancestor that everyone living descends from: usually the monarch's parent or grandparent.
  const monarch = dyn.monarchOf(d);
  let root = monarch;
  for (let i = 0; i < 2; i++) { const up = dyn.bloodParent(d.people, root); if (!up) break; root = up; }
  const seen = new Set();
  const tree = branch(d, me, root, 0, seen);
  const rest = Object.values(d.people).filter((x) => x.died == null && !seen.has(x.id) && dyn.rankOf(d, x));
  return `<p class="muted" style="margin-bottom:8px">The living family, from ${esc(dyn.nameOf(d, root))} down. Husbands and wives are shown beside the person they married.</p>
    ${tree}${rest.length ? `<div class="section-label">More distant branches</div>${rest.map((x) => row(d, x, me)).join('')}` : ''}`;
}

function pageLine(d, me) {
  const line = dyn.lineOf(d);
  const monarch = dyn.monarchOf(d);
  const mine = me ? line.indexOf(me.id) + 1 : 0;
  const shown = line.slice(0, 30);
  const out = Object.values(d.people).filter((x) => x.died == null && x.id !== d.monarchId && !line.includes(x.id) && (x.blood || dyn.rankOf(d, x)));
  return `<p class="muted" style="margin-bottom:8px">${esc(LAW[d.law.order])}${d.law.adoption ? '' : ' Adopted children do not inherit.'} Marrying into the family gives a title, never a place in the line.</p>
    <div class="section-label" style="margin-top:0">On the throne</div>${row(d, monarch, me)}
    <div class="section-label">The line of succession</div>
    ${shown.length ? shown.map((id, i) => {
    const x = d.people[id];
    return row(d, x, me, `<span class="dyn-place">${i + 1}</span><br><small>${esc(dyn.relationToMonarch(d, id))} of the ${esc(dyn.titleOf(d, monarch).toLowerCase())}</small>`);
  }).join('') : '<p class="muted">Nobody is left to inherit.</p>'}
    ${line.length > shown.length ? `<p class="muted">…and ${line.length - shown.length} more.</p>` : ''}
    ${me && mine > 30 ? `<p class="muted">You are ${ORD(mine)} in line.</p>` : ''}
    ${out.length ? `<div class="section-label">Not in the line</div>${out.map((x) => row(d, x, me, `<small>${esc(dyn.whyNot(d, x))}</small>`)).join('')}` : ''}`;
}

function pageTimeline(d) {
  let html = '';
  let decade = null;
  for (const h of [...d.history].sort((a, b) => b.year - a.year)) {
    const dec = Math.floor(h.year / 10) * 10;
    if (dec !== decade) { decade = dec; html += `<div class="section-label">${dec}s</div>`; }
    const who = h.ids.find((id) => d.people[id]);
    html += `<${who ? `button data-person="${who}"` : 'div'} class="dyn-event"><span class="num">${h.year}</span><span>${esc(h.text)}</span></${who ? 'button' : 'div'}>`;
  }
  return html || '<p class="muted">Nothing has been written down yet.</p>';
}

// ---------- One person ----------

function pagePerson(d, me, x) {
  const p = player();
  const she = x.gender === 'female' ? 'She' : x.gender === 'male' ? 'He' : 'They';
  const her = x.gender === 'female' ? 'her' : x.gender === 'male' ? 'his' : 'their';
  const k = kin(d, me, x);
  const reign = d.reigns.find((r) => r.id === x.id);
  const parents = (x.parents ?? []).map((id) => d.people[id]).filter(Boolean);
  const partner = d.people[x.spouseId] ?? Object.values(d.people).find((q) => q.widowOf === x.id) ?? (x.widowOf ? d.people[x.widowOf] : null);
  const kids = dyn.childrenOf(d.people, x.id);
  const link = (q) => `<button class="dyn-link" data-person="${q.id}">${esc(dyn.nameOf(d, q))}</button>`;

  // What of this person reaches the player.
  const reach = [];
  if (me && me.id !== x.id) {
    const up = dyn.generationsUp(d, me.id, x.id);
    if (up) {
      const same = dyn.shared(x.look, p.appearance);
      if (same.length) reach.push(`You have ${her} ${list(same.slice(0, 4))}.`);
      else if (up >= 2) reach.push(`Nothing of ${her} face has come down to you, though ${her} blood has.`);
    }
    if (x.reformer) {
      reach.push(p.gender !== 'male' && p.royal?.by === 'birth'
        ? `${she} had the law changed so that daughters inherit equally. It is the reason you have a place in the line at all.`
        : `${she} had the law changed so that daughters inherit equally, and the line you stand in was reordered by it.`);
    }
    if (reign && x.note && x.died != null && p.royal) {
      if ((x.mark ?? 0) >= 3) reach.push(`People still speak well of ${her} reign, and some of that goodwill is yours when you step out in public.`);
      if ((x.mark ?? 0) <= -5) reach.push(`It has never been forgotten, and the family you belong to is trusted a little less for it.`);
      else if ((x.mark ?? 0) < 0) reach.push(`It left a coolness between the house and the public that has not quite gone.`);
    }
    if (reign && d.reigns[0].id === x.id) reach.push(`${she} founded the house. Everyone in it, you included, traces back to ${x.gender === 'female' ? 'her' : x.gender === 'male' ? 'him' : 'them'}.`);
  }
  const story = [...x.story].sort((a, b) => a.year - b.year);
  const age = dyn.ageOf(x);
  return `
    <div class="dyn-hero">
      <div class="avatar dyn-portrait">${face(x, undefined, d)}</div>
      <div><h3>${esc(dyn.nameOf(d, x))}</h3>
        <p class="muted">${years(x)}${x.died != null ? ` · lived ${age} years` : ` · age ${age}`}</p>
        <p>${esc(dyn.standingOf(d, x))}${k && k !== 'you' ? `<br><em>${esc(k[0].toUpperCase() + k.slice(1))}</em>` : k === 'you' ? '<br><em>This is you.</em>' : ''}</p></div>
    </div>
    ${reign ? `<div class="kv"><span>Reign</span><span>${reign.from}–${reign.to ?? 'today'}, ${(reign.to ?? store.state.year) - reign.from} years</span></div>` : ''}
    ${x.note ? `<div class="kv"><span>Remembered because</span><span>${esc(she)} ${esc(x.note)}</span></div>` : ''}
    ${parents.length ? `<div class="kv"><span>${parents.length > 1 ? 'Parents' : 'Parent'}</span><span>${parents.map(link).join(' and ')}</span></div>` : ''}
    ${partner ? `<div class="kv"><span>${x.died != null || partner.died != null ? 'Was married to' : 'Married to'}</span><span>${link(partner)}</span></div>` : ''}
    ${kids.length ? `<div class="kv"><span>Children</span><span>${kids.map(link).join(', ')}</span></div>` : ''}
    ${reach.length ? `<div class="section-label">What of ${esc(x.name)} reaches you</div>${reach.map((t) => `<p class="dyn-reach">${esc(t)}</p>`).join('')}` : ''}
    ${story.length ? `<div class="section-label">${x.died != null ? 'A life' : 'So far'}</div>${story.map((s) => `<div class="dyn-event"><span class="num">${s.year}</span><span>${esc(s.text)}</span></div>`).join('')}` : ''}
    ${x.npcId && store.state.npcs[x.npcId]?.alive ? '<p class="muted" style="margin-top:10px">Someone in your life: find them under People.</p>' : ''}`;
}

/** Opens the journal for the royal house of the country the player lives in (or holds a title in). */
export function openDynasty(startPersonId, countryId) {
  const d = countryId ? store.state.dynasties?.[countryId] : dyn.house(player().royal && ['monarch', 'heir', 'royal'].includes(player().royal.rank) ? player().royal.countryId : country().id);
  if (!d) return;
  const me = dyn.playerPerson(d);
  const tabs = [['monarchs', 'Monarchs'], ['family', 'Family'], ['line', 'Succession'], ['timeline', 'History']];
  let tab = 'monarchs';
  const trail = startPersonId && d.people[startPersonId] ? [startPersonId] : [];
  const m = openModal(`
    <div class="dyn-head"><div><div class="eyebrow">${esc(theCountry(COUNTRIES[d.countryId].name))}</div><h2>${esc(d.name)}</h2></div>
      <button class="icon-btn" data-close aria-label="Close">✕</button></div>
    <div class="dyn-tabs" role="tablist">${tabs.map(([id, label]) => `<button role="tab" data-tab="${id}">${label}</button>`).join('')}</div>
    <div class="dyn-body" data-body></div>`, { dismissable: true });
  m.el.classList.add('dyn-modal');
  const body = m.el.querySelector('[data-body]');

  function draw() {
    const viewing = trail.length ? d.people[trail[trail.length - 1]] : null;
    m.el.querySelectorAll('[data-tab]').forEach((b) => { b.classList.toggle('on', !viewing && b.dataset.tab === tab); b.setAttribute('aria-selected', String(!viewing && b.dataset.tab === tab)); });
    body.innerHTML = viewing
      ? `<button class="btn dyn-back" data-back>← Back</button>${pagePerson(d, me, viewing)}`
      : { monarchs: pageMonarchs, family: pageFamily, line: pageLine, timeline: pageTimeline }[tab](d, me);
    body.scrollTop = 0;
  }
  m.el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return m.close();
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; trail.length = 0; return draw(); }
    if (e.target.closest('[data-back]')) { trail.pop(); return draw(); }
    const who = e.target.closest('[data-person]');
    if (who && d.people[who.dataset.person]) { trail.push(who.dataset.person); return draw(); }
    return undefined;
  });
  draw();
}

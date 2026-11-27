// Family Life: one screen for Living Families & Growing Up, opened from People. Tabs, shown as they come to matter:
//   Family     who you live with, custody and visits, your stepfamily and half-siblings
//   Teen life  (12-17) the house rules, grounding, best friend, nights out, prom, a learner's permit
//   Home       (16+) moving out, the lease, a month's money, moving back home, looking after yourself
//   Love       (14+) where your relationship is, the engagement and the wedding date, widowhood
//   Fostering  (21+) becoming a foster carer, children in your care, kinship and guardianship
//   Timeline   the family's events, newest first
// Built like My Neighborhood (ui/neighborhood.js): a full-screen dialog with tabs; each action calls its engine
// (engine/familyLife.js and the five features), shows what happened, and comes back to the same tab.
import { store, player } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { avatarSvg } from './avatar.js';
import { openModal, messageModal, pickModal, confirmModal } from './modals.js';
import { roleLabel } from '../engine/relationships.js';
import { careLine } from '../engine/guardianship.js';
import { timeline, householdOf, lived } from '../engine/livingFamilies.js';
import { blended, teen, home, love, care } from '../engine/familyLife.js';

const S = () => store.state;
const C = () => COUNTRIES[player().countryId];
const kv = (k, v) => `<div class="kv"><span>${esc(k)}</span><span>${v}</span></div>`;
const label = (t) => `<div class="section-label">${esc(t)}</div>`;
const empty = (t) => `<p class="empty">${esc(t)}</p>`;
const note = (t) => `<p class="muted" style="margin:6px 0 10px">${esc(t)}</p>`;
const btn = (attrs, text, o = {}) => `<button class="btn${o.primary ? ' primary' : ''}${o.danger ? ' danger' : ''}" ${attrs} ${o.why ? 'disabled' : ''}>${esc(text)}</button>${o.why ? `<small class="muted fl-why">${esc(o.why)}</small>` : ''}`;
const stack = (...b) => `<div class="btn-stack">${b.filter(Boolean).join('')}</div>`;
const face = (n) => `<div class="avatar">${avatarSvg({ age: n.age, gender: n.gender, appearance: n.appearance, seed: n.id, mood: n.meters.relationship })}</div>`;
const personRow = (n, sub = '') => `<button class="row" data-person="${n.id}">${face(n)}<div class="main"><strong>${esc(`${n.firstName} ${n.lastName}`)}</strong><small>${esc([roleLabel(n), `age ${n.age}`, sub].filter(Boolean).join(' · '))}</small></div><div class="side"><span class="pct">${Math.round(n.meters.relationship)}%</span></div></button>`;
const mine = () => player().npcIds.map((id) => S().npcs[id]).filter((n) => n?.alive);

let api = null;
let modal = null;
let tab = 'family';

/** The tabs open at this age. */
export function tabsFor(p = player()) {
  const t = [['family', 'Family']];
  if (p.age >= 12 && p.age <= 17) t.push(['teen', 'Teen life']);
  if (p.age >= 16) t.push(['home', 'Home']);
  if (p.age >= 14) t.push(['love', 'Love']);
  if (p.age >= care.FOSTER_AGE || care.placements().length) t.push(['care', 'Fostering']);
  t.push(['timeline', 'Timeline']);
  return t;
}
const LIVES = { parents: 'With your parents', mother: 'With your mother', father: 'With your father', care: 'In care', own: 'A place of your own', partner: 'With your partner', dorm: 'Student housing', prison: 'In prison' };
/** One line for the People tab's row. */
export function familyLifeLine() {
  const p = player();
  const l = home.lease();
  if (p.age < 18) return LIVES[householdOf()] ?? '';
  if (l) return `${home.PLACES.find((x) => x.id === l.kind)?.name ?? 'Renting'}`;
  return LIVES[householdOf()] ?? '';
}

// ---------- Tabs ----------

function familyTab() {
  const p = player();
  const c = blended.custody();
  const ps = mine().filter((n) => n.role === 'parent');
  const steps = blended.stepparents();
  const sibs = mine().filter((n) => n.role === 'sibling');
  const stepsibs = blended.stepsiblings();
  const kids = blended.stepchildren();
  const status = { together: 'Together', separated: 'Separated', single: 'A single parent', gone: 'No longer living' }[p.flags.parentsStatus] ?? '';
  let out = label('Where you live') + kv('Home', esc(p.flags.care ? careLine() : LIVES[householdOf()] ?? '')) + (p.age < 18 && status ? kv('Your parents', esc(status)) : '');
  if (c && p.age < 18) {
    out += kv('Custody', esc(c.kind === 'shared' ? 'Shared: a week with each' : `With your ${c.withNpc?.gender === 'male' ? 'father' : 'mother'}${c.otherNpc ? `; every other weekend with your ${c.otherNpc.gender === 'male' ? 'father' : 'mother'}` : ''}`));
    out += stack(c.otherNpc ? btn('data-act="visit"', `Spend the weekend with ${c.otherNpc.firstName}`) : '',
      c.otherNpc ? btn('data-act="ask"', `Ask to live with ${c.otherNpc.firstName}`, { why: p.age < 12 ? 'From age 12' : c.asked === S().year ? 'You asked this year' : '' }) : '');
  }
  out += label('Parents') + (ps.length ? ps.map((n) => personRow(n)).join('') : empty('Your parents are no longer living.'));
  if (steps.length) out += label('Stepfamily') + steps.map((n) => personRow(n, `with your ${S().npcs[n.flags.stepOf]?.gender === 'male' ? 'father' : 'mother'}`)).join('') + stepsibs.map((n) => personRow(n)).join('');
  else if (stepsibs.length) out += label('Stepsiblings') + stepsibs.map((n) => personRow(n)).join('');
  if (sibs.length) out += label('Brothers and sisters') + sibs.map((n) => personRow(n)).join('');
  if (kids.length) out += label('Your stepchildren') + kids.map((n) => personRow(n)).join('');
  if (!steps.length && !stepsibs.length && !kids.length) out += note('A blended family begins when a parent finds someone new, or when you marry someone who has children.');
  return out;
}

function teenTab() {
  const p = player();
  if (p.age < 12 || p.age > 17) return empty('Teen life is for ages 12 to 17.');
  const by = teen.rulesBy();
  const g = teen.grounded();
  const bf = teen.bestFriend();
  const pr = teen.prom();
  const pm = teen.permit();
  let out = label('House rules');
  out += kv('Set by', esc(by ? `${by.firstName} (${roleLabel(by).toLowerCase()})` : 'Nobody'));
  out += kv('Curfew', esc(teen.curfewText(teen.curfew())));
  out += kv('Grounded', g ? `<strong>Yes</strong>: ${esc(g.why)}, ${Math.max(1, g.until - lived())} more month${g.until - lived() === 1 ? '' : 's'}` : 'No');
  out += stack(btn('data-act="curfew"', 'Ask for a later curfew', { why: teen.isTeen() && (S().livingFamilies?.teen?.negotiated === S().year) ? 'You asked this year' : '' }));
  out += label('Friends') + (bf ? personRow(bf, 'best friend') : note('No best friend yet: choose one from your friends.'));
  out += stack(btn('data-act="bff"', bf ? `Spend time with ${bf.firstName}` : 'Choose a best friend', { why: !bf && !teen.friends().length ? 'Make some friends first' : '' }),
    btn('data-act="out"', 'Go out with friends', { why: p.age < 13 ? 'From 13' : g ? 'You are grounded' : '' }),
    btn('data-act="late"', 'Stay out past curfew', { why: p.age < 13 ? 'From 13' : g ? 'You are grounded' : '' }),
    g ? btn('data-act="sneak"', 'Sneak out anyway', { danger: true }) : '');
  out += label('Prom');
  if (!teen.promOpen()) out += note(`Prom is in your senior year of high school, at ${teen.PROM_AGE}.`);
  else {
    const date = pr?.dateId === 'friends' ? 'Your friends' : pr?.dateId ? S().npcs[pr.dateId]?.firstName : null;
    out += kv('Going with', esc(date ?? 'Nobody yet')) + kv('Outfit', esc(pr?.outfit ? teen.PROM_OUTFITS.find((o) => o.id === pr.outfit).name : 'Not yet'));
    out += stack(!date ? btn('data-act="promAsk"', 'Ask someone to prom') : '', !date ? btn('data-act="promFriends"', 'Go with your friends') : '',
      date && !pr.outfit ? btn('data-act="promOutfit"', 'Choose an outfit') : '', date && pr.outfit && !pr.went ? btn('data-act="prom"', 'Go to prom', { primary: true }) : '',
      pr?.went ? note('Prom is over. It was a night.') : '');
  }
  out += label('Driving');
  out += kv('Learner\'s permit', esc(pm ? `Yes · ${pm.hours} hours of practice` : `From ${teen.permitAge()}`));
  out += stack(!pm ? btn('data-act="permit"', 'Get your learner\'s permit', { why: p.age < teen.permitAge() ? `From ${teen.permitAge()}` : '' }) : btn('data-act="drive"', 'Practice driving with a parent'));
  return out;
}

function homeTab() {
  const p = player();
  const c = C();
  const l = home.lease();
  const sk = home.skills();
  let out = '';
  if (l) {
    const pl = home.PLACES.find((x) => x.id === l.kind);
    const mate = l.roommateId ? S().npcs[l.roommateId] : null;
    const left = Math.max(0, l.end - S().year * 12 - (S().month ?? 0));
    out += label('Your place') + kv('Where', esc(pl.name)) + kv('Rent', `${fmtMoney(l.monthlyRent, c)} a month`) + kv('Bills', `about ${fmtMoney(l.monthlyBills, c)} a month`)
      + kv('Lease', esc(l.notice ? `Ends in ${left} months (you gave notice)` : `Renews in ${left} months`)) + (mate?.alive ? kv('Roommate', esc(mate.firstName)) : '');
    const b = home.monthlyBudget();
    out += label('A month\'s money') + kv('Pay (before tax)', fmtMoney(b.income, c)) + kv('Rent and bills', fmtMoney(b.rent + b.bills, c)) + kv('Groceries', fmtMoney(b.groceries, c))
      + kv('Left over', `<strong>${fmtMoney(b.left, c)}</strong>`) + (b.arrears ? kv('Owed to the landlord', `<strong>${fmtMoney(b.arrears, c)}</strong>`) : '');
    out += stack(l.notice ? btn('data-act="unnotice"', 'Stay after all') : btn('data-act="notice"', 'Give notice'), btn('data-act="back"', 'Move back home', { why: home.whyNotMoveBack() }));
  } else {
    out += label('Moving out');
    const why = home.whyNotMoveOut();
    out += note(p.flags.livesWithParents ? 'You live with your family. Moving out means a lease, a deposit, and every bill yours.' : 'You are not on a lease of your own. You can sign one.');
    out += home.PLACES.map((pl) => { const pr = home.priceOf(pl.id); return `<button class="row" data-place="${pl.id}" ${why ? 'disabled' : ''}><div class="avatar glyph">🔑</div><div class="main"><strong>${esc(pl.name)}</strong><small>${esc(`${fmtMoney(pr.total, c)} a month with bills · deposit ${fmtMoney(pr.deposit, c)}. ${pl.blurb}`)}</small></div></button>`; }).join('');
    if (why) out += note(why);
    if (!p.flags.livesWithParents && p.age >= 18) out += stack(btn('data-act="back"', 'Move back home', { why: home.whyNotMoveBack() }));
  }
  out += label('Looking after yourself') + Object.entries(sk).map(([k, v]) => kv(home.SKILL_NAMES[k], `${v}%`)).join('');
  out += stack(...home.SKILLS.map((s) => btn(`data-skill="${s.id}"`, s.name, { why: p.age < 16 ? 'From 16' : '' })));
  return out;
}

function loveTab() {
  const p = player();
  const n = love.current();
  let out = '';
  const w = love.widowed().at(-1);
  if (w) {
    const gone = S().npcs[w.npcId];
    out += label('Widowed') + note(`${gone ? gone.firstName : 'Your spouse'} died ${Math.max(0, Math.round((lived() - w.since) / 12))} years ago.`)
      + stack(btn('data-act="grave"', 'Visit the grave'), btn('data-act="ready"', 'Feel ready to love again'));
  }
  if (!n) return out + label('Your relationship') + note(p.age < 14 ? 'Dating starts at 14.' : 'You are not with anyone. Look for Love is on the Self tab.');
  const st = love.stageOf(n);
  const months = love.monthsTogether(n);
  out += label('Your relationship') + personRow(n);
  out += `<div class="fl-stages">${love.STAGES.map((s) => `<span class="chip${s === st ? ' on' : ''}${love.STAGES.indexOf(s) < love.STAGES.indexOf(st) ? ' past' : ''}">${esc(love.STAGE_NAMES[s])}</span>`).join('')}</div>`;
  out += kv('Together', esc(months < 12 ? `${months} month${months === 1 ? '' : 's'}` : `${Math.floor(months / 12)} year${months >= 24 ? 's' : ''}${months % 12 ? `, ${months % 12} months` : ''}`));
  const next = love.nextStep(n);
  if (next) out += kv('What comes next', esc(next));
  const e = love.engagement(n);
  const acts = [];
  if (st === 'dating') acts.push(btn('data-act="dtr"', 'Ask to be exclusive'));
  if (!n.flags.metTheirFamily) acts.push(btn('data-act="inlaws"', `Meet ${n.firstName}'s family`));
  if (['serious', 'living together', 'exclusive'].includes(st) && p.age >= 18) acts.push(btn('data-act="propose"', `Propose to ${n.firstName}`));
  if (e) {
    out += label('The engagement') + kv('Wedding date', esc(e.weddingMonth == null ? 'Not set' : e.weddingMonth <= lived() + 1 ? 'Now' : `In ${e.weddingMonth - lived() - 1} months`)) + kv('Engagement party', e.party ? 'Done' : 'Not yet');
    acts.push(btn('data-act="date"', e.weddingMonth == null ? 'Set a wedding date' : 'Change the date'));
    if (!e.party) acts.push(btn('data-act="party"', 'Throw an engagement party'));
    acts.push(btn('data-act="wedding"', 'Plan the wedding', { primary: e.weddingMonth != null && e.weddingMonth <= lived() + 1 }));
    acts.push(btn('data-act="calloff"', 'Call off the engagement', { danger: true }));
  }
  out += stack(...acts, btn(`data-person="${n.id}"`, `Everything with ${n.firstName}`));
  return out;
}

function careTab() {
  const p = player();
  const k = care.carer();
  const c = C();
  const open = care.placements();
  let out = label('Fostering') + kv('Status', esc({ none: 'Not a foster carer', applying: 'Application being assessed', approved: `Approved foster carer (up to ${k.capacity ?? 1})`, closed: 'Stepped back' }[k.status] ?? ''))
    + kv('Training', `${k.training ?? 0} of 3 sessions`) + kv('Allowance', `${fmtMoney(Math.round(care.ALLOWANCE * C().currency.scale), c)} a month for each child`);
  const why = care.whyNotFoster();
  out += stack(['none', 'closed'].includes(k.status) ? btn('data-act="apply"', 'Apply to become a foster carer', { why }) : '',
    ['applying', 'approved'].includes(k.status) ? btn('data-act="train"', 'Go to a training session', { why: (k.training ?? 0) >= 3 ? 'All done' : '' }) : '',
    k.status === 'approved' ? btn('data-act="capacity"', 'How many children you can take') : '',
    S().livingFamilies?.care?.offer ? btn('data-act="offer"', 'Answer the agency\'s call', { primary: true }) : '',
    k.status === 'approved' ? btn('data-act="stop"', 'Step back from fostering', { danger: true }) : '');
  out += label('Children in your care');
  out += open.length ? open.map((x) => { const n = care.childOf(x); return n ? personRow(n, { foster: 'foster care', kinship: 'kinship care', guardianship: 'your ward' }[x.kind]) : ''; }).join('') : note(p.age < care.FOSTER_AGE ? `Fostering is from ${care.FOSTER_AGE}.` : 'No children are placed with you.');
  const past = care.placements(S(), false).filter((x) => x.end != null);
  if (past.length) out += label('Before') + past.slice(-6).reverse().map((x) => { const n = S().npcs[x.childId]; return n ? kv(`${n.firstName}`, esc({ reunified: 'Went home', adopted: 'Adopted by you', aged_out: 'Aged out of care', moved: 'Moved to another home', ended: 'Ended' }[x.outcome] ?? x.outcome)) : ''; }).join('');
  return out;
}

function timelineTab() {
  const list = timeline().slice(0, 60);
  return label('The family\'s story') + (list.length ? list.map((e) => `<div class="kv"><span>Age ${e.age}</span><span>${esc(e.text)}</span></div>`).join('') : empty('Nothing has happened yet. It will.'));
}

const TABS = { family: familyTab, teen: teenTab, home: homeTab, love: loveTab, care: careTab, timeline: timelineTab };

// ---------- Showing and acting ----------

function shut() { modal?.close(); modal = null; }
function show() {
  shut();
  const tabs = tabsFor();
  if (!tabs.some(([id]) => id === tab)) tab = tabs[0][0];
  modal = openModal(`
    <div class="dyn-head"><div><h2>Family Life</h2><p class="muted zoo-sub">${esc(familyLifeLine())}</p></div>
      <button class="icon-btn" data-x aria-label="Close">✕</button></div>
    <div class="zoo-tabs" role="tablist">${tabs.map(([id, t]) => `<button role="tab" aria-selected="${id === tab}" class="${id === tab ? 'on' : ''}" data-tab="${id}">${esc(t)}</button>`).join('')}</div>
    <div class="dyn-body" data-body>${TABS[tab]()}</div>`, { dismissable: true, onDismiss: () => { modal = null; } });
  modal.el.classList.add('dyn-modal', 'zoo-modal', 'fl-modal');
  modal.el.dataset.section = tab; // (not data-tab: clicks look for that on the tab buttons)
  modal.el.addEventListener('click', onClick);
}
async function report(r) {
  if (!r) return show();
  api?.changed?.();
  shut();
  if (r.text) await messageModal({ body: r.text, tone: r.tone });
  if (S().pendingEvents?.length) await api?.pending?.();
  return show();
}

async function pickPerson(title, people, body = '') {
  shut();
  const id = await pickModal({ title, body, options: people.map((n) => ({ value: n.id, label: `${n.firstName} ${n.lastName}`, sub: `${roleLabel(n)} · ${Math.round(n.meters.relationship)}%` })) });
  return id ? S().npcs[id] : null;
}

async function act(a) {
  const n = love.current();
  switch (a) {
    case 'visit': return report(blended.visitOtherParent());
    case 'ask': return report(blended.askToMove());
    case 'curfew': return report(teen.negotiateCurfew());
    case 'bff': {
      if (teen.bestFriend()) return report(teen.bestFriendTime());
      const f = await pickPerson('Who is your best friend?', teen.friends(), 'Someone you are already close to.');
      return f ? report(teen.chooseBestFriend(f.id)) : show();
    }
    case 'out': return report(teen.nightOut(S(), 'curfew'));
    case 'late': return report(teen.nightOut(S(), 'late'));
    case 'sneak': { shut(); const yes = await confirmModal({ title: 'Sneak out?', body: 'If you are caught, you are grounded for longer.', yes: 'Climb out of the window', danger: true }); return yes ? report(teen.nightOut(S(), 'sneak')) : show(); }
    case 'promAsk': {
      const people = mine().filter((x) => ['partner', 'friend', 'classmate'].includes(x.role) && Math.abs(x.age - player().age) <= 2);
      const who = await pickPerson('Who do you ask to prom?', people);
      return who ? report(teen.askToProm(who.id)) : show();
    }
    case 'promFriends': return report(teen.promWithFriends());
    case 'promOutfit': {
      shut();
      const c = C();
      const o = await pickModal({ title: 'What do you wear?', options: teen.PROM_OUTFITS.map((x) => ({ value: x.id, label: x.name, sub: fmtMoney(Math.round(x.cost * c.currency.scale), c) })) });
      return o ? report(teen.promOutfit(o)) : show();
    }
    case 'prom': {
      shut();
      const after = await pickModal({ title: 'And after the dance?', options: [{ value: 'home', label: 'Home, before curfew' }, { value: 'diner', label: 'Pancakes at the all-night diner' }, { value: 'party', label: 'The after-party' }] });
      return after ? report(teen.goToProm(after)) : show();
    }
    case 'permit': return report(teen.getPermit());
    case 'drive': return report(teen.practiceDriving());
    case 'notice': return report(home.giveNotice());
    case 'unnotice': return report(home.withdrawNotice());
    case 'back': { shut(); const yes = await confirmModal({ title: 'Move back home?', body: home.lease() ? 'Leaving before the lease is up costs a month\'s rent from the deposit.' : 'You ask if you can come home for a while.', yes: 'Ask to move back' }); return yes ? report(home.moveBackHome()) : show(); }
    case 'grave': return report(love.visitGrave());
    case 'ready': return report(love.readyToLoveAgain());
    case 'dtr': return report(love.defineRelationship(n.id));
    case 'inlaws': return report(love.meetTheirFamily(n.id));
    case 'propose': { shut(); const { proposeTo } = await import('./tabs/people.js'); await proposeTo(api, n); love.startEngagement(n); return show(); }
    case 'date': {
      shut();
      const m = await pickModal({ title: 'When is the wedding?', options: [3, 6, 12, 18, 24].map((x) => ({ value: String(x), label: x < 12 ? `In ${x} months` : x === 12 ? 'In a year' : `In ${x / 12} years` })) });
      return m ? report(love.setWeddingDate(n.id, Number(m))) : show();
    }
    case 'party': return report(love.engagementParty(n.id));
    case 'wedding': { shut(); const { planWedding } = await import('./tabs/people.js'); await planWedding(api, n); return show(); }
    case 'calloff': { shut(); const yes = await confirmModal({ title: 'Call off the engagement?', body: `${n.firstName} will be hurt. You stay together, for now.`, yes: 'Call it off', danger: true }); return yes ? report(love.callOffEngagement(n.id)) : show(); }
    case 'apply': return report(care.applyToFoster());
    case 'train': return report(care.training());
    case 'capacity': { shut(); const m = await pickModal({ title: 'How many children at a time?', options: [1, 2, 3].map((x) => ({ value: String(x), label: `${x}` })) }); return m ? report(care.setCapacity(Number(m))) : show(); }
    case 'offer': {
      shut();
      const o = S().livingFamilies.care.offer;
      const yes = await confirmModal({ title: 'The agency is calling', body: `A child of ${o.age} needs a home${o.plan >= 24 ? ', perhaps for a long time' : ` for about ${o.plan} months`}.`, yes: 'Say yes', no: 'Not this time' });
      return report(care.answerOffer(!!yes));
    }
    case 'stop': return report(care.stopFostering());
    default: return show();
  }
}

async function onClick(e) {
  // Only what is inside this screen counts (the page around it carries data-* attributes of its own), and never the
  // dialog's own Back bar, which closes it.
  const card = e.currentTarget;
  if (e.target.closest('.modal-backrow')) return undefined;
  const hit = (attr) => { const x = e.target.closest(`[${attr}]`); return x && card.contains(x) ? x : null; };
  let el;
  if (hit('data-x')) { shut(); return undefined; }
  if ((el = hit('data-tab'))) { tab = el.dataset.tab; return show(); }
  if ((el = hit('data-person'))) {
    shut();
    const { openNpc } = await import('./tabs/people.js');
    const npc = S().npcs[el.dataset.person];
    if (npc) await openNpc(npc, api, () => show());
    return undefined;
  }
  if ((el = hit('data-place'))) {
    const id = el.dataset.place;
    shut();
    const pr = home.priceOf(id);
    const c = C();
    let mate = null;
    if (id === 'share') {
      const friends = mine().filter((n) => n.role === 'friend' && n.age >= 18 && n.meters.relationship >= 50);
      const pick = await pickModal({ title: 'Who do you share with?', options: [...friends.map((n) => ({ value: n.id, label: `${n.firstName} ${n.lastName}`, sub: `Friend · ${Math.round(n.meters.relationship)}%` })), { value: '__new', label: 'Find a roommate online', sub: 'Someone new' }] });
      if (!pick) return show();
      mate = pick === '__new' ? null : pick;
    }
    const yes = await confirmModal({ title: 'Sign the lease?', body: `${home.PLACES.find((x) => x.id === id).name}: ${fmtMoney(pr.rent, c)} a month in rent, about ${fmtMoney(pr.bills, c)} in bills, for ${home.LEASE_MONTHS} months. The deposit, ${fmtMoney(pr.deposit, c)}, is due now.`, yes: 'Sign and move in' });
    return yes ? report(home.moveOut(id, mate)) : show();
  }
  if ((el = hit('data-skill'))) return report(home.practiceSkill(el.dataset.skill));
  if ((el = hit('data-act'))) return act(el.dataset.act);
  return undefined;
}

/** Opens Family Life, on a tab ('family', 'teen', 'home', 'love', 'care', 'timeline'). */
export function openFamilyLife(tabApi, which) {
  api = tabApi;
  if (which) tab = which;
  show();
}

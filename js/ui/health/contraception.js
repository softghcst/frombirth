// My Health → Reproductive health, and its page Birth Control & Family Planning: the current method, the methods there
// are, a comparison on their characteristics (never a single score), eligibility, appointments, side effects and
// concerns, replacing or removing, pregnancy planning, and the history. Everything is drawn from the saved record
// (engine/health/contraception.js); everything decided here is the player's own choice. A game, not medical advice.
import { store, country } from '../../state.js';
import { esc, fmtMoney } from '../../util.js';
import { pickModal, confirmModal, messageModal } from '../modals.js';
import { healthOf } from '../../engine/health/record.js';
import { clinicianName, facility } from '../../engine/health/care.js';
import * as C from '../../engine/health/contraception.js';
import { SIDE_EFFECTS, METHODS, METHOD_BY_ID } from '../../data/health/contraception.js';

export const BC_TABS = [['current', 'Current method'], ['explore', 'Explore methods'], ['compare', 'Compare'], ['eligibility', 'Medical eligibility'],
  ['appointments', 'Appointments'], ['concerns', 'Side effects & concerns'], ['change', 'Replace or remove'], ['planning', 'Pregnancy planning'], ['history', 'Method history']];
const DEFAULT_COMPARE = ['iud_lng52', 'iud_copper', 'implant', 'coc'];

const card = (title, body, extra = '') => `<div class="card hl-card"${extra}>${title ? `<h3>${title}</h3>` : ''}${body}</div>`;
const kv = (a, b) => `<div class="kv"><span>${esc(a)}</span><span>${b}</span></div>`;
const muted = (t) => `<p class="muted">${t}</p>`;
const pill = (text, tone = '') => `<span class="hl-pill ${tone}">${esc(text)}</span>`;
const btn = (label, act, o = {}) => `<button class="btn ${o.primary ? 'primary' : ''} hl-small" data-act="${act}" ${o.arg != null ? `data-arg="${esc(o.arg)}"` : ''} ${o.disabled ? 'disabled' : ''}>${esc(label)}</button>`;
const money = (v) => (v ? fmtMoney(v, country()) : 'No cost to you');
const npcOf = (id) => store.state.npcs[id];
const who = (id) => (npcOf(id) ? clinicianName(npcOf(id)) : 'a clinician');
const DISCLAIMER = muted('A simulation, not medical advice. Real choices about contraception belong with a qualified clinician.');

/** The Reproductive health section of My Health. */
export function reproSection(p) {
  const stage = C.lifeStage(p);
  if (p.age < 11) return card('Reproductive health', muted('Nothing here yet. When the time comes, this is where puberty, periods and, later, family planning are looked after.'));
  const c = C.cx(p);
  const act = C.active(p);
  const bleed = C.bleedingNow(p);
  const stageWords = { none: 'No menstrual cycle in this body', young: 'Too young yet', reproductive: 'Reproductive years', perimenopause: 'Approaching menopause (perimenopause)', postmenopause: 'After menopause' }[stage];
  const using = act.length ? act.map((r) => `${esc(C.def(r).name)} ${pill(C.statusOf(r).label, C.statusOf(r).key === 'active' ? 'good' : '')}`).join('<br>')
    : c.legacyDefault ? 'Birth control (not specified yet)' : 'None';
  return `${card('Birth control & family planning', `${kv('Using now', using)}${kv('Pregnancy plans', esc(c.planning ? C.PLANNING[c.planning] : 'Not said'))}
      ${c.legacyDefault && !c.methods.length ? muted('Your life began before methods were kept one by one: the game assumes you use something. Choose a method to be specific.') : ''}
      <div class="btn-row">${btn('Open Birth Control & Family Planning', 'bc', { primary: true })}</div>`)}
    ${card('Life stage', `${kv('Stage', esc(stageWords))}${stage === 'perimenopause' ? muted('Fertility is lower, but a pregnancy is still possible: contraception is usually continued until 55, or until periods have stopped for a year (two before 50).') : ''}`)}
    ${bleed ? card('Menstrual health', `${muted(esc(bleed.text))}${muted('An approximate picture: the game does not follow the cycle day by day.')}`) : ''}
    ${C.playerScope(p) ? card('Your own practice', muted(`As a ${esc({ obgyn: 'obstetrician-gynecologist', gp: 'family physician', urologist: 'urologist', doctor: 'physician' }[C.playerScope(p).profession])}, you can provide for your patients: ${esc(C.playerScope(p).services.map((s) => ({ counsel: 'counseling', prescribe: 'prescriptions', injection: 'injections', iud: 'IUD placement', implant: 'implant placement and removal', tubal: 'tubal sterilization', vasectomy: 'vasectomy' })[s]).join(', '))}. Your contraception patients come to you at work, on your medical career's screen. Your own care is with another clinician.`)) : ''}
    ${p.age < 18 ? card('For young people', muted(`Good, confidential information about puberty, periods, relationships and contraception is for everyone. Whether a young person can get contraception without a parent depends on where they live: ${esc(consentWords(p))}`)) : ''}
    ${DISCLAIMER}`;
}
function consentWords(p) {
  return { uk: 'here, a young person can usually be seen confidentially.', jp: 'here, a parent or guardian is usually involved.' }[p.countryId] ?? 'the rules vary, and a sexual health service can explain them.';
}

// ---------- The page ----------

export function bcPage(p, nav) {
  nav.bc ??= { tab: 'current', compare: [...DEFAULT_COMPARE] };
  const tab = nav.bc.tab;
  const tabs = `<div class="hl-tabs hl-subtabs" role="tablist" aria-label="Birth control sections">${BC_TABS.map(([id, l]) => `<button role="tab" data-bctab="${id}" class="${tab === id ? 'on' : ''}" aria-selected="${tab === id}">${l}</button>`).join('')}</div>`;
  const body = { current, explore, compare: () => compare(p, nav), eligibility, appointments, concerns, change, planning, history }[tab](p, nav);
  return `<button class="btn hl-back" data-back>← Back</button><h3 class="hl-page">Birth Control &amp; Family Planning</h3>
    <p class="hl-sub">Your choices, your record. Nobody else can see or change it.</p>${tabs}${body}${DISCLAIMER}`;
}

function methodCard(r, p) {
  const m = C.def(r);
  const st = C.statusOf(r);
  const f = r.facilityId ? facility(r.facilityId) : null;
  const form = m.formulations?.find((x) => x.id === r.formulation);
  return card(esc(m.name), `${kv('Status', pill(st.label, st.key === 'active' ? 'good' : ''))}
    ${kv('Started', esc(C.dateOf(r.startAbs, p)))}
    ${r.expiresAbs != null ? kv('Approved duration', `${r.durationYears} years, until ${esc(C.dateOf(r.expiresAbs, p))}`) : ''}
    ${form ? kv('Formulation', esc(form.name)) : ''}
    ${kv('Next', esc(C.nextAction(r, p)))}
    ${r.rx?.expiresAbs != null ? kv('Prescription', `Supplied through ${esc(C.dateOf(r.rx.suppliedThrough, p))}`) : ''}
    ${r.providerId ? kv('Clinician', esc(`${who(r.providerId)}${f ? `, ${f.name}` : ''}`)) : ''}
    ${kv('Hormones', esc(m.hormonal ? m.hormone : 'None'))}
    ${kv('STIs', esc(m.sti ? 'Lowers the risk of many' : 'No protection'))}
    ${r.bleeding ? kv('Bleeding on it', esc(r.bleeding)) : ''}
    <div class="btn-row">${actionsFor(r).join('')}</div>`, ` data-rec="${esc(r.id)}"`);
}
function actionsFor(r) {
  const m = C.def(r);
  const st = C.statusOf(r).key;
  const out = [];
  if (st === 'lapsed') out.push(btn(m.every ? 'Arrange the injection' : 'Sort out a refill', 'bcResume', { arg: r.id, primary: true }));
  if (!m.permanent) out.push(btn('Report a concern', 'bcConcern', { arg: r.id }));
  if (m.formulations) out.push(btn('Change formulation', 'bcFormulation', { arg: r.id }));
  if (m.remove) out.push(btn('Replace', 'bcReplace', { arg: r.id }), btn('Request removal', 'bcRemove', { arg: r.id }));
  else if (!m.permanent) out.push(btn('Stop', 'bcStop', { arg: r.id }));
  if (!m.permanent && !m.barrier) out.push(btn('Change method', 'bcSwitch', { arg: r.id }));
  return out;
}

function current(p) {
  const c = C.cx(p);
  const act = C.active(p);
  const sched = c.scheduled.map((s) => kv(`${METHOD_BY_ID[s.methodId].name}`, `${esc(C.dateOf(s.abs, p))} ${btn('Cancel', 'bcCancelSched', { arg: s.id })}`)).join('');
  const barrier = act.some((r) => C.def(r).barrier);
  return `${act.length ? act.map((r) => methodCard(r, p)).join('') : card('No method in use', `${c.legacyDefault ? muted('The game has been assuming you use birth control without saying which. Choose one to be specific, or say you use none.') : muted('Nothing in use.')}
      <div class="btn-row">${btn('Explore methods', 'bcGo', { arg: 'explore', primary: true })}${btn('Book a consultation', 'bcConsult')}${c.legacyDefault ? btn('I use none', 'bcNone') : ''}</div>`)}
    ${card('Barrier protection', `${muted('Condoms lower the risk of many sexually transmitted infections; IUDs, implants, pills, patches, rings and injections do not.')}
      <div class="btn-row">${barrier ? btn('Stop using condoms', 'bcStopBarrier') : btn('Use condoms', 'bcStart', { arg: 'condom_external' })}${barrier ? '' : btn('Use condoms with another method', 'bcStart', { arg: 'condom_external' })}</div>`)}
    ${sched ? card('Booked', sched) : ''}`;
}

function methodRow(m, p) {
  const el = C.eligibility(m.id, p);
  const yrs = m.durations ? C.durationYears(m, p.countryId) : null;
  const avail = C.availableIn(m.id, p.countryId);
  const inUse = C.active(p).some((r) => r.methodId === m.id);
  return `<div class="hl-module"><div class="kv"><span><strong>${esc(m.name)}</strong></span><span>${pill(m.hormonal ? 'Hormonal' : 'Nonhormonal')}</span></div>
    <p class="muted">${esc(m.mechanism)}</p>
    ${kv('Pregnancies in the first year', `${esc(m.typicalRange ? `${m.typicalRange[0]}–${m.typicalRange[1]}` : String(m.typical))} in 100 with typical use; ${esc(String(m.perfect))} with perfect use`)}
    ${yrs ? kv('Lasts', `Up to ${yrs} years (approved here)`) : ''}
    ${kv('Day to day', esc(m.maintenance))}
    ${!avail ? kv('Here and now', 'Not available') : el.cat > 1 ? kv('For you', esc(C.CATEGORY_WORDS[el.cat])) : ''}
    <div class="btn-row">${inUse ? pill('In use', 'good') : m.permanent ? btn('Ask about it', 'bcPermanent', { arg: m.id, disabled: !avail || !el.ok }) : btn(`Choose ${m.name.toLowerCase()}`, 'bcStart', { arg: m.id, disabled: !avail || !el.ok })}
      ${btn(nav0().compare?.includes(m.id) ? 'Remove from comparison' : 'Add to comparison', 'bcCompareToggle', { arg: m.id })}</div></div>`;
}
let navRef = null;
const nav0 = () => navRef?.bc ?? {};
function explore(p, nav) {
  navRef = nav;
  const groups = [['Long-acting reversible', (m) => m.category === 'larc'], ['Pills, patch, ring and injection', (m) => ['pill', 'patch', 'ring', 'injection'].includes(m.category)],
    ['Barrier methods', (m) => m.category === 'barrier'], ['Fertility awareness', (m) => m.category === 'awareness'], ['Permanent', (m) => m.category === 'permanent']];
  const fits = METHODS.filter((m) => C.eligibility(m.id, p).blocked !== 'Used by someone who could become pregnant.' && C.eligibility(m.id, p).blocked !== 'Used by a partner who could cause a pregnancy.');
  return `${card('', `${muted('No method is best for everyone. Each trades off how well it works, what it asks of you day to day, hormones, side effects, cost and whether it protects against infections.')}${btn('Book a consultation', 'bcConsult', { primary: true })}`)}
    ${groups.map(([title, test]) => { const list = fits.filter(test); return list.length ? card(title, list.map((m) => methodRow(m, p)).join('')) : ''; }).join('')}`;
}

function compare(p, nav) {
  navRef = nav;
  const rows = C.comparison(nav.bc.compare, p);
  if (!rows.length) return card('Compare', muted('Add methods from Explore methods to compare them.'));
  return `${card('', muted('Characteristics side by side. There is no single ranking: what matters most is yours to weigh.'))}
    <div class="bc-compare">${rows.map((x) => card(esc(x.name), `${kv('Hormones', esc(x.hormonal))}${kv('Kind', esc(x.acting))}${kv('Pregnancies, first year', `${esc(x.typical)} (typical use)`)}${kv('With perfect use', esc(x.perfect))}
      ${kv('Upkeep', esc(x.maintenance))}${kv('How you get it', esc(x.access ?? 'Not available'))}${kv('Duration', esc(x.duration))}
      ${kv('Possible effects', esc(x.sideEffects.length ? x.sideEffects.join(', ') : 'Few'))}${kv('Starting cost to you', esc(money(x.startCost)))}${kv('Infections', esc(x.sti))}
      ${kv('Available', x.available ? 'Yes' : 'Not here and now')}${kv('For you', esc(C.CATEGORY_WORDS[x.eligibility.cat] ?? '—'))}${x.approximate ? muted('Approximate in this game.') : ''}
      ${btn('Remove', 'bcCompareToggle', { arg: x.id })}`)).join('')}</div>`;
}

function eligibility(p) {
  const c = C.cx(p);
  const list = METHODS.filter((m) => C.availableIn(m.id, p.countryId)).map((m) => ({ m, el: C.eligibility(m.id, p) })).filter((x) => !/Used by/.test(x.el.blocked ?? ''));
  return `${card('', `${muted('Shaped on the US Medical Eligibility Criteria: 1 no restriction, 2 generally suitable, 3 needs a careful discussion, 4 not suitable now. It only uses what your record shows; a clinician looks at the whole picture.')}
      ${C.consultedRecently(p) ? kv('Last consultation', `${esc(C.dateOf(c.consults.at(-1).abs, p))} with ${esc(who(c.consults.at(-1).providerId))}`) : btn('Book a consultation', 'bcConsult', { primary: true })}`)}
    ${card('Your methods', list.map(({ m, el }) => `<div class="hl-module">${kv(m.name, pill(el.ok ? `${el.cat}: ${C.CATEGORY_WORDS[el.cat]}` : el.blocked ?? 'Not suitable', el.cat <= 2 && el.ok ? 'good' : ''))}${el.reasons.length ? muted(esc(el.reasons.join(' '))) : ''}</div>`).join(''))}`;
}

function appointments(p) {
  const h = healthOf(p);
  const list = h.appointments.filter((a) => a.kind === 'contraception').slice().reverse().slice(0, 30);
  const c = C.cx(p);
  const ahead = [...C.active(p).map((r) => ({ what: `${C.def(r).name}: ${C.nextAction(r, p)}` })), ...c.scheduled.map((s) => ({ what: `${METHOD_BY_ID[s.methodId].name}: ${C.dateOf(s.abs, p)}` }))];
  return `${card('Coming up', ahead.length ? ahead.map((a) => `<p>${esc(a.what)}</p>`).join('') : muted('Nothing booked.'))}
    ${card('Book', `<div class="btn-row">${btn('Book a consultation', 'bcConsult', { primary: true })}</div>`)}
    ${card('Past visits', list.length ? list.map((a) => kv(a.what ?? 'Visit', esc(`${who(a.providerId)}${a.paid ? `, ${money(a.paid)}` : ''}`))).join('') : muted('None yet.'))}`;
}

function concerns(p) {
  const act = C.active(p).filter((r) => !C.def(r).permanent || r.effects?.length);
  if (!act.length) return card('Side effects & concerns', muted('Nothing in use.'));
  return act.map((r) => {
    const n = C.noticed(r);
    return card(esc(C.def(r).name), `${n.length ? n.map((e) => kv(e.label, e.reported ? 'Reported' : 'Noticed')).join('') : muted('Nothing noticed. Many people notice nothing at all.')}
      ${muted(`Possible with this method for some people: ${esc((C.def(r).sideEffects ?? []).map((s) => SIDE_EFFECTS[s]?.label.toLowerCase()).filter(Boolean).join(', ') || 'few effects')}.`)}
      <div class="btn-row">${btn('Report a concern', 'bcConcern', { arg: r.id, primary: n.length > 0 })}</div>`);
  }).join('');
}

function change(p) {
  const act = C.active(p);
  const devices = act.filter((r) => C.def(r).remove);
  const own = act.filter((r) => !C.def(r).remove && !C.def(r).permanent);
  const perm = act.filter((r) => C.def(r).permanent);
  return `${devices.length ? devices.map((r) => card(esc(C.def(r).name), `${kv('Placed', esc(C.dateOf(r.startAbs, p)))}${kv('Approved until', esc(C.dateOf(r.expiresAbs, p)))}
      ${muted('Removed or replaced by a trained clinician, whenever you want: you do not have to wait until it is due.')}<div class="btn-row">${btn('Replace', 'bcReplace', { arg: r.id })}${btn('Request removal', 'bcRemove', { arg: r.id })}${btn('Change to another method', 'bcSwitch', { arg: r.id })}</div>`)).join('') : ''}
    ${own.length ? own.map((r) => card(esc(C.def(r).name), `${muted('You can stop this yourself, or change to another method without a gap.')}<div class="btn-row">${btn('Change method', 'bcSwitch', { arg: r.id })}${btn('Stop', 'bcStop', { arg: r.id })}</div>`)).join('') : ''}
    ${perm.length ? perm.map((r) => card(esc(C.def(r).name), muted('Meant to be permanent. There is no undo; reversal is a separate, major operation that often does not work.'))).join('') : ''}
    ${!act.length ? card('Nothing to change', muted('No method in use.')) : ''}`;
}

function planning(p) {
  const c = C.cx(p);
  const partner = p.npcIds.map(npcOf).find((n) => n?.alive && ['spouse', 'partner'].includes(n.role));
  const pp = c.postpartum && C.monthsSinceBirth(p) < 12;
  return `${card('Pregnancy plans', `${kv('Now', esc(c.planning ? C.PLANNING[c.planning] : 'Not said'))}
      ${muted('A preference changes nothing by itself: it does not make a pregnancy happen, and it is not contraception.')}
      <div class="btn-row">${btn('Change', 'bcPlan', { primary: true })}${partner ? btn(`Talk with ${partner.firstName}`, 'bcPartner', { arg: partner.id }) : ''}</div>
      ${c.partnerTalks.length ? `<div class="section-label">Conversations</div>${c.partnerTalks.slice(-4).reverse().map((t) => kv(C.dateOf(t.abs, p), esc(`${npcOf(t.npcId)?.firstName ?? 'Partner'} ${t.said}`))).join('')}` : ''}`)}
    ${pp ? card('After the birth', `${kv('Breastfeeding', c.postpartum.breastfeeding == null ? 'Not said' : c.postpartum.breastfeeding ? 'Yes' : 'No')}
      ${muted('Not every method suits the first weeks after a birth. Breastfeeding alone is not reliable contraception unless strict conditions are met.')}
      ${C.postpartumOptions(p).map((o) => kv(o.name, pill(o.ok ? C.CATEGORY_WORDS[o.cat] : 'Not now', o.cat <= 2 ? 'good' : ''))).join('')}
      <div class="btn-row">${btn(c.postpartum.breastfeeding ? 'Not breastfeeding' : 'Breastfeeding', 'bcBreastfeeding')}${btn('Book a consultation', 'bcConsult')}</div>`) : ''}
    ${C.blocksTrying(p) && ['soon', 'considering'].includes(c.planning) ? card('', muted(esc(C.blocksTrying(p)))) : ''}`;
}

function history(p) {
  const c = C.cx(p);
  const all = c.methods.slice().reverse();
  return `${card('Methods', all.length ? all.map((r) => `<div class="hl-module">${kv(C.def(r).name, pill(C.statusOf(r).label))}${kv('From', esc(`${C.dateOf(r.startAbs, p)}${r.endAbs != null ? ` to ${C.dateOf(r.endAbs, p)}` : ''}`))}
      ${r.endReason ? kv('Why', esc(r.endReason)) : ''}${r.events.slice(-4).map((e) => `<p class="muted">${esc(C.dateOf(e.abs, p))}: ${esc(e.text)}</p>`).join('')}</div>`).join('') : muted('Nothing yet.'))}
    ${c.planningHistory.length ? card('Plans over time', c.planningHistory.map((x) => kv(C.dateOf(x.abs, p), esc(C.PLANNING[x.to]))).join('')) : ''}
    ${c.exposures.length ? card('Emergency contraception', c.exposures.slice().reverse().map((e) => kv(C.dateOf(e.abs, p), esc(e.ec ? C.EMERGENCY.find((x) => x.id === e.ec)?.name ?? '' : 'Not used'))).join('')) : ''}`;
}

// ---------- What the buttons do ----------

/** The flows, for My Health's click handler. `after(result)` shows the result and redraws. */
export function bcFlows({ p, after, draw, nav, api }) {
  const ensure = () => (nav.bc ??= { tab: 'current', compare: [...DEFAULT_COMPARE] });
  const pickProvider = async (service, title) => {
    const list = C.providersFor(service, p);
    if (!list.length) { await messageModal({ body: 'Nobody nearby offers this yet.' }); return null; }
    const i = await pickModal({ title, body: 'Who would you like to see?', options: list.map((o, k) => ({ value: k, disabled: !o.ok, label: `${o.provider}, ${o.professionName}`, sub: o.ok ? `${o.facility}. A visit: ${money(o.cost)}.` : o.why })) });
    return i == null ? null : list[i];
  };
  async function start(id, from = null) {
    const m = METHOD_BY_ID[id];
    const el = C.eligibility(id, p);
    if (!el.ok) return after({ text: el.blocked, tone: 'neutral' });
    let ack = false;
    if (el.cat === 3) {
      ack = await confirmModal({ title: m.name, body: `${el.reasons.join(' ')} Your clinician would usually suggest another option. You can still choose it after talking it through together.`, yes: 'We have talked it through', no: 'Think again' });
      if (!ack) return draw(true);
    }
    const route = C.accessRoute(id, p.countryId);
    let provider = null;
    if (['clinic', 'procedure'].includes(route) && id !== 'fam') {
      provider = await pickProvider(C.serviceFor(id), m.name);
      if (!provider) return draw(true);
    }
    let formulation = null;
    const forms = (m.formulations ?? []).filter((f) => f.from <= store.state.year);
    if (forms.length > 1) { formulation = await pickModal({ title: 'Which kind?', options: forms.map((f) => ({ value: f.id, label: f.name, sub: f.note ?? '' })) }); if (!formulation) return draw(true); }
    const o = { provider, formulation, acknowledge: ack };
    let r = from ? C.switchMethod(from, id, o, p) : C.startMethod(id, o, p);
    if (!r.ok && r.switchNeeded) {
      const cur = C.primaryNow(p);
      if (await confirmModal({ title: 'Change at the same visit?', body: `Your ${C.def(cur).name.toLowerCase()} comes out and ${m.name.toLowerCase()} starts, with no gap in between.`, yes: 'Yes' })) r = C.switchMethod(cur.id, id, o, p);
      else return draw(true);
    } else if (!r.ok && r.minor) {
      const g = await confirmModal({ title: 'Involving a parent or guardian', body: r.text, yes: 'Involve a parent or guardian', no: 'Not now' });
      if (!g) return draw(true);
      r = C.startMethod(id, { ...o, guardian: true }, p);
    }
    return after(r);
  }
  return {
    bc: () => { ensure(); nav.page = 'bc'; draw(); },
    bcGo: (arg) => { ensure().tab = arg; draw(); },
    bcConsult: async () => { const o = await pickProvider('counsel', 'A consultation'); return o ? after(C.consult(o, 'options', p)) : draw(true); },
    bcStart: (arg) => start(arg),
    bcSwitch: async (arg) => {
      const opts = METHODS.filter((m) => !m.barrier && !m.permanent && C.eligibility(m.id, p).ok && !C.active(p).some((r) => r.methodId === m.id));
      const id = await pickModal({ title: 'Change to', body: 'The new method starts and the old one stops, with no gap in protection.', options: opts.map((m) => ({ value: m.id, label: m.name, sub: m.maintenance })) });
      return id ? start(id, arg) : draw(true);
    },
    bcStop: async (arg) => ((await confirmModal({ title: 'Stop this method?', body: 'It stops protecting you. You can start again, or choose another, at any time.', yes: 'Stop' })) ? after(C.stopMethod(arg, null, p)) : draw(true)),
    bcStopBarrier: () => { const r = C.barriersNow(p)[0]; return r ? after(C.stopMethod(r.id, null, p)) : draw(true); },
    bcRemove: async (arg) => { const r = C.cx(p).methods.find((x) => x.id === arg); const o = await pickProvider(C.def(r).remove, 'Removal'); return o ? after(C.removeDevice(arg, { provider: o }, p)) : draw(true); },
    bcReplace: async (arg) => { const r = C.cx(p).methods.find((x) => x.id === arg); const o = await pickProvider(C.def(r).remove, 'Replacement'); return o ? after(C.replaceDevice(arg, { provider: o }, p)) : draw(true); },
    bcConcern: (arg) => after(C.reportConcern(arg, p)),
    bcFormulation: async (arg) => { const r = C.cx(p).methods.find((x) => x.id === arg); const f = await pickModal({ title: 'Formulation', options: (C.def(r).formulations ?? []).filter((x) => x.from <= store.state.year).map((x) => ({ value: x.id, label: x.name, sub: x.note ?? '' })) }); return f ? after(C.changeFormulation(arg, f, p)) : draw(true); },
    bcResume: (arg) => after(C.resume(arg, p)),
    bcNone: () => after(C.legacySwitch(false, p)),
    bcPlan: async () => { const v = await pickModal({ title: 'Pregnancy plans', body: 'Yours to say, and to change whenever you like.', options: Object.entries(C.PLANNING).map(([k, l]) => ({ value: k, label: l })) }); return v ? after(C.setPlanning(v, p)) : draw(true); },
    bcPartner: (arg) => after(C.discussWithPartner(arg, 'plans', p)),
    bcBreastfeeding: () => after(C.setBreastfeeding(!C.cx(p).postpartum?.breastfeeding, p)),
    bcCompareToggle: (arg) => { const b = ensure(); b.compare = b.compare.includes(arg) ? b.compare.filter((x) => x !== arg) : [...b.compare, arg].slice(-6); api?.changed?.(); draw(true); },
    bcCancelSched: (arg) => after(C.cancelScheduled(arg, p)),
    bcPermanent: async (arg) => {
      const m = METHOD_BY_ID[arg];
      const c = C.cx(p);
      if (c.consents[arg]) return (await confirmModal({ title: m.name, body: 'You have consented. Book the procedure? You can cancel before it happens.', yes: 'Book it' })) ? after(C.scheduleProcedure(arg, p)) : draw(true);
      const yes = await confirmModal({ title: m.name, body: `${m.mechanism} ${m.maintenance} Long-acting reversible methods work about as well and can be stopped. Some people later regret a permanent choice, especially when young.`, yes: 'I understand: counseling and consent', no: 'Not now' });
      if (!yes) return draw(true);
      const o = await pickProvider(m.procedure, 'Counseling');
      return o ? after(C.giveConsent(arg, { provider: o, understood: true }, p)) : draw(true);
    },
  };
}

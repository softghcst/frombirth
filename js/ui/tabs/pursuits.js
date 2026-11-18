// Pursuits tab: things to do, Digital Life, gambling, crime, moving abroad,
// and, when it goes wrong, life inside.
import { cityLine } from '../../engine/cities.js';
import { store, player, country } from '../../state.js';
import { esc, fmtMoney } from '../../util.js';
import { canGamble } from '../../engine/gambling.js';
import { may } from '../../engine/rules.js';
import * as law from '../../engine/justice.js';
import * as jail from '../../engine/prison.js';
import { CRIME_BY_ID } from '../../data/crimes.js';
import { prisonHub, hubClick } from '../prisonHub.js';
import { legalCard, legalClick } from '../justice.js';
import { playBlackjack, playHorses, playLottery } from '../minigames/casino.js';
import { meterHtml } from '../meter.js';
import { messageModal, pickModal, confirmModal } from '../modals.js';
import * as fun from '../../engine/activities.js';
import { openDigitalLife, digitalCard } from '../digital.js';
import * as bc from '../../engine/digital/broadcast.js';
import { canEmigrate } from '../../engine/emigration.js';
import * as leisure from '../leisure.js';
import { roleLabel } from '../../engine/relationships.js';
import { openScreen } from '../animals.js';
import '../animalHub.js';
import * as riding from '../../engine/equestrian.js';
import { athleticsCard, openAthletics } from '../sports.js';

async function report(api, r) {
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
}

async function commitCrime(api) {
  const id = await pickModal({
    title: 'Crime',
    body: 'Talent, brains and luck decide whether it works. Every crime wears your luck thinner and brings the police closer.',
    options: law.crimeOptions().map((c) => ({ value: c.id, label: c.name, sub: `Your chances: ${c.odds}. ${c.stakes}` })),
  });
  if (!id) return;
  let targetId;
  const how = {};
  if (CRIME_BY_ID[id].target) {
    const known = law.targets();
    const kind = await pickModal({ title: 'Who?', options: [
      { value: 'stranger', label: 'A stranger', sub: 'Whoever happens to be around this year.' },
      { value: 'known', label: 'Someone you know', sub: known.length ? 'They trust you, which makes it easier to get close.' : 'You do not know anyone.', disabled: !known.length },
    ] });
    if (!kind) return;
    if (kind === 'known') {
      targetId = await pickModal({ title: 'Who?',
        options: known.map((n) => ({ value: n.id, label: `${n.firstName} ${n.lastName}`, sub: `${roleLabel(n)}, age ${n.age}` })) });
      if (!targetId) return;
    } else {
      how.strangerId = await pickModal({ title: 'Who?', body: 'Different people every year.',
        options: law.strangerOptions().map((x) => ({ value: x.id, label: x.name.replace(/^./, (ch) => ch.toUpperCase()), sub: x.note })) });
      if (!how.strangerId) return;
    }
    how.methodId = await pickModal({ title: 'How?', body: 'Some ways are surer. Some are quieter. Some are neither.',
      options: law.methodOptions().map((m) => ({ value: m.id, label: m.name, sub: `${m.blurb} Your chances: ${m.odds}.` })) });
    if (!how.methodId) return;
  }
  const sure = await confirmModal({ title: `${CRIME_BY_ID[id].name}?`, body: 'There is no taking this back.', yes: 'Do it', danger: true });
  if (!sure) return;
  const r = law.commitCrime(id, targetId, how);
  await report(api, r);
  if (r.arrested) await api.justice();
}

async function joinGang(api) {
  const id = await pickModal({
    title: 'Join a gang',
    body: `Protection and standing, at the cost of your record inside. Your respect is ${Math.round(jail.cell().respect)}%.`,
    options: jail.gangOptions().map((g) => ({ value: g.id, label: g.name, disabled: !g.open,
      sub: g.open ? g.blurb : `${g.blurb} Needs ${g.respect}% respect.` })),
  });
  if (id) await report(api, jail.joinGang(id));
}

export default {
  id: 'pursuits', title: 'Pursuits', short: 'Pursuits',
  icon: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  render(el, api) {
    const p = player();
    const c = country();
    if (law.isJailed()) {
      el.innerHTML = prisonHub();
    } else {
      const gambled = p.counters.gambled * c.currency.scale;
      const things = fun.activityOptions();
      el.innerHTML = `
        ${things.length ? `<div class="card"><h3>Things to do</h3>
          <p class="muted" style="margin-bottom:10px">Each of these can be done once a year.</p>
          <div class="btn-stack">${things.map((a) => `<button class="btn" data-do="${a.id}" ${a.done ? 'disabled' : ''}>${esc(a.label)}${a.done ? ' · done this year' : ''}</button>`).join('')}</div>
        </div>` : ''}
        <div class="card"><h3>Gambling</h3>
          ${canGamble()
    ? `<p class="muted" style="margin-bottom:10px">The house always has an edge. Stakes leave your account the moment you place them.</p>
             <div class="btn-stack">
               <button class="btn" data-play="blackjack">Blackjack</button>
               <button class="btn" data-play="horses">The races</button>
               <button class="btn" data-play="lottery">Lottery tickets</button>
             </div>
             ${gambled ? `<div class="kv" style="margin-top:10px"><span>Staked in your lifetime</span><span>${esc(fmtMoney(gambled, c))}</span></div>` : ''}`
    : `<p class="muted">${esc(may('gamble').why || 'Not from where you are.')}</p>`}
        </div>
        ${law.canCommitCrimes() ? `<div class="card"><h3>Crime</h3>
          <div class="kv"><span>Police attention</span><span>${p.legal.heat >= 60 ? 'They are looking for you' : p.legal.heat >= 25 ? 'You are known to them' : 'None'}</span></div>
          ${p.flags.fugitive ? '<div class="kv"><span>Status</span><span>On the run</span></div>' : ''}
          <p class="muted" style="margin-top:8px">Every crime has someone on the other end of it, and an investigation that may follow you for years.</p>
          <button class="btn danger" data-crime style="margin-top:10px">Commit a crime</button>
        </div>` : ''}
        ${(() => { const opts = bc.broadcastOptions(); return opts.length ? `<div class="card"><h3>Radio and television</h3><p class="muted" style="margin-bottom:10px">Once a year. With others at home, it is time together.</p><div class="btn-stack">${opts.map((o) => `<button class="btn" data-tune="${o.id}" ${o.done ? 'disabled' : ''}>${esc(o.label)}${o.done ? ' · done this year' : ''}</button>`).join('')}${p.age >= 16 ? opts.filter((o) => bc.setFor(o.id) === 'elsewhere').map((o) => `<button class="btn" data-buyset="${o.id === 'radio' ? 'radio_set' : 'tv_set'}">Buy a ${o.id === 'radio' ? 'radio' : 'television'} set of your own</button>`).join('') : ''}</div></div>` : ''; })()}
        ${digitalCard()}
        ${legalCard()}
        ${law.isJailed() ? '' : athleticsCard()}
        ${p.age >= 6 && !p.legal.incarceration ? `<div class="card"><h3>Riding</h3><p class="muted" style="margin-bottom:10px">${p.riding ? `${esc(riding.levelName(riding.riderLevel()))} rider · ${p.riding.lessons} ${p.riding.lessons === 1 ? 'year' : 'years'} of lessons${p.riding.record.length ? ` · ${p.riding.record.length} ${p.riding.record.length === 1 ? 'show' : 'shows'}` : ''}` : 'Lessons, horses and the show ring.'}</p><button class="btn" data-go="riding">Equestrian</button></div>` : ''}
        ${canEmigrate() ? `<div class="card"><h3>Moving</h3><p class="muted" style="margin-bottom:10px">You live in ${esc(p.city)}: ${esc(cityLine(p.countryId, p.city))}.</p><div class="btn-stack">${c.cities.length > 1 ? '<button class="btn" data-go="city">Move to another city</button>' : ''}<button class="btn" data-go="abroad">Move abroad</button></div></div>` : ''}`;
    }
    el.onclick = (e) => {
      if (law.isJailed()) return hubClick(e, api, joinGang);
      if (legalClick(e, api)) return undefined;
      const game = e.target.closest('[data-play]')?.dataset.play;
      if (game) return ({ blackjack: playBlackjack, horses: playHorses, lottery: playLottery })[game](api);
      if (e.target.closest('[data-crime]')) return commitCrime(api);
      if (e.target.closest('[data-digital]')) return openDigitalLife(api);
      const buyset = e.target.closest('[data-buyset]')?.dataset.buyset;
      if (buyset) return import('../../engine/digital/tech.js').then((t) => report(api, t.buyDevice(buyset)));
      const tune = e.target.closest('[data-tune]')?.dataset.tune;
      if (tune) {
        const opt = bc.broadcastOptions().find((o) => o.id === tune);
        return pickModal({ title: tune === 'radio' ? 'What do you listen to?' : 'What do you watch?', options: opt.programmes.map((x) => ({ value: x.id, label: x.label })) })
          .then((pick) => (pick ? report(api, bc.tuneIn(tune, pick)) : undefined));
      }
      const todo = e.target.closest('[data-do]')?.dataset.do;
      if (todo) return leisure.quick(api)[todo]();
      const go = e.target.closest('[data-go]')?.dataset.go;
      if (go === 'riding') return openScreen(api, 'riding');
      if (go === 'athletics') return openAthletics(api);
      if (go) return ({ account: leisure.openAccount, followers: leisure.buyFollowers, abroad: leisure.moveAbroad, city: leisure.moveCity })[go](api);
      return undefined;
    };
  },
};

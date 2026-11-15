// People tab: everyone in your life, what they remember, and everything you
// can do with them, from a conversation to a wedding.
import { store, player, country, livingNpcs } from '../../state.js';
import { esc, fmtMoney, localMoney } from '../../util.js';
import * as rel from '../../engine/relationships.js';
import * as love from '../../engine/romance.js';
import * as kids from '../../engine/children.js';
import * as lives from '../../engine/npcLives.js';
import { openFamilyTree } from '../familyTree.js';
import { avatarSvg, petGlyph } from '../avatar.js';
import { meterHtml, band } from '../meter.js';
import { openModal, messageModal, pickModal, confirmModal, inputModal } from '../modals.js';
import { TRAIT_BY_ID } from '../../data/traits.js';

const ORDER = ['spouse', 'partner', 'child', 'grandchild', 'greatgrandchild', 'parent', 'sibling', 'grandparent', 'inlaw', 'niece', 'relative',
  'pet', 'friend', 'classmate', 'mentor', 'coworker', 'boss', 'ex', 'enemy', 'cellmate'];
const GROUPS = [
  ['Partner', ['spouse', 'partner']],
  ['Children and grandchildren', ['child', 'grandchild', 'greatgrandchild']],
  ['Family', ['parent', 'sibling', 'grandparent', 'inlaw', 'niece', 'relative', 'pet']],
  ['Friends', ['friend', 'classmate']],
  ['Work and mentors', ['mentor', 'coworker', 'boss']],
  ['Others', ['ex', 'enemy', 'cellmate']],
];

const portrait = (npc) => (npc.role === 'pet'
  ? `<div class="avatar glyph">${petGlyph(npc.species)}</div>`
  : `<div class="avatar">${avatarSvg({ age: npc.age, gender: npc.gender, appearance: npc.appearance, seed: npc.id, mood: npc.meters.relationship })}</div>`);

async function report(api, r) {
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
}

// ---------- Flows that need more than one step ----------

async function giveGift(api, npc) {
  const c = country();
  const cash = player().finance.cash;
  const tier = await pickModal({
    title: `A gift for ${npc.firstName}`,
    options: rel.GIFTS.map((g) => {
      const cost = localMoney(g.cost, c);
      return { value: g.id, label: g.name, sub: fmtMoney(cost, c), disabled: cash < cost };
    }),
  });
  if (tier) await report(api, rel.interact(npc.id, 'gift', tier));
}

async function proposeTo(api, npc) {
  const c = country();
  const cash = player().finance.cash;
  const ring = await pickModal({
    title: `Propose to ${npc.firstName}`,
    body: 'How close you are matters most. A better ring helps a little.',
    options: love.RINGS.map((r) => {
      const cost = localMoney(r.cost, c);
      return { value: r.id, label: r.name, sub: fmtMoney(cost, c), disabled: cash < cost };
    }),
  });
  if (ring) await report(api, love.propose(npc.id, ring));
}

async function planWedding(api, npc) {
  const c = country();
  const cash = player().finance.cash;
  const wedding = await pickModal({
    title: 'Plan the wedding',
    options: love.WEDDINGS.map((w) => {
      const cost = localMoney(w.cost, c);
      return { value: w.id, label: w.name, sub: fmtMoney(cost, c), disabled: cash < cost };
    }),
  });
  if (!wedding) return;
  let prenup = await confirmModal({
    title: 'Ask for a prenup?',
    body: `Without one, a divorce splits everything down the middle. Asking will sting ${npc.firstName} a little, and they may refuse.`,
    yes: 'Ask for a prenup', no: 'No prenup',
  });
  if (prenup) {
    const answer = love.askForPrenup(npc.id);
    api.changed();
    await messageModal({ body: answer.text, tone: answer.tone });
    prenup = answer.ok;
    if (!prenup) {
      const goOn = await confirmModal({ title: 'Marry without a prenup?', body: `${npc.firstName} will not sign. You can marry anyway, or put the wedding on hold.`, yes: 'Marry anyway', no: 'Put it on hold' });
      if (!goOn) return;
    }
  }
  await report(api, love.marry(npc.id, wedding, prenup));
}

async function fileForDivorce(api, npc) {
  const c = country();
  const owed = love.settlement(npc.id);
  const money = npc.prenup ? 'Your prenup means you each keep what is yours.'
    : owed > 0 ? `With no prenup, you would pay ${npc.firstName} about ${fmtMoney(owed, c)}.`
      : owed < 0 ? `With no prenup, you would receive about ${fmtMoney(-owed, c)}.` : 'There is nothing to split.';
  const yes = await confirmModal({
    title: `Divorce ${npc.firstName}?`,
    body: `${money} Lawyers cost ${fmtMoney(localMoney(love.DIVORCE_FEE, c), c)}. This cannot be undone.`,
    yes: 'File for divorce', danger: true,
  });
  if (yes) await report(api, love.divorce(npc.id));
}

async function rename(api, npc) {
  const name = await inputModal({ title: `Rename ${npc.firstName}`, label: 'New first name', value: npc.firstName, maxLength: 20 });
  if (name) await report(api, kids.renameChild(npc.id, name));
}

async function lookForLove(api) {
  if (!love.interest()) {
    const want = await pickModal({
      title: 'Who are you interested in?',
      options: [{ value: 'women', label: 'Women' }, { value: 'men', label: 'Men' }, { value: 'everyone', label: 'Everyone' }],
    });
    if (!want) return;
    love.setInterest(want);
    api.changed();
  }
  const place = await pickModal({
    title: 'Look for love',
    body: 'You can meet up to three new people a year.',
    options: love.meetingPlaces().map((m) => ({ value: m.id, label: m.name, sub: m.desc })),
  });
  if (!place) return;
  const met = love.meetSomeone(place);
  api.changed();
  if (!met.ok) { await messageModal({ body: met.text }); return; }
  const n = met.npc;
  const ask = await confirmModal({
    title: `${n.firstName} ${n.lastName}, ${n.age}`,
    body: `${n.firstName} is ${met.blurb}.`,
    yes: 'Ask them out', no: 'Not for you',
  });
  if (ask) await report(api, love.askOutStranger(n));
}

// ---------- One person ----------

function openNpc(npc, api) {
  lives.ensureLife(npc);
  const m = npc.meters;
  const isPet = npc.role === 'pet';
  const meters = isPet
    ? meterHtml('Bond', m.relationship, true) + meterHtml('Health', m.health, true)
    : [['Relationship', m.relationship], ['Money', m.money], ['Intellect', m.intellect],
      ['Charm', m.charm], ['Health', m.health], ['Generosity', m.generosity], ['Crazy', m.crazy]]
      .map(([n, v]) => meterHtml(n, v, true)).join('');
  const detail = [npc.occupation, npc.marriedAtAge != null && npc.role === 'spouse' ? `${player().age === npc.marriedAtAge ? 'newly married' : `married ${player().age - npc.marriedAtAge} yr`}${npc.prenup ? ', prenup' : ''}` : '']
    .filter(Boolean).map((x) => ` · ${esc(x)}`).join('');
  const known = (npc.traits ?? []).map((id) => TRAIT_BY_ID[id]).filter(Boolean);
  const traitChips = known.length
    ? `<div class="chips" style="margin-top:10px">${known.map((t) => `<span class="chip">${esc(t.name)}</span>`).join('')}</div>` : '';
  const rival = store.state.npcs[npc.flags.feudWith];
  const feudNote = rival?.alive ? `<p class="muted" style="margin-top:8px">Not speaking to ${esc(rival.firstName)} at the moment.</p>` : '';
  const expecting = player().flags.pregnancy?.otherId === npc.id
    ? '<p class="muted" style="margin-top:8px">You are expecting a baby together.</p>' : '';
  const history = npc.memories?.length
    ? `<div class="section-label" style="margin-top:0">What they remember</div>
       ${npc.memories.map((x) => `<div class="kv"><span>When you were ${x.age}</span><span>${esc(x.text)}</span></div>`).join('')}
       <div style="height:14px"></div>` : '';

  const life = lives.lifeSummary(npc);
  const lifeCard = life.length ? `<div class="section-label" style="margin-top:0">Their life</div>
    ${life.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('')}
    <div style="height:14px"></div>` : '';
  const timeline = npc.life?.history.length
    ? `<div class="section-label" style="margin-top:0">What has happened to them</div>
       ${npc.life.history.slice(-14).reverse().map((h) => `<div class="kv"><span>Age ${h.age}</span><span>${esc(h.text.charAt(0).toUpperCase() + h.text.slice(1))}.</span></div>`).join('')}
       <div style="height:14px"></div>` : '';
  const canEncourage = npc.alive && npc.life?.aspiration && !npc.life.aspiration.achieved && npc.age >= 16;

  const actions = [
    ...(npc.alive ? love.romanceActions(npc) : []),
    ...(canEncourage ? [{ id: 'encourage', label: 'Encourage their ambition' }] : []),
    ...(kids.canTryForBaby(npc) ? [{ id: 'baby', label: 'Try for a baby' }] : []),
    ...(kids.canRename(npc) ? [{ id: 'rename', label: 'Change their name' }] : []),
    ...(npc.alive ? rel.basicActions(npc) : []),
  ];
  // Friendly things first, destructive things last.
  actions.sort((a, b) => Number(!!a.danger) - Number(!!b.danger));

  const modal = openModal(`
    <div class="row" style="border:0;padding:0;background:none">
      ${portrait(npc)}
      <div class="main"><strong>${esc(npc.firstName)} ${isPet ? '' : esc(npc.lastName)}</strong>
        <small>${esc(rel.roleLabel(npc))} · ${npc.alive ? `age ${npc.age}` : `died at ${npc.age}`}${detail}</small></div>
    </div>
    ${traitChips}${feudNote}${expecting}
    <div style="margin:12px 0 16px">${meters}</div>
    ${lifeCard}${history}${timeline}
    <div class="btn-stack">
      ${actions.map((a) => `<button class="btn ${a.danger ? 'danger' : ''}" data-act="${a.id}">${esc(a.label)}</button>`).join('')}
      <button class="btn" data-close>Close</button>
    </div>`, { dismissable: true });

  modal.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) return modal.close();
    const id = e.target.closest('[data-act]')?.dataset.act;
    if (!id) return undefined;
    modal.close();
    const flows = {
      gift: () => giveGift(api, npc),
      propose: () => proposeTo(api, npc),
      wedding: () => planWedding(api, npc),
      divorce: () => fileForDivorce(api, npc),
      rename: () => rename(api, npc),
      askOut: () => report(api, love.askOut(npc.id)),
      date: () => report(api, love.goOnDate(npc.id)),
      hookUp: () => report(api, love.hookUp(npc.id)),
      baby: () => report(api, kids.tryForBaby(npc.id)),
      encourage: () => report(api, lives.encourage(npc.id)),
      breakUp: async () => {
        const yes = await confirmModal({ title: `End things with ${npc.firstName}?`, body: 'They will become an ex.', yes: 'End it', danger: true });
        if (yes) await report(api, love.breakUp(npc.id));
      },
    };
    return (flows[id] ?? (() => report(api, rel.interact(npc.id, id))))();
  });
}

export default {
  id: 'people', title: 'People', short: 'People',
  icon: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17.5" cy="9" r="2.4"/><path d="M16.5 14.2c2.6.3 4.5 2.4 4.5 5.3"/>',
  render(el, api) {
    const c = country();
    const list = livingNpcs().sort((a, b) =>
      ORDER.indexOf(a.role) - ORDER.indexOf(b.role) || b.age - a.age);

    const top = [['tree', 'Family tree']];
    if (love.canLookForLove()) top.push(['love', 'Look for love']);
    if (kids.canAdopt()) top.push(['adopt', `Adopt a child (${fmtMoney(localMoney(kids.ADOPTION_FEE, c), c)})`]);
    if (rel.canGetPet()) top.push(['pet', `Get a pet (${fmtMoney(localMoney(rel.PET_PRICE, c), c)})`]);

    const row = (n) => `
      <button class="row" data-npc="${n.id}">
        ${portrait(n)}
        <div class="main"><strong>${esc(n.firstName)} ${n.role === 'pet' ? '' : esc(n.lastName)}</strong>
          <small>${esc(rel.roleLabel(n))} · age ${n.age}${n.occupation ? ` · ${esc(n.occupation)}` : ''}</small></div>
        <div class="side">${Math.round(n.meters.relationship)}%
          <div class="mini"><i class="fill ${band(n.meters.relationship)}" style="width:${n.meters.relationship}%"></i></div></div>
      </button>`;

    el.innerHTML = `
      ${top.length ? `<div class="btn-stack" style="margin-bottom:14px">${top.map(([id, label]) =>
        `<button class="btn" data-top="${id}">${esc(label)}</button>`).join('')}</div>` : ''}
      ${list.length ? GROUPS.map(([title, roles]) => {
        const group = list.filter((n) => roles.includes(n.role));
        return group.length ? `<div class="section-label">${esc(title)}</div>${group.map(row).join('')}` : '';
      }).join('') : '<p class="empty">There is nobody in your life right now.</p>'}`;

    el.onclick = async (e) => {
      const row = e.target.closest('[data-npc]');
      if (row) return openNpc(store.state.npcs[row.dataset.npc], api);
      const id = e.target.closest('[data-top]')?.dataset.top;
      if (id === 'tree') return openFamilyTree((npc) => openNpc(npc, api));
      if (id === 'love') return lookForLove(api);
      if (id === 'pet') return report(api, kids.getPet());
      if (id === 'adopt') {
        const yes = await confirmModal({ title: 'Adopt a child?', body: 'It takes a year of forms and visits, and a child joins your family for good.', yes: 'Start the adoption' });
        if (yes) return report(api, kids.adopt());
      }
      return undefined;
    };
  },
};

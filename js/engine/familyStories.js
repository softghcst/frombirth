// When each of the stories in data/familyStories.js is true, and what a choice in one does. Every story has a test of
// the world as it is now: these people, this history, this house. A story whose test fails cannot be told, whatever
// the settings. At most one a year (two on high drama), once per person unless it says it comes round again.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, log } from '../state.js';
import { book } from './ledger.js';
import * as love from './romance.js';
import * as bonds from './bonds.js';
import { FAMILY } from '../data/familyStories.js';

const npcOf = (id) => store.state.npcs[id];
const bump = (npc, d) => { if (npc) npc.meters.relationship = clamp(npc.meters.relationship + d); };
const told = () => ((store.state.bonds ??= { seq: 0, list: {} }).told ??= {});
const year = () => store.state.year;
const mine = (n) => player().npcIds.includes(n.id);
const living = (role) => Object.values(store.state.npcs).filter((n) => n.alive && n.role === role && mine(n));
const sub = (npc, extra = {}) => ({ key: npc.id, them: npc.id, ...extra });
const nobody = (key, extra = {}) => ({ key, ...extra });
const nm = (n) => n.firstName;
export const FAMILY_IDS = new Set(FAMILY.map((s) => s.id));

// ---------- The test for each story ----------

const partnerNow = () => love.partner();
const secrets = () => bonds.others().filter((b) => b.secret && partnerNow()).map((b) => ({ b, npc: npcOf(b.npcId) }));
const kidsOf = () => Object.values(store.state.npcs).filter((n) => n.role === 'child' && n.alive && mine(n));
const teens = () => player().age >= 14 && player().age <= 17;

const GATES = {
  secret_encounter: () => secrets().filter(({ b }) => bonds.since(b.start) >= 0.5).map(({ npc }) => sub(npc)),
  secret_public: () => secrets().filter(({ b }) => bonds.since(b.start) >= 1.5).map(({ npc }) => sub(npc)),
  secret_stayed: () => bonds.bonds().filter((b) => b.type !== 'primary' && b.type !== 'onenight' && b.status === 'ended' && bonds.since(b.end) >= 3)
    .map((b) => npcOf(b.npcId)).filter((n) => n?.alive && n.meters.relationship >= 60 && !bonds.bondWith(n.id)).map((n) => sub(n)),
  secret_clean_break: () => secrets().filter(({ b }) => bonds.since(b.start) >= 1 && partnerNow().meters.relationship >= 65).map(({ npc }) => sub(npc)),
  truth_trust: () => { const m = bonds.primary(); const n = m && npcOf(m.npcId); return m?.arc.rebuilding && n?.alive ? [sub(n)] : []; },
  truth_friend: () => {
    const out = [];
    for (const b of bonds.bonds()) for (const [id, k] of Object.entries(b.knows ?? {})) {
      const n = npcOf(id);
      if (k.level === 'knows' && n?.alive && n.role === 'friend' && mine(n) && !out.some((o) => o.key === id)) out.push(sub(n));
    }
    return out;
  },
  marriage_question: () => { const m = bonds.primary(); const n = m && npcOf(m.npcId); return m && n?.alive && n.role === 'partner' && !n.flags.engaged && bonds.since(m.start) >= 3 && bonds.heart(n).commitment >= 50 ? [sub(n)] : []; },
  marriage_dreams: () => (love.spouse()?.alive && player().age >= 25 ? [sub(love.spouse())] : []),
  marriage_city: () => (love.spouse()?.alive && player().age >= 22 && player().age <= 60 ? [sub(love.spouse())] : []),
  marriage_money: () => (love.spouse()?.alive ? [sub(love.spouse())] : []),
  marriage_fight: () => { const n = partnerNow(); const m = bonds.primary(); return n?.alive && m && n.meters.relationship < 50 && !m.arc.rebuilding && bonds.since(m.start) >= 2 ? [sub(n)] : []; },
  marriage_vacation: () => { const n = partnerNow(); return n?.alive && n.meters.relationship >= 55 && player().finance.cash >= localMoney(4000, country()) ? [sub(n)] : []; },
  marriage_boundaries: () => { const m = bonds.primary(); const n = m && npcOf(m.npcId); return m?.open && n?.alive && bonds.since(m.start) >= 1 ? [sub(n)] : []; },
  child_unknown: () => {
    const n = partnerNow(); const m = bonds.primary();
    if (!n?.alive || !m) return [];
    return kidsOf().filter((k) => !(k.parentIds ?? []).includes(n.id) && k.parentIds?.length && !bonds.knowsOfChild(k, n.id)).map((k) => sub(n, { key: `${n.id}/${k.id}` }));
  },
  half_meet: () => {
    const ks = kidsOf().filter((k) => k.age <= 17);
    const out = [];
    for (const a of ks) { const b = ks.find((x) => x.id > a.id && bonds.halfSiblings(a, x)); if (b) out.push(sub(a, { key: `${a.id}/${b.id}`, words: { other: nm(b) } })); }
    return out;
  },
  two_households: () => { const ks = kidsOf().filter((k) => k.age <= 17 && k.parentIds?.length); return new Set(ks.map((k) => k.parentIds[0])).size >= 2 ? [nobody('households')] : []; },
  questions_past: () => kidsOf().filter((k) => k.age >= 10 && k.age <= 17 && k.flags.livesWith && k.flags.livesWith !== 'player').map((k) => sub(k)),
  parent_reaches: () => living('parent').filter((n) => n.meters.relationship < 35).map((n) => sub(n)),
  family_gathering: () => (Object.values(store.state.npcs).filter((n) => n.alive && ['parent', 'sibling', 'relative', 'child'].includes(n.role) && mine(n) && n.meters.relationship >= 40).length >= 3 ? [nobody('gathering')] : []),
  blended_family: () => { const n = partnerNow(); return n?.alive && kidsOf().some((k) => k.age <= 17 && !(k.parentIds ?? []).includes(n.id)) ? [sub(n)] : []; },
  secret_story: () => bonds.bonds().filter((b) => b.type !== 'primary' && b.status === 'ended' && bonds.since(b.end) >= 3
    && Object.values(b.knows ?? {}).filter((k) => k.level === 'knows').length >= 2).map((b) => nobody(b.id)),
  house_history: () => { const p = player(); const h = p.assets.find((a) => a.kind === 'property' && a.id === p.homeId); return h && p.age - (h.boughtAtAge ?? p.age) >= 10 ? [nobody(h.id)] : []; },
  family_decision: () => { const w = player().flags.will; const heirs = (w && typeof w === 'object' ? w.heirs ?? [] : []).filter((id) => npcOf(id)?.alive); return heirs.length >= 2 ? [nobody('will')] : []; },
  unexpected_responsibility: () => Object.values(store.state.npcs).filter((n) => n.alive && mine(n) && ['parent', 'relative', 'sibling'].includes(n.role) && (n.age >= 75 || n.meters.health < 35)).map((n) => sub(n)),
  legacy_left: () => Object.values(store.state.npcs).filter((n) => !n.alive && mine(n) && n.flags.diedYear != null && year() - n.flags.diedYear <= 2 && n.meters.relationship >= 55).map((n) => nobody(n.id, { words: { gone: `${n.firstName} ${n.lastName}` } })),
  teen_crush: () => (teens() && !partnerNow() ? living('friend').filter((n) => n.age >= 13 && n.age <= 18 && n.meters.relationship >= 70).map((n) => sub(n)) : []),
  teen_rumor: () => (player().age >= 13 && player().age <= 17 ? living('friend').filter((n) => n.age <= 18 && n.meters.relationship >= 55).map((n) => sub(n)) : []),
  teen_family: () => { const n = partnerNow(); return teens() && n?.alive && n.age < 18 ? [sub(n)] : []; },
  teen_breakup: () => (teens() ? living('ex').filter((n) => n.age <= 18).map((n) => sub(n)) : []),
  teen_promise: () => { const n = partnerNow(); return player().age === 17 && n?.alive && n.age <= 19 ? [sub(n)] : []; },
};

/** Once a year (with `d` the drama setting's {chance, most}): of the stories true now, one or two are told. */
export function tickFamilyStories(d) {
  const p = player();
  const can = [];
  for (const s of FAMILY) {
    if (p.age < s.ages[0] || p.age > s.ages[1]) continue;
    for (const x of GATES[s.id]()) {
      const key = `fam_${s.id}/${x.key}`;
      const last = told()[key];
      if (last === 'closed' || (last != null && (!s.again || year() - last < s.again))) continue;
      can.push({ s, x, key });
    }
  }
  let n = 0;
  const most = d.most;
  for (const c of can.map((v) => [rng.next(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v)) {
    if (n >= most || !rng.chance(d.chance)) continue;
    told()[c.key] = year();
    store.state.pendingEvents.push({ id: `fam_${c.s.id}`, cast: { ...(c.x.them ? { them: c.x.them } : {}), ...(c.x.words ? { words: c.x.words } : {}) } });
    n++;
  }
  return n;
}

// ---------- What a choice does ----------

const FNS = {
  confess(npc) { const m = bonds.primary(); if (!m) return ''; const r = bonds.confess(m.npcId); return r.text; },
  endIt(npc) { if (!npc?.alive) return ''; bonds.end(npc.id, 'ended it'); return ''; },
  closeUp(npc) { const m = bonds.primary(); if (!m || m.npcId !== npc.id) return ''; m.open = false; m.exclusive = true; bump(npc, 4); return `${nm(npc)} says that is what they hoped you would say. It is only the two of you now.`; },
  tellChild(npc) {
    const m = bonds.primary(); if (!m) return '';
    const k = kidsOf().find((x) => !(x.parentIds ?? []).includes(npc.id) && !bonds.knowsOfChild(x, npc.id));
    const b = k && bonds.bonds().find((x) => (x.childIds ?? []).includes(k.id));
    if (b) (b.knows ??= {})[npc.id] = { level: 'knows', year: year(), how: 'you told them', fromId: player().id };
    const forgiving = bonds.heart(npc).forgiving;
    bump(npc, forgiving >= 55 ? -2 : -8);
    return forgiving >= 55 ? `${nm(npc)} is quiet for a while, and then asks the child's name.` : `${nm(npc)} needs some time, and goes for a long walk.`;
  },
};

/** A choice in one of these scenes. @returns {string} what happens beyond what the scene itself says */
export function familyChoice(story, index, cast = {}) {
  const p = player();
  const s = FAMILY.find((x) => x.id === story);
  const fx = s?.choices[index]?.[2];
  if (!fx) return '';
  const npc = cast.them ? npcOf(cast.them) : null;
  let said = '';
  if (fx.cost) {
    const price = localMoney(fx.cost, country());
    if (p.finance.cash < price) return `You cannot afford it just now (${fmtMoney(price, country())}).`;
    p.finance.cash -= price; book({ cat: 'leisure', src: 'action', desc: s.id.replace(/_/g, ' ') });
    said = `(Cost: ${fmtMoney(price, country())}.)`;
  }
  if (fx.rel && npc?.alive) bump(npc, fx.rel);
  if (fx.mood) p.stats.mood = clamp(p.stats.mood + fx.mood);
  if (fx.will) p.hidden.willpower = clamp((p.hidden.willpower ?? 50) + fx.will);
  if (fx.trust) { const m = bonds.primary(); if (m) m.trust = clamp(m.trust + fx.trust); }
  if (fx.close) told()[`fam_${story}/${cast.them ?? ''}`] = 'closed';
  if (fx.fn && FNS[fx.fn]) said = [said, FNS[fx.fn](npc)].filter(Boolean).join(' ');
  return said;
}

// Digital Life: the player's connections, creativity and world online, or,
// before there is an online world, the ways people kept in touch then.
//
// Everything on these pages is read from the Digital World Engine
// (engine/digital) and every button calls it. Where the player goes in here —
// section, filters, the open post or conversation, how far down they had
// scrolled — is remembered, so a trip to someone's profile and back loses
// nothing, and neither does closing Digital Life and opening it again.
import { getEra, erasBetween, eventsIn } from '../engine/history.js';
import { store, player, country } from '../state.js';
import { esc, fmtMoney, localMoney } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { PLATFORMS, PLATFORM_BY_ID, FORMATS, TOPICS, TOPIC_BY_ID, DEVICE_BY_ID, CREATOR_STAGES, PROJECT_KINDS, SPONSOR_BY_ID } from '../data/digital.js';
import { roleLabel } from '../engine/relationships.js';
import * as core from '../engine/digital/core.js';
import * as tech from '../engine/digital/tech.js';
import * as acc from '../engine/digital/accounts.js';
import * as content from '../engine/digital/content.js';
import * as msg from '../engine/digital/messaging.js';
import * as comm from '../engine/digital/community.js';
import * as creator from '../engine/digital/creator.js';
import * as rep from '../engine/digital/reputation.js';
import * as legacy from '../engine/digital/legacy.js';
import * as pro from '../engine/digital/professional.js';
import * as civic from '../engine/digital/civic.js';
import * as school from '../engine/digital/school.js';
import { publicFigures } from '../engine/digital/npc.js';
import { MAJOR_BY_ID } from '../data/majors.js';
import { syncCompat } from '../engine/digital/tick.js';
import { avatarSvg, dressOfPlayer, petGlyph } from './avatar.js';
import { meterHtml } from './meter.js';
import { openModal, messageModal, pickModal, confirmModal, inputModal } from './modals.js';
import { openNpc } from './tabs/people.js';

const SECTIONS = [
  ['accounts', 'My Accounts'], ['feed', 'Feed'], ['messages', 'Messages'], ['people', 'Friends & Connections'],
  ['communities', 'Communities'], ['create', 'Create Content'], ['studio', 'Creator Studio'], ['reputation', 'Online Reputation'],
  ['memories', 'Digital Memories'], ['history', 'Digital History'], ['archive', 'Family Archive'],
];
const OFFLINE = [['keep', 'Keeping in Touch'], ['messages', 'Letters & Calls'], ['memories', 'Digital Memories'], ['history', 'Digital History'], ['archive', 'Family Archive']];
const VIS = { public: 'Public', friends: 'Friends only', private: 'Private', connections: 'Connections', members: 'Members', matches: 'Matches', unlisted: 'Unlisted', followers: 'Followers' };
const STUDIO = [['overview', 'Overview'], ['library', 'Content Library'], ['analytics', 'Analytics'], ['audience', 'Audience'], ['collabs', 'Collaborations'], ['deals', 'Sponsorships'], ['live', 'Livestreams'], ['revenue', 'Revenue'], ['story', 'Creator History']];

/** Where the player is in Digital Life. Kept per saved life, for as long as the page is open. */
let view = null;
function state() {
  const slot = store.state.slotId;
  if (view?.slot !== slot) view = { slot, section: null, trail: [], platformId: '', feedMode: 'relevant', topic: '', studio: 'overview', channelId: null, scroll: {}, draft: {} };
  return view;
}

const n0 = (x) => Math.round(x ?? 0).toLocaleString('en-US');
const pl = (id) => PLATFORM_BY_ID[id];
const visChip = (v) => `<span class="dl-vis dl-vis-${esc(v)}" title="Who can see this">${v === 'public' ? '◉' : v === 'private' ? '🔒' : '◐'} ${esc(VIS[v] ?? v)}</span>`;
const platChip = (id) => `<span class="dl-plat" style="--pl:${pl(id).accent}">${esc(pl(id).name)}</span>`;

/** A portrait. People who exist in the game are links to their profile; the crowd is not. */
function face(charId, size = '', o = {}) {
  const c = core.charOf(charId);
  if (!c) return `<div class="avatar dl-crowd ${size}" aria-hidden="true">·</div>`;
  const p = player();
  const svg = c === p
    ? avatarSvg({ age: p.age, gender: p.gender, appearance: p.appearance, seed: p.id, mood: p.stats.mood, label: p.firstName, ...dressOfPlayer(p) })
    : avatarSvg({ age: c.age, gender: c.gender, appearance: c.appearance, seed: c.id, mood: c.meters?.relationship ?? 60, label: c.firstName });
  // Inside something that is itself a button, a portrait is a picture; the page it opens has the link.
  if (o.inert) return `<div class="avatar dl-face ${size} ${c.alive === false ? 'gone' : ''}" aria-hidden="true">${svg}</div>`;
  return `<button class="avatar dl-face ${size} ${c.alive === false ? 'gone' : ''}" data-person="${esc(c.id)}" aria-label="Open ${esc(c.firstName)}'s profile">${svg}</button>`;
}
/** An account's profile picture: the owner's portrait, a pet, initials or a symbol. It always opens the real person. */
function accountFace(a, size = '', o = {}) {
  const v = a.avatar ?? 'portrait';
  if (v === 'portrait') return face(a.ownerId, size, o);
  const c = core.charOf(a.ownerId);
  const pet = v.startsWith('pet:') ? core.charOf(v.slice(4)) : null;
  const inner = pet ? petGlyph(pet.species) : v.startsWith('symbol:') ? esc(v.slice(7)) : esc(`${c?.firstName?.[0] ?? ''}${c?.lastName?.[0] ?? ''}`);
  if (o.inert || !c) return `<div class="avatar dl-face dl-mono ${size}" aria-hidden="true">${inner}</div>`;
  return `<button class="avatar dl-face dl-mono ${size}" data-person="${esc(c.id)}" aria-label="Open ${esc(c.firstName)}'s profile">${inner}</button>`;
}
const who = (charId) => { const c = core.charOf(charId); return c ? `<button class="dl-name" data-person="${esc(c.id)}">${esc(c.firstName)} ${esc(c.lastName ?? '')}</button>` : '<span class="muted">Someone</span>'; };

/** Opens the person's own profile: the existing character profile for people in the player's life. */
function openPerson(id, api, rerender) {
  const c = core.charOf(id);
  if (!c) return;
  if (c === player()) { state().trail.push({ type: 'me' }); return rerender(); }
  if (player().npcIds.includes(id)) return openNpc(c, api);
  // Someone known only online, or from the archive: their online self, the same person.
  const accounts = acc.accountsOf(id).filter((a) => a.status !== 'deleted');
  const pblock = msg.contactBlock(id);
  const m = openModal(`
    <div class="row" style="border:0;padding:0;background:none">${face(id)}
      <div class="main"><strong>${esc(c.firstName)} ${esc(c.lastName ?? '')}</strong>
      <small>${c.alive ? `age ${c.age}` : `died at ${c.age}`}${typeof c.flags?.abroad === 'string' && COUNTRIES[c.flags.abroad] ? ` · lives in ${esc(COUNTRIES[c.flags.abroad].name)}` : ''}${c.flags?.drifted ? ' · an old friend you lost touch with' : c.flags?.digitalOnly ? ' · known online' : c.flags?.archived ? ' · in the family archive' : ''}</small></div></div>
    <div style="margin:12px 0">${accounts.map((a) => `<div class="kv"><span>${esc(pl(a.platformId).name)}</span><span>@${esc(a.handle)} · ${n0(acc.followerCount(a))} followers</span></div>`).join('') || '<p class="muted">No accounts you can see.</p>'}
      ${c.flags?.familiarity != null ? meterHtml('Familiarity', c.flags.familiarity, true) : ''}</div>
    ${core.eventsOf(id).filter((e) => e.charIds.includes(player().id)).slice(0, 6).map((e) => `<div class="kv"><span>${e.year}</span><span>${esc(e.summary)}</span></div>`).join('')}
    <div class="btn-stack" style="margin-top:12px">
      ${c.alive && !pblock ? '<button class="btn" data-dm>Send a message</button>' : pblock && c.alive ? `<p class="muted">${esc(pblock)}</p>` : ''}
      <button class="btn" data-close>Close</button></div>`, { dismissable: true });
  m.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) return m.close();
    if (e.target.closest('[data-dm]')) { m.close(); await startConversation(api, rerender, id); }
    return undefined;
  });
}

// ---------- Small form helper ----------

/**
 * A form in a modal. Resolves with the values, or null if canceled.
 * @param {{title:string, body?:string, submit?:string, fields:{name:string, label:string, type?:string, value?:any, options?:{value:string,label:string,disabled?:boolean}[], max?:number}[]}} o
 */
function formModal({ title, body, submit = 'Save', fields }) {
  return new Promise((resolve) => {
    const html = fields.map((f) => {
      const id = `dlf-${f.name}`;
      if (f.type === 'select') return `<div class="field"><label for="${id}">${esc(f.label)}</label><select id="${id}" name="${f.name}">${f.options.map((o) => `<option value="${esc(o.value)}" ${o.value === f.value ? 'selected' : ''} ${o.disabled ? 'disabled' : ''}>${esc(o.label)}</option>`).join('')}</select></div>`;
      if (f.type === 'textarea') return `<div class="field"><label for="${id}">${esc(f.label)}</label><textarea id="${id}" name="${f.name}" maxlength="${f.max ?? 160}" rows="3">${esc(f.value ?? '')}</textarea></div>`;
      if (f.type === 'checks') return `<fieldset class="field dl-checks"><legend>${esc(f.label)}</legend>${f.options.map((o) => `<label><input type="checkbox" name="${f.name}" value="${esc(o.value)}" ${(f.value ?? []).includes(o.value) ? 'checked' : ''}> ${esc(o.label)}</label>`).join('')}</fieldset>`;
      if (f.type === 'check') return `<label class="dl-check"><input type="checkbox" name="${f.name}" ${f.value ? 'checked' : ''}> ${esc(f.label)}</label>`;
      return `<div class="field"><label for="${id}">${esc(f.label)}</label><input id="${id}" name="${f.name}" maxlength="${f.max ?? 40}" autocomplete="off" value="${esc(f.value ?? '')}"></div>`;
    }).join('');
    const m = openModal(`<h2>${esc(title)}</h2>${body ? `<p class="body">${esc(body)}</p>` : ''}<form novalidate>${html}
      <div class="btn-row"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn primary">${esc(submit)}</button></div></form>`,
    { dismissable: true, onDismiss: () => resolve(null) });
    m.el.querySelector('[data-cancel]').addEventListener('click', () => { m.close(); resolve(null); });
    m.el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target;
      const out = {};
      for (const f of fields) {
        if (f.type === 'checks') out[f.name] = [...form.querySelectorAll(`input[name="${f.name}"]:checked`)].map((x) => x.value);
        else if (f.type === 'check') out[f.name] = form.querySelector(`input[name="${f.name}"]`).checked;
        else out[f.name] = form.elements[f.name].value;
      }
      m.close();
      resolve(out);
    });
  });
}

async function say(api, r, rerender) {
  syncCompat();
  api.changed();
  rerender();
  await messageModal({ body: r.text, tone: r.tone });
}

// ---------- Cards ----------

function accountCard(a) {
  const p = pl(a.platformId);
  const owner = core.charOf(a.ownerId);
  return `<button class="dl-card dl-acc" style="--pl:${p.accent}" data-open-account="${a.id}">
    <div class="row" style="border:0;padding:0;background:none">${accountFace(a, 'sm', { inert: true })}
      <div class="main"><strong>@${esc(a.handle)}</strong><small>${esc(p.name)} · ${esc(owner?.firstName ?? '')}${a.creator ? ` · ${esc(CREATOR_STAGES.find((s) => s.id === a.creator.stage).name)}` : ''}</small></div>
      <div class="side">${a.status === 'active' ? visChip(a.visibility) : `<span class="dl-status">${esc(a.status)}</span>`}</div></div>
    <div class="dl-stats"><div><strong>${n0(acc.followerCount(a))}</strong><small>followers</small></div><div><strong>${n0(a.following.length)}</strong><small>following</small></div><div><strong>${n0(a.postIds.filter((id) => !core.world().posts[id]?.removed).length)}</strong><small>posts</small></div></div>
  </button>`;
}

function metrics(x) {
  if (!x.metrics) return '';
  const m = x.metrics;
  return `<div class="dl-metrics" aria-label="How it did"><span title="Views">👁 ${n0(m.views)}</span><span title="Likes">♥ ${n0(m.likes)}</span><span title="Comments">💬 ${n0(m.comments)}</span>${m.shares ? `<span title="Shares">↻ ${n0(m.shares)}</span>` : ''}${m.followerDelta ? `<span title="Follower change" class="${m.followerDelta > 0 ? 'up' : 'down'}">${m.followerDelta > 0 ? '+' : ''}${n0(m.followerDelta)} followers</span>` : ''}</div>`;
}

function postCard(x, o = {}) {
  if (x.news) {
    return `<article class="dl-card dl-post dl-news"><div class="dl-post-head"><div class="avatar dl-crowd sm" aria-hidden="true">📰</div>
      <div><strong>${esc(x.outlet)}</strong><small>${x.year} · news${x.you ? ' · about you' : ''}</small></div></div><p>${esc(x.text)}</p></article>`;
  }
  if (x.background) {
    return `<article class="dl-card dl-post dl-bg"><div class="dl-post-head"><div class="avatar dl-crowd sm" aria-hidden="true">#</div>
      <div><strong>Around ${esc(pl(x.platformId).name)}</strong><small>${x.year} · not about anyone you know</small></div></div><p>${esc(x.text)}</p>
      <div class="dl-metrics"><span>♥ ${n0(x.metrics.likes)}</span></div></article>`;
  }
  const a = acc.account(x.accountId);
  const tag = x.source?.type === 'npcHistory' ? '<span class="dl-tag" title="This really happened to them">Life update</span>'
    : x.source?.type === 'milestone' ? '<span class="dl-tag">Milestone</span>' : x.source?.type === 'project' ? '<span class="dl-tag">Project</span>' : '';
  const outcome = { viral: 'Went viral', reach: 'Reached new people', disagreement: 'Sparked an argument', quiet: 'Quiet' }[x.outcome];
  return `<article class="dl-card dl-post" style="--pl:${pl(x.platformId).accent}">
    <div class="dl-post-head">${a ? accountFace(a, 'sm') : face(x.authorId, 'sm')}<div class="dl-post-who">${who(x.authorId)}<small>@${esc(a?.handle ?? '')} · ${esc(pl(x.platformId).name)} · ${x.year}${x.format !== 'text' ? ` · ${esc(FORMATS[x.format].name.toLowerCase())}` : ''}</small></div>${visChip(x.audience)}</div>
    <p>${esc(x.text)}</p>
    <div class="chips">${tag}${outcome ? `<span class="dl-tag">${esc(outcome)}</span>` : ''}${x.contractId ? `<span class="dl-tag">${x.disclosed ? 'Paid partnership' : 'Sponsored (not labeled)'}</span>` : ''}${x.location ? `<span class="dl-tag">📍 ${esc(x.location)}</span>` : ''}</div>
    ${metrics(x)}
    ${o.full ? '' : `<button class="btn small" data-open-post="${x.id}">${x.comments.filter((c) => !c.hidden || core.isPlayer(x.authorId)).length} comments · open</button>`}
  </article>`;
}

function threadRow(t) {
  const p = player();
  const others = t.participants.filter((id) => id !== p.id);
  const last = t.messages[t.messages.length - 1];
  const title = t.kind === 'group' ? t.name : others.map((id) => core.charOf(id)?.firstName ?? 'Someone').join(', ');
  const n = core.charOf(others[0]);
  const relation = t.kind === 'group' ? `${t.participants.length} people · ${pl(t.platformId).name}` : n && p.npcIds.includes(n.id) ? roleLabel(n) : n?.flags?.digitalOnly ? 'Met online' : '';
  return `<button class="row dl-thread ${t.unread ? 'unread' : ''}" data-open-thread="${t.id}">
    ${t.kind === 'group' ? `<div class="avatar dl-crowd" aria-hidden="true">${esc(title.charAt(0))}</div>` : face(others[0], '', { inert: true })}
    <div class="main"><strong>${esc(title)}${t.muted ? ' 🔕' : ''}</strong><small>${esc(relation)}${last ? ` · ${esc((core.isPlayer(last.from) ? 'You: ' : '') + last.text)}` : ''}</small></div>
    <div class="side">${t.lastYear}${t.unread ? `<span class="dl-badge" aria-label="${t.unread} unread">${t.unread}</span>` : ''}</div></button>`;
}

// ---------- Pages ----------

function pageAccounts() {
  const p = player();
  const mine = acc.accountsOf(p.id).filter((a) => a.status !== 'deleted');
  const web = tech.accessFor('web');
  const phone = tech.accessFor('photo');
  const own = tech.devicesOf(p.id);
  const sale = tech.devicesForSale().filter((d) => !own.some((o) => o.type === d.id));
  return `
    <div class="card"><h3>Getting online</h3>
      <div class="kv"><span>Internet</span><span>${web ? esc(web.via === 'own' ? `your ${web.name.toLowerCase()}` : web.name) : 'No way online'}</span></div>
      <div class="kv"><span>Photos and video</span><span>${phone ? esc(phone.via === 'own' ? `your ${phone.name.toLowerCase()}` : phone.name) : 'Nothing to film with'}</span></div>
      <div class="kv"><span>Spare time left this year</span><span>${core.hoursLeft()} hours</span></div>
      ${own.map((d) => `<div class="kv"><span>${esc(DEVICE_BY_ID[d.type].name)}</span><span>bought ${d.boughtYear} · condition ${tech.condition(d)}%${tech.condition(d) < 20 ? ' · wearing out' : ''}</span></div>`).join('')}
      <div class="btn-stack" style="margin-top:10px">
        ${p.flags.livesWithParents && p.age >= 9 && !own.some((d) => ['smartphone', 'mobile_phone'].includes(d.type)) && (tech.techAvailable('mobile') || tech.techAvailable('smartphone')) ? '<button class="btn" data-do="askPhone">Ask your parents for a phone</button>' : ''}
        ${sale.length ? '<button class="btn" data-do="buyDevice">Buy a device</button>' : ''}
      </div></div>
    ${publicLifeCard()}
    ${schoolCard()}
    <div class="section-label">Your accounts</div>
    ${mine.length ? mine.map(accountCard).join('') : '<p class="empty">You are not on any platform. That is a perfectly good way to live.</p>'}
    <button class="btn primary" data-do="newAccount" style="margin-top:10px">Open an account</button>`;
}

/** For office-holders, candidates and royals: speaking through an official account. */
function publicLifeCard() {
  const opts = civic.statementOptions();
  if (!opts.length) return '';
  const off = civic.officialAccounts();
  return `<div class="card"><h3>Public life</h3>
    <p class="muted" style="margin-bottom:8px">Official accounts speak for your ${player().royal ? 'royal office' : 'office'}; your personal accounts stay personal. Posting can make you more visible. It never decides an election.</p>
    ${off.length ? `<div class="dl-btns">${opts.map((o) => `<button class="btn small" data-stmt="${o.id}" ${o.done ? 'disabled' : ''}>${esc(o.label)}${o.done ? ' ✓' : ''}</button>`).join('')}</div>`
    : '<p class="muted">Open an account and choose "official" to speak publicly.</p>'}</div>`;
}

/** School and study online, for students. */
function schoolCard() {
  const sys = school.schoolSystems();
  if (!sys) return '';
  return `<div class="card"><h3>School online</h3><p class="muted" style="margin-bottom:8px">${esc(sys.text)}</p>
    ${sys.kind === 'portal' ? `<div class="kv"><span>Marks</span><span>${sys.gpa.toFixed(2)}</span></div><div class="kv"><span>Absences</span><span>${sys.absences}</span></div>` : ''}
    <div class="kv"><span>Digital skills</span><span>${school.literacyOf()}/100</span></div>
    ${sys.kind !== 'paper' ? '<div class="btn-stack" style="margin-top:8px"><button class="btn" data-do="studyGroup">Study with classmates online (12 h)</button></div>' : ''}</div>`;
}

function pageAccount(id) {
  const a = acc.account(id);
  if (!a) return '<p class="empty">That account is gone.</p>';
  const mine = core.isPlayer(a.ownerId);
  const posts = a.postIds.map((x) => core.world().posts[x]).filter((x) => x && (mine ? !x.removed : acc.canSee(player().id, x))).reverse();
  const p = pl(a.platformId);
  return `
    <div class="dl-card dl-profile" style="--pl:${p.accent}">
      <div class="row" style="border:0;padding:0;background:none">${accountFace(a, 'lg')}
        <div class="main"><strong>${esc(a.displayName)}</strong><small>@${esc(a.handle)} · ${esc(p.name)} · since ${a.createdYear}</small>
        ${a.handles.length > 1 ? `<small>Formerly ${a.handles.slice(0, -1).map((h) => `@${esc(h.handle)}`).join(', ')}</small>` : ''}</div></div>
      ${a.bio ? `<p class="dl-bio">${esc(a.bio)}</p>` : ''}
      ${(a.links ?? []).map(acc.account).filter((l) => l && l.status !== 'deleted' && (mine || l.visibility === 'public')).map((l) => `<button class="btn small" data-open-account="${l.id}">Also on ${esc(pl(l.platformId).name)}: @${esc(l.handle)}</button>`).join(' ')}
      <div class="dl-stats"><div><strong>${n0(acc.followerCount(a))}</strong><small>followers</small></div><div><strong>${n0(a.following.length)}</strong><small>following</small></div><div><strong>${n0(posts.length)}</strong><small>posts</small></div></div>
      <div class="chips">${visChip(a.visibility)}<span class="dl-tag">${esc(a.status)}</span>${a.creator ? `<span class="dl-tag">${esc(CREATOR_STAGES.find((s) => s.id === a.creator.stage).name)}</span>` : ''}${a.kind === 'official' ? '<span class="dl-tag">Official account</span>' : ''}${a.interests.map((t) => `<span class="dl-tag">${esc(TOPIC_BY_ID[t]?.name ?? t)}</span>`).join('')}</div>
      ${a.legacyImport ? `<p class="muted" style="margin-top:8px">Brought over from your old account: ${n0(a.legacyImport.followers)} followers. Its old posts were not kept.</p>` : ''}
    </div>
    ${mine ? `<div class="btn-stack">
      ${a.status === 'active' ? `<button class="btn" data-acc="edit" data-id="${a.id}">Edit profile</button>
        <button class="btn" data-acc="privacy" data-id="${a.id}">Privacy and messages</button>
        <button class="btn" data-acc="security" data-id="${a.id}">${a.security?.twoStep ? 'Account protected ✓' : 'Protect this account'}</button>
        <button class="btn" data-acc="deactivate" data-id="${a.id}">Deactivate</button>` : ''}
      ${a.status === 'deactivated' ? `<button class="btn" data-acc="reactivate" data-id="${a.id}">Reactivate</button>` : ''}
      ${a.status === 'locked' ? `<button class="btn primary" data-acc="recover" data-id="${a.id}">Recover your account</button>` : ''}
      ${['active', 'deactivated'].includes(a.status) ? `<button class="btn danger" data-acc="delete" data-id="${a.id}">Delete account</button>` : ''}
    </div>
    ${a.requests.length ? `<div class="section-label">Follow requests</div>${a.requests.map((r) => { const o = acc.account(r); return o ? `<div class="row">${face(o.ownerId)}<div class="main"><strong>@${esc(o.handle)}</strong><small>${esc(core.nameOf(o.ownerId))}</small></div><div class="side dl-btns"><button class="btn small" data-req="yes" data-id="${a.id}" data-from="${o.id}">Accept</button><button class="btn small" data-req="no" data-id="${a.id}" data-from="${o.id}">Decline</button></div></div>` : ''; }).join('')}` : ''}` : ''}
    ${p.type === 'professional' ? proCard(a, mine) : ''}
    ${school.portfolio(a.id).length ? `<div class="card"><h3>Portfolio</h3>${school.portfolio(a.id).map((x) => `<div class="kv"><span>${esc(x.title)}</span><span>${x.postId && core.world().posts[x.postId] && acc.canSee(player().id, core.world().posts[x.postId]) ? `<button class="btn small" data-open-post="${x.postId}">See it</button>` : esc(x.status)}</span></div>`).join('')}</div>` : ''}
    <div class="section-label">Posts</div>
    ${posts.length ? posts.slice(0, 40).map((x) => postCard(x)).join('') : '<p class="empty">No posts you can see.</p>'}`;
}

/** A professional profile: the person's real record, and the contacts who could vouch for them. */
function proCard(a, mine) {
  const cv = pro.resume(a.ownerId);
  if (!cv) return '';
  const deg = (d) => `${{ high: 'High school', university: 'University', graduate: 'Graduate school', medical: 'Medical school', law: 'Law school', community: 'College', apprenticeship: 'Apprenticeship', certificate: 'Certificate', cosmetology: 'Cosmetology' }[d.what] ?? d.what}${d.field && MAJOR_BY_ID[d.field] ? `, ${MAJOR_BY_ID[d.field].name}` : ''}${d.school ? ` · ${d.school}` : ''}`;
  const refs = mine ? pro.referralOptions() : [];
  return `<div class="card"><h3>Experience</h3>${cv.jobs.slice().reverse().map((j) => `<div class="kv"><span>${esc(j.title)}</span><span>${j.current ? `since age ${j.from}` : `ages ${j.from}–${j.to}`}</span></div>`).join('') || '<p class="muted">No jobs yet.</p>'}
    <h3 style="margin-top:12px">Education</h3>${cv.degrees.map((d) => `<div class="kv"><span>${esc(deg(d))}</span><span>age ${d.age}</span></div>`).join('') || '<p class="muted">Nothing listed.</p>'}
    <p class="muted" style="margin-top:8px">This is your real record. Nothing on it can be embellished.</p></div>
    ${refs.length ? `<div class="section-label">Contacts who could refer you</div>${refs.map((r) => `<div class="row">${face(r.npc.id)}<div class="main"><strong>${esc(r.npc.firstName)} ${esc(r.npc.lastName)}</strong><small>${esc(r.npc.life.job.title)} · ${esc(r.career.name)}${r.linked ? ' · connected' : ''}</small></div><div class="side"><button class="btn small" data-referral="${r.npc.id}" ${r.why ? 'disabled' : ''}>Ask for a referral</button></div></div>`).join('')}` : ''}`;
}

function pageMe() {
  const p = player();
  return `<div class="dl-card"><div class="row" style="border:0;padding:0;background:none">${face(p.id, 'lg')}<div class="main"><strong>${esc(p.firstName)} ${esc(p.lastName)}</strong><small>That is you. Your accounts are under My Accounts.</small></div></div></div>
    ${acc.accountsOf(p.id).filter((a) => a.status !== 'deleted').map(accountCard).join('')}`;
}

function pageFeed() {
  const v = state();
  const mine = acc.activeAccountsOf(player().id);
  if (!mine.length) return '<p class="empty">Your feed fills up once you have an account and follow people.</p><button class="btn primary" data-do="newAccount">Open an account</button>';
  const plats = [...new Set(mine.map((a) => a.platformId))];
  const items = content.feed({ platformId: v.platformId || undefined, mode: v.feedMode, topic: v.topic || undefined });
  return `<div class="dl-filters">
      <label>Platform <select data-filter="platformId"><option value="">All</option>${plats.map((id) => `<option value="${id}" ${v.platformId === id ? 'selected' : ''}>${esc(pl(id).name)}</option>`).join('')}</select></label>
      <label>Order <select data-filter="feedMode"><option value="relevant" ${v.feedMode === 'relevant' ? 'selected' : ''}>People first</option><option value="chronological" ${v.feedMode === 'chronological' ? 'selected' : ''}>Latest first</option></select></label>
      <label>Topic <select data-filter="topic"><option value="">Everything</option>${TOPICS.map((t) => `<option value="${t.id}" ${v.topic === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
    </div>
    ${items.length ? items.map((x) => postCard(x)).join('') : '<p class="empty">Nothing here yet. Follow people you know under Friends & Connections.</p>'}`;
}

function pagePost(id) {
  const x = core.world().posts[id];
  if (!x || !acc.canSee(player().id, x)) return '<p class="empty">You cannot see that post.</p>';
  const mine = core.isPlayer(x.authorId);
  const comments = x.comments.filter((c) => !c.hidden || mine);
  return `${postCard(x, { full: true })}
    ${x.source?.type === 'npcHistory' ? `<p class="muted">From ${esc(core.firstOf(x.authorId))}'s own life: this really happened in ${x.year}.</p>` : ''}
    ${mine ? `<div class="btn-row" style="margin-bottom:10px"><button class="btn small" data-post="audience" data-id="${x.id}">Who can see it</button><button class="btn small danger" data-post="remove" data-id="${x.id}">Remove post</button></div>` : ''}
    <div class="section-label">Comments</div>
    ${comments.length ? comments.map((c) => `<div class="dl-comment ${c.tone} ${c.hidden ? 'hidden' : ''}">
        ${c.authorId ? face(c.authorId, 'sm') : '<div class="avatar dl-crowd sm" aria-hidden="true">·</div>'}
        <div><strong>${c.authorId ? who(c.authorId) : 'A stranger'}</strong>${c.hidden ? ' <small>(hidden)</small>' : ''}<p>${esc(c.text)}</p>
        <div class="dl-btns">
          <button class="btn small" data-comment="like" data-post-id="${x.id}" data-id="${c.id}">${c.liked ? '♥ Liked' : '♡ Like'}</button>
          ${mine && !core.isPlayer(c.authorId) ? `<button class="btn small" data-comment="reply" data-post-id="${x.id}" data-id="${c.id}">Reply</button>
          <button class="btn small" data-comment="hide" data-post-id="${x.id}" data-id="${c.id}">${c.hidden ? 'Show' : 'Hide'}</button>
          <button class="btn small" data-comment="delete" data-post-id="${x.id}" data-id="${c.id}">Delete</button>` : ''}
          ${!c.authorId ? `<button class="btn small" data-comment="report" data-post-id="${x.id}" data-id="${c.id}">Report</button>` : ''}
          ${c.accountId && !core.isPlayer(c.authorId) ? `<button class="btn small" data-comment="mute" data-post-id="${x.id}" data-id="${c.id}">Mute</button><button class="btn small danger" data-comment="block" data-post-id="${x.id}" data-id="${c.id}">Block</button>` : ''}
        </div></div></div>`).join('') : '<p class="empty">No comments.</p>'}`;
}

function pageMessages() {
  const list = msg.inbox();
  return `<div class="btn-stack" style="margin-bottom:12px">
      <button class="btn primary" data-do="newMessage">Get in touch with someone</button>
      ${msg.groupOptions().some((o) => o.people.length) ? '<button class="btn" data-do="newGroup">Start a group chat</button>' : ''}
    </div>
    ${list.length ? list.map(threadRow).join('') : '<p class="empty">No conversations yet.</p>'}`;
}

function pageThread(id) {
  const t = core.world().threads[id];
  const p = player();
  if (!t || !(t.participants.includes(p.id) || t.left?.includes(p.id))) return '<p class="empty">That conversation is private.</p>';
  msg.markRead(id);
  const others = t.participants.filter((x) => x !== p.id);
  const other = core.charOf(others[0]);
  const memories = t.kind === 'dm' && other ? core.eventsOf(other.id).filter((e) => e.charIds.includes(p.id)).slice(0, 3) : [];
  return `<div class="dl-card"><div class="dl-members">${t.participants.map((x) => face(x, 'sm')).join('')}</div>
      <strong>${esc(t.kind === 'group' ? t.name : `${other?.firstName ?? 'Someone'} ${other?.lastName ?? ''}`)}</strong>
      <small class="muted"> · ${t.kind === 'group' ? `${esc(pl(t.platformId).name)} group${t.admins?.includes(p.id) ? ' · you are the admin' : ''}` : other && p.npcIds.includes(other.id) ? esc(roleLabel(other)) : ''}</small>
      ${(core.world().plans ?? []).filter((x) => t.kind === 'dm' && x.npcId === other?.id).slice(-2).map((x) => `<div class="dl-memory-strip"><small>Plan made ${x.made}: ${esc({ pending: 'still to happen', kept: 'kept', fell_through: 'fell through' }[x.status])}</small></div>`).join('')}
      ${memories.length ? `<div class="dl-memory-strip">${memories.map((e) => `<small>${e.year}: ${esc(e.summary)}</small>`).join('')}</div>` : ''}</div>
    <div class="dl-chat" role="log" aria-label="Messages">${t.messages.map((m) => `<div class="dl-msg ${core.isPlayer(m.from) ? 'me' : ''}">${core.isPlayer(m.from) ? '' : face(m.from, 'xs')}<div><small>${core.isPlayer(m.from) ? 'You' : esc(core.firstOf(m.from))} · ${m.year} · ${esc(channelName(m.channel))}</small><p>${esc(m.text)}</p></div></div>`).join('') || '<p class="empty">No messages yet.</p>'}</div>
    <div class="btn-stack">
      ${t.status === 'active' || t.kind === 'dm' ? `<button class="btn primary" data-thread="send" data-id="${t.id}">Write</button>` : ''}
      <button class="btn" data-thread="mute" data-id="${t.id}">${t.muted ? 'Unmute' : 'Mute'}</button>
      ${t.kind === 'group' && t.status === 'active' && t.admins?.includes(p.id) ? `<button class="btn" data-thread="invite" data-id="${t.id}">Add someone</button>` : ''}
      ${t.kind === 'group' && t.status === 'active' ? `<button class="btn danger" data-thread="leave" data-id="${t.id}">Leave group</button>` : ''}
      ${t.kind === 'dm' && other && acc.activeAccountsOf(p.id).some((a) => acc.accountOn(other.id, a.platformId)) ? `<button class="btn danger" data-thread="block" data-id="${t.id}">Block ${esc(other.firstName)}</button>` : ''}
    </div>`;
}
const channelName = (c) => (c?.startsWith('dm:') ? pl(c.slice(3))?.name ?? 'message' : c?.startsWith('group:') ? 'group' : { letter: 'letter', call: 'phone call', video_call: 'video call', text: 'text', email: 'email', telegram: 'telegram' }[c] ?? c);

function pagePeople() {
  const p = player();
  const mine = acc.activeAccountsOf(p.id);
  const known = mine.flatMap((a) => acc.knownOnPlatform(a.platformId).map((x) => ({ ...x, mine: a })));
  const online = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.flags?.metOnline);
  const conns = mine.flatMap((a) => [...new Set([...a.following, ...a.followers])].map((id) => ({ me: a, other: acc.account(id) }))).filter((x) => x.other);
  const blocked = mine.flatMap((a) => a.blocked.map((id) => ({ me: a, other: acc.account(id) }))).filter((x) => x.other);
  const dating = PLATFORM_BY_ID.kindling;
  const datingOpen = tech.platformOpen(dating.id) && p.age >= 18;
  return `
    ${known.length ? `<div class="section-label">People you know who are online</div>${known.map(({ npc, acc: a, mine: m }) => `<div class="row">${face(npc.id)}<div class="main"><strong>${esc(npc.firstName)} ${esc(npc.lastName)}</strong><small>${esc(roleLabel(npc))} · @${esc(a.handle)} on ${esc(pl(a.platformId).name)}${a.visibility === 'private' ? ' · private' : ''}</small></div><div class="side"><button class="btn small" data-follow="${a.id}" data-from="${m.id}">${a.visibility === 'private' ? 'Request' : 'Follow'}</button></div></div>`).join('')}` : ''}
    ${online.length ? `<div class="section-label">Friends you met online</div>${online.map((n) => `<div class="row">${face(n.id)}<div class="main"><strong>${esc(n.firstName)} ${esc(n.lastName)}</strong><small>${typeof n.flags.abroad === 'string' && COUNTRIES[n.flags.abroad] ? `in ${esc(COUNTRIES[n.flags.abroad].name)}` : 'nearby'} · ${Math.round(n.meters.relationship)}% close</small></div><div class="side"><button class="btn small" data-meet="${n.id}">Meet in person</button></div></div>`).join('')}` : ''}
    <div class="section-label">Your connections</div>
    ${conns.length ? conns.slice(0, 60).map(({ me, other }) => `<div class="row">${face(other.ownerId)}<div class="main"><strong>@${esc(other.handle)}</strong><small>${esc(core.nameOf(other.ownerId))} · ${esc(pl(other.platformId).name)} · ${esc(acc.connectionLabel[acc.connection(me, other)])}</small></div><div class="side dl-btns">${me.following.includes(other.id) ? `<button class="btn small" data-unfollow="${other.id}" data-from="${me.id}">Unfollow</button>` : `<button class="btn small" data-follow="${other.id}" data-from="${me.id}">Follow back</button>`}<button class="btn small" data-mute="${other.id}" data-from="${me.id}">${me.muted.includes(other.id) ? 'Unmute' : 'Mute'}</button></div></div>`).join('') : '<p class="empty">No connections yet.</p>'}
    ${blocked.length ? `<div class="section-label">Blocked</div>${blocked.map(({ me, other }) => `<div class="row"><div class="main"><strong>@${esc(other.handle)}</strong><small>${esc(pl(other.platformId).name)}</small></div><div class="side"><button class="btn small" data-unblock="${other.id}" data-from="${me.id}">Unblock</button></div></div>`).join('')}` : ''}
    ${helpCard()}
    ${discoverCard()}
    ${datingOpen ? datingCard() : ''}`;
}

/** Relatives and friends who are not online yet, whom the player could help get set up. */
function helpCard() {
  const p = player();
  const mine = acc.activeAccountsOf(p.id).filter((a) => ['messaging', 'personal'].includes(pl(a.platformId).type));
  if (!mine.length) return '';
  const target = mine.find((a) => pl(a.platformId).type === 'messaging') ?? mine[0];
  const people = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.role !== 'pet' && n.age >= 13 && !acc.accountOn(n.id, target.platformId) && n.meters.relationship >= 40).slice(0, 6);
  return people.length ? `<div class="section-label">Not on ${esc(pl(target.platformId).name)} yet</div>${people.map((n) => `<div class="row">${face(n.id)}<div class="main"><strong>${esc(n.firstName)} ${esc(n.lastName)}</strong><small>${esc(roleLabel(n))}, ${n.age}</small></div><div class="side"><button class="btn small" data-help="${n.id}" data-pl="${target.platformId}">Help them get online</button></div></div>`).join('')}` : '';
}

/** Well-known creators to follow: following them is following strangers, not making friends. */
function discoverCard() {
  const mine = acc.activeAccountsOf(player().id).filter((a) => pl(a.platformId).audience === 'followers');
  const rows = mine.flatMap((m) => publicFigures(m.platformId).filter((f) => !m.following.includes(f.id)).map((f) => ({ m, f })));
  return rows.length ? `<div class="section-label">Well-known accounts</div>${rows.slice(0, 6).map(({ m, f }) => `<div class="row">${accountFace(f)}<div class="main"><strong>@${esc(f.handle)}</strong><small>${esc(TOPIC_BY_ID[f.creator?.pathway]?.name ?? '')} · ${esc(pl(f.platformId).name)} · ${n0(acc.followerCount(f))} followers</small></div><div class="side"><button class="btn small" data-follow="${f.id}" data-from="${m.id}">Follow</button></div></div>`).join('')}` : '';
}

function datingCard() {
  const p = player();
  const has = acc.accountOn(p.id, comm.DATING);
  const blocks = comm.datingBlocks();
  const matches = comm.openMatches();
  return `<div class="card" style="margin-top:14px"><h3>Online dating on ${esc(PLATFORM_BY_ID.kindling.name)}</h3>
    <p class="muted" style="margin-bottom:10px">Adults only. Matching is a start, not a relationship: you talk, and only then decide whether to meet.</p>
    ${!has ? '<button class="btn" data-do="datingProfile">Make a dating profile</button>' : blocks.length ? `<p class="muted">${esc(blocks[0])}</p>` : `<div class="dl-btns"><button class="btn small primary" data-do="findMatches">See new matches</button><button class="btn small" data-do="datingPrefs">What you are looking for</button></div>`}
    ${matches.map((m) => { const n = core.charOf(m.npcId); return `<div class="row">${face(n.id)}<div class="main"><strong>${esc(n.firstName)}, ${n.age}</strong><small>${m.stage === 'talking' ? `talking · ${m.chats} conversations` : 'new match'} · likes ${esc(TOPIC_BY_ID[n.flags.interest]?.name.toLowerCase() ?? 'many things')} · ${Math.round(m.compat * 100)}% on paper</small></div><div class="side dl-btns"><button class="btn small" data-match="chat" data-id="${m.id}">Message</button>${m.stage === 'talking' && m.chats >= 2 ? `<button class="btn small" data-match="meet" data-id="${m.id}">Meet</button>` : ''}<button class="btn small" data-match="unmatch" data-id="${m.id}">Unmatch</button></div></div>`; }).join('')}
  </div>`;
}

function pageCommunities() {
  const all = comm.communities();
  const mine = new Set(comm.myCommunities().map((x) => x.c.id));
  const sorted = [...all].sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)));
  if (!sorted.length) return '<p class="empty">There are no online communities yet.</p>';
  return sorted.map((c) => {
    const m = comm.membership(c.id);
    const people = c.keyMembers.map(core.charOf).filter(Boolean);
    return `<div class="dl-card" style="--pl:${pl(c.platformId).accent}">
      <div class="dl-post-head"><div class="avatar dl-crowd sm" aria-hidden="true">${esc(c.name.charAt(0))}</div><div><strong>${esc(c.name)}</strong><small>${esc(TOPIC_BY_ID[c.topic]?.name ?? c.topic)} · ${esc(pl(c.platformId).name)} · ${n0(c.memberCount)} members${c.closedYear ? ` · archived since ${c.closedYear}` : ''}</small></div></div>
      <p class="muted">Rules: ${esc(c.rules)}</p>
      ${m ? `<div class="kv"><span>You</span><span>${esc(m.role)} since ${m.sinceYear} · standing ${Math.round(m.standing)}</span></div>
        ${people.length ? `<div class="dl-members">${people.map((n) => face(n.id, 'sm')).join('')}</div>` : ''}
        <div class="dl-btns" style="margin-top:8px">${comm.PARTICIPATION.map((x) => `<button class="btn small" data-comm="${x.id}" data-id="${c.id}">${esc(x.label)}</button>`).join('')}
          <button class="btn small" data-comm="event" data-id="${c.id}">Go to a gathering</button>
          ${m.role !== 'moderator' ? `<button class="btn small" data-comm="moderate" data-id="${c.id}">Offer to moderate</button>` : ''}
          <button class="btn small danger" data-comm="leave" data-id="${c.id}">Leave</button></div>`
    : `<button class="btn small" data-comm="join" data-id="${c.id}" ${tech.platformOpen(c.platformId) ? '' : 'disabled'}>Join</button>`}
    </div>`;
  }).join('');
}

function pageCreate() {
  const mine = acc.activeAccountsOf(player().id).filter((a) => pl(a.platformId).formats.some((f) => f !== 'livestream') && pl(a.platformId).audience !== 'matches');
  if (!mine.length) return '<p class="empty">You need an account to post anything.</p><button class="btn primary" data-do="newAccount">Open an account</button>';
  const trends = creator.currentTrends();
  return `<div class="card"><h3>Make a post</h3>
    <p class="muted" style="margin-bottom:10px">Choose where it goes, what it is, and who can see it. You will see it before it goes out.</p>
    <button class="btn primary" data-do="compose">Start a post</button></div>
    ${trends.length ? `<div class="card"><h3>Trending now</h3>${trends.map((t) => `<div class="kv"><span>${esc(t.name)} · ${esc(pl(t.platformId).name)}</span><span>${esc(t.text)}</span></div>`).join('')}<p class="muted" style="margin-top:8px">Joining a trend is optional. Plenty of people never do.</p></div>` : ''}
    <div class="card"><h3>Projects</h3><p class="muted" style="margin-bottom:10px">Bigger things — a recorded performance, a documentary, a photo collection — are made over several sessions in Creator Studio, and published when you choose.</p>
    <button class="btn" data-section="studio">Open Creator Studio</button></div>`;
}

// ---------- Creator Studio ----------

function bars(points, label, fmt = n0) {
  if (!points.length) return '<p class="empty">No data yet.</p>';
  const max = Math.max(1, ...points.map((x) => x.v));
  const w = 300; const h = 110; const bw = Math.max(4, Math.floor((w - 10) / points.length) - 3);
  return `<figure class="dl-chart"><svg viewBox="0 0 ${w} ${h + 18}" role="img" aria-label="${esc(label)}">
    ${points.map((pt, i) => { const bh = Math.max(1, Math.round(pt.v / max * h)); const x = 5 + i * (bw + 3); return `<rect x="${x}" y="${h - bh}" width="${bw}" height="${bh}" rx="2"><title>${esc(pt.k)}: ${fmt(pt.v)}</title></rect>${points.length <= 12 ? `<text x="${x + bw / 2}" y="${h + 13}" text-anchor="middle">${esc(String(pt.k).slice(-2))}</text>` : ''}`; }).join('')}
  </svg><figcaption>${esc(label)} · highest ${fmt(max)}</figcaption></figure>`;
}

function pageStudio() {
  const v = state();
  const p = player();
  const chans = creator.channels(p.id).filter((a) => a.status !== 'deleted');
  if (!chans.length) {
    const eligible = acc.activeAccountsOf(p.id).filter((a) => pl(a.platformId).audience === 'followers');
    return `<div class="card"><h3>Creator Studio</h3><p class="muted" style="margin-bottom:10px">Turning an account into a creator channel is a choice. Most people never make one, and that is fine.</p>
      ${eligible.length ? '<button class="btn primary" data-do="startChannel">Start a creator channel</button>' : '<p class="muted">You need an account on a platform with followers first.</p>'}</div>
      ${creator.projectsOf().length ? libraryHtml() : ''}`;
  }
  const a = acc.account(v.channelId) ?? chans[0];
  v.channelId = a.id;
  const tab = v.studio;
  const head = `<div class="dl-filters">${chans.length > 1 ? `<label>Channel <select data-filter="channelId">${chans.map((c) => `<option value="${c.id}" ${c.id === a.id ? 'selected' : ''}>@${esc(c.handle)} · ${esc(pl(c.platformId).name)}</option>`).join('')}</select></label>` : ''}</div>
    <nav class="dl-subnav" aria-label="Creator Studio">${STUDIO.map(([id, label]) => `<button data-studio="${id}" class="${tab === id ? 'on' : ''}" aria-current="${tab === id}">${esc(label)}</button>`).join('')}</nav>`;
  return head + ({ overview: studioOverview, library: () => libraryHtml(), analytics: studioAnalytics, audience: studioAudience, collabs: studioCollabs, deals: studioDeals, live: studioLive, revenue: studioRevenue, story: studioStory }[tab] ?? studioOverview)(a);
}

function studioOverview(a) {
  const p = player();
  const r = core.reputation(p.id);
  const posts = a.postIds.map((id) => core.world().posts[id]).filter((x) => x && !x.removed).slice(-5).reverse();
  const ledger = creator.ledgerOf().filter((x) => x.accountId === a.id);
  const deals = creator.contracts().filter((c) => c.accountId === a.id && ['offered', 'active'].includes(c.status));
  const projects = creator.projectsOf().filter((x) => !['published', 'archived'].includes(x.status));
  const why = creator.monetizeBlocks(a);
  return `<div class="dl-card" style="--pl:${pl(a.platformId).accent}">
      <div class="row" style="border:0;padding:0;background:none">${face(p.id)}<div class="main"><strong>@${esc(a.handle)}</strong><small>${esc(pl(a.platformId).name)} · ${esc(TOPIC_BY_ID[a.creator.pathway].name)} · ${esc(CREATOR_STAGES.find((s) => s.id === a.creator.stage).name)}</small></div></div>
      <div class="dl-stats"><div><strong>${n0(acc.followerCount(a))}</strong><small>followers</small></div><div><strong>${n0(a.postIds.length)}</strong><small>posts</small></div><div><strong>${esc(fmtMoney(ledger.reduce((s, x) => s + x.net, 0), country()))}</strong><small>earned, net</small></div></div>
    </div>
    <div class="card"><h3>Standing</h3>${meterHtml('Recognition', r.recognition, true)}${meterHtml('Credibility', r.credibility, true)}${meterHtml('Loyalty', r.loyalty, true)}</div>
    <div class="btn-stack" style="margin-bottom:12px">
      <button class="btn primary" data-do="compose">Create content</button>
      <button class="btn" data-do="newProject">Start a project</button>
      <button class="btn" data-studio="live">Plan a livestream</button>
      ${a.creator.monetized ? '<p class="muted">Monetised: the platform shares ad money with you.</p>' : `<button class="btn" data-chan="monetize" data-id="${a.id}" ${why.length ? 'disabled' : ''}>Turn on payments${why.length ? ` — ${esc(why[0])}` : ''}</button>`}
      ${['established', 'public'].includes(a.creator.stage) && p.career.careerId !== 'influencer' ? `<button class="btn" data-chan="fulltime" data-id="${a.id}">Make this your job</button>` : ''}
      <button class="btn" data-chan="routine" data-id="${a.id}">${a.creator.routine ? `Routine: ${a.creator.routine.perYear} a year — change` : 'Set a posting routine (optional)'}</button>
      ${a.creator.merch ? `<p class="muted">You sell merchandise (since ${a.creator.merch.since}).</p>` : `<button class="btn" data-chan="merch" data-id="${a.id}">Open a merchandise shop (${esc(fmtMoney(localMoney(1500, country()), country()))})</button>`}
    </div>
    ${deals.length ? `<div class="card"><h3>Sponsorship obligations</h3>${deals.map((c) => `<div class="kv"><span>${esc(SPONSOR_BY_ID[c.sponsorId].name)}</span><span>${c.status === 'offered' ? 'offer waiting' : `${c.deliverables.done}/${c.deliverables.posts} posts by ${c.deadline}`}</span></div>`).join('')}</div>` : ''}
    ${projects.length ? `<div class="card"><h3>Active projects</h3>${projects.map((x) => `<div class="kv"><span>${esc(x.title)}</span><span>${esc(x.status.replace('_', ' '))}</span></div>`).join('')}</div>` : ''}
    <div class="section-label">Recent content</div>${posts.map((x) => postCard(x)).join('') || '<p class="empty">Nothing published yet.</p>'}`;
}

function libraryHtml() {
  const list = creator.projectsOf().sort((a, b) => b.createdYear - a.createdYear);
  return `<div class="section-label">Content library</div>
    <button class="btn" data-do="newProject" style="margin-bottom:10px">Start a project</button>
    ${list.length ? list.map((x) => `<div class="dl-card"><strong>${esc(x.title)}</strong><small class="muted"> · ${esc(PROJECT_KINDS.find((k) => k.id === x.kind).name)} · ${esc(x.status.replace('_', ' '))} · started ${x.createdYear}</small>
      ${x.collaborators.length ? `<div class="dl-members">${x.collaborators.map((id) => face(id, 'sm')).join('')}</div>` : ''}
      <div class="kv"><span>Quality so far</span><span>${x.sessions ? `${Math.round(x.quality * 100)}/100` : '—'}</span></div>
      <div class="dl-btns">
        ${['planned', 'in_progress'].includes(x.status) ? `<button class="btn small" data-proj="work" data-id="${x.id}">Work on it (${Math.round(PROJECT_KINDS.find((k) => k.id === x.kind).hours / PROJECT_KINDS.find((k) => k.id === x.kind).sessions)} h)</button>` : ''}
        ${x.status === 'editing' ? `<button class="btn small" data-proj="edit" data-id="${x.id}">Edit</button>` : ''}
        ${x.status === 'ready' ? `<button class="btn small primary" data-proj="publish" data-id="${x.id}">Publish</button>` : ''}
        ${x.postId && core.world().posts[x.postId] ? `<button class="btn small" data-open-post="${x.postId}">See post</button>` : ''}
        ${['ready', 'published'].includes(x.status) ? `<button class="btn small" data-proj="portfolio" data-id="${x.id}">Add to portfolio</button>` : ''}
        ${x.status !== 'archived' ? `<button class="btn small" data-proj="archive" data-id="${x.id}">Archive</button>` : ''}
      </div></div>`).join('') : '<p class="empty">No projects yet.</p>'}`;
}

function studioAnalytics(a) {
  const growth = a.history.map((h) => ({ k: h.year, v: h.followers }));
  const posts = a.postIds.map((id) => core.world().posts[id]).filter((x) => x?.metrics).slice(-12);
  const views = posts.map((x, i) => ({ k: `${x.year}#${i + 1}`, v: x.metrics.views }));
  const byYear = {};
  for (const x of a.postIds.map((id) => core.world().posts[id]).filter((y) => y?.metrics)) { byYear[x.year] ??= { views: 0, likes: 0 }; byYear[x.year].views += x.metrics.views; byYear[x.year].likes += x.metrics.likes; }
  const rev = {};
  for (const r of creator.ledgerOf().filter((x) => x.accountId === a.id)) rev[r.year] = (rev[r.year] ?? 0) + r.net;
  return `<div class="card"><h3>Audience growth</h3>${bars(growth, 'Followers at the end of each year')}</div>
    <div class="card"><h3>Content performance</h3>${bars(views, 'Views on your most recent posts')}</div>
    <div class="card"><h3>Engagement by year</h3>${Object.entries(byYear).map(([y, v]) => `<div class="kv"><span>${y}</span><span>${n0(v.views)} views · ${n0(v.likes)} likes · ${v.views ? Math.round(v.likes / v.views * 1000) / 10 : 0}%</span></div>`).join('') || '<p class="empty">No posts yet.</p>'}</div>
    <div class="card"><h3>Revenue history</h3>${bars(Object.entries(rev).map(([k, v]) => ({ k, v })), 'Net income each year', (x) => fmtMoney(x, country()))}</div>`;
}

function studioAudience(a) {
  const named = a.followers.map(acc.account).filter(Boolean);
  const r = core.reputation(a.ownerId);
  return `<div class="card"><h3>Who follows @${esc(a.handle)}</h3>
      <div class="kv"><span>People you know</span><span>${named.length}</span></div>
      <div class="kv"><span>Everyone else</span><span>${n0(a.audience)}</span></div>
      <div class="kv"><span>Loyalty</span><span>${Math.round(r.loyalty)}/100</span></div>
      <p class="muted" style="margin-top:8px">Most followers are a crowd, not people you know. The ones below are real people in your world.</p></div>
    ${named.map((f) => `<div class="row">${face(f.ownerId)}<div class="main"><strong>${esc(core.nameOf(f.ownerId))}</strong><small>@${esc(f.handle)}</small></div></div>`).join('') || '<p class="empty">Nobody you know follows this channel yet.</p>'}`;
}

function studioCollabs() {
  const open = creator.offers().filter((o) => o.kind === 'collab');
  const done = core.world().events.filter((e) => e.kind === 'collaboration' && e.charIds.includes(player().id));
  return `${open.map((o) => `<div class="dl-card">${face(o.fromId)} <strong>${who(o.fromId)}</strong><p>Wants to make some ${esc(TOPIC_BY_ID[o.topic].name.toLowerCase())} content with you.${o.fee ? ` Paid: ${esc(fmtMoney(o.fee, country()))} when it is published.` : ''}</p>
      <div class="dl-btns"><button class="btn small primary" data-offer="accept" data-id="${o.id}">Accept</button><button class="btn small" data-offer="decline" data-id="${o.id}">Decline</button></div></div>`).join('') || '<p class="empty">No collaboration offers right now. They come once a channel is going.</p>'}
    ${core.world().offers.filter((o) => o.kind === 'license' && o.status === 'open').map((o) => `<div class="dl-card"><strong>Licensing request</strong><p>${esc(o.from)} wants to use "${esc(core.world().posts[o.postId]?.text ?? 'your work')}" and will pay ${esc(fmtMoney(o.fee, country()))}, once.</p><div class="dl-btns"><button class="btn small primary" data-license="yes" data-id="${o.id}">Agree</button><button class="btn small" data-license="no" data-id="${o.id}">Decline</button></div></div>`).join('')}
    <div class="section-label">Past collaborations</div>
    ${done.map((e) => `<div class="row">${e.charIds.filter((id) => !core.isPlayer(id)).map((id) => face(id)).join('')}<div class="main"><strong>${e.year}</strong><small style="white-space:normal">${esc(e.summary)}</small></div></div>`).join('') || '<p class="empty">None yet.</p>'}`;
}

function studioDeals(a) {
  const list = creator.contracts().filter((c) => c.accountId === a.id).sort((x, y) => y.year - x.year);
  return list.map((c) => `<div class="dl-card"><strong>${esc(SPONSOR_BY_ID[c.sponsorId].name)}</strong> <small class="muted">${esc(SPONSOR_BY_ID[c.sponsorId].blurb)} · ${esc(c.status)}</small>
      <div class="kv"><span>Pay</span><span>${esc(fmtMoney(c.fee, country()))}${c.negotiated ? ' (negotiated)' : ''}</span></div>
      <div class="kv"><span>Deliver</span><span>${c.deliverables.done}/${c.deliverables.posts} sponsored posts by the end of ${c.deadline}</span></div>
      <div class="kv"><span>Rules</span><span>Label each post as a paid partnership. ${esc(c.restrictions)}</span></div>
      <div class="dl-btns">${c.status === 'offered' ? `<button class="btn small primary" data-deal="accept" data-id="${c.id}">Accept</button>${c.negotiated ? '' : `<button class="btn small" data-deal="negotiate" data-id="${c.id}">Negotiate</button>`}<button class="btn small" data-deal="decline" data-id="${c.id}">Decline</button>` : ''}
        ${c.status === 'active' ? `<button class="btn small primary" data-deal="deliver" data-id="${c.id}">Make a sponsored post</button>${c.deliverables.done ? '' : `<button class="btn small danger" data-deal="end" data-id="${c.id}">End the deal</button>`}` : ''}</div></div>`).join('')
    || '<p class="empty">No sponsorships. Brands come to adults with an audience they trust.</p>';
}

function studioLive(a) {
  const p = player();
  const lives = core.world().streams.filter((s) => s.ownerId === p.id).reverse();
  const plan = lives.find((s) => s.status === 'scheduled');
  const can = acc.activeAccountsOf(p.id).filter((x) => pl(x.platformId).formats.includes('livestream'));
  return `<div class="card"><h3>Livestreams</h3>
      ${plan ? `<p>Planned for ${plan.scheduledYear ?? plan.year}: ${esc(TOPIC_BY_ID[plan.topic].name)} on ${esc(pl(plan.platformId).name)}${plan.collaborators.length ? ` with ${plan.collaborators.map((id) => esc(core.firstOf(id))).join(' and ')}` : ''}${plan.equipment?.length ? `, using ${plan.equipment.map((id) => esc(DEVICE_BY_ID[core.world().devices.find((d) => d.id === id)?.type]?.name.toLowerCase() ?? 'gear')).join(' and ')}` : ''}.</p>
        <div class="dl-btns"><button class="btn small primary" data-live="go" data-id="${plan.id}">Go live (about 10 hours)</button><button class="btn small" data-live="cancel" data-id="${plan.id}">Cancel</button></div>`
    : can.length ? '<button class="btn" data-do="planStream">Plan a stream</button>' : `<p class="muted">You need an account on a live platform (${esc(PLATFORMS.filter((x) => x.type === 'live').map((x) => x.name).join(', '))}) and a device that can stream.</p>`}
    </div>
    ${lives.filter((s) => s.status === 'done').map((s) => `<div class="kv"><span>${s.result.year} · ${esc(TOPIC_BY_ID[s.topic].name)}</span><span>peak ${n0(s.result.peak)} · ${n0(s.result.total)} in all${s.result.tipsGross ? ` · ${esc(fmtMoney(s.result.tipsGross, country()))} tips` : ''}</span></div>`).join('')}`;
}

function studioRevenue() {
  const rows = creator.ledgerOf().slice().reverse();
  const c = country();
  const sum = (k) => rows.reduce((s, x) => s + x[k], 0);
  return `<div class="card"><h3>Every payment</h3>
    <div class="kv"><span>Gross</span><span>${esc(fmtMoney(sum('gross'), c))}</span></div>
    <div class="kv"><span>Platform fees</span><span>${esc(fmtMoney(sum('platformFee'), c))}</span></div>
    <div class="kv"><span>Production costs</span><span>${esc(fmtMoney(sum('expenses'), c))}</span></div>
    <div class="kv"><span>Tax</span><span>${esc(fmtMoney(sum('tax'), c))}</span></div>
    <div class="kv"><span><strong>Net</strong></span><span><strong>${esc(fmtMoney(sum('net'), c))}</strong></span></div></div>
    ${rows.length ? `<table class="dl-table"><caption class="muted">Year by year</caption><thead><tr><th>Year</th><th>Kind</th><th>Gross</th><th>Net</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${x.year}</td><td>${esc(x.kind)}</td><td>${esc(fmtMoney(x.gross, c))}</td><td>${esc(fmtMoney(x.net, c))}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Nothing earned yet. Followers are not money.</p>'}`;
}

function studioStory(a) {
  return `<div class="card"><h3>@${esc(a.handle)}</h3>${(a.creator.stageHistory ?? []).map((s) => `<div class="kv"><span>${s.year}</span><span>${esc(CREATOR_STAGES.find((x) => x.id === s.stage).name)}</span></div>`).join('')}</div>
    ${core.world().events.filter((e) => e.platformId === a.platformId && e.charIds.includes(player().id)).reverse().map((e) => `<div class="kv"><span>${e.year}</span><span>${esc(e.summary)}</span></div>`).join('')}`;
}

// ---------- Reputation, memories, history ----------

function pageReputation() {
  const p = player();
  const r = core.reputation(p.id);
  const cvs = rep.controversiesOf().slice().reverse();
  const safety = core.world().safety.filter((s) => s.charId === p.id).slice().reverse();
  const w = rep.wellbeing();
  const pub = acc.activeAccountsOf(p.id).find((a) => a.visibility === 'public');
  return `<div class="card"><h3>How you are seen online</h3>
      ${meterHtml('Recognition', r.recognition, true)}${meterHtml('Credibility', r.credibility, true)}${meterHtml('Loyalty', r.loyalty, true)}
      <p class="muted" style="margin-top:8px">Recognition is how many people know your name. Credibility is how far they trust you. They are not the same thing.</p></div>
    ${civic.mediaOffers().length ? `<div class="section-label">Public attention</div>${civic.mediaOffers().map((o) => `<div class="dl-card"><strong>${esc(o.outlet)}</strong><p>${esc(civic.MEDIA.find((m) => m.id === o.media).label)}. Being known is not automatically good: it takes time, and not everything you say will come across.</p><div class="dl-btns"><button class="btn small primary" data-media="yes" data-id="${o.id}">Accept</button><button class="btn small" data-media="no" data-id="${o.id}">Decline</button></div></div>`).join('')}` : ''}
    ${cvs.length ? `<div class="section-label">Controversies</div>${cvs.map((c) => `<div class="dl-card"><strong>${esc(rep.CONTROVERSY[c.kind].name)}</strong> <small class="muted">${c.year} · ${esc({ rumor: 'unverified', verified: 'verified', cleared: 'cleared', resolved: 'resolved', allegation: 'alleged' }[c.status] ?? c.status)}${c.resolvedYear ? ` · settled ${c.resolvedYear}` : ''}</small>
        <p>${esc(c.text ?? '')}</p>
        ${!c.resolvedYear ? `<div class="dl-btns">${rep.RESPONSES.map((x) => `<button class="btn small" data-cv="${x.id}" data-id="${c.id}">${esc(x.label)}${x.cost ? ` (${esc(fmtMoney(localMoney(x.cost, country()), country()))})` : ''}</button>`).join('')}</div>` : c.response ? `<small class="muted">You chose: ${esc(rep.RESPONSES.find((x) => x.id === c.response)?.label ?? 'to let it pass')}</small>` : ''}</div>`).join('')}` : ''}
    ${safety.length ? `<div class="section-label">Safety</div>${safety.map((s) => `<div class="dl-card"><strong>${esc(rep.SAFETY[s.kind].name)}</strong> <small class="muted">${s.year} · ${esc(s.status)}</small><p>${esc(rep.SAFETY[s.kind].text)}</p>
        ${s.status === 'open' ? `<div class="dl-btns">${rep.SAFETY_ACTIONS[s.kind].map(([id, label]) => `<button class="btn small" data-safe="${id}" data-id="${s.id}">${esc(label)}</button>`).join('')}</div>` : ''}</div>`).join('')}` : ''}
    <div class="card"><h3>Time and well-being</h3>
      ${w.lastYear ? `<div class="kv"><span>Last year online</span><span>${w.lastYear.posts} posts · ${w.lastYear.hours} hours${w.lastYear.mood ? ` · mood ${w.lastYear.mood > 0 ? '+' : ''}${w.lastYear.mood}` : ''}</span></div>` : ''}
      <div class="kv"><span>Notifications</span><span>${esc({ all: 'Everything', important: 'Only important things', off: 'Off' }[w.notifications])}</span></div>
      <div class="dl-btns" style="margin-top:8px">${['all', 'important', 'off'].map((x) => `<button class="btn small ${w.notifications === x ? 'primary' : ''}" data-notify="${x}">${esc({ all: 'All', important: 'Important only', off: 'Off' }[x])}</button>`).join('')}</div>
      <div class="kv" style="margin-top:8px"><span>Screen time</span><span>${esc({ light: 'A little', moderate: 'A moderate amount' }[w.limit] ?? 'No limit')}</span></div>
      <div class="dl-btns">${[[null, 'No limit'], ['moderate', 'Moderate'], ['light', 'A little']].map(([x, l]) => `<button class="btn small ${(w.limit ?? null) === x ? 'primary' : ''}" data-limit="${x ?? ''}">${l}</button>`).join('')}</div>
      <div class="btn-stack" style="margin-top:10px">${rep.onBreak() ? '<button class="btn" data-do="endBreak">End your break</button>' : '<button class="btn" data-do="takeBreak">Take a break from social media</button>'}
      ${pub && p.age >= 18 ? `<button class="btn" data-fund="${pub.id}">Run a charity fundraiser</button>` : ''}</div></div>
    ${r.log.length ? `<div class="section-label">Why it changed</div>${r.log.slice(-12).reverse().map((x) => `<div class="kv"><span>${x.year} · ${esc(x.part)} ${x.delta > 0 ? '+' : ''}${x.delta}</span><span>${esc(x.cause)}</span></div>`).join('')}` : ''}`;
}

function pageMemories() {
  const p = player();
  const list = core.eventsOf(p.id);
  return list.length ? list.map((e) => `<div class="dl-card dl-memory">
      <div class="dl-post-head">${e.charIds.filter((id) => !core.isPlayer(id)).slice(0, 3).map((id) => face(id, 'sm')).join('') || face(p.id, 'sm')}<div><strong>${e.year}${e.platformId ? ` · ${esc(pl(e.platformId).name)}` : ''}</strong><small>age ${e.age} · ${esc({ public: 'public', family: 'shared with family', private: 'private' }[e.visibility])}</small></div></div>
      <p>${esc(e.summary)}</p>
      ${e.ref?.type === 'post' && core.world().posts[e.ref.id] && !core.world().posts[e.ref.id].removed ? `<button class="btn small" data-open-post="${e.ref.id}">See the post</button>` : ''}
      ${e.ref?.type === 'account' && acc.account(e.ref.id) ? `<button class="btn small" data-open-account="${e.ref.id}">See the account</button>` : ''}
    </div>`).join('') : '<p class="empty">Nothing yet. The moments that matter will be kept here: not every like, just the ones you will remember.</p>';
}

function pageHistory() {
  const p = player();
  const techs = tech.technologies().filter((t) => t.status !== 'future' || t.tech.from <= store.state.year + 15);
  const ancestors = legacy.ancestors();
  const era = getEra(store.state.year);
  const now = eventsIn(p.countryId).filter((e) => e.name && !e.independence);
  return `<div class="card"><h3>${esc(era.name)} <small class="muted">${esc(era.short)}</small></h3><p class="muted">${esc(era.description)}</p>
      ${now.length ? `<p style="margin-top:6px">Under way: ${now.map((e) => esc(e.name)).join(', ')}.</p>` : ''}
      ${(store.state.era?.transitions ?? []).length ? `<p class="muted" style="margin-top:6px">You have lived through: ${erasBetween(p.birthYear, store.state.year).map((x) => esc(x.name)).join(' → ')}.</p>` : ''}</div>
    ${ancestors.length ? '<button class="btn" data-section="archive" style="margin-bottom:10px">Open the Family Archive</button>' : ''}
    <div class="section-label">Communication in ${esc(country().name)}, ${store.state.year}</div>
    ${techs.map((t) => `<div class="dl-tech"><div><strong>${esc(t.tech.name)}</strong><small>${esc({ future: 'not yet', arriving: 'just arriving', spreading: 'spreading', common: 'everywhere', declining: 'fading' }[t.status])}</small></div><div class="dl-share" role="img" aria-label="${Math.round(t.share * 100)}% of people"><i style="width:${Math.round(t.share * 100)}%"></i></div></div>`).join('')}
    <div class="section-label">Platforms</div>
    ${PLATFORMS.filter((x) => x.launch <= store.state.year + 2).map((x) => { const st = tech.platformStatus(x.id); const mine = acc.accountsOf(p.id).filter((a) => a.platformId === x.id); return `<div class="kv"><span>${platChip(x.id)} ${x.launch}${x.closes && x.closes <= store.state.year ? `–${x.closes}` : ''}</span><span>${esc({ unlaunched: 'coming soon', unavailable: 'not here yet', new: 'new', popular: 'popular', declining: 'declining', closed: 'shut down' }[st])}${mine.length ? ` · you: ${mine.map((a) => `@${esc(a.handle)} (${esc(a.status)})`).join(', ')}` : ''}</span></div>`; }).join('')}`;
}

function pageArchive() {
  const list = legacy.ancestors();
  return `<div class="card"><h3>Family Archive</h3><p class="muted">The people your family came from: their life stories, and what they left online that they meant others to see. Their private messages stay private.</p></div>
    ${list.length ? `<div class="section-label">Digital legacy</div>${list.map((a) => `<button class="row" data-ancestor="${a.id}">${face(a.id, '', { inert: true })}<div class="main"><strong>${esc(a.name)}</strong><small>${a.born}–${a.died} · ${esc(erasBetween(a.born, a.died).map((x) => x.name).join(' → '))} · ${a.accounts.length ? `${a.accounts.length} account${a.accounts.length === 1 ? '' : 's'}` : 'no accounts: a life before the internet, or away from it'}</small></div><div class="side">›</div></button>`).join('')}`
    : '<p class="empty">When you carry the family on as someone\'s heir, their story is kept here.</p>'}`;
}

function pageAncestor(id) {
  const v = legacy.archiveOf(id);
  if (!v) return '<p class="empty">Nothing in the archive.</p>';
  return `<div class="dl-card"><div class="row" style="border:0;padding:0;background:none">${face(id, 'lg')}<div class="main"><strong>${esc(v.entry.name)}</strong><small>${v.entry.born}–${v.entry.died} · generation ${v.entry.generation}</small><small>Lived through: ${esc(erasBetween(v.entry.born, v.entry.died).map((x) => x.name).join(' → '))}</small></div></div></div>
    <div class="section-label">Life story</div>${v.entry.milestones.slice(-12).map((m) => `<div class="kv"><span>Age ${m.age}</span><span>${esc(m.text)}</span></div>`).join('')}
    <div class="section-label">Accounts</div>${v.accounts.map(accountCard).join('') || '<p class="empty">No public accounts.</p>'}
    ${v.hiddenAccounts ? `<p class="muted">${v.hiddenAccounts} other account${v.hiddenAccounts === 1 ? ' was' : 's were'} private, and stay${v.hiddenAccounts === 1 ? 's' : ''} that way.</p>` : ''}
    <div class="section-label">Digital memories</div>${v.memories.map((e) => `<div class="dl-card"><div class="dl-post-head">${e.charIds.filter((x) => x !== id).slice(0, 3).map((x) => face(x, 'sm')).join('')}<div><strong>${e.year}</strong></div></div><p>${esc(e.summary)}</p>${e.ref?.type === 'post' && v.posts.some((x) => x.id === e.ref.id) ? `<button class="btn small" data-open-post="${e.ref.id}">See the post</button>` : ''}</div>`).join('') || '<p class="empty">None recorded.</p>'}
    ${v.communities.length ? `<div class="section-label">Communities</div>${v.communities.map(({ m, c }) => `<div class="kv"><span>${esc(c.name)}</span><span>member from ${m.sinceYear}${m.role === 'moderator' ? ', moderator' : ''}</span></div>`).join('')}` : ''}
    <div class="section-label">Posts</div>${v.posts.slice().reverse().map((x) => postCard(x)).join('') || '<p class="empty">No public or family-shared posts.</p>'}
    ${v.sealed ? `<p class="muted dl-sealed">🔒 ${v.sealed} private conversation${v.sealed === 1 ? '' : 's'}, sealed. They were never yours to read.</p>` : ''}
    ${v.accounts.filter((a) => a.status === 'memorial' && !a.memorial).map((a) => `<div class="dl-btns"><button class="btn small" data-memorial="keep" data-id="${a.id}">Keep @${esc(a.handle)} as a public memorial</button><button class="btn small" data-memorial="close" data-id="${a.id}">Close it to the public</button></div>`).join('')}`;
}

function pageKeepInTouch() {
  const p = player();
  const people = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.role !== 'pet').sort((a, b) => b.meters.relationship - a.meters.relationship);
  return `<div class="card"><h3>Keeping in touch</h3><p class="muted">It is ${store.state.year}. There is no internet yet${tech.techAvailable('landline') ? ', but there is the telephone' : ''}. People write, call on each other, and send news when they can.</p></div>
    ${people.map((n) => { const ch = msg.channels(n.id); return `<div class="row">${face(n.id)}<div class="main"><strong>${esc(n.firstName)} ${esc(n.lastName)}</strong><small>${esc(roleLabel(n))}${typeof n.flags.abroad === 'string' && COUNTRIES[n.flags.abroad] ? ` · in ${esc(COUNTRIES[n.flags.abroad].name)}` : ''} · ${ch.map((c) => esc(c.name)).join(', ') || 'no way to reach them'}</small></div><div class="side">${ch.length ? `<button class="btn small" data-reach="${n.id}">Get in touch</button>` : ''}</div></div>`; }).join('') || '<p class="empty">There is nobody to write to.</p>'}`;
}

// ---------- Flows ----------

async function newAccount(api, rerender) {
  const p = player();
  const opts = tech.openPlatforms().map((x) => ({ x, why: acc.signupBlocks(x.id) }));
  const later = PLATFORMS.filter((x) => !tech.platformOpen(x.id) && tech.platformStatus(x.id) !== 'closed' && x.launch <= store.state.year + 1);
  if (!opts.length) { await messageModal({ body: later.length ? `Nothing is open to you here yet. ${later[0].name} is coming.` : 'There are no online services here yet.' }); return; }
  const id = await pickModal({ title: 'Open an account', body: 'Pick a service. Each has its own kind of people.', options: opts.map(({ x, why }) => ({ value: x.id, label: `${x.name} · ${x.type === 'personal' ? 'personal network' : x.type === 'shortvideo' ? 'short video' : x.type}`, sub: why[0] ?? x.blurb, disabled: !!why.length })) });
  if (!id) return;
  const x = PLATFORM_BY_ID[id];
  const v = await formModal({ title: `Join ${x.name}`, body: x.rules, submit: 'Create account', fields: [
    { name: 'handle', label: 'Username', value: `${p.firstName}${p.lastName}`.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20), max: 20 },
    { name: 'bio', label: 'Bio (optional)', type: 'textarea', max: 160 },
    { name: 'visibility', label: 'Who can see your posts', type: 'select', value: p.age < 18 ? x.privacy.find((o) => o !== 'public') ?? x.privacy[0] : x.privacy[0], options: x.privacy.map((o) => ({ value: o, label: VIS[o] ?? o })) },
    { name: 'interests', label: 'Interests', type: 'checks', options: TOPICS.slice(0, 12).map((t) => ({ value: t.id, label: t.name })) },
    { name: 'notifications', label: 'Notifications', type: 'select', value: 'important', options: [{ value: 'all', label: 'Everything' }, { value: 'important', label: 'Important only' }, { value: 'off', label: 'Off' }] },
    // A royal or an office-holder can keep a personal account and an official one apart.
    ...(p.royal || p.politics ? [{ name: 'kind', label: 'Whose voice', type: 'select', value: 'personal', options: [{ value: 'personal', label: 'Your own, personal account' }, { value: 'official', label: `The official account of your ${p.royal ? 'royal office' : 'office'}` }] }] : []),
  ] });
  if (!v) return;
  const r = acc.createAccount({ platformId: id, ...v });
  if (r.ok) state().trail = [{ type: 'account', id: r.account.id }];
  await say(api, r, rerender);
}

async function editAccount(api, rerender, id) {
  const a = acc.account(id);
  const v = await formModal({ title: 'Edit profile', fields: [
    { name: 'displayName', label: 'Display name', value: a.displayName },
    { name: 'handle', label: 'Username (your account stays the same account)', value: a.handle, max: 20 },
    { name: 'bio', label: 'Bio', type: 'textarea', value: a.bio, max: 160 },
    { name: 'interests', label: 'Interests', type: 'checks', value: a.interests, options: TOPICS.map((t) => ({ value: t.id, label: t.name })) },
    { name: 'avatar', label: 'Profile picture', type: 'select', value: a.avatar ?? 'portrait', options: acc.avatarChoices(a) },
    ...(acc.accountsOf(a.ownerId).filter((o) => o.id !== a.id && o.status === 'active').length ? [{ name: 'links', label: 'Link to your other accounts', type: 'checks', value: a.links ?? [], options: acc.accountsOf(a.ownerId).filter((o) => o.id !== a.id && o.status === 'active').map((o) => ({ value: o.id, label: `@${o.handle} on ${pl(o.platformId).name}` })) }] : []),
  ] });
  if (v) await say(api, acc.updateAccount(id, v), rerender);
}

async function privacy(api, rerender, id) {
  const a = acc.account(id);
  const x = pl(a.platformId);
  const v = await formModal({ title: 'Privacy and messages', fields: [
    { name: 'visibility', label: 'Who can see your posts', type: 'select', value: a.visibility, options: x.privacy.map((o) => ({ value: o, label: VIS[o] ?? o })) },
    { name: 'messages', label: 'Who can message you', type: 'select', value: a.messages, options: [{ value: 'everyone', label: 'Anyone' }, { value: 'connections', label: 'People you follow' }, { value: 'nobody', label: 'Nobody' }] },
    { name: 'notifications', label: 'Notifications', type: 'select', value: a.notifications, options: [{ value: 'all', label: 'Everything' }, { value: 'important', label: 'Important only' }, { value: 'off', label: 'Off' }] },
    { name: 'locationSharing', label: 'Let me add my city to posts (never your address)', type: 'check', value: a.locationSharing },
  ] });
  if (v) await say(api, acc.updateAccount(id, v), rerender);
}

async function compose(api, rerender, o = {}) {
  const p = player();
  const mine = acc.activeAccountsOf(p.id).filter((a) => pl(a.platformId).formats.some((f) => f !== 'livestream') && pl(a.platformId).audience !== 'matches');
  if (!mine.length) return;
  const accountId = o.accountId ?? (mine.length === 1 ? mine[0].id : await pickModal({ title: 'Post where?', options: mine.map((a) => ({ value: a.id, label: `@${a.handle} on ${pl(a.platformId).name}`, sub: VIS[a.visibility] })) }));
  if (!accountId) return;
  const a = acc.account(accountId);
  const formats = content.formatOptions(accountId);
  const sources = content.sourceOptions();
  const trends = creator.currentTrends(a.platformId);
  const fam = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && msg.FAMILY.includes(n.role));
  const v = await formModal({ title: `Post on ${pl(a.platformId).name}`, submit: 'Review', fields: [
    { name: 'format', label: 'Kind of post', type: 'select', value: formats.find((f) => !f.why)?.id, options: formats.map((f) => ({ value: f.id, label: `${f.name} · ${f.hours} h${f.why ? ` — ${f.why}` : ''}`, disabled: !!f.why })) },
    { name: 'source', label: 'About', type: 'select', value: o.source ?? '', options: [{ value: '', label: 'Nothing in particular' }, ...sources.map((s) => ({ value: `${s.type}|${s.key}`, label: s.type === 'project' ? `Your project: ${s.text}` : `${s.text} (age ${s.age})` }))] },
    { name: 'topic', label: 'Topic', type: 'select', value: o.topic ?? a.creator?.pathway ?? 'life', options: TOPICS.map((t) => ({ value: t.id, label: t.name })) },
    { name: 'text', label: 'Words (optional)', type: 'textarea', max: 280 },
    { name: 'audience', label: 'Who can see it', type: 'select', value: a.visibility, options: pl(a.platformId).privacy.map((x) => ({ value: x, label: VIS[x] ?? x })) },
    ...(trends.length ? [{ name: 'trendId', label: 'Join a trend? (optional)', type: 'select', value: '', options: [{ value: '', label: 'No' }, ...trends.map((t) => ({ value: t.id, label: t.name }))] }] : []),
    ...(fam.length ? [{ name: 'aboutIds', label: 'Family in it (only if they would not mind)', type: 'checks', options: fam.map((n) => ({ value: n.id, label: `${n.firstName} (${roleLabel(n).toLowerCase()})` })) }] : []),
    { name: 'familyShared', label: 'Keep it for the family archive', type: 'check', value: false },
    ...(a.locationSharing ? [{ name: 'shareLocation', label: `Add your city (${p.city})`, type: 'check', value: false }] : []),
    ...(o.contractId ? [{ name: 'disclosed', label: 'Label it as a paid partnership', type: 'check', value: true }] : []),
    ...(a.creator?.monetized && !o.contractId ? [{ name: 'affiliate', label: 'Include affiliate links (always labeled as such)', type: 'check', value: false }] : []),
  ] });
  if (!v) return;
  const [stype, skey] = v.source ? v.source.split('|') : [];
  const src = stype ? sources.find((s) => s.type === stype && s.key === skey) : null;
  const sure = await confirmModal({ title: 'Ready to post?', body: `${FORMATS[v.format].name} on ${pl(a.platformId).name}, about ${TOPIC_BY_ID[src?.topic ?? v.topic].name.toLowerCase()}, visible to: ${VIS[v.audience] ?? v.audience}. ${v.text ? `"${v.text}"` : src ? `"${src.text}"` : ''} It takes ${FORMATS[v.format].hours} hours of your spare time.${o.contractId && !v.disclosed ? ' It is paid for, and it will not say so.' : ''}`, yes: 'Publish' });
  if (!sure) return;
  const r = content.publish({ accountId, format: v.format, topic: src?.topic ?? v.topic, text: v.text, audience: v.audience, source: src, trendId: v.trendId || undefined, aboutIds: v.aboutIds ?? [], familyShared: v.familyShared, shareLocation: v.shareLocation, contractId: o.contractId, disclosed: v.disclosed, affiliate: v.affiliate });
  if (r.ok) state().trail.push({ type: 'post', id: r.post.id });
  await say(api, r, rerender);
}

async function startConversation(api, rerender, presetId) {
  const p = player();
  let id = presetId;
  if (!id) {
    const people = p.npcIds.map((x) => store.state.npcs[x]).filter((n) => n?.alive && n.role !== 'pet');
    id = await pickModal({ title: 'Get in touch with', options: people.map((n) => { const ch = msg.channels(n.id); const b = msg.contactBlock(n.id); return { value: n.id, label: `${n.firstName} ${n.lastName}`, sub: b ?? `${roleLabel(n)} · ${ch.map((c) => c.name).join(', ') || 'no way to reach them'}`, disabled: !!b || !ch.length }; }) });
  }
  if (!id) return;
  const ch = msg.channels(id);
  if (!ch.length) { await messageModal({ body: 'You have no way to reach them right now.' }); return; }
  const channel = ch.length === 1 ? ch[0].id : await pickModal({ title: 'How?', options: ch.map((c) => ({ value: c.id, label: c.name, sub: `${c.hours} h${c.cost ? ` · ${fmtMoney(localMoney(c.cost, country()), country())}` : ''}` })) });
  if (!channel) return;
  const intent = await pickModal({ title: 'What do you want to say?', options: msg.intents(id).map((x) => ({ value: x.id, label: x.label })) });
  if (!intent) return;
  const r = msg.contact(id, channel, intent);
  if (r.ok || r.thread) state().trail = [{ type: 'thread', id: (r.thread ?? msg.threadWith(id)).id }];
  await say(api, r, rerender);
}

async function newGroup(api, rerender) {
  const opts = msg.groupOptions().filter((o) => o.people.length);
  const platformId = opts.length === 1 ? opts[0].platform.id : await pickModal({ title: 'Which service?', options: opts.map((o) => ({ value: o.platform.id, label: o.platform.name, sub: `${o.people.length} people you know are there` })) });
  if (!platformId) return;
  const o = opts.find((x) => x.platform.id === platformId);
  const v = await formModal({ title: 'New group', submit: 'Create group', fields: [
    { name: 'type', label: 'What kind of group', type: 'select', value: 'friends', options: msg.GROUP_TYPES.map((g) => ({ value: g.id, label: g.name })) },
    { name: 'name', label: 'Group name', value: '' },
    { name: 'memberIds', label: 'Who is in it', type: 'checks', options: o.people.map((n) => ({ value: n.id, label: `${n.firstName} (${roleLabel(n).toLowerCase()})` })) },
  ] });
  if (!v) return;
  const r = msg.createGroup({ platformId, ...v });
  if (r.ok) state().trail = [{ type: 'thread', id: r.thread.id }];
  await say(api, r, rerender);
}

async function threadAction(api, rerender, action, id) {
  const t = core.world().threads[id];
  const p = player();
  if (action === 'send') {
    if (t.kind === 'group') {
      const intent = await pickModal({ title: 'Say what?', options: [['catch_up', 'Catch up'], ['plans', 'Make plans'], ['share_news', 'Share some news'], ['invite', 'Invite everyone to something']].map(([value, label]) => ({ value, label })) });
      if (intent) await say(api, msg.sendToGroup(id, intent), rerender);
      return;
    }
    await startConversation(api, rerender, t.participants.find((x) => x !== p.id));
    return;
  }
  if (action === 'mute') return say(api, msg.muteThread(id, !t.muted), rerender);
  if (action === 'leave') { if (await confirmModal({ title: `Leave "${t.name}"?`, body: 'You will keep the messages so far.', yes: 'Leave', danger: true })) await say(api, msg.leaveGroup(id), rerender); return; }
  if (action === 'invite') {
    const opt = msg.groupOptions().find((o) => o.platform.id === t.platformId);
    const pick = await pickModal({ title: 'Add someone', options: (opt?.people ?? []).filter((n) => !t.participants.includes(n.id)).map((n) => ({ value: n.id, label: `${n.firstName} ${n.lastName}` })) });
    if (pick) await say(api, msg.inviteToGroup(id, pick), rerender);
    return;
  }
  if (action === 'block') {
    const other = t.participants.find((x) => x !== p.id);
    const mine = acc.activeAccountsOf(p.id).find((a) => acc.accountOn(other, a.platformId));
    if (mine && await confirmModal({ title: `Block ${core.firstOf(other)}?`, body: 'They will not be able to see your posts or message you there.', yes: 'Block', danger: true })) await say(api, acc.block(mine.id, acc.accountOn(other, mine.platformId).id), rerender);
  }
}

async function newProject(api, rerender) {
  const p = player();
  const v = await formModal({ title: 'Start a project', submit: 'Start', fields: [
    { name: 'kind', label: 'What kind', type: 'select', value: 'short', options: PROJECT_KINDS.map((k) => ({ value: k.id, label: `${k.name} · ${k.hours} h over ${k.sessions} session${k.sessions === 1 ? '' : 's'}${k.cost ? ` · ${fmtMoney(localMoney(k.cost, country()), country())}` : ''}` })) },
    { name: 'topic', label: 'About', type: 'select', value: creator.channels()[0]?.creator.pathway ?? 'music', options: TOPICS.map((t) => ({ value: t.id, label: t.name })) },
    { name: 'title', label: 'Title', value: '' },
    { name: 'collaboratorIds', label: 'Make it with (optional)', type: 'checks', options: p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.age >= 10 && ['friend', 'sibling', 'partner', 'spouse', 'classmate', 'child'].includes(n.role)).slice(0, 10).map((n) => ({ value: n.id, label: n.firstName })) },
  ] });
  if (v) await say(api, creator.createProject(v), rerender);
}

async function publishProject(api, rerender, projectId) {
  const x = core.world().projects[projectId];
  const fmt = PROJECT_KINDS.find((k) => k.id === x.kind).format;
  const where = acc.activeAccountsOf(player().id).filter((a) => pl(a.platformId).formats.includes(fmt));
  if (!where.length) { await messageModal({ body: `None of your accounts can take a ${FORMATS[fmt].name.toLowerCase()}. ${fmt === 'long_video' ? 'A video platform like Vista can.' : ''}` }); return; }
  const accountId = where.length === 1 ? where[0].id : await pickModal({ title: 'Publish where?', options: where.map((a) => ({ value: a.id, label: `@${a.handle} on ${pl(a.platformId).name}` })) });
  if (!accountId) return;
  const sure = await confirmModal({ title: `Publish ${x.title}?`, body: `It goes out on ${pl(acc.account(accountId).platformId).name} to ${VIS[acc.account(accountId).visibility]}. Publishing takes ${FORMATS[fmt].hours} hours.`, yes: 'Publish' });
  if (!sure) return;
  const r = content.publish({ accountId, format: fmt, topic: x.topic, source: { type: 'project', key: x.id, text: x.title } });
  if (r.ok) state().trail.push({ type: 'post', id: r.post.id });
  await say(api, r, rerender);
}

async function planStream(api, rerender) {
  const p = player();
  const can = acc.activeAccountsOf(p.id).filter((x) => pl(x.platformId).formats.includes('livestream'));
  const v = await formModal({ title: 'Plan a livestream', submit: 'Plan it', fields: [
    { name: 'accountId', label: 'Where', type: 'select', value: can[0].id, options: can.map((a) => ({ value: a.id, label: `@${a.handle} on ${pl(a.platformId).name}` })) },
    { name: 'topic', label: 'What', type: 'select', value: creator.channels()[0]?.creator.pathway ?? 'gaming', options: TOPICS.map((t) => ({ value: t.id, label: t.name })) },
    { name: 'collaboratorIds', label: 'Invite (optional)', type: 'checks', options: p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.age >= 16 && ['friend', 'sibling', 'partner', 'spouse'].includes(n.role)).slice(0, 8).map((n) => ({ value: n.id, label: n.firstName })) },
    ...(creator.streamGear().length ? [{ name: 'equipment', label: 'Use your equipment', type: 'checks', value: creator.streamGear().map((d) => d.id), options: creator.streamGear().map((d) => ({ value: d.id, label: `${DEVICE_BY_ID[d.type].name} (${tech.condition(d)}%)` })) }] : []),
    { name: 'when', label: 'When', type: 'select', value: 'this', options: [{ value: 'this', label: `Later this year (${store.state.year})` }, { value: 'next', label: `Next year (${store.state.year + 1})` }] },
  ] });
  if (v) await say(api, creator.planStream(v), rerender);
}

async function buyDevice(api, rerender) {
  const c = country();
  const own = tech.devicesOf(player().id);
  const id = await pickModal({ title: 'Buy a device', options: tech.devicesForSale().map((d) => ({ value: d.id, label: d.name, sub: `${fmtMoney(localMoney(d.cost, c), c)}${own.some((o) => o.type === d.id) ? ' · you have one' : ''}`, disabled: player().finance.cash < localMoney(d.cost, c) })) });
  if (id) await say(api, tech.buyDevice(id), rerender);
}

// ---------- The hub ----------

/**
 * Opens Digital Life. `api` is the shell's tab API (persisting and re-drawing the game).
 * @param {{section?:string}} [o]
 */
export function openDigitalLife(api, o = {}) {
  core.world();
  const v = state();
  const online = tech.digitalEra();
  const sections = online ? SECTIONS : OFFLINE;
  if (o.section) { v.section = o.section; v.trail = []; }
  if (!sections.some(([id]) => id === v.section)) { v.section = sections[0][0]; v.trail = []; }

  const m = openModal(`
    <div class="dyn-head"><div><div class="eyebrow">${esc(country().name)} · ${store.state.year}</div><h2>Digital Life</h2><p class="muted dl-sub">Your connections, your creativity, your world.</p></div>
      <button class="icon-btn" data-close aria-label="Close Digital Life">✕</button></div>
    <nav class="dl-nav" aria-label="Digital Life sections">${sections.map(([id, label]) => `<button data-section="${id}">${esc(label)}${id === 'messages' ? '<span data-unread></span>' : ''}</button>`).join('')}</nav>
    <div class="dyn-body dl-body" data-body></div>`, { dismissable: true });
  m.el.classList.add('dyn-modal', 'dl-modal');
  const body = m.el.querySelector('[data-body]');
  const key = () => `${v.section}:${v.trail.map((t) => `${t.type}=${t.id ?? ''}`).join('/')}`;
  body.addEventListener('scroll', () => { v.scroll[key()] = body.scrollTop; }, { passive: true });

  function draw() {
    const top = v.trail[v.trail.length - 1];
    m.el.querySelectorAll('[data-section]').forEach((b) => { if (!b.closest('.dl-nav')) return; const on = b.dataset.section === v.section; b.classList.toggle('on', on); b.setAttribute('aria-current', String(on)); });
    const unread = msg.inbox().reduce((s, t) => s + (t.muted ? 0 : t.unread), 0);
    const badge = m.el.querySelector('[data-unread]');
    if (badge) badge.innerHTML = unread ? ` <span class="dl-badge">${unread}</span>` : '';
    let html;
    if (top) {
      html = `<button class="btn dyn-back" data-back>← Back</button>${({ account: () => pageAccount(top.id), post: () => pagePost(top.id), thread: () => pageThread(top.id), ancestor: () => pageAncestor(top.id), me: pageMe })[top.type]()}`;
    } else {
      html = ({ accounts: pageAccounts, feed: pageFeed, messages: pageMessages, people: pagePeople, communities: pageCommunities, create: pageCreate, studio: pageStudio, reputation: pageReputation, memories: pageMemories, history: pageHistory, keep: pageKeepInTouch, archive: pageArchive })[v.section]();
    }
    body.innerHTML = html;
    body.scrollTop = v.scroll[key()] ?? 0;
    m.el.querySelector('.dl-nav button.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  const rerender = () => { if (document.body.contains(m.el)) draw(); };
  const push = (entry) => { v.scroll[key()] = body.scrollTop; v.trail.push(entry); draw(); };

  m.el.addEventListener('change', (e) => {
    const f = e.target.closest('[data-filter]');
    if (!f) return;
    v[f.dataset.filter] = f.value;
    draw();
  });
  m.el.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-close]')) return m.close();
    const sec = t.closest('[data-section]');
    if (sec) { v.scroll[key()] = body.scrollTop; v.section = sec.dataset.section; v.trail = []; return draw(); }
    if (t.closest('[data-back]')) { v.trail.pop(); return draw(); }
    const person = t.closest('[data-person]');
    if (person) return openPerson(person.dataset.person, api, rerender);
    const ds = (sel) => t.closest(`[${sel}]`);
    let el;
    if ((el = ds('data-open-account'))) return push({ type: 'account', id: el.dataset.openAccount });
    if ((el = ds('data-open-post'))) return push({ type: 'post', id: el.dataset.openPost });
    if ((el = ds('data-open-thread'))) return push({ type: 'thread', id: el.dataset.openThread });
    if ((el = ds('data-ancestor'))) return push({ type: 'ancestor', id: el.dataset.ancestor });
    if ((el = ds('data-studio'))) { v.studio = el.dataset.studio; if (v.section !== 'studio') { v.section = 'studio'; v.trail = []; } return draw(); }
    if ((el = ds('data-do'))) {
      const flows = {
        newAccount: () => newAccount(api, rerender), compose: () => compose(api, rerender), newMessage: () => startConversation(api, rerender), newGroup: () => newGroup(api, rerender),
        newProject: () => newProject(api, rerender), planStream: () => planStream(api, rerender), buyDevice: () => buyDevice(api, rerender),
        askPhone: () => say(api, tech.askForPhone(), rerender), takeBreak: () => say(api, rep.takeBreak(), rerender), endBreak: () => say(api, rep.endBreak(), rerender),
        findMatches: () => say(api, comm.findMatches(), rerender),
        studyGroup: () => say(api, school.studyGroup(), rerender),
        datingPrefs: async () => {
          const pr = comm.datingPrefs();
          const r = await formModal({ title: 'What you are looking for', submit: 'Save', fields: [
            { name: 'ageMin', label: 'Youngest', value: String(pr.ageMin), max: 3 }, { name: 'ageMax', label: 'Oldest', value: String(pr.ageMax), max: 3 },
            { name: 'distance', label: 'Where', type: 'select', value: pr.distance, options: [{ value: 'local', label: 'Near me' }, { value: 'anywhere', label: 'Anywhere, even abroad' }] },
            { name: 'goal', label: 'Looking for', type: 'select', value: pr.goal, options: [{ value: 'serious', label: 'Something serious' }, { value: 'casual', label: 'Something casual' }, { value: 'unsure', label: 'Not sure yet' }] }] });
          if (r) await say(api, comm.setDatingPrefs(r), rerender);
        },
        datingProfile: async () => {
          const r = await formModal({ title: `A ${PLATFORM_BY_ID.kindling.name} profile`, body: 'Adults only. Your profile is shown only to your matches.', submit: 'Create profile', fields: [
            { name: 'handle', label: 'Name on your profile', value: player().firstName.toLowerCase(), max: 20 }, { name: 'bio', label: 'About you', type: 'textarea', max: 160 },
            { name: 'interests', label: 'Interests', type: 'checks', options: TOPICS.slice(3, 16).map((x) => ({ value: x.id, label: x.name })) }] });
          if (r) await say(api, acc.createAccount({ platformId: comm.DATING, visibility: 'matches', ...r }), rerender);
        },
        startChannel: async () => {
          const eligible = acc.activeAccountsOf(player().id).filter((a) => pl(a.platformId).audience === 'followers');
          const r = await formModal({ title: 'Start a creator channel', body: 'The account becomes public so people can find it. You can keep your other accounts private.', submit: 'Start', fields: [
            { name: 'accountId', label: 'Which account', type: 'select', value: eligible[0].id, options: eligible.map((a) => ({ value: a.id, label: `@${a.handle} on ${pl(a.platformId).name}` })) },
            { name: 'pathway', label: 'What it is about', type: 'select', value: 'music', options: TOPICS.filter((x) => !['family', 'friends'].includes(x.id)).map((x) => ({ value: x.id, label: x.name })) }] });
          if (r) { const res = creator.startChannel(r.accountId, r.pathway); if (res.ok) v.channelId = r.accountId; await say(api, res, rerender); }
        },
      };
      return flows[el.dataset.do]?.();
    }
    if ((el = ds('data-acc'))) {
      const id = el.dataset.id;
      const a = acc.account(id);
      const run = {
        edit: () => editAccount(api, rerender, id), privacy: () => privacy(api, rerender, id),
        security: () => say(api, a.security?.twoStep ? { ok: true, text: 'This account already has a strong password and two-step sign-in.', tone: 'neutral' } : (a.security = { strong: true, twoStep: true }, { ok: true, text: 'Strong password set and two-step sign-in turned on.', tone: 'good' }), rerender),
        deactivate: async () => { if (await confirmModal({ title: `Deactivate @${a.handle}?`, body: 'Nobody can see it while it is off. You can switch it back on.', yes: 'Deactivate' })) await say(api, acc.deactivate(id), rerender); },
        reactivate: () => say(api, acc.reactivate(id), rerender),
        recover: () => say(api, rep.recoverAccount(id), rerender),
        delete: async () => {
          const typed = await inputModal({ title: `Delete @${a.handle}?`, label: `This removes the account and its posts for good. Type ${a.handle} to confirm.`, maxLength: 24 });
          if (typed == null) return;
          const r = acc.deleteAccount(id, typed);
          if (r.ok) v.trail = [];
          await say(api, r, rerender);
        },
      }[el.dataset.acc];
      return run?.();
    }
    if ((el = ds('data-req'))) return say(api, acc.respondRequest(el.dataset.id, el.dataset.from, el.dataset.req === 'yes'), rerender);
    if ((el = ds('data-post'))) {
      if (el.dataset.post === 'remove') { if (await confirmModal({ title: 'Remove this post?', body: 'It disappears from every feed. Anything it meant to you stays in your memories.', yes: 'Remove', danger: true })) { const r = content.removePost(el.dataset.id); v.trail.pop(); await say(api, r, rerender); } return undefined; }
      const x = core.world().posts[el.dataset.id];
      const aud = await pickModal({ title: 'Who can see it', options: pl(x.platformId).privacy.map((o) => ({ value: o, label: VIS[o] ?? o })) });
      if (aud) await say(api, content.setPostAudience(x.id, aud), rerender);
      return undefined;
    }
    if ((el = ds('data-comment'))) {
      const x = core.world().posts[el.dataset.postId];
      const c = x?.comments.find((y) => y.id === el.dataset.id);
      const action = el.dataset.comment;
      if (action === 'mute' || action === 'block') {
        const mine = acc.accountOn(player().id, x.platformId) ?? acc.account(x.accountId);
        if (action === 'block' && !(await confirmModal({ title: `Block ${core.firstOf(c.authorId)}?`, body: 'They will not be able to see your posts or message you here.', yes: 'Block', danger: true }))) return undefined;
        return say(api, action === 'mute' ? acc.mute(mine.id, c.accountId) : acc.block(mine.id, c.accountId), rerender);
      }
      return say(api, content.commentAction(el.dataset.postId, el.dataset.id, action), rerender);
    }
    if ((el = ds('data-thread'))) return threadAction(api, rerender, el.dataset.thread, el.dataset.id);
    if ((el = ds('data-follow'))) return say(api, acc.follow(el.dataset.from, el.dataset.follow), rerender);
    if ((el = ds('data-unfollow'))) return say(api, acc.unfollow(el.dataset.from, el.dataset.unfollow), rerender);
    if ((el = ds('data-mute'))) { const me = acc.account(el.dataset.from); return say(api, acc.mute(me.id, el.dataset.mute, !me.muted.includes(el.dataset.mute)), rerender); }
    if ((el = ds('data-unblock'))) return say(api, acc.unblock(el.dataset.from, el.dataset.unblock), rerender);
    if ((el = ds('data-meet'))) return say(api, comm.meetInPerson(el.dataset.meet), rerender);
    if ((el = ds('data-match'))) return say(api, ({ chat: comm.chat, meet: comm.meetMatch, unmatch: comm.unmatch })[el.dataset.match](el.dataset.id), rerender);
    if ((el = ds('data-comm'))) {
      const id = el.dataset.id;
      const r = ({ join: () => comm.join(id), leave: () => comm.leave(id), event: () => comm.attendEvent(id), moderate: () => comm.volunteerModerate(id) })[el.dataset.comm]?.() ?? comm.participate(id, el.dataset.comm);
      return say(api, r, rerender);
    }
    if ((el = ds('data-chan'))) {
      const id = el.dataset.id;
      if (el.dataset.chan === 'routine') {
        const a = acc.account(id);
        const r = await formModal({ title: 'A posting routine', body: 'Optional. The posts are made through the year, as long as you have the time. Stop it whenever you like.', submit: 'Save', fields: [
          { name: 'perYear', label: 'Posts a year (0 to stop)', value: String(a.creator.routine?.perYear ?? 6), max: 2 },
          { name: 'format', label: 'Kind of post', type: 'select', value: a.creator.routine?.format, options: pl(a.platformId).formats.filter((f) => f !== 'livestream').map((f) => ({ value: f, label: `${FORMATS[f].name} · ${FORMATS[f].hours} h each` })) },
          { name: 'topic', label: 'About', type: 'select', value: a.creator.routine?.topic ?? a.creator.pathway, options: TOPICS.map((t) => ({ value: t.id, label: t.name })) }] });
        if (r) await say(api, creator.setRoutine(id, Number(r.perYear) > 0 ? r : null), rerender);
        return undefined;
      }
      return say(api, ({ monetize: creator.monetize, fulltime: creator.goFullTime, merch: creator.startMerch })[el.dataset.chan](id), rerender);
    }
    if ((el = ds('data-proj'))) {
      const id = el.dataset.id;
      if (el.dataset.proj === 'publish') return publishProject(api, rerender, id);
      if (el.dataset.proj === 'portfolio') {
        const where = acc.activeAccountsOf(player().id).filter((a) => ['professional', 'blog', 'personal', 'video'].includes(pl(a.platformId).type));
        if (!where.length) return messageModal({ body: 'A portfolio lives on an account: a professional profile, a blog, or a personal or video page.' });
        const to = where.length === 1 ? where[0].id : await pickModal({ title: 'Show it on which account?', options: where.map((a) => ({ value: a.id, label: `@${a.handle} on ${pl(a.platformId).name}` })) });
        if (to) await say(api, school.addToPortfolio(to, id), rerender);
        return undefined;
      }
      return say(api, ({ work: creator.workOn, edit: creator.edit, archive: creator.archiveProject })[el.dataset.proj](id), rerender);
    }
    if ((el = ds('data-offer'))) return say(api, el.dataset.offer === 'accept' ? creator.acceptCollab(el.dataset.id) : creator.declineOffer(el.dataset.id), rerender);
    if ((el = ds('data-deal'))) {
      const id = el.dataset.id;
      if (el.dataset.deal === 'deliver') return compose(api, rerender, { accountId: core.world().contracts[id].accountId, contractId: id });
      return say(api, ({ accept: creator.acceptDeal, decline: creator.declineDeal, negotiate: creator.negotiate, end: creator.endDeal })[el.dataset.deal](id), rerender);
    }
    if ((el = ds('data-live'))) return say(api, el.dataset.live === 'go' ? creator.broadcast(el.dataset.id) : creator.cancelStream(el.dataset.id), rerender);
    if ((el = ds('data-cv'))) return say(api, rep.respond(el.dataset.id, el.dataset.cv), rerender);
    if ((el = ds('data-safe'))) return say(api, rep.handleSafety(el.dataset.id, el.dataset.safe), rerender);
    if ((el = ds('data-notify'))) return say(api, rep.setNotifications(el.dataset.notify), rerender);
    if ((el = ds('data-fund'))) return say(api, rep.fundraise(el.dataset.fund), rerender);
    if ((el = ds('data-memorial'))) return say(api, legacy.memorialChoice(el.dataset.id, el.dataset.memorial), rerender);
    if ((el = ds('data-reach'))) return startConversation(api, rerender, el.dataset.reach);
    if ((el = ds('data-referral'))) return say(api, pro.askReferral(el.dataset.referral), rerender);
    if ((el = ds('data-stmt'))) {
      const off = civic.officialAccounts();
      const to = off.length === 1 ? off[0].id : await pickModal({ title: 'Which official account?', options: off.map((a) => ({ value: a.id, label: `@${a.handle} on ${pl(a.platformId).name}` })) });
      if (to) await say(api, civic.statement(to, el.dataset.stmt), rerender);
      return undefined;
    }
    if ((el = ds('data-help'))) return say(api, msg.helpOnline(el.dataset.help, el.dataset.pl), rerender);
    if ((el = ds('data-license'))) return say(api, creator.answerLicense(el.dataset.id, el.dataset.license === 'yes'), rerender);
    if ((el = ds('data-media'))) return say(api, civic.answerMedia(el.dataset.id, el.dataset.media === 'yes'), rerender);
    if ((el = ds('data-limit'))) return say(api, rep.setLimit(el.dataset.limit || null), rerender);
    return undefined;
  });
  draw();
  return m;
}

/** A one-card summary for the Pursuits tab. */
export function digitalCard() {
  const p = player();
  if (p.age < 6) return '';
  const online = tech.digitalEra();
  const mine = store.state.digital ? acc.activeAccountsOf(p.id) : [];
  const unread = store.state.digital ? msg.inbox().reduce((s, t) => s + (t.muted ? 0 : t.unread), 0) : 0;
  return `<div class="card dl-entry"><h3>Digital Life</h3>
    <p class="muted" style="margin-bottom:10px">${online ? (mine.length ? `${mine.length} account${mine.length === 1 ? '' : 's'}: ${mine.slice(0, 3).map((a) => `@${esc(a.handle)} on ${esc(pl(a.platformId).name)}`).join(', ')}.` : 'Your connections, your creativity, your world.') : `It is ${store.state.year}: letters, visits${tech.techAvailable('landline') ? ' and the telephone' : ''}.`}${unread ? ` ${unread} unread.` : ''}</p>
    <button class="btn" data-digital>${online ? 'Open Digital Life' : 'Keep in touch'}</button></div>`;
}

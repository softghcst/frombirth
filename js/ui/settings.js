// Settings: People you know, moving saves to another device with a transfer
// code, and the account for cloud saves.
import { birthGlobeOn, setBirthGlobe } from './birthGlobe.js';
import { openNotice } from './screens/notice.js';
import { hapticsOn, setHaptics } from '../haptics.js';
import { esc } from '../util.js';
import { getPeople, addPerson, removePerson, GENDERS, MAX_PEOPLE } from '../people.js';
import { exportCode, importCode, collect, describe } from '../sync/bundle.js';
import * as cloud from '../sync/cloud.js';
import { openModal, pickModal, confirmModal, messageModal, inputModal } from './modals.js';
import { store } from '../state.js';
import { forkGame, timelinesOf, MAX_TIMELINES, saveGame } from '../save.js';
import { STEPS, STEP_NAMES, stepOf, setStep, monthOf, ageLabel } from '../engine/turns.js';
import * as kit from '../engine/teamIdentity.js';
import { jerseySvg, inkOn } from './jersey.js';
import { JERSEY_COLORS } from '../data/sports.js';
import { getTheme, setTheme, THEMES, THEME_NAMES } from '../theme.js';
import { APP_ICONS, APP_ICON_BY_ID, DEFAULT_ICON, getAppIcon, setAppIcon, restoreDefaultIcon, iconSrc } from '../appIcon.js';
import { applyAppIcon } from '../platform/appIcon.js';
import { LANDINGS, LANDING_BY_ID, getLanding, setLanding } from '../landing.js';
import { weddingScenesOn, setWeddingScenes } from './weddingPlanner.js';

/** "just now", "4 minutes ago", "yesterday". */
export function ago(t) {
  if (!t) return 'not yet';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** One line about cloud saves, for the menu and the title screen. */
export function cloudLine(s = cloud.status()) {
  if (!s.configured) return 'Not switched on for this copy of the game.';
  if (!s.signedIn) return 'Sign in to keep your lives on every device.';
  if (s.busy) return `${s.email} · syncing…`;
  if (s.error) return `${s.email} · ${s.error}`;
  return `${s.email} · ${s.pending ? 'changes waiting to send' : `synced ${ago(s.syncedAt)}`}`;
}

/** Time per turn: a year (the default), six months or three months. */
async function openTime(hooks) {
  const now = stepOf();
  const pick = await pickModal({
    title: 'Time per turn',
    body: `How far the calendar moves each time you live on. The year's pay, school reports, seasons of sport and birthdays still come once a year, at the turn of the year; shorter turns add the seasons in between, with scenes written for them.${monthOf() ? ' You are partway through a year: a change starts from next year.' : ''}`,
    options: STEPS.map((s) => ({ value: String(s), label: `${STEP_NAMES[s]}${s === 12 ? ' (default)' : ''}${s === now ? ' · now' : ''}`, sub: s === 12 ? 'One turn is a whole year.' : s === 6 ? 'Two turns a year: the year, and its middle.' : 'Four turns a year: each season of it.' })),
  });
  if (!pick) return;
  const r = setStep(Number(pick));
  if (r.ok) { saveGame(store.state); hooks.onChange?.(); }
  await messageModal({ body: r.text, tone: 'neutral' });
}

/**
 * Opens Settings. Resolves when it is closed.
 * @param {{onChange?:Function}} [hooks]  onChange: saves on this device changed (the title screen redraws)
 */
export async function openSettings(hooks = {}) {
  for (;;) {
    const people = getPeople().length;
    const pick = await pickModal({
      title: 'Settings',
      cancel: 'Done',
      options: [
        { value: 'appearance', label: 'Appearance', sub: `${THEME_NAMES[getTheme()]} · ${APP_ICON_BY_ID[getAppIcon()].name} icon` },
        { value: 'haptics', label: 'Haptics', sub: hapticsOn() ? 'On: a light tap for Age up, answers and news. On iPhone, a single light tick.' : 'Off' },
        { value: 'globe', label: 'Birth globe', sub: birthGlobeOn() ? 'On: a new life begins with the world spinning to where you are born.' : 'Off: a new life begins straight away.' },
        { value: 'weddings', label: 'Interactive weddings', sub: weddingScenesOn() ? 'On: plan your wedding with a planner, then live the day.' : 'Off: plan it on one page, then a "Just married!" card.' },
        // Only while a life is being played: how far each turn moves the calendar.
        ...(store.state?.player?.alive ? [{ value: 'time', label: 'Time per turn', sub: `${STEP_NAMES[stepOf()]}${store.state.settings?.nextStep ? `, then ${STEP_NAMES[store.state.settings.nextStep].toLowerCase()}` : ''}` }] : []),
        // Only while a life is being played: how much of what could happen in love and family is told.
        ...(store.state?.player?.alive ? [{ value: 'drama', label: 'Story drama', sub: `${{ low: 'Low', balanced: 'Balanced', high: 'High' }[store.state.settings?.drama ?? 'balanced']}: how many of the stories that are true of your life are told each year (love, family, friends, work, medicine, sport, life abroad). It never invents one, and consequences always play.` },
          { value: 'sensitive', label: 'Sensitive family storylines', sub: store.state.settings?.sensitiveFamily === true ? 'On: a teenage pregnancy may be part of a life, told without detail.' : 'Off. Turn on to allow a teenage pregnancy storyline, told without detail.' }] : []),
        { value: 'account', label: 'Cloud saves', sub: cloudLine() },
        { value: 'transfer', label: 'Transfer saves', sub: 'To another device' },
        { value: 'people', label: 'People you know', sub: people ? `${people} added` : 'Add real people to the game' },
        // Only while a life is being played, once there are teams in it: their names, jerseys and players.
        ...(store.state?.player?.alive && kit.leagues().length ? [{ value: 'teams', label: 'Teams and jerseys', sub: 'Names and colors' }] : []),
        // Only while a life is being played: keep this moment, and live it two ways.
        ...(store.state?.player?.alive ? [{ value: 'everyday', label: 'Everyday moments', sub: store.state.settings?.everydayScenes === 'popup' ? 'Shown as they happen' : 'In your life story, to answer if you want' }] : []),
        ...(store.state?.player?.alive ? [{ value: 'summary', label: 'Yearly life update', sub: store.state.settings?.yearSummary === true ? 'Shown after each year' : 'Off (look back from Your life this year)' }] : []),
        ...(store.state?.player?.alive ? [{ value: 'whatif', label: 'What if?', sub: `Branch this life. ${timelinesOf(store.state.timeline?.root ?? store.state.slotId).length || 1} of ${MAX_TIMELINES} used` }] : []),
        { value: 'about', label: 'About From Birth', sub: 'Fictional characters and events' },
      ],
    });
    if (!pick) return;
    if (pick === 'drama') { const s = (store.state.settings ??= {}); s.drama = { low: 'balanced', balanced: 'high', high: 'low' }[s.drama ?? 'balanced']; hooks.onChange?.(); continue; }
    if (pick === 'sensitive') { const s = (store.state.settings ??= {}); s.sensitiveFamily = s.sensitiveFamily !== true; hooks.onChange?.(); continue; }
    if (pick === 'whatif') {
      const note = await inputModal({ title: 'What if?', label: 'What is the decision? (a few words)', value: '', maxLength: 60 });
      if (note != null) { const r = forkGame(store.state, note || `Age ${ageLabel(store.state.player.age, store.state.month)}`); hooks.onChange?.(); await messageModal({ body: r.text, tone: r.ok ? 'good' : 'bad' }); }
    }
    if (pick === 'everyday') { store.state.settings = { ...(store.state.settings ?? {}), everydayScenes: store.state.settings?.everydayScenes === 'popup' ? 'story' : 'popup' }; continue; }
    if (pick === 'summary') { store.state.settings = { ...(store.state.settings ?? {}), yearSummary: store.state.settings?.yearSummary !== true }; }
    if (pick === 'haptics') { setHaptics(!hapticsOn()); continue; }
    if (pick === 'weddings') { setWeddingScenes(!weddingScenesOn()); continue; }
    if (pick === 'globe') { setBirthGlobe(!birthGlobeOn()); continue; }
    if (pick === 'appearance') await openAppearance();
    if (pick === 'time') await openTime(hooks);
    if (pick === 'people') await openPeople();
    if (pick === 'teams') { await openTeams(); saveGame(store.state); }
    if (pick === 'transfer') await openTransfer(hooks);
    if (pick === 'account') await openAccount(hooks);
    if (pick === 'about') await openNotice();
  }
}

/** Light, Dark or System, and the app icon. Kept on this device for every life, and applied at once. */
async function openAppearance() {
  for (;;) {
    const now = getTheme();
    const pick = await pickModal({
      title: 'Appearance',
      cancel: 'Back',
      options: [...THEMES.map((t) => ({ value: t, label: `${THEME_NAMES[t]}${t === now ? ' · now' : ''}` })),
        { value: 'landing', label: 'Landing Page', sub: LANDING_BY_ID[getLanding()].name },
        { value: 'icon', label: 'App Icon', sub: `${APP_ICON_BY_ID[getAppIcon()].name}${getAppIcon() === DEFAULT_ICON ? ' (default)' : ''}` }],
    });
    if (!pick) return;
    if (pick === 'icon') { await openAppIcon(); continue; }
    if (pick === 'landing') { await openLandingPage(); continue; }
    setTheme(pick);
    return;
  }
}

/**
 * Settings → Appearance → Landing Page: Afterglow, Midnight or Daydream, or matching light and dark. Each shows its
 * own scenery. Kept apart from the theme and the app icon.
 */
export function openLandingPage() {
  return new Promise((resolve) => {
    const m = openModal('<div data-landingpick></div>', { dismissable: true, title: 'Landing Page', onDismiss: () => resolve() });
    const root = m.el.querySelector('[data-landingpick]');
    const thumb = (id) => (id === 'auto' || id === 'clock'
      ? '<span class="lpk-thumb lpk-auto"><span style="background-image:url(./assets/branding/hero_afterglow-thumb.webp)"></span><span style="background-image:url(./assets/branding/hero_midnight-thumb.webp)"></span></span>'
      : `<span class="lpk-thumb" style="background-image:url(./assets/branding/hero_${id}-thumb.webp)"></span>`);
    const render = () => {
      const now = getLanding();
      root.innerHTML = `<h2 style="margin:0 0 6px">Landing Page</h2>
        <p class="muted" style="margin:0 0 12px">How the first screen looks. It does not change the rest of the game, or your app icon.</p>
        <div class="lpk-grid" role="radiogroup" aria-label="Landing page">
          ${LANDINGS.map((x) => `<button type="button" class="appicon-opt lpk-opt${x.id === now ? ' on' : ''}" role="radio" aria-checked="${x.id === now}" tabindex="${x.id === now ? 0 : -1}" data-landing-opt="${x.id}">
            <span class="appicon-img lpk-img">${thumb(x.id)}${x.id === now ? '<span class="appicon-check" aria-hidden="true">✓</span>' : ''}</span>
            <strong>${esc(x.name)}</strong><small>${esc(x.id === 'auto' ? `${x.blurb} (default)` : x.blurb)}</small></button>`).join('')}
        </div>
        <div class="btn-stack" style="margin-top:14px"><button type="button" class="btn primary" data-done>Done</button></div>`;
    };
    const choose = (id) => { setLanding(id); render(); root.querySelector(`[data-landing-opt="${id}"]`)?.focus(); };
    root.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-landing-opt]');
      if (opt) return choose(opt.dataset.landingOpt);
      if (e.target.closest('[data-done]')) { m.close(); resolve(); }
      return undefined;
    });
    root.addEventListener('keydown', (e) => {
      const opt = e.target.closest('[data-landing-opt]');
      if (!opt || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
      e.preventDefault();
      const ids = LANDINGS.map((x) => x.id);
      const i = ids.indexOf(opt.dataset.landingOpt);
      choose(ids[(i + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : ids.length - 1)) % ids.length]);
    });
    render();
  });
}

/**
 * Settings → Appearance → App Icon: the three icons, as they are, in a grid. The choice is kept apart from Light and
 * Dark. What the platform does with it (js/platform/appIcon.js) is said plainly: a web app cannot change an icon
 * that is already on a home screen.
 */
export function openAppIcon() {
  return new Promise((resolve) => {
    let note = '';
    const m = openModal('<div data-appicon></div>', { dismissable: true, title: 'App Icon', onDismiss: () => resolve() });
    const root = m.el.querySelector('[data-appicon]');
    const render = () => {
      const now = getAppIcon();
      root.innerHTML = `<h2 style="margin:0 0 6px">App Icon</h2>
        <p class="muted" style="margin:0 0 12px">Choose the icon for From Birth. Your choice is kept on this device, whatever the light or dark setting.</p>
        <div class="appicon-grid" role="radiogroup" aria-label="App icon">
          ${APP_ICONS.map((x) => `<button type="button" class="appicon-opt${x.id === now ? ' on' : ''}" role="radio" aria-checked="${x.id === now}" tabindex="${x.id === now ? 0 : -1}" data-icon="${x.id}">
            <span class="appicon-img"><img src="./${iconSrc(x.id, 256)}" width="256" height="256" alt="">${x.id === now ? '<span class="appicon-check" aria-hidden="true">✓</span>' : ''}</span>
            <strong>${esc(x.name)}</strong><small>${x.id === DEFAULT_ICON ? 'Default' : esc(x.blurb)}</small></button>`).join('')}
        </div>
        ${note ? `<p class="muted appicon-note" role="status">${esc(note)}</p>` : ''}
        <div class="btn-stack" style="margin-top:14px">
          <button type="button" class="btn" data-restore${now === DEFAULT_ICON ? ' disabled' : ''}>Restore Default</button>
          <button type="button" class="btn primary" data-done>Done</button>
        </div>`;
    };
    const choose = (id) => { setAppIcon(id); note = applyAppIcon(id).note; render(); root.querySelector(`[data-icon="${id}"]`)?.focus(); };
    root.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-icon]');
      if (opt) return choose(opt.dataset.icon);
      if (e.target.closest('[data-restore]')) { restoreDefaultIcon(); note = applyAppIcon(DEFAULT_ICON).note || 'Afterglow, the default, is restored.'; render(); return undefined; }
      if (e.target.closest('[data-done]')) { m.close(); resolve(); }
      return undefined;
    });
    // A radio group: the arrow keys move the choice, as they do for any set of radio buttons.
    root.addEventListener('keydown', (e) => {
      const opt = e.target.closest('[data-icon]');
      if (!opt || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
      e.preventDefault();
      const ids = APP_ICONS.map((x) => x.id);
      const i = ids.indexOf(opt.dataset.icon);
      choose(ids[(i + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : ids.length - 1)) % ids.length]);
    });
    render();
  });
}

// ---------- People you know ----------

// ---------- Teams and jerseys ----------

/** Leagues, then a league's teams, then a team: its name, colors and players. */
async function openTeams() {
  for (;;) {
    const list = kit.leagues();
    const lg = await pickModal({ title: 'Teams and jerseys', body: 'Every league in this life. Pick one to see its teams.', cancel: 'Done',
      options: list.map((x) => ({ value: x.league.id, label: x.league.name, sub: `${x.sport.name} · ${x.level} · ${x.teams.length} teams${x.mine ? ' · your league' : ''}` })) });
    if (!lg) return;
    for (;;) {
      const L = kit.leagues().find((x) => x.league.id === lg);
      const mine = store.state.sports?.athletes?.[store.state.player.id];
      const myTeams = new Set(Object.values(mine?.sports ?? {}).flatMap((e) => [e.teamId, e.schoolTeamId]).filter(Boolean));
      const t = await pickModal({ title: L.league.name, body: 'Pick a team to rename it, change its jerseys or rename its players.', cancel: 'Back',
        options: L.teams.map(({ team, org }) => ({ value: team.id, label: team.name, sub: `${[kit.colorName(kit.colorsOf(org).home), kit.colorName(kit.colorsOf(org).away)].map((c) => c ?? 'custom').join(' and ')}${myTeams.has(team.id) ? ' · your team' : ''}` })) });
      if (!t) break;
      await openTeam(t);
    }
  }
}

function openTeam(teamId) {
  return new Promise((resolve) => {
    const S = store.state.sports;
    const team = kit.numbersOf(S.teams[teamId]);
    const org = S.orgs[team.orgId];
    const posName = (id) => (id ? id.replace(/_/g, ' ') : '');
    let note = '';
    const m = openModal('<div data-body></div>', { dismissable: true, onDismiss: () => resolve() });
    const draw = () => {
      const c = kit.colorsOf(org);
      m.el.querySelector('[data-body]').innerHTML = `
        <h2>${esc(team.name)}</h2>
        <div class="jersey-pair">${jerseySvg(c, '', 56, `${team.name} home jersey`)}${jerseySvg({ home: c.away, away: c.home }, '', 56, `${team.name} away jersey`)}</div>
        <form data-team novalidate>
          <div class="field"><label for="tm-name">Team name</label><input id="tm-name" maxlength="40" autocomplete="off" value="${esc(org.name)}"></div>
          <div class="field-row">
            <div class="field"><label for="tm-home">Home jersey</label><input id="tm-home" type="color" value="${c.home}"></div>
            <div class="field"><label for="tm-away">Away jersey</label><input id="tm-away" type="color" value="${c.away}"></div>
          </div>
          <div class="jersey-swatches" role="group" aria-label="Quick colors for the home jersey">
            ${JERSEY_COLORS.map(([n, hex]) => `<button type="button" class="jersey-swatch" data-swatch="${hex}" style="background:${hex}" aria-label="${esc(n)}" title="${esc(n)}"></button>`).join('')}
          </div>
          <p class="muted" data-note style="min-height:1.2em">${esc(note)}</p>
          <button type="submit" class="btn primary">Save name and colors</button>
        </form>
        <div class="section-label" style="margin-top:14px">Players</div>
        
        ${team.roster.slice().sort((a, b) => a.num - b.num).map((x) => `<button type="button" class="choice-btn tm-player" data-player="${esc(x.id)}" ${x.id === store.state.player.id ? 'disabled' : ''}>
          <span class="tm-num" style="background:${c.home};color:${inkOn(c.home)}">${x.num}</span>${esc(x.name)}${x.id === store.state.player.id ? ' (you)' : ''}<small>${esc(posName(x.pos))}${x.npcId ? ' · someone you know' : ''}</small></button>`).join('')}
        <button class="btn" data-close style="margin-top:14px">Done</button>`;
    };
    draw();
    m.el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-close]')) { m.close(); return resolve(); }
      const sw = e.target.closest('[data-swatch]');
      if (sw) { m.el.querySelector('#tm-home').value = sw.dataset.swatch; return undefined; }
      const pl = e.target.closest('[data-player]');
      if (pl && !pl.disabled) {
        const x = team.roster.find((y) => y.id === pl.dataset.player);
        const what = await pickModal({ title: x.name, options: [{ value: 'name', label: 'Rename', sub: x.npcId ? 'They are someone you know: their name changes everywhere.' : '' }, { value: 'num', label: 'Change their number', sub: `Now ${x.num}.` }] });
        if (what === 'name') { const v = await inputModal({ title: `Rename ${x.name}`, label: 'Full name', value: x.name, maxLength: 40 }); if (v) note = kit.renamePlayer(team.id, x.id, v).text; }
        if (what === 'num') { const v = await inputModal({ title: `${x.name}'s number`, label: 'Shirt number (0 to 99)', value: String(x.num), maxLength: 2 }); if (v != null) note = kit.setNumber(team.id, x.id, v).text; }
        draw();
      }
      return undefined;
    });
    m.el.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = m.el.querySelector('#tm-name').value;
      const out = [];
      if (name.trim() !== org.name) out.push(kit.renameTeam(org.id, name).text);
      const home = m.el.querySelector('#tm-home').value; const away = m.el.querySelector('#tm-away').value;
      const c = kit.colorsOf(org);
      if (home !== c.home || away !== c.away) out.push(kit.setColors(org.id, home, away).text);
      note = out.join(' ') || 'Nothing to change.';
      draw();
    });
  });
}

function openPeople() {
  return new Promise((resolve) => {
    const m = openModal(`
      <h2>People you know</h2>
      <p class="body muted">Add the names of people from your own life. They will turn up in the game as friends, classmates, people at work, dates and strangers. Each appears at most once in a life. The list is kept on this device${cloud.configured() ? ', and in your account if you use cloud saves' : ''}.</p>
      <div class="field-row">
        <div class="field"><label for="kp-first">First name</label><input id="kp-first" maxlength="20" autocomplete="off"></div>
        <div class="field"><label for="kp-last">Last name (optional)</label><input id="kp-last" maxlength="24" autocomplete="off"></div>
      </div>
      <div class="field"><label>Gender</label>
        <div class="picker" data-gender role="radiogroup" aria-label="Gender">
          ${GENDERS.map(([id, label], i) => `<button type="button" class="pick ${i ? '' : 'on'}" data-value="${id}" role="radio" aria-checked="${i ? 'false' : 'true'}">${label}</button>`).join('')}
        </div></div>
      <p class="muted" data-note style="min-height:1.2em"></p>
      <button class="btn primary" data-add>Add them</button>
      <div data-list style="margin-top:14px"></div>
      <button class="btn" data-close style="margin-top:14px">Done</button>`,
    { dismissable: true, onDismiss: () => resolve() });
    const q = (sel) => m.el.querySelector(sel);
    let gender = GENDERS[0][0];

    function draw() {
      const list = getPeople();
      q('[data-list]').innerHTML = list.length
        ? `<div class="section-label" style="margin-top:0">${list.length} of ${MAX_PEOPLE}</div>` + list.map((x) => `
          <div class="kv"><span>${esc(x.first)} ${esc(x.last ?? '')}</span>
            <span>${esc(GENDERS.find((g) => g[0] === x.gender)?.[1] ?? '')}
              <button class="icon-btn" data-remove="${esc(x.id)}" aria-label="Remove ${esc(x.first)}" style="margin-left:8px">✕</button></span></div>`).join('')
        : '<p class="muted">Nobody added yet.</p>';
    }

    function add() {
      const r = addPerson(q('#kp-first').value, q('#kp-last').value, gender);
      q('[data-note]').textContent = r.text;
      if (r.ok) { q('#kp-first').value = ''; q('#kp-last').value = ''; q('#kp-first').focus(); draw(); }
    }

    m.el.addEventListener('click', (e) => {
      const pick = e.target.closest('[data-gender] .pick');
      if (pick) {
        gender = pick.dataset.value;
        m.el.querySelectorAll('[data-gender] .pick').forEach((b) => { b.classList.toggle('on', b === pick); b.setAttribute('aria-checked', String(b === pick)); });
        return;
      }
      const rm = e.target.closest('[data-remove]');
      if (rm) { removePerson(rm.dataset.remove); draw(); return; }
      if (e.target.closest('[data-add]')) add();
      if (e.target.closest('[data-close]')) { m.close(); resolve(); }
    });
    m.el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); add(); } });
    draw();
  });
}

// ---------- Transfer saves ----------

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

function download(text) {
  const day = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `from-birth-saves-${day}.txt` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function openTransfer(hooks) {
  const here = describe(collect());
  const pick = await pickModal({
    title: 'Transfer saves',
    body: `On this device: ${here}. Make a code or file here, then load it on the other device.`,
    cancel: 'Back',
    options: [
      { value: 'copy', label: 'Copy a transfer code', sub: 'Paste it into a message or note to yourself, then into the other device.' },
      { value: 'file', label: 'Save a transfer file', sub: 'On an iPad it goes to the Files app; on a computer, to Downloads.' },
      { value: 'load', label: 'Load saves from another device', sub: 'Paste a code, or choose a file.' },
    ],
  });
  if (!pick) return;
  if (pick === 'load') return openLoad(hooks);
  const code = await exportCode();
  if (pick === 'file') {
    download(code);
    return messageModal({ title: 'Transfer file saved', body: 'Move the file to the other device (AirDrop, email, or cloud storage all work), then choose Load saves there.' });
  }
  if (await copyText(code)) {
    return messageModal({ title: 'Code copied', body: `The code for ${here} is on your clipboard. It is long; that is normal. Paste it on the other device under Load saves.` });
  }
  // No clipboard access: show it to be copied by hand.
  return new Promise((resolve) => {
    const m = openModal(`
      <h2>Your transfer code</h2>
      <p class="body muted">Select all of it and copy it.</p>
      <textarea class="code-box" readonly rows="6">${esc(code)}</textarea>
      <button class="btn primary" data-close style="margin-top:12px">Done</button>`, { dismissable: true, onDismiss: resolve });
    const box = m.el.querySelector('textarea');
    box.focus(); box.select();
    m.el.querySelector('[data-close]').addEventListener('click', () => { m.close(); resolve(); });
  });
}

function openLoad(hooks) {
  return new Promise((resolve) => {
    const m = openModal(`
      <h2>Load saves</h2>
      <div class="field"><label for="t-code">Transfer code</label>
        <textarea id="t-code" class="code-box" rows="5" placeholder="FROMBIRTH1:…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea></div>
      <div class="field"><label for="t-file">Or a transfer file</label><input id="t-file" type="file" accept=".txt,text/plain"></div>
      <div class="field"><label>What happens to the saves already here</label>
        <div class="picker" data-mode role="radiogroup" aria-label="What happens to the saves already here">
          <button type="button" class="pick on" data-value="combine" role="radio" aria-checked="true">Keep them, and add these</button>
          <button type="button" class="pick" data-value="replace" role="radio" aria-checked="false">Replace them</button>
        </div></div>
      <p class="muted" data-note style="min-height:1.2em"></p>
      <div class="btn-row">
        <button class="btn" data-cancel>Cancel</button>
        <button class="btn primary" data-go>Load</button>
      </div>`, { dismissable: true, onDismiss: resolve });
    const q = (sel) => m.el.querySelector(sel);
    let mode = 'combine';
    q('#t-file').addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (f) q('#t-code').value = (await f.text()).trim();
    });
    m.el.addEventListener('click', async (e) => {
      const p = e.target.closest('[data-mode] .pick');
      if (p) {
        mode = p.dataset.value;
        m.el.querySelectorAll('[data-mode] .pick').forEach((b) => { b.classList.toggle('on', b === p); b.setAttribute('aria-checked', String(b === p)); });
        q('[data-note]').textContent = mode === 'replace' ? 'Lives on this device that are not in the code will be deleted.' : 'Where both have the same life, the one played most recently is kept.';
        return;
      }
      if (e.target.closest('[data-cancel]')) { m.close(); resolve(); return; }
      if (!e.target.closest('[data-go]')) return;
      const text = q('#t-code').value.trim();
      if (!text) { q('[data-note]').textContent = 'Paste a code or choose a file first.'; return; }
      if (mode === 'replace' && !(await confirmModal({ title: 'Replace the saves here?', body: 'Every life, grave and person on this device that is not in the code will be deleted. This cannot be undone.', yes: 'Replace', danger: true }))) return;
      try {
        const what = await importCode(text, mode);
        m.close();
        hooks.onChange?.();
        await messageModal({ title: 'Saves loaded', body: `Brought in ${what}.${cloud.signedIn() ? ' They will be sent to your account too.' : ''}`, tone: 'good' });
        resolve();
      } catch (err) { q('[data-note]').textContent = err.message; }
    });
  });
}

// ---------- Cloud saves ----------

async function openAccount(hooks) {
  if (!cloud.configured()) {
    return messageModal({ title: 'Cloud saves', body: 'Cloud saves are not switched on for this copy of the game yet. Until they are, use Transfer saves to move your lives between devices.' });
  }
  if (!cloud.signedIn()) return openSignIn(hooks);
  return new Promise((resolve) => {
    const m = openModal(`
      <h2>Cloud saves</h2>
      <p class="body" data-line></p>
      <p class="muted" style="margin-bottom:12px">Your lives sync to your account.</p>
      <div class="btn-stack">
        <button class="btn primary" data-sync>Sync now</button>
        <button class="btn" data-password>Change password</button>
        <button class="btn" data-out>Sign out</button>
        <button class="btn danger" data-wipe>Delete my saves from the cloud</button>
        <button class="btn danger" data-delete-account>Delete my account</button>
        <a class="btn" href="privacy.html" target="_blank" rel="noopener">Privacy policy</a>
        <button class="btn" data-close>Done</button>
      </div>`, { dismissable: true, onDismiss: () => { stop(); resolve(); } });
    const line = m.el.querySelector('[data-line]');
    const draw = (s) => { line.textContent = cloudLine(s); m.el.querySelector('[data-sync]').disabled = s.busy; };
    const stop = cloud.onStatus(draw);
    draw(cloud.status());
    const close = () => { stop(); m.close(); };
    const done = () => { close(); resolve(); };
    /** Closes this screen, shows what follows, and only then goes back to the Settings menu. */
    const then = async (next) => { close(); await next(); resolve(); };
    m.el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-close]')) return done();
      if (e.target.closest('[data-sync]')) {
        const r = await cloud.syncNow();
        if (r.pulled) hooks.onChange?.();
        return undefined;
      }
      if (e.target.closest('[data-password]')) return then(askNewPassword);
      if (e.target.closest('[data-out]')) {
        if (!(await confirmModal({ title: 'Sign out?', body: 'Your lives stay on this device. Changes stop being sent to your account until you sign in again.', yes: 'Sign out' }))) return undefined;
        return then(async () => messageModal({ body: (await cloud.signOut()).text }));
      }
      if (e.target.closest('[data-delete-account]')) {
        if (!(await confirmModal({ title: 'Delete your account?', body: 'Your email address, password and cloud saves are deleted for good. The lives on this device stay, and you can keep playing without an account.', yes: 'Delete my account', danger: true }))) return undefined;
        return then(async () => { const r = await cloud.deleteAccount(); await messageModal({ body: r.text, tone: r.tone }); });
      }
      if (e.target.closest('[data-wipe]')) {
        if (!(await confirmModal({ title: 'Delete your cloud saves?', body: 'The copy in your account is removed and you are signed out. The lives on this device stay. Other devices keep theirs too, until they sign in again.', yes: 'Delete', danger: true }))) return undefined;
        return then(async () => { const r = await cloud.deleteCloudSaves(); await messageModal({ body: r.text, tone: r.tone }); });
      }
      return undefined;
    });
  });
}

function openSignIn(hooks) {
  return new Promise((resolve) => {
    const m = openModal(`
      <h2>Cloud saves</h2>
      <p class="body muted">Sign in, or make an account, to keep the same lives on your iPad, phone and computer. Whatever is on this device is kept and added to your account.</p>
      <form novalidate>
        <div class="field"><label for="c-email">Email</label><input id="c-email" type="email" autocomplete="username" inputmode="email" autocapitalize="off" spellcheck="false"></div>
        <div class="field"><label for="c-pass">Password</label><input id="c-pass" type="password" autocomplete="current-password" minlength="8"></div>
        <p class="muted" data-note style="min-height:1.2em"></p>
        <div class="btn-stack">
          <button type="submit" class="btn primary" data-in>Sign in</button>
          <button type="button" class="btn" data-up>Make a new account</button>
          <button type="button" class="btn" data-forgot>Forgot your password?</button>
          <button type="button" class="btn" data-cancel>Back</button>
        </div>
        <p class="muted" style="margin-top:10px;font-size:0.85rem">Making an account means agreeing to the <a href="privacy.html" target="_blank" rel="noopener">privacy policy</a>: your email and saves are kept only to sync your lives, and you can delete them at any time.</p>
      </form>`, { dismissable: true, onDismiss: resolve });
    const q = (sel) => m.el.querySelector(sel);
    const note = (t) => { q('[data-note]').textContent = t; };
    const lock = (on) => m.el.querySelectorAll('button, input').forEach((x) => { x.disabled = on; });
    async function go(fn, working) {
      const addr = q('#c-email').value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) { note('Enter your email address.'); return; }
      note(working); lock(true);
      const r = await fn(addr, q('#c-pass').value);
      lock(false);
      if (!r.ok) { note(r.text); return; }
      m.close();
      hooks.onChange?.();
      await messageModal({ title: 'Cloud saves', body: r.text, tone: 'good' });
      resolve();
    }
    q('form').addEventListener('submit', (e) => { e.preventDefault(); go(cloud.signIn, 'Signing in…'); });
    q('[data-up]').addEventListener('click', () => {
      if (q('#c-pass').value.length < 8) { note('Choose a password of at least 8 characters, then press Make a new account.'); q('#c-pass').focus(); return; }
      q('#c-pass').setAttribute('autocomplete', 'new-password');
      go(cloud.signUp, 'Making your account…');
    });
    q('[data-forgot]').addEventListener('click', async () => {
      const addr = q('#c-email').value.trim();
      if (!addr) { note('Enter your email address first.'); return; }
      note('Sending…');
      note((await cloud.resetPassword(addr)).text);
    });
    q('[data-cancel]').addEventListener('click', () => { m.close(); resolve(); });
  });
}

/** Asks for a new password: after following a reset link, or from the account screen. */
export function askNewPassword() {
  return new Promise((resolve) => {
    const m = openModal(`
      <h2>Choose a new password</h2>
      <form novalidate>
        <div class="field"><label for="c-new">New password</label><input id="c-new" type="password" autocomplete="new-password" minlength="8"></div>
        <p class="muted" data-note style="min-height:1.2em"></p>
        <div class="btn-row">
          <button type="button" class="btn" data-cancel>Not now</button>
          <button type="submit" class="btn primary">Save</button>
        </div>
      </form>`, { dismissable: true, onDismiss: resolve });
    const q = (sel) => m.el.querySelector(sel);
    q('[data-cancel]').addEventListener('click', () => { m.close(); resolve(); });
    q('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await cloud.setPassword(q('#c-new').value);
      if (!r.ok) { q('[data-note]').textContent = r.text; return; }
      m.close();
      await messageModal({ body: r.text, tone: 'good' });
      resolve();
    });
  });
}

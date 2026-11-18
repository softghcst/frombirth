// Settings: People you know, moving saves to another device with a transfer
// code, and the account for cloud saves.
import { esc } from '../util.js';
import { getPeople, addPerson, removePerson, GENDERS, MAX_PEOPLE } from '../people.js';
import { exportCode, importCode, collect, describe } from '../sync/bundle.js';
import * as cloud from '../sync/cloud.js';
import { openModal, pickModal, confirmModal, messageModal, inputModal } from './modals.js';
import { store } from '../state.js';
import { forkGame, timelinesOf, MAX_TIMELINES, saveGame } from '../save.js';
import { STEPS, STEP_NAMES, stepOf, setStep, monthOf, ageLabel } from '../engine/turns.js';

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
        // Only while a life is being played: how far each turn moves the calendar.
        ...(store.state?.player?.alive ? [{ value: 'time', label: 'Time per turn', sub: `${STEP_NAMES[stepOf()]}${store.state.settings?.nextStep ? `, then ${STEP_NAMES[store.state.settings.nextStep].toLowerCase()} from next year` : ''}. Shorter turns bring scenes for each season.` }] : []),
        { value: 'account', label: 'Cloud saves', sub: cloudLine() },
        { value: 'transfer', label: 'Transfer saves', sub: 'Move your lives to another device with a code or a file, no account needed.' },
        { value: 'people', label: 'People you know', sub: people ? `${people} on your list.` : 'Put people from your own life into the game.' },
        // Only while a life is being played: keep this moment, and live it two ways.
        ...(store.state?.player?.alive ? [{ value: 'whatif', label: 'What if?', sub: `Keep this moment as a second timeline, before a decision you are about to make. ${timelinesOf(store.state.timeline?.root ?? store.state.slotId).length || 1} of ${MAX_TIMELINES} used.` }] : []),
      ],
    });
    if (!pick) return;
    if (pick === 'whatif') {
      const note = await inputModal({ title: 'What if?', label: 'What is the decision? (a few words)', value: '', maxLength: 60 });
      if (note != null) { const r = forkGame(store.state, note || `Age ${ageLabel(store.state.player.age, store.state.month)}`); hooks.onChange?.(); await messageModal({ body: r.text, tone: r.ok ? 'good' : 'bad' }); }
    }
    if (pick === 'time') await openTime(hooks);
    if (pick === 'people') await openPeople();
    if (pick === 'transfer') await openTransfer(hooks);
    if (pick === 'account') await openAccount(hooks);
  }
}

// ---------- People you know ----------

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
  const a = Object.assign(document.createElement('a'), { href: url, download: `pathways-saves-${day}.txt` });
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
        <textarea id="t-code" class="code-box" rows="5" placeholder="PATHWAYS1:…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea></div>
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
      <p class="muted" style="margin-bottom:12px">Your lives, graves and People you know are sent to your account a few seconds after each save, and brought in whenever the game opens. Sign in with the same account on another device to pick up where you left off.</p>
      <div class="btn-stack">
        <button class="btn primary" data-sync>Sync now</button>
        <button class="btn" data-password>Change password</button>
        <button class="btn" data-out>Sign out</button>
        <button class="btn danger" data-wipe>Delete my saves from the cloud</button>
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

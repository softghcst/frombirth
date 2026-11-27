// Cloud saves: an account (email and password) and a copy of everything in
// the bundle kept on a Supabase project, so the same lives are on every
// device that signs in. Talks to Supabase's REST endpoints directly, so
// there is no library to load and nothing to build.
//
// One row per player in the `saves` table: { user_id, data, version, device, updated_at }.
// `version` goes up by one on every upload. An upload only goes through if
// the version is still the one this device last saw; if another device got
// there first, the two are combined (bundle.merge) and the upload is tried again.
//
// Nothing here is needed to play. Without a connection, or with the service
// down, saves stay on the device and are sent the next time it can.
import { CLOUD } from './config.js';
import { collect, merge, apply, encode, decode, onChanged, fingerprint } from './bundle.js';

const K_SESSION = 'pathways.session';
const K_STATE = 'pathways.cloud';
/** How long after the last save to wait before uploading. */
const DEBOUNCE_MS = 4000;

export const configured = () => !!(CLOUD.url && CLOUD.key);
const base = () => CLOUD.url.replace(/\/+$/, '');

function read(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function write(key, value) {
  try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

/** @returns {?{access_token:string, refresh_token:string, expires_at:number, user:{id:string, email:string}}} */
const session = () => read(K_SESSION, null);
/** What this device knows about the copy in the cloud. */
const syncState = () => read(K_STATE, { version: 0, syncedAt: 0, dirty: false, error: '' });
const setSyncState = (patch) => write(K_STATE, { ...syncState(), ...patch });

export const signedIn = () => configured() && !!session()?.refresh_token;
export const email = () => session()?.user?.email ?? '';

// ---------- Status, for the screens ----------

const watchers = new Set();
let busy = false;
/** Called whenever the sync status changes. */
export const onStatus = (fn) => { watchers.add(fn); return () => watchers.delete(fn); };
const tell = () => { for (const fn of watchers) { try { fn(status()); } catch { /* ignore */ } } };

/** @returns {{configured:boolean, signedIn:boolean, email:string, busy:boolean, syncedAt:number, pending:boolean, error:string}} */
export function status() {
  const s = syncState();
  return { configured: configured(), signedIn: signedIn(), email: email(), busy, syncedAt: s.syncedAt, pending: !!s.dirty, error: s.error ?? '' };
}

// ---------- Talking to Supabase ----------

class CloudError extends Error {
  constructor(message, code = 0) { super(message); this.code = code; }
}

/** Turns Supabase's error replies into something a player can act on. */
function plainWords(status, body) {
  const raw = `${body?.error_code ?? ''} ${body?.msg ?? ''} ${body?.message ?? ''} ${body?.error_description ?? ''} ${body?.error ?? ''}`.toLowerCase();
  if (/invalid.*(credentials|login)|invalid_grant/.test(raw)) return 'That email and password do not match.';
  if (/already (registered|exists)|user_already_exists/.test(raw)) return 'There is already an account with that email. Sign in instead.';
  if (/email not confirmed|email_not_confirmed/.test(raw)) return 'Confirm your email first: there is a link in the message we sent you.';
  if (/password.*(at least|short|weak)|weak_password/.test(raw)) return 'Choose a longer password: at least 8 characters.';
  if (/rate limit|too many|over_email_send_rate_limit/.test(raw) || status === 429) return 'Too many attempts. Wait a few minutes and try again.';
  if (/invalid.*email|email_address_invalid/.test(raw)) return 'That does not look like an email address.';
  if (/signups? (not allowed|disabled)/.test(raw)) return 'New accounts are switched off for this game.';
  if (status === 401 || status === 403) return 'You have been signed out. Sign in again.';
  if (status >= 500 || status === 0) return 'The cloud is not answering just now. Your saves are safe on this device and will be sent later.';
  return body?.msg ?? body?.message ?? body?.error_description ?? 'Something went wrong talking to the cloud.';
}

async function call(path, { method = 'GET', body, token, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(base() + path, {
      method,
      headers: { apikey: CLOUD.key, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new CloudError('No connection. Your saves are safe on this device and will be sent when you are back online.', 0);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new CloudError(plainWords(res.status, data), res.status);
  return data;
}

function keepSession(s) {
  if (!s?.access_token) return;
  write(K_SESSION, {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + (Number(s.expires_in) || 3600),
    user: { id: s.user?.id, email: s.user?.email },
  });
}

let refreshing = null;
/** A current access token, refreshed when it is close to running out. */
async function token(force = false) {
  const s = session();
  if (!s) throw new CloudError('You are not signed in.', 401);
  if (!force && s.expires_at - 60 > Date.now() / 1000) return s.access_token;
  refreshing ??= call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } })
    .then((fresh) => { keepSession({ ...fresh, user: fresh.user ?? s.user }); return fresh.access_token; })
    .catch((e) => {
      // A refresh token that is no longer accepted means the account was signed out elsewhere.
      if (e.code === 400 || e.code === 401) { write(K_SESSION, null); tell(); }
      throw e;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}

/** A call made as the signed-in player, retried once with a fresh token if the old one was refused. */
async function asPlayer(path, opts = {}) {
  try { return await call(path, { ...opts, token: await token() }); } catch (e) {
    if (e.code !== 401) throw e;
    return call(path, { ...opts, token: await token(true) });
  }
}

// ---------- Accounts ----------

const result = (ok, text) => ({ ok, text, tone: ok ? 'good' : 'bad' });
const tidyEmail = (e) => String(e ?? '').trim().toLowerCase();

export async function signUp(addr, password) {
  if (!configured()) return result(false, 'Cloud saves are not set up for this copy of the game.');
  if (String(password ?? '').length < 8) return result(false, 'Choose a longer password: at least 8 characters.');
  try {
    const r = await call('/auth/v1/signup', { method: 'POST', body: { email: tidyEmail(addr), password } });
    if (r?.access_token) {
      keepSession(r);
      setSyncState({ version: 0, syncedAt: 0, dirty: true, error: '' });
      const s = await syncNow();
      return result(true, `Account made. ${s.text}`);
    }
    // The project asks new players to confirm their email first.
    return result(true, `Nearly there: we have sent a link to ${tidyEmail(addr)}. Open it, then come back and sign in.`);
  } catch (e) { return result(false, e.message); }
}

export async function signIn(addr, password) {
  if (!configured()) return result(false, 'Cloud saves are not set up for this copy of the game.');
  try {
    const r = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: tidyEmail(addr), password } });
    keepSession(r);
    // A new account on this device: whatever is here is combined with what is in the cloud.
    setSyncState({ version: 0, syncedAt: 0, dirty: true, error: '' });
    const s = await syncNow();
    return result(s.ok, s.ok ? `Signed in. ${s.text}` : `Signed in, but the first sync did not finish: ${s.text}`);
  } catch (e) { return result(false, e.message); }
}

export async function signOut() {
  const s = session();
  if (s) { try { await call('/auth/v1/logout', { method: 'POST', token: s.access_token }); } catch { /* signed out here either way */ } }
  write(K_SESSION, null);
  write(K_STATE, null);
  tell();
  return result(true, 'Signed out. Everything stays on this device; it just stops being sent to your account.');
}

/** Sends a password-reset link. The link brings the player back here (handled by takeRedirect). */
export async function resetPassword(addr) {
  if (!configured()) return result(false, 'Cloud saves are not set up for this copy of the game.');
  try {
    const back = encodeURIComponent(location.href.split('#')[0].split('?')[0]);
    await call(`/auth/v1/recover?redirect_to=${back}`, { method: 'POST', body: { email: tidyEmail(addr) } });
    return result(true, `If there is an account for ${tidyEmail(addr)}, a link to choose a new password is on its way.`);
  } catch (e) { return result(false, e.message); }
}

export async function setPassword(password) {
  if (String(password ?? '').length < 8) return result(false, 'Choose a longer password: at least 8 characters.');
  try {
    await asPlayer('/auth/v1/user', { method: 'PUT', body: { password } });
    return result(true, 'Your new password is set.');
  } catch (e) { return result(false, e.message); }
}

/**
 * Links in Supabase's emails (confirming an account, resetting a password)
 * come back to the game with the session in the address. Picks it up and
 * tidies the address. @returns {'recovery'|'signin'|null}
 */
export function takeRedirect() {
  if (!configured() || !location.hash.includes('access_token=')) return null;
  const h = new URLSearchParams(location.hash.slice(1));
  const access = h.get('access_token');
  const refresh = h.get('refresh_token');
  history.replaceState(null, '', location.pathname + location.search);
  if (!access || !refresh) return null;
  let user = {};
  try { const claims = JSON.parse(atob(access.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); user = { id: claims.sub, email: claims.email }; } catch { /* filled in later */ }
  keepSession({ access_token: access, refresh_token: refresh, expires_at: Number(h.get('expires_at')) || undefined, expires_in: h.get('expires_in'), user });
  setSyncState({ version: 0, syncedAt: 0, dirty: true, error: '' });
  return h.get('type') === 'recovery' ? 'recovery' : 'signin';
}

// ---------- Syncing ----------

const device = () => {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  return /iPad|Macintosh.*Mobile/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'browser';
};

const applied = new Set();
/** Called after the cloud's copy has changed what is on this device. */
export const onPulled = (fn) => { applied.add(fn); return () => applied.delete(fn); };

let running = null;
/** Counts saves, so one made while a sync is under way is not mistaken for already sent. */
let edits = 0;
/**
 * Brings this device and the cloud into line: what is new on either side
 * ends up on both. Safe to call at any time; calls made while one is running share it.
 * @returns {Promise<{ok:boolean, text:string, pulled?:boolean}>}
 */
export function syncNow() {
  if (!signedIn()) return Promise.resolve(result(false, 'You are not signed in.'));
  running ??= (async () => {
    busy = true; tell();
    try {
      const uid = session().user?.id;
      if (!uid) throw new CloudError('You have been signed out. Sign in again.', 401);
      let pulled = false;
      const startEdits = edits;
      const settled = () => setSyncState({ syncedAt: Date.now(), error: '', dirty: edits !== startEdits });
      for (let attempt = 0; attempt < 4; attempt++) {
        const known = syncState().version;
        // Cheap first: only the version number.
        const head = (await asPlayer(`/rest/v1/saves?select=version&user_id=eq.${uid}`))?.[0] ?? null;
        let bundle = collect();
        if (!head) {
          // Nothing in the cloud yet: this device's saves become the first copy.
          const made = await asPlayer('/rest/v1/saves', { method: 'POST', headers: { Prefer: 'return=representation' },
            body: { user_id: uid, data: await encode(bundle), version: 1, device: device() } }).catch((e) => { if (e.code === 409) return null; throw e; });
          if (!made) continue; // another device made it a moment ago
          setSyncState({ version: 1 });
          settled();
          return result(true, 'Your saves are now in your account.');
        }
        if (head.version !== known) {
          // Something changed elsewhere: fetch it and combine.
          const row = (await asPlayer(`/rest/v1/saves?select=data,version&user_id=eq.${uid}`))?.[0];
          if (!row) continue;
          const theirs = await decode(row.data);
          const combined = merge(bundle, theirs);
          const counts = apply(combined);
          if (counts.added || counts.updated || counts.removed) pulled = true;
          bundle = combined;
          // Nothing here that the cloud lacks: no need to send it all back.
          const same = fingerprint(combined) === fingerprint(theirs);
          setSyncState({ version: row.version, dirty: !same });
          if (same) { settled(); return { ...result(true, pulled ? 'Brought in what changed on your other devices.' : 'Everything is up to date.'), pulled }; }
        }
        if (!syncState().dirty) {
          settled();
          return { ...result(true, 'Everything is up to date.'), pulled };
        }
        // Upload, but only if nobody else has since the version just seen.
        const v = syncState().version;
        const done = await asPlayer(`/rest/v1/saves?user_id=eq.${uid}&version=eq.${v}`, { method: 'PATCH', headers: { Prefer: 'return=representation' },
          body: { data: await encode(bundle), version: v + 1, device: device() } });
        if (Array.isArray(done) && done.length) {
          setSyncState({ version: v + 1 });
          settled();
          return { ...result(true, pulled ? 'Brought in what changed on your other devices, and sent what changed here.' : 'Your saves are up to date in your account.'), pulled };
        }
        // Someone got there first: go round again and combine with theirs.
      }
      throw new CloudError('Another device keeps saving at the same moment. Try again in a minute.');
    } catch (e) {
      setSyncState({ error: e.message });
      return result(false, e.message);
    } finally {
      busy = false;
      running = null;
      tell();
    }
  })().then((r) => {
    if (syncState().dirty && r.ok) soon();
    if (r.pulled) for (const fn of applied) { try { fn(); } catch { /* ignore */ } }
    return r;
  });
  return running;
}

/** Removes this player's saves from the cloud. What is on this device stays. */
export async function deleteCloudSaves() {
  try {
    await asPlayer(`/rest/v1/saves?user_id=eq.${session().user.id}`, { method: 'DELETE' });
    setSyncState({ version: 0, syncedAt: 0, dirty: false, error: '' });
    const out = await signOut();
    return result(true, `Your saves have been removed from the cloud. ${out.text}`);
  } catch (e) { return result(false, e.message); }
}

/**
 * Deletes the account itself (the email address and password) and its saves, through the database function in
 * docs/cloud-saves.sql. What is on this device stays. If the project has not been given that function yet, the saves
 * are still removed, and the player is told the address needs the owner's help to remove.
 */
export async function deleteAccount() {
  try {
    await asPlayer('/rest/v1/rpc/delete_my_account', { method: 'POST', body: {} });
  } catch (e) {
    if (e.code !== 404) return result(false, e.message);
    const r = await deleteCloudSaves();
    return r.ok ? result(true, `${r.text} Your saves are gone from the cloud, but the account itself could not be removed from here: write to the address in the privacy policy and it will be.`) : r;
  }
  setSyncState({ version: 0, syncedAt: 0, dirty: false, error: '' });
  await signOut();
  return result(true, 'Your account and everything in it have been deleted. The lives on this device stay.');
}

// ---------- Automatic syncing ----------

let timer = null;
function soon() {
  edits += 1;
  if (!signedIn()) return;
  setSyncState({ dirty: true });
  clearTimeout(timer);
  timer = setTimeout(() => { if (navigator.onLine !== false) syncNow(); }, DEBOUNCE_MS);
}

/** Starts syncing in the background: after saves, when the game is closed or hidden, and when the connection comes back. */
export function startAutoSync() {
  if (!configured()) return;
  onChanged(soon);
  addEventListener('online', () => { if (signedIn() && syncState().dirty) syncNow(); });
  // On an iPad, the moment the game is swiped away is the last chance to send this session's years.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && signedIn() && syncState().dirty) { clearTimeout(timer); syncNow(); }
    if (document.visibilityState === 'visible' && signedIn()) syncNow();
  });
  if (signedIn()) syncNow();
}

// In the app only: a second copy of every saved life, kept as a file in the app's own Library folder.
//
// The game keeps its saves in the WebView's localStorage, as the website does. On iOS that storage belongs to the app,
// but the system may clear website data held by an app when the device runs short of space, and a WebView can lose it
// in other rare ways. So, a few moments after anything that travels with a transfer code is saved (lives, graves,
// People you know: sync/bundle.js), the whole bundle is written to a file too, checked by reading it back first.
// When the app opens, anything in that file that is missing here is brought back before the title screen is drawn.
//
// The file is always replaced safely: the new copy is written beside the old one, the old one is kept as the previous
// copy, and only then is the new one put in its place, so a crash at any moment leaves at least one whole copy.
// Library/ is included in the device's own iCloud or computer backup, and is not shown in the Files app.
// In a browser none of this runs: the website keeps its saves exactly as before.
import { isNative, plugin } from './native.js';
import { collect, encode, decode, merge, apply, fingerprint, onChanged, changed, validate } from '../sync/bundle.js';

const DIR = 'LIBRARY';
const FILE = 'saves/backup.fbsave';
const PREV = 'saves/backup-prev.fbsave';
const NEXT = 'saves/backup-next.fbsave';
/** How long after a save to write the file, so a run of saves is written once. */
const DELAY_MS = 1500;

let lastWritten = '';
let timer = null;
let running = null;

const exists = async (fs, path) => { try { await fs.stat({ path, directory: DIR }); return true; } catch { return false; } };

/** Writes the backup file now (once the last write has finished). @returns {Promise<{ok:boolean, skipped?:boolean, error?:string}>} */
export function writeBackup() {
  const fs = plugin('Filesystem');
  if (!fs) return Promise.resolve({ ok: false, error: 'not in the app' });
  const go = async () => {
    const bundle = collect();
    const fp = fingerprint(bundle);
    if (fp === lastWritten) return { ok: true, skipped: true };
    const code = await encode(bundle);
    // Read it back before trusting it.
    if (fingerprint(await decode(code)) !== fp) throw new Error('the backup did not read back the same');
    await fs.writeFile({ path: NEXT, data: code, directory: DIR, encoding: 'utf8', recursive: true });
    if (await exists(fs, FILE)) {
      try { await fs.deleteFile({ path: PREV, directory: DIR }); } catch { /* there was no previous copy */ }
      await fs.rename({ from: FILE, to: PREV, directory: DIR, toDirectory: DIR });
    }
    await fs.rename({ from: NEXT, to: FILE, directory: DIR, toDirectory: DIR });
    lastWritten = fp;
    return { ok: true };
  };
  running = (running ?? Promise.resolve()).then(go, go).catch((e) => {
    console.warn('save backup:', e?.message ?? e);
    return { ok: false, error: String(e?.message ?? e) };
  });
  return running;
}

/** The newest backup copy that reads back whole (the current one, the previous one, or one being written). */
async function newestCopy(fs) {
  let best = null;
  for (const path of [FILE, NEXT, PREV]) {
    try {
      const { data } = await fs.readFile({ path, directory: DIR, encoding: 'utf8' });
      const { bundle } = validate(await decode(data));
      if (!best || (bundle.at ?? 0) > (best.at ?? 0)) best = bundle;
    } catch { /* missing or damaged: try the next copy */ }
  }
  return best;
}

/**
 * When the app opens: brings back from the backup anything that is missing here (a life, a grave, a person you know).
 * Lives deleted on purpose stay deleted, and where both have the same life the newer is kept (bundle.merge).
 * @returns {Promise<?{added:number, updated:number, removed:number}>} what changed, or null when nothing did
 */
export async function restoreFromBackup() {
  if (!isNative()) return null;
  const fs = plugin('Filesystem');
  if (!fs) return null;
  try {
    const saved = await newestCopy(fs);
    if (!saved) return null;
    const here = collect();
    const combined = merge(here, saved);
    if (fingerprint(combined) === fingerprint(here)) return null;
    const counts = apply(combined);
    changed(); // cloud saves, if signed in, hear about it too
    return counts.added || counts.updated ? counts : null;
  } catch (e) {
    console.warn('save backup restore:', e?.message ?? e);
    return null;
  }
}

/** Starts keeping the backup: after saves, and at once when the app goes to the background. */
export function startBackup() {
  if (!isNative() || !plugin('Filesystem')) return false;
  onChanged(() => { clearTimeout(timer); timer = setTimeout(writeBackup, DELAY_MS); });
  const now = () => { clearTimeout(timer); writeBackup(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') now(); });
  try { plugin('App')?.addListener?.('pause', now); } catch { /* the visibility change covers it */ }
  writeBackup();
  return true;
}

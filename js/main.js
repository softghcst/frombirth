// Boot and screen routing.
import { birthGlobeOn, openBirthGlobe } from './ui/birthGlobe.js';
import { watchTaps } from './haptics.js';
import { store } from './state.js';
import { renderTitle } from './ui/screens/title.js';
import { renderCreator } from './ui/screens/creator.js';
import { createLife } from './engine/characterGen.js';
import { renderObituary } from './ui/screens/obituary.js';
import { noticeDue, renderNotice, session } from './ui/screens/notice.js';
import { mountGame } from './ui/shell.js';
import { heirs, continueAs } from './engine/legacy.js';
import { roleLabel } from './engine/relationships.js';
import { saveGame, loadGame, deleteSlot, getGraveyard, updateGrave, undoDepth, popUndo, removeGrave } from './save.js';
import { normalize } from './avatar/catalog.js';
import * as cloud from './sync/cloud.js';
import { askNewPassword, cloudLine } from './ui/settings.js';
import { alignWorld } from './engine/eras.js';
import { resetWorld } from './engine/history.js';
import { applyTheme } from './theme.js';
import { watchTitles } from './ui/titles.js';
import { isNative } from './platform/native.js';
import { restoreFromBackup, startBackup } from './platform/saveBackup.js';
import { watchKeyboard } from './platform/keyboard.js';
import { recoverLostLives } from './save.js';
import { messageModal } from './ui/modals.js';

watchTitles();
applyTheme(); // Light, Dark or System (Settings → Appearance)
watchTaps(); // a light tap under the finger for Age up, answers and main buttons (Settings → Haptics)
watchKeyboard(); // in the app: tapping outside a field puts the keyboard away

// Before anything is shown: lives saved but missing from the list are put back on it, and in the app, anything the
// device's own backup holds that is missing here is brought back (js/platform/saveBackup.js). Never more than a few
// seconds: the game opens either way.
let found = 0;
try { found = recoverLostLives(); } catch (e) { console.error('recovering lost lives', e); }
const restored = isNative() ? await Promise.race([restoreFromBackup(), new Promise((r) => { setTimeout(() => r(null), 4000); })]) : null;

const app = document.getElementById('app');

/** The obituary for the life in the store, with the choice of who carries on. */
function showDeath(entry) {
  const state = store.state;
  // The one the player said they meant to carry on as comes first, and is marked; the choice is still made here.
  const chosen = state.player.flags.chosenHeir;
  const list = heirs(state).sort((a, b) => Number(b.id === chosen) - Number(a.id === chosen)).map((n) => ({ id: n.id, name: n.firstName, label: `${roleLabel(n).toLowerCase()}${n.id === chosen ? ', your chosen heir' : ''}`, age: n.age }));
  renderObituary(app, entry, {
    heirs: list,
    onDone: () => { deleteSlot(state.slotId); showTitle(); },
    // The death itself can be taken back, like any other year.
    onUndo: undoDepth(state.slotId) ? () => {
      const earlier = popUndo(state.slotId);
      if (!earlier) return;
      removeGrave(entry.id);
      saveGame(earlier);
      play(earlier);
    } : null,
    // The same person, born again: same name, birthplace and face, a new roll of everything else.
    onRestart: () => {
      const old = state.player;
      deleteSlot(state.slotId);
      play(createLife({ firstName: old.flags.birthName ?? old.firstName, lastName: old.lastName, gender: old.flags.birthGender ?? old.gender,
        countryId: old.birthCountryId, appearance: { inherited: normalize(old.appearance, old.id).inherited } }));
    },
    onContinue: (id) => {
      const next = continueAs(id);
      if (!next) return;
      updateGrave(entry.id, { continuedAs: `${next.player.firstName} ${next.player.lastName}` });
      deleteSlot(state.slotId);
      saveGame(next);
      play(next);
    },
  });
}

function play(state) {
  onTitle = false;
  session.playing(state.slotId); // a tab that is reloaded or restored comes back to this life
  alignWorld(state); // money and currencies of this life's year (Historical Eras)
  store.set(state);
  // A life that ended while the player was still choosing an heir.
  if (!state.player.alive) {
    const entry = getGraveyard().find((g) => g.id === state.legacy?.graveId);
    if (entry) return showDeath(entry);
    deleteSlot(state.slotId);
    return showTitle();
  }
  return mountGame(app, { onExit: showTitle, onDeath: showDeath, onRestore: play });
}

let onTitle = false;

function showTitle() {
  session.playing(null);
  store.state = null;
  resetWorld(); // saves of every era are listed here, in today's money
  onTitle = true;
  renderTitle(app, {
    onPlay: play,
    onDesign: () => renderCreator(app, {
      // A designed life lands on the chosen country, without the odds (js/ui/birthGlobe.js).
      onCreate: async (opts) => { const life = createLife(opts); if (birthGlobeOn()) await openBirthGlobe(life, { designed: true }); play(life); },
      onCancel: showTitle,
    }),
    onViewGrave: (entry) => { onTitle = false; renderObituary(app, entry, { onDone: showTitle }); },
  });
}

// Cloud saves: a link from an email (confirming an account, resetting a
// password) lands here signed in; then saves sync in the background.
const arrived = cloud.takeRedirect();
// Opening the game: a moment first (it is all fiction, and nothing in it is advice), then the title screen. A tab that
// was only away (backgrounded, and brought back by the phone after it put the tab to sleep) skips the notice and goes
// straight back to the life being played. A refresh is an opening like any other. The session ends when the tab or
// app is closed.
const resume = () => {
  const slot = session.playing();
  const state = slot ? loadGame(slot) : null;
  if (state) play(state); else showTitle();
};
const refreshed = performance.getEntriesByType?.('navigation')?.[0]?.type === 'reload';
if (session.seen() && !refreshed) resume();
else { session.markSeen(); if (noticeDue()) renderNotice(app, showTitle); else showTitle(); }
// Dialogs sit above the page, so the list of lives can be redrawn underneath one.
cloud.onPulled(() => { if (onTitle) showTitle(); });
cloud.onStatus((s) => { const line = document.querySelector('[data-sync-line]'); if (line) line.textContent = cloudLine(s); });
cloud.startAutoSync();
if (arrived === 'recovery') askNewPassword();
startBackup(); // in the app: a second copy of the saves, kept as a file
if (restored || found) {
  const n = (restored ? restored.added + restored.updated : 0) + found;
  messageModal({ title: 'Saves recovered', body: `${n === 1 ? 'One saved life was' : `${n} saved lives were`} missing from this device's list and ${n === 1 ? 'has' : 'have'} been brought back${restored ? ' from the app\'s own backup' : ''}.`, tone: 'good' });
}

// Offline support: once the service worker is running, hand it every file
// this page loaded, so the game works without a connection from the first visit.
// The app has every file on the device already, and needs no service worker.
const secure = location.protocol === 'https:' || location.hostname === 'localhost';
if ('serviceWorker' in navigator && secure && !isNative()) {
  navigator.serviceWorker.register('./sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => {
      const here = new URL('./', location.href).href;
      const extra = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png', './icons/favicon-16.png',
        './assets/branding/from_birth_logo-640.png', './assets/branding/hero_afterglow.webp', './assets/branding/hero_midnight.webp', './assets/branding/hero_daydream.webp', ...['afterglow', 'midnight', 'daydream'].flatMap((x) => [`./icons/icon-${x}-256.png`, `./icons/icon-${x}-32.png`])]
        .map((u) => new URL(u, here).href);
      const loaded = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(here));
      reg.active?.postMessage({ type: 'precache', urls: [...new Set([...extra, ...loaded])] });
    })
    .catch(() => { /* offline support is optional */ });
}

// Boot and screen routing.
import { store } from './state.js';
import { renderTitle } from './ui/screens/title.js';
import { renderCreator } from './ui/screens/creator.js';
import { createLife } from './engine/characterGen.js';
import { renderObituary } from './ui/screens/obituary.js';
import { mountGame } from './ui/shell.js';
import { heirs, continueAs } from './engine/legacy.js';
import { roleLabel } from './engine/relationships.js';
import { saveGame, deleteSlot, getGraveyard, updateGrave, undoDepth, popUndo, removeGrave } from './save.js';
import { normalize } from './avatar/catalog.js';
import * as cloud from './sync/cloud.js';
import { askNewPassword, cloudLine } from './ui/settings.js';
import { alignWorld } from './engine/eras.js';
import { resetWorld } from './engine/history.js';
import { applyTheme } from './theme.js';

applyTheme(); // Light, Dark or System (Settings → Appearance)

const app = document.getElementById('app');

/** The obituary for the life in the store, with the choice of who carries on. */
function showDeath(entry) {
  const state = store.state;
  const list = heirs(state).map((n) => ({ id: n.id, name: n.firstName, label: roleLabel(n).toLowerCase(), age: n.age }));
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
  store.state = null;
  resetWorld(); // saves of every era are listed here, in today's money
  onTitle = true;
  renderTitle(app, {
    onPlay: play,
    onDesign: () => renderCreator(app, {
      onCreate: (opts) => play(createLife(opts)),
      onCancel: showTitle,
    }),
    onViewGrave: (entry) => { onTitle = false; renderObituary(app, entry, { onDone: showTitle }); },
  });
}

// Cloud saves: a link from an email (confirming an account, resetting a
// password) lands here signed in; then saves sync in the background.
const arrived = cloud.takeRedirect();
showTitle();
// Dialogs sit above the page, so the list of lives can be redrawn underneath one.
cloud.onPulled(() => { if (onTitle) showTitle(); });
cloud.onStatus((s) => { const line = document.querySelector('[data-sync-line]'); if (line) line.textContent = cloudLine(s); });
cloud.startAutoSync();
if (arrived === 'recovery') askNewPassword();

// Offline support: once the service worker is running, hand it every file
// this page loaded, so the game works without a connection from the first visit.
const secure = location.protocol === 'https:' || location.hostname === 'localhost';
if ('serviceWorker' in navigator && secure) {
  navigator.serviceWorker.register('./sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => {
      const here = new URL('./', location.href).href;
      const extra = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png']
        .map((u) => new URL(u, here).href);
      const loaded = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(here));
      reg.active?.postMessage({ type: 'precache', urls: [...new Set([...extra, ...loaded])] });
    })
    .catch(() => { /* offline support is optional */ });
}

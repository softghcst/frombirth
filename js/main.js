// Boot and screen routing.
import { store } from './state.js';
import { renderTitle } from './ui/screens/title.js';
import { renderCreator } from './ui/screens/creator.js';
import { createLife } from './engine/characterGen.js';
import { renderObituary } from './ui/screens/obituary.js';
import { mountGame } from './ui/shell.js';
import { heirs, continueAs } from './engine/legacy.js';
import { roleLabel } from './engine/relationships.js';
import { saveGame, deleteSlot, getGraveyard, updateGrave } from './save.js';

const app = document.getElementById('app');

/** The obituary for the life in the store, with the choice of who carries on. */
function showDeath(entry) {
  const state = store.state;
  const list = heirs(state).map((n) => ({ id: n.id, name: n.firstName, label: roleLabel(n).toLowerCase(), age: n.age }));
  renderObituary(app, entry, {
    heirs: list,
    onDone: () => { deleteSlot(state.slotId); showTitle(); },
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
  store.set(state);
  // A life that ended while the player was still choosing an heir.
  if (!state.player.alive) {
    const entry = getGraveyard().find((g) => g.id === state.legacy?.graveId);
    if (entry) return showDeath(entry);
    deleteSlot(state.slotId);
    return showTitle();
  }
  return mountGame(app, { onExit: showTitle, onDeath: showDeath });
}

function showTitle() {
  store.state = null;
  renderTitle(app, {
    onPlay: play,
    onDesign: () => renderCreator(app, {
      onCreate: (opts) => play(createLife(opts)),
      onCancel: showTitle,
    }),
    onViewGrave: (entry) => renderObituary(app, entry, { onDone: showTitle }),
  });
}

showTitle();

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

// Boot and screen routing.
import { store } from './state.js';
import { renderTitle } from './ui/screens/title.js';
import { renderObituary } from './ui/screens/obituary.js';
import { mountGame } from './ui/shell.js';

const app = document.getElementById('app');

function showTitle() {
  store.state = null;
  renderTitle(app, {
    onPlay(state) {
      store.set(state);
      mountGame(app, {
        onExit: showTitle,
        onDeath: (entry) => renderObituary(app, entry, { onDone: showTitle }),
      });
    },
    onViewGrave: (entry) => renderObituary(app, entry, { onDone: showTitle }),
  });
}

showTitle();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ });
}

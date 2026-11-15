// Pursuits tab. Activities (doctor, gym, library, travel, nightlife, social
// media, crime) are built in Phases 7 and 8 and register themselves here.
import { player } from '../../state.js';

export default {
  id: 'pursuits', title: 'Pursuits', short: 'Pursuits',
  icon: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  render(el) {
    const s = player().social;
    el.innerHTML = `
      <p class="empty">No activities are available in this build yet.</p>
      <div class="card"><h3>Online</h3>
        <div class="kv"><span>Followers</span><span>${s.followers.toLocaleString('en-US')}</span></div>
      </div>`;
  },
};

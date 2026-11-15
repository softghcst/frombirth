// Pursuits tab: things to do. Gambling is here now; health, travel, nightlife,
// social media and crime arrive in Phases 7 and 8.
import { player, country } from '../../state.js';
import { esc, fmtMoney } from '../../util.js';
import { canGamble, GAMBLING_AGE } from '../../engine/gambling.js';
import { playBlackjack, playHorses, playLottery } from '../minigames/casino.js';

export default {
  id: 'pursuits', title: 'Pursuits', short: 'Pursuits',
  icon: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  render(el, api) {
    const p = player();
    const c = country();
    const gambled = p.counters.gambled * c.currency.scale;
    el.innerHTML = `
      <div class="card"><h3>Gambling</h3>
        ${canGamble()
    ? `<p class="muted" style="margin-bottom:10px">The house always has an edge. Stakes leave your account the moment you place them.</p>
           <div class="btn-stack">
             <button class="btn" data-play="blackjack">Blackjack</button>
             <button class="btn" data-play="horses">The races</button>
             <button class="btn" data-play="lottery">Lottery tickets</button>
           </div>
           ${gambled ? `<div class="kv" style="margin-top:10px"><span>Staked in your lifetime</span><span>${esc(fmtMoney(gambled, c))}</span></div>` : ''}`
    : `<p class="muted">${p.age < GAMBLING_AGE ? `You have to be ${GAMBLING_AGE} to gamble.` : 'Not available right now.'}</p>`}
      </div>
      <div class="card"><h3>Online</h3>
        <div class="kv"><span>Followers</span><span>${p.social.followers.toLocaleString('en-US')}</span></div>
      </div>`;
    el.onclick = (e) => {
      const game = e.target.closest('[data-play]')?.dataset.play;
      if (game) ({ blackjack: playBlackjack, horses: playHorses, lottery: playLottery })[game](api);
    };
  },
};

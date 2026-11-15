// The escape puzzle: reach the door without ending a turn next to a guard.
// Tap an arrow (or a square next to you) to move, or wait a turn.
import { esc } from '../../util.js';
import * as game from '../../engine/escapeGame.js';
import { openModal } from '../modals.js';

/**
 * @param {object} layout  from data/prisonLayouts.js
 * @returns {Promise<boolean>} whether the player got out
 */
export function playEscape(layout) {
  return new Promise((resolve) => {
    const g = game.newGame(layout);
    const m = openModal('');

    const draw = () => {
      const guards = game.guards(g);
      let cells = '';
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const wall = game.isWall(g, x, y);
          const you = g.you[0] === x && g.you[1] === y;
          const guard = guards.some((p) => p[0] === x && p[1] === y);
          const exit = g.exit[0] === x && g.exit[1] === y;
          const next = Math.abs(g.you[0] - x) + Math.abs(g.you[1] - y) === 1;
          const what = wall ? 'wall' : you ? 'you' : guard ? 'guard' : exit ? 'exit' : 'floor';
          cells += `<button class="cell ${what} ${next && !wall ? 'reach' : ''}" data-x="${x}" data-y="${y}" ${wall || g.status !== 'playing' ? 'disabled' : ''}
            aria-label="${what}">${you ? '🧍' : guard ? '👮' : exit ? '🚪' : ''}</button>`;
        }
      }
      const done = g.status !== 'playing';
      m.el.innerHTML = `
        <div class="eyebrow">${esc(layout.name)} · ${game.turnsLeft(g)} turns until the count</div>
        <p class="muted" style="margin-bottom:10px">Reach the door. Never end a turn beside a guard.</p>
        <div class="grid" style="grid-template-columns:repeat(${g.w},1fr)">${cells}</div>
        ${done ? `<p class="scene" style="margin:14px 0">${g.status === 'escaped' ? 'You are through the door.' : game.turnsLeft(g) <= 0 ? 'The count comes up one short. The alarm goes.' : 'A torch swings round and stops on your face.'}</p>
          <button class="btn primary" data-done>Continue</button>`
    : `<div class="dpad">
            <button class="btn" data-move="0,-1" aria-label="Up">▲</button>
            <div><button class="btn" data-move="-1,0" aria-label="Left">◀</button>
              <button class="btn" data-move="0,0">Wait</button>
              <button class="btn" data-move="1,0" aria-label="Right">▶</button></div>
            <button class="btn" data-move="0,1" aria-label="Down">▼</button>
          </div>
          <button class="btn danger" data-give-up style="margin-top:10px">Go back to your cell</button>`}`;
    };

    m.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-done]')) { m.close(); resolve(g.status === 'escaped'); return; }
      if (e.target.closest('[data-give-up]')) { m.close(); resolve(false); return; }
      const move = e.target.closest('[data-move]')?.dataset.move;
      const cell = e.target.closest('.cell.reach');
      if (move) { const [dx, dy] = move.split(',').map(Number); game.step(g, dx, dy); draw(); } else if (cell) {
        game.step(g, Number(cell.dataset.x) - g.you[0], Number(cell.dataset.y) - g.you[1]);
        draw();
      }
    });
    draw();
  });
}

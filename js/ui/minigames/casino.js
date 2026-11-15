// Casino screens: a playable blackjack table, an animated horse race, and
// the lottery counter.
import { player, country } from '../../state.js';
import { esc, fmtMoney } from '../../util.js';
import * as g from '../../engine/gambling.js';
import { openModal, messageModal, pickModal } from '../modals.js';

const pickStake = (title, body) => pickModal({
  title, body: `${body} You have ${fmtMoney(player().finance.cash, country())}.`,
  options: g.stakes().map((s) => ({ value: s.amount, label: fmtMoney(s.amount, country()), disabled: !s.affordable })),
});

const cardHtml = (c, hidden) => (hidden ? '<span class="card-face back"></span>'
  : `<span class="card-face ${c.suit === '♥' || c.suit === '♦' ? 'red' : ''}">${c.rank}<i>${c.suit}</i></span>`);

/** One or more hands of blackjack at a stake the player picks. */
export async function playBlackjack(api) {
  const c = country();
  let bet = await pickStake('Blackjack', 'Get closer to 21 than the dealer without going over. Blackjack pays 3 to 2.');
  while (bet) {
    const hand = g.deal(bet);
    if (!hand) { await messageModal({ body: 'You cannot cover that stake.' }); return; }
    api.changed();
    const again = await new Promise((resolve) => {
      const m = openModal('');
      const draw = () => {
        m.el.innerHTML = `
          <div class="eyebrow">Blackjack · stake ${fmtMoney(hand.bet, c)}</div>
          <p class="muted">Dealer${hand.done ? `: ${g.total(hand.dealer)}` : ''}</p>
          <div class="hand">${hand.dealer.map((x, i) => cardHtml(x, !hand.done && i === 1)).join('')}</div>
          <p class="muted" style="margin-top:12px">You: ${g.total(hand.you)}</p>
          <div class="hand">${hand.you.map((x) => cardHtml(x)).join('')}</div>
          ${hand.done ? `<p class="scene" style="margin:14px 0">${esc(hand.text)} ${hand.payout > hand.bet ? `You win ${fmtMoney(hand.payout - hand.bet, c)}.` : hand.payout === hand.bet ? '' : `You lose ${fmtMoney(hand.bet, c)}.`}</p>
            <div class="btn-row"><button class="btn" data-bj="leave">Leave the table</button>
              <button class="btn primary" data-bj="again" ${player().finance.cash < bet ? 'disabled' : ''}>Deal again</button></div>`
    : `<div class="btn-row" style="margin-top:16px"><button class="btn primary" data-bj="hit">Hit</button><button class="btn" data-bj="stand">Stand</button>
              ${g.canDouble(hand) ? '<button class="btn" data-bj="double">Double</button>' : ''}</div>`}`;
      };
      draw();
      m.el.addEventListener('click', (e) => {
        const act = e.target.closest('[data-bj]')?.dataset.bj;
        if (!act) return;
        if (act === 'leave' || act === 'again') { m.close(); resolve(act === 'again'); return; }
        ({ hit: g.hit, stand: g.stand, double: g.double })[act](hand);
        if (hand.done) api.changed();
        draw();
      });
    });
    if (!again) return;
  }
}

/** Pick a horse and a stake, then watch the race. */
export async function playHorses(api) {
  const c = country();
  const card = g.raceCard();
  const pick = await pickModal({
    title: 'At the races',
    body: 'Six runners. Short odds win more often and pay less.',
    options: card.map((h, i) => ({ value: i, label: h.name, sub: `${h.odds}/1` })),
  });
  if (pick == null) return;
  const bet = await pickStake(card[pick].name, `${card[pick].odds}/1.`);
  if (!bet) return;
  const race = g.runRace(card, pick, bet);
  if (!race) { await messageModal({ body: 'You cannot cover that stake.' }); return; }
  api.changed();

  await new Promise((resolve) => {
    const m = openModal(`
      <div class="eyebrow">They are off</div>
      <div class="race">${card.map((h, i) => `
        <div class="lane ${i === pick ? 'yours' : ''}"><span>${esc(h.name)}</span><div class="track"><i data-lane="${i}"></i></div></div>`).join('')}</div>
      <div data-result></div>`);
    // Each horse runs at a pace that lands it in its finishing position.
    const place = (i) => race.order.findIndex((h) => h.i === i);
    const pos = card.map(() => 0);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let step = 0;
    const finish = () => {
      card.forEach((_, i) => { m.el.querySelector(`[data-lane="${i}"]`).style.width = `${100 - place(i) * 7}%`; });
      m.el.querySelector('[data-result]').innerHTML = `<p class="scene" style="margin:14px 0">${esc(race.text)}</p><button class="btn primary" data-ok>Continue</button>`;
      m.el.querySelector('[data-ok]').addEventListener('click', () => { m.close(); resolve(); });
    };
    if (reduce) { finish(); return; }
    const timer = setInterval(() => {
      step += 1;
      card.forEach((_, i) => {
        pos[i] = Math.min(100 - place(i) * 7, pos[i] + (100 - place(i) * 7) / 22 + (Math.random() - 0.5) * 3);
        m.el.querySelector(`[data-lane="${i}"]`).style.width = `${Math.max(2, pos[i])}%`;
      });
      if (step >= 24) { clearInterval(timer); finish(); }
    }, 110);
  });
}

export async function playLottery(api) {
  const c = country();
  const price = g.ticketPrice();
  const cash = player().finance.cash;
  const count = await pickModal({
    title: 'The lottery',
    body: 'One ticket in twelve million takes the jackpot. Most win nothing at all.',
    options: [1, 10, 100].map((n) => ({ value: n, label: `${n} ${n === 1 ? 'ticket' : 'tickets'}`, sub: fmtMoney(price * n, c), disabled: cash < price * n })),
  });
  if (!count) return;
  const r = g.buyLotteryTickets(count);
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
}

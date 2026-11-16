// Gambling: blackjack, the horses and the lottery. The house always has an
// edge. Stakes leave your account the moment you place them.
import { rng } from '../rng.js';
import { localMoney, fmtMoney, clamp } from '../util.js';
import { player, country, log, milestone } from '../state.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

export const GAMBLING_AGE = 18;
/** Stakes offered, in base units. */
export const STAKES = [10, 50, 250, 1000, 5000, 25000];
export const LOTTERY_TICKET = 2;

export const gamblingLegal = () => country().living.laws.gambling;
export const canGamble = () => player().age >= GAMBLING_AGE && !player().legal.incarceration && gamblingLegal();
export const stakes = () => STAKES.map((s) => localMoney(s, country())).map((amount) => ({ amount, affordable: player().finance.cash >= amount }));

function stake(amount) {
  const p = player();
  if (p.finance.cash < amount) return false;
  p.finance.cash -= amount;
  p.counters.gambled += Math.round(amount / country().currency.scale);
  return true;
}
function win(amount) {
  const p = player();
  p.finance.cash += amount;
  if (amount >= localMoney(100000, country()) && !p.flags.bigWin) { p.flags.bigWin = true; milestone('Won big at gambling.', 'money'); }
}

// ---------- Blackjack ----------

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];
const draw = () => ({ rank: rng.pick(RANKS), suit: rng.pick(SUITS) });

/** Best total for a hand, counting aces as 11 where that does not bust. */
export function total(cards) {
  let sum = 0; let aces = 0;
  for (const c of cards) {
    if (c.rank === 'A') { aces += 1; sum += 11; } else sum += ['J', 'Q', 'K'].includes(c.rank) ? 10 : Number(c.rank);
  }
  while (sum > 21 && aces) { sum -= 10; aces -= 1; }
  return sum;
}

/**
 * Deals a hand. @returns {?{bet, you, dealer, done, outcome, payout, text}} null if the stake cannot be met
 */
export function deal(bet) {
  if (!canGamble() || !stake(bet)) return null;
  const hand = { bet, you: [draw(), draw()], dealer: [draw(), draw()], done: false, outcome: null, payout: 0, text: '' };
  if (total(hand.you) === 21) finish(hand, true);
  return hand;
}

function finish(hand, natural = false) {
  const c = country();
  const you = total(hand.you);
  if (you <= 21) while (total(hand.dealer) < 17) hand.dealer.push(draw());
  const dealer = total(hand.dealer);
  hand.done = true;
  if (you > 21) { hand.outcome = 'lose'; hand.text = 'Bust.'; }
  else if (natural && dealer !== 21) { hand.outcome = 'blackjack'; hand.payout = Math.round(hand.bet * 2.5); hand.text = 'Blackjack!'; }
  else if (dealer > 21) { hand.outcome = 'win'; hand.payout = hand.bet * 2; hand.text = 'The dealer busts.'; }
  else if (you > dealer) { hand.outcome = 'win'; hand.payout = hand.bet * 2; hand.text = `Your ${you} beats the dealer's ${dealer}.`; }
  else if (you === dealer) { hand.outcome = 'push'; hand.payout = hand.bet; hand.text = `${you} each. Your stake comes back.`; }
  else { hand.outcome = 'lose'; hand.text = `The dealer's ${dealer} beats your ${you}.`; }
  if (hand.payout) win(hand.payout);
  const net = hand.payout - hand.bet;
  log(`Blackjack: ${hand.text} ${net > 0 ? `You won ${fmtMoney(net, c)}.` : net < 0 ? `You lost ${fmtMoney(-net, c)}.` : ''}`.trim(),
    'system', net > 0 ? 'good' : net < 0 ? 'bad' : 'neutral');
  player().stats.mood = clamp(player().stats.mood + (net > 0 ? 2 : net < 0 ? -2 : 0));
}

export function hit(hand) {
  if (hand.done) return hand;
  hand.you.push(draw());
  if (total(hand.you) >= 21) finish(hand);
  return hand;
}

export function stand(hand) {
  if (!hand.done) finish(hand);
  return hand;
}

/** Doubles the stake for exactly one more card. */
export const canDouble = (hand) => !hand.done && hand.you.length === 2 && player().finance.cash >= hand.bet;
export function double(hand) {
  if (!canDouble(hand) || !stake(hand.bet)) return hand;
  hand.bet *= 2;
  hand.you.push(draw());
  finish(hand);
  return hand;
}

// ---------- The horses ----------

const HORSES = ['Midnight Ledger', 'Paper Lantern', 'Cold Harbour', 'Marmalade Sky', 'Second Wind', 'Biscuit Tin',
  'Quiet Thunder', 'Tin Whistle', 'Lucky Sixpence', 'Sunday Driver', 'Gravel Road', 'Small Mercy'];

/** The share of stakes the bookmaker pays back, on average. */
const BOOK_RETURN = 0.84;

/**
 * Six runners. Each has a real chance of winning; the odds offered are a
 * little worse than that chance deserves ("7/1" pays seven times the stake,
 * plus the stake back).
 */
export function raceCard() {
  const names = [...HORSES];
  const strength = [30, 22, 16, 12, 8, 5].map((w) => w * rng.around(1, 0.25));
  const sum = strength.reduce((x, y) => x + y, 0);
  return strength.map((w) => {
    const chance = w / sum;
    return { name: names.splice(rng.int(0, names.length - 1), 1)[0], chance,
      odds: Math.max(1, Math.round(BOOK_RETURN / chance - 1)) };
  }).sort((x, y) => x.odds - y.odds);
}

/** Runs the race. @returns {{order:object[], won:boolean, payout:number, text:string}} */
export function runRace(card, pick, bet) {
  if (!canGamble() || !stake(bet)) return null;
  const c = country();
  const pool = card.map((h, i) => ({ ...h, i }));
  const order = [];
  while (pool.length) {
    const next = rng.weighted(pool, (h) => h.chance);
    pool.splice(pool.indexOf(next), 1);
    order.push(next);
  }
  const won = order[0].i === pick;
  const payout = won ? bet * (card[pick].odds + 1) : 0;
  if (won) win(payout);
  const text = won ? `${card[pick].name} won at ${card[pick].odds}/1. You collected ${fmtMoney(payout, c)}.`
    : `${order[0].name} won. ${card[pick].name} finished ${['first', 'second', 'third', 'fourth', 'fifth', 'last'][order.findIndex((h) => h.i === pick)]}. You lost ${fmtMoney(bet, c)}.`;
  log(`At the races: ${text}`, 'system', won ? 'good' : 'bad');
  player().stats.mood = clamp(player().stats.mood + (won ? 4 : -2));
  return { order, won, payout, text };
}

// ---------- The lottery ----------

/** Prize tiers: one chance in `odds` of winning `prize` base units. */
const PRIZES = [
  { odds: 12000000, prize: 0, jackpot: true },
  { odds: 40000, prize: 5000 },
  { odds: 1500, prize: 300 },
  { odds: 60, prize: 20 },
  { odds: 9, prize: 2 },
];

export const ticketPrice = () => localMoney(LOTTERY_TICKET, country());

export function buyLotteryTickets(count) {
  const p = player();
  const c = country();
  const cost = ticketPrice() * count;
  if (!canGamble()) return result(false, 'You need to be 18.', 'neutral');
  if (!stake(cost)) return result(false, 'You cannot afford that many tickets.', 'neutral');
  let won = 0; let jackpot = false;
  for (let i = 0; i < count; i++) {
    for (const tier of PRIZES) {
      if (!rng.chance(1 / tier.odds)) continue;
      if (tier.jackpot) { jackpot = true; won += localMoney(rng.int(1, 8) * 1000000, c); } else won += localMoney(tier.prize, c);
      break;
    }
  }
  if (won) win(won);
  let text;
  if (jackpot) {
    text = `Every number. You check the ticket nine times. You have won the lottery: ${fmtMoney(won, c)}.`;
    milestone('Won the lottery jackpot.', 'money');
    p.stats.mood = clamp(p.stats.mood + 30);
  } else if (won > cost) text = `${count === 1 ? 'Your ticket' : `Your ${count} tickets`} won ${fmtMoney(won, c)}.`;
  else if (won) text = `You spent ${fmtMoney(cost, c)} on tickets and won back ${fmtMoney(won, c)}.`;
  else text = `You spent ${fmtMoney(cost, c)} on ${count === 1 ? 'a lottery ticket' : 'lottery tickets'}. Not a single number.`;
  log(text, 'system', won > cost ? 'good' : 'neutral');
  return result(won > cost, text, won > cost ? 'good' : 'neutral');
}

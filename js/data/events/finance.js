// Scenes about money. Each one starts from something that is really true of
// the life: a first wage, a sibling, a card, a marriage. What the player
// chooses moves real money through the money engines (the `money` effect:
// engine/moneyEffects.js). Bad offers and bank mistakes are rare, can always
// be walked away from, and describe nothing anyone could copy.
import { st, hid, cash, rel, ok, bad, any, chk, need, mem } from './helpers.js';

const money = (op, o = {}) => ({ type: 'money', op, ...o });
const learn = (value, why) => money('learn', { value, why });

/** @type {import('../../types.js').GameEvent[]} */
export default [
  {
    id: 'first_paycheck', category: 'money', ageRange: [14, 30], weight: 40, cooldown: 99, requires: [need('firstPayNow', '==', true)],
    text: 'Your first pay has arrived. It is not much, and it is the first money that was ever entirely yours. What will you do with it?',
    choices: [
      { label: 'Save most of it', outcomes: [any('You put most of it away and keep a little out. It feels like the beginning of something.', 'good', money('save', { share: 0.7 }), learn(4, 'firstpay'), hid('discipline', 3))] },
      { label: 'Buy something you have wanted', outcomes: [any('You have looked at it in the window for months. Now it is yours, and you paid for it.', 'good', money('spend', { share: 0.6, what: 'Something you had wanted for a long time' }), st('mood', 8))] },
      { label: 'Help with something at home', requires: [need('roles', 'has', 'parent')], outcomes: [any('You leave some of it on the kitchen table without a word. Nothing is said. The look says it.', 'good', money('spend', { share: 0.5, what: 'Help with the family\'s bills' }), hid('karma', 6), st('mood', 3))] },
      { label: 'Split it: some saved, some spent', outcomes: [any('Half away, half for now. Sensible, and still fun.', 'good', money('save', { share: 0.4 }), money('spend', { share: 0.3, what: 'A treat from your first pay' }), learn(3, 'firstpay'), st('mood', 4))] },
    ],
  },
  {
    id: 'sibling_needs_help', category: 'money', ageRange: [22, 80], cooldown: 14, cast: { sib: 'sibling' },
    castRequires: [need('cast.sib.age', '>=', 20), need('cast.sib.money', '<=', 40)], requires: [need('cashBase', '>=', 4000)],
    text: '{sib} rings late, and gets to the point slowly. It has been a hard year. Could you help with the rent, just until things turn?',
    choices: [
      { label: 'Give them the money ({$1500})', outcomes: [any('You send it that night and tell {sib} it is a gift, not a debt.', 'good', money('give', { target: 'sib', base: 1500 }), mem('sib', 'helped_rent', 'You paid my rent the year everything went wrong.'))] },
      { label: 'Lend it, to be paid back ({$1500})', outcomes: [any('You agree on three years, and write it down so that neither of you has to remember.', 'neutral', money('lend', { target: 'sib', base: 1500, years: 3 }))] },
      { label: 'Help another way', outcomes: [any('You spend a weekend going through job adverts and forms with {sib}. It is not money. It is not nothing.', 'good', rel('sib', 5), hid('karma', 2))] },
      { label: 'Say you cannot', outcomes: [any('"No, of course. Forget I asked." {sib} rings off quickly.', 'bad', rel('sib', -10))] },
    ],
  },
  {
    id: 'billing_mistake', category: 'money', ageRange: [19, 90], cooldown: 12, weight: 0.6, requires: [need('cashBase', '>=', 600)],
    text: 'Going through the month\'s payments, you see the same bill has been taken twice. The second one should not be there.',
    choices: [
      { label: 'Ring them and dispute it', check: chk(0.6, { moneySense: 0.6, 'stats.charm': 0.2 }), outcomes: [
        ok('Forty minutes on hold, one calm conversation, and it is corrected before the money has even left.', learn(3, 'dispute'), st('mood', 2)),
        bad('They agree it is their mistake and promise a refund "within ninety days". You will be chasing it for a while, and get most of it back.', cash(-80), learn(2, 'dispute'), st('mood', -3)),
      ] },
      { label: 'Ask your bank to look into it', outcomes: [any('The bank takes the details, reverses the second payment and tells you it happens more than you would think.', 'good', learn(2, 'bank'))] },
      { label: 'Let it go', outcomes: [any('It is not worth an afternoon, you decide. The money is gone.', 'neutral', cash(-240))] },
    ],
  },
  {
    id: 'too_good_offer', category: 'money', ageRange: [20, 90], cooldown: 15, weight: 0.5, requires: [need('cashBase', '>=', 3000)],
    text: 'Someone you half know is very excited about an investment. It cannot lose, the returns are guaranteed, and the chance closes on Friday. You would need to decide today.',
    choices: [
      { label: 'Say no', outcomes: [any('Nothing that is guaranteed needs to be decided by Friday. You wish them luck.', 'good', learn(2, 'offer'))] },
      { label: 'Ask your bank what they make of it', outcomes: [any('The woman at the bank listens to two sentences and shakes her head. "If it comes with a deadline and a promise, keep your money."', 'good', learn(5, 'offer'))] },
      { label: 'Put some in ({$1000})', check: chk(0.08, { moneySense: -0.2 }), outcomes: [
        ok('Against the odds you are paid back with a little on top, before it all goes quiet. You know how lucky that was.', cash(150), learn(3, 'offer')),
        bad('The first statement looks wonderful. There is no second statement, and the number no longer answers.', cash(-1000), st('mood', -8), learn(6, 'offer')),
      ] },
    ],
  },
  {
    id: 'card_alert', category: 'money', ageRange: [18, 90], cooldown: 12, weight: 0.6, requires: [need('hasCard', '==', true)],
    text: 'A message from your bank: two payments on your card that you do not recognise, in a town you have never been to. Was this you?',
    choices: [
      { label: 'Ring the bank on the number on the card', outcomes: [any('It was not you, and they had guessed as much. The payments are stopped, the card is replaced, and you owe nothing.', 'good', learn(3, 'cardfraud'))] },
      { label: 'Go through the statement first', outcomes: [any('You check every line, find the two that are not yours, and report them the same evening. Nothing is lost.', 'good', learn(4, 'cardfraud'))] },
      { label: 'Ignore it', outcomes: [any('It was real. By the time you look, more has gone. The bank refunds most of it, eventually, and not all.', 'bad', cash(-200), st('mood', -4), learn(2, 'cardfraud'))] },
    ],
  },
  {
    id: 'money_talk', category: 'money', ageRange: [20, 80], cooldown: 10, cast: { love: 'spouse' },
    text: 'It starts as a conversation about a holiday and turns into one about money. {love} thinks one of you spends too freely. You are fairly sure which one they mean.',
    choices: [
      { label: 'Sit down and go through it together', outcomes: [any('An hour with the figures on the table. It is less frightening written down, and you agree what matters to both of you.', 'good', rel('love', 6), learn(3, 'couple'))] },
      { label: 'Agree to keep your money separate', outcomes: [any('What is yours is yours, what is theirs is theirs, and the bills get paid. It suits you both, more or less.', 'neutral', rel('love', 1))] },
      { label: 'Tell them it is your money', outcomes: [any('It is. That is not what they were asking, and you both know it.', 'bad', rel('love', -9), st('mood', -3))] },
    ],
  },
  {
    id: 'retirement_thoughts', category: 'money', ageRange: [55, 66], cooldown: 99, requires: [need('employed', '==', true)],
    text: 'A colleague your own age is leaving at the end of the month. At the party someone asks, lightly, when it will be your turn. You find you do not know the answer.',
    choices: [
      { label: 'Go home and work out the figures', outcomes: [any('A pension, what you have saved, what a year costs. For the first time you know roughly where you stand. (My Money, Retirement, has the sums.)', 'good', learn(4, 'retire'), st('mood', 2))] },
      { label: 'Decide you will work as long as you can', outcomes: [any('You like the work, mostly. You will stop when it stops being true.', 'neutral', hid('willpower', 2))] },
      { label: 'Change the subject', outcomes: [any('"Not for years yet." You get another drink.', 'neutral')] },
    ],
  },
];

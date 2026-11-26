// Reproductive health scenes. Every one is queued by engine/health/contraception.js only when it is true of the life
// (a device nearing the end of its approved duration, a refill that ran out, a birth, a real exposure): nothing here is
// drawn by chance, no scene starts a pregnancy, and no partner decides anything about the player's body. Plain and
// non-graphic. A scene can book a consultation or note a preference; everything else is in My Health → Reproductive health.
import { any, need } from './helpers.js';

const r = (value) => ({ type: 'repro', value });
const scene = (id, ages, text, choices, o = {}) => ({ id, category: 'health', ageRange: ages, queuedOnly: true, text, ...o,
  choices: choices.map(([label, value, line, tone = 'neutral', requires]) => ({ label, ...(requires ? { requires } : {}), outcomes: [any(line, tone, r(value))] })) });

/** @type {import('../../types.js').GameEvent[]} */
export default [
  // A real exposure (a broken condom; or nothing used while not planning a pregnancy): asked at once, while it can help.
  scene('repro_ec', [18, 60], 'The next morning. {what} If you do not want a pregnancy, emergency contraception works best the sooner it is used. It prevents a pregnancy; it does not end one.', [
    ['A levonorgestrel emergency pill', 'ec:ec_lng', 'You get it the same day.', 'neutral', [need('repro.ec', 'has', 'ec_lng')]],
    ['An ulipristal emergency pill', 'ec:ec_upa', 'You get it the same day.', 'neutral', [need('repro.ec', 'has', 'ec_upa')]],
    ['A copper IUD, placed within five days', 'ec:ec_cu_iud', 'You book the first appointment there is.', 'neutral', [need('repro.ec', 'has', 'ec_cu_iud')]],
    ['Let it be', 'ec:none', 'You decide not to.'],
  ]),
  scene('repro_postpartum', [12, 60], 'A Postpartum Consultation. At the check-up after the birth, the midwife asks, without hurry, whether you have thought about contraception, and whether you are breastfeeding. Nothing has to be decided now.', [
    ['Talk through the options', 'consult:postpartum', 'You go through what suits the months after a birth.'],
    ['Mention you are breastfeeding', 'breastfeeding:yes', 'You say so.'],
    ['Not now', 'note', 'You say you will think about it.'],
  ]),
  scene('repro_expiring', [12, 70], 'A Method Is Nearing Expiration. A letter from the clinic: your device reaches the end of its approved duration in about six months. You can have it replaced, removed, or talk it over.', [
    ['Book a consultation', 'consult:expiring', 'You book a visit to talk it over.'],
    ['Leave it for now', 'note', 'You put the letter with the others. My Health has it too.'],
  ]),
  scene('repro_refill', [12, 70], 'A Prescription Refill. Your {method} ran out and the refill did not come through. Until it is sorted out, it is not protecting you.', [
    ['See a clinician about it', 'consult:refill', 'You book a visit.'],
    ['Leave it', 'note', 'You will deal with it later. My Health has the options.'],
  ]),
  scene('repro_side_effect', [12, 70], 'An Unexpected Side Effect. A few months on {method}, you notice {effect}. It is listed as something some people get; not everyone does.', [
    ['Ask a clinician about it', 'review', 'You book a review.'],
    ['Give it some time', 'note', 'Many effects settle in the first months. You keep an eye on it.'],
  ]),
  scene('repro_considering', [18, 45], 'Considering Birth Control. With a partner and a life that is busy enough already, you find yourself wondering what you would actually want to use, if anything.', [
    ['Book a consultation', 'consult:options', 'You book a visit to go through the options.'],
    ['Not planning a pregnancy, for now', 'plan:not', 'You make a note of where you stand.'],
    ['Open to whatever happens', 'plan:open', 'You decide not to plan either way.'],
  ]),
  scene('repro_discuss_children', [25, 42], 'Discussing Future Children. Over a slow breakfast, {love} asks what you think about children: whether, and when.', [
    ['Talk it through properly', 'talk', 'You talk for a long time.'],
    ['Say you are not sure yet', 'plan:unsure', 'You say it honestly.'],
    ['Say you are thinking about it', 'plan:considering', 'You say you have been thinking about it.'],
  ], { cast: { love: 'partner' } }),
  scene('repro_permanent', [35, 60], 'Considering Permanent Contraception. Your family feels complete. A friend mentions a sterilization procedure; you wonder about it, and about the long-acting reversible options too.', [
    ['Ask a clinician about the options', 'consult:permanent', 'You book a counseling visit.'],
    ['Not for me', 'note', 'You put the thought away.'],
  ]),
  scene('repro_followup', [18, 60], 'A Routine Follow-Up. You have been on {method} for a while now. A routine check is a chance to ask whether it still suits you.', [
    ['Book a routine review', 'review', 'You book a review.'],
    ['It suits me; skip it', 'note', 'You carry on as you are.'],
  ]),
  scene('repro_insurance', [18, 65], 'A Health Insurance Change. Your health cover has changed. Your prescription carries on, but what it costs you may not be the same.', [
    ['Check the options', 'consult:insurance', 'You book a visit to go over it.'],
    ['Carry on', 'note', 'You will see what the next refill costs.'],
  ]),
  scene('repro_new_provider', [12, 70], 'A New Healthcare Provider. The clinician who looked after your contraception has moved on. A new one will see you from now on; your record goes with you.', [
    ['Book an introduction', 'consult:new', 'You book a first visit with them.'],
    ['Fine', 'note', 'You carry on.'],
  ]),
  scene('repro_access_change', [12, 70], 'Your method is not available where you now live, under this country\'s rules. A clinician here can go through what is.', [
    ['Book a consultation', 'consult:access', 'You book a visit.'],
    ['Later', 'note', 'You will look into it.'],
  ]),
];

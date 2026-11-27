// The turning points at 13, 18 and 45 (engine/lifeStages.js): who are you becoming? The three traits offered are the
// ones that fit how the last years were lived; the engine fills in their names ({t0}..{t2}) and what they mean.
import { any } from './helpers.js';

const stage = (value) => ({ type: 'stage', value });
const pick = (i) => ({ label: `{t${i}}: {d${i}}`, outcomes: [any('That is who you are becoming.', 'good', stage(String(i)))] });
const swap = (i) => ({ label: `{t${i}}, and less {drop}`, outcomes: [any('People change. You have.', 'good', stage(String(i)))] });
const none = { label: 'None of these, really', outcomes: [any('You are still working it out. That is allowed.', 'neutral', stage('none'))] };
const base = { category: 'life', ageRange: [13, 45], weight: 0, queuedOnly: true, castGiven: true, cast: {} };

/** @type {import('../../types.js').GameEvent[]} */
export default [
  { ...base, id: 'life_stage', text: '{stage} Who are you becoming?', choices: [pick(0), pick(1), pick(2), none] },
  { ...base, id: 'life_stage_drop', text: '{stage} Who are you becoming, and what are you leaving behind?',
    choices: [pick(0), pick(1), pick(2), { label: 'Grow out of being {drop}', outcomes: [any('It does not fit you the way it did.', 'neutral', stage('drop'))] }, none] },
  // Already a lot of things (five traits): taking one on means letting another go.
  { ...base, id: 'life_stage_full', text: '{stage} You are already a lot of things. Something new would mean leaving something behind.',
    choices: [swap(0), swap(1), swap(2), { label: 'Stay as you are', outcomes: [any('You know who you are.', 'neutral', stage('none'))] }] },
];

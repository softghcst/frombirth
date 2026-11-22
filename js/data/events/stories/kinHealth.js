// News about the health of someone close (engine/health/story.js sends it): a diagnosis they have chosen to share, or an
// ordinary illness that has them in bed for a week. Shown as a notice, with their face. {who} is the person.
import { any, rel, st } from '../helpers.js';

const notice = (id, emoji, title, text, choices) => ({ id, category: 'Family', ageRange: [3, 120], queuedOnly: true, notice: { who: 'who', emoji, title }, text,
  choices: choices.map(([label, outcomes]) => ({ label, outcomes })) });

export default [
  notice('kin_diagnosed', '{emoji}', '{title}', 'Your {role} has had news from the doctor: {cond}.', [
    ['Be there for them', [any('You go round, and sit with {who}, and talk about everything else for a while. It helps.', 'good', rel('who', 5), st('mood', -1))]],
    ['Give them space', [any('You will call {who} soon.', 'neutral', st('mood', -2))]],
  ]),
  notice('kin_ailment', '{emoji}', '{title}', 'Your {role} is laid up with {ailment}.', [
    ['Bring them something warm', [any('You look in on {who} with something warm. They are grateful.', 'good', rel('who', 3))]],
    ['Wish them better', [any('{who} will be fine in a few days.', 'neutral')]],
  ]),
];

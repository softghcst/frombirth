// The scenes for data/familyStories.js, one each. Queued by engine/familyStories.js when true, never drawn.
import { any, need } from '../helpers.js';
import { FAMILY } from '../../familyStories.js';

/** The tag on each story, by what it is about. */
const categoryOf = (id) => (/^(friend_|old_friend|truth_friend)/.test(id) ? 'friends' : /^teen_/.test(id) ? 'teen'
  : /^(marriage_|long_marriage|tradition|retirement_plans)/.test(id) ? 'marriage' : /^(secret_encounter|secret_public|secret_stayed|secret_clean_break|truth_trust|after_loss_new|ex_died)/.test(id) ? 'love'
  : /^(widowed_year)/.test(id) ? 'loss' : 'family');

export default FAMILY.map((s) => ({ id: `fam_${s.id}`, category: categoryOf(s.id), ageRange: s.ages, queuedOnly: true, text: s.text,
  // A choice that costs money is greyed out when it cannot be paid for: its outcome says it happened.
  choices: s.choices.map(([label, line, fx], i) => ({ label, ...(fx?.cost ? { requires: [need('cashBase', '>=', fx.cost)] } : {}),
    outcomes: [any(line, 'neutral', { type: 'love', value: `${s.id}:${i}` })] })) }));

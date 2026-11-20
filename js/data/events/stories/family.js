// The scenes for data/familyStories.js, one each. Queued by engine/familyStories.js when true, never drawn.
import { any } from '../helpers.js';
import { FAMILY } from '../../familyStories.js';

export default FAMILY.map((s) => ({ id: `fam_${s.id}`, category: 'marriage', ageRange: s.ages, queuedOnly: true, text: s.text,
  choices: s.choices.map(([label, line], i) => ({ label, outcomes: [any(line, 'neutral', { type: 'love', value: `${s.id}:${i}` })] })) }));

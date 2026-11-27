// Life goals (engine/goals.js): one at a time, chosen from 16, with four milestones each, all read from what the game
// already keeps (a marriage, children, what you are worth, the countries you have seen, a career's rank). Finishing one
// earns its reward: a small, lasting edge of the same kind traits give (data/traits.js effects), which does not count
// toward a person's five traits.
//
//   steps   [text, check, n]: check is a name in engine/goals.js CHECKS; n its threshold, where it has one
//   fields  career goals: the careers that count (data/careers.js ids)

/** The age goals open. */
export const GOAL_AGE = 16;

const MED = ['doctor', 'surgery', 'psychiatry', 'podiatrist', 'dentist'];
const LAW = ['lawyer', 'prosecutor', 'defender', 'gov_counsel', 'attorney_general', 'us_attorney', 'solicitor_general', 'judiciary', 'paralegal'];
const POLICE = ['police', 'detective', 'fbi_agent', 'dea_agent', 'atf_agent', 'usms_deputy', 'usss_agent', 'hsi_agent', 'irs_agent'];
const BUSINESS = ['corporate', 'board', 'consulting', 'banker', 'eng_mgmt', 'project_mgmt', 'sales', 'marketing'];
const MUSIC = ['singer', 'mt_performer', 'orchestra', 'music_prod'];
const WORDS = ['author', 'journalist', 'screenwriting', 'publishing', 'editorial', 'copywriting'];
const ACADEMIA = ['academic', 'research_asst', 'scientist', 'biology', 'physics', 'chemistry', 'astronomy'];

export const GOALS = [
  // ---------- A life ----------
  { id: 'big_family', group: 'life', name: 'Big Happy Family', icon: '👨‍👩‍👧‍👦', blurb: 'A home full of people who are yours.',
    steps: [['Marry', 'married'], ['Have a child', 'children', 1], ['Raise three children', 'children', 3], ['Hold a grandchild', 'grandchildren', 1]],
    reward: { id: 'provider', name: 'Provider', desc: 'Family stays close to you, whatever the years bring.', effects: { familyDecayK: 0.85 } } },
  { id: 'fortune', group: 'life', name: 'Self-Made Fortune', icon: '💰', blurb: 'Money of your own, and then a great deal of it.',
    steps: [['Worth 50,000', 'worth', 50000], ['Worth 250,000', 'worth', 250000], ['Worth a million', 'worth', 1000000], ['Worth five million', 'worth', 5000000]],
    reward: { id: 'shrewd', name: 'Shrewd', desc: 'Knows what things are worth. Living costs a little less.', effects: { costK: 0.96 } } },
  { id: 'master', group: 'life', name: 'Master of a Craft', icon: '🎯', blurb: 'One thing, done better than almost anyone.',
    steps: [['Reach 25 in a skill', 'skill', 25], ['Reach 50', 'skill', 50], ['Reach 75', 'skill', 75], ['Master it: 100', 'skill', 100]],
    reward: { id: 'virtuoso', name: 'Virtuoso', desc: 'Picks up any art or craft a little faster.', effects: { creativeK: 1.1, gardenK: 1.1 } } },
  { id: 'world', group: 'life', name: 'See the World', icon: '🌍', blurb: 'Every place you can get to, and one to call home.',
    steps: [['Visit 3 countries', 'countries', 3], ['Visit 10', 'countries', 10], ['Live abroad', 'livedAbroad'], ['Visit 25', 'countries', 25]],
    reward: { id: 'worldly', name: 'Worldly', desc: 'At home anywhere. A trip lifts you a little more.', effects: { tripMood: 1 } } },
  { id: 'scholar', group: 'life', name: 'The Scholar', icon: '🎓', blurb: 'Learning for as long as there is more to learn.',
    steps: [['Finish university', 'degree', 'university'], ['A graduate degree', 'degree', 'graduate'], ['A doctorate', 'degree', 'doctorate'], ['Teach at a university', 'field', ['academic']]],
    reward: { id: 'learned', name: 'Learned', desc: 'Every subject comes a little easier.', effects: { creativeK: 1.05 }, stats: { intellect: 5 } } },
  { id: 'community', group: 'life', name: 'Pillar of the Community', icon: '🤝', blurb: 'The person people turn to.',
    steps: [['Give to charity', 'donated', 1000], ['Be known for kindness', 'karma', 75], ['Give generously', 'donated', 50000], ['Hold local office', 'office', 1]],
    reward: { id: 'beloved', name: 'Beloved', desc: 'Friends and neighbors stay close.', effects: { friendDecayK: 0.85 } } },
  { id: 'family_heart', group: 'life', name: 'Heart of the Family', icon: '🧺', blurb: 'The one who keeps everyone together.',
    steps: [['Host a family tradition', 'hostTradition'], ['Keep a tradition 5 years', 'tradition', 5], ['Keep two traditions going', 'traditions', 2], ['Keep a tradition 15 years', 'tradition', 15]],
    reward: { id: 'keeper', name: 'Keeper of the Flame', desc: 'Family stays close, and a full house lifts you.', effects: { familyDecayK: 0.9, kidsMood: 1 } } },
  { id: 'entrepreneur', group: 'life', name: 'Entrepreneur', icon: '🏪', blurb: 'Something of your own, with your name on the door.',
    steps: [['Start a business', 'businesses', 1], ['Run two at once', 'businesses', 2], ['Worth a million', 'worth', 1000000], ['Run three at once', 'businesses', 3]],
    reward: { id: 'dealmaker', name: 'Dealmaker', desc: 'Sharper at work, and living costs a little less.', effects: { workPerf: 1, costK: 0.98 } } },
  { id: 'famous', group: 'life', name: 'Famous', icon: '⭐', blurb: 'A name people know.',
    steps: [['Known locally', 'fame', 25], ['Known across the country', 'fame', 50], ['A household name', 'fame', 75], ['World famous', 'fame', 90]],
    reward: { id: 'magnetic', name: 'Magnetic', desc: 'People want to be near you. More invitations.', effects: { invites: 1 } } },
  // ---------- A career ----------
  { id: 'chief_medicine', group: 'career', name: 'Chief of Medicine', icon: '🩺', blurb: 'From medical school to running the department.',
    steps: [['Work as a doctor', 'field', MED], ['Be promoted', 'rank', [MED, 1]], ['Reach senior rank', 'rank', [MED, 2]], ['Reach the top', 'top', MED]],
    reward: { id: 'steady_hands', name: 'Steady Hands', desc: 'Calm under pressure: less stress at work.', effects: { stressK: 0.9 } } },
  { id: 'judge', group: 'career', name: 'The Bench', icon: '⚖️', blurb: 'From law school to the judge\'s chair.',
    steps: [['Finish law school', 'degree', 'law'], ['Practice law', 'field', LAW], ['Be promoted in law', 'rank', [LAW, 1]], ['Become a judge', 'field', ['judiciary']]],
    reward: { id: 'judicious', name: 'Judicious', desc: 'Weighs things well: arguments go less badly.', effects: { argueK: 0.85 } } },
  { id: 'top_cop', group: 'career', name: 'Top Cop', icon: '🚓', blurb: 'From the academy to running the force.',
    steps: [['Join the police or an agency', 'field', POLICE], ['Make detective, or be promoted', 'rank', [POLICE, 1]], ['Reach senior rank', 'rank', [POLICE, 2]], ['Reach the top', 'top', POLICE]],
    reward: { id: 'unshakable', name: 'Unshakable', desc: 'Hard to rattle: less stress at work.', effects: { stressK: 0.9 } } },
  { id: 'corner_office', group: 'career', name: 'Corner Office', icon: '🏢', blurb: 'From the first job to the top floor.',
    steps: [['Work in business', 'field', BUSINESS], ['Be promoted twice', 'promotions', 2], ['Reach senior rank', 'rank', [BUSINESS, 3]], ['Reach the top', 'top', BUSINESS]],
    reward: { id: 'executive', name: 'Executive Presence', desc: 'Sharper at work.', effects: { workPerf: 2 } } },
  { id: 'elected', group: 'career', name: 'Elected Leader', icon: '🏛️', blurb: 'From the town council to leading the country.',
    steps: [['Win local office', 'office', 1], ['Become mayor', 'office', 2], ['Win a national seat', 'office', 3], ['Lead the country', 'office', 5]],
    reward: { id: 'statesman', name: 'Statesman', desc: 'People listen. Friends stay close.', effects: { friendDecayK: 0.9, invites: 1 } } },
  { id: 'headliner', group: 'career', name: 'Headliner', icon: '🎤', blurb: 'From the first gig to the top of the bill.',
    steps: [['Work in music', 'field', MUSIC], ['Known locally', 'fame', 25], ['A household name', 'fame', 60], ['Reach the top', 'fame', 85]],
    reward: { id: 'showstopper', name: 'Showstopper', desc: 'Music and the stage come a little faster.', effects: { creativeK: 1.1 } } },
  { id: 'champion', group: 'career', name: 'Champion', icon: '🏆', blurb: 'From the local club to the top of the sport.',
    steps: [['Play a sport seriously', 'sportLevel', 1], ['Turn professional', 'sportLevel', 2], ['Win an award or a title', 'awards', 1], ['Win three', 'awards', 3]],
    reward: { id: 'competitor', name: 'Competitor', desc: 'Built for it: healthier, and sharper at work.', effects: { workPerf: 1 }, stats: { health: 4 } } },
  { id: 'bestseller', group: 'career', name: 'Bestseller', icon: '📚', blurb: 'From the first page to the top of the list.',
    steps: [['Write for a living', 'field', WORDS], ['Be promoted', 'rank', [WORDS, 1]], ['Known across the country', 'fame', 40], ['Reach the top', 'top', WORDS]],
    reward: { id: 'wordsmith', name: 'Wordsmith', desc: 'Writing and the arts come a little faster.', effects: { creativeK: 1.1 } } },
  { id: 'professor', group: 'career', name: 'Professor', icon: '🔬', blurb: 'From the lab bench to a chair of your own.',
    steps: [['A doctorate', 'degree', 'doctorate'], ['Work in research or teaching', 'field', ACADEMIA], ['Be promoted', 'rank', [ACADEMIA, 1]], ['Reach the top', 'top', ACADEMIA]],
    reward: { id: 'eminent', name: 'Eminent', desc: 'Respected in the field. Sharper at work.', effects: { workPerf: 1 }, stats: { intellect: 3 } } },
  // ---------- Love ----------
  { id: 'soulmate', group: 'romance', name: 'Soulmate', icon: '💞', blurb: 'One person, for good.',
    steps: [['Fall in love', 'partnered'], ['Marry', 'married'], ['Ten years married', 'marriedYears', 10], ['Twenty-five years', 'marriedYears', 25]],
    reward: { id: 'devoted', name: 'Devoted', desc: 'A partner stays close, whatever the years bring.', effects: { partnerDecayK: 0.8 } } },
  { id: 'golden', group: 'romance', name: 'Golden Anniversary', icon: '💍', blurb: 'Fifty years with the same person.',
    steps: [['Marry', 'married'], ['Ten years married', 'marriedYears', 10], ['Twenty-five years', 'marriedYears', 25], ['Fifty years', 'marriedYears', 50]],
    reward: { id: 'timeless', name: 'Timeless', desc: 'Love that lasts. A partner stays close, and so does family.', effects: { partnerDecayK: 0.8, familyDecayK: 0.9 } } },
  { id: 'heartbreaker', group: 'romance', name: 'Heartbreaker', icon: '💔', blurb: 'Many loves, and no regrets.',
    steps: [['Three romances', 'romances', 3], ['Six romances', 'romances', 6], ['Ten romances', 'romances', 10], ['Still free at 40', 'singleAt', 40]],
    reward: { id: 'charmer', name: 'Charmer', desc: 'Dates go better.', effects: { dateK: 1.15 } } },
  { id: 'second_chance', group: 'romance', name: 'Second Chance', icon: '🌱', blurb: 'Love again, after a loss or an ending.',
    steps: [['Come through a divorce or a loss', 'loveEnded'], ['Fall in love again', 'loveAgain'], ['Marry again', 'remarried'], ['Five years in the new marriage', 'marriedYears', 5]],
    reward: { id: 'resilient', name: 'Resilient', desc: 'Bounces back: less stress, a steadier mood.', effects: { stressK: 0.95, yearMood: 1 } } },
];
export const GOAL_BY_ID = Object.fromEntries(GOALS.map((g) => [g.id, g]));
/** Rewards, by id: read alongside traits (engine/traits.js), never counted among them. */
export const BADGE_BY_ID = Object.fromEntries(GOALS.map((g) => [g.reward.id, g.reward]));
export const GOAL_GROUPS = [['life', 'A life'], ['career', 'A career'], ['romance', 'Love']];

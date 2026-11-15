// Epitaphs: the titles a finished life can earn. Every life gets at least
// one. The first one earned in this list is carved on the stone; the rest
// are listed beneath it. Order matters: rarest and most defining first.
//
// `earned` receives a summary of the life (see lifeSummary in engine/death.js):
//   age, worth (base units), donated, gambled, fame, karma, crimes, kills,
//   convictions, yearsJailed, escapes, diedInside, spouses, exes, marriedYears,
//   children, descendants, everMarried, jobsHeld, reachedTop, stageStar,
//   healerYears, degrees (array of types), intellect, followers, countries,
//   leftToCharity (base units)

export const EPITAPHS = [
  { id: 'brief_candle', title: 'A Brief Candle', line: 'Gone before the story had properly begun.',
    hint: 'Die before turning 18.', earned: (s) => s.age < 18 },
  { id: 'household_name', title: 'Household Name', line: 'Strangers wept. Newspapers cleared the front page.',
    hint: 'Become truly famous.', earned: (s) => s.fame >= 80 },
  { id: 'tycoon', title: 'The Tycoon', line: 'Left behind more money than most towns ever see.',
    hint: 'Die worth ten million or more.', earned: (s) => s.worth >= 10000000 },
  { id: 'villain', title: 'The Villain', line: 'Feared in life. Not much missed.',
    hint: 'Take a life, or lose every scrap of your good name.', earned: (s) => s.kills >= 1 || (s.karma <= 10 && s.crimes >= 5) },
  { id: 'over_the_wall', title: 'Over the Wall', line: 'No cell ever held them for long.',
    hint: 'Escape from prison.', earned: (s) => s.escapes >= 1 },
  { id: 'star_of_the_stage', title: 'Star of the Stage', line: 'The lights dimmed on every marquee for a night.',
    hint: 'Reach the top as a performer.', earned: (s) => s.stageStar },
  { id: 'benefactor', title: 'The Benefactor', line: 'Gave away a fortune, and never mentioned it.',
    hint: 'Give a great deal to charity, in life or in your will.', earned: (s) => s.donated + s.leftToCharity >= 100000 },
  { id: 'behind_the_wall', title: 'Behind the Wall', line: 'Spent the best years counting them.',
    hint: 'Serve fifteen years, or die inside.', earned: (s) => s.yearsJailed >= 15 || s.diedInside },
  { id: 'the_outlaw', title: 'The Outlaw', line: 'Wanted for a great deal. Convicted of nothing.',
    hint: 'Commit ten crimes without a single conviction.', earned: (s) => s.crimes >= 10 && s.convictions === 0 },
  { id: 'seen_by_millions', title: 'Seen by Millions', line: 'A million people followed along, right to the end.',
    hint: 'Reach a million real followers.', earned: (s) => s.followers >= 1000000 },
  { id: 'the_long_road', title: 'The Long Road', line: 'Saw a full century, and remembered most of it.',
    hint: 'Live to 100.', earned: (s) => s.age >= 100 },
  { id: 'the_healer', title: 'The Healer', line: 'Half the town owed them a favour, or a life.',
    hint: 'Spend fifteen years in medicine.', earned: (s) => s.healerYears >= 15 },
  { id: 'the_scholar', title: 'The Scholar', line: 'Never stopped asking why.',
    hint: 'Earn an advanced degree with a first-rate mind.',
    earned: (s) => s.intellect >= 85 && ['graduate', 'medical', 'law'].some((d) => s.degrees.includes(d)) },
  { id: 'top_of_the_ladder', title: 'Top of the Ladder', line: 'Started at the bottom and ran out of rungs.',
    hint: 'Reach the highest level of a career.', earned: (s) => s.reachedTop },
  { id: 'devoted', title: 'Devoted', line: 'One marriage. It was enough.',
    hint: 'Stay married to one person for thirty years.', earned: (s) => s.spouses === 1 && s.marriedYears >= 30 },
  { id: 'head_of_the_table', title: 'Head of the Table', line: 'It took three tables pushed together to seat them all.',
    hint: 'Raise four children, or see eight descendants.', earned: (s) => s.children >= 4 || s.descendants >= 8 },
  { id: 'the_heartbreaker', title: 'The Heartbreaker', line: 'Loved often, and never for very long.',
    hint: 'Marry three times, or leave six exes behind.', earned: (s) => s.spouses >= 3 || s.exes >= 6 },
  { id: 'the_wanderer', title: 'The Wanderer', line: 'Home was wherever the suitcase was.',
    hint: 'Live in three countries.', earned: (s) => s.countries >= 3 },
  { id: 'the_high_roller', title: 'The High Roller', line: 'Always sure the next hand was the one.',
    hint: 'Stake a quarter of a million in a lifetime.', earned: (s) => s.gambled >= 250000 },
  { id: 'jack_of_all_trades', title: 'Jack of All Trades', line: 'Could do a little of everything, and did.',
    hint: 'Hold eight different jobs.', earned: (s) => s.jobsHeld >= 8 },
  { id: 'a_good_soul', title: 'A Good Soul', line: 'Nobody could find a bad word to say.',
    hint: 'Live kindly, and never break the law.', earned: (s) => s.karma >= 85 && s.crimes === 0 && s.age >= 30 },
  { id: 'empty_pockets', title: 'Empty Pockets', line: 'Left the world exactly as they entered it: owning nothing.',
    hint: 'Die past 30 with nothing to your name.', earned: (s) => s.age >= 30 && s.worth <= 0 },
  { id: 'a_solitary_path', title: 'A Solitary Path', line: 'Walked alone, by choice or by chance.',
    hint: 'Reach 50 without marrying or having children.', earned: (s) => s.age >= 50 && !s.everMarried && s.children === 0 },
  { id: 'a_quiet_life', title: 'A Quiet Life', line: 'No headlines. No regrets worth the name.',
    hint: 'Live an ordinary life.', earned: () => true },
];

export const EPITAPH_BY_ID = Object.fromEntries(EPITAPHS.map((e) => [e.id, e]));

/** Estates below this (base units) pass to the family untaxed. */
export const ESTATE_ALLOWANCE = 100000;

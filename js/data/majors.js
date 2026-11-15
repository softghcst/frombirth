// University majors. difficulty lowers yearly GPA; minGpa is the high-school
// GPA needed to be considered; yearly gains apply each year of study.
// tracks: postgraduate routes the degree opens beyond plain graduate school.
const M = (id, name, difficulty, minGpa, yearly, tracks = []) => ({ id, name, difficulty, minGpa, yearly, tracks });

export const MAJORS = [
  M('computer_science', 'Computer Science', 0.45, 2.8, { stats: { intellect: 2 } }),
  M('engineering', 'Engineering', 0.55, 3.0, { stats: { intellect: 2 }, hidden: { discipline: 1 } }),
  M('mathematics', 'Mathematics', 0.55, 3.0, { stats: { intellect: 3 } }),
  M('finance', 'Finance', 0.35, 2.6, { stats: { intellect: 1 } }, ['law']),
  M('business', 'Business', 0.2, 2.2, { stats: { charm: 1 } }, ['law']),
  M('biology', 'Biology', 0.45, 2.8, { stats: { intellect: 2 } }, ['medical']),
  M('chemistry', 'Chemistry', 0.5, 2.9, { stats: { intellect: 2 } }, ['medical']),
  M('nursing', 'Nursing', 0.35, 2.6, { stats: { intellect: 1 }, hidden: { karma: 2 } }, ['medical']),
  M('psychology', 'Psychology', 0.25, 2.4, { stats: { intellect: 1, charm: 1 } }, ['medical']),
  M('criminal_justice', 'Criminal Justice', 0.2, 2.2, { hidden: { discipline: 2 } }, ['law']),
  M('political_science', 'Political Science', 0.25, 2.4, { stats: { charm: 1, intellect: 1 } }, ['law']),
  M('history', 'History', 0.25, 2.3, { stats: { intellect: 1 } }, ['law']),
  M('english', 'English Literature', 0.2, 2.3, { stats: { intellect: 1 } }, ['law']),
  M('education', 'Education', 0.15, 2.2, { hidden: { karma: 2 }, stats: { charm: 1 } }),
  M('communications', 'Communications', 0.1, 2.0, { stats: { charm: 2 } }),
  M('art', 'Fine Art', 0.1, 2.0, { stats: { mood: 2 } }),
  M('music', 'Music', 0.2, 2.0, { talents: { music: 5 } }),
  M('theatre', 'Theatre', 0.15, 2.0, { talents: { acting: 5 }, stats: { charm: 1 } }),
];

export const MAJOR_BY_ID = Object.fromEntries(MAJORS.map((m) => [m.id, m]));

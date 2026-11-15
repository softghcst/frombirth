// Data for the lives other people lead: ambitions, hobbies and the things
// that happen to them. Edit freely; npcLives.js reads all of it.

/**
 * Ambitions. `fits` weights how likely a person is to hold one (0 = never).
 * kind 'measured' ambitions are judged from the person's actual life (see
 * MEASURES in npcLives.js); kind 'slow' ambitions advance a little every year.
 */
export const ASPIRATIONS = [
  { id: 'career_top', text: 'reach the top of their profession', kind: 'measured', fits: (n) => 2 + n.meters.intellect / 40 },
  { id: 'own_home', text: 'own a home of their own', kind: 'measured', fits: () => 2 },
  { id: 'family', text: 'raise a family', kind: 'measured', fits: () => 2.5 },
  { id: 'degree', text: 'earn a degree', kind: 'measured', fits: (n) => (n.life.edu.degrees.includes('university') ? 0 : 1.5) },
  { id: 'stage', text: 'perform professionally', kind: 'measured',
    fits: (n) => (Math.max(n.talents?.singing ?? 0, n.talents?.acting ?? 0, n.talents?.dance ?? 0) >= 60 ? 4 : 0) },
  { id: 'business', text: 'run a business of their own', kind: 'slow', fits: (n) => 1 + n.meters.money / 60 },
  { id: 'book', text: 'write a book', kind: 'slow', fits: (n) => (n.meters.intellect >= 60 ? 1.5 : 0.2) },
  { id: 'travel', text: 'see the world', kind: 'slow', fits: () => 1.5 },
  { id: 'marathon', text: 'run a marathon', kind: 'slow', fits: (n) => (n.meters.health >= 65 ? 1.2 : 0.2) },
  { id: 'give_back', text: 'do work that helps people', kind: 'slow', fits: (n) => 0.5 + n.meters.generosity / 50 },
];

/** Childhood interests, keyed by the talent they grow. */
export const HOBBIES = {
  music: ['took up the piano', 'started learning the guitar', 'joined the school orchestra'],
  sports: ['joined a football team', 'started swimming competitively', 'took up athletics'],
  acting: ['joined a youth theatre', 'got a part in the school play'],
  singing: ['joined a choir', 'started singing lessons'],
  dance: ['started dance classes', 'joined a dance troupe'],
};

/**
 * Things that happen in a young person's school years. `when` gates it;
 * effects are applied to the person's meters.
 */
export const SCHOOL_MOMENTS = [
  { text: 'won a prize at school', when: (n) => n.meters.intellect >= 65, meters: { intellect: 2 } },
  { text: 'made the school team', when: (n) => (n.talents?.sports ?? 0) >= 60, meters: { health: 2 } },
  { text: 'got into a fight at school', when: (n) => n.meters.crazy >= 55, meters: { crazy: 2 } },
  { text: 'was suspended for a week', when: (n) => n.meters.crazy >= 70, meters: {} },
  { text: 'made a best friend', when: () => true, meters: { charm: 1 } },
  { text: 'had their heart broken for the first time', when: (n) => n.age >= 14, meters: {} },
  { text: 'failed an important exam and took it hard', when: (n) => n.meters.intellect <= 45, meters: {} },
  { text: 'passed their driving test', when: (n) => n.age >= 17, meters: {} },
  { text: 'spent the summer working their first job', when: (n) => n.age >= 15, meters: { money: 2 } },
];

/** Things that happen to adults. chance is per year. `trouble` ones may ask you for help. */
export const ADULT_MOMENTS = [
  { text: 'moved to a new flat', chance: 0.05 },
  { text: 'took up running', chance: 0.02, meters: { health: 4 } },
  { text: 'was seriously ill, and recovered', chance: 0.012, meters: { health: -12 } },
  { text: 'won an award at work', chance: 0.02, when: (n) => !!n.life.job, meters: { intellect: 1 } },
  { text: 'got into serious debt', chance: 0.012, when: (n) => n.meters.crazy >= 50, trouble: 'debt', savings: -0.6 },
  { text: 'was arrested after a night out', chance: 0.008, when: (n) => n.meters.crazy >= 60 && n.age < 40, trouble: 'arrest' },
  { text: 'went back to studying in the evenings', chance: 0.012, when: (n) => n.age >= 28, meters: { intellect: 3 } },
  { text: 'spent a year travelling', chance: 0.012, when: (n) => n.age <= 35 && !n.life.kids, meters: { charm: 2 } },
  { text: 'adopted a dog', chance: 0.02 },
];

/** Limits that keep the People list readable. */
export const MAX_KIDS = { child: 3, grandchild: 2, sibling: 2 };
export const MAX_PEOPLE = 70;

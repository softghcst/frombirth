// Psychotherapies, skills groups, allied-health therapies and support groups.
//
// kind tells apart things that are not interchangeable:
//   'therapy'  professionally delivered treatment, individual or group
//   'allied'   occupational, speech and language, physiotherapy, rehabilitation
//   'peer'     peer support: people with shared experience, no clinician leads it
//   'education' learning about a condition (psychoeducation, pain-management courses)
//
// `for` lists the conditions a modality is offered for. A modality can still be
// chosen for a support need with no diagnosis behind it where `open` is set.
// `from` is when it existed as a defined approach (first manual or trial).
// sessions: a usual course in weeks, as game tuning (NICE describes typical
// courses, e.g. 16–20 sessions of CBT for more severe depression; standard DBT
// runs for about a year). cost is per session, in base money units.

/** The four DBT skills modules (Linehan, DBT Skills Training Manual, 2nd ed., 2015). */
export const DBT_MODULES = [
  { id: 'mindfulness', name: 'Mindfulness', blurb: 'Noticing what is happening, inside and around you, as it happens.',
    skills: ['Observe', 'Describe', 'Participate', 'One thing at a time', 'Wise mind'] },
  { id: 'distress', name: 'Distress tolerance', blurb: 'Getting through a painful moment without making it worse.',
    skills: ['STOP', 'TIPP', 'Self-soothe', 'Pros and cons', 'Radical acceptance'] },
  { id: 'regulation', name: 'Emotion regulation', blurb: 'Understanding a feeling, naming it, and changing what you can.',
    skills: ['Check the facts', 'Opposite action', 'Building positive experiences', 'PLEASE (looking after the body)'] },
  { id: 'interpersonal', name: 'Interpersonal effectiveness', blurb: 'Asking for what you need, saying no, and keeping your self-respect.',
    skills: ['DEAR MAN', 'GIVE', 'FAST'] },
];
export const MODULE_BY_ID = Object.fromEntries(DBT_MODULES.map((m) => [m.id, m]));

/**
 * A standard skills-group cycle: each module is taught after two weeks of
 * mindfulness (about 24 weeks; a full programme usually runs the cycle twice).
 */
export const DBT_CYCLE = [
  ['mindfulness', 2], ['distress', 6], ['mindfulness', 2], ['regulation', 6], ['mindfulness', 2], ['interpersonal', 6],
];

export const THERAPIES = [
  // ---------- Psychotherapy ----------
  { id: 'cbt', name: 'Cognitive behavioural therapy', short: 'CBT', kind: 'therapy', format: 'individual',
    for: ['mdd', 'pdd', 'gad', 'social_anxiety', 'panic', 'agoraphobia', 'ocd', 'bipolar_1', 'bipolar_2', 'adhd', 'ptsd'],
    by: ['psychologist', 'therapist', 'psychiatrist', 'psychiatric_nurse'], from: 1979, minAge: 8, sessions: 16, cost: 110,
    builds: ['coping'], blurb: 'Weekly sessions working on the links between thoughts, feelings and what you do, with practice in between.',
    sources: ['NICE NG222', 'NICE CG113'] },
  { id: 'behavioural_activation', name: 'Behavioural activation', short: 'BA', kind: 'therapy', format: 'individual',
    for: ['mdd'], by: ['psychologist', 'therapist', 'psychiatric_nurse'], from: 1996, minAge: 16, sessions: 12, cost: 100,
    builds: ['coping'], blurb: 'Gradually bringing back the activities that matter to you.', sources: ['NICE NG222'] },
  { id: 'ipt', name: 'Interpersonal psychotherapy', short: 'IPT', kind: 'therapy', format: 'individual',
    for: ['mdd', 'pdd', 'bulimia'], by: ['psychologist', 'therapist', 'psychiatrist'], from: 1984, minAge: 12, sessions: 16, cost: 110,
    builds: ['interpersonal'], blurb: 'Working on the relationships and life changes around low mood.', sources: ['NICE NG222'] },
  { id: 'dbt', name: 'Individual dialectical behaviour therapy', short: 'Individual DBT', kind: 'therapy', format: 'individual', dbt: true,
    for: ['bpd', 'bulimia', 'bed'], open: true, by: ['psychologist', 'therapist', 'psychiatrist'], dbtTrained: true,
    from: 1993, minAge: 14, sessions: 52, cost: 120,
    builds: ['mindfulness', 'distress', 'regulation', 'interpersonal'],
    blurb: 'A weekly hour with a DBT therapist: a diary card, the week\'s hardest moments looked at in detail, and the skills that would help next time.',
    sources: ['NICE CG78', 'Linehan, Cognitive-Behavioral Treatment of Borderline Personality Disorder (1993)'] },
  { id: 'dbt_group', name: 'DBT skills group', short: 'DBT skills group', kind: 'therapy', format: 'group', dbt: true,
    for: ['bpd', 'bulimia', 'bed'], open: true, by: ['psychologist', 'therapist'], dbtTrained: true,
    from: 1993, minAge: 14, sessions: 48, cost: 45, cycle: DBT_CYCLE,
    builds: ['mindfulness', 'distress', 'regulation', 'interpersonal'],
    blurb: 'A weekly class of six to eight people, run by trained facilitators, teaching the four skills modules in turn. Homework in between.',
    sources: ['Linehan, DBT Skills Training Manual (2nd ed., 2015)'] },
  { id: 'mbt', name: 'Mentalization-based treatment', short: 'MBT', kind: 'therapy', format: 'individual',
    for: ['bpd'], by: ['psychologist', 'psychiatrist', 'therapist'], from: 1999, minAge: 16, sessions: 52, cost: 115,
    builds: ['interpersonal', 'regulation'], blurb: 'Learning to make sense of your own and other people\'s states of mind, especially when feelings run high.',
    sources: ['Bateman & Fonagy (1999)', 'NICE CG78'] },
  { id: 'schema', name: 'Schema therapy', short: 'Schema therapy', kind: 'therapy', format: 'individual',
    for: ['bpd', 'pdd'], by: ['psychologist', 'therapist'], from: 1990, minAge: 18, sessions: 52, cost: 120,
    builds: ['regulation', 'coping'], blurb: 'Working on long-standing patterns that began early in life, and the needs underneath them.',
    sources: ['Young (1990)', 'Giesen-Bloo et al. (2006)'] },
  { id: 'tfp', name: 'Transference-focused psychotherapy', short: 'TFP', kind: 'therapy', format: 'individual',
    for: ['bpd'], by: ['psychiatrist', 'psychologist'], from: 1999, minAge: 18, sessions: 52, cost: 125,
    builds: ['interpersonal'], blurb: 'Twice-weekly psychodynamic sessions focused on how relationships play out, including in the room.',
    sources: ['Clarkin, Yeomans & Kernberg (1999)'] },
  { id: 'erp', name: 'Exposure and response prevention', short: 'ERP', kind: 'therapy', format: 'individual',
    for: ['ocd'], by: ['psychologist', 'therapist'], from: 1966, minAge: 8, sessions: 14, cost: 110,
    builds: ['coping'], blurb: 'Facing what sets off the urge, step by step, and not doing the compulsion.', sources: ['NICE CG31'] },
  { id: 'exposure', name: 'Exposure therapy', short: 'Exposure therapy', kind: 'therapy', format: 'individual',
    for: ['specific_phobia', 'agoraphobia', 'social_anxiety'], by: ['psychologist', 'therapist'], from: 1958, minAge: 6, sessions: 8, cost: 100,
    builds: ['coping'], blurb: 'Gradually and safely getting closer to what you fear.', sources: ['NHS: Phobias'] },
  { id: 'applied_relaxation', name: 'Applied relaxation', short: 'Applied relaxation', kind: 'therapy', format: 'individual',
    for: ['gad'], by: ['psychologist', 'therapist'], from: 1987, minAge: 16, sessions: 12, cost: 95,
    builds: ['coping'], blurb: 'Learning to relax the body quickly, then using it when anxiety starts.', sources: ['NICE CG113'] },
  { id: 'tf_cbt', name: 'Trauma-focused CBT', short: 'TF-CBT', kind: 'therapy', format: 'individual',
    for: ['ptsd'], by: ['psychologist', 'therapist'], from: 1996, minAge: 6, sessions: 12, cost: 120,
    builds: ['coping', 'regulation'], blurb: 'Paced, careful work on what happened and what it has left behind. You set the pace.', sources: ['NICE NG116'] },
  { id: 'cpt', name: 'Cognitive processing therapy', short: 'CPT', kind: 'therapy', format: 'individual',
    for: ['ptsd'], by: ['psychologist', 'therapist'], from: 1992, minAge: 16, sessions: 12, cost: 120,
    builds: ['coping'], blurb: 'Looking at the beliefs a hard experience left you with.', sources: ['NICE NG116'] },
  { id: 'emdr', name: 'EMDR', short: 'EMDR', kind: 'therapy', format: 'individual',
    for: ['ptsd'], by: ['psychologist', 'therapist'], from: 1989, minAge: 16, sessions: 10, cost: 120,
    builds: ['regulation'], blurb: 'Eye movement desensitisation and reprocessing, for memories that stay raw.', sources: ['NICE NG116'] },
  { id: 'eating_cbt', name: 'CBT for eating disorders', short: 'CBT-ED', kind: 'therapy', format: 'individual',
    for: ['anorexia', 'bulimia', 'bed'], by: ['psychologist', 'therapist'], from: 1981, minAge: 12, sessions: 20, cost: 120,
    builds: ['coping'], blurb: 'Regular eating, and the thoughts that keep the problem going.', sources: ['NICE NG69'] },
  { id: 'cbtp', name: 'CBT for psychosis', short: 'CBTp', kind: 'therapy', format: 'individual',
    for: ['schizophrenia'], by: ['psychologist', 'psychiatrist'], from: 1994, minAge: 16, sessions: 16, cost: 120,
    builds: ['coping'], blurb: 'Making sense of unusual experiences and finding ways to live with them.', sources: ['NICE CG178'] },
  { id: 'psychoeducation', name: 'Psychoeducation', short: 'Psychoeducation', kind: 'education', format: 'group',
    for: ['bipolar_1', 'bipolar_2', 'schizophrenia'], by: ['psychiatric_nurse', 'psychologist', 'psychiatrist'], from: 1980, minAge: 14, sessions: 12, cost: 30,
    builds: ['coping'], blurb: 'Learning how the condition works, the early signs of an episode, and what helps.', sources: ['NICE CG185'] },
  { id: 'family', name: 'Family therapy', short: 'Family therapy', kind: 'therapy', format: 'family',
    for: ['anorexia', 'schizophrenia', 'bipolar_1'], by: ['therapist', 'psychologist'], from: 1960, minAge: 6, sessions: 10, cost: 130,
    builds: ['interpersonal'], blurb: 'Sessions with the people you live with.', sources: ['NICE NG69'] },
  { id: 'couples', name: 'Couples therapy', short: 'Couples therapy', kind: 'therapy', format: 'couples',
    for: ['mdd'], open: true, by: ['therapist', 'psychologist'], from: 1950, minAge: 18, sessions: 12, cost: 130,
    builds: ['interpersonal'], blurb: 'Working on the relationship together.', sources: ['NICE NG222'] },
  { id: 'supportive', name: 'Supportive counselling', short: 'Counselling', kind: 'therapy', format: 'individual',
    for: ['mdd', 'gad'], open: true, by: ['counsellor', 'therapist', 'psychologist', 'social_worker'], from: 1940, minAge: 8, sessions: 8, cost: 75,
    builds: ['coping'], blurb: 'Someone trained to listen, and help you think things through.', sources: ['NHS: Counselling'] },
  { id: 'adhd_coaching', name: 'ADHD coaching', short: 'Coaching', kind: 'therapy', format: 'individual',
    for: ['adhd'], open: true, by: ['therapist', 'occupational_therapist'], from: 1994, minAge: 14, sessions: 10, cost: 85,
    builds: ['organisation'], blurb: 'Building routines, systems and reminders that work with how your attention works.', sources: ['NICE NG87'] },
  { id: 'parent_training', name: 'Parent training', short: 'Parent training', kind: 'therapy', format: 'group',
    for: ['adhd'], by: ['psychologist', 'therapist'], from: 1975, minAge: 3, maxAge: 12, sessions: 10, cost: 40,
    builds: ['organisation'], blurb: 'A course for parents, so home works better for everyone.', sources: ['NICE NG87'] },
  { id: 'cbit', name: 'Comprehensive behavioural intervention for tics', short: 'CBIT', kind: 'therapy', format: 'individual',
    for: ['tourette'], by: ['psychologist', 'therapist'], from: 2010, minAge: 8, sessions: 8, cost: 110,
    builds: ['coping'], blurb: 'Noticing the urge before a tic, and learning a competing response, if you want to.', sources: ['NIH NINDS: Tourette Syndrome'] },

  // ---------- Allied health ----------
  { id: 'speech_language', name: 'Speech and language therapy', short: 'Speech and language', kind: 'allied', format: 'individual',
    for: ['dld', 'autism', 'intellectual', 'huntingtons'], open: true, by: ['speech_therapist'], from: 1925, minAge: 2, sessions: 12, cost: 90,
    builds: ['communication'], blurb: 'Support with understanding and using language, in the way that suits you.', sources: ['NHS: Speech and language therapy'] },
  { id: 'occupational', name: 'Occupational therapy', short: 'OT', kind: 'allied', format: 'individual',
    for: ['autism', 'dysgraphia', 'intellectual', 'cerebral_palsy', 'spinal_cord_injury', 'limb_difference', 'huntingtons'], open: true,
    by: ['occupational_therapist'], from: 1917, minAge: 2, sessions: 10, cost: 90,
    builds: ['independence'], blurb: 'Practical help doing the things you need and want to do, in your own way.', sources: ['WHO ICF'] },
  { id: 'physio', name: 'Physiotherapy', short: 'Physio', kind: 'allied', format: 'individual',
    for: ['cerebral_palsy', 'spinal_cord_injury', 'limb_difference', 'cystic_fibrosis', 'huntingtons'], open: true,
    by: ['physiotherapist'], from: 1894, minAge: 0, sessions: 12, cost: 80,
    builds: ['independence'], blurb: 'Strength, movement and breathing.', sources: ['NHS: Physiotherapy'] },
  { id: 'rehab', name: 'Rehabilitation programme', short: 'Rehabilitation', kind: 'allied', format: 'individual',
    for: ['spinal_cord_injury'], by: ['physiotherapist', 'occupational_therapist'], from: 1945, minAge: 0, sessions: 20, cost: 150,
    builds: ['independence'], blurb: 'Intensive work on the goals you set for living the way you want to.', sources: ['WHO: Rehabilitation'] },
  { id: 'mobility_training', name: 'Orientation and mobility training', short: 'Mobility training', kind: 'allied', format: 'individual',
    for: ['blind', 'low_vision', 'lhon'], by: ['occupational_therapist'], from: 1944, minAge: 4, sessions: 10, cost: 80,
    builds: ['independence'], blurb: 'Getting around confidently, with a cane or guide dog if you want one.', sources: ['WHO: Blindness and vision impairment'] },
  { id: 'literacy_support', name: 'Specialist literacy teaching', short: 'Literacy support', kind: 'allied', format: 'individual',
    for: ['dyslexia'], by: ['educational_psychologist', 'specialist_teacher'], from: 1935, minAge: 5, sessions: 20, cost: 50,
    builds: ['study'], blurb: 'Structured, multi-sensory teaching that works with how you read.', sources: ['NHS: Dyslexia'] },
  { id: 'numeracy_support', name: 'Specialist numeracy teaching', short: 'Numeracy support', kind: 'allied', format: 'individual',
    for: ['dyscalculia'], by: ['educational_psychologist', 'specialist_teacher'], from: 1980, minAge: 5, sessions: 20, cost: 50,
    builds: ['study'], blurb: 'Concrete, step-by-step work with numbers.', sources: ['NHS: Dyscalculia'] },

  // ---------- Groups that are not therapy ----------
  { id: 'anxiety_group', name: 'CBT group for anxiety', short: 'Anxiety group', kind: 'therapy', format: 'group',
    for: ['gad', 'social_anxiety', 'panic'], by: ['psychologist', 'therapist'], from: 1985, minAge: 16, sessions: 8, cost: 35,
    builds: ['coping'], blurb: 'A structured eight-week course with a therapist and a small group.', sources: ['NICE CG113'] },
  { id: 'depression_peer', name: 'Depression peer support group', short: 'Peer support', kind: 'peer', format: 'group',
    for: ['mdd', 'pdd', 'bipolar_1', 'bipolar_2'], open: true, by: [], from: 1970, minAge: 16, sessions: 26, cost: 0,
    builds: [], blurb: 'People who have been there, meeting fortnightly. Not therapy, and not meant to be.', sources: ['NHS: Peer support'] },
  { id: 'grief_peer', name: 'Bereavement support group', short: 'Bereavement group', kind: 'peer', format: 'group',
    for: [], open: true, by: [], from: 1970, minAge: 12, sessions: 12, cost: 0,
    builds: [], blurb: 'A room of people who have lost someone too.', sources: ['NHS: Bereavement'] },
  { id: 'pain_course', name: 'Pain management programme', short: 'Pain programme', kind: 'education', format: 'group',
    for: ['migraine'], open: true, by: ['physiotherapist', 'psychologist'], from: 1985, minAge: 16, sessions: 8, cost: 40,
    builds: ['coping'], blurb: 'Living well with long-term pain: pacing, sleep, movement.', sources: ['NHS: Pain management programmes'] },
  { id: 'disability_peer', name: 'Disabled people\'s peer network', short: 'Peer network', kind: 'peer', format: 'group',
    for: [], open: true, by: [], from: 1972, minAge: 14, sessions: 12, cost: 0,
    builds: [], blurb: 'Disabled people sharing what works, run by disabled people.', sources: ['Disability rights movement history'] },
];

export const THERAPY_BY_ID = Object.fromEntries(THERAPIES.map((t) => [t.id, t]));

/** Skills a person builds through care and practice, shown in My Health. */
export const SKILLS = {
  mindfulness: 'Mindfulness', distress: 'Distress tolerance', regulation: 'Emotion regulation', interpersonal: 'Interpersonal effectiveness',
  coping: 'Coping skills', organisation: 'Organisation systems', communication: 'Communication', independence: 'Everyday independence', study: 'Study strategies',
};

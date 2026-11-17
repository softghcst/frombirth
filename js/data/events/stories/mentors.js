// STORYLINE: teachers, coaches and professors who become mentors because of
// what they actually see you do.
//
// One of three teacher scenes fires between 12 and 16, depending on your grades.
// The teacher becomes a contact ('tag:teacher') who remembers why they noticed
// you, and comes back with a recommendation at 17 and a phone call years later.
//
// Flags: hasTeacherMentor, teacherRec (helps university admission),
//        hasCoach, coachRec (helps athletic scholarships),
//        profRec (helps graduate, medical and law school), alumniIntro.
import { st, hid, tal, cash, rel, flag, gpa, ms, addNpc, ok, bad, any, chk, need, mem, when } from '../helpers.js';

const inSchool = need('education.enrolled', '==', true);
const noMentor = need('flags.hasTeacherMentor', '!=', true);
const teacher = (key, text) => addNpc('mentor', 'teacher',
  { tag: 'teacher', title: 'Teacher', ageOffset: 24, relationship: 62, memory: [key, text] });

/** @type {import('../../../types.js').GameEvent[]} */
export default [
  // ---------- A teacher notices (one of three, by what they see) ----------
  {
    id: 'mentor_sees_talent', category: 'school', ageRange: [12, 16], once: true, priority: true, exclusive: 'mentor',
    requires: [inSchool, noMentor, need('education.gpa', '>=', 3.4)],
    text: 'Your essay comes back with no mark on it. Just two words in red: "See me."',
    choices: [
      { label: 'Go and see them', outcomes: [any(
        '{teacher} is not angry. "You finished this in twenty minutes, didn\'t you? You are coasting." They hand you a reading list meant for students three years older, and a leaflet for a summer program you have never heard of.',
        'good', flag('hasTeacherMentor'), st('intellect', 4), hid('discipline', 2),
        teacher('sawTalent', 'They noticed your work was years ahead of the class.'))] },
      { label: 'Pretend you did not see it', outcomes: [any('The teacher does not raise it again. You keep getting top marks for half-effort.', 'neutral', hid('discipline', -2))] },
    ],
  },
  {
    id: 'mentor_sees_struggle', category: 'school', ageRange: [12, 16], once: true, priority: true, exclusive: 'mentor',
    requires: [inSchool, noMentor, need('education.gpa', '<=', 2.3), need('education.gpa', '>=', 0.1)],
    text: 'Your teacher has noticed you staring at the same page for a week, and asks you to stay behind.',
    choices: [
      { label: 'Admit you are lost', outcomes: [any(
        '{teacher} does not sigh, or look at the clock. "Right. Lunchtimes, my room, until it makes sense." It takes a term. It makes sense.',
        'good', flag('hasTeacherMentor'), gpa(0.3), st('intellect', 3), st('mood', 4),
        teacher('askedForHelp', 'You admitted you were lost, then turned up every lunchtime until you were not.'))] },
      { label: 'Say you are fine', outcomes: [any('"If you say so." They watch you go.', 'neutral', gpa(-0.05))] },
    ],
  },
  {
    id: 'mentor_sees_effort', category: 'school', ageRange: [12, 16], once: true, priority: true, exclusive: 'mentor',
    requires: [inSchool, noMentor, need('education.gpa', '>=', 2.31), need('education.gpa', '<=', 3.39)],
    text: 'You are the only one who stays to ask the question nobody else wanted to ask. Your teacher puts down the board rubber.',
    choices: [
      { label: 'Ask it properly', outcomes: [any(
        '{teacher} talks for fifteen minutes past the bell. "Most of them want the answer. You want to know why. Keep doing that."',
        'good', flag('hasTeacherMentor'), st('intellect', 3), gpa(0.1),
        teacher('askedWhy', 'You were the one who stayed behind to ask why.'))] },
      { label: 'Say it does not matter', outcomes: [any('You catch your bus. The question bothers you all the way home.', 'neutral')] },
    ],
  },
  {
    id: 'coach_sees_effort', category: 'school', ageRange: [12, 17], once: true, priority: true,
    requires: [inSchool, need('education.clubs', 'has', 'sports_team'), need('flags.hasCoach', '!=', true)],
    text: 'You are last off the pitch again, collecting cones nobody asked you to collect. The coach is watching.',
    choices: [
      { label: 'Ask what you should work on', outcomes: [any(
        '{coach} gives you three drills and an hour every Thursday. "I can teach anyone to kick. I cannot teach that."',
        'good', flag('hasCoach'), tal('sports', 6), st('health', 2),
        addNpc('mentor', 'coach', { tag: 'coach', title: 'Coach', ageOffset: 22, relationship: 60,
          memory: ['lastOffPitch', 'You were always last off the pitch, clearing up without being asked.'] }))] },
      { label: 'Just nod and go', outcomes: [any('The coach nods back.', 'neutral')] },
    ],
  },

  // ---------- The recommendation (17) ----------
  {
    id: 'teacher_reference', category: 'senior year', ageRange: [17, 18], once: true, priority: true,
    requires: [need('education.stage', '==', 'high')], cast: { teacher: 'tag:teacher' },
    text: '{teacher} stops you in the corridor and asks what you are planning to do when school ends.',
    choices: [
      { label: 'Ask for a recommendation', check: chk(0.5, { 'cast.teacher.relationship': 2 }), outcomes: [
        when([need('memory.teacher.sawTalent', '>=', 1)], ok(
          '{teacher} writes two pages about "a student who was ahead of the room at thirteen and, to their credit, stopped coasting". It goes with every application.',
          flag('teacherRec'), rel('teacher', 5))),
        when([need('memory.teacher.askedForHelp', '>=', 1)], ok(
          '{teacher} writes about "a student who said out loud that they were lost, and then outworked everyone who was not". It goes with every application.',
          flag('teacherRec'), rel('teacher', 5))),
        ok('{teacher} writes about "the one who stays behind to ask why". It goes with every application.', flag('teacherRec'), rel('teacher', 5)),
        when([need('memory.teacher.exposed', '>=', 1)], bad(
          '{teacher} looks at you for a long moment. "After what you printed about me, I do not think I am the right person to ask."', st('mood', -5))),
        bad('"I would like to," {teacher} says, "but I would be writing about someone I have hardly seen this year. Ask me again when that has changed."', st('mood', -3)),
      ] },
      { label: 'Say you have no idea', outcomes: [any(
        '{teacher} does not laugh. "University is one door. Have you looked at an apprenticeship? Or two years at community college, then transfer? Half the people I respect took the long way."',
        'good', st('mood', 3), st('intellect', 1), rel('teacher', 3))] },
    ],
  },
  {
    id: 'coach_reference', category: 'senior year', ageRange: [17, 18], once: true, priority: true,
    requires: [need('education.stage', '==', 'high')], cast: { coach: 'tag:coach' },
    text: '{coach} has a university scout coming on Saturday and can put one name forward.',
    choices: [
      { label: 'Ask to be the name', check: chk(0.45, { 'talents.sports': 0.7, 'cast.coach.relationship': 0.5 }), outcomes: [
        ok('{coach} tells the scout about the cones before mentioning a single goal. Your name goes on the list.', flag('coachRec'), st('mood', 6), rel('coach', 4)),
        bad('"Not this time. You are not there yet, and I will not lie to a scout."', st('mood', -4)),
      ] },
      { label: 'Suggest a teammate who needs it more', outcomes: [any('{coach} looks at you differently after that.', 'good', hid('karma', 6), rel('coach', 8))] },
    ],
  },

  // ---------- Years later ----------
  {
    id: 'teacher_back_in_touch', category: 'a call from the past', ageRange: [22, 27], once: true, priority: true,
    requires: [need('flags.teacherRec', '==', true)], cast: { teacher: 'tag:teacher' },
    text: '{teacher} emails after years of silence: the school needs someone to talk to this year\'s leavers about what comes next. "I thought of you first."',
    choices: [
      { label: 'Go and speak', outcomes: [any(
        'You stand at the front of the hall you used to sit at the back of. Afterwards a nervous kid asks how you knew what to do. You tell them the truth: you did not.',
        'good', st('mood', 9), hid('karma', 4), cash(200), rel('teacher', 8),
        mem('teacher', 'cameBack', 'You came back to speak to the leavers when they asked.'))] },
      { label: 'Say you are too busy', outcomes: [any('{teacher} says they understand. They probably do.', 'neutral', rel('teacher', -6))] },
    ],
  },
  {
    id: 'prof_recommends', category: 'a call from the past', ageRange: [20, 32], once: true, priority: true,
    requires: [need('degreeTypes', 'has', 'university')], cast: { prof: 'tag:favProfessor' },
    text: 'Professor {prof} writes: "A funded summer on my research team has come free, and separately, the graduate committee has asked me for names. I put yours on both lists, because of the work you did in my seminar."',
    choices: [
      { label: 'Take the funded summer', outcomes: [any('Ten weeks of real work with your name on the paper at the end. You leave with {$2500}.', 'good',
        cash(2500), st('intellect', 3), flag('profRec'), ms('Did funded research with the professor whose work drew you to the college.'))] },
      { label: 'Ask for the reference instead', outcomes: [any('{prof} writes it that evening. It will carry weight with any graduate, medical or law school.', 'good', flag('profRec'), rel('prof', 4))] },
      { label: 'Thank them and decline', outcomes: [any('{prof} says the offer does not expire.', 'neutral')] },
    ],
  },
  {
    id: 'alumni_door', category: 'a call from the past', ageRange: [21, 32], once: true, priority: true,
    requires: [need('degreeTypes', 'has', 'university')], cast: { alum: 'tag:alumni' },
    text: 'You finally write to {alum}, the graduate of your university you met at your own graduation. The reply comes inside an hour: "Same halls? Come in on Monday."',
    choices: [
      { label: 'Go in on Monday', outcomes: [any(
        'It is a three-month paid placement that nobody advertised. {alum} says the name on your degree opened the door, and what you do with it is up to you.',
        'good', cash(6000), flag('alumniIntro'), hid('discipline', 3), ms('Landed an unadvertised placement through a fellow graduate.'))] },
      { label: 'Ask for advice only', outcomes: [any('An hour of straight answers over coffee.', 'good', st('intellect', 2), rel('alum', 5))] },
    ],
  },
];

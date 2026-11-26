// School stages, programs after high school, housing, cliques and clubs.
// Everything here is plain data: edit values or add entries freely.
import { CATALOG_CERTS } from './occupations.js';

/** Compulsory schooling. `start` is the age a stage begins. */
export const SCHOOL_STAGES = [
  { id: 'elementary', start: 5, label: 'elementary school' },
  { id: 'middle', start: 11, label: 'middle school' },
  { id: 'high', start: 14, label: 'high school' },
];
export const SCHOOL_LEAVING_AGE = 18;
export const DROPOUT_AGE = 16;

/**
 * Programs after high school. tuition is base units per year (0 where the
 * country funds university; trade schools always charge).
 * needs: degree type required to apply. minGpa is checked against that degree.
 * kind 'trade' programs have no major and award a license.
 */
export const PROGRAMS = {
  university: { id: 'university', label: 'University', years: 4, tuition: 14000, needs: 'high', minGpa: 2.0,
    blurb: 'A four-year degree in a subject you choose.' },
  community: { id: 'community', label: 'Community college', years: 2, tuition: 4000, needs: 'high', minGpa: 0,
    open: true,
    blurb: 'Two cheap years close to home. Finish, then transfer into the third year of university.' },
  apprenticeship: { id: 'apprenticeship', label: 'Apprenticeship', kind: 'trade', years: 3, tuition: 0,
    stipend: 16000, needs: null, minAge: 16, subjects: 'trades',
    yearly: { hidden: { discipline: 3 }, stats: { health: 1 } },
    blurb: 'Paid training on the job under a qualified tradesperson. No diploma needed.' },
  cosmetology: { id: 'cosmetology', label: 'Cosmetology school', kind: 'trade', years: 1, tuition: 9000,
    needs: 'high', minGpa: 0, yearly: { stats: { charm: 3 }, hidden: { discipline: 2 } },
    blurb: 'Trade school. One year to a license in hair and makeup.' },
  graduate: { id: 'graduate', label: 'Graduate school', years: 2, tuition: 18000, needs: 'university', minGpa: 3.0,
    blurb: 'Two more years for a master\'s in your subject.' },
  medical: { id: 'medical', label: 'Medical school', years: 4, tuition: 38000, needs: 'university', minGpa: 3.6, science: true, license: 'medical',
    blurb: 'Four gruelling years. Needs a science or health degree.' },
  podiatric: { id: 'podiatric', label: 'Podiatric medical school', years: 4, tuition: 34000, needs: 'university', minGpa: 3.2, science: true, license: 'podiatric',
    done: 'podiatric medical school (DPM)', minYear: 1960, blurb: 'Four years to a Doctor of Podiatric Medicine: the foot, the ankle, and everything that walks on them. Its own profession, not a branch of medicine.' },
  law: { id: 'law', label: 'Law school', years: 3, tuition: 32000, needs: 'university', minGpa: 3.4, license: 'law',
    blurb: 'Three years of case law and very little sleep.' },
  // done: how graduating reads, after "You graduated from". partYears: how long it takes alongside a job.
  // license: the degree is not the right to practice; an exam follows. science: needs a science or health degree.
  business: { id: 'business', label: 'Business school', years: 2, partYears: 3, tuition: 30000, needs: 'university', minGpa: 2.9,
    done: 'business school with an MBA', yearly: { stats: { charm: 2 } },
    blurb: 'Case studies, group work and a great many contacts. Often taken by people already working.' },
  dental: { id: 'dental', label: 'Dental school', years: 4, tuition: 36000, needs: 'university', minGpa: 3.4, science: true, license: 'dental',
    done: 'dental school', blurb: 'Four years, most of them with your hands in someone\'s mouth.' },
  pharmacy: { id: 'pharmacy', label: 'Pharmacy school', years: 4, tuition: 28000, needs: 'university', minGpa: 3.2, science: true, license: 'pharmacy',
    done: 'pharmacy school', blurb: 'Chemistry, law, and the patience to read handwriting.' },
  veterinary: { id: 'veterinary', label: 'Veterinary school', years: 4, tuition: 34000, needs: 'university', minGpa: 3.5, science: true, license: 'veterinary',
    done: 'veterinary school', blurb: 'Harder to get into than medicine, and the patients bite.' },
  teaching: { id: 'teaching', label: 'Teacher training', years: 1, partYears: 2, tuition: 9000, needs: 'university', minGpa: 2.5, license: 'teaching',
    done: 'teacher training', yearly: { stats: { charm: 2 }, hidden: { discipline: 2 } },
    blurb: 'A year split between lectures and a classroom of thirty people who would rather be elsewhere.' },
  nursing: { id: 'nursing', label: 'Nursing school', years: 3, partYears: 5, tuition: 9000, needs: 'high', minGpa: 2.4, license: 'nursing',
    done: 'nursing school', yearly: { hidden: { karma: 2, discipline: 2 } },
    blurb: 'Three years, half of them on the wards. A route into nursing without a university degree.' },
  doctorate: { id: 'doctorate', label: 'Doctoral program', years: 5, tuition: 0, stipend: 20000, needs: 'university', minGpa: 3.4, thesis: true,
    done: 'your doctorate', plain: true,
    blurb: 'Years on one question nobody has answered, paid a little, under a supervisor. A master\'s degree helps you in.' },
  technical: { id: 'technical', label: 'Technical college', kind: 'trade', years: 2, partYears: 3, tuition: 5000, needs: null, minAge: 16, subjects: 'trades', givesTrade: true,
    yearly: { hidden: { discipline: 2 } }, done: 'technical college',
    blurb: 'A trade learned in a workshop, not on a site. Costs fees where an apprenticeship pays, but nobody has to take you on.' },
  certificate: { id: 'certificate', label: 'Professional certificate', kind: 'trade', years: 1, partYears: 1, tuition: 3500, needs: 'high', minGpa: 0, open: true, subjects: 'certs', repeat: true,
    done: 'your certificate course',
    blurb: 'One year, evenings, in something employers ask for. A way into some careers without a degree.' },
  equivalency: { id: 'equivalency', label: 'Adult school certificate', kind: 'trade', years: 1, partYears: 1, tuition: 600, needs: null, minAge: 17, open: true, gives: 'high', adult: true,
    done: 'adult school',
    blurb: 'For anyone who left school without finishing. One year, evenings, and the same doors open as for everyone else.' },
};

/** The right to practice. A degree qualifies someone to sit the exam; passing it is something else. */
export const LICENSES = {
  medical: { name: 'medicine', people: 'doctors', fee: 900, exam: { default: 'medical licensing exam' } },
  podiatric: { name: 'podiatric medicine', people: 'podiatrists', fee: 800, exam: { default: 'podiatric licensing exam', us: 'podiatric board exams and a state license' } },
  law: { name: 'law', people: 'lawyers', fee: 700, exam: { default: 'professional qualifying exam', us: 'bar exam', ca: 'bar exam', ph: 'bar exam', in: 'bar exam', ng: 'bar exam', ke: 'bar exam', gh: 'bar exam', jp: 'bar exam', kr: 'bar exam' } },
  dental: { name: 'dentistry', people: 'dentists', fee: 800, exam: { default: 'dental licensing exam' } },
  pharmacy: { name: 'pharmacy', people: 'pharmacists', fee: 500, exam: { default: 'pharmacy registration exam' } },
  veterinary: { name: 'veterinary medicine', people: 'vets', fee: 800, exam: { default: 'veterinary licensing exam' } },
  nursing: { name: 'nursing', people: 'nurses', fee: 300, exam: { default: 'nursing registration exam' } },
  teaching: { name: 'teaching', people: 'teachers', fee: 200, exam: { default: 'teaching certification' } },
};
/** One-year certificates. opens: the career it is a way into. */
export const CERTS = [
  { id: 'coding', name: 'Programming', opens: 'software' },
  { id: 'bookkeeping', name: 'Bookkeeping', opens: 'accountant' },
  { id: 'digital_marketing', name: 'Digital marketing', opens: 'marketing' },
  { id: 'project_management', name: 'Project management', opens: 'office' },
  ...CATALOG_CERTS,
];
export const CERT_BY_ID = Object.fromEntries(CERTS.map((c) => [c.id, c]));
/** Words for a thesis title: one from each list, then the field. */
export const THESIS_WORDS = { first: ['Hidden', 'Competing', 'Early', 'Unstable', 'Forgotten', 'Emergent', 'Contested', 'Slow'], second: ['Structures', 'Patterns', 'Mechanisms', 'Traditions', 'Networks', 'Boundaries', 'Signals', 'Economies'] };

/** Trades you can apprentice in. */
export const TRADES = [
  { id: 'electrician', name: 'Electrician' },
  { id: 'plumber', name: 'Plumber' },
  { id: 'carpenter', name: 'Carpenter' },
  { id: 'chef', name: 'Chef' },
  { id: 'mechanic', name: 'Mechanic' },
  { id: 'stage_tech', name: 'Stage technician' },
  { id: 'welder', name: 'Welder' },
  { id: 'hvac', name: 'Heating and cooling engineer' },
];
export const TRADE_BY_ID = Object.fromEntries(TRADES.map((t) => [t.id, t]));

/**
 * The kinds of university that answer an application. Names are fictional. Each one makes its own
 * decision and its own offer, so the player compares them side by side.
 *   tuitionMult  multiplies the base university tuition
 *   admit        added to the chance of getting in
 *   aid          multiplies the chance of a scholarship
 *   strong       majors the school is known for (a small GPA boost each year)
 *   perk         'network' (an alumni contact when you graduate), 'home'
 *                (cheap, near family) or 'mentor' (a professor from day one)
 */
export const SCHOOL_TYPES = [
  { id: 'selective', name: 'Ashcombe University', tuitionMult: 1.9, admit: -0.25, aid: 0.4, perk: 'network',
    knownFor: 'A famous name and strong industry connections. Very little financial aid.',
    strong: ['engineering', 'mathematics', 'computer_science', 'finance', 'chemistry', 'biology', 'political_science', 'musical_theater_bfa'] },
  { id: 'local', name: 'Northgate College', tuitionMult: 0.6, admit: 0.2, aid: 1, perk: 'home',
    knownFor: 'Close to home: you can live with family and keep your job.',
    strong: ['nursing', 'education', 'business', 'criminal_justice', 'psychology', 'communications'] },
  { id: 'small', name: 'Marlowe College', tuitionMult: 1, admit: 0, aid: 1.3, perk: 'mentor',
    knownFor: 'Small classes, generous aid, and a professor whose work you already love.',
    strong: ['art', 'music', 'theater', 'musical_theater', 'musical_theater_bfa', 'english', 'history', 'journalism'] },
];
export const SCHOOL_TYPE_BY_ID = Object.fromEntries(SCHOOL_TYPES.map((t) => [t.id, t]));

/** What a year off after high school can be. cash is in base units. */
export const GAP_YEARS = [
  { id: 'travel', name: 'Travel', cash: -3000, desc: 'See some of the world. Costs money, changes you.',
    mods: { stats: { mood: 12, charm: 4, intellect: 2 } },
    text: 'You spent the year on night buses and in hostels, and came home with a sunburn and a different way of standing.' },
  { id: 'work', name: 'Work and save', cash: 8000, desc: 'A year of full-time hours to build a cushion.',
    mods: { hidden: { discipline: 5 }, stats: { mood: -2 } },
    text: 'You worked every hour going for a year and watched the number in your account climb.' },
  { id: 'volunteer', name: 'Volunteer', cash: 0, desc: 'Give the year to something that needs you. Admissions tutors notice.',
    mods: { hidden: { karma: 12 }, stats: { mood: 5 } }, flag: 'gapVolunteer',
    text: 'You gave the year to a community project. It gave you something to write about, and somewhere to be missed.' },
];

/**
 * What a school student puts first in a given year (ages 11–17).
 * gpa shifts the year's grade. The rest is applied in education.js.
 */
export const PRIORITIES = [
  { id: 'grades', name: 'Grades', gpa: 0.35, desc: 'Homework first. Better marks, a duller year.' },
  { id: 'activities', name: 'Clubs and training', gpa: -0.05, desc: 'Your clubs and classes pay off half as much again. Grades dip a little.' },
  { id: 'work', name: 'Paid work', gpa: -0.12, needsJob: true, desc: 'Extra shifts: a quarter more pay and a grateful manager. Grades and friendships pay for it.' },
  { id: 'friends', name: 'Friends', gpa: -0.05, desc: 'Be where your friends are. Every friendship grows.' },
  { id: 'family', name: 'Family', gpa: 0, desc: 'Be home for dinner. Your family notices.' },
];
export const PRIORITY_BY_ID = Object.fromEntries(PRIORITIES.map((p) => [p.id, p]));

/** Where you live while studying. cost is base units per year. */
export const HOUSING = {
  home: { id: 'home', label: 'Live at home', cost: 0,
    blurb: 'Free. You commute, and your parents still expect you at dinner.' },
  dorm: { id: 'dorm', label: 'Campus dorm', cost: 9000,
    blurb: 'Right in the middle of everything, sharing a corridor with strangers.' },
  apartment: { id: 'apartment', label: 'Off-campus apartment', cost: 7000,
    blurb: 'Split the rent with a roommate. Your own rules, your own dishes.' },
};

/** High-school social groups. `needs` gates entry; `yearly` applies each year you stay. */
export const CLIQUES = [
  // needs: what it takes (any one of the paths joined by | will do); pop: the popularity they expect; shuns: what puts
  // them off (path above the number); rivals: cliques whose members they will not take; interest: where the leader is from.
  { id: 'populars', name: 'Popular Kids', desc: 'Everyone knows their names.', who: 'You need to be well liked, and good company.',
    needs: { 'stats.charm': 60 }, pop: 65, rivals: ['loners', 'goths'], interest: 'sport', yearly: { stats: { charm: 1, mood: 1 } }, gpa: -0.05 },
  { id: 'athletes', name: 'Jocks', desc: 'Team kit, early training, loud tables.', who: 'You need to be an athlete, and not too bookish.',
    needs: { 'talents.sports': 50 }, pop: 45, shuns: { 'stats.intellect': 85 }, rivals: ['brains', 'gamers'], interest: 'sport', yearly: { stats: { health: 1 }, talents: { sports: 2 } } },
  { id: 'brains', name: 'Nerds', desc: 'Library at lunch, top of every class.', who: 'You need to be clever, and care about the work.',
    needs: { 'stats.intellect': 60 }, pop: 0, rivals: ['athletes', 'rebels'], interest: 'science', yearly: { stats: { intellect: 1 } }, gpa: 0.15 },
  { id: 'theater', name: 'Theater Kids', desc: 'Every lunch is a rehearsal for something.', who: 'You need to act, sing or dance, and not mind an audience.',
    needs: { 'talents.acting|talents.singing|talents.dance': 45 }, pop: 20, interest: 'theater', yearly: { talents: { acting: 2, singing: 1, dance: 1 } } },
  { id: 'band', name: 'Band Kids', desc: 'Instrument cases, inside jokes, marching season.', who: 'You need to play music.',
    needs: { 'talents.music': 45 }, pop: 10, interest: 'music', yearly: { talents: { music: 2 } } },
  { id: 'artists', name: 'Artsy Kids', desc: 'Paint under the fingernails, sketchbooks everywhere.', who: 'You need a creative streak.',
    needs: { 'talents.music|talents.acting|talents.singing|talents.dance|stats.charm': 45 }, pop: 15, interest: 'art', yearly: { talents: { music: 1, acting: 1 }, stats: { mood: 1 } } },
  { id: 'gamers', name: 'Gamers', desc: 'Handhelds under the desk, tournaments at the weekend.', who: 'Anyone who can hold their own in a game.',
    needs: { 'stats.intellect': 40 }, pop: 0, rivals: ['populars'], interest: 'games', yearly: { stats: { intellect: 1, mood: 1 } } },
  { id: 'goths', name: 'Goths', desc: 'Black clothes, dark music, sharp wit.', who: 'You need to not care what the popular kids think.',
    needs: {}, pop: 0, shuns: { 'stats.charm': 90 }, rivals: ['populars'], interest: 'writing', yearly: { stats: { mood: 1 }, hidden: { willpower: 1 } } },
  { id: 'skaters', name: 'Skaters', desc: 'Scraped knees and the parking lot after school.', who: 'You need some nerve, and to be up for anything.',
    needs: { 'stats.health': 50 }, pop: 25, interest: 'sport', yearly: { stats: { health: 1, mood: 1 }, hidden: { discipline: -1 } } },
  { id: 'rebels', name: 'Troublemakers', desc: 'Behind the bleachers, never in assembly.', who: 'Anyone willing to break a few rules.',
    needs: {}, pop: 20, rivals: ['brains'], interest: 'games', yearly: { stats: { mood: 1 }, talents: { crime: 2 }, hidden: { discipline: -2 } }, gpa: -0.15 },
  { id: 'floaters', name: 'Social Floaters', desc: 'A seat at every table, and no table of their own.', who: 'You need to get on with everyone.',
    needs: { 'stats.charm': 50 }, pop: 40, interest: 'service', yearly: { stats: { charm: 1 } } },
  { id: 'loners', name: 'On your own', desc: 'Headphones in. Nobody bothers you.', who: 'Anyone. No one will ask.',
    needs: {}, pop: 0, yearly: { hidden: { willpower: 1 } } },
];
export const CLIQUE_BY_ID = Object.fromEntries(CLIQUES.map((c) => [c.id, c]));

/**
 * Clubs, teams and classes. `from` is the youngest age you can join.
 * tryout: skill check to get in (omit for open ones). yearly: gains each year.
 * contact: joining introduces you to this person, who then appears in scenes
 * as 'tag:<tag>' and remembers what you do.
 */
export const CLUBS = [
  { id: 'dance_class', name: 'Dance classes', from: 4, blurb: 'Ballet, tap and jazz.',
    yearly: { talents: { dance: 5 }, stats: { health: 1 } } },
  { id: 'choir', name: 'Choir', from: 6, blurb: 'Singing lessons, harmonies and concerts.',
    yearly: { talents: { singing: 5, music: 1 } } },
  { id: 'youth_theater', name: 'Youth theater', from: 6, blurb: 'Saturday-morning acting classes.',
    yearly: { talents: { acting: 4 }, stats: { charm: 1 } } },
  { id: 'musical_theater', name: 'Musical theater company', from: 11,
    blurb: 'The school\'s big shows. You need to sing, dance and act.',
    tryout: { base: 0.4, factors: { 'talents.singing': 0.45, 'talents.dance': 0.45, 'talents.acting': 0.45 } },
    yearly: { talents: { singing: 3, dance: 3, acting: 3 } },
    contact: { tag: 'director', title: 'Drama director', role: 'mentor', ageRange: [28, 55] } },
  { id: 'sports_team', name: 'Sports team', from: 11, tryout: { base: 0.4, factors: { 'talents.sports': 0.9, 'stats.health': 0.2 } },
    yearly: { talents: { sports: 4 }, stats: { health: 2 } } },
  { id: 'band', name: 'School band', from: 11, tryout: { base: 0.45, factors: { 'talents.music': 0.9 } },
    yearly: { talents: { music: 4 } } },
  { id: 'drama', name: 'Drama club', from: 11, tryout: { base: 0.5, factors: { 'talents.acting': 0.8, 'stats.charm': 0.2 } },
    yearly: { talents: { acting: 4 }, stats: { charm: 1 } } },
  { id: 'chess', name: 'Chess club', from: 11, tryout: { base: 0.6, factors: { 'stats.intellect': 0.7 } },
    yearly: { stats: { intellect: 2 }, skills: { chess: 4 } } },
  { id: 'debate', name: 'Debate team', from: 11, tryout: { base: 0.45, factors: { 'stats.intellect': 0.5, 'stats.charm': 0.4 } },
    yearly: { stats: { intellect: 1, charm: 1 }, skills: { public_speaking: 4 } } },
  { id: 'council', name: 'Student council', from: 11, tryout: { base: 0.35, factors: { 'stats.charm': 0.9 } },
    yearly: { stats: { charm: 2 }, hidden: { discipline: 1 } } },
  { id: 'paper', name: 'School newspaper', from: 11, tryout: { base: 0.6, factors: { 'stats.intellect': 0.5 } },
    yearly: { stats: { intellect: 1 }, hidden: { discipline: 2 } },
    contact: { tag: 'adviser', title: 'Newspaper adviser', role: 'mentor', ageRange: [30, 58] } },
  { id: 'science_club', name: 'Science club', from: 9, blurb: 'Experiments the timetable has no room for.',
    yearly: { stats: { intellect: 2 }, skills: { science: 4 } } },
  { id: 'coding', name: 'Coding club', from: 10, tryout: { base: 0.65, factors: { 'stats.intellect': 0.6 } }, blurb: 'Making things that run: games, websites, little apps.',
    yearly: { stats: { intellect: 2 }, hidden: { discipline: 1 }, skills: { coding: 5 } } },
  { id: 'robotics', name: 'Robotics team', from: 10, tryout: { base: 0.45, factors: { 'stats.intellect': 0.5, 'skills.robotics': 0.5, 'skills.coding': 0.3 } },
    blurb: 'Build a robot in six weeks, then take it to competition and watch it break.',
    yearly: { stats: { intellect: 2 }, skills: { robotics: 5, coding: 2, math: 1 } },
    contact: { tag: 'coach', title: 'Robotics coach', role: 'mentor', ageRange: [26, 60] } },
  { id: 'engineering', name: 'Engineering club', from: 9, blurb: 'Bridges out of spaghetti, egg drops, and a solar car that almost moves.',
    yearly: { stats: { intellect: 1 }, skills: { robotics: 3, math: 2, science: 1 } } },
  { id: 'science_olympiad', name: 'Science olympiad', from: 11, tryout: { base: 0.4, factors: { 'stats.intellect': 0.8, 'skills.science': 0.3 } },
    blurb: 'Timed events in chemistry, physics and biology, against the best schools in the region.',
    yearly: { stats: { intellect: 2 }, skills: { science: 4, math: 2 } } },
  { id: 'mock_trial', name: 'Mock trial', from: 13, tryout: { base: 0.4, factors: { 'stats.intellect': 0.5, 'stats.charm': 0.4, 'skills.public_speaking': 0.3 } },
    blurb: 'A real case, real judges, and you as the lawyer: opening statements, objections, a closing that wins it.',
    yearly: { stats: { charm: 1, intellect: 1 }, skills: { public_speaking: 4, writing: 2 } },
    contact: { tag: 'coach', title: 'Mock trial coach', role: 'mentor', ageRange: [28, 62] } },
  { id: 'model_un', name: 'Model UN', from: 13, tryout: { base: 0.5, factors: { 'stats.intellect': 0.5, 'stats.charm': 0.4 } },
    blurb: 'Represent a country you have never been to, and argue for it as if you lived there.',
    yearly: { stats: { charm: 1, intellect: 1 }, skills: { public_speaking: 3, writing: 1 } } },
  { id: 'art_club', name: 'Art club', from: 7, blurb: 'Paint, clay, and a kiln that sometimes works.',
    yearly: { stats: { mood: 2, charm: 1 } } },
  { id: 'environment', name: 'Environment club', from: 9, blurb: 'A garden, a litter pick, and a campaign about the canteen.',
    yearly: { hidden: { karma: 3 }, stats: { health: 1 } } },
  { id: 'volunteers', name: 'Volunteer group', from: 11,
    yearly: { hidden: { karma: 4 }, stats: { mood: 1 } } },
  { id: 'math_club', name: 'Math club', from: 10, blurb: 'Competition problems and a whiteboard nobody erases.',
    yearly: { stats: { intellect: 2 }, skills: { math: 4 } } },
  { id: 'book_club', name: 'Book club', from: 9, blurb: 'A book a month and pizza while you argue about it.',
    yearly: { stats: { intellect: 1, mood: 1 } } },
  { id: 'astronomy', name: 'Astronomy club', from: 10, blurb: 'A telescope on the roof, on clear nights.',
    yearly: { stats: { intellect: 2 } } },
  { id: 'animal_rights', name: 'Animal rights club', from: 10, blurb: 'Shelter visits and bake sales for the strays.',
    yearly: { hidden: { karma: 3 }, stats: { mood: 1 } } },
  { id: 'gaming_club', name: 'Video games club', from: 10, blurb: 'Tournaments in the computer lab after school.',
    yearly: { stats: { mood: 2 } } },
];
export const CLUB_BY_ID = Object.fromEntries(CLUBS.map((c) => [c.id, c]));
export const MAX_CLUBS = 3;

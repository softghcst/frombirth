// Martial arts (engine/martial.js): each style with its ranks and the moves learned on the way up. A course of lessons
// moves you along; every second course is a new rank, and every rank brings a move. Moves are what you have when a fight
// finds you (or you start one): engine/martial.js fightEdge.
const COLORED = ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Black'];

export const STYLES = [
  { id: 'jiujitsu', name: 'Jiu-jitsu', from: 'Brazil', minAge: 5, ranks: ['White', 'Blue', 'Purple', 'Brown', 'Black'], perRank: 4,
    moves: ['Rear Naked Choke', 'Armbar', 'Triangle Choke', 'Kimura', 'Guard Pass', 'Sweep', 'Omoplata', 'Heel Hook'] },
  { id: 'judo', name: 'Judo', from: 'Japan', minAge: 5, ranks: COLORED, perRank: 2,
    moves: ['Hip Throw', 'Shoulder Throw', 'Foot Sweep', 'Body Drop', 'Pin Hold', 'Inner Thigh Throw', 'Sacrifice Throw', 'Strangle Hold'] },
  { id: 'karate', name: 'Karate', from: 'Japan', minAge: 5, ranks: COLORED, perRank: 2,
    moves: ['Front Kick', 'Reverse Punch', 'Knife Hand Strike', 'Roundhouse Kick', 'Back Fist', 'Crescent Kick', 'Elbow Strike', 'Spinning Back Kick'] },
  { id: 'kravmaga', name: 'Krav maga', from: 'Israel', minAge: 12, ranks: COLORED, perRank: 2,
    moves: ['Palm Strike', 'Knee to the Gut', 'Headbutt', 'Gun Disarm', 'Knife Defense', 'Choke Escape', 'Groin Kick', 'Third-Party Rescue'] },
  { id: 'kungfu', name: 'Kung fu', from: 'China', minAge: 5, ranks: COLORED, perRank: 2,
    moves: ['Tiger Claw', 'Crane Kick', 'Snake Strike', 'Monkey Steals the Peach', 'Iron Palm', 'Dragon Whip', 'Mantis Hook', 'Eagle Talon'] },
  { id: 'taekwondo', name: 'Taekwondo', from: 'South Korea', minAge: 5, ranks: COLORED, perRank: 2,
    moves: ['Eagle Strike', 'Axe Kick', 'Tornado Kick', 'Side Kick', 'Back Kick', 'Hook Kick', 'Jumping Spin Kick', '540 Kick'] },
  { id: 'boxing', name: 'Boxing', from: 'England', minAge: 8, ranks: ['Novice', 'Amateur', 'Club fighter', 'Golden Gloves', 'Contender'], perRank: 3,
    moves: ['Jab', 'Cross', 'Left Hook', 'Uppercut', 'Body Shot', 'Slip and Counter', 'One-Two', 'Haymaker'] },
  { id: 'muaythai', name: 'Muay thai', from: 'Thailand', minAge: 10, ranks: ['Beginner', 'Intermediate', 'Advanced', 'Kru'], perRank: 3,
    moves: ['Teep', 'Elbow Slash', 'Clinch Knee', 'Low Kick', 'Spinning Elbow', 'Superman Punch', 'Flying Knee', 'Head Kick'] },
];
export const STYLE_BY_ID = Object.fromEntries(STYLES.map((s) => [s.id, s]));
/** A course of lessons, in base units (a child's is paid at home). */
export const MARTIAL_COURSE = 250;
/** Courses a year, across every style. */
export const COURSES_A_YEAR = 2;

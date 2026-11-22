// Scenes sent by the school engine (engine/schoollife.js). Each is about real
// people in the player's class or on the staff, named in the scene, and each
// choice goes back to the engine, which knows who they are.
import { any } from './helpers.js';

const school = (value) => ({ type: 'school', value });
const scene = (id, ageRange, text, choices) => ({ id, category: 'school', ageRange, queuedOnly: true, text,
  choices: choices.map(([label, line, value]) => ({ label, outcomes: [any(line, 'neutral', school(value))] })) });

export default [
  // A new school: where, what kind, and for how long. Told when a stage of school begins (engine/schooling.js enter).
  scene('school_start', [4, 19], 'A new school: {school}. {kind}, {stage}, {years} years.', [
    ['Here we go', 'You find your new classroom.', 'startOk'],
  ]),
  // The last year of high school: nominated for prom {title} (engine/schoollife.js). Each pitch rests on something different.
  scene('prom_royalty', [16, 19], 'You have been nominated for prom {title} at {school}, and every nominee gives a short speech in the gym. What is yours?', [
    ['"I\'m the smartest one here"', 'You step up to the microphone.', 'promSmart'],
    ['"Look at me"', 'You step up to the microphone.', 'promLooks'],
    ['"I\'m the strongest, and the most fun"', 'You step up to the microphone.', 'promStrong'],
    ['Make them laugh', 'You step up to the microphone.', 'promFunny'],
  ]),
  scene('first_day_school', [4, 8], 'Your first day of school. The room is loud and smells of floor polish, and everyone seems to know where to sit except you. The child at the next peg is called {mate}.', [
    ['Say hello', 'You say your name, too quietly, and then again.', 'firstHello'],
    ['Stay close to the wall', 'You hold on to the strap of your bag.', 'firstHide'],
  ]),
  scene('class_birthday', [6, 13], '{mate} from your class is having a birthday party on Saturday, and there is an invitation in your bag with your name spelled wrong.', [
    ['Go', 'You wrap a present with too much tape.', 'partyGo'],
    ['Say you are busy', 'You leave the invitation in your bag.', 'partySkip'],
  ]),
  scene('best_friend_moves', [8, 17], '{mate} has news, and cannot look at you while telling it: the family is moving to another city at the end of term.', [
    ['Promise to keep in touch, and mean it', 'You swap addresses on the back of an exercise book.', 'moveWrite'],
    ['Say it will be fine', 'You say you will see each other all the time.', 'moveDrift'],
  ]),
  scene('friends_quarrel', [10, 18], '{one} and {two} have fallen out, badly, over something neither will explain. Each of them has told you their side, and each expects you to agree.', [
    ['Take {one}\'s side', 'You say what you think.', 'sideOne'],
    ['Take {two}\'s side', 'You say what you think.', 'sideTwo'],
    ['Try to bring them back together', 'You refuse to choose.', 'sideNone'],
  ]),
  scene('school_rumor', [11, 18], 'There is a story going round about you. It is not true, and it is not kind, and you are fairly sure it started with {mate}.', [
    ['Ask {mate} about it, face to face', 'You wait by the lockers.', 'rumorConfront'],
    ['Say nothing and let it die', 'You keep your head up.', 'rumorIgnore'],
    ['Tell a teacher', 'You stay behind after a lesson.', 'rumorTell'],
  ]),
  scene('school_bullied', [7, 16], '{again}{bully} has started on you: your bag in the trash, your name said in a certain voice, a shove on the stairs when nobody is looking. It is every day now.', [
    ['Tell a teacher', 'You knock on the staffroom door.', 'bullyTeacher'],
    ['Tell them at home', 'You wait until after dinner.', 'bullyParents'],
    ['Stand up to {bully}', 'You stop walking away.', 'bullyStand'],
    ['Tell nobody', 'You decide you can manage.', 'bullyEndure'],
  ]),
  scene('teacher_believes', [9, 18], '{teacher}, who teaches you {subject}, asks you to stay behind. You are not in trouble. "You are better at this than you think. I have something harder, if you want it."', [
    ['Take it', 'You say yes before you can think of a reason not to.', 'teacherYes'],
    ['Say you have too much on', 'You look at your shoes.', 'teacherNo'],
  ]),
  scene('cheating_accused', [12, 18], 'Your {subject} test comes back with no mark on it. {teacher} says, in front of everyone, that your answers are the same as the person beside you, and asks which of you copied. It was not you.', [
    ['Explain, calmly', 'You ask to show how you got there.', 'cheatCalm'],
    ['Lose your temper', 'You stand up.', 'cheatAngry'],
    ['Take the blame to end it', 'You say nothing.', 'cheatAccept'],
  ]),
  scene('school_dance', [14, 18], 'The school dance is in three weeks, and it is all anyone talks about. You keep finding yourself near {mate}.', [
    ['Ask {mate} to go with you', 'You rehearse it four times and say it wrong.', 'danceAsk'],
    ['Go with your friends', 'You make a plan.', 'danceFriends'],
    ['Give it a miss', 'You tell everyone it is not your thing.', 'danceHome'],
  ]),
  scene('school_audition', [8, 18], 'Auditions for {play}, this year\'s production by the {club}, are on Thursday. {rival} is going for the same part you want.', [
    ['Do the speech you know you can do', 'You choose the safe piece.', 'auditionSafe'],
    ['Try something that could go wonderfully or terribly', 'You choose the piece that frightens you.', 'auditionBold'],
  ]),
  scene('final_exams', [16, 18], 'This is the last year of school, and at the end of it are the exams that decide what you leave with. Everyone has a theory about how to prepare.', [
    ['Start now, a little every day', 'You draw up a timetable.', 'examSteady'],
    ['Leave it, then cram', 'You put the books back on the shelf.', 'examCram'],
    ['Carry on as usual', 'You do not change a thing.', 'examTrust'],
  ]),
  scene('graduation_day', [17, 19], 'The last day of school. {honors}The hall is too hot, the speeches are too long, and half the people you have sat beside for years you may never see again.', [
    ['Go to the party with your class', 'You find your friends in the crowd.', 'gradParty'],
    ['Celebrate with your family', 'You find your family by the doors.', 'gradFamily'],
    ['Slip away quietly', 'You leave before the photographs.', 'gradQuiet'],
  ]),
];

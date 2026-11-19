// The rest of the stories of a life lived among other people: private relationships, marriages, children in more than
// one household, family secrets, what is left behind, and being a teenager with someone. Each is told only when the
// world makes it true (engine/familyStories.js holds the test for each, by id); nothing here is drawn by chance.
//
//   choice: [label, what happens, effects]   effects: rel (the person), mood, cash (spent, in base money), trust (with
//   a partner), will (willpower), fn (a named change to the world), close (never told of them again)
//   {them} is the person it is about; {other} and {gone} are named in words.
const T = [14, 17];
const A = [18, 120];

export const FAMILY = [
  // ---------- Private relationships ----------
  { id: 'secret_encounter', ages: A, again: 3, text: 'An Unexpected Encounter. You are in a restaurant, and so is someone who knows you. {them} is across the room, and so, at the next table, is a person you would rather they did not see you with.', choices: [
    ['Say hello, and introduce them as a friend', 'You do it easily. Nobody asks a second question.', { mood: 2 }],
    ['Pretend not to see anyone', 'You study the menu. You feel it all evening.', { mood: -3 }],
    ['Leave separately, quickly', 'You go. The meal is left to the waiter.', { mood: -2, rel: -2 }]] },
  { id: 'secret_public', ages: A, again: 4, text: 'A Private Conversation Becomes Public. Someone overheard you and {them} on the phone, and told someone else. It is going round.', choices: [
    ['Tell your partner yourself, first', 'You sit them down before anyone else can.', { fn: 'confess' }],
    ['Deny it', 'You say it is a misunderstanding. They are not sure.', { trust: -4, mood: -3 }],
    ['Ask {them} to say nothing', 'They agree, with a look you do not like.', { rel: -4 }]] },
  { id: 'secret_stayed', ages: A, again: 6, text: 'The Person Who Stayed. You have not been together for years, and {them} is still, somehow, in your life: at the wedding, at the funeral, on the end of the phone.', choices: [
    ['Tell them what they mean to you', 'You say it plainly. They are touched.', { rel: 6, mood: 3 }],
    ['Ask what they want from you now', '"Nothing," {them} says. "That is rather the point."', { rel: 3 }],
    ['Let it be what it is', 'You do not say anything, and nothing is lost.', { close: true }]] },
  { id: 'secret_clean_break', ages: A, again: 4, text: 'A Clean Break. Things at home are good, better than they have been in a long time. {them} is still there, and you know what that is costing everyone.', choices: [
    ['End it, today', 'You tell {them} it is over. It is quick and it is unkind and it is done.', { fn: 'endIt' }],
    ['Not yet', 'You tell yourself you will, soon.', { mood: -2 }],
    ['Tell your partner everything', 'You choose honesty, and its price.', { fn: 'confess' }]] },
  { id: 'truth_trust', ages: A, again: 3, text: 'Trust, Slowly. {them} has been trying, and so have you, since what happened. Tonight they ask a question that is not about the past at all.', choices: [
    ['Answer it fully', 'You tell them everything, and nothing is held back.', { rel: 6, trust: 6 }],
    ['Say you are not ready to talk yet', 'You ask for time. They give it.', { rel: 1, trust: 1 }],
    ['Change the subject', 'They notice. They say nothing.', { rel: -3, trust: -3 }]] },
  { id: 'truth_friend', ages: A, again: 6, text: 'A Friend Knew. {them} tells you, quietly, that they knew about all of it, for a long time, and kept it. "I did not know what else to do."', choices: [
    ['Thank them for keeping it', 'You say it was a kindness. They are relieved.', { rel: 4 }],
    ['Ask why they never said', 'You hear them out. It was never going to be easy.', { rel: 2 }],
    ['Be angry they did not tell you what they thought', 'You say it, and regret half of it.', { rel: -8 }]] },

  // ---------- Marriage and partnership ----------
  { id: 'marriage_question', ages: A, again: 4, text: 'A Question of Marriage. You and {them} have been together long enough that people have started to ask. Tonight, {them} asks too: "Where do you think this is going?"', choices: [
    ['Say you want to marry them, someday', 'You say it, and {them} lights up.', { rel: 8, mood: 4 }],
    ['Say you are not ready', 'You are honest. It is not what they hoped.', { rel: -5 }],
    ['Suggest waiting another year', '"All right," {them} says. "One more year."', { rel: 0 }]] },
  { id: 'marriage_dreams', ages: A, again: 6, text: 'A Shared Home, Different Dreams. {them} has been quietly reading about something they have always wanted: a life you had not imagined. They put it on the table.', choices: [
    ['Hear them out, properly', 'You listen to all of it, and it changes how you see them.', { rel: 6, mood: 2 }],
    ['Say you want something else', 'You say what you want. It is not the same.', { rel: -4, will: 1 }],
    ['Say you will think about it', 'You do, for a long time.', { rel: 1 }]] },
  { id: 'marriage_city', ages: A, again: 7, text: 'A New Job in a New City. {them} has been offered a chance elsewhere. It is far away. They have not said yes.', choices: [
    ['Say you will move with them', 'You say you will go where they go.', { rel: 8, mood: -1 }],
    ['Ask them to turn it down', 'You ask. They say they will think.', { rel: -6 }],
    ['Try it apart, for a year', 'You agree to try it long distance, and mean it.', { rel: 2, mood: -3 }]] },
  { id: 'marriage_money', ages: A, again: 5, text: 'The Money Conversation. A bill arrives that neither of you expected, and it is not really about the bill.', choices: [
    ['Go through everything together', 'It takes an evening. You are both surprised at what you did not know.', { rel: 5, trust: 3 }],
    ['Keep your money separate', 'You agree on a line, and keep to it.', { rel: -2 }],
    ['Say it is not a problem', 'It is a problem. You both know.', { rel: -3 }]] },
  { id: 'marriage_fight', ages: A, again: 5, text: 'A Relationship Worth Fighting For. You and {them} have been drifting. Neither of you has said it. {them} finally does.', choices: [
    ['Find a counselor', 'You both go. It is harder than you thought, and it works a little.', { rel: 8, trust: 4, cost: 1500 }],
    ['Write them a letter', 'You write what you have not said aloud. They keep it.', { rel: 5 }],
    ['Give it time', 'You do nothing, hopefully.', { rel: -3 }]] },
  { id: 'marriage_vacation', ages: A, again: 4, text: 'The Vacation That Changed Things. A week away with {them}, with no phone and nowhere else to be. You remember why you chose each other.', choices: [
    ['Take them somewhere you have never been', 'A week of wrong turns and long dinners.', { rel: 8, mood: 8, cost: 3000 }],
    ['Stay at home and call it a vacation', 'It is nice. It is not the same.', { rel: 2, mood: 2 }],
    ['Say you cannot get away', 'You cannot. You do not say it kindly.', { rel: -3 }]] },
  { id: 'marriage_boundaries', ages: A, again: 4, text: 'A Conversation About Boundaries. The arrangement between you and {them} has worked. Tonight {them} wants to talk about where it stops.', choices: [
    ['Agree rules you can both keep', 'You write them down. It is oddly romantic.', { rel: 5, trust: 4 }],
    ['Say you would rather it was just the two of you', 'You say it. It is a long conversation.', { fn: 'closeUp' }],
    ['Say you want things to stay as they are', 'You say so. They accept, for now.', { rel: -1 }]] },

  // ---------- Children, households and family secrets ----------
  { id: 'child_unknown', ages: A, again: 5, text: 'A Child Your Partner Does Not Know About. {them} does not know that you have a child with someone else. It has not come up. It will.', choices: [
    ['Tell them now', 'You tell them. It is hard, and it is better said by you.', { fn: 'tellChild' }],
    ['Wait for a better time', 'There is never a better time.', { mood: -2 }],
    ['Ask the other parent to keep it quiet', 'They agree. It costs something.', { mood: -3 }]] },
  { id: 'half_meet', ages: A, again: 6, text: 'Meeting a Half-Sibling. {them} has a half-brother or sister, {other}, and they have never really met. You have arranged an afternoon.', choices: [
    ['Take them both to the park', 'They are shy, and then they are not.', { rel: 6, mood: 4 }],
    ['Leave them to it, at home', 'You listen from the kitchen. It goes well.', { rel: 4 }],
    ['Put it off again', 'There is always another weekend.', { rel: -3 }]] },
  { id: 'two_households', ages: A, again: 6, text: 'Two Households. Your children live in different homes, with different rules, and they notice. One of them says, "It is not fair."', choices: [
    ['Make time for each of them', 'You give each of them an afternoon, just them and you.', { mood: 3, rel: 3 }],
    ['Talk to the other parent about how to do it', 'The two of you agree some things, and disagree about others.', { mood: 1 }],
    ['Tell them life is not always fair', 'It is true. It is not what they wanted.', { rel: -4 }]] },
  { id: 'questions_past', ages: A, again: 5, text: 'Questions About the Past. {them} is old enough now to ask: why you and their other parent are not together, and what happened.', choices: [
    ['Tell them honestly, kindly', 'You tell them the truth, as much as a child can hold.', { rel: 6, mood: 2 }],
    ['Say they will understand when they are older', 'They look at you, and then at the floor.', { rel: -4 }],
    ['Suggest they ask the other parent', 'They will. You wonder what they will hear.', { rel: -1 }]] },
  { id: 'parent_reaches', ages: A, again: 6, text: 'A Parent Reaches Out. {them} has not been a presence for years. This week they wrote, a few careful lines, and asked if you would see them.', choices: [
    ['Meet them', 'You meet. It is not what you expected, and it is a start.', { rel: 8, mood: 3 }],
    ['Write back, and keep it at a distance', 'You write. You are not ready for more.', { rel: 3 }],
    ['Do not reply', 'You put the letter in a drawer.', { rel: -5, close: true }]] },
  { id: 'family_gathering', ages: A, again: 4, text: 'A Family Gathering. Everyone is coming: the ones you love, and the ones you manage. Someone has to cook, and someone has to keep the peace.', choices: [
    ['Host it yourself', 'It is exhausting, and it is the best day of the year.', { mood: 6, cost: 800 }],
    ['Go, and keep out of the arguments', 'You eat, and listen, and leave early.', { mood: 2 }],
    ['Stay home', 'Nobody says anything. Everyone notices.', { mood: -3 }]] },
  { id: 'blended_family', ages: A, again: 6, text: 'A Blended Family. {them} and your children are working out how to be in a house together. It is mostly fine. This week it is not.', choices: [
    ['Sit them all down, together', 'Nobody likes it. It helps.', { rel: 5, mood: 2 }],
    ['Talk to each of them alone', 'You hear everything this way.', { rel: 3 }],
    ['Let them sort it out', 'They do, more or less.', { rel: -2 }]] },
  { id: 'secret_story', ages: A, again: 8, text: 'The Secret Becomes a Story. A few people know what happened, and now it is told at family gatherings as a story, with a funny voice and a moral that was not there at the time.', choices: [
    ['Laugh along', 'You do. It stops being a secret.', { mood: 2 }],
    ['Say you would rather it was not told', 'They stop. Somebody mutters.', { mood: -1 }],
    ['Tell it yourself, properly', 'You tell it straight, and it is different.', { mood: 3, will: 1 }]] },

  // ---------- Inheritance and legacy ----------
  { id: 'house_history', ages: A, again: 10, text: 'A House With History. You have lived in your home long enough that it has become part of the family. Someone asks what will become of it.', choices: [
    ['Say it will stay in the family', 'You say it, and mean it.', { mood: 3 }],
    ['Say you have not decided', 'You have not, and it is honest.', { mood: 0 }],
    ['Say it will be sold, in time', 'There are some who mind.', { mood: -2 }]] },
  { id: 'family_decision', ages: A, again: 8, text: 'A Family Decision. People have been talking about what is in your will, and what they think is fair. Nobody has asked you. It is in the room.', choices: [
    ['Tell them what you have decided', 'It takes courage. Most of them take it well.', { mood: 2 }],
    ['Say it is private', 'It is. It also leaves them guessing.', { mood: -1 }],
    ['Say you will look at it again', 'You will. That is the honest answer.', { mood: 0 }]] },
  { id: 'unexpected_responsibility', ages: A, again: 4, text: 'An Unexpected Responsibility. {them} is not coping as well as they were. Someone will have to help, and everyone has looked at you.', choices: [
    ['Take it on yourself', 'You do. It is more than you thought.', { rel: 8, mood: -3 }],
    ['Share it among the family', 'You organize a rota. It works, mostly.', { rel: 4 }],
    ['Pay for help', 'It is the kindest thing you can afford.', { rel: 4, cost: 2000 }]] },
  { id: 'legacy_left', ages: A, again: 20, text: 'What They Left. {gone} died not long ago. You have been going through their things, and found something that was clearly meant for you.', choices: [
    ['Keep it close', 'You do. It is a way of keeping them.', { mood: 5 }],
    ['Share it with the family', 'You pass it round. There are tears, and laughter.', { mood: 3 }],
    ['Put it away for now', 'You will look again when you can.', { mood: -1 }]] },

  // ---------- Teenagers ----------
  { id: 'teen_crush', ages: T, again: 3, text: 'A Crush, and What Next. You like {them}, and you are almost sure they like you. You have not said anything. It is all you think about.', choices: [
    ['Tell them how you feel', 'You do it badly, and it works out well enough.', { rel: 6, mood: 3 }],
    ['Keep it to yourself', 'You tell nobody. It passes, or it does not.', { mood: -1 }],
    ['Ask a friend what they think', 'Your friend laughs, and helps.', { mood: 2 }]] },
  { id: 'teen_rumor', ages: T, again: 3, text: 'A Rumor at School. Something is going round about {them}, and you can tell it is not true. It is spreading anyway.', choices: [
    ['Stand up for them', 'You say it is not true, to anyone who will listen.', { rel: 8, mood: -1 }],
    ['Stay out of it', 'You say nothing. It is easier.', { rel: -4 }],
    ['Tell a teacher', 'It is dealt with, quietly.', { rel: 4 }]] },
  { id: 'teen_family', ages: T, again: 3, text: 'Meeting the Family. {them} has asked you to dinner at theirs. Their family is not like yours. You change your shirt three times.', choices: [
    ['Go, and be yourself', 'It goes well, mostly.', { rel: 6, mood: 3 }],
    ['Go, and say as little as possible', 'You survive. They are kind.', { rel: 2 }],
    ['Say you are busy', '{them} is hurt, and does not say so.', { rel: -5 }]] },
  { id: 'teen_breakup', ages: T, again: 3, text: 'A Difficult Breakup, After. It has been weeks since you and {them} ended it. You still see them every day.', choices: [
    ['Be kind, and keep your distance', 'It gets easier.', { rel: 3, mood: 2 }],
    ['Be cold to them', 'It does not help either of you.', { rel: -6, mood: -2 }],
    ['Talk to someone about how you feel', 'You do. It lifts a little.', { mood: 4, will: 1 }]] },
  { id: 'teen_promise', ages: [17, 17], again: 3, text: 'A Promise About the Future. You and {them} are nearly done with school, and have started talking about the years after. Somebody says "forever."', choices: [
    ['Say you want to see where life takes you both', 'It is honest, and it is gentle.', { rel: 3 }],
    ['Promise, and mean it', 'You promise. Whether you can keep it, the years will say.', { rel: 6, mood: 2 }],
    ['Say you cannot promise that', 'You are honest. It stings, and it is fair.', { rel: -4 }]] },
];

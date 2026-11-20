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

  // ---------- Grandchildren, step-families and households ----------
  { id: 'grandchild_visit', ages: A, again: 3, text: 'A Grandchild Stays Over. {them} is staying for the weekend, with a bag that is mostly toys. The house is going to be loud.', choices: [
    ['Bake something together', 'There is flour on every surface, and on both of you.', { rel: 7, mood: 5 }],
    ['Tell them stories from when you were young', 'They listen with their whole face.', { rel: 6, mood: 3 }],
    ['Let them watch whatever they like', 'It is peaceful. It is not a memory.', { rel: 2, mood: 1 }]] },
  { id: 'grandchild_questions', ages: A, again: 5, text: 'What Was It Like? {them} has been given a school project about the past, and you are the oldest person they know.', choices: [
    ['Tell them everything, even the hard parts', 'You talk until it is dark, and they write it down.', { rel: 8, mood: 4 }],
    ['Tell them the funny parts', 'They laugh all the way home.', { rel: 5, mood: 3 }],
    ['Say you do not remember it well', 'You do. It was easier.', { rel: -2 }]] },
  { id: 'stepchild_trust', ages: A, again: 4, text: 'A Stepchild Tests the Water. {them} has never quite known what to call you. Today, unprompted, they ask you for help with something that matters to them.', choices: [
    ['Drop everything to help', 'It is a small thing, and it is not small at all.', { rel: 9, mood: 3 }],
    ['Help, and say it is no trouble', 'They nod, and relax a little.', { rel: 5 }],
    ['Suggest they ask their parent', 'They go, and do not ask you again for a while.', { rel: -6 }]] },
  { id: 'stepparent_new', ages: [14, 17], again: 4, text: 'A New Person in the House. {them} is not your parent, and you are not sure what they are. They have made you your favorite dinner, and are watching you eat it.', choices: [
    ['Say thank you, and mean it', 'It is not nothing. They smile.', { rel: 7, mood: 2 }],
    ['Eat in silence', 'They do not say anything. Neither do you.', { rel: -2 }],
    ['Say you did not ask them to', 'You say it, and it lands as badly as you thought.', { rel: -8, mood: -2 }]] },
  { id: 'coparent_handover', ages: A, again: 4, text: 'The Handover. {them} has your child for the week, and you meet halfway, as you always do. This time neither of you is in a hurry.', choices: [
    ['Take a few minutes to talk properly', 'It is the longest conversation in a year, and it is civil.', { rel: 6, mood: 2 }],
    ['Keep it quick and polite', 'It is efficient. Nobody is hurt.', { rel: 1 }],
    ['Bring up an old grievance', 'It does not go well, in front of the child.', { rel: -8, mood: -3 }]] },
  { id: 'coparent_holiday', ages: A, again: 4, text: 'Whose Holiday Is It? Both of you want the child for the holiday, and neither is willing to say it plainly.', choices: [
    ['Offer to alternate, and start with them', 'It costs you a holiday, and buys you peace.', { rel: 6, mood: -2 }],
    ['Suggest a day each', 'It is fair, and tiring.', { rel: 3 }],
    ['Insist on this year', 'You get it. You will pay for it later.', { rel: -7 }]] },
  { id: 'custody_words', ages: A, again: 5, text: 'Words About Custody. Things with {them} have been bad for a while. Today a message comes that mentions lawyers.', choices: [
    ['Ring and ask to talk it through', 'It is awkward, and it is the right thing.', { rel: 6, mood: -1 }],
    ['Get your own advice first', 'You see a lawyer, and it costs.', { rel: -3, cost: 2500 }],
    ['Ignore it', 'It does not go away.', { rel: -6, mood: -3 }]] },
  { id: 'wants_to_live', ages: A, again: 4, text: '"Can I Live With You?" {them} has been thinking about it for a while. They have a speech ready, and it comes out all at once.', choices: [
    ['Say yes, and mean it', 'You say yes. It will not be simple, and it is right.', { fn: 'takeIn' }],
    ['Say you need to talk to their other parent first', 'You do, and it is honest.', { rel: 2 }],
    ['Say now is not the right time', 'They take it quietly. They are not sure you mean it.', { rel: -8 }]] },
  { id: 'child_graduates', ages: A, again: 3, text: 'Your Child Graduates. {them} is walking across a stage, in a gown that is slightly too big. You are in the third row, not quite able to see for tears.', choices: [
    ['Throw a party', 'It is too loud, and everyone says it was the best.', { rel: 6, mood: 6, cost: 1200 }],
    ['Take them out for dinner, just the two of you', 'You say the things you have been meaning to.', { rel: 8, mood: 4, cost: 200 }],
    ['Say well done, and go home', 'You are proud. You do not say so enough.', { rel: -2 }]] },
  { id: 'quiet_house', ages: A, again: 8, text: 'A Quiet House. The last of the children has gone, and the house is the quietest it has been in decades. {them} comes into the kitchen and says, "Well."', choices: [
    ['Suggest a trip somewhere you have always meant to go', 'You book it that night.', { rel: 7, mood: 5, cost: 4000 }],
    ['Say you could do with a rest', 'You do nothing for a week. It is wonderful.', { rel: 2, mood: 3 }],
    ['Say you miss the noise', 'They say they do too. You hold hands, and say nothing.', { rel: 5, mood: -1 }]] },

  // ---------- Siblings, cousins and the wider family ----------
  { id: 'sibling_rivalry', ages: A, again: 5, text: 'An Old Rivalry. {them} said something at lunch that was not about lunch, and you have both been replaying it since you were twelve.', choices: [
    ['Bring it up, kindly', 'It takes an hour. Twenty years of it comes out.', { rel: 9, mood: 3 }],
    ['Let it go, again', 'You do. It will come back.', { rel: -1 }],
    ['Say it back, harder', 'It is satisfying for about a minute.', { rel: -9, mood: -2 }]] },
  { id: 'sibling_midnight', ages: A, again: 4, text: 'A Phone Call at Midnight. It is {them}. They do not have a reason, they say. They just did not want to be on their own.', choices: [
    ['Stay on the line as long as they like', 'You talk until the birds start.', { rel: 8, mood: 2 }],
    ['Say you will see them in the morning', 'You do. They are grateful.', { rel: 6, mood: -1 }],
    ['Say it is late, and ring tomorrow', 'You do. It is not the same.', { rel: -4 }]] },
  { id: 'cousin_wedding', ages: A, again: 6, text: 'A Cousin Gets Married. {them} is getting married, and the whole family is going to be in one room for the first time in years.', choices: [
    ['Go, and dance', 'You do. It is the best night of the year.', { rel: 5, mood: 6, cost: 400 }],
    ['Go for the ceremony, and leave', 'You do your duty, and slip away.', { rel: 2 }],
    ['Send a gift and your regrets', 'It is a nice gift. It is not the same.', { rel: -3, cost: 150 }]] },
  { id: 'relative_advice', ages: A, again: 5, text: 'Advice From an Elder. {them} has noticed that things have not been easy, and takes you aside. "Come and sit down. I am not going to tell you what to do."', choices: [
    ['Listen to all of it', 'They tell you a story you have never heard. It helps.', { rel: 8, mood: 3, will: 1 }],
    ['Thank them, and say you have it in hand', 'They nod. They have said it before.', { rel: 2 }],
    ['Say you would rather work it out yourself', 'You mean it. They look a little sad.', { rel: -3, will: 1 }]] },

  // ---------- Loss, friendship and the long middle ----------
  { id: 'widowed_year', ages: A, again: 3, text: 'The First Year After. It has been months since {gone} died. You find their coat on the hook, and for the first time you cannot walk past it.', choices: [
    ['Sit with it, as long as it takes', 'You let it come. It is awful, and then it is lighter.', { mood: 3 }],
    ['Call a friend', 'You do. They come at once.', { mood: 4 }],
    ['Keep busy', 'It helps, and it will not for ever.', { mood: -2 }]] },
  { id: 'after_loss_new', ages: A, again: 6, text: 'A New Someone, After. {them} has been part of your life for a while now. You have been wondering whether to let that mean what it might.', choices: [
    ['Tell them how you feel', 'It is frightening, and it is good.', { rel: 8, mood: 4 }],
    ['Say you are not ready', 'They understand, and wait.', { rel: 1 }],
    ['Say there is no room for anyone else', 'It hurts them. It hurts you.', { rel: -8 }]] },
  { id: 'old_friend_writes', ages: A, again: 5, text: 'An Old Friend Writes. A letter from {them}, which you have owed an answer for some time. They say they were thinking about you.', choices: [
    ['Ring them tonight', 'The call goes on for two hours.', { rel: 12, mood: 4 }],
    ['Write back, properly', 'It takes a long evening, and it is worth it.', { rel: 8, mood: 2 }],
    ['Put it off', 'It is still on the table.', { rel: -4 }]] },
  { id: 'friend_trouble', ages: A, again: 4, text: 'A Friend in Trouble. {them} has been unwell for a while and not said so. This week it comes out, awkwardly, in the car.', choices: [
    ['Be there, whatever it takes', 'You are there. It is exhausting, and you would do it again.', { rel: 10, mood: -2 }],
    ['Help them find help', 'You find a doctor, and go with them.', { rel: 6, cost: 300 }],
    ['Say you are sure it will be fine', 'It is the wrong thing, and they know.', { rel: -6 }]] },
  { id: 'friend_big_news', ages: A, again: 5, text: 'A Friend\'s Big News. {them} has something to tell you in person. It is the sort of news you cannot say on the phone.', choices: [
    ['Take them out to celebrate', 'You do. It becomes a long dinner.', { rel: 7, mood: 5, cost: 200 }],
    ['Be happy for them, and ring later', 'You do, and mean it.', { rel: 4 }],
    ['Feel jealous, and hide it badly', 'It shows. They are kind about it.', { rel: -3, mood: -2 }]] },
  { id: 'long_marriage', ages: A, again: 5, text: 'Years Together. {them} has remembered what today is, and has a card, and a look on their face you have not seen in years.', choices: [
    ['Take them to where it all began', 'You go. You are both older, and it is the same place.', { rel: 9, mood: 6, cost: 600 }],
    ['Cook for them, at home', 'It is simple, and it is perfect.', { rel: 6, mood: 4 }],
    ['Say the card is enough', 'It is. It is not what they wanted.', { rel: -2 }]] },
  { id: 'tradition', ages: A, again: 6, text: 'A Tradition of Your Own. You and {them} have a small ritual that nobody else knows about. This year, someone asks why you do it.', choices: [
    ['Tell the whole story', 'It is nicer than you remembered.', { rel: 6, mood: 3 }],
    ['Say it is a private thing', 'It is. You smile at each other.', { rel: 4 }],
    ['Say you do not remember', 'It is not true, and they know.', { rel: -4 }]] },
  { id: 'retirement_plans', ages: A, again: 5, text: 'Plans for Retirement. You and {them} have been putting off the conversation about what comes after work. Tonight there is a spreadsheet.', choices: [
    ['Go through it line by line', 'It is not romantic. It is a relief.', { rel: 5, mood: 3 }],
    ['Dream first, and count later', 'It is a lovely evening, and the numbers are still there.', { rel: 4, mood: 4 }],
    ['Say you will work as long as you can', 'They sigh. You are not wrong.', { rel: -3 }]] },
  { id: 'ex_died', ages: A, again: 20, text: 'An Ex Has Died. You hear it by message: {gone} is dead. You had not spoken in a long time, and it still goes through you.', choices: [
    ['Go to the funeral', 'You stand at the back. It is the right place.', { mood: -2 }],
    ['Write to their family', 'You find some words. It helps them, and you.', { mood: 1 }],
    ['Grieve privately', 'You light a candle, and let it be.', { mood: -1 }]] },
  { id: 'child_money', ages: A, again: 3, text: 'A Grown Child Asks for Money. {them} is not someone who asks. They have run out of options, and it is clear how much it cost them to ring.', choices: [
    ['Give it, no questions', 'You hand it over, and they cry.', { rel: 9, cost: 5000 }],
    ['Lend it, with terms', 'It is sensible, and it stings a little.', { rel: 3, cost: 2500 }],
    ['Say no', 'You say it kindly. It is still no.', { rel: -8 }]] },
];

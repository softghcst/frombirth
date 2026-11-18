// STORYLINE: digital life. These scenes are never drawn at random: the
// Digital World Engine finds them in saved state (engine/digital/stories.js)
// and queues them, with the real people involved. Their choices go back to the
// same engine through the `digital` effect.
const d = (value) => ({ type: 'digital', value });
const out = (text, ...effects) => [{ on: 'always', text, effects }];

/** @type {import('../../../types.js').GameEvent[]} */
export default [
  {
    id: 'digital_reconnect', category: 'digital', ageRange: [18, 120], queuedOnly: true, cooldown: 0,
    text: 'You came across {friend}\'s profile on {platform}. It has been {years} years since you were last in touch. Would you like to reconnect?',
    choices: [
      { label: 'Send a friendly message', outcomes: out('You wrote a few lines, deleted them, wrote them again, and sent them.', d('reconnect:message')) },
      { label: 'Follow without messaging', outcomes: out('You followed {friend}, and left it at that.', d('reconnect:follow')) },
      { label: 'Leave things as they are', outcomes: out('Some friendships belong to a particular time. You closed the page.', d('reconnect:leave')) },
    ],
  },
  {
    id: 'digital_first_video', category: 'digital', ageRange: [13, 19], queuedOnly: true, once: true,
    text: 'You have been {what} for years now, mostly for yourself. A friend says you should put a video of it on {platform}.',
    choices: [
      { label: 'Post a performance', outcomes: out('You filmed it eleven times and posted the fourth.', d('video:post')) },
      { label: 'Keep it to yourself', outcomes: out('You decided it was yours, for now. Nothing wrong with that.', d('video:keep')) },
    ],
  },
  {
    id: 'digital_ancestor', category: 'digital', ageRange: [8, 120], queuedOnly: true, cooldown: 0,
    text: 'Clearing out an old drawer, you find a note with {ancestor}\'s old usernames on it. Their public posts are still out there, kept in the family archive.',
    choices: [
      { label: 'Look through them', outcomes: out('Photographs, small jokes, the things that mattered to {ancestor} in a year you never saw.', d('ancestor:watch')) },
      { label: 'Not now', outcomes: out('You put the note back. It will keep.', d('ancestor:later')) },
    ],
  },
  {
    id: 'digital_controversy', category: 'digital', ageRange: [13, 120], queuedOnly: true, cooldown: 0,
    text: '{what} How do you respond?',
    choices: [
      { label: 'Correct the record with facts', outcomes: out('You wrote it out carefully, with the facts.', d('cv:correct')) },
      { label: 'Apologise', outcomes: out('You posted an apology.', d('cv:apologize')) },
      { label: 'Get professional advice first', outcomes: out('You called someone who handles this for a living.', d('cv:advice')) },
      { label: 'Say nothing and let it pass', outcomes: out('You stayed off your phone for a week.', d('cv:silence')) },
    ],
  },
  {
    id: 'digital_bullying', category: 'digital', ageRange: [8, 17], queuedOnly: true, cooldown: 0,
    text: 'Someone from school has been posting cruel things about you online. You feel sick every time your phone lights up.',
    choices: [
      { label: 'Tell a parent or another adult you trust', outcomes: out('Saying it out loud was the hardest part.', d('safe:tell')) },
      { label: 'Block and report them', outcomes: out('Block. Report. Done.', d('safe:block')) },
      { label: 'Make your account private', outcomes: out('You locked everything down.', d('safe:private')) },
      { label: 'Take a break from it', outcomes: out('You deleted the app from your phone for a while.', d('safe:break')) },
    ],
  },

  // ---------- Creator journey (several years, conditional) ----------
  {
    id: 'digital_creator_crossroads', category: 'digital', ageRange: [18, 120], queuedOnly: true, cooldown: 0,
    text: 'Your channel {handle} has become something real: people wait for each new video. You could make it your job, keep it beside your life, or step back.',
    choices: [
      { label: 'Make it your job', outcomes: out('You decided to find out whether it could pay the bills.', d('crossroads:fulltime')) },
      { label: 'Keep it on the side', outcomes: out('It stays what it has been: yours, alongside everything else.', d('crossroads:side')) },
      { label: 'Step back from it', outcomes: out('You posted a short thank-you and stopped scheduling things.', d('crossroads:step')) },
    ],
  },
  {
    id: 'digital_creator_burnout', category: 'digital', ageRange: [13, 120], queuedOnly: true, cooldown: 0,
    text: 'Two years of filming, editing and posting have used up every spare hour you had. You are tired in a way sleep does not fix.',
    choices: [
      { label: 'Take a proper break', outcomes: out('You told your audience you would be back, and turned it all off.', d('burnout:break')) },
      { label: 'Cut back to what is sustainable', outcomes: out('Fewer videos, made with more care.', d('burnout:less')) },
      { label: 'Push on', outcomes: out('You kept going. Something had to give, and it was you.', d('burnout:push')) },
    ],
  },
  {
    id: 'digital_creator_stepback', category: 'digital', ageRange: [50, 120], queuedOnly: true, cooldown: 0,
    text: 'You have been making things for {handle} for {years} years. Lately you have wondered whether it is time to stop doing it for an audience.',
    choices: [
      { label: 'Stop creating professionally', outcomes: out('You posted one last video, thanked everyone, and left the channel up for whoever finds it later.', d('stepback:stop')) },
      { label: 'Keep going', outcomes: out('Not yet. There is still something to say.', d('stepback:keep')) },
    ],
  },
  {
    id: 'digital_viral_after', category: 'digital', ageRange: [13, 120], queuedOnly: true, once: true,
    text: 'Since your post went viral, strangers have been messaging, commenting and sharing it everywhere. It is a lot.',
    choices: [
      { label: 'Enjoy the moment', outcomes: out('It will pass. While it lasts, it is fun.', d('viral:enjoy')) },
      { label: 'Turn off notifications', outcomes: out('Quiet, at last.', d('viral:quiet')) },
      { label: 'Make your accounts private for a while', outcomes: out('You pulled the curtains.', d('viral:private')) },
    ],
  },
  {
    id: 'digital_breakthrough', category: 'digital', ageRange: [13, 120], queuedOnly: true, cooldown: 0,
    text: '{creator}, who makes {topic} content for a much bigger audience than yours, wants to make something with you.',
    choices: [
      { label: 'Say yes', outcomes: out('You traded ideas until two in the morning.', d('breakthrough:yes')) },
      { label: 'Say no, politely', outcomes: out('Not now. It was still nice to be asked.', d('breakthrough:no')) },
    ],
  },
  // ---------- Professional networking, community, friendship, romance ----------
  {
    id: 'digital_recruiter', category: 'digital', ageRange: [18, 120], queuedOnly: true, cooldown: 0,
    text: 'A recruiter has messaged you on {platform} about {field} roles. They would put you forward if you applied this year.',
    choices: [
      { label: 'Tell them you are interested', outcomes: out('They will put your name forward if you apply this year (Work tab).', d('recruiter:yes')) },
      { label: 'Not right now', outcomes: out('You thanked them and closed the message.', d('recruiter:no')) },
    ],
  },
  {
    id: 'digital_moderator_invite', category: 'digital', ageRange: [16, 120], queuedOnly: true, cooldown: 0,
    text: 'The moderators of {community} have asked whether you would join them. It means a few hours every year keeping the place kind.',
    choices: [
      { label: 'Accept', outcomes: out('You are trusted with the keys.', d('moderate:yes')) },
      { label: 'Decline', outcomes: out('You would rather just be a member.', d('moderate:no')) },
    ],
  },
  {
    id: 'digital_meet_friend', category: 'digital', ageRange: [18, 120], queuedOnly: true, cooldown: 0,
    text: '{friend}, whom you only know online, suggests meeting in person at last: somewhere public, in daylight.',
    choices: [
      { label: 'Meet them', outcomes: out('You told a friend where you would be, and went.', d('meetfriend:yes')) },
      { label: 'Keep it online for now', outcomes: out('Not yet. They understood.', d('meetfriend:no')) },
    ],
  },
  {
    id: 'digital_long_distance', category: 'digital', ageRange: [18, 120], queuedOnly: true, cooldown: 0,
    text: '{partner} lives in another country now. Your relationship runs on messages and video calls across the time difference.',
    choices: [
      { label: 'A video call every week, whatever the hour', outcomes: out('Late nights and early mornings, but you see each other\'s faces.', d('distance:calls')) },
      { label: 'Save up and visit', outcomes: out('You booked the flight.', d('distance:visit')) },
      { label: 'Let it fade', outcomes: out('Neither of you said it out loud, but the calls got shorter.', d('distance:fade')) },
    ],
  },
  // ---------- Later life and family ----------
  {
    id: 'digital_old_posts', category: 'digital', ageRange: [55, 120], queuedOnly: true, cooldown: 0,
    text: 'An app reminds you of something you posted {years} years ago. You end up scrolling back through decades of your own life.',
    choices: [
      { label: 'Share the old photos with the family', outcomes: out('You picked out the best ones and sent them round.', d('oldposts:share')) },
      { label: 'Just enjoy them yourself', outcomes: out('An evening of remembering.', d('oldposts:keep')) },
    ],
  },
  {
    id: 'digital_child_project', category: 'digital', ageRange: [25, 90], queuedOnly: true, cooldown: 0,
    text: '{kid} has a school photography project and asks for your help with the camera.',
    choices: [
      { label: 'Spend the weekend on it together', outcomes: out('You showed them what you knew, and they showed you some things you did not.', d('kidproject:help')) },
      { label: 'Let them work it out themselves', outcomes: out('They managed. Mostly.', d('kidproject:alone')) },
    ],
  },
];

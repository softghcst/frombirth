// What happens at an idol's appearance (engine/kpop.js appearance): a moment drawn for that kind of show, each with a
// few ways to handle it. Each answer leans on one of the idol's skills (vocal, dance, rap, stage, camera, media, team);
// how well it goes depends on that skill. [label, skill, if it goes well, if it does not]
const M = (prompt, options) => ({ prompt, options: options.map(([label, skill, good, bad]) => ({ label, skill, good, bad })) });

export const MOMENTS = {
  radio: [
    M('The DJ asks you to sing a few lines of the new song, live, no backing track.', [
      ['Sing it straight', 'vocal', 'Clean and steady. The DJ goes quiet for a second, then says, "Wow."', 'Your voice catches on the high note. The DJ laughs kindly and moves on.'],
      ['Sing it as a ballad instead', 'vocal', 'Slowed down, it sounds like a different song. The clip goes round all night.', 'The slow version drags. The DJ fills the silence afterward.'],
      ['Get the members to sing it with you', 'team', 'Everyone takes a line. It sounds warm and messy and fans love it.', 'Two of you come in at the wrong time. It is funny, at least.']]),
    M('A listener writes in: "What did you eat today?" The DJ wants the full story.', [
      ['Tell it like a comedy', 'media', 'The story of the convenience store kimbap has the studio crying with laughter.', 'The joke does not land. You keep talking anyway.'],
      ['Turn it into a cute moment', 'camera', 'You play it sweet, and the studio camera catches it. Fans clip it instantly.', 'It comes out stiff. You can hear yourself trying.'],
      ['Ask the listener the same question back', 'media', 'The DJ loves it. You end up chatting with a fan live on air.', 'The line goes dead. Awkward radio silence.']]),
    M('A quick-fire game: name ten songs from the 2000s in thirty seconds.', [
      ['Go for it yourself', 'media', 'Nine and a half. The DJ gives you the half.', 'You freeze after three. The clock is very loud.'],
      ['Hum them instead of naming them', 'vocal', 'The DJ guesses every one. It turns into a singalong.', 'Nobody can tell what you are humming.'],
      ['Let the member who knows best take it', 'team', 'You set them up and cheer. Fans notice how you look after each other.', 'They panic too. You both laugh it off.']]),
  ],
  variety: [
    M('The producers dare you to do your group\'s dance at double speed.', [
      ['Go all in', 'dance', 'Somehow it works. The cast gives you a standing ovation.', 'You trip on the second eight-count and roll with it.'],
      ['Make it a comedy bit', 'camera', 'You overact every move. The editors add sound effects. It is the clip of the week.', 'It feels forced on set. The edit is kind to you.'],
      ['Challenge a comedian to do it with you', 'media', 'The comedian collapses halfway. You carry on. Everyone wins.', 'The comedian does it better. You are a good sport.']]),
    M('A blindfold taste test. Lose, and you eat the mystery dish.', [
      ['Play to win', 'media', 'You guess every one. The cast groans.', 'You lose. The mystery dish is fish sauce jelly.'],
      ['Overreact to everything', 'camera', 'Your faces become a meme by morning.', 'It reads as too much. The edit trims it.'],
      ['Help your teammate cheat', 'team', 'Caught, but the cast loves the loyalty. So do fans.', 'Caught immediately, and you both eat the dish.']]),
    M('The host asks you to show a hidden talent nobody knows about.', [
      ['A dance from a different genre', 'dance', 'You pop and lock like a street dancer. Nobody expected that.', 'You lose the beat. The host claps anyway.'],
      ['An impression of your manager', 'media', 'Spot on. Somewhere, your manager is not laughing.', 'Nobody knows who you are impersonating.'],
      ['Freestyle a rap about the host', 'rap', 'Clever and quick. The host asks for a copy.', 'You run out of rhymes after two lines.']]),
  ],
  interview: [
    M('The journalist asks what the new album means to you.', [
      ['Talk about the meaning, honestly', 'media', 'Thoughtful and real. The quote is used as the headline.', 'You ramble. The piece quotes the shortest thing you said.'],
      ['Talk about the work behind it', 'stage', 'The months of practice, the bruises, the rewrites. It reads as earned.', 'It sounds rehearsed.'],
      ['Credit the producers and members', 'team', 'Generous and specific. People notice.', 'It sounds like a list of names.']]),
    M('A tricky question about a rumor about your group.', [
      ['Answer calmly and briefly', 'media', 'You shut it down gracefully. The story dies.', 'You say a little too much. A new headline appears.'],
      ['Change the subject with a smile', 'camera', 'Smooth. Nobody even notices the dodge.', 'The dodge is obvious, and the clip says so.'],
      ['Let the company answer for you', 'team', 'Professional. Nothing comes of it.', 'You seem evasive. The rumor sticks a while longer.']]),
    M('The photographer wants a few shots before the interview.', [
      ['Give strong poses', 'camera', 'The cover shot is stunning. Fans buy two copies.', 'The shots are fine. The magazine runs a small one.'],
      ['Be playful with the members', 'team', 'Candid group shots that look like friendship. They are the ones fans keep.', 'It looks chaotic.'],
      ['Ask for the photographer\'s ideas', 'media', 'They are delighted, and the shoot runs long and good.', 'Their ideas are strange. You go along with it.']]),
  ],
  fanmeeting: [
    M('A fan in the front row is crying and holding a banner with your name.', [
      ['Sing them a song from the stage', 'vocal', 'You sing straight to them. The whole hall cries.', 'Your voice cracks with emotion. It is moving, in its way.'],
      ['Go down and say hello', 'media', 'A few warm words. The fan will remember it forever.', 'Security pulls you back before you can say much.'],
      ['Make a heart with the members', 'team', 'Everyone joins in. The photo is everywhere by night.', 'Half of them miss the cue.']]),
    M('A game segment: fans shout requests, and you have to do them.', [
      ['A dance cover of another group', 'dance', 'You nail a girl-group choreography. The hall screams.', 'You know only the chorus. The fans sing the rest for you.'],
      ['Aegyo, on request', 'camera', 'Shameless and adorable. The fans lose their minds.', 'You cannot keep a straight face.'],
      ['A short rap, made up on the spot', 'rap', 'Fans chant the hook back at you.', 'You lose the flow, and laugh.']]),
  ],
  fansign: [
    M('A fan is so nervous they cannot speak.', [
      ['Talk them through it gently', 'media', 'By the end they are laughing. They post about it for a week.', 'The line moves on before they find their words.'],
      ['Draw them something in the album', 'camera', 'A little doodle of the two of you. It becomes their treasure.', 'The doodle is a mystery shape.'],
      ['Hold their hands and wait', 'team', 'They calm down, and you have a real conversation.', 'The staff hurry them along.']]),
    M('A fan asks you to say a line from a drama, in character.', [
      ['Play it dead serious', 'stage', 'You deliver it like an actor. The fans behind them gasp.', 'You crack up halfway.'],
      ['Play it for laughs', 'media', 'The whole table laughs. It is the clip of the day.', 'It falls a bit flat.'],
      ['Ask them to say it with you', 'camera', 'A little scene, together. They are thrilled.', 'They freeze. You finish it for them.']]),
  ],
  fancall: [
    M('The video call lags, and the fan is frozen mid-sentence.', [
      ['Freeze too, as a joke', 'camera', 'When the call comes back, they are crying with laughter.', 'They do not get the joke.'],
      ['Keep talking warmly until it comes back', 'media', 'They hear every word when it reconnects. It means a lot.', 'The call drops for good. You send a message later.'],
      ['Sing while you wait', 'vocal', 'They hear the end of the song. It is the best lag of their life.', 'They miss all of it.']]),
    M('The fan asks you to show them your practice room.', [
      ['Show a few moves from the new choreography', 'dance', 'A private preview. They will never forget it.', 'You bump into the mirror.'],
      ['Introduce them to a member who walks in', 'team', 'A surprise second idol. The fan screams.', 'The member is half asleep and waves.'],
      ['Tell them a story about practice', 'media', 'They feel like an insider.', 'The story goes on a bit long.']]),
  ],
  livestream: [
    M('The chat floods with requests for a song from your trainee days.', [
      ['Sing it', 'vocal', 'Nostalgic and lovely. Older fans are emotional in the chat.', 'You forget the second verse. The chat sings it for you.'],
      ['Tell the story behind it', 'media', 'Fans learn something new. The stream sets a record.', 'A bit rambling, but sweet.'],
      ['Dance the old choreography', 'dance', 'Rusty but brilliant. The chat explodes.', 'Very rusty. Very funny.']]),
    M('You are cooking on stream, and something is starting to burn.', [
      ['Narrate it like a cooking show', 'media', 'The commentary makes the disaster the best part.', 'The smoke alarm goes off and the stream ends.'],
      ['Call a member in to help', 'team', 'Chaos, together. Fans clip every second.', 'They make it worse.'],
      ['Play it cool for the camera', 'camera', 'Your calm face beside the smoke becomes a meme.', 'Everyone can see the panic.']]),
  ],
};

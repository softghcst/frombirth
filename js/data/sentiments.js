// Sentiments: what the player feels about one person, because of something that happened between them
// (engine/sentiments.js). Unlike a memory, which is what they remember of you and is kept for good, a feeling fades.
//
//   tone      good | bad: what the profile shows it as
//   fade      strength lost a year (from 100 at most); a forgiving person's feelings fade a third faster
//   decayK    how fast closeness drifts while it lasts (0.7: a third slower)
//   argueK    how much an argument costs while it lasts

export const SENTIMENTS = {
  grateful: { name: 'Grateful', tone: 'good', fade: 7, decayK: 0.7 },
  admire: { name: 'Admire', tone: 'good', fade: 5, decayK: 0.75 },
  proud: { name: 'Proud of', tone: 'good', fade: 8, decayK: 0.75 },
  old_flame: { name: 'Old flame', tone: 'good', fade: 4, decayK: 0.8 },
  hurt: { name: 'Hurt', tone: 'bad', fade: 12, decayK: 1.3, argueK: 1.2 },
  resentful: { name: 'Resentful', tone: 'bad', fade: 9, decayK: 1.3, argueK: 1.25 },
  betrayed: { name: 'Betrayed', tone: 'bad', fade: 5, decayK: 1.5, argueK: 1.4 },
  guilty: { name: 'Guilty', tone: 'bad', fade: 10, decayK: 1 },
};
/** At most this many feelings about one person; a new one pushes out the weakest. */
export const MOST_PER_PERSON = 2;

/**
 * Memories (what someone remembers of the player, engine/conditions.js remember) that leave the player a feeling too.
 * [kind, strength, why]: why is said on their profile.
 */
export const FROM_MEMORY = {
  tookYouIn: ['grateful', 85, 'they took you in'],
  gotYouAJob: ['grateful', 55, 'they got you a job'],
  stayedForYou: ['grateful', 60, 'they stayed for you'],
  movedForYou: ['grateful', 70, 'they moved for your work'],
  forgiven: ['grateful', 50, 'they forgave you'],
  forgivenAffair: ['grateful', 70, 'they forgave you'],
  medMentor: ['admire', 60, 'they mentored you'],
  mentoredBy: ['proud', 45, 'you mentored them'],
  theyCheated: ['betrayed', 90, 'they were unfaithful'],
  cheated: ['guilty', 75, 'you were unfaithful'],
  missedWedding: ['guilty', 40, 'you missed their wedding'],
  missedShow: ['guilty', 30, 'you missed their show'],
  missedGig: ['guilty', 30, 'you missed their gig'],
  walkedPast: ['guilty', 45, 'you walked past when they needed you'],
  dismissed: ['guilty', 45, 'you brushed off how they felt'],
  rejectedMe: ['guilty', 45, 'you did not accept them'],
  exposed: ['guilty', 40, 'you published their story'],
};

// The Digital World: the one registry every part of the game asks about
// communication technology, devices and the fictional platforms people use.
//
// Nothing else in the game should check "is it after 2004?". It asks this
// registry (through engine/digital/tech.js) whether a technology has reached
// a country yet, and whether a platform is open there.
//
// Years are when a technology first reaches ordinary people in the best-
// connected countries. A country with weaker infrastructure gets it later
// (see ADOPTION below). Platforms are invented for the game: their names,
// looks and rules are From Birth's own.

/**
 * @typedef {Object} CommunicationTechnology
 * @property {string} id
 * @property {string} name
 * @property {number} from        first year it exists for ordinary people anywhere
 * @property {number} span        years from first appearance to wide use
 * @property {number} infra       0–100 country infrastructure it needs to be common
 * @property {?number} [declines] year it starts to fall out of use
 * @property {string[]} devices   devices that give access (any one will do); [] = none needed
 * @property {string[]} activities
 * @property {number} cost        yearly cost of use, base units (USD-like)
 * @property {boolean} [digital]  part of the online world
 * @property {string} blurb
 */

/** @type {CommunicationTechnology[]} */
export const COMM_TECH = [
  { id: 'visit', name: 'Visiting in person', from: -10000, span: 0, infra: 0, devices: [], activities: ['visit'], cost: 0, blurb: 'Walking over, sitting down, talking face to face.' },
  { id: 'letter', name: 'Letters', from: -10000, span: 0, infra: 0, devices: [], activities: ['letter'], cost: 2, blurb: 'Pen, paper and patience.' },
  { id: 'post', name: 'The postal service', from: 1840, span: 30, infra: 10, devices: [], activities: ['letter', 'parcel'], cost: 5, blurb: 'A stamp carries a letter across the country, and in time across the world.' },
  { id: 'telegraph', name: 'Telegrams', from: 1850, span: 30, infra: 15, declines: 1960, devices: [], activities: ['telegram'], cost: 10, blurb: 'Short, urgent, paid for by the word.' },
  { id: 'landline', name: 'The telephone', from: 1890, span: 50, infra: 25, devices: ['home_phone'], activities: ['call'], cost: 120, blurb: 'A voice down a wire.' },
  { id: 'radio', name: 'Radio', from: 1922, span: 15, infra: 15, devices: [], activities: ['listen'], cost: 0, blurb: 'News and music from the air.' },
  { id: 'television', name: 'Television', from: 1946, span: 15, infra: 25, devices: [], activities: ['watch'], cost: 0, blurb: 'The world in the living room.' },
  { id: 'pc', name: 'Personal computers', from: 1979, span: 16, infra: 40, devices: ['desktop', 'laptop'], activities: ['compute'], cost: 0, digital: true, blurb: 'A machine of your own on the desk.' },
  { id: 'email', name: 'Email', from: 1992, span: 8, infra: 45, devices: ['desktop', 'laptop', 'smartphone', 'tablet'], activities: ['email'], cost: 0, digital: true, blurb: 'Letters that arrive in seconds.' },
  { id: 'web', name: 'The web', from: 1993, span: 9, infra: 45, devices: ['desktop', 'laptop', 'smartphone', 'tablet'], activities: ['browse', 'publish'], cost: 240, digital: true, blurb: 'Pages from anywhere, and a page of your own if you want one.' },
  { id: 'forums', name: 'Online forums', from: 1994, span: 6, infra: 45, devices: ['desktop', 'laptop', 'smartphone', 'tablet'], activities: ['discuss', 'community'], cost: 0, digital: true, blurb: 'Strangers who love the same things you do.' },
  { id: 'instant', name: 'Instant messaging', from: 1997, span: 6, infra: 45, devices: ['desktop', 'laptop', 'smartphone', 'tablet'], activities: ['message', 'group'], cost: 0, digital: true, blurb: 'Conversations that happen as you type.' },
  { id: 'mobile', name: 'Mobile phones', from: 1995, span: 10, infra: 30, devices: ['mobile_phone', 'smartphone'], activities: ['call', 'text'], cost: 180, blurb: 'A phone that goes where you go.' },
  { id: 'social', name: 'Social networks', from: 2004, span: 6, infra: 45, devices: ['desktop', 'laptop', 'smartphone', 'tablet'], activities: ['post', 'follow', 'feed'], cost: 0, digital: true, blurb: 'Everyone you know, and what they are up to.' },
  { id: 'smartphone', name: 'Smartphones', from: 2007, span: 7, infra: 35, devices: ['smartphone'], activities: ['post', 'photo', 'video', 'message'], cost: 300, digital: true, blurb: 'The internet in your pocket, with a camera attached.' },
  { id: 'video_call', name: 'Video calls', from: 2008, span: 8, infra: 50, devices: ['laptop', 'smartphone', 'tablet', 'desktop'], activities: ['video_call'], cost: 0, digital: true, blurb: 'Faces, not just voices, across any distance.' },
  { id: 'video_share', name: 'Online video', from: 2005, span: 6, infra: 50, devices: ['desktop', 'laptop', 'smartphone', 'tablet'], activities: ['video', 'watch'], cost: 0, digital: true, blurb: 'Anyone can make a program, and anyone can watch it.' },
  { id: 'livestream', name: 'Livestreaming', from: 2011, span: 6, infra: 55, devices: ['desktop', 'laptop', 'smartphone'], activities: ['stream'], cost: 0, digital: true, blurb: 'Live, to whoever turns up.' },
  { id: 'presence', name: 'Shared presence', from: 2036, span: 10, infra: 60, devices: ['presence_set'], activities: ['presence'], cost: 200, digital: true, blurb: 'A room you share with people who are far away.' },
];
export const TECH_BY_ID = Object.fromEntries(COMM_TECH.map((t) => [t.id, t]));

/**
 * How infrastructure delays a technology: a country with infra 100 gets it on
 * the year; one with infra 0 gets it `maxLag` years later, and fewer people
 * there ever have it.
 */
export const ADOPTION = { maxLag: 14, available: 0.08 };

/**
 * @typedef {Object} DigitalDeviceDef
 * @property {string} id
 * @property {string} name
 * @property {string} tech       the technology that has to exist to buy one
 * @property {number} cost       base units, when new
 * @property {number} life       years before it needs replacing
 * @property {number} quality    0–1, how good it is for making things (camera, sound, editing)
 * @property {string[]} can      capabilities: 'call','text','web','photo','video','stream','edit','game','presence'
 * @property {number} [minAge]
 */
/** @type {DigitalDeviceDef[]} */
export const DEVICES = [
  { id: 'radio_set', name: 'Radio set', tech: 'radio', cost: 40, life: 25, quality: 0, can: ['listen'] },
  { id: 'tv_set', name: 'Television set', tech: 'television', cost: 350, life: 12, quality: 0, can: ['watch'] },
  { id: 'home_phone', name: 'Home telephone', tech: 'landline', cost: 60, life: 20, quality: 0, can: ['call'] },
  { id: 'desktop', name: 'Desktop computer', tech: 'pc', cost: 900, life: 6, quality: 0.5, can: ['web', 'edit', 'game'] },
  { id: 'laptop', name: 'Laptop', tech: 'pc', cost: 1000, life: 5, quality: 0.5, can: ['web', 'edit', 'video', 'game'] },
  { id: 'mobile_phone', name: 'Cell phone', tech: 'mobile', cost: 120, life: 4, quality: 0.05, can: ['call', 'text'], minAge: 9 },
  { id: 'smartphone', name: 'Smartphone', tech: 'smartphone', cost: 500, life: 3, quality: 0.4, can: ['call', 'text', 'web', 'photo', 'video', 'stream'], minAge: 9 },
  { id: 'tablet', name: 'Tablet', tech: 'smartphone', cost: 400, life: 4, quality: 0.3, can: ['web', 'photo', 'video'], minAge: 4 },
  { id: 'camera', name: 'Good camera', tech: 'pc', cost: 800, life: 8, quality: 0.9, can: ['photo', 'video'] },
  { id: 'microphone', name: 'Studio microphone', tech: 'pc', cost: 180, life: 10, quality: 0.8, can: ['sound'] },
  { id: 'webcam', name: 'Webcam and lights', tech: 'video_call', cost: 150, life: 6, quality: 0.6, can: ['video', 'stream'] },
  { id: 'console', name: 'Games console', tech: 'pc', cost: 450, life: 7, quality: 0.2, can: ['game'], minAge: 5 },
  { id: 'presence_set', name: 'Presence set', tech: 'presence', cost: 1200, life: 5, quality: 0.7, can: ['presence', 'video', 'stream'] },
];
export const DEVICE_BY_ID = Object.fromEntries(DEVICES.map((d) => [d.id, d]));

/**
 * Where someone without a device of their own can still get online: a school
 * computer room, a public library, a computer at work. Each needs the web to
 * have reached the country.
 */
export const ACCESS_POINTS = [
  { id: 'school', name: 'school computers', tech: 'web', when: (p) => p.education?.enrolled },
  { id: 'library', name: 'the public library', tech: 'web', when: (p) => p.age >= 8 },
  { id: 'work', name: 'a computer at work', tech: 'pc', when: (p) => !!p.career?.careerId },
];

/**
 * @typedef {Object} SocialPlatform
 * @property {string} id
 * @property {string} name
 * @property {'personal'|'shortvideo'|'video'|'live'|'professional'|'forum'|'blog'|'messaging'|'dating'} type
 * @property {number} launch
 * @property {?number} [declines]   year it starts losing people
 * @property {?number} [closes]     year it shuts down; accounts are archived, not deleted
 * @property {string} tech          the technology it runs on
 * @property {number} minAge
 * @property {number} [minInfra]    country infrastructure needed for it to operate there at all
 * @property {string[]} formats
 * @property {'followers'|'connections'|'members'|'matches'|'none'} audience
 * @property {string[]} privacy     visibility settings it offers
 * @property {{ads:boolean, subs:boolean, tips:boolean, minAudience:number, fee:number}} monetize
 * @property {boolean} messaging    has direct messages
 * @property {boolean} groups       has group conversations
 * @property {string} accent        a hue for its cards
 * @property {string} blurb
 * @property {string} rules         what it moderates
 * @property {{year:number, text:string}[]} [changes]  features added over time
 */
/** @type {SocialPlatform[]} */
export const PLATFORMS = [
  { id: 'corkboard', name: 'Corkboard', type: 'forum', launch: 1995, declines: 2016, tech: 'forums', minAge: 13,
    formats: ['text', 'photo', 'article'], audience: 'members', privacy: ['public', 'members'],
    monetize: { ads: false, subs: false, tips: false, minAudience: Infinity, fee: 0 }, messaging: true, groups: false,
    accent: '#8a6d3b', blurb: 'Message boards for every hobby under the sun.', rules: 'Stay on topic. No personal attacks.' },
  { id: 'chatterbox', name: 'Chatterbox', type: 'messaging', launch: 1998, declines: 2008, closes: 2014, tech: 'instant', minAge: 13,
    formats: ['text'], audience: 'connections', privacy: ['connections'],
    monetize: { ads: false, subs: false, tips: false, minAudience: Infinity, fee: 0 }, messaging: true, groups: true,
    accent: '#d08b1f', blurb: 'A buddy list, an away message, and a little sound when someone signs on.', rules: 'Be decent.' },
  { id: 'inkwell', name: 'Inkwell', type: 'blog', launch: 1999, declines: 2020, tech: 'web', minAge: 13,
    formats: ['article', 'photo', 'text'], audience: 'followers', privacy: ['public', 'friends', 'private'],
    monetize: { ads: true, subs: true, tips: true, minAudience: 1000, fee: 0.1 }, messaging: false, groups: false,
    accent: '#3b5f8a', blurb: 'A journal on the web: write as much or as little as you like.', rules: 'No impersonation. Disclose sponsored posts.' },
  { id: 'guildhall', name: 'Guildhall', type: 'professional', launch: 2003, tech: 'web', minAge: 16,
    formats: ['text', 'article'], audience: 'connections', privacy: ['public', 'connections'],
    monetize: { ads: false, subs: false, tips: false, minAudience: Infinity, fee: 0 }, messaging: true, groups: false,
    accent: '#2f6b5a', blurb: 'Your working life, written down: who you have worked with and what you can do.', rules: 'Professional conduct. No false credentials.' },
  { id: 'hearth', name: 'Hearth', type: 'personal', launch: 2005, declines: 2031, closes: 2046, tech: 'social', minAge: 13,
    formats: ['text', 'photo', 'short_video'], audience: 'followers', privacy: ['public', 'friends', 'private'],
    monetize: { ads: true, subs: false, tips: false, minAudience: 10000, fee: 0.45 }, messaging: true, groups: true,
    accent: '#c2553d', blurb: 'Life updates, photos and the people you know.', rules: 'No harassment, no impersonation, no sharing other people\'s private details.',
    changes: [{ year: 2012, text: 'Hearth added groups.' }, { year: 2019, text: 'Hearth added short video.' }] },
  { id: 'vista', name: 'Vista', type: 'video', launch: 2006, tech: 'video_share', minAge: 13,
    formats: ['long_video', 'short_video'], audience: 'followers', privacy: ['public', 'unlisted', 'private'],
    monetize: { ads: true, subs: true, tips: false, minAudience: 1000, fee: 0.45 }, messaging: false, groups: false,
    accent: '#b23a48', blurb: 'Videos of every length: tutorials, performances, documentaries, nonsense.', rules: 'No dangerous challenges. Disclose paid promotions.' },
  { id: 'murmur', name: 'Murmur', type: 'messaging', launch: 2010, tech: 'smartphone', minAge: 13,
    formats: ['text', 'photo'], audience: 'connections', privacy: ['connections'],
    monetize: { ads: false, subs: false, tips: false, minAudience: Infinity, fee: 0 }, messaging: true, groups: true,
    accent: '#2f7d6b', blurb: 'Messages and group chats with the people in your phone.', rules: 'Report anyone who will not leave you alone.' },
  { id: 'glimmer', name: 'Glimmer', type: 'personal', launch: 2011, tech: 'smartphone', minAge: 13,
    formats: ['photo', 'short_video', 'text'], audience: 'followers', privacy: ['public', 'friends', 'private'],
    monetize: { ads: true, subs: true, tips: false, minAudience: 5000, fee: 0.5 }, messaging: true, groups: true,
    accent: '#a0479b', blurb: 'Photographs first: what you saw, made, cooked and wore.', rules: 'No harassment. Label paid partnerships.' },
  { id: 'beacon', name: 'Beacon', type: 'live', launch: 2012, tech: 'livestream', minAge: 16,
    formats: ['livestream'], audience: 'followers', privacy: ['public', 'followers'],
    monetize: { ads: true, subs: true, tips: true, minAudience: 50, fee: 0.5 }, messaging: true, groups: false,
    accent: '#5b4bc4', blurb: 'Go live: games, music, art, talk, and the chat that comes with it.', rules: 'No harassment in chat. Moderators can time people out.' },
  { id: 'kindling', name: 'Kindling', type: 'dating', launch: 2013, tech: 'smartphone', minAge: 18,
    formats: ['text', 'photo'], audience: 'matches', privacy: ['matches'],
    monetize: { ads: false, subs: false, tips: false, minAudience: Infinity, fee: 0 }, messaging: true, groups: false,
    accent: '#d9534f', blurb: 'Meet people near you who are looking for the same thing. Adults only.', rules: 'Adults only. Be honest. Meet in public.' },
  { id: 'spinnet', name: 'Spinnet', type: 'shortvideo', launch: 2017, declines: 2038, tech: 'smartphone', minAge: 13,
    formats: ['short_video'], audience: 'followers', privacy: ['public', 'friends', 'private'],
    monetize: { ads: true, subs: false, tips: true, minAudience: 10000, fee: 0.5 }, messaging: true, groups: false,
    accent: '#1f8a9e', blurb: 'Videos under a minute, sounds that spread, and trends that come and go.', rules: 'No dangerous challenges. No harassment.' },
  { id: 'lumen', name: 'Lumen', type: 'personal', launch: 2037, tech: 'presence', minAge: 13,
    formats: ['text', 'photo', 'short_video', 'presence'], audience: 'followers', privacy: ['public', 'friends', 'private'],
    monetize: { ads: true, subs: true, tips: true, minAudience: 5000, fee: 0.4 }, messaging: true, groups: true,
    accent: '#c99a2e', blurb: 'Share a moment as if your friends were in the room.', rules: 'Consent before you share anyone else\'s space.' },
];
export const PLATFORM_BY_ID = Object.fromEntries(PLATFORMS.map((p) => [p.id, p]));

/** What making each kind of content takes. hours: of the year's spare time. needs: device capability. */
export const FORMATS = {
  text: { name: 'Text update', hours: 1, needs: 'web', effort: 0.15 },
  photo: { name: 'Photo', hours: 2, needs: 'photo', effort: 0.3 },
  short_video: { name: 'Short video', hours: 6, needs: 'video', effort: 0.45 },
  long_video: { name: 'Long video', hours: 30, needs: 'video', effort: 0.8 },
  article: { name: 'Article', hours: 10, needs: 'web', effort: 0.6 },
  livestream: { name: 'Livestream', hours: 8, needs: 'stream', effort: 0.6 },
  presence: { name: 'Shared moment', hours: 4, needs: 'presence', effort: 0.5 },
};

/**
 * Topics: what a post is about, and the talent or skill that makes it good.
 * `skill` paths are read from the character (talents.*, stats.*, skills.*).
 */
export const TOPICS = [
  { id: 'life', name: 'Everyday life', skill: 'stats.charm' },
  { id: 'family', name: 'Family', skill: 'stats.charm', private: true },
  { id: 'friends', name: 'Friends', skill: 'stats.charm', private: true },
  { id: 'music', name: 'Music', skill: 'talents.music' },
  { id: 'singing', name: 'Singing', skill: 'talents.singing' },
  { id: 'acting', name: 'Acting and comedy', skill: 'talents.acting' },
  { id: 'dance', name: 'Dance', skill: 'talents.dance' },
  { id: 'sports', name: 'Sports', skill: 'talents.sports' },
  { id: 'gaming', name: 'Gaming', skill: 'stats.intellect' },
  { id: 'fashion', name: 'Fashion', skill: 'stats.charm' },
  { id: 'cooking', name: 'Cooking', skill: 'skills.cooking' },
  { id: 'education', name: 'Explaining things', skill: 'stats.intellect' },
  { id: 'travel', name: 'Travel', skill: 'stats.charm' },
  { id: 'work', name: 'Professional achievements', skill: 'stats.intellect' },
  { id: 'art', name: 'Art and photography', skill: 'skills.photography' },
  { id: 'books', name: 'Books and writing', skill: 'skills.writing' },
];
export const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

/** Online communities that exist once forums or groups do. Members beyond the few named ones are a count. */
export const COMMUNITIES = [
  { id: 'c_games', topic: 'gaming', name: 'The Save Point', platform: 'corkboard', rules: 'No spoilers without a warning.', size: 40000 },
  { id: 'c_music', topic: 'music', name: 'Open Mic Night', platform: 'corkboard', rules: 'Be kind about other people\'s recordings.', size: 18000 },
  { id: 'c_books', topic: 'books', name: 'Dog-Eared Pages', platform: 'corkboard', rules: 'Every book is somebody\'s favorite.', size: 22000 },
  { id: 'c_cook', topic: 'cooking', name: 'Second Helpings', platform: 'corkboard', rules: 'Post the recipe, not just the photo.', size: 30000 },
  { id: 'c_art', topic: 'art', name: 'The Sketchbook', platform: 'corkboard', rules: 'Credit the artist.', size: 15000 },
  { id: 'c_sport', topic: 'sports', name: 'Sunday League', platform: 'corkboard', rules: 'Rivalry is fine. Abuse is not.', size: 50000 },
  { id: 'c_tech', topic: 'education', name: 'How Things Work', platform: 'corkboard', rules: 'There are no stupid questions.', size: 26000 },
  { id: 'c_garden', topic: 'life', name: 'Green Thumbs', platform: 'hearth', rules: 'Pests may be discussed. People may not be.', size: 12000 },
  { id: 'c_theater', topic: 'acting', name: 'Stage Door', platform: 'hearth', rules: 'Break a leg, figuratively.', size: 9000 },
  { id: 'c_style', topic: 'fashion', name: 'Thread Count', platform: 'glimmer', rules: 'Critique the clothes, not the body.', size: 35000 },
  { id: 'c_travel', topic: 'travel', name: 'Wanderlist', platform: 'hearth', rules: 'Never post anyone\'s home address.', size: 28000 },
  { id: 'c_study', topic: 'education', name: 'Study Hall', platform: 'corkboard', rules: 'Help with understanding, never with cheating.', size: 24000, academic: true },
  { id: 'c_neighbors', topic: 'life', name: 'Neighbors', platform: 'hearth', rules: 'Local news, lost cats, and no feuds.', size: 0, local: true },
];
export const COMMUNITY_BY_ID = Object.fromEntries(COMMUNITIES.map((c) => [c.id, c]));

/** Fictional brands that sponsor creators. `topics` is what their customers care about. */
export const SPONSORS = [
  { id: 'sp_kettle', name: 'Kettle & Crumb', topics: ['cooking', 'life', 'family'], blurb: 'kitchenware', budget: 1 },
  { id: 'sp_stride', name: 'Stride Athletic', topics: ['sports', 'dance', 'fashion'], blurb: 'running shoes and kit', budget: 1.4 },
  { id: 'sp_pixel', name: 'Pixelforge', topics: ['gaming', 'education', 'art'], blurb: 'computer parts', budget: 1.2 },
  { id: 'sp_chord', name: 'Chordline', topics: ['music', 'singing'], blurb: 'instruments and strings', budget: 0.9 },
  { id: 'sp_atlas', name: 'Atlas Rail', topics: ['travel', 'life'], blurb: 'rail passes', budget: 1.1 },
  { id: 'sp_loom', name: 'Loom & Lace', topics: ['fashion', 'life', 'art'], blurb: 'clothing', budget: 1.3 },
  { id: 'sp_page', name: 'Pageturner Books', topics: ['books', 'education'], blurb: 'books', budget: 0.7 },
  { id: 'sp_hum', name: 'Humble Bean', topics: ['life', 'work', 'books'], blurb: 'coffee', budget: 0.8 },
];
export const SPONSOR_BY_ID = Object.fromEntries(SPONSORS.map((s) => [s.id, s]));

/** Fictional trends. A platform runs one or two at a time; each lasts a year or two. */
export const TRENDS = [
  { id: 't_onetake', name: 'One-take challenge', topics: ['music', 'singing', 'dance'], text: 'performing a whole piece in one take, no edits' },
  { id: 't_tiny', name: 'Tiny kitchen', topics: ['cooking'], text: 'cooking something ambitious in a very small kitchen' },
  { id: 't_before', name: 'Before and after', topics: ['art', 'fashion', 'life'], text: 'showing the work in progress next to the finished thing' },
  { id: 't_speedrun', name: 'Slow run', topics: ['gaming'], text: 'playing a fast game as slowly and thoroughly as possible' },
  { id: 't_explain', name: 'Explain it in a minute', topics: ['education', 'work', 'books'], text: 'explaining something complicated in sixty seconds' },
  { id: 't_walk', name: 'Walk with me', topics: ['travel', 'life'], text: 'a walk through your neighborhood, without saying where it is' },
  { id: 't_trickshot', name: 'Trick shot', topics: ['sports'], text: 'one improbable shot, filmed once it finally worked' },
  { id: 't_duet', name: 'Duet a stranger', topics: ['music', 'singing', 'acting'], text: 'answering someone else\'s video with your own half' },
];

/** Creator stages. Reached by circumstances, not only numbers: see engine/digital/creator.js. */
export const CREATOR_STAGES = [
  { id: 'hobbyist', name: 'Hobbyist' },
  { id: 'growing', name: 'Growing creator' },
  { id: 'established', name: 'Established creator' },
  { id: 'fulltime', name: 'Full-time creator' },
  { id: 'public', name: 'Major public figure' },
];

/** Kinds of content project, with how much work they are (hours) and how many sessions. */
export const PROJECT_KINDS = [
  { id: 'short', name: 'Short video', format: 'short_video', hours: 12, sessions: 1, cost: 0 },
  { id: 'tutorial', name: 'Tutorial series', format: 'long_video', hours: 80, sessions: 3, cost: 50 },
  { id: 'documentary', name: 'Documentary', format: 'long_video', hours: 160, sessions: 4, cost: 600 },
  { id: 'recital', name: 'Recorded performance', format: 'long_video', hours: 40, sessions: 2, cost: 100 },
  { id: 'podcast', name: 'Podcast episode', format: 'long_video', hours: 20, sessions: 1, cost: 0 },
  { id: 'photo_set', name: 'Photography collection', format: 'photo', hours: 30, sessions: 2, cost: 0 },
  { id: 'essay', name: 'Long article', format: 'article', hours: 25, sessions: 1, cost: 0 },
];
export const PROJECT_BY_ID = Object.fromEntries(PROJECT_KINDS.map((k) => [k.id, k]));
export const PROJECT_STAGES = ['planned', 'in_progress', 'editing', 'ready', 'published', 'archived'];

/** Spare hours a year for digital life, before school, work and family take their share. */
export const SPARE_HOURS = { base: 420, school: 120, fulltime: 200, parttime: 80, kids: 60, minimum: 60 };

/** Ages at which people start using what. Below these, guardians decide. */
/** digitalLife: the age a life online starts at all (the Digital Life card, its sections, reputation and screen time); younger children see only the Family Archive. */
export const DIGITAL_AGES = { digitalLife: 6, phoneFromParents: 11, ownAccounts: 13, creatorPay: 18, dating: 18 };

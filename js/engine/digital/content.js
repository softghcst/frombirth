// Posts: making them, the audience's response (simulated once, then kept),
// comments, and the feed. A post that says something happened is tied to the
// thing that happened; everything else is just a post.
import { rng } from '../../rng.js';
import { clamp } from '../../util.js';
import { store, player } from '../../state.js';
import { FORMATS, TOPIC_BY_ID, TOPICS, PLATFORM_BY_ID } from '../../data/digital.js';
import { COUNTRIES } from '../../data/countries.js';
import { world, newId, charOf, isPlayer, firstOf, nameOf, acts, result, recordEvent, spendHours, hoursLeft, reputation, adjustReputation, LIMITS } from './core.js';
import { accessFor, platformActivity, platformStatus, isOpen } from './tech.js';
import { account, accountOn, activeAccountsOf, canSee, followerCount, blocks } from './accounts.js';

/** Posts a year before an audience starts to tire of them. */
export const POSTS_PER_YEAR = 24;

/** Reads a number off a character by path ('talents.music', 'stats.charm', 'skills.photography'). */
function skillOf(c, path) {
  const [a, b] = path.split('.');
  const v = c[a]?.[b];
  return typeof v === 'number' ? v : typeof v === 'object' && v ? (v.level ?? 30) : 30;
}

/** Formats this account's platform takes, that the player has a device for. */
export function formatOptions(accountId) {
  const acc = account(accountId);
  const pl = PLATFORM_BY_ID[acc.platformId];
  return pl.formats.filter((f) => f !== 'livestream').map((f) => {
    const dev = accessFor(FORMATS[f].needs === 'web' ? 'web' : FORMATS[f].needs);
    const changed = (pl.changes ?? []).find((c) => c.year > store.state.year && /short video/.test(c.text) && f === 'short_video');
    const why = changed ? `${pl.name} does not have short video yet.` : !dev ? `You need a device that can take ${f === 'photo' ? 'photos' : 'video'}.` : hoursLeft() < FORMATS[f].hours ? 'No spare time left this year.' : '';
    return { id: f, name: FORMATS[f].name, hours: FORMATS[f].hours, why, device: dev };
  });
}

/**
 * Things the player can honestly post about: their own milestones from the
 * last few years and finished projects. Posting about one of these ties the
 * post to it, so the feed never invents an achievement.
 */
export function sourceOptions() {
  const p = player();
  const used = new Set(Object.values(world().posts).filter((x) => x.source && x.authorId === p.id).map((x) => x.source.key));
  const ms = p.milestones.map((m, i) => ({ m, i })).filter(({ m }) => m.age >= p.age - 3 && m.kind !== 'digital')
    .map(({ m, i }) => ({ type: 'milestone', key: `${i}:${m.age}`, text: m.text, topic: topicFor(m.text, m.kind), age: m.age }))
    .filter((s) => !used.has(s.key));
  const projects = Object.values(world().projects).filter((x) => x.ownerId === p.id && x.status === 'ready')
    .map((x) => ({ type: 'project', key: x.id, text: x.title, topic: x.topic, projectId: x.id }));
  // Trips the player really took, and homes they really bought or did up. The post can say where the trip was;
  // it never says where the player lives.
  const trips = (p.trips ?? []).filter((t) => !t.refused && t.year >= store.state.year - 1 && COUNTRIES[t.countryId])
    .map((t, i) => ({ type: 'trip', key: `trip:${t.year}:${t.countryId}:${i}`, text: `Your trip to ${COUNTRIES[t.countryId].name}`, topic: 'travel', place: COUNTRIES[t.countryId].name }))
    .filter((s) => !used.has(s.key));
  const homes = p.assets.filter((a) => a.kind === 'property' && (a.boughtAtAge >= p.age - 1 || a.renovatedYear >= store.state.year - 1))
    .map((a) => ({ type: 'home', key: `home:${a.id}:${a.renovatedYear ?? a.boughtAtAge}`, text: a.renovatedYear >= store.state.year - 1 ? 'Your renovation, finished' : 'Your new home', topic: 'life' }))
    .filter((s) => !used.has(s.key));
  return [...projects, ...trips, ...homes, ...ms.reverse()];
}

function topicFor(text, kind) {
  if (/graduat|degree|school|universit|qualified/i.test(text)) return 'education';
  if (/promot|job|hired|career|work|business/i.test(text)) return 'work';
  if (/married|baby|born|child|engaged/i.test(text)) return 'family';
  if (/moved|abroad|travel/i.test(text)) return 'travel';
  if (/music|band|album|concert/i.test(text)) return 'music';
  if (kind === 'fame') return 'life';
  return 'life';
}

const LINES = {
  life: ['A good week, all things considered.', 'Small things this week: coffee, a long walk, an early night.', 'Some days are just ordinary, and that is fine.'],
  family: ['Sunday dinner with the family.', 'Grateful for these people.'],
  friends: ['An evening with friends that went on far too late.', 'Old friends are the best kind.'],
  music: ['Been working on a new piece. Here is a rough take.', 'Played this one until my fingers hurt.'],
  singing: ['A song I have loved for years, my way.', 'Warm-ups, then this.'],
  acting: ['A little scene I wrote. Be gentle.', 'Trying a character out on you all.'],
  dance: ['Learning this routine took a month.', 'One more run-through.'],
  sports: ['Training update: slow progress is still progress.', 'Match day.'],
  gaming: ['Finally beat the level that has been beating me.', 'Thoughts on the game everyone is playing.'],
  fashion: ['Today\'s outfit, put together from things I already had.', 'Thrift-shop find of the year.'],
  cooking: ['Tried a new recipe. Here is how it went.', 'Comfort food, step by step.'],
  education: ['Something I learned this week that I cannot stop thinking about.', 'A quick explainer, because people keep asking.'],
  travel: ['A walk somewhere new.', 'Views from the trip.'],
  work: ['Proud of what the team got done this year.', 'Notes from a working life.'],
  art: ['Work in progress.', 'Finished this one at last.'],
  books: ['What I have been reading, and why it stuck with me.', 'A few thoughts on a book I just finished.'],
};

/**
 * How good a post is, 0–1: the relevant skill, the effort the format takes,
 * the equipment, keeping at it, and whether it fits a current trend.
 */
export function qualityOf(charId, topicId, format, o = {}) {
  const c = charOf(charId);
  const topic = TOPIC_BY_ID[topicId] ?? TOPIC_BY_ID.life;
  const skill = skillOf(c, topic.skill) / 100;
  const dev = o.device ?? accessFor(FORMATS[format].needs === 'web' ? 'web' : FORMATS[format].needs, charId);
  const effort = FORMATS[format].effort;
  const kept = Object.values(world().posts).filter((x) => x.authorId === charId && x.year >= store.state.year - 1 && !x.removed).length;
  const consistency = Math.min(1, kept / 10);
  const trend = o.trend ? 0.1 : 0;
  const project = o.projectQuality ?? null;
  const base = project ?? (skill * 0.5 + (dev?.quality ?? 0.2) * effort * 0.25 + consistency * 0.1 + 0.08);
  return clamp(Math.round((base + trend + rng.around(0, 0.08)) * 1000) / 1000, 0.02, 0.98);
}

/**
 * Publishes a post for the player. Steps: check the platform, format, device,
 * time and audience; write the post; simulate the response once; apply what
 * it does to reputation and relationships.
 * @param {{accountId:string, format:string, topic:string, audience?:string, text?:string,
 *          source?:{type:string, key:string, text?:string, projectId?:string}, aboutIds?:string[],
 *          contractId?:string, disclosed?:boolean, trendId?:string, shareLocation?:boolean, familyShared?:boolean,
 *          affiliate?:boolean, civic?:string}} o
 */
export function publish(o) {
  const p = player();
  const acc = account(o.accountId);
  if (!acc || !isPlayer(acc.ownerId)) return result(false, 'That is not your account.');
  if (acc.status !== 'active') return result(false, 'That account is not active.');
  if (!isOpen(platformStatus(acc.platformId))) return result(false, `${PLATFORM_BY_ID[acc.platformId].name} is not running.`);
  if (p.legal?.incarceration) return result(false, 'Not from a cell.');
  const pl = PLATFORM_BY_ID[acc.platformId];
  const fmt = formatOptions(acc.id).find((f) => f.id === o.format);
  if (!fmt) return result(false, `${pl.name} does not take that kind of post.`);
  if (fmt.why) return result(false, fmt.why);
  const topic = TOPIC_BY_ID[o.topic] ? o.topic : 'life';
  if (topic === 'work' && !o.source && !o.civic && !p.career?.careerId && !p.politics) return result(false, 'There is no work news to share right now.');
  const audience = o.audience && [...pl.privacy, 'public', 'friends', 'private'].includes(o.audience) ? o.audience : acc.visibility;
  const a = acts();
  a.posts = (a.posts ?? 0) + 1;
  if (a.posts > POSTS_PER_YEAR * 2) { a.posts -= 1; return result(false, 'You have posted a great deal this year. Give it a rest.'); }
  if (!spendHours(FORMATS[o.format].hours)) { a.posts -= 1; return result(false, 'No spare time left this year.'); }

  const project = o.source?.type === 'project' ? world().projects[o.source.key] : null;
  const trend = o.trendId ? world().trends.find((t) => t.id === o.trendId && t.platformId === acc.platformId && t.endYear >= store.state.year) : null;
  const q = qualityOf(p.id, topic, o.format, { trend: !!trend && trend.topics.includes(topic), projectQuality: project?.quality, device: fmt.device });
  const text = (o.text && String(o.text).trim().slice(0, 280)) || (o.source?.text ? sourceLine(o.source) : rng.pick(LINES[topic] ?? LINES.life));
  const post = {
    id: newId('post'), accountId: acc.id, authorId: p.id, platformId: acc.platformId, year: store.state.year, age: p.age,
    format: o.format, topic, text, audience, source: o.source ? { type: o.source.type, key: o.source.key } : null,
    aboutIds: (o.aboutIds ?? []).filter((id) => charOf(id)), quality: q, trendId: trend?.id ?? null,
    contractId: o.contractId ?? null, disclosed: o.contractId ? !!o.disclosed : null,
    // A trip post may name the place visited; otherwise only the city, and only when the player chose to.
    location: o.source?.place ?? (o.shareLocation ? p.city : null),
    affiliate: !!o.affiliate && !!account(o.accountId)?.creator, civic: o.civic ?? null,
    familyShared: !!o.familyShared, metrics: null, outcome: null, comments: [], resolvedYear: null, removed: null,
  };
  world().posts[post.id] = post;
  acc.postIds.push(post.id);
  trimPosts(acc);
  if (project) { project.status = 'published'; project.postId = post.id; project.publishedYear = store.state.year; }
  const sim = simulate(post);
  const first = Object.values(world().posts).filter((x) => x.authorId === p.id).length === 1;
  if (first) recordEvent({ kind: 'first_post', charIds: [p.id], platformId: acc.platformId, ref: { type: 'post', id: post.id }, summary: `Your first post on ${pl.name}: "${text}"`, visibility: audience === 'public' ? 'public' : 'family', once: `first_post_${p.id}` });
  if (['long_video', 'short_video'].includes(o.format) && !Object.values(world().posts).some((x) => x.authorId === p.id && x.id !== post.id && ['long_video', 'short_video'].includes(x.format))) {
    recordEvent({ kind: 'first_video', charIds: [p.id], platformId: acc.platformId, ref: { type: 'post', id: post.id }, summary: `You published your first video${project ? `, ${project.title}` : ''}.`, visibility: audience === 'public' ? 'public' : 'family', milestoneText: 'Published your first video.', once: `first_video_${p.id}` });
  }
  return result(true, sim.text, sim.tone, { post });
}

const sourceLine = (s) => (s.type === 'project' ? `New: ${s.text}.` : s.type === 'trip' ? `${s.text.replace(/^Your/, 'My')}, in pictures.` : s.type === 'home' ? `${s.text.replace(/^Your/, 'My')}.` : `Some news: ${s.text.replace(/\.$/, '')}.`);

/** Keeps an account's post list within storage limits, never dropping posts the life story points at. */
function trimPosts(acc) {
  if (acc.postIds.length <= LIMITS.postsPerAccount) return;
  const kept = new Set(world().events.filter((e) => e.ref?.type === 'post').map((e) => e.ref.id));
  const posts = world().posts;
  for (const id of [...acc.postIds]) {
    if (acc.postIds.length <= LIMITS.postsPerAccount) break;
    const x = posts[id];
    if (!x || kept.has(id) || x.outcome === 'viral' || x.contractId) continue;
    delete posts[id];
    acc.postIds = acc.postIds.filter((y) => y !== id);
  }
}

/** The people (accounts with named owners) who can see a post and might react. */
function namedViewers(post) {
  const acc = account(post.accountId);
  return acc.followers.map((id) => account(id)).filter((f) => f && f.status === 'active' && canSee(f.ownerId, post));
}

/**
 * The audience's response to a post, worked out once and kept. Calling it
 * again on a resolved post changes nothing.
 */
export function simulate(post) {
  if (post.resolvedYear != null) return { text: 'Already settled.', tone: 'neutral' };
  const acc = account(post.accountId);
  const pl = PLATFORM_BY_ID[post.platformId];
  const owner = charOf(post.authorId);
  const rep = reputation(post.authorId);
  const activity = Math.max(0.05, platformActivity(post.platformId));
  const q = post.quality;
  const isPublic = post.audience === 'public' && acc.visibility === 'public';
  const named = namedViewers(post);
  const aggregate = post.audience === 'friends' || post.audience === 'private' || post.audience === 'connections' ? 0 : acc.audience;
  const a = acts();
  const tired = (a.posts ?? 0) > POSTS_PER_YEAR ? 0.6 : 1;

  let views = named.length * rng.around(0.75, 0.15) + aggregate * (0.12 + 0.45 * q) * activity * tired;
  let discovery = 0;
  let outcome = 'normal';
  if (isPublic) {
    // Strangers find good work, video travels further than text, and an audience brings a little more of one.
    discovery = (q * q * 150 + Math.sqrt(acc.audience) * q * 8 + rep.recognition * 6) * (0.6 + FORMATS[post.format].effort) * activity * rng.around(1, 0.4);
    const viralChance = q < 0.5 ? 0 : clamp(0.004 + (q - 0.5) * 0.05 + (post.trendId ? 0.01 : 0) + Math.min(0.01, Math.log10(1 + followerCount(acc)) / 600), 0, 0.045);
    const roll = rng.next();
    if (roll < viralChance) { outcome = 'viral'; discovery *= rng.int(60, 400); }
    else if (roll < viralChance + 0.06 * q) { outcome = 'reach'; discovery *= rng.around(6, 2); }
    else if (roll > 0.97 && ['education', 'work', 'life', 'books'].includes(post.topic)) outcome = 'disagreement';
  }
  views += Math.max(0, discovery);
  if (views < 3 + named.length * 0.4 && outcome === 'normal') outcome = 'quiet';
  views = Math.max(named.length ? 1 : 0, Math.round(views));
  const likeRate = clamp(0.04 + 0.16 * q, 0.02, 0.3);
  const likes = Math.min(views, Math.round(views * likeRate * rng.around(1, 0.15)));
  const commentsN = Math.min(likes, Math.round(likes * rng.around(outcome === 'disagreement' ? 0.25 : 0.06, 0.03)));
  const shares = isPublic ? Math.min(likes, Math.round(likes * (0.01 + 0.06 * q) * (outcome === 'viral' ? 3 : 1))) : 0;
  const saves = Math.min(likes, Math.round(likes * 0.02 * FORMATS[post.format].effort * 3));
  const strangers = Math.max(0, views - named.length);
  let followerDelta = isPublic ? Math.round(strangers * (0.004 + 0.035 * q * q) * (outcome === 'disagreement' ? 0.3 : 1)) : 0;
  if (outcome === 'disagreement') followerDelta -= Math.round(acc.audience * rng.around(0.02, 0.01));
  if (tired < 1 && q < 0.4) followerDelta -= Math.round(acc.audience * 0.01);
  followerDelta = Math.max(-Math.round(acc.audience), followerDelta);
  acc.audience = Math.max(0, acc.audience + followerDelta);

  post.metrics = { views, likes, comments: commentsN, shares, saves, followerDelta, named: named.length };
  post.outcome = outcome;
  post.resolvedYear = store.state.year;

  // People the author knows react as themselves; everyone else is the crowd.
  for (const f of named) {
    const who = charOf(f.ownerId);
    if (!who) continue;
    const fond = who.meters?.relationship ?? 50;
    if (rng.chance(clamp(0.2 + fond / 150, 0, 0.9))) post.likedBy = [...(post.likedBy ?? []), who.id];
    if (post.comments.length < 4 && rng.chance(clamp(0.05 + fond / 400, 0, 0.35))) {
      post.comments.push({ id: newId('cm'), authorId: who.id, accountId: f.id, text: commentFrom(who, post), tone: 'warm', year: store.state.year, liked: false, hidden: false });
      if (isPlayer(post.authorId) && who.meters) { who.meters.relationship = clamp(who.meters.relationship + 1); }
    }
  }
  const crowd = Math.min(LIMITS.commentsPerPost - post.comments.length, Math.min(commentsN, outcome === 'disagreement' ? 4 : 2));
  for (let i = 0; i < crowd; i++) {
    const hostile = outcome === 'disagreement' ? rng.chance(0.6) : rng.chance(0.06);
    post.comments.push({ id: newId('cm'), authorId: null, accountId: null, text: hostile ? rng.pick(HOSTILE) : rng.pick(CROWD[post.topic] ?? CROWD.life), tone: hostile ? 'hostile' : 'kind', year: store.state.year, liked: false, hidden: false });
  }

  // What it does to the author. Fame is not automatically good for them, and silence is not a tragedy.
  const enjoys = owner.traits?.some((t) => ['radiant', 'dramatic', 'sunny'].includes(t));
  const frets = owner.traits?.includes('worrier');
  let text;
  let tone = 'good';
  const n = (x) => Math.round(x).toLocaleString('en-US');
  if (outcome === 'viral') {
    adjustReputation(post.authorId, 'recognition', 6, `A post on ${pl.name} spread far beyond the usual audience`);
    owner.stats && (owner.stats.mood = clamp(owner.stats.mood + (frets ? 2 : 6)));
    text = `It spread. ${n(views)} people saw it, and ${n(Math.max(0, followerDelta))} of them followed you. ${frets ? 'Your phone has not stopped buzzing, and you are not sure you like it.' : 'It is a strange, bright feeling.'}`;
    if (isPlayer(post.authorId)) recordEvent({ kind: 'first_viral', charIds: [post.authorId], platformId: post.platformId, ref: { type: 'post', id: post.id }, summary: `A post of yours went viral on ${pl.name}: ${n(views)} views.`, visibility: 'public', milestoneText: `Went viral on ${pl.name} for the first time.`, once: `first_viral_${post.authorId}` });
  } else if (outcome === 'reach') {
    adjustReputation(post.authorId, 'recognition', 1, 'A post reached new people');
    text = `It reached people who had never seen your posts before: ${n(views)} views, ${n(likes)} likes${followerDelta > 0 ? `, and ${n(followerDelta)} new followers` : ''}.`;
  } else if (outcome === 'disagreement') {
    tone = 'bad';
    owner.stats && (owner.stats.mood = clamp(owner.stats.mood - (frets ? 5 : 2)));
    text = `People argued about it in the comments. ${n(views)} views, ${n(commentsN)} comments, not all of them kind.`;
  } else if (outcome === 'quiet') {
    tone = 'neutral';
    text = `It came and went quietly: ${n(views)} ${views === 1 ? 'view' : 'views'}, ${n(likes)} ${likes === 1 ? 'like' : 'likes'}.`;
  } else {
    if (enjoys && owner.stats) owner.stats.mood = clamp(owner.stats.mood + 1);
    text = `${n(views)} views, ${n(likes)} likes, ${n(commentsN)} comments.${followerDelta > 0 ? ` ${n(followerDelta)} new followers.` : ''}`;
  }
  if (post.contractId) adjustReputation(post.authorId, 'credibility', post.disclosed ? 0.5 : -3, post.disclosed ? 'A clearly labelled sponsored post' : 'A sponsored post that did not say so');
  // A post that names relatives in public, when they are not keen on being posted about.
  for (const id of post.aboutIds) {
    const r = charOf(id);
    if (r?.meters && post.audience === 'public' && r.meters.relationship < 55 && r.age >= 13) {
      r.meters.relationship = clamp(r.meters.relationship - 3);
      text += ` ${r.firstName} was not thrilled to be in it.`;
    }
  }
  return { text, tone };
}

function commentFrom(who, post) {
  const role = who.role;
  if (['parent', 'grandparent'].includes(role)) return rng.pick(['So proud of you.', 'Lovely! Call me this weekend.', 'Is this the thing you were telling me about?']);
  if (['sibling', 'relative', 'niece'].includes(role)) return rng.pick(['Show-off.', 'Ha, I remember this.', 'Love it.']);
  if (['spouse', 'partner'].includes(role)) return rng.pick(['That\'s my favourite person.', 'Still proud of this.', '❤']);
  if (['coworker', 'boss', 'mentor'].includes(role)) return rng.pick(['Well done.', 'Great work.', 'Congratulations!']);
  if (post.topic === 'music' || post.topic === 'singing') return rng.pick(['That bridge though.', 'Play it again at the next party.', 'Goosebumps.']);
  return rng.pick(['This is great.', 'Ha! Love this.', 'Miss you, we should catch up.', 'Yes!']);
}

const CROWD = {
  life: ['Relatable.', 'This made my day.', 'Same here.'],
  music: ['Who wrote this? Beautiful.', 'Subscribed.', 'Do you have more?'],
  singing: ['What a voice.', 'More of this please.'],
  cooking: ['Saving this recipe.', 'Tried it, it works!'],
  gaming: ['That last bit was clean.', 'Which difficulty?'],
  education: ['Finally someone explains it properly.', 'Thank you for this.'],
  art: ['The colours!', 'How long did this take?'],
  sports: ['Great form.', 'Keep at it.'],
  fashion: ['Where is the jacket from?', 'Love the look.'],
  travel: ['Adding this to the list.', 'Looks peaceful.'],
  work: ['Congratulations.', 'Well deserved.'],
  books: ['Adding it to my pile.', 'Great review.'],
  acting: ['I laughed out loud.', 'Do more characters!'],
  dance: ['So smooth.', 'Tutorial please.'],
  family: ['Lovely.'], friends: ['Goals.'],
};
const HOSTILE = ['Nobody asked.', 'This is just wrong.', 'Unfollowing.', 'You clearly have no idea what you are talking about.', 'Ratio.'];

// ---------- Comments ----------

/** What the player can do with a comment on one of their posts. */
export function commentAction(postId, commentId, action) {
  const post = world().posts[postId];
  const c = post?.comments.find((x) => x.id === commentId);
  if (!post || !c) return result(false, 'That comment is gone.');
  const mine = isPlayer(post.authorId);
  const acc = account(post.accountId);
  const who = c.authorId ? charOf(c.authorId) : null;
  switch (action) {
    case 'like':
      c.liked = !c.liked;
      return result(true, c.liked ? 'Liked.' : 'Unliked.', 'neutral');
    case 'reply': {
      if (!acts()[`reply:${c.id}`]) {
        acts()[`reply:${c.id}`] = true;
        post.comments.push({ id: newId('cm'), authorId: player().id, accountId: acc.id, text: who ? `Thank you, ${who.firstName}!` : 'Thank you!', tone: 'warm', year: store.state.year, replyTo: c.id, liked: false, hidden: false });
        if (who?.meters && player().npcIds.includes(who.id)) { who.meters.relationship = clamp(who.meters.relationship + 1); who.lastInteractionAge = player().age; }
      }
      return result(true, 'You replied.', 'good');
    }
    case 'hide':
      if (!mine) return result(false, 'Only the author can hide comments.');
      c.hidden = !c.hidden;
      return result(true, c.hidden ? 'Hidden from everyone but you.' : 'Shown again.', 'neutral');
    case 'delete':
      if (!mine && c.authorId !== player().id) return result(false, 'You can only delete comments on your own posts, or your own comments.');
      post.comments = post.comments.filter((x) => x.id !== c.id);
      return result(true, 'Deleted.', 'neutral');
    case 'report':
      // Strangers' comments are the crowd, not people: reporting removes the comment and is logged as moderation.
      world().safety.push({ id: newId('mod'), year: store.state.year, kind: 'report', postId, text: c.text, outcome: c.tone === 'hostile' ? 'removed' : 'kept' });
      if (c.tone === 'hostile') post.comments = post.comments.filter((x) => x.id !== c.id);
      return result(true, c.tone === 'hostile' ? `${PLATFORM_BY_ID[post.platformId].name} removed it.` : `${PLATFORM_BY_ID[post.platformId].name} looked and found nothing against the rules.`, 'neutral');
    default:
      return result(false, 'Not something you can do.');
  }
}

/** Removes the player's own post. Metrics and any record in the life story stay; the post itself is gone from feeds. */
export function removePost(postId) {
  const post = world().posts[postId];
  if (!post || !isPlayer(post.authorId)) return result(false, 'That is not your post.');
  post.removed = 'author';
  return result(true, 'Post removed.', 'neutral');
}

/** Changes who can see one of the player's posts. */
export function setPostAudience(postId, audience) {
  const post = world().posts[postId];
  if (!post || !isPlayer(post.authorId)) return result(false, 'That is not your post.');
  if (!['public', 'friends', 'private', 'connections', 'unlisted', 'followers'].includes(audience)) return result(false, 'Not a setting.');
  post.audience = audience;
  return result(true, 'Audience changed.', 'neutral');
}

// ---------- The feed ----------

/** A small hash-based random number for background posts: it never touches the game's own dice. */
function seeded(...parts) {
  let h = 2166136261;
  for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const BACKGROUND = [
  (r, ctx) => `Everyone on ${ctx.platform} seems to be doing the "${ctx.trend ?? 'before and after'}" thing this year.`,
  (r, ctx) => `A thread in ${ctx.community} about the best ${ctx.topic.toLowerCase()} advice anyone ever got.`,
  (r, ctx) => `People in ${ctx.city} are sharing photos of the first proper weather of the season.`,
  (r, ctx) => `A small creator posted a ${ctx.topic.toLowerCase()} video that is doing the rounds.`,
  (r, ctx) => `${ctx.platform} is testing a new layout. Opinions are mixed.`,
];

/**
 * Disposable "around the platform" posts for a quiet feed: generated from the
 * world (the year, trends, communities, the player's city), never stored, and
 * never about anyone the player knows. Marked background so nothing mistakes
 * them for something that happened to someone.
 */
export function backgroundPosts(platformId, count = 3) {
  const p = player();
  const pl = PLATFORM_BY_ID[platformId];
  const r = seeded(store.state.slotId, store.state.year, platformId);
  const trend = world().trends.find((t) => t.platformId === platformId && t.endYear >= store.state.year);
  const topic = TOPICS[Math.floor(r() * TOPICS.length)];
  const ctx = { platform: pl.name, trend: trend?.name, community: 'a community', topic: topic.name, city: p.city };
  const out = [];
  for (let i = 0; i < count; i++) {
    const make = BACKGROUND[Math.floor(r() * BACKGROUND.length)];
    out.push({ id: `bg_${store.state.year}_${platformId}_${i}`, background: true, platformId, year: store.state.year, text: make(r, ctx), topic: topic.id, metrics: { likes: Math.round(r() * 900) } });
  }
  return out;
}

/**
 * What a character sees in their feed: posts from accounts they follow that
 * they are allowed to see, their own posts, and a little background.
 * @param {{platformId?:string, mode?:'relevant'|'chronological', topic?:string, viewerId?:string, background?:boolean}} o
 */
export function feed(o = {}) {
  const viewerId = o.viewerId ?? player().id;
  const mine = activeAccountsOf(viewerId).filter((a) => !o.platformId || a.platformId === o.platformId);
  const followed = new Set(mine.flatMap((a) => a.following));
  const muted = new Set(mine.flatMap((a) => a.muted));
  const own = new Set(mine.map((a) => a.id));
  const posts = Object.values(world().posts).filter((x) => (followed.has(x.accountId) || own.has(x.accountId)) && !muted.has(x.accountId)
    && (!o.topic || x.topic === o.topic) && canSee(viewerId, x) && x.year >= store.state.year - 6);
  const interests = new Set(mine.flatMap((a) => a.interests));
  const score = (x) => {
    const who = charOf(x.authorId);
    const close = who?.meters ? who.meters.relationship / 100 : 0.3;
    const recency = 1 / (1 + store.state.year - x.year);
    return recency * 2 + close + (interests.has(x.topic) ? 0.5 : 0) + (own.has(x.accountId) ? 0.2 : 0);
  };
  const order = o.mode === 'chronological'
    ? posts.sort((a, b) => b.year - a.year || b.id.localeCompare(a.id, undefined, { numeric: true }))
    : posts.sort((a, b) => score(b) - score(a));
  const items = order.slice(0, 60);
  // Real news from the country's press, as it was reported this year and last: what is actually happening.
  const w = store.state.polities?.[player().countryId];
  if (w?.news?.length && (!o.topic || o.topic === 'work') && !o.platformId) {
    const recent = w.news.filter((n) => n.year >= store.state.year - 1).slice(-3).reverse();
    items.splice(Math.min(2, items.length), 0, ...recent.map((n, i) => ({ id: `news_${n.year}_${i}`, news: true, year: n.year, outlet: n.outlet, text: n.text, tone: n.tone, you: n.you })));
  }
  if (o.background !== false) {
    const plats = [...new Set(mine.map((a) => a.platformId))].filter((id) => isOpen(platformStatus(id)) && PLATFORM_BY_ID[id].audience === 'followers');
    const bg = plats.flatMap((id) => backgroundPosts(id, 2)).filter((x) => !o.topic || x.topic === o.topic).slice(0, LIMITS.feedBackground);
    // Background posts sit after the real ones: they fill a quiet feed, they never push people aside.
    items.push(...bg);
  }
  return items;
}

export { nameOf, firstOf, blocks, accountOn };

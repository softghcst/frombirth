// The sports stories that bring a scene (the Story Director for sport). Each begins only when the record shows it has
// begun: a real tryout, a real coach, a real offer, a real final, a real injury. Nothing here invents a championship or
// an offer to make a story happen; the scenes tell what the record holds and let the player decide how to meet it.
//
//   A  First team                  a child's first tryout for a team, made or missed
//   B  A coach who believes in you  a coach the player has worked hard for, for years
//   C  The big scholarship          a real university offer, and what it means for school and money
//   D  The championship season      a final the player's team actually reached
//   E  The doubles partnership      years with the same partner
//   F  Injury and recovery          a serious injury, and how to come back from it
//   G  The professional dream       a real professional offer
//   H  The comeback                 back in competition after years away
//   I  A new generation             the player's child takes up a sport of their own
//
// state.sports.storyArcs[key] = { key, letter, sportId, started, stage, refs, choice }
// At most one sports scene a year.
import { store } from '../state.js';
import { clamp } from '../util.js';
import { sportOf, REHAB } from '../data/sports.js';
import * as sp from './sports.js';
import { answer } from './sportsLife.js';

export const ARC_LETTERS = {
  A: 'First team', B: 'A coach who believes in you', C: 'The big scholarship', D: 'The championship season', E: 'The doubles partnership',
  F: 'Injury and recovery', G: 'The professional dream', H: 'The comeback', I: 'A new generation',
};
const arcs = (state) => (sp.ensure(state).storyArcs ??= {});
export const storyArcs = (state = store.state) => Object.values(arcs(state));

function begin(state, letter, key0, sportId, refs, text) {
  const all = arcs(state);
  const key = `${state.player.id}/${key0}`; // each person's own story: an heir can have a first team of their own
  if (all[key]) return null;
  all[key] = { key, letter, sportId, started: state.year, stage: 1, refs, choice: null, playerId: state.player.id };
  const a = sp.myAthlete(state);
  a?.arcs.push({ id: `arc_${letter}`, letter, sportId, year: state.year, age: state.player.age, title: ARC_LETTERS[letter], text });
  sp.moment(state, { type: 'arc', sportId, text: `${ARC_LETTERS[letter]}: ${text}`, sig: 3, key: `storyarc/${key}`, people: refs.people ?? [], memory: text });
  return all[key];
}

/**
 * Yearly, after the athletic year. Looks at what actually happened and queues at most one scene.
 * `started` is the relatives who took up a sport this year (engine/sportsFamily.js).
 */
export function tickSportsArcs(state = store.state, started = []) {
  const S = sp.ensure(state);
  const p = state.player;
  if (!p.alive || p.legal?.incarceration || S.arcYear === state.year) return null;
  S.arcYear = state.year;
  const a = sp.myAthlete(state);
  const waiting = new Set(state.pendingEvents.map((e) => e.id));
  const queue = (id, cast) => {
    if (waiting.has(id)) return false;
    // A scene that names a coach the player does not have says "your coach" instead.
    if ('coach' in cast && !state.npcs[cast.coach]?.alive) { delete cast.coach; cast.words = { ...cast.words, coach: 'your coach', Coach: 'Your coach' }; } else if (cast.coach) cast.Coach = cast.coach;
    state.pendingEvents.push({ id, cast });
    return true;
  };
  const tries = [];

  // I — the player's own child, choosing a sport of their own.
  for (const { npc, sportId } of started) {
    if (npc.role !== 'child') continue;
    tries.push(() => {
      const mine = a?.primary;
      const arc = begin(state, 'I', `I/${npc.id}`, sportId, { childId: npc.id, people: [npc.id] }, `${npc.firstName} took up ${sportOf(sportId).name.toLowerCase()}${mine === sportId ? ', the sport you played' : ', a sport of their own'}.`);
      return arc && queue('sport_arc_new_generation', { child: npc.id, words: { sport: sportOf(sportId).name.toLowerCase(), mine: mine && mine !== sportId ? sportOf(mine).name.toLowerCase() : 'something else', same: mine === sportId ? 'yes' : 'no' } });
    });
  }
  if (a) {
    for (const e of sp.activeSports(p.id, state)) {
      const sport = sportOf(e.id);
      // Things the player does between years (a tryout) are dated the year before the one now being played.
      const thisYear = S.moments.filter((m) => m.year >= state.year - 1 && m.personId === p.id && m.sportId === e.id);
      // A — the first tryout for a real team, as a child.
      const tried = thisYear.find((m) => m.type === 'tryout' || (m.type === 'join' && ['club', 'academy', 'school'].includes(sp.orgOf(m.orgId, state)?.level)));
      if (tried && p.age <= 15) {
        tries.push(() => {
          const org = sp.orgOf(tried.orgId, state);
          const coach = sp.coachOf(org?.coachId, state);
          const made = tried.type === 'join';
          const arc = begin(state, 'A', `A/${e.id}`, e.id, { orgId: org?.id, coachId: coach?.id, people: coach ? [coach.id] : [] }, made ? `Made the team at ${org.name}.` : `Tried out for ${org.name}, and was not picked this time.`);
          return arc && queue(made ? 'sport_arc_first_team' : 'sport_arc_first_team_missed', { coach: coach?.id, words: { team: org.name, sport: sport.name.toLowerCase() } });
        });
      }
      // B — a coach who has seen the work, over years.
      for (const cid of [e.privateCoachId, e.coachId].filter(Boolean)) {
        const c = sp.coachOf(cid, state);
        const n = state.npcs[cid];
        const years = state.year - Math.max(c?.since ?? state.year, e.history.find((h) => h.orgId === c?.orgId)?.year ?? c?.since ?? state.year);
        if (c && n?.alive && n.meters.relationship >= 66 && p.hidden.discipline >= 55 && years >= 2 && p.age <= 26 && !e.mentorId) {
          tries.push(() => {
            const arc = begin(state, 'B', `B/${cid}`, e.id, { coachId: cid, people: [cid] }, `${c.name} saw how hard you worked, and said so.`);
            return arc && queue('sport_arc_believer', { coach: cid, words: { sport: sport.name.toLowerCase() } });
          });
          break;
        }
      }
      // D — a final the team actually reached.
      const season = e.seasons.map((id) => S.seasons[id]).find((s) => s?.year === state.year && s.playoffs.some((f) => f.round === 'Final' && (f.home === s.playerTeamId || f.away === s.playerTeamId)));
      if (season) {
        const fin = season.playoffs.find((f) => f.round === 'Final');
        const won = fin.winner === season.playerTeamId;
        const home = fin.home === season.playerTeamId;
        const opp = sp.teamOf(home ? fin.away : fin.home, state);
        const score = home ? `${fin.score[0]}–${fin.score[1]}` : `${fin.score[1]}–${fin.score[0]}`;
        tries.push(() => {
          // One championship story per team the player plays for: the first final they reach together.
          const arc = begin(state, 'D', `D/${season.playerTeamId}`, e.id, { seasonId: season.id, people: [] }, `${won ? 'Won' : 'Lost'} the final of the ${season.name}, ${score} against ${opp.name}.`);
          return arc && queue(won ? 'sport_arc_final_won' : 'sport_arc_final_lost', { coach: e.coachId, words: { league: season.name, opponent: opp.name, score, team: sp.teamOf(season.playerTeamId, state).name, close: Math.abs(fin.score[0] - fin.score[1]) <= 1 ? 'So close. ' : '' } });
        });
      }
      // E — a partnership that has lasted.
      const pair = sp.currentPartnership(e.id, state);
      if (pair && state.year - pair.since >= 2 && pair.events.length >= 4 && state.npcs[pair.b]?.alive) {
        tries.push(() => {
          const arc = begin(state, 'E', `E/${pair.id}`, e.id, { partnershipId: pair.id, people: [pair.b] }, `${state.year - pair.since} years and ${pair.events.length} events with ${pair.bName}${pair.titles ? `, ${pair.titles} ${pair.titles === 1 ? 'title' : 'titles'}` : ''}.`);
          return arc && queue('sport_arc_doubles', { partner: pair.b, words: { sport: sport.name.toLowerCase(), events: String(pair.events.length), titles_line: pair.titles ? `, ${pair.titles} ${pair.titles === 1 ? 'title' : 'titles'}` : '' } });
        });
      }
      // H — back after years away, with a season played.
      if (e.comeback && !e.comeback.told && e.comeback.year < state.year) {
        tries.push(() => {
          const away = e.comeback.year - (e.comeback.from ?? e.comeback.year);
          const arc = begin(state, 'H', `H/${e.id}/${e.comeback.year}`, e.id, { people: [] }, `Back in competitive ${sport.name.toLowerCase()} after ${away} years away.`);
          if (arc) e.comeback.told = state.year;
          return arc && queue('sport_arc_comeback', { coach: e.coachId, words: { sport: sport.name.toLowerCase(), years: String(away) } });
        });
      }
    }
    // F — a serious injury this year.
    const inj = a.injuries.find((x) => x.year === state.year && x.severity >= 35 && x.status === 'out');
    if (inj) {
      const e = sp.entryOf(inj.sportId, p.id, state);
      tries.unshift(() => {
        const arc = begin(state, 'F', `F/${inj.id}`, inj.sportId, { injuryId: inj.id, people: e?.coachId ? [e.coachId] : [] }, `${inj.name.replace(/^./, (c) => c.toUpperCase())}, playing ${sportOf(inj.sportId).name.toLowerCase()}.`);
        return arc && queue('sport_arc_injury', { coach: e?.coachId, words: { injury: inj.name, sport: sportOf(inj.sportId).name.toLowerCase() } });
      });
    }
    // C and G — real offers, waiting in the hub.
    for (const d of S.decisions.filter((x) => x.status === 'open' && x.year === state.year)) {
      // The big scholarship: the first time college offers are on the table (engine/recruiting.js).
      if (['commit', 'sign'].includes(d.kind)) tries.unshift(() => {
        const live = (sp.entryOf(d.sportId, p.id, state)?.recruit?.offers ?? []).filter((o) => !o.pulled).map((o) => ({ instId: o.id, name: o.name, fraction: o.fraction }));
        d.offers = live;
        const best = live.slice().sort((x, y) => y.fraction - x.fraction)[0];
        if (!best) return null;
        const arc = begin(state, 'C', `C/${d.id}`, d.sportId, { decisionId: d.id, instId: best.instId, people: [] }, `${d.offers.length === 1 ? best.name : `${d.offers.length} universities, ${best.name} among them,`} offered an athletic scholarship.`);
        return arc && queue('sport_arc_scholarship', { words: { uni: best.name, share: `${Math.round(best.fraction * 100)}%`, sport: sportOf(d.sportId).name.toLowerCase() } });
      });
      if (['contract', 'turnPro'].includes(d.kind)) tries.unshift(() => {
        const what = d.kind === 'turnPro' ? 'the professional tour' : d.orgName;
        const arc = begin(state, 'G', `G/${d.sportId}`, d.sportId, { decisionId: d.id, orgId: d.orgId ?? null, people: [] }, `An offer to play ${sportOf(d.sportId).name.toLowerCase()} for a living: ${what}.`);
        return arc && queue('sport_arc_pro_dream', { coach: sp.entryOf(d.sportId, p.id, state)?.coachId, words: { club: what, sport: sportOf(d.sportId).name.toLowerCase() } });
      });
    }
  }
  for (const t of tries) if (t()) return true; // one scene a year
  return false;
}

/** The arc a scene belongs to, from its cast. */
function arcFor(state, letter, cast) {
  const all = storyArcs(state).filter((x) => x.letter === letter && x.playerId === state.player.id);
  if (letter === 'I') return all.find((x) => x.refs.childId === cast.child) ?? all.at(-1);
  return all.sort((x, y) => y.started - x.started)[0];
}

/**
 * A choice made in one of the sports scenes (data/events/sports.js), as { arc, how }. Returns a sentence added to the
 * outcome, or ''. Every consequence is small and real: a relationship, a training plan, a skill, a rehab plan.
 */
export function sportArcChoice(v, cast = {}, state = store.state) {
  const p = state.player;
  const arc = arcFor(state, v.arc, cast);
  if (!arc) return '';
  arc.choice = v.how; arc.stage = 2;
  const e = sp.entryOf(arc.sportId, p.id, state);
  const coach = state.npcs[cast.coach];
  const bump = (n, d) => { if (n) n.meters.relationship = clamp(n.meters.relationship + d); };
  const a = sp.myAthlete(state);
  switch (`${v.arc}:${v.how}`) {
    case 'A:work': case 'A:ask': bump(coach, 6); p.hidden.discipline = clamp(p.hidden.discipline + 2); if (e && e.plan.hours < 5) sp.setPlan(e.id, 'technical', 5, state); return e ? 'You train five hours a week now.' : '';
    case 'A:family': for (const id of p.npcIds) if (state.npcs[id]?.role === 'parent') bump(state.npcs[id], 3); return '';
    case 'A:fun': if (a) a.motivation = clamp(a.motivation + 8); return '';
    case 'B:yes': if (e && coach) { e.mentorId = coach.id; coach.flags.mentor = true; bump(coach, 8); } return 'Your coach is your mentor now.';
    case 'B:polite': bump(coach, 2); return '';
    case 'C:family': for (const id of p.npcIds) if (state.npcs[id]?.role === 'parent') bump(state.npcs[id], 3); return 'The offer is waiting in My Athletics.';
    case 'C:grades': p.education.effort = clamp((p.education.effort ?? 50) + 10); return 'The offer is waiting in My Athletics.';
    case 'C:sport': if (e) sp.setPlan(e.id, 'competition', Math.max(5, Math.min(10, e.plan.hours)), state); return 'The offer is waiting in My Athletics.';
    case 'D:team': for (const r of sp.teamOf(e?.teamId, state)?.roster ?? []) bump(state.npcs[r.npcId], 5); if (a) a.confidence = clamp(a.confidence + 5); return '';
    case 'D:coach': bump(coach, 6); return '';
    case 'D:console': for (const r of sp.teamOf(e?.teamId, state)?.roster ?? []) bump(state.npcs[r.npcId], 6); return '';
    case 'D:study': if (e) for (const k of Object.keys(e.skills)) if (['tactics', 'positioning', 'awareness', 'reading'].includes(k)) e.skills[k] = Math.min(e.ceiling[k], e.skills[k] + 1); if (a) a.confidence = clamp(a.confidence - 2); return '';
    case 'E:commit': { const pr = sp.currentPartnership(arc.sportId, state); if (pr) pr.chemistry = clamp(pr.chemistry + 8); bump(state.npcs[cast.partner], 6); return ''; }
    case 'E:talk': if (e?.skills.communication != null) e.skills.communication = Math.min(e.ceiling.communication, e.skills.communication + 2); bump(state.npcs[cast.partner], 3); return '';
    case 'E:split': sp.endPartnership(arc.sportId, state); return '';
    case 'F:patient': case 'F:rush': case 'F:study': {
      const inj = a?.injuries.find((x) => x.id === arc.refs.injuryId);
      if (!inj) return '';
      const want = v.how === 'rush' ? 'rush' : v.how === 'patient' ? 'physio' : 'rest';
      // The plan is set through the rehab decision, which charges for physiotherapy; with no decision open, a plan
      // already chosen (and paid for) stands, and only a cheaper approach can replace it.
      const d = sp.ensure(state).decisions.find((x) => x.kind === 'rehab' && x.injuryId === inj.id && x.status === 'open');
      let plan = want;
      if (d) { const r = answer(d.id, want, state); if (!r.ok) { answer(d.id, 'rest', state); plan = 'rest'; } }
      else if (want !== 'physio') inj.rehab = want;
      else plan = inj.rehab ?? 'rest';
      if (v.how === 'study' && e) for (const k of Object.keys(e.skills)) if (['tactics', 'positioning', 'awareness', 'reading', 'course'].includes(k)) e.skills[k] = Math.min(e.ceiling[k], e.skills[k] + 1.5);
      return plan === 'physio' ? 'Physiotherapy it is.' : plan === 'rush' ? 'You will play through it.' : 'Rest, then.';
    }
    case 'G:coach': bump(coach, 4); return 'The offer is waiting in My Athletics.';
    case 'G:home': for (const id of p.npcIds) if (state.npcs[id]?.role === 'parent') bump(state.npcs[id], 4); return 'The offer is waiting in My Athletics.';
    case 'G:dream': if (a) a.motivation = clamp(a.motivation + 6); return 'The offer is waiting in My Athletics.';
    case 'H:enjoy': if (a) a.motivation = clamp(a.motivation + 10); return '';
    case 'H:prove': if (e) sp.setPlan(e.id, 'conditioning', Math.max(5, e.plan.hours), state); if (a) a.confidence = clamp(a.confidence + 4); return '';
    case 'I:support': case 'I:lead': case 'I:steer': {
      const child = state.npcs[cast.child];
      const rec = sp.athleteOf(cast.child, state);
      const entry = rec?.sports[arc.sportId];
      if (v.how === 'support') { bump(child, 6); if (entry) entry.talent = clamp((entry.talent ?? 50) + 4); }
      if (v.how === 'lead') bump(child, 4);
      if (v.how === 'steer') {
        bump(child, -6);
        // Pushing a child toward a parent's sport rarely works: they keep their own choice, and like it a little less.
        if (entry) entry.talent = clamp((entry.talent ?? 50) - 3);
        return `${child?.firstName ?? 'Your child'} sticks with ${sportOf(arc.sportId).name.toLowerCase()}, and stops telling you about it.`;
      }
      return '';
    }
    default: return '';
  }
}

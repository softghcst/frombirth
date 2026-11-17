// The yearly life update: what changed between one birthday and the next,
// worked out from the saved state before and after Age Up. Nothing is
// invented: a quiet year has a short summary, and that is fine.
//
// Priority 1 (major life events) comes first, then priority 2 (meaningful
// progress); routine things (an ordinary paycheck, routine pet care) are
// left to their own screens.
import { store, player, country } from '../state.js';
import { fmtMoney } from '../util.js';
import { netWorth } from './finance.js';
import { roleLabel } from './relationships.js';
import { summary as livingSummary } from './living.js';

/** What the year starts from. Small: ids, numbers and counts, nothing copied wholesale. */
export function snapshot(state = store.state) {
  const p = state.player;
  const h = p.health;
  return {
    age: p.age, year: state.year, cash: p.finance.cash, savings: p.finance.savings ?? 0, worth: netWorth(state),
    earned: p.finance.lifetimeEarned, tax: p.finance.lifetimeTaxPaid,
    job: p.career.careerId, title: p.career.title, level: p.career.level, retired: !!p.career.retired,
    stage: p.education.stage, enrolled: p.education.enrolled, degrees: p.education.degrees.length,
    people: Object.fromEntries(p.npcIds.map((id) => state.npcs[id]).filter(Boolean).map((n) => [n.id, { alive: n.alive, role: n.role, rel: Math.round(n.meters.relationship) }])),
    milestones: p.milestones.length, followers: p.social?.followers ?? 0, health: p.stats.health, mood: p.stats.mood,
    dx: h ? h.diagnoses.filter((d) => d.status === 'active').map((d) => d.id) : [],
    sessions: h ? h.therapies.reduce((s, c) => s + c.attended, 0) : 0,
    trials: h ? h.trials.map((t) => `${t.id}:${t.status}`) : [],
    countryId: p.countryId, city: p.city, crisis: livingSummary().crisis?.name ?? null,
    jailed: !!p.legal.incarceration, yearsLeft: p.legal.incarceration?.yearsLeft ?? 0, convictions: p.legal.record.filter((r) => r.convicted).length,
    citizenships: (p.citizenships ?? []).length, prisonPlan: p.plans?.prison ?? null,
  };
}

/**
 * The year's summary, from the state before and the state now.
 * @param {string[]} [planLines] what the year's plans did (engine/plans.js)
 */
export function summarize(before, state = store.state, planLines = []) {
  const p = state.player;
  const c = country();
  const now = snapshot(state);
  const major = [];
  const family = [];
  const work = [];
  const money = [];
  const health = [];
  const life = [];
  const name = (id) => state.npcs[id];

  // Family: births, deaths, marriages, partings.
  for (const [id, n] of Object.entries(now.people)) {
    const was = before.people[id];
    const npc = name(id);
    if (!npc) continue;
    if (!was && npc.age <= 1 && ['child', 'sibling', 'grandchild', 'greatgrandchild', 'niece'].includes(n.role)) major.push(`${npc.firstName} was born: your ${roleLabel(npc).toLowerCase()}.`);
    else if (!was && n.role === 'pet') family.push(`${npc.firstName} the ${npc.species} joined the family.`);
    else if (!was && ['partner', 'friend'].includes(n.role)) family.push(`You got to know ${npc.firstName}.`);
    if (was?.alive && !n.alive) major.push(`${npc.firstName}, your ${roleLabel(npc).toLowerCase()}, died.`);
    if (was && was.role !== 'spouse' && n.role === 'spouse') major.push(`You married ${npc.firstName}.`);
    if (was && ['spouse', 'partner'].includes(was.role) && n.role === 'ex') major.push(`You and ${npc.firstName} parted.`);
    if (was && n.alive && n.role !== 'pet' && ['spouse', 'partner', 'parent', 'child', 'sibling', 'friend'].includes(n.role)) {
      const d = n.rel - was.rel;
      if (d >= 12) family.push(`You and ${npc.firstName} grew closer.`);
      else if (d <= -12) family.push(`You and ${npc.firstName} drifted apart a little.`);
    }
  }

  // Work and study.
  if (now.job && now.job !== before.job) work.push(`You started work: ${now.title}.`);
  else if (now.job && now.level > before.level) work.push(`Promoted: ${now.title}.`);
  if (!now.job && before.job && !now.retired) work.push(`You left your job as ${before.title}.`);
  if (now.retired && !before.retired) major.push('You retired.');
  if (now.degrees > before.degrees) major.push(`You graduated: ${p.education.degrees.at(-1).type.replace(/_/g, ' ')}.`);
  else if (now.stage !== before.stage && now.enrolled) work.push(`You moved up to ${now.stage.replace(/_/g, ' ')}.`);

  // The law, and where life is lived.
  if (now.convictions > before.convictions) major.push('You were convicted.');
  if (now.jailed && !before.jailed) major.push(`You were sent to prison${now.yearsLeft ? ` (${now.yearsLeft} year${now.yearsLeft === 1 ? '' : 's'} to serve)` : ''}.`);
  else if (!now.jailed && before.jailed) major.push('You were released.');
  else if (now.jailed) work.push(`Another year inside: ${now.yearsLeft} left.`);
  if (now.countryId !== before.countryId) major.push(`You moved to ${country().name}.`);
  else if (now.city !== before.city) family.push(`You moved to ${now.city}.`);
  if (now.citizenships > before.citizenships) major.push('You became a citizen of another country.');
  const world = [];
  if (now.crisis && now.crisis !== before.crisis) world.push(`${now.crisis} in ${country().name}.`);
  else if (!now.crisis && before.crisis && now.countryId === before.countryId) world.push(`The ${before.crisis.toLowerCase()} in ${country().name} is over.`);

  // Money: totals, not transactions.
  const earned = now.earned - before.earned;
  if (earned > 0) money.push(`Earned ${fmtMoney(earned, c)}, and paid ${fmtMoney(now.tax - before.tax, c)} in tax.`);
  const worth = now.worth - before.worth;
  if (Math.abs(worth) >= Math.max(1, Math.abs(before.worth) * 0.05)) money.push(`Your net worth ${worth > 0 ? 'rose' : 'fell'} by ${fmtMoney(Math.abs(worth), c)}.`);
  if (now.savings > before.savings) money.push(`Savings: ${fmtMoney(now.savings, c)}.`);

  // Health: new diagnoses, care that happened, decisions waiting. Private, and only the player sees it.
  const h = p.health;
  if (h) {
    for (const id of now.dx.filter((x) => !before.dx.includes(x))) { const d = h.diagnoses.find((x) => x.id === id); if (d) major.push(`A diagnosis: ${d.name}.`); }
    const sessions = now.sessions - before.sessions;
    if (sessions > 0) health.push(`You went to ${sessions} therapy session${sessions === 1 ? '' : 's'}.`);
    for (const t of h.trials) {
      const was = before.trials.find((x) => x.startsWith(`${t.id}:`));
      const med = t.medicationId.replace(/_/g, ' ');
      if (!was) health.push(`You started ${med}.`);
      else if (was !== `${t.id}:${t.status}` && ['switched', 'discontinued'].includes(t.status)) health.push(t.status === 'switched' ? `You changed from ${med} to something better suited.` : `You came off ${med}, gradually.`);
    }
    if (h.proposals.some((x) => x.status === 'open')) health.push('A decision about your care is waiting in My Health.');
  }
  if (now.health - before.health <= -10) health.push('Your physical health took a knock this year.');

  // Everything that carried on by itself.
  life.push(...planLines.filter((x) => !/^Looking after/.test(x) || planLines.length === 1));
  const followers = now.followers - before.followers;
  if (followers && !planLines.some((x) => /followers/.test(x))) life.push(`${followers > 0 ? '+' : ''}${followers.toLocaleString()} followers.`);
  const newMilestones = p.milestones.slice(before.milestones).filter((m) => m.kind !== 'health').map((m) => m.text);
  for (const m of newMilestones) if (![...major, ...work, ...family].some((x) => x.includes(m))) life.push(m);

  const sections = [['Big moments', major], ['Family and friends', family], ['Work and study', work], ['Money', money], ['Health', health], ['Your year', life], ['The world', world]]
    .map(([title, lines]) => ({ title, lines: [...new Set(lines)].slice(0, 5) })).filter((s) => s.lines.length);
  return { id: `year_${p.id}_${now.year}`, from: before.age, to: now.age, year: now.year, sections, quiet: !sections.length };
}

// Small constructors so event files stay readable.
export const st = (target, delta) => ({ type: 'stat', target, delta });
export const hid = (target, delta) => ({ type: 'hidden', target, delta });
export const tal = (target, delta) => ({ type: 'talent', target, delta });
export const cash = (delta) => ({ type: 'cash', delta });
export const rel = (target, delta) => ({ type: 'relationship', target, delta });
export const flag = (target, value = true) => ({ type: 'flag', target, value });
export const cond = (value) => ({ type: 'condition', value });
export const gpa = (delta) => ({ type: 'gpa', delta });
export const heat = (delta) => ({ type: 'legal', delta });
export const followers = (delta) => ({ type: 'followers', delta });
export const count = (target, delta = 1) => ({ type: 'counter', target, delta });
export const ms = (value) => ({ type: 'milestone', value });
export const death = (value) => ({ type: 'death', value });
/** Adds an NPC and binds it to token `as` for the outcome text. */
export const addNpc = (role, as, opts = {}) => ({ type: 'addNpc', target: as, value: { role, ...opts } });

export const ok = (text, ...effects) => ({ on: 'success', text, effects });
export const bad = (text, ...effects) => ({ on: 'fail', text, effects });
/** Outcome for choices with no skill check. Tone colours the journal line. */
export const any = (text, tone, ...effects) => ({ on: 'always', text, tone, effects });

/** Skill check: base chance plus weighted stat paths (each centred on 50). */
export const chk = (base, factors = {}) => ({ base, factors });
export const need = (path, op, value) => ({ path, op, value });

/** The cast member will remember this about the player (shown in their history). */
export const mem = (target, key, text) => ({ type: 'memory', target, value: { key, text } });
/** Runs another scene straight after this one, with the same cast. */
export const queue = (value) => ({ type: 'queue', value });
/** Multiplies part-time pay, e.g. 0.5 when shifts are cut in half. */
export const ptScale = (delta) => ({ type: 'partTimeScale', delta });
/** Outcome variant used only when its history conditions hold. */
export const when = (requires, outcome) => ({ ...outcome, requires });

/** Marks someone already in the scene as a contact, findable later as 'tag:<tag>'. */
export const tagNpc = (target, tag, title) => ({ type: 'tag', target, value: { tag, title } });
/** Two cast members stop speaking to each other (or, with endFeud, make up). */
export const feud = (a, b) => ({ type: 'feud', target: a, value: b, delta: 1 });
export const endFeud = (a, b) => ({ type: 'feud', target: a, value: b, delta: 0 });

/** Work: change performance, multiply salary, lose the job, or be promoted. */
export const perf = (delta) => ({ type: 'perf', delta });
export const pay = (delta) => ({ type: 'pay', delta });
export const fired = (value = 'fired') => ({ type: 'fired', value });
export const promoted = () => ({ type: 'promoted' });

/** Changes a cast member's role and/or flags, e.g. npcSet('lover', { flags: { engaged: true } }). */
export const npcSet = (target, value) => ({ type: 'npcSet', target, value });

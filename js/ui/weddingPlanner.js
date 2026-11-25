// Planning the wedding, and the wedding itself, as a scene (like the salon's: js/ui/salonVisit.js, whose layout
// classes it shares). A wedding planner walks the couple through the day piece by piece, the venue drawn behind them
// and changing as each choice is made, with the running total under the planner's bubble. The partner has a dream
// (romance.dreamOf) the planner lets slip; meeting it means more to them. Then the prenup, the bill, and the day:
// the walk down the aisle, the vows (romance.VOWS), the kiss, confetti. The engine is js/engine/romance.js.
import { avatarSvg, faceGenderOf } from '../avatar/render.js';
import { normalize, hash } from '../avatar/catalog.js';
import * as love from '../engine/romance.js';
import { venueScene, cakeArt, bandArt, postcardFront, postcardArt } from './weddingScenery.js';
import { player, country, store } from '../state.js';
import { fmtMoney, localMoney } from '../util.js';
import { openModal, confirmModal, messageModal } from './modals.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const PLANNERS = ['Odette', 'Giselle', 'Bianca', 'Celeste', 'Theo', 'Rafael', 'Imani', 'Noor'];
const STUDIOS = ['Happily Ever After', 'Ever & Always', 'Something Blue Weddings', 'The Golden Ring', 'Forever Yours'];

/** The planner's sign: two linked rings with a sparkle, in a round badge. */
const LOGO = `<svg class="sv-logo-art" viewBox="0 0 120 120" aria-hidden="true">
  <circle cx="60" cy="60" r="56" fill="#FFF4E6" stroke="#23140f" stroke-width="4"/>
  <circle cx="60" cy="60" r="47" fill="none" stroke="#E8B04B" stroke-width="3" stroke-dasharray="4 6"/>
  <g class="wp-rings" fill="none" stroke-width="7"><circle cx="49" cy="66" r="18" stroke="#23140f"/><circle cx="71" cy="66" r="18" stroke="#23140f"/>
    <circle cx="49" cy="66" r="18" stroke="#E8B04B" stroke-width="3.5"/><circle cx="71" cy="66" r="18" stroke="#D9DEE5" stroke-width="3.5"/></g>
  <path d="M71 30l-6-8h12z" fill="#BFE6FF" stroke="#23140f" stroke-width="2.5" stroke-linejoin="round"/>
  <g fill="#FFFFFF" stroke="#23140f" stroke-width="2" stroke-linejoin="round"><path d="M28 32l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z"/><path d="M95 36l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z"/></g>
</svg>`;

/**
 * Opens the planner for an engagement to `npc`. Resolves when the scene closes: { married: true } after the wedding,
 * otherwise {}.
 * @param {object} api the game's (changed() after the wedding)
 * @param {object} npc the fiancé or fiancée
 */
export function openWeddingPlanner(api, npc, { intro = true } = {}) {
  return new Promise((resolve) => {
    const p = player();
    const c = country();
    const studio = STUDIOS[hash(`studio:${p.city ?? ''}`) % STUDIOS.length];
    const planner = PLANNERS[hash(`planner:${npc.id}`) % PLANNERS.length];
    const plannerGender = /^(Theo|Rafael)$/.test(planner) ? 'male' : 'female';
    const plannerFace = avatarSvg({ appearance: normalize({}, `planner:${planner}`), age: 38, gender: plannerGender, seed: `planner:${planner}`, mood: 92, viewBox: '96 150 320 300', label: planner });
    const dream = love.dreamOf(npc);
    const dreamVenue = love.WEDDING_PLAN.venue.find((v) => v.id === dream.venue);
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const plan = Object.fromEntries(love.PLAN_STEPS.map((k) => [k, null]));
    let married = false;

    const root = document.createElement('div');
    root.className = 'salon-screen wp-screen';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', `Planning the wedding with ${planner}`);
    document.body.appendChild(root);
    const close = () => { root.remove(); resolve(married ? { married: true, honeymoon: chosen('honeymoon') === 'trip' } : {}); };

    const youFace = (mood = 90, o = {}) => avatarSvg({ appearance: p.appearance, age: p.age, gender: p.gender, face: faceGenderOf(p), seed: p.id, mood, label: p.firstName, ...o });
    const themFace = (mood = 90, o = {}) => avatarSvg({ appearance: npc.appearance, age: npc.age, gender: npc.gender, seed: npc.id, mood, label: npc.firstName, ...o });
    const chosen = (k) => plan[k] ?? love.WEDDING_PLAN[k][0].id;
    const themeHex = () => love.WEDDING_PLAN.theme.find((t) => t.id === chosen('theme')).hex;
    const filled = () => Object.fromEntries(love.PLAN_STEPS.map((k) => [k, chosen(k)]));
    /** "at the castle", "on the beach", "at city hall": where, for the banner. */
    const venueAt = () => { const v = love.WEDDING_PLAN.venue.find((o) => o.id === plan.venue); return /^On /.test(v.name) ? v.name.toLowerCase() : `at ${v.name.replace(/^A /, 'a ').replace(/^An /, 'an ').replace(/^City hall/, 'city hall')}`; };
    const totals = () => love.planTotals(filled(), npc, c);

    /**
     * The stage: the venue behind, and in front the couple up close, in two round frames side by side (as close as
     * the salon's mirror); the venue's flowers and décor take the colors and flowers chosen. At the kiss the frames meet,
     * with a heart.
     */
    const closeUp = { viewBox: '86 120 340 340' };
    const stage = ({ kiss = false } = {}) => `
      <div class="sv-stage wp-stage" style="--wp-theme:${themeHex()}">
        ${venueScene(chosen('venue'), themeHex(), chosen('flowers'))}
        <div class="sv-sign wp-sign">${esc(studio)}</div>
        <div class="wp-banner" style="--wp-theme:${themeHex()}"><span>${esc(p.firstName)} ♥ ${esc(npc.firstName)}${plan.venue ? `<small>${esc(venueAt())}</small>` : ''}</span></div>
        ${plan.cake ? `<div class="wp-side wp-cake" title="${esc(love.WEDDING_PLAN.cake.find((o) => o.id === plan.cake).name)}">${cakeArt(plan.cake, themeHex())}</div>` : ''}
        ${plan.music ? `<div class="wp-side wp-band" title="${esc(love.WEDDING_PLAN.music.find((o) => o.id === plan.music).name)}">${bandArt(plan.music)}</div>` : ''}
        <div class="wp-altar${kiss ? ' wp-kiss' : ''}">
          <div class="wp-couple"><div class="wp-person">${youFace(90, closeUp)}</div><div class="wp-person">${themFace(90, closeUp)}</div>
          ${kiss ? '<span class="wp-kiss-heart" aria-hidden="true">♥</span>' : ''}</div></div>
        <button type="button" class="sv-leave" data-leave aria-label="Stop planning">×</button>
      </div>`;

    function scene({ line, who = 'planner', body = '', replies = [], bill = true, kiss = false, extra = '' }) {
      const t = totals();
      // Who is talking: the planner, the partner, or no one (what happens, told).
      const speaker = who === 'partner' ? { face: themFace(95), name: npc.firstName } : who === 'narrator' ? null : { face: plannerFace, name: planner };
      root.innerHTML = `
        <div class="sv-scene">${stage({ kiss })}
          <div class="sv-talk">
            ${speaker ? `<div class="sv-speaker"><div class="sv-stylist">${speaker.face}</div>
              <div class="sv-bubble" aria-live="polite"><strong>${esc(speaker.name)}</strong><p>${esc(line)}</p></div></div>`
              : `<p class="wp-narration" aria-live="polite">${esc(line)}</p>`}
            <div class="sv-body">${body}</div>
            <div class="sv-replies">${replies.map((r, i) => `<button type="button" class="btn ${r.primary ? 'primary' : ''} sv-reply" data-reply="${i}" ${r.disabled ? 'disabled' : ''}>${esc(r.label)}</button>`).join('')}</div>
            ${bill ? `<p class="sv-bill muted" data-bill>${Object.values(plan).some(Boolean) ? `So far: ${esc(fmtMoney(t.cost, c))}` : ''}</p>` : ''}
          </div>${extra}
        </div>`;
      root.querySelector('[data-leave]').onclick = married ? close : leaveEarly;
      root.querySelectorAll('[data-reply]').forEach((b) => { b.onclick = () => replies[Number(b.dataset.reply)].go(); });
    }

    function leaveEarly() {
      scene({ line: `No rush. The date will keep. Come back when you're ready, and bring ${npc.firstName}.`, bill: false,
        replies: [{ label: 'Keep planning', primary: true, go: () => step(0) }, { label: 'Leave', go: close }] });
    }

    const LINES = {
      venue: `First things first: where? ${npc.firstName} once told me about ${dream.venue === 'castle' ? 'a castle' : dreamVenue.name.toLowerCase()}, you know. Just saying.`,
      guests: `Now, the guest list: how big a day? Each guest is an invitation, a seat and a favor, and dinner comes later. ${dream.big ? `${npc.firstName} wants everyone there, I can tell.` : `${npc.firstName} strikes me as someone who'd like it small.`}`,
      theme: 'Pick a color. It goes on everything: the flowers, the napkins, the ribbon on the cake.',
      flowers: 'Flowers! Watch the arch.',
      attire: `What are you wearing? ${npc.firstName} has been very secretive about theirs.`,
      cake: 'My favorite part. The cake.',
      music: 'Music for the walk down the aisle, and for the dancing after.',
      food: 'And something to eat. This one is per guest, so mind the list.',
      honeymoon: 'Last one, and the best one: the honeymoon.',
    };

    /** One step of the plan: its options as tiles, the stage changing as each is tried. */
    function step(i) {
      const key = love.PLAN_STEPS[i];
      const opts = love.WEDDING_PLAN[key];
      const guests = love.WEDDING_PLAN.guests.find((g) => g.id === chosen('guests')).count;
      const price = (o) => (key === 'guests' ? (o.count > 2 ? fmtMoney(love.guestCost(o.count, c), c) : 'Free') : key === 'food' ? fmtMoney(localMoney(o.perGuest, c) * guests, c) : o.cost ? fmtMoney(localMoney(o.cost, c), c) : 'Free');
      const dreamTag = (o) => (key === 'venue' && o.id === dream.venue) || (key === 'guests' && (dream.big ? o.count >= 100 : o.count <= 40)) ? '<em class="wp-dream">♥ dream</em>' : '';
      // In the game's own list style: a row each, its picture, what it is, and its price (or a check, once chosen).
      // The colors are the salon's round swatches, named underneath.
      const tiles = key === 'theme'
        ? `<div class="wp-swatches">${opts.map((o) => `<button type="button" class="wp-swatch" data-pick="${o.id}" aria-pressed="${plan[key] === o.id}">
            <span class="av-opt av-swatch${plan[key] === o.id ? ' on' : ''}" style="background:${o.hex}"></span>${esc(o.name)}</button>`).join('')}</div>`
        : `<div class="nav-group wp-rows">${opts.map((o) => `<button type="button" class="nav-row wp-row${plan[key] === o.id ? ' on' : ''}" data-pick="${o.id}" aria-pressed="${plan[key] === o.id}">
            <span class="nr-icon emoji" aria-hidden="true">${o.icon}</span>
            <span class="nr-main"><span class="nr-label">${esc(o.name)}${dreamTag(o)}</span><small>${esc(o.sub ?? '')}</small></span>
            <span class="wp-price">${plan[key] === o.id ? '<span class="wp-check" aria-hidden="true">✓</span>' : ''}${esc(price(o))}</span></button>`).join('')}</div>`;
      const dots = `<div class="wp-steps" aria-label="Step ${i + 1} of ${love.PLAN_STEPS.length}">${love.PLAN_STEPS.map((k, j) => `<i class="${j < i ? 'done' : j === i ? 'now' : ''}"></i>`).join('')}</div>`;
      scene({
        line: LINES[key] + (key === 'food' && guests > 2 ? ` That's ${guests} plates.` : ''),
        body: dots + tiles,
        replies: [
          ...(i > 0 ? [{ label: 'Back', go: () => step(i - 1) }] : []),
          { label: i === love.PLAN_STEPS.length - 1 ? 'That\'s the plan' : 'Next', primary: true, disabled: !plan[key], go: () => (i === love.PLAN_STEPS.length - 1 ? prenupAsk() : step(i + 1)) },
        ],
      });
      root.querySelectorAll('[data-pick]').forEach((b) => {
        b.onclick = () => {
          plan[key] = b.dataset.pick;
          step(i);
          const o = opts.find((x) => x.id === plan[key]);
          // The planner reacts when a choice meets the dream.
          if ((key === 'venue' && o.id === dream.venue) || (key === 'guests' && (dream.big ? o.count >= 100 : o.count <= 40))) {
            root.querySelector('.sv-bubble p').textContent = key === 'venue' ? `${o.name}! Oh, ${npc.firstName} is going to cry.` : `Perfect. That's exactly what ${npc.firstName} wanted.`;
          }
        };
      });
    }

    /** The prenup: asked or not, and what they say. */
    function prenupAsk() {
      scene({ line: `Before we book anything, the unromantic bit. Do you want a prenup? Without one, a divorce splits everything down the middle. Asking will sting ${npc.firstName} a little.`,
        replies: [{ label: 'Back', go: () => step(love.PLAN_STEPS.length - 1) }, { label: 'Ask for a prenup', go: () => {
          const answer = love.askForPrenup(npc.id);
          api?.changed?.();
          if (answer.ok) review(true, answer.text);
          else scene({ line: answer.text,
            replies: [{ label: 'Marry without one', primary: true, go: () => review(false) }, { label: 'Put the wedding on hold', go: close }] });
        } }, { label: 'No prenup', primary: true, go: () => review(false) }] });
    }

    /** The whole plan and its bill, then booking it. */
    function review(prenup, note = '') {
      const t = totals();
      const cash = player().finance.cash;
      const lines = t.lines.map((l) => `<div class="sv-line"><span>${esc(l.label)}</span><span>${l.cost ? esc(fmtMoney(l.cost, c)) : 'Free'}</span></div>`).join('');
      const dreamNote = t.dreamVenue && t.dreamSize ? `It's everything ${npc.firstName} dreamed of.` : t.dreamVenue ? `${npc.firstName} is going to love the venue.` : t.dreamSize ? `${npc.firstName} will love the guest list.` : '';
      scene({ line: `${note ? `${note} ` : ''}Here it is, all of it. ${dreamNote}`.trim(),
        body: `<div class="sv-receipt">${lines}${prenup ? '<div class="sv-line"><span>A prenup, signed</span><span></span></div>' : ''}<div class="sv-line sv-total"><span>Total</span><span>${esc(fmtMoney(t.cost, c))}</span></div></div>`,
        bill: false,
        replies: [{ label: 'Change something', go: () => step(0) },
          { label: cash < t.cost ? `You have ${fmtMoney(cash, c)}` : 'Book the wedding', primary: true, disabled: cash < t.cost, go: () => book(prenup) }] });
    }

    function book(prenup) {
      const res = love.marry(npc.id, filled(), prenup);
      if (!res.ok) { scene({ line: res.text, bill: false, replies: [{ label: 'Change something', primary: true, go: () => step(0) }, { label: 'Leave', go: close }] }); return; }
      married = true;
      api?.changed?.();
      aisle();
    }

    /** The day: down the aisle, the vows, the kiss, confetti. */
    function aisle() {
      const music = { playlist: 'Your song', dj: 'The DJ fades the music down', band: 'The band', quartet: 'The string quartet' }[chosen('music')];
      scene({ who: 'narrator', line: `${music} starts to play, and there's ${npc.firstName}, coming down the aisle. Everyone stands.`, bill: false,
        replies: [{ label: 'Take their hand', primary: true, go: vows }] });
    }
    function vows() {
      scene({ line: 'Dearly beloved... Your turn. What do you say?', bill: false,
        replies: Object.entries(love.VOWS).map(([id, v]) => ({ label: v.label, go: () => {
          const said = love.sayVows(npc.id, id);
          scene({ who: 'narrator', line: said, bill: false, replies: [{ label: 'Listen to their vows', primary: true, go: () =>
            scene({ who: 'partner', line: `"I didn't think I'd get to have this. And then there was you." ${npc.firstName} squeezes your hand. "I do."`, bill: false,
              replies: [{ label: 'I do', primary: true, go: kiss }] }) }] });
        } })) });
    }
    function kiss() {
      scene({ who: 'narrator', line: 'I now pronounce you married. You may kiss!', bill: false, kiss: true,
        replies: [{ label: 'Kiss', primary: true, go: finale }] });
    }
    function finale() {
      const confetti = reduced ? '' : `<div class="wp-confetti" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<i style="left:${(i * 37) % 100}%;animation-delay:${(i % 7) * 0.12}s;background:${[themeHex(), '#FFFFFF', '#FFD36E', '#F28CA8'][i % 4]}"></i>`).join('')}</div>`;
      const honey = love.WEDDING_PLAN.honeymoon.find((h) => h.id === chosen('honeymoon'));
      root.innerHTML = `<div class="wp-finale${reduced ? ' sv-still' : ''}" style="--wp-theme:${themeHex()}">${confetti}
        <p class="wp-just">Just married!</p>
        <div class="wp-pair"><div class="wp-frame">${youFace(98)}</div><span class="wp-heart" aria-hidden="true">♥</span><div class="wp-frame">${themFace(98)}</div></div>
        <p class="wp-names">${esc(p.firstName)} &amp; ${esc(npc.firstName)}</p>
        <p class="wp-after">${esc(honey.id === 'home' ? 'And then home, together.' : 'Next stop: the honeymoon. Where to?')}</p>
        <button type="button" class="btn primary" data-done>${honey.id === 'home' ? 'Back to your life' : 'Plan the honeymoon'}</button></div>`;
      root.querySelector('[data-done]').onclick = close;
      root.querySelector('[data-done]').focus?.();
    }

    function hello() {
      scene({ line: `Congratulations, ${p.firstName}! I'm ${planner}, and I'll be planning your wedding to ${npc.firstName}. Nine little decisions and one very big day. Shall we?`,
        bill: false, replies: [{ label: 'Let\'s plan it!', primary: true, go: () => step(0) }, { label: 'Not yet', go: close }] });
    }

    const blocked = love.weddingBlock(npc.id);
    if (blocked) { scene({ line: blocked, bill: false, replies: [{ label: 'Leave', primary: true, go: close }] }); return; }
    if (intro) {
      root.innerHTML = `<div class="sv-intro wp-intro${reduced ? ' sv-still' : ''}" data-intro><div class="sv-logo">${LOGO}<div class="sv-logo-name">${esc(studio)}</div><div class="sv-logo-sub">Wedding planning</div></div></div>`;
      const go = () => { if (root.isConnected && root.querySelector('[data-intro]')) hello(); };
      root.querySelector('[data-intro]').onclick = go;
      setTimeout(go, reduced ? 350 : 1500);
    } else hello();
  });
}

// ---------- With the scenes turned off (Settings) ----------

/** Whether weddings are planned and lived as scenes. Kept in this browser for every life, like Haptics; on by default. */
export const WEDDING_SCENES_KEY = 'pathways.weddingScenes';
export function weddingScenesOn() {
  try { return localStorage.getItem(WEDDING_SCENES_KEY) !== 'off'; } catch { return true; }
}
export function setWeddingScenes(on) {
  try { if (on) localStorage.removeItem(WEDDING_SCENES_KEY); else localStorage.setItem(WEDDING_SCENES_KEY, 'off'); } catch { /* storage unavailable */ }
}

/** Ready-made plans, for a quick choice: eloping, city hall, or the partner's dream. */
const PRESETS = {
  elope: { venue: 'courthouse', guests: 'elope', theme: 'ivory', flowers: 'wild', attire: 'borrowed', cake: 'cupcakes', music: 'playlist', food: 'potluck', honeymoon: 'home' },
  cityhall: { venue: 'courthouse', guests: 'intimate', theme: 'ivory', flowers: 'roses', attire: 'rack', cake: 'tiered', music: 'playlist', food: 'buffet', honeymoon: 'trip' },
};
const STEP_LABELS = { venue: 'Venue', guests: 'Guest list', theme: 'Colors', flowers: 'Flowers', attire: 'What you wear', cake: 'Cake', music: 'Music', food: 'Food', honeymoon: 'Honeymoon' };

/**
 * The wedding on one page, for those who turned the scenes off: a ready-made plan (elope, city hall, their dream) or
 * each piece picked from a list, the total, the prenup; then a "Just married!" card. Resolves like openWeddingPlanner.
 */
export function openQuickWedding(api, npc) {
  return new Promise((resolve) => {
    const p = player();
    const c = country();
    const dream = love.dreamOf(npc);
    const plan = { ...PRESETS.cityhall };
    const blocked = love.weddingBlock(npc.id);
    const label = (key, o) => {
      if (key === 'theme') return o.name;
      const price = key === 'guests' ? (o.count > 2 ? fmtMoney(love.guestCost(o.count, c), c) : 'free')
        : key === 'food' ? `${fmtMoney(localMoney(o.perGuest, c), c)} a plate` : o.cost ? fmtMoney(localMoney(o.cost, c), c) : 'free';
      const isDream = (key === 'venue' && o.id === dream.venue) || (key === 'guests' && (dream.big ? o.count >= 100 : o.count <= 40));
      return `${o.name} · ${price}${isDream ? ' ♥' : ''}`;
    };
    const fields = () => love.PLAN_STEPS.map((key) => `<label class="wq-field"><span>${esc(STEP_LABELS[key])}</span>
      <select data-key="${key}">${love.WEDDING_PLAN[key].map((o) => `<option value="${o.id}" ${plan[key] === o.id ? 'selected' : ''}>${esc(label(key, o))}</option>`).join('')}</select></label>`).join('');
    const m = openModal(`
      <h2>Plan the wedding</h2>
      ${blocked ? `<p class="body">${esc(blocked)}</p><button class="btn primary" data-no>OK</button>` : `
      <p class="body">You and ${esc(npc.firstName)}. ♥ marks what ${esc(npc.firstName)} has always dreamed of.</p>
      <div class="wq-presets">
        <button type="button" class="chip" data-preset="elope">Elope</button>
        <button type="button" class="chip" data-preset="cityhall">City hall</button>
        <button type="button" class="chip" data-preset="dream">${esc(npc.firstName)}'s dream</button>
      </div>
      <div class="wq-fields" data-fields>${fields()}</div>
      <div class="kv wq-total"><span>Total</span><strong data-total></strong></div>
      <label class="wq-prenup"><input type="checkbox" data-prenup> Ask for a prenup</label>
      <div class="btn-row"><button class="btn" data-no>Not yet</button><button class="btn primary" data-yes>Get married</button></div>`}`,
    { dismissable: true, back: false, onDismiss: () => resolve({}) });
    const el = m.el;
    const done = (r = {}) => { m.close(); resolve(r); };
    el.querySelector('[data-no]').onclick = () => done();
    if (blocked) return;
    const refresh = () => {
      const t = love.planTotals(plan, npc, c);
      const cash = player().finance.cash;
      el.querySelector('[data-total]').textContent = fmtMoney(t.cost, c);
      const yes = el.querySelector('[data-yes]');
      yes.disabled = cash < t.cost;
      yes.textContent = cash < t.cost ? `You have ${fmtMoney(cash, c)}` : 'Get married';
    };
    const bind = () => el.querySelectorAll('select[data-key]').forEach((s) => { s.onchange = () => { plan[s.dataset.key] = s.value; refresh(); }; });
    el.querySelectorAll('[data-preset]').forEach((b) => {
      b.onclick = () => {
        const base = b.dataset.preset === 'dream'
          ? { ...PRESETS.cityhall, venue: dream.venue, guests: dream.big ? 'big' : 'intimate', flowers: 'peonies', cake: 'tiered', music: 'band', honeymoon: 'trip' }
          : PRESETS[b.dataset.preset];
        Object.assign(plan, base);
        el.querySelector('[data-fields]').innerHTML = fields();
        bind(); refresh();
      };
    });
    bind(); refresh();
    el.querySelector('[data-yes]').onclick = async () => {
      let prenup = el.querySelector('[data-prenup]').checked;
      m.close();
      if (prenup) {
        const answer = love.askForPrenup(npc.id);
        api?.changed?.();
        prenup = answer.ok;
        if (!answer.ok && !await confirmModal({ title: 'Marry without a prenup?', body: answer.text, yes: 'Marry anyway', no: 'Put it on hold' })) { resolve({}); return; }
      }
      const res = love.marry(npc.id, { ...plan }, prenup);
      api?.changed?.();
      if (!res.ok) { await messageModal({ body: res.text, tone: 'neutral' }); resolve({}); return; }
      await justMarried(p, npc, plan);
      resolve({ married: true, honeymoon: plan.honeymoon === 'trip' });
    };
  });
}

/** The "Just married!" card: the two of you, where, and who came. */
function justMarried(p, npc, plan) {
  return new Promise((resolve) => {
    const venue = love.WEDDING_PLAN.venue.find((v) => v.id === plan.venue);
    const guests = love.WEDDING_PLAN.guests.find((g) => g.id === plan.guests);
    const hex = love.WEDDING_PLAN.theme.find((t) => t.id === plan.theme)?.hex ?? '#F6B8C8';
    const face = (who, gender, appearance, seed, extra = {}) => avatarSvg({ appearance, age: who.age, gender, seed, mood: 98, label: who.firstName, ...extra });
    const m = openModal(`<div class="wq-married" style="--wp-theme:${hex}">
      <p class="wp-just">Just married!</p>
      <div class="wp-pair"><div class="wp-frame">${face(p, p.gender, p.appearance, p.id, { face: faceGenderOf(p) })}</div><span class="wp-heart" aria-hidden="true">♥</span><div class="wp-frame">${face(npc, npc.gender, npc.appearance, npc.id)}</div></div>
      <p class="wp-names">${esc(p.firstName)} &amp; ${esc(npc.firstName)}</p>
      <p class="body">${esc(`${venue.icon} ${guests.count > 2 ? `${venue.name}, with ${guests.count} of the people you love most.` : `${venue.name}, just the two of you.`}`)}</p>
      <button class="btn primary" data-ok>Aww</button></div>`, { tone: 'good' });
    m.el.querySelector('[data-ok]').onclick = () => { m.close(); resolve(); };
  });
}

/** Planning the wedding: as scenes, or on one page if they are turned off in Settings. */
export function openWedding(api, npc) {
  return weddingScenesOn() ? openWeddingPlanner(api, npc) : openQuickWedding(api, npc);
}

/**
 * After the wedding, if they chose a honeymoon: the trip planner (js/ui/globalLife.js), open on a honeymoon with the
 * new spouse already coming, to choose where and how, like any trip.
 */
export async function planHoneymoon(api, npc) {
  const travel = await import('../engine/travel.js');
  const { openExplore } = await import('./globalLife.js');
  const trip = travel.startHoneymoon(npc.id);
  api?.changed?.();
  openExplore(api, { view: 'plan', params: { id: trip.id } });
}

/**
 * Home from the honeymoon: a postcard of where they went, "Greetings from…" across a cartoon of the place, stamped in
 * the wedding's color. The player's parents keep it. Resolves when it is put down.
 */
export async function honeymoonPostcard(api, trip) {
  const geo = await import('../engine/geo.js');
  const spouse = (trip.travelers ?? []).map((x) => store.state.npcs[x.id]).find((n) => n?.role === 'spouse');
  const dest = trip.destination ?? trip.origin;
  const where = trip.type === 'cruise' || trip.mode === 'cruise_ship' ? 'the Sea' : dest.city ?? geo.placeName(dest.countryId, null, store.state.year);
  const at = geo.coords(dest.countryId, dest.city);
  const art = postcardArt({ countryId: dest.countryId, cruise: trip.mode === 'cruise_ship', lat: at?.lat ?? 40, coastal: geo.coastal(dest.countryId), alpine: ['ch', 'at', 'np', 'bt', 'li', 'ad'].includes(dest.countryId) });
  const hex = love.WEDDING_PLAN.theme.find((t) => t.id === spouse?.flags?.wedding?.theme)?.hex ?? '#F6B8C8';
  love.sendPostcard(spouse?.id, where);
  api?.changed?.();
  await new Promise((done) => {
    const m = openModal(`<div class="wp-postcard-screen wq-postcard">
      <p class="wp-pc-eyebrow">A postcard from the honeymoon</p>
      <div class="wp-postcard"><div class="wp-pc-front">${postcardFront(art, where, hex)}</div></div>
      <button type="button" class="btn primary" data-done>Keep it</button></div>`, { tone: 'good' });
    m.el.querySelector('[data-done]').onclick = () => { m.close(); done(); };
  });
}

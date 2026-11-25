// Planning the wedding, and the wedding itself, as a scene (like the salon's: js/ui/salonVisit.js, whose layout
// classes it shares). A wedding planner walks the couple through the day piece by piece, the venue drawn behind them
// and changing as each choice is made, with the running total under the planner's bubble. The partner has a dream
// (romance.dreamOf) the planner lets slip; meeting it means more to them. Then the prenup, the bill, and the day:
// the walk down the aisle, the vows (romance.VOWS), the kiss, confetti. The engine is js/engine/romance.js.
import { avatarSvg, faceGenderOf } from '../avatar/render.js';
import { normalize, hash } from '../avatar/catalog.js';
import * as love from '../engine/romance.js';
import { player, country } from '../state.js';
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
 * Each venue as a room or a view, drawn like the salon's and the barbershop's (bold outlines, flat colors): a wall or a
 * sky with a pattern, a floor, and a few things at either side, leaving the middle to the couple and the arch.
 * `wall` is a <pattern> body (28 x 28 unless `size` says otherwise), `floor` the floor's color, `left`/`right` the props.
 */
const INK = 'stroke="#23140f" stroke-width="3" stroke-linejoin="round"';
const VENUES = {
  courthouse: { wall: '<rect width="28" height="28" fill="#EDE6DA"/><rect width="28" height="2" fill="#E0D6C6"/>', floor: '#B9A98F',
    left: `<g ${INK}><rect x="18" y="40" width="34" height="170" fill="#F7F3EC"/><rect x="12" y="30" width="46" height="12" rx="2" fill="#E6DED2"/><rect x="12" y="206" width="46" height="12" rx="2" fill="#E6DED2"/></g><path d="M28 50v150M42 50v150" stroke="#D9CFBF" stroke-width="3"/>`,
    right: `<g ${INK}><path d="M336 30v120" fill="none"/><path d="M338 34h42v28h-42z" fill="#5C7FB8"/><rect x="318" y="150" width="40" height="56" rx="4" fill="#8A5A3B"/><path d="M322 162h32M322 176h32M322 190h32" stroke-width="2"/></g>` },
  backyard: { wall: '<rect width="28" height="28" fill="#BFE3F5"/>', floor: '#8CC77D',
    left: `<g ${INK}><path d="M0 222V168h80v54" fill="#F4EFE6"/><path d="M16 168v54M32 168v54M48 168v54M64 168v54" fill="none" stroke-width="2"/><circle cx="34" cy="96" r="30" fill="#7DB86E"/><path d="M34 126v42" stroke-width="6" stroke="#8A5A3B"/></g>`,
    right: `<g ${INK}><path d="M320 222V168h80v54" fill="#F4EFE6"/><path d="M336 168v54M352 168v54M368 168v54M384 168v54" fill="none" stroke-width="2"/></g><path d="M300 40 Q340 66 400 44" fill="none" stroke="#23140f" stroke-width="2"/>${[316, 340, 364, 388].map((x, i) => `<circle cx="${x}" cy="${50 + (i % 2) * 6}" r="6" fill="#FFE59A" stroke="#23140f" stroke-width="2"/>`).join('')}<path d="M0 40 Q40 64 100 44" fill="none" stroke="#23140f" stroke-width="2"/>${[14, 40, 66, 90].map((x, i) => `<circle cx="${x}" cy="${50 + (i % 2) * 6}" r="6" fill="#FFE59A" stroke="#23140f" stroke-width="2"/>`).join('')}` },
  chapel: { wall: '<rect width="28" height="28" fill="#F6E9DA"/><rect width="14" height="28" fill="#F1E1CE"/>', floor: '#B98E6A',
    left: `<g ${INK}><path d="M18 170V80a26 26 0 0 1 52 0v90z" fill="#7FB5E0"/><path d="M44 54v116M18 110h52" stroke-width="2.5" fill="none"/><path d="M30 88l-6 14h12zM58 132l-6 14h12z" fill="#F28CA8" stroke-width="2"/></g>`,
    right: `<g ${INK}><path d="M330 170V80a26 26 0 0 1 52 0v90z" fill="#F7D774"/><path d="M356 54v116M330 110h52" stroke-width="2.5" fill="none"/><path d="M342 132l-6 14h12zM370 88l-6 14h12z" fill="#7FB5E0" stroke-width="2"/></g>` },
  beach: { wall: '<rect width="28" height="28" fill="#FFD3A8"/>', floor: '#F3D9A4',
    left: `<g ${INK}><path d="M46 222c4-50 2-90-8-126" fill="none" stroke-width="7" stroke="#8A5A3B"/><path d="M38 98c-30-8-40 6-44 14 18-8 30-8 44-14zM38 98c26-14 44-8 52 4-20-4-34-4-52-4zM38 98c-10-22 0-36 10-42-2 16-6 28-10 42z" fill="#6DBB7B"/></g>`,
    right: `<circle cx="350" cy="140" r="34" fill="#FFB65C" stroke="#23140f" stroke-width="3"/><rect x="290" y="160" width="110" height="62" fill="#5FB4D9"/><path d="M290 160h110" stroke="#23140f" stroke-width="3"/><path d="M300 178h30M344 190h40M306 204h24" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>` },
  garden: { wall: '<rect width="28" height="28" fill="#CDEBF7"/><circle cx="14" cy="14" r="2" fill="#E6F6FC"/>', floor: '#9ACB86',
    left: `<g ${INK}><rect x="4" y="130" width="84" height="92" rx="30" fill="#7DB86E"/></g>${[[22, 150], [50, 142], [70, 168], [30, 186], [60, 200]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="6" fill="${['#F28CA8', '#FFFFFF', '#FFD36E'][i % 3]}" stroke="#23140f" stroke-width="2"/>`).join('')}`,
    right: `<g ${INK}><rect x="312" y="130" width="84" height="92" rx="30" fill="#7DB86E"/></g>${[[330, 150], [358, 142], [378, 168], [338, 186], [368, 200]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="6" fill="${['#FFD36E', '#F28CA8', '#FFFFFF'][i % 3]}" stroke="#23140f" stroke-width="2"/>`).join('')}` },
  vineyard: { wall: '<rect width="28" height="28" fill="#FFE2B0"/>', floor: '#B8A26A',
    left: `<path d="M0 170 Q50 140 100 160 V222 H0z" fill="#A7B86E" stroke="#23140f" stroke-width="3"/><path d="M6 182h80M10 198h84" stroke="#5E7D3A" stroke-width="5" stroke-dasharray="9 7"/><circle cx="40" cy="70" r="22" fill="#FFD36E" stroke="#23140f" stroke-width="3"/>`,
    right: `<path d="M300 160 Q350 140 400 166 V222 H300z" fill="#A7B86E" stroke="#23140f" stroke-width="3"/><path d="M310 182h84M306 198h88" stroke="#5E7D3A" stroke-width="5" stroke-dasharray="9 7"/><g ${INK}><path d="M346 110v40" fill="none" stroke-width="4" stroke="#8A5A3B"/>${[[340, 112], [352, 112], [346, 122], [340, 132], [352, 132], [346, 142]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#8E5BB5" stroke-width="2"/>`).join('')}</g>` },
  ballroom: { wall: '<rect width="28" height="28" fill="#5A3A6E"/><path d="M14 4l6 10-6 10-6-10z" fill="#6B4882"/>', floor: '#C9A26B',
    left: `<g ${INK}><rect x="20" y="30" width="38" height="180" rx="4" fill="#E9D3EE"/><rect x="14" y="22" width="50" height="12" rx="3" fill="#F7D774"/><rect x="14" y="206" width="50" height="12" rx="3" fill="#F7D774"/></g>`,
    right: `<g ${INK}><rect x="342" y="30" width="38" height="180" rx="4" fill="#E9D3EE"/><rect x="336" y="22" width="50" height="12" rx="3" fill="#F7D774"/><rect x="336" y="206" width="50" height="12" rx="3" fill="#F7D774"/><path d="M300 0v20" fill="none"/><path d="M282 20h36l-8 16h-20z" fill="#F7D774"/></g>${[290, 300, 310].map((x) => `<circle cx="${x}" cy="40" r="3.5" fill="#FFF6D6" stroke="#23140f" stroke-width="1.5"/>`).join('')}<g ${INK}><path d="M100 0v20" fill="none"/><path d="M82 20h36l-8 16h-20z" fill="#F7D774"/></g>${[90, 100, 110].map((x) => `<circle cx="${x}" cy="40" r="3.5" fill="#FFF6D6" stroke="#23140f" stroke-width="1.5"/>`).join('')}` },
  castle: { wall: '<rect width="28" height="28" fill="#C9C3D6"/><path d="M0 13h28M14 0v13M0 27h28M7 13v14M21 13v14" stroke="#B4ADC4" stroke-width="2"/>', floor: '#8E7A6A',
    left: `<g ${INK}><path d="M22 170V84a22 22 0 0 1 44 0v86z" fill="#3E4E7A"/><path d="M44 62v108M22 110h44" stroke-width="2.5" fill="none"/><path d="M74 30v80l12-10 12 10V30z" fill="#C25B7A"/></g>`,
    right: `<g ${INK}><path d="M334 170V84a22 22 0 0 1 44 0v86z" fill="#3E4E7A"/><path d="M356 62v108M334 110h44" stroke-width="2.5" fill="none"/><path d="M302 30v80l12-10 12 10V30z" fill="#C25B7A"/></g>` },
};

/** The backdrop for a venue: its wall or sky, its floor and a runner down the aisle, its things at either side. */
function backdrop(venue) {
  const v = VENUES[venue] ?? VENUES.garden;
  return `<svg class="sv-room" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><pattern id="wp-wall-${venue}" width="28" height="28" patternUnits="userSpaceOnUse">${v.wall}</pattern></defs>
    <rect width="400" height="300" fill="url(#wp-wall-${venue})"/>
    <rect y="222" width="400" height="78" fill="${v.floor}"/><path d="M0 222h400" stroke="#23140f" stroke-width="3"/>
    <path d="M0 262h400M0 284h400" stroke="#23140f" stroke-width="2" opacity=".12"/>
    <path d="M168 300 L186 222 L214 222 L232 300z" fill="#FFFFFF" opacity=".8" stroke="#23140f" stroke-width="2"/>
    ${v.left}${v.right}</svg>`;
}

/**
 * The garland over the couple: a curve of flowers in the theme's color (and white), fuller for grander flowers. Wild
 * flowers are little and few, roses more, peonies and orchids big and many.
 */
function garland(hex, flowers) {
  const n = flowers === 'peonies' ? 15 : flowers === 'roses' ? 11 : 8;
  const r = flowers === 'peonies' ? 11 : flowers === 'roses' ? 9 : 7;
  const blooms = Array.from({ length: n }, (_, i) => {
    const t = Math.PI * (0.08 + 0.84 * (i / (n - 1)));
    const x = 150 - 136 * Math.cos(t); const y = 150 - 128 * Math.sin(t);
    const fill = i % 3 === 1 ? '#FFFFFF' : hex;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="${r}" fill="${fill}" stroke="#23140f" stroke-width="2.5"/><circle r="${(r / 3).toFixed(1)}" fill="#FFD36E" stroke="#23140f" stroke-width="1.5"/></g>`;
  }).join('');
  return `<svg class="wp-garland" viewBox="0 0 300 170" aria-hidden="true"><path d="M24 128 A136 128 0 0 1 276 128" fill="none" stroke="#6DBB7B" stroke-width="6" stroke-linecap="round"/>${blooms}</svg>`;
}

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
    const close = () => { root.remove(); resolve(married ? { married: true } : {}); };

    const youFace = (mood = 90, o = {}) => avatarSvg({ appearance: p.appearance, age: p.age, gender: p.gender, face: faceGenderOf(p), seed: p.id, mood, label: p.firstName, ...o });
    const themFace = (mood = 90, o = {}) => avatarSvg({ appearance: npc.appearance, age: npc.age, gender: npc.gender, seed: npc.id, mood, label: npc.firstName, ...o });
    const chosen = (k) => plan[k] ?? love.WEDDING_PLAN[k][0].id;
    const themeHex = () => love.WEDDING_PLAN.theme.find((t) => t.id === chosen('theme')).hex;
    const filled = () => Object.fromEntries(love.PLAN_STEPS.map((k) => [k, chosen(k)]));
    const totals = () => love.planTotals(filled(), npc, c);

    /**
     * The stage: the venue behind, and in front the couple up close, in two round frames side by side (as close as
     * the salon's mirror), under a garland of the flowers and colors chosen. At the kiss the frames meet, with a heart.
     */
    const closeUp = { viewBox: '86 120 340 340' };
    const stage = ({ kiss = false } = {}) => `
      <div class="sv-stage wp-stage" style="--wp-theme:${themeHex()}">
        ${backdrop(chosen('venue'))}
        <div class="sv-sign wp-sign">${esc(studio)}</div>
        <div class="wp-altar${kiss ? ' wp-kiss' : ''}">${garland(themeHex(), chosen('flowers'))}
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
        <p class="wp-after">${esc(honey.id === 'home' ? 'And then home, together.' : `Next stop: ${honey.name.toLowerCase()}.`)}</p>
        <button type="button" class="btn primary" data-done>Back to your life</button></div>`;
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
  cityhall: { venue: 'courthouse', guests: 'intimate', theme: 'ivory', flowers: 'roses', attire: 'rack', cake: 'tiered', music: 'playlist', food: 'buffet', honeymoon: 'roadtrip' },
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
          ? { ...PRESETS.cityhall, venue: dream.venue, guests: dream.big ? 'big' : 'intimate', flowers: 'peonies', cake: 'tiered', music: 'band', honeymoon: 'resort' }
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
      resolve({ married: true });
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

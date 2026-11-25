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

/** Each venue's backdrop (400 x 300): its sky, its ground, and a thing or two that says where you are. */
const SCENERY = {
  courthouse: { sky: ['#DCE8F2', '#F3F6F9'], ground: '#CFC7BD', props: `<g stroke="#23140f" stroke-width="3" stroke-linejoin="round"><path d="M60 70l140-40 140 40z" fill="#F1ECE4"/><rect x="70" y="70" width="260" height="14" fill="#E6DED2"/>${[90, 140, 190, 240, 290].map((x) => `<rect x="${x}" y="84" width="20" height="120" fill="#F7F3EC"/>`).join('')}<rect x="60" y="204" width="280" height="14" fill="#E6DED2"/></g>` },
  backyard: { sky: ['#9FD4F2', '#E8F6FF'], ground: '#8CC77D', props: `<path d="M0 60 Q100 90 200 62 T400 60" fill="none" stroke="#23140f" stroke-width="2"/>${[30, 80, 130, 180, 230, 280, 330, 380].map((x, i) => `<circle cx="${x}" cy="${70 + (i % 2) * 8}" r="6" fill="#FFE59A" stroke="#23140f" stroke-width="2"/>`).join('')}<g stroke="#23140f" stroke-width="3"><path d="M0 190h400" /><path d="${Array.from({ length: 21 }, (_, i) => `M${i * 20} 150v40`).join('')}" stroke-width="4" stroke="#F4EFE6"/></g>` },
  chapel: { sky: ['#F7D9C4', '#FFF2E6'], ground: '#C9B79C', props: `<g stroke="#23140f" stroke-width="3" stroke-linejoin="round"><path d="M150 210V110l50-40 50 40v100z" fill="#F7F1E8"/><path d="M200 70V30M188 42h24" fill="none"/><path d="M183 210v-50a17 17 0 0 1 34 0v50z" fill="#8A5A3B"/><circle cx="200" cy="112" r="16" fill="#F3B9C9"/><path d="M200 96v32M184 112h32" stroke-width="2"/></g>` },
  beach: { sky: ['#FFB38A', '#FFE3B3'], ground: '#F3D9A4', props: `<circle cx="300" cy="150" r="40" fill="#FFD36E"/><rect y="150" width="400" height="40" fill="#5FB4D9"/><path d="M0 160h400M0 175h400" stroke="#FFFFFF" stroke-width="2" opacity=".6"/><g stroke="#23140f" stroke-width="3" stroke-linejoin="round"><path d="M60 200c4-40 2-80-6-110" fill="none" stroke-width="6" stroke="#8A5A3B"/><path d="M54 92c-30-6-44 6-48 16 18-10 34-10 48-16zM54 92c26-14 44-8 52 2-20-4-34-2-52-2zM54 92c-10-20-2-34 8-40-2 16-4 26-8 40z" fill="#6DBB7B"/></g>` },
  garden: { sky: ['#BFE3F5', '#F2FAFF'], ground: '#9ACB86', props: `<g stroke="#23140f" stroke-width="3">${[40, 90, 310, 360].map((x) => `<circle cx="${x}" cy="150" r="30" fill="#7DB86E"/>`).join('')}</g>${[30, 52, 85, 100, 300, 322, 352, 372].map((x, i) => `<circle cx="${x}" cy="${138 + (i % 3) * 10}" r="5" fill="${['#F28CA8', '#FFFFFF', '#FFD36E'][i % 3]}" stroke="#23140f" stroke-width="1.5"/>`).join('')}` },
  vineyard: { sky: ['#F7C27E', '#FFF0D2'], ground: '#B8A26A', props: `<path d="M0 140 Q100 100 200 130 T400 120 V200 H0z" fill="#A7B86E" stroke="#23140f" stroke-width="3"/>${[0, 1, 2, 3].map((r) => `<path d="M0 ${150 + r * 14} Q200 ${130 + r * 14} 400 ${145 + r * 14}" fill="none" stroke="#5E7D3A" stroke-width="5" stroke-dasharray="10 8"/>`).join('')}<circle cx="80" cy="70" r="26" fill="#FFE08A" opacity=".8"/>` },
  ballroom: { sky: ['#4B2E5C', '#7A4E86'], ground: '#C9A26B', props: `<g stroke="#23140f" stroke-width="3"><path d="M200 0v34" /><path d="M160 34h80l-14 26h-52z" fill="#F7D774"/>${[168, 184, 200, 216, 232].map((x) => `<circle cx="${x}" cy="66" r="4" fill="#FFF6D6"/>`).join('')}</g>${[50, 350].map((x) => `<rect x="${x - 18}" y="40" width="36" height="160" rx="6" fill="#E9D3EE" stroke="#23140f" stroke-width="3"/>`).join('')}<path d="M0 200 L400 200 L400 300 L0 300z" fill="#C9A26B"/><path d="${Array.from({ length: 10 }, (_, i) => `M${i * 40} 200l40 100`).join('')}" stroke="#B28A55" stroke-width="2"/>` },
  castle: { sky: ['#A7C7EC', '#E7F0FB'], ground: '#93BE80', props: `<g stroke="#23140f" stroke-width="3" stroke-linejoin="round" fill="#D9D2E6"><rect x="120" y="80" width="160" height="110"/><rect x="100" y="50" width="40" height="140"/><rect x="260" y="50" width="40" height="140"/><path d="M96 50l24-34 24 34z" fill="#C25B7A"/><path d="M256 50l24-34 24 34z" fill="#C25B7A"/><path d="M180 190v-40a20 20 0 0 1 40 0v40z" fill="#8A5A3B"/><path d="M120 80h160" /></g><path d="M120 66h12v14h12v-14h12v14h12v-14h12v14h12v-14h12v14h12v-14h12v14h12v-14h12v14h12" fill="none" stroke="#23140f" stroke-width="3"/>` },
};

/** The backdrop for a venue: sky, ground, scenery, and rows of chairs for the guests. */
function backdrop(venue, guests) {
  const v = SCENERY[venue] ?? SCENERY.garden;
  const rows = guests >= 200 ? 3 : guests >= 80 ? 2 : guests >= 20 ? 1 : 0;
  const chairs = Array.from({ length: rows }, (_, r) => [40, 80, 120, 280, 320, 360].map((x) => `<rect x="${x - 10}" y="${232 + r * 22}" width="20" height="16" rx="3" fill="#FFFFFF" stroke="#23140f" stroke-width="2"/>`).join('')).join('');
  return `<svg class="sv-room" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="wp-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${v.sky[0]}"/><stop offset="1" stop-color="${v.sky[1]}"/></linearGradient></defs>
    <rect width="400" height="300" fill="url(#wp-sky)"/>${v.props}
    <rect y="200" width="400" height="100" fill="${v.ground}"/><path d="M0 200h400" stroke="#23140f" stroke-width="3"/>
    <path d="M170 300 L190 200 L210 200 L230 300z" fill="#FFFFFF" opacity=".75"/>${chairs}</svg>`;
}

/** The arch the couple stand under, dressed in the theme's color with the flowers chosen. */
function arch(hex, flowers) {
  const n = flowers === 'peonies' ? 14 : flowers === 'roses' ? 10 : 7;
  const blooms = Array.from({ length: n }, (_, i) => {
    const t = Math.PI * (i / (n - 1));
    const x = 100 - 84 * Math.cos(t); const y = 104 - 90 * Math.sin(t);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${flowers === 'peonies' ? 9 : 7}" fill="${i % 3 === 1 ? '#FFFFFF' : hex}" stroke="#23140f" stroke-width="2"/>`;
  }).join('');
  return `<svg class="wp-arch" viewBox="0 0 200 200" aria-hidden="true"><path d="M16 200V104a84 90 0 0 1 168 0v96" fill="none" stroke="#23140f" stroke-width="9"/>
    <path d="M16 200V104a84 90 0 0 1 168 0v96" fill="none" stroke="#FFFFFF" stroke-width="4"/>${blooms}</svg>`;
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

    const youFace = (mood = 90) => avatarSvg({ appearance: p.appearance, age: p.age, gender: p.gender, face: faceGenderOf(p), seed: p.id, mood, label: p.firstName });
    const themFace = (mood = 90) => avatarSvg({ appearance: npc.appearance, age: npc.age, gender: npc.gender, seed: npc.id, mood, label: npc.firstName });
    const chosen = (k) => plan[k] ?? love.WEDDING_PLAN[k][0].id;
    const themeHex = () => love.WEDDING_PLAN.theme.find((t) => t.id === chosen('theme')).hex;
    const filled = () => Object.fromEntries(love.PLAN_STEPS.map((k) => [k, chosen(k)]));
    const totals = () => love.planTotals(filled(), npc, c);

    /** The stage: the venue, the arch, the couple under it, and what has been chosen so far. */
    const stage = ({ kiss = false } = {}) => `
      <div class="sv-stage wp-stage" style="--wp-theme:${themeHex()}">
        ${backdrop(chosen('venue'), love.WEDDING_PLAN.guests.find((g) => g.id === chosen('guests')).count)}
        <div class="sv-sign wp-sign">${esc(studio)}</div>
        <div class="wp-altar${kiss ? ' wp-kiss' : ''}">${arch(themeHex(), chosen('flowers'))}
          <div class="wp-couple"><div class="wp-person">${youFace()}</div><div class="wp-person">${themFace()}</div></div></div>
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
      guests: dream.big ? `Now, the guest list. ${npc.firstName} wants everyone there, I can tell.` : `Now, the guest list. ${npc.firstName} strikes me as someone who'd like it small.`,
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
      const price = (o) => (key === 'guests' ? `${o.count} people` : key === 'food' ? fmtMoney(localMoney(o.perGuest, c) * guests, c) : o.cost ? fmtMoney(localMoney(o.cost, c), c) : 'Free');
      const dreamTag = (o) => (key === 'venue' && o.id === dream.venue) || (key === 'guests' && (dream.big ? o.count >= 80 : o.count <= 20)) ? '<em class="wp-dream">♥ their dream</em>' : '';
      const tiles = key === 'theme'
        ? `<div class="wp-swatches">${opts.map((o) => `<button type="button" class="wp-swatch${plan[key] === o.id ? ' on' : ''}" data-pick="${o.id}" style="--sw:${o.hex}" aria-pressed="${plan[key] === o.id}"><span></span>${esc(o.name)}</button>`).join('')}</div>`
        : `<div class="wp-tiles">${opts.map((o) => `<button type="button" class="wp-tile${plan[key] === o.id ? ' on' : ''}" data-pick="${o.id}" aria-pressed="${plan[key] === o.id}">
            <span class="wp-ico" aria-hidden="true">${o.icon}</span><strong>${esc(o.name)}</strong><small>${esc(o.sub ?? '')}</small><span class="wp-price">${esc(price(o))}</span>${dreamTag(o)}</button>`).join('')}</div>`;
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
          if ((key === 'venue' && o.id === dream.venue) || (key === 'guests' && (dream.big ? o.count >= 80 : o.count <= 20))) {
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

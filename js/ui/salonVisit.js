// A visit to the beauty salon: a sign over the door, then the salon itself, with the player in the mirror and a stylist
// who asks what they are in for. Each answer opens that part of the look (a cut, a texture treatment, color, make-up,
// glasses and jewelry, clothes); the mirror shows each change as it is tried. Then the bill, and a last look.
// The look itself is the appearance editor's (js/avatar/editor.js, embedded), the prices and paying js/engine/salon.js.
import { avatarSvg, faceGenderOf } from '../avatar/render.js';
import { mountAppearanceEditor } from '../avatar/editor.js';
import { normalize, hash, CATALOG, hairTextureOf } from '../avatar/catalog.js';
import { cloneAppearance } from '../avatar/inherit.js';
import { MAKEUP_AGE } from '../CharacterAvatar.js';
import * as salon from '../engine/salon.js';
import { player, country } from '../state.js';
import { fmtMoney } from '../util.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const pickBy = (list, key) => list[hash(key) % list.length];
const SALONS = ['Shear Joy', 'The Mane Room', 'Curl Up & Dye', 'Blow & Glow', 'Snip Studio', 'Hair Apparent'];
const STYLISTS = ['Jade', 'Marisol', 'Tobi', 'Priya', 'Sasha', 'Andre', 'Kiko', 'Lena', 'Dami', 'Rosa'];

/** The salon's sign: scissors crossed over a hair dryer, in a round badge. */
const LOGO = `<svg class="sv-logo-art" viewBox="0 0 120 120" aria-hidden="true">
  <circle cx="60" cy="60" r="56" fill="#FFE3EC" stroke="#23140f" stroke-width="4"/>
  <circle cx="60" cy="60" r="46" fill="none" stroke="#F59B7A" stroke-width="3" stroke-dasharray="4 6"/>
  <g class="sv-dryer"><path d="M30 52c0-11 9-19 21-19h14c6 0 10 5 10 11s-4 11-10 11H51c-12 0-21-1-21-3z" fill="#7956A0" stroke="#23140f" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M44 55l-5 26c-1 4 2 7 6 7h3c3 0 5-2 6-5l3-28" fill="#7956A0" stroke="#23140f" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M75 39h9M75 45h11M75 51h9" stroke="#23140f" stroke-width="3" stroke-linecap="round"/></g>
  <g class="sv-scissors"><g class="sv-blade-a"><path d="M58 64l30 22" stroke="#23140f" stroke-width="5" stroke-linecap="round"/><circle cx="50" cy="88" r="8" fill="#FFB699" stroke="#23140f" stroke-width="3.5"/><path d="M56 82l8-10" stroke="#23140f" stroke-width="4"/></g>
    <g class="sv-blade-b"><path d="M58 86l30-22" stroke="#23140f" stroke-width="5" stroke-linecap="round"/><circle cx="50" cy="62" r="8" fill="#FFB699" stroke="#23140f" stroke-width="3.5"/></g></g>
</svg>`;

/** The salon, drawn in the game's style: a striped wall, shelves of products, a plant, and the mirror's frame of bulbs. */
const ROOM = `<svg class="sv-room" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs><pattern id="sv-stripes" width="28" height="28" patternUnits="userSpaceOnUse"><rect width="28" height="28" fill="#F9D9E4"/><rect width="14" height="28" fill="#F6CBDA"/></pattern></defs>
  <rect width="400" height="300" fill="url(#sv-stripes)"/>
  <rect y="222" width="400" height="78" fill="#E9B5A0"/><path d="M0 222h400" stroke="#23140f" stroke-width="3"/>
  <path d="M0 262h400M0 284h400" stroke="#D69C86" stroke-width="2"/>
  <g stroke="#23140f" stroke-width="3" stroke-linejoin="round">
    <rect x="16" y="64" width="78" height="8" rx="3" fill="#B9845E"/><rect x="16" y="124" width="78" height="8" rx="3" fill="#B9845E"/>
    <rect x="24" y="36" width="14" height="28" rx="4" fill="#7FC6C0"/><rect x="44" y="44" width="12" height="20" rx="3" fill="#F59B7A"/><rect x="62" y="30" width="16" height="34" rx="5" fill="#B79BE0"/>
    <rect x="26" y="98" width="18" height="26" rx="6" fill="#FFE07A"/><rect x="50" y="104" width="12" height="20" rx="3" fill="#7FC6C0"/><rect x="68" y="94" width="16" height="30" rx="4" fill="#F28CA8"/>
    <rect x="316" y="160" width="40" height="44" rx="6" fill="#C98D5B"/>
    <path d="M336 160c-22-10-28-36-14-48 4 16 10 24 14 30 2-16 8-30 22-36 2 18-6 34-22 54z" fill="#6DBB7B"/>
    <rect x="306" y="204" width="60" height="18" rx="4" fill="#B9845E"/>
  </g>
  <g fill="#FFF6D6" stroke="#23140f" stroke-width="2"><circle cx="346" cy="40" r="7"/><circle cx="370" cy="58" r="5"/><circle cx="330" cy="70" r="4"/></g>
</svg>`;

/** The visit, over the whole screen. `api` is the game's (changed() after paying). */
/**
 * Vanity bulbs set into the mirror's frame, as on a dressing-room mirror: round its arched top and down both sides,
 * none along the bottom. Positions are in percent of the frame: the arch is an ellipse about (50%, 48%).
 */
const BULBS = (() => {
  const at = [];
  for (let i = 0; i <= 8; i++) {
    const t = Math.PI * (1 - i / 8);
    at.push([50 + 46.5 * Math.cos(t), 48 - 45 * Math.sin(t)]);
  }
  for (const y of [63, 78]) at.push([3.5, y], [96.5, y]);
  return `<div class="sv-bulbs" aria-hidden="true">${at.map(([x, y]) => `<i style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%"></i>`).join('')}</div>`;
})();

export function openSalonVisit(api, { intro = true } = {}) {
  const p = player();
  const c = country();
  const name = pickBy(SALONS, `${p.city ?? ''}:${p.countryId}`);
  const stylist = pickBy(STYLISTS, `${p.id}:${p.city ?? ''}`);
  const stylistLook = normalize({}, `stylist:${stylist}:${p.city ?? ''}`);
  const stylistGender = hash(stylist) % 3 === 0 ? 'male' : 'female';
  let draft = cloneAppearance(normalize(p.appearance, p.id));
  const natural = draft.inherited.hairTexture;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SECTIONS = [
    { id: 'cut', label: 'Haircut', keys: ['hair'], line: 'Ooh, a fresh cut! What are you feeling?' },
    { id: 'texture', label: 'Hair treatment', keys: ['treatment', 'hair'], line: `Your natural hair is ${natural}. Want it to wear a different texture for a while?`, when: () => p.age >= salon.TREATMENT_MIN_AGE },
    { id: 'color', label: 'Hair color', keys: ['hairDye'], line: 'Let\'s play with color!' },
    { id: 'face', label: 'Makeup', keys: ['makeup', 'lipColor'], line: 'A little glam? Pick a look and I\'ll work my magic.', when: () => p.age >= MAKEUP_AGE },
    { id: 'extras', label: 'Glasses & jewelry', keys: ['glasses', 'jewelry'], line: 'Accessories make the look. Try some on!' },
    { id: 'clothes', label: 'Clothes', keys: ['outfit', 'outfitColor'], line: 'Our boutique corner has a few new pieces. See anything you like?', when: () => CATALOG.outfit.length > 0 },
  ].filter((s) => !s.when || s.when());

  const root = document.createElement('div');
  root.className = 'salon-screen';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', `${name}, the beauty salon`);
  document.body.appendChild(root);

  const mirror = () => avatarSvg({ appearance: draft, age: p.age, gender: p.gender, face: faceGenderOf(p), seed: p.id, mood: 82, label: 'You, in the mirror' });
  const stylistFace = avatarSvg({ appearance: stylistLook, age: 30, gender: stylistGender, seed: `stylist:${stylist}`, mood: 90, viewBox: '96 150 320 300', label: stylist });
  const bill = () => {
    const q = salon.salonQuote(draft);
    if (!q.changed) return '';
    return q.free ? 'Your family is paying.' : `So far: ${fmtMoney(q.total, c)}`;
  };
  let editor = null;

  function close() { root.remove(); }

  /** The scene: the room, the mirror with the player in it, and below, the stylist's bubble and the replies. */
  function scene({ line, replies = [], body = '', sparkle = false }) {
    root.innerHTML = `
      <div class="sv-scene">
        <div class="sv-stage">
          ${ROOM}
          <div class="sv-sign">${esc(name)}</div>
          <div class="sv-mirror">${BULBS}<div class="sv-glass" data-mirror>${mirror()}</div>${sparkle ? '<div class="sv-sparkles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>' : ''}</div>
          <button type="button" class="sv-leave" data-leave aria-label="Leave the salon">×</button>
        </div>
        <div class="sv-talk">
          <div class="sv-speaker"><div class="sv-stylist">${stylistFace}</div>
            <div class="sv-bubble" aria-live="polite"><strong>${esc(stylist)}</strong><p>${esc(line)}</p></div></div>
          <div class="sv-body">${body}</div>
          <div class="sv-replies">${replies.map((r, i) => `<button type="button" class="btn ${r.primary ? 'primary' : ''} sv-reply" data-reply="${i}">${esc(r.label)}</button>`).join('')}</div>
          <p class="sv-bill muted" data-bill>${esc(bill())}</p>
        </div>
      </div>`;
    root.querySelector('[data-leave]').onclick = close;
    root.querySelectorAll('[data-reply]').forEach((b) => { b.onclick = () => replies[Number(b.dataset.reply)].go(); });
  }

  /** "What are we doing today?", then "Anything else?" */
  function menu(line) {
    const changed = salon.salonQuote(draft).changed;
    scene({
      line: line ?? `Hi ${p.firstName}, welcome to ${name}! Have a seat. What are we doing today?`,
      replies: [...SECTIONS.map((s) => ({ label: s.label, go: () => section(s) })),
        changed ? { label: 'That\'s everything', primary: true, go: checkout } : { label: 'Just looking, thanks', go: goodbye }],
    });
  }

  /** One part of the look: its options under the bubble, the mirror changing with each one tried. */
  function section(s) {
    const before = cloneAppearance(draft);
    scene({
      line: s.line,
      body: '<div class="sv-editor" data-editor></div>',
      replies: [{ label: 'Love it', primary: true, go: () => { editor = null; menu(pickBy(['Gorgeous! Anything else?', 'That suits you. What else can I do?', 'Perfect. Anything else today?'], `${s.id}:${JSON.stringify(draft.style)}`)); } },
        { label: 'Never mind', go: () => { draft = before; editor = null; menu('No problem! Anything else?'); } }],
    });
    editor = mountAppearanceEditor(root.querySelector('[data-editor]'), {
      appearance: draft, age: p.age, gender: p.gender, face: faceGenderOf(p), seed: p.id, scope: 'style', keys: s.keys,
      treatments: { treatmentFor: salon.treatmentFor, years: salon.TREATMENT_YEARS, minAge: salon.TREATMENT_MIN_AGE },
      onChange: (a) => {
        draft = a;
        root.querySelector('[data-mirror]').innerHTML = mirror();
        root.querySelector('[data-bill]').textContent = bill();
      },
    });
  }

  /** The bill, and paying it. */
  function checkout() {
    const q = salon.salonQuote(draft);
    const lines = q.lines.map((l) => `<div class="sv-line"><span>${esc(l.label)}</span><span>${l.cost ? esc(fmtMoney(l.cost, c)) : 'Free'}</span></div>`).join('');
    scene({
      line: q.free ? 'All done! Your family is taking care of this one.' : 'All done! Here\'s your total.',
      body: `<div class="sv-receipt">${lines}<div class="sv-line sv-total"><span>Total</span><span>${q.free ? 'Covered' : esc(fmtMoney(q.total, c))}</span></div></div>`,
      replies: [{ label: q.free || !q.total ? 'Thank you!' : `Pay ${fmtMoney(q.total, c)}`, primary: true, go: pay },
        { label: 'Actually, put it all back', go: () => { draft = cloneAppearance(normalize(p.appearance, p.id)); menu('No worries, back to how you came in. Anything else?'); } }],
    });
  }

  function pay() {
    const r = salon.applySalon(draft);
    if (!r.ok) {
      scene({ line: /do not have it/.test(r.text) ? 'Oh! Your card was declined. Want to take a few things off?' : r.text,
        replies: [{ label: 'Take some things off', go: () => menu('Okay, what should we change?') }, { label: 'Leave', go: close }] });
      return;
    }
    api?.changed?.();
    draft = cloneAppearance(normalize(player().appearance, p.id));
    const tr = draft.style.treatment;
    scene({ sparkle: !reduced,
      line: `Look at you! ${tr ? `Your hair will be ${hairTextureOf(draft)} for the next ${tr.years} years. ` : ''}Come back anytime.`,
      replies: [{ label: 'Leave the salon', primary: true, go: close }] });
  }

  function goodbye() {
    scene({ line: 'No problem, come back anytime!', replies: [{ label: 'Leave the salon', primary: true, go: close }] });
  }

  if (intro) {
    root.innerHTML = `<div class="sv-intro${reduced ? ' sv-still' : ''}" data-intro><div class="sv-logo">${LOGO}<div class="sv-logo-name">${esc(name)}</div><div class="sv-logo-sub">Beauty salon</div></div></div>`;
    const go = () => { if (root.isConnected && root.querySelector('[data-intro]')) menu(); };
    root.querySelector('[data-intro]').onclick = go;
    setTimeout(go, reduced ? 350 : 1500);
  } else menu();
  return { close, get draft() { return draft; } };
}

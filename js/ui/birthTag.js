// The hospital tag for a birth (engine/birthTag.js): a little pastel card with punched holes, filled in by hand, with
// the baby swaddled in a blanket, inked footprints and a wristband. It turns over: on the back, the nurses' keepsake
// (the day, the birthstone and flower, a note, who the baby takes after, a stamp). Shown when the player's child is
// born, and from a child's page or the player's own Identity card afterwards.
import { esc } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { openModal } from './modals.js';
import { avatarSvg } from './avatar.js';
import { longDate } from '../engine/birthday.js';
import { seasonAt, SNOWY } from '../engine/calendar.js';
import { sizeWords, starSign, birthdayFromDate, keepsake } from '../engine/birthTag.js';
import { store } from '../state.js';
import { inkFeet } from './footprints.js';
import { nameBaby, surnameChoices, NAME_LIMITS } from '../engine/children.js';

/** Blanket colors: soft pink for a girl, soft blue for a boy, mint otherwise. */
const SHADE = { female: 'girl', male: 'boy' };
/** The part of the 512 portrait frame that holds a baby's face. */
const BABY_FACE = '122 170 268 300';

/** The baby, swaddled: wrapped all over in a blanket, a hood around the face, just the face peeking out. */
export function swaddleHtml(person, look) {
  const face = avatarSvg({ age: 0, gender: person.gender, appearance: look ?? person.appearance, seed: person.id, mood: 80, viewBox: BABY_FACE });
  return `<div class="swaddle" aria-hidden="true">
    <svg class="swaddle-back" viewBox="0 0 120 150">
      <path class="body" d="M60 6C30 6 14 30 14 60c0 44 18 82 46 86 28-4 46-42 46-86C106 30 90 6 60 6Z"/>
    </svg>
    <div class="swaddle-face">${face}</div>
    <svg class="swaddle-front" viewBox="0 0 120 150">
      <path class="rim" d="M60 15c-20 0-34 15-34 35s14 37 34 37 34-17 34-37-14-35-34-35Zm0 6c16 0 27 12 27 29S76 81 60 81 33 67 33 50s11-29 27-29Z"/>
      <path class="flap l" d="M18 84c14 4 30 2 42-4 10 16 12 40 0 64C36 138 20 112 18 84Z"/>
      <path class="flap r" d="M102 82c-18 10-42 12-60 6-4 16 2 38 18 56 24-4 40-30 42-62Z"/>
      <path class="fold" d="M46 102c12-4 26-5 40-2M50 117c10-3 22-3 32 0M56 131c6-1 12-1 18 1"/>
      <path class="tuck" d="M84 93c4 6 4 13 0 18"/>
    </svg>
  </div>`;
}

/** Two inked footprints, left foot then right, sized by the baby's length (ui/footprints.js). */
const footprintsHtml = (info, id) => inkFeet({ lengthIn: info.lengthIn, seed: id, width: 98 });

/** A hospital wristband: the baby's name, a number and a little barcode. */
function braceletHtml(person, ks) {
  const sex = person.gender === 'male' ? 'BOY' : person.gender === 'female' ? 'GIRL' : '';
  let x = 0;
  const bars = ks.bars.map((w, i) => { const r = i % 2 ? '' : `<rect x="${x}" y="0" width="${w}" height="14"/>`; x += w + 1; return r; }).join('');
  return `<div class="btag-band"><span class="btag-band-snap" aria-hidden="true"></span>
    <span class="btag-band-text">BABY ${sex ? `${sex} ` : ''}${esc(person.lastName.toUpperCase())}</span>
    <span class="btag-band-id">${esc(ks.bracelet)}</span>
    <svg class="btag-band-bars" viewBox="0 0 ${x} 14" aria-hidden="true">${bars}</svg></div>`;
}

/** The tag: front and back. `who` is the name written on it; `parents` the two people the baby was born to. */
export function birthTagHtml(person, { who, parents = [] } = {}) {
  const info = person.birthInfo;
  const size = sizeWords(info);
  const sign = starSign(birthdayFromDate(info.date));
  const shade = SHADE[person.gender] ?? 'mint';
  const where = `${info.city ? `${info.city}, ` : ''}${COUNTRIES[info.countryId]?.name ?? ''}`;
  const ks = keepsake(person, parents, (m) => seasonAt(m, info.countryId), SNOWY.has(info.countryId));
  const pick = (a, b, on) => `<span class="btag-pick"><span class="${on === a ? 'on' : ''}">${a}</span><span class="${on === b ? 'on' : ''}">${b}</span></span>`;
  const sex = person.gender === 'male' ? 'BOY' : person.gender === 'female' ? 'GIRL' : null;
  const [clock, ampm] = info.time.split(' ');
  const names = parents.filter(Boolean).map((x) => x.firstName);
  const parentLine = names.length ? `${names.join(' & ')} ${parents.find(Boolean)?.lastName ?? person.lastName}` : '';
  const holes = '<div class="btag-holes" aria-hidden="true"><i></i><i></i><i></i></div>';
  return `<div class="btag-flip">
  <div class="btag btag-${shade} btag-front">
    ${holes}
    <span class="btag-bow b1" aria-hidden="true">🎀</span><span class="btag-bow b2" aria-hidden="true">🎀</span>
    <div class="btag-card">
      <div class="btag-row btag-room"><span class="btag-label">Room</span><span class="btag-ink">${esc(info.room ?? '—')}</span></div>
      <div class="btag-main">
        <div class="btag-left">${swaddleHtml(person)}${footprintsHtml(info, person.id)}</div>
        <div class="btag-fields">
          <div class="btag-row"><span class="btag-label">Name</span><span class="btag-ink">${esc(who ?? `${person.firstName} ${person.lastName}`)}</span>${sex ? pick('BOY', 'GIRL', sex) : ''}</div>
          <div class="btag-row"><span class="btag-label">Date of Birth</span><span class="btag-ink">${esc(longDate(info.date))}</span></div>
          <div class="btag-row"><span class="btag-label">Time</span><span class="btag-ink">${esc(clock)}</span>${pick('AM', 'PM', ampm)}</div>
          <div class="btag-row"><span class="btag-label">Birth Weight</span>${size.imperial
            ? `<span class="btag-weight"><span class="btag-ink">${size.lbs}</span><span class="btag-label">lbs.</span><span class="btag-ink">${size.oz}</span><span class="btag-label">oz.</span></span>`
            : `<span class="btag-ink">${esc(size.weight)}</span>`}</div>
          <div class="btag-row"><span class="btag-label">Length</span><span class="btag-ink">${esc(size.length.replace(/ (in|cm)$/, ''))}</span><span class="btag-label">${size.imperial ? 'in.' : 'cm'}</span></div>
          <div class="btag-row"><span class="btag-label">Star Sign</span><span class="btag-ink">${sign.symbol} ${esc(sign.name)}</span></div>
          <div class="btag-row"><span class="btag-label">${info.atHome ? 'Delivered by' : 'Doctor'}</span><span class="btag-ink">${esc(info.doctor)}</span></div>
        </div>
      </div>
      ${braceletHtml(person, ks)}
    </div>
    <div class="btag-foot"><strong>${esc(info.place === 'At home' ? 'Born at home' : info.place)}</strong><span>${esc(where)}</span>${parentLine ? `<small>${esc(parentLine)}</small>` : ''}</div>
  </div>
  <div class="btag btag-${shade} btag-back" hidden>
    ${holes}
    <div class="btag-card btag-keep">
      <div class="btag-keep-title">A keepsake for ${esc(person.firstName)}</div>
      <p class="btag-keep-line btag-ink">${esc(ks.day)}</p>
      <div class="btag-keep-pair">
        <div><span class="btag-label">Birthstone</span><span class="btag-ink">${ks.stone[1]} ${esc(ks.stone[0])}</span></div>
        <div><span class="btag-label">Birth Flower</span><span class="btag-ink">${ks.flower[1]} ${esc(ks.flower[0])}</span></div>
      </div>
      <div class="btag-keep-note"><span class="btag-label">From the nurses</span><span class="btag-ink">“${esc(ks.note)}”</span></div>
      ${ks.looks ? `<div class="btag-keep-note"><span class="btag-label">Takes after</span><span class="btag-ink">${esc(ks.looks)}</span></div>` : ''}
      <div class="btag-stamp" style="--tilt:${ks.stampTilt}deg">${esc(ks.stamp)}</div>
      <div class="btag-keep-sign btag-ink">${esc(ks.signoff)} ♡</div>
    </div>
  </div>
  </div>`;
}

/** Opens a tag in its own window, with a button to turn it over. Resolves when it is closed. */
export function openBirthTag(person, { title, who, parents, button = 'Close' } = {}) {
  if (!person?.birthInfo) return Promise.resolve();
  return new Promise((resolve) => {
    const m = openModal(`
      ${title ? `<h2 class="pick-title btag-title">${esc(title)}</h2>` : ''}
      ${birthTagHtml(person, { who, parents })}
      <div class="btn-row" style="margin-top:14px"><button class="btn" data-turn>Turn Over</button><button class="btn primary" data-ok>${esc(button)}</button></div>`, { tone: 'good', dismissable: true, onDismiss: resolve });
    const flip = m.el.querySelector('.btag-flip');
    const turn = m.el.querySelector('[data-turn]');
    turn.addEventListener('click', () => {
      const back = flip.classList.toggle('turned');
      flip.querySelector('.btag-front').hidden = back;
      flip.querySelector('.btag-back').hidden = !back;
      turn.textContent = back ? 'Turn Back' : 'Turn Over';
    });
    m.el.querySelector('[data-ok]').addEventListener('click', () => { m.close(); resolve(); });
  });
}

/**
 * Naming a newborn: their first name (with ideas from where the family lives) and their last name (the player's, the
 * partner's, both joined, or one written in). Resolves when the name is given.
 */
export function nameBabyModal(baby, { twinOf } = {}) {
  return new Promise((resolve) => {
    const p = store.state.player;
    const lasts = surnameChoices(baby, p);
    const pool = COUNTRIES[p.countryId]?.names?.[baby.gender === 'male' ? 'male' : baby.gender === 'female' ? 'female' : Math.random() < 0.5 ? 'male' : 'female'] ?? [baby.firstName];
    // Ideas come from a shuffled deck of the country's names, each once (a common name is listed more than once in the
    // country's list, to be drawn more often for strangers; here it is one idea among many), and never a name someone in
    // the family already has. When the deck runs out, it is shuffled again.
    const family = new Set([p.firstName, ...Object.values(store.state.npcs).filter((n) => n?.lastName === p.lastName || p.npcIds?.includes(n?.id)).map((n) => n.firstName)]);
    const unique = [...new Set(pool.map((x) => x.replace(/_/g, ' ')))].filter((x) => !family.has(x));
    let deck = [];
    const ideas = () => {
      if (!deck.length) { deck = [...(unique.length ? unique : [baby.firstName])]; for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } }
      const n = deck.pop();
      return n === q('[data-first]').value && deck.length ? deck.pop() : n;
    };
    const kind = baby.gender === 'male' ? 'a Boy' : baby.gender === 'female' ? 'a Girl' : 'a Baby';
    const m = openModal(`
      <h2 class="pick-title btag-title">${twinOf ? 'And Another One! ' : ''}It's ${kind}!</h2>
      <div class="bname">
        <div class="btag btag-${SHADE[baby.gender] ?? 'mint'} bname-baby">${swaddleHtml(baby)}</div>
        <label class="field"><span>First name</span>
          <div class="bname-row"><input type="text" data-first maxlength="${NAME_LIMITS.first}" value="${esc(baby.firstName)}" autocomplete="off" spellcheck="false">
          <button class="btn small" data-idea type="button" title="Another idea">🎲</button></div></label>
        <div class="field"><span>Last name</span>
          <div class="bname-lasts">${lasts.map((x, i) => `<label class="bname-last"><input type="radio" name="bname-last" value="${esc(x.value)}" ${i === 0 ? 'checked' : ''}> ${esc(x.label)}</label>`).join('')}
          <label class="bname-last"><input type="radio" name="bname-last" value="" data-own> Something else: <input type="text" data-ownlast maxlength="${NAME_LIMITS.last}" placeholder="Write it in"></label></div></div>
        <p class="bname-preview" data-preview></p>
        <p class="bname-why" data-why role="alert"></p>
      </div>
      <button class="btn primary" data-ok style="width:100%;margin-top:6px">Name ${baby.gender === 'male' ? 'Him' : baby.gender === 'female' ? 'Her' : 'Them'}</button>`, { tone: 'good' });
    const q = (s) => m.el.querySelector(s);
    const lastNow = () => { const r = m.el.querySelector('input[name="bname-last"]:checked'); return r?.dataset.own != null ? q('[data-ownlast]').value : r?.value ?? ''; };
    const preview = () => { q('[data-preview]').innerHTML = `<span class="btag-ink">${esc(`${q('[data-first]').value.trim()} ${lastNow().trim()}`.trim() || ' ')}</span>`; q('[data-why]').textContent = ''; };
    q('[data-idea]').addEventListener('click', () => { q('[data-first]').value = ideas(); preview(); });
    m.el.addEventListener('input', (e) => { if (e.target.matches('[data-ownlast]')) q('[data-own]').checked = true; preview(); });
    m.el.addEventListener('change', preview);
    q('[data-ok]').addEventListener('click', () => {
      const r = nameBaby(baby.id, q('[data-first]').value, lastNow());
      if (!r.ok) { q('[data-why]').textContent = r.text; return; }
      m.close(); resolve(r);
    });
    preview();
  });
}

/** How babies born together are announced. */
const WORD = { 2: 'Twins', 3: 'Triplets', 4: 'Quadruplets' };
const COUNT = ['', 'a', 'two', 'three', 'four'];
/** "Two girls", "A boy & a girl", "Two boys & a girl". */
function whoAreThey(babies) {
  const n = (g) => babies.filter((b) => b.gender === g).length;
  const part = (k, one, many) => (k ? `${k === 1 ? 'a' : COUNT[k]} ${k === 1 ? one : many}` : '');
  const parts = [part(n('male'), 'boy', 'boys'), part(n('female'), 'girl', 'girls'), part(babies.length - n('male') - n('female'), 'baby', 'babies')].filter(Boolean);
  const s = parts.join(' & ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
/** "07 | 14 | 27" in the US, "14 | 07 | 27" elsewhere, as a birth announcement writes it. */
function shortDate(date, countryId) {
  const [y, m, d] = date.split('-');
  return (countryId === 'us' ? [m, d, y.slice(2)] : [d, m, y.slice(2)]).join(' | ');
}
const minutesApart = (a, b) => {
  const t = (s) => { const [, h, m, ap] = s.match(/(\d+):(\d+) (AM|PM)/); return ((Number(h) % 12) + (ap === 'PM' ? 12 : 0)) * 60 + Number(m); };
  return ((t(b) - t(a)) + 1440) % 1440;
};

/** Twins, triplets or quadruplets: an announcement, before they are named. */
export function announceMultiples(babies) {
  if (babies.length < 2) return Promise.resolve();
  return new Promise((resolve) => {
    const info = babies[0].birthInfo;
    const apart = minutesApart(babies[0].birthInfo.time, babies.at(-1).birthInfo.time);
    const m = openModal(`
      <div class="announce">
        <div class="announce-word">${WORD[babies.length] ?? 'Babies'}!</div>
        <svg class="announce-flourish" viewBox="0 0 200 14" aria-hidden="true"><path d="M4 8c30-8 60 6 96 0s66-8 96 0"/></svg>
        <div class="announce-who">${esc(whoAreThey(babies)).toUpperCase()}</div>
        <div class="announce-babies">${babies.map((b) => `<div class="btag btag-${SHADE[b.gender] ?? 'mint'} announce-baby">${swaddleHtml(b)}</div>`).join('')}</div>
        <div class="announce-date">${esc(shortDate(info.date, info.countryId))}</div>
        <div class="announce-line">${esc(info.time)}${apart ? ` · ${babies.length > 2 ? `ALL IN ${apart} MINUTES` : `${apart} MINUTES APART`}` : ''}</div>
      </div>
      <button class="btn primary" data-ok style="width:100%;margin-top:14px">Name Them</button>`, { tone: 'good' });
    m.el.querySelector('[data-ok]').addEventListener('click', () => { m.close(); resolve(); });
  });
}

/** The day an adopted child came home: a keepsake card with their face, the date, and who welcomed them. */
export function adoptionCardHtml(child, parents = []) {
  const a = child.adoptionInfo;
  const sign = starSign(child.birthday ?? birthdayFromDate(a.date));
  const face = a.ageThen < 2 ? swaddleHtml(child)
    : `<div class="adopt-face">${avatarSvg({ age: a.ageThen, gender: child.gender, appearance: child.appearance, seed: child.id, mood: 80, size: 96 })}</div>`;
  const names = parents.filter(Boolean).map((x) => x.firstName);
  const by = names.length ? `${names.join(' & ')} ${parents.find(Boolean)?.lastName ?? child.lastName}` : '';
  const where = `${a.city ? `${a.city}, ` : ''}${COUNTRIES[a.countryId]?.name ?? ''}`;
  return `<div class="btag btag-mint adopt-card">
    <div class="btag-holes" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="btag-card adopt-inner">
      <div class="announce-word adopt-word">Welcome Home</div>
      <div class="adopt-main">
        <div class="adopt-left">${face}<div class="adopt-house" aria-hidden="true">🏡</div></div>
        <div class="btag-fields">
          <div class="btag-row"><span class="btag-label">Name</span><span class="btag-ink">${esc(`${child.firstName} ${child.lastName}`)}</span></div>
          <div class="btag-row"><span class="btag-label">Came Home</span><span class="btag-ink">${esc(longDate(a.date))}</span></div>
          <div class="btag-row"><span class="btag-label">Age</span><span class="btag-ink">${a.ageThen === 0 ? 'A baby' : esc(String(a.ageThen))}</span></div>
          <div class="btag-row"><span class="btag-label">Star Sign</span><span class="btag-ink">${sign.symbol} ${esc(sign.name)}</span></div>
          <div class="btag-row"><span class="btag-label">Caseworker</span><span class="btag-ink">${esc(a.caseworker)}</span></div>
        </div>
      </div>
      <p class="btag-ink adopt-note">“${esc(a.note)}”</p>
      <div class="btag-stamp" style="--tilt:${a.tilt}deg">${esc(a.stamp)}</div>
    </div>
    <div class="btag-foot"><strong>${esc(a.agency)}</strong><span>${esc(where)}</span>${by ? `<small>Adopted by ${esc(by)}</small>` : ''}</div>
  </div>`;
}

/** Opens an adoption day card. Resolves when it is closed. */
export function openAdoptionCard(child, { title, parents, button = 'Close' } = {}) {
  if (!child?.adoptionInfo) return Promise.resolve();
  return new Promise((resolve) => {
    const m = openModal(`
      ${title ? `<h2 class="pick-title btag-title">${esc(title)}</h2>` : ''}
      ${adoptionCardHtml(child, parents)}
      <button class="btn primary" data-ok style="width:100%;margin-top:14px">${esc(button)}</button>`, { tone: 'good', dismissable: true, onDismiss: resolve });
    m.el.querySelector('[data-ok]').addEventListener('click', () => { m.close(); resolve(); });
  });
}

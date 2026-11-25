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

/** Blanket colors: soft pink for a girl, soft blue for a boy, mint otherwise. */
const SHADE = { female: 'girl', male: 'boy' };
/** The part of the 512 portrait frame that holds a baby's face. */
const BABY_FACE = '128 178 256 256';

/** The baby, swaddled: wrapped all over in a blanket, a hood around the face, just the face peeking out. */
export function swaddleHtml(person, look) {
  const face = avatarSvg({ age: 0, gender: person.gender, appearance: look ?? person.appearance, seed: person.id, mood: 80, viewBox: BABY_FACE });
  return `<div class="swaddle" aria-hidden="true">
    <svg class="swaddle-back" viewBox="0 0 120 150">
      <path class="body" d="M60 6C30 6 14 30 14 60c0 44 18 82 46 86 28-4 46-42 46-86C106 30 90 6 60 6Z"/>
    </svg>
    <div class="swaddle-face">${face}</div>
    <svg class="swaddle-front" viewBox="0 0 120 150">
      <path class="rim" d="M60 17c-19 0-33 14-33 32s14 32 33 32 33-14 33-32-14-32-33-32Zm0 6c15 0 26 11 26 26S75 75 60 75 34 64 34 49s11-26 26-26Z"/>
      <path class="flap l" d="M18 78c14 4 30 2 42-4 10 18 12 44 0 70C36 138 20 110 18 78Z"/>
      <path class="flap r" d="M102 76c-18 10-42 12-60 6-4 18 2 42 18 62 24-4 40-34 42-68Z"/>
      <path class="fold" d="M46 96c12-4 26-5 40-2M48 112c10-3 22-3 32 0M56 128c6-1 12-1 18 1"/>
      <path class="tuck" d="M84 88c4 6 4 14 0 20"/>
    </svg>
  </div>`;
}

/** Two inked footprints, sized by the baby's length. */
function footprintsHtml(info) {
  const k = Math.max(0.85, Math.min(1.15, info.lengthIn / 19.7));
  const foot = (flip) => `<g transform="${flip ? 'translate(60 0) scale(-1 1)' : ''}">
      <path d="M14 46c-6-2-8-12-6-22 2-8 8-12 13-10 6 2 7 10 5 18-1 6-1 10 1 14 2 6-6 4-13 0Z"/>
      <circle cx="9" cy="10" r="3.2"/><circle cx="14.5" cy="7" r="2.6"/><circle cx="19.5" cy="7.5" r="2.2"/><circle cx="23.5" cy="10" r="1.8"/><circle cx="26.5" cy="13.5" r="1.5"/>
    </g>`;
  return `<svg class="btag-feet" viewBox="0 0 60 52" style="width:${Math.round(78 * k)}px" aria-label="Footprints">${foot(false)}${foot(true)}</svg>`;
}

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
        <div class="btag-left">${swaddleHtml(person)}${footprintsHtml(info)}</div>
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

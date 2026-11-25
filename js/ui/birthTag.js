// The hospital tag for a birth (engine/birthTag.js): a little pastel card with punched holes, filled in by hand, with
// the baby swaddled in a blanket. Shown when the player's child is born, and from a child's page or the player's own
// Identity card afterwards.
import { esc } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { openModal } from './modals.js';
import { avatarSvg } from './avatar.js';
import { longDate } from '../engine/birthday.js';
import { sizeWords, starSign, birthdayFromDate } from '../engine/birthTag.js';

/** Blanket colors: soft pink for a girl, soft blue for a boy, mint otherwise. */
const SHADE = { female: 'girl', male: 'boy' };

/** The baby's face, wrapped in a blanket: a hood behind the head, and the blanket folded across the front. */
export function swaddleHtml(person, look) {
  const face = avatarSvg({ age: 0, gender: person.gender, appearance: look ?? person.appearance, seed: person.id, mood: 80, size: 112 });
  return `<div class="swaddle" aria-hidden="true">
    <svg class="swaddle-hood" viewBox="0 0 120 120"><path d="M60 6C30 6 14 30 14 58c0 26 14 48 46 56 32-8 46-30 46-56C106 30 90 6 60 6Z"/></svg>
    <div class="swaddle-face">${face}</div>
    <svg class="swaddle-wrap" viewBox="0 0 120 120"><g transform="translate(0 12)">
      <path class="w1" d="M14 70c10 4 22 6 34 4 6 10 2 30-6 44-14-6-26-24-28-48Z"/>
      <path class="w2" d="M106 70c-10 4-24 8-40 4-18-2-26 8-30 16 6 14 14 24 24 30 26-6 42-24 46-50Z"/>
      <path class="fold" d="M38 84c10-6 26-8 40-6M44 98c10-4 22-5 34-2"/>
    </g></svg>
  </div>`;
}

/** The tag itself. `who` is the name written on it; `parents` a line about whose baby it is, if any. */
export function birthTagHtml(person, { who, parents } = {}) {
  const info = person.birthInfo;
  const size = sizeWords(info);
  const sign = starSign(birthdayFromDate(info.date));
  const shade = SHADE[person.gender] ?? 'mint';
  const where = `${info.city ? `${info.city}, ` : ''}${COUNTRIES[info.countryId]?.name ?? ''}`;
  const pick = (a, b, on) => `<span class="btag-pick"><span class="${on === a ? 'on' : ''}">${a}</span><span class="${on === b ? 'on' : ''}">${b}</span></span>`;
  const sex = person.gender === 'male' ? 'BOY' : person.gender === 'female' ? 'GIRL' : null;
  const [clock, ampm] = info.time.split(' ');
  return `<div class="btag btag-${shade}">
    <div class="btag-holes" aria-hidden="true"><i></i><i></i><i></i></div>
    <span class="btag-bow b1" aria-hidden="true">🎀</span><span class="btag-bow b2" aria-hidden="true">🎀</span>
    <div class="btag-card">
      <div class="btag-row btag-room"><span class="btag-label">Room</span><span class="btag-ink">${esc(info.room ?? '—')}</span></div>
      <div class="btag-main">
        ${swaddleHtml(person)}
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
    </div>
    <div class="btag-foot"><strong>${esc(info.place === 'At home' ? 'Born at home' : info.place)}</strong><span>${esc(where)}</span>${parents ? `<small>${esc(parents)}</small>` : ''}</div>
  </div>`;
}

/** Opens a tag in its own window. Resolves when it is closed. */
export function openBirthTag(person, { title, who, parents, button = 'Close' } = {}) {
  if (!person?.birthInfo) return Promise.resolve();
  return new Promise((resolve) => {
    const m = openModal(`
      ${title ? `<h2 class="pick-title btag-title">${esc(title)}</h2>` : ''}
      ${birthTagHtml(person, { who, parents })}
      <button class="btn primary" data-ok style="width:100%;margin-top:14px">${esc(button)}</button>`, { tone: 'good', dismissable: true, onDismiss: resolve });
    m.el.querySelector('[data-ok]').addEventListener('click', () => { m.close(); resolve(); });
  });
}

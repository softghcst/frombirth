// Character creator. Every field can be left on "Random" / "Inherited".
import { esc } from '../../util.js';
import { COUNTRIES, COUNTRY_LIST } from '../../data/countries.js';
import { BACKGROUNDS } from '../../data/traits.js';
import { avatarSvg, SKIN, HAIR, EYES, HAIR_STYLE_NAMES } from '../avatar.js';

const TALENTS = { music: 'Music', sports: 'Sports', acting: 'Acting', crime: 'Mischief' };

/** A row of options where the first one means "let the game decide". */
function picker(key, label, autoLabel, options) {
  return `
    <div class="field"><label>${esc(label)}</label>
      <div class="picker" data-pick="${key}" role="radiogroup" aria-label="${esc(label)}">
        <button type="button" class="pick on" data-value="" role="radio" aria-checked="true">${esc(autoLabel)}</button>
        ${options.map((o) => `
          <button type="button" class="pick ${o.colour ? 'swatch' : ''}" data-value="${esc(o.value)}" role="radio"
            aria-checked="false" aria-label="${esc(o.label)}" ${o.colour ? `style="background:${o.colour}"` : ''}>
            ${o.colour ? '' : esc(o.label)}</button>`).join('')}
      </div>
    </div>`;
}

const swatches = (colours, name) => colours.map((colour, i) => ({ value: i, colour, label: `${name} ${i + 1}` }));
const named = (map) => Object.entries(map).map(([value, label]) => ({ value, label: label.label ?? label }));

/**
 * @param {HTMLElement} app
 * @param {{onCreate:(opts:object)=>void, onCancel:Function}} hooks
 */
export function renderCreator(app, hooks) {
  const choice = { skin: '', hair: '', hairStyle: '', eyes: '', talent: '', background: '', gender: '' };

  app.innerHTML = `
    <section class="title-screen creator">
      <div class="creator-head">
        <div class="avatar preview" data-preview></div>
        <div><h1>Design a life</h1><p class="muted">Leave anything on Random and fate will decide.</p></div>
      </div>
      <form novalidate>
        <div class="card"><h3>Identity</h3>
          <div class="field-row">
            <div class="field"><label for="f-first">First name</label>
              <input id="f-first" maxlength="20" autocomplete="off" placeholder="Random"></div>
            <div class="field"><label for="f-last">Last name</label>
              <input id="f-last" maxlength="24" autocomplete="off" placeholder="Random"></div>
          </div>
          ${picker('gender', 'Gender', 'Random', named({ female: 'Female', male: 'Male', nonbinary: 'Non-binary' }))}
        </div>
        <div class="card"><h3>Birthplace</h3>
          <div class="field"><label for="f-country">Country</label>
            <select id="f-country"><option value="">Random</option>
              ${COUNTRY_LIST.map((c) => `<option value="${c.id}">${c.flag} ${esc(c.name)}</option>`).join('')}
            </select></div>
          <div class="field"><label for="f-city">City</label>
            <select id="f-city"><option value="">Random</option></select></div>
          <p class="muted" data-country-info>Each country has its own currency and taxes.</p>
        </div>
        <div class="card"><h3>Appearance</h3>
          ${picker('skin', 'Skin', 'Inherited', swatches(SKIN, 'Skin tone'))}
          ${picker('hair', 'Hair colour', 'Inherited', swatches(HAIR, 'Hair colour'))}
          ${picker('hairStyle', 'Hair style', 'Random', HAIR_STYLE_NAMES.map((label, value) => ({ value, label })))}
          ${picker('eyes', 'Eye colour', 'Inherited', swatches(EYES, 'Eye colour'))}
        </div>
        <div class="card"><h3>Start in life</h3>
          ${picker('talent', 'Natural gift', 'Random', named(TALENTS))}
          ${picker('background', 'Family background', 'Random', named(BACKGROUNDS))}
        </div>
        <div class="btn-row">
          <button type="button" class="btn" data-cancel>Back</button>
          <button type="submit" class="btn primary">Be born</button>
        </div>
      </form>
    </section>`;

  const q = (sel) => app.querySelector(sel);
  const num = (v) => (v === '' ? undefined : Number(v));

  function preview() {
    q('[data-preview]').innerHTML = avatarSvg({
      age: 24, gender: choice.gender || 'female', mood: 70,
      appearance: { skin: num(choice.skin) ?? 2, hair: num(choice.hair) ?? 1,
        hairStyle: num(choice.hairStyle) ?? 1, eyes: num(choice.eyes) ?? 0 },
    });
  }

  app.querySelectorAll('[data-pick]').forEach((group) => {
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.pick');
      if (!btn) return;
      choice[group.dataset.pick] = btn.dataset.value;
      group.querySelectorAll('.pick').forEach((b) => {
        b.classList.toggle('on', b === btn);
        b.setAttribute('aria-checked', String(b === btn));
      });
      preview();
    });
  });

  q('#f-country').addEventListener('change', (e) => {
    const c = COUNTRIES[e.target.value];
    q('#f-city').innerHTML = '<option value="">Random</option>'
      + (c?.cities ?? []).map((city) => `<option>${esc(city)}</option>`).join('');
    q('[data-country-info]').textContent = c
      ? `Currency: ${c.currency.code} (${c.currency.symbol}). Income tax ${Math.round(c.incomeTax * 100)}%, estate tax ${Math.round(c.estateTax * 100)}%. ${c.freeHealthcare ? 'Public health care.' : 'Private health care.'}`
      : 'Each country has its own currency and taxes.';
  });

  q('[data-cancel]').addEventListener('click', () => hooks.onCancel());
  q('form').addEventListener('submit', (e) => {
    e.preventDefault();
    hooks.onCreate({
      firstName: q('#f-first').value, lastName: q('#f-last').value,
      gender: choice.gender || undefined,
      countryId: q('#f-country').value || undefined,
      city: q('#f-city').value || undefined,
      appearance: { skin: num(choice.skin), hair: num(choice.hair),
        hairStyle: num(choice.hairStyle), eyes: num(choice.eyes) },
      talent: choice.talent || undefined,
      background: choice.background || undefined,
    });
  });

  preview();
}

// Character creator. Every field can be left on "Random" / "Inherited".
import { esc } from '../../util.js';
import { COUNTRIES, COUNTRY_LIST, propertyTaxLabel } from '../../data/countries.js';
import { BACKGROUNDS } from '../../data/traits.js';
import { avatarSvg } from '../../avatar/render.js';
import { openAppearanceEditor } from '../../avatar/editor.js';
import { randomAppearance } from '../../avatar/inherit.js';
import { ORIENTATIONS } from '../../engine/identity.js';
import { summary } from '../../engine/living.js';
import { MONARCHIES } from '../../data/royalty.js';

const TALENTS = { singing: 'Singing', dance: 'Dance', acting: 'Acting', music: 'Music', sports: 'Sports', crime: 'Mischief' };

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

const named = (map) => Object.entries(map).map(([value, label]) => ({ value, label: label.label ?? label }));

/**
 * @param {HTMLElement} app
 * @param {{onCreate:(opts:object)=>void, onCancel:Function}} hooks
 */
export function renderCreator(app, hooks) {
  const choice = { talent: '', background: '', gender: '', trans: '', orientation: '', birthRank: '' };
  let look = null; // a designed appearance, or null to inherit one
  const sample = randomAppearance();

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
          ${picker('trans', 'Transgender', 'Random', named({ yes: 'Yes', no: 'No' }))}
          ${picker('orientation', 'Attracted to', 'Random', ORIENTATIONS.map((o) => ({ value: o.id, label: o.name })))}
        </div>
        <div class="card"><h3>Birthplace</h3>
          <div class="field"><label for="f-country">Country</label>
            <select id="f-country"><option value="">Random</option>
              ${[...COUNTRY_LIST].sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${c.id}">${c.flag} ${esc(c.name)}</option>`).join('')}
            </select></div>
          <div class="field"><label for="f-city">City</label>
            <select id="f-city"><option value="">Random</option></select></div>
          <p class="muted" data-country-info>Each country has its own currency and taxes.</p>
        </div>
        <div class="card"><h3>Appearance</h3>
          <p class="muted" data-look-note style="margin-bottom:10px">Left alone, you will take after your parents.</p>
          <div class="btn-stack">
            <button type="button" class="btn" data-design-look>Design your look</button>
            <button type="button" class="btn" data-clear-look hidden>Leave it to my parents</button>
          </div>
        </div>
        <div class="card"><h3>Start in life</h3>
          ${picker('talent', 'Natural gift', 'Random', named(TALENTS))}
          ${picker('background', 'Family background', 'Random', named(BACKGROUNDS))}
          <div data-rank-field hidden>
            ${picker('birthRank', 'Born into', 'Random', named({ commoner: 'Commoners', noble: 'The nobility', royal: 'The royal family' }))}
            <p class="muted" data-rank-note></p>
          </div>
        </div>
        <div class="btn-row">
          <button type="button" class="btn" data-cancel>Back</button>
          <button type="submit" class="btn primary">Be born</button>
        </div>
      </form>
    </section>`;

  const q = (sel) => app.querySelector(sel);

  function preview() {
    q('[data-preview]').innerHTML = avatarSvg({ age: 24, gender: choice.gender || 'female', mood: 70, appearance: look ?? sample, seed: 'creator' });
    q('[data-preview]').style.opacity = look ? '1' : '0.45';
    q('[data-look-note]').textContent = look ? 'This is the face you will grow into. Your family will take after you.' : 'Left alone, you will take after your parents.';
    q('[data-clear-look]').hidden = !look;
    q('[data-design-look]').textContent = look ? 'Change your look' : 'Design your look';
  }

  q('[data-design-look]').addEventListener('click', async () => {
    const result = await openAppearanceEditor({ title: 'Your look', appearance: look ?? sample, age: 24, gender: choice.gender || undefined, seed: 'creator' });
    if (result) { look = result; preview(); }
  });
  q('[data-clear-look]').addEventListener('click', () => { look = null; preview(); });

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
    const crown = c ? MONARCHIES[c.id] : null;
    const nobles = !!crown && crown.ranks.some((r) => !['monarch', 'heir', 'royal', 'knight'].includes(r[0]));
    q('[data-rank-field]').hidden = !crown;
    q('[data-rank-field] [data-value="noble"]').hidden = !nobles;
    if (!crown || (!nobles && choice.birthRank === 'noble')) q('[data-rank-field] [data-value=""]').click();
    if (crown) {
      q('[data-rank-note]').textContent = `${c.name} is a monarchy: ${crown.ranks.map((r) => (r[1] === r[2] ? r[1] : `${r[1]} or ${r[2]}`)).filter((t, i, a) => a.indexOf(t) === i).join(', ')}.${crown.maleOnly ? ' Only men inherit the throne.' : ''} Left on Random, a royal birth is very rare.`;
    }
    q('[data-country-info]').textContent = c
      ? `Currency: ${c.currency.code} (${c.currency.symbol}). Income tax ${Math.round(c.incomeTax * 100)}%, estate tax ${Math.round(c.estateTax * 100)}%, property tax ${propertyTaxLabel(c)}. ${c.freeHealthcare ? 'Public health care.' : 'Private health care.'} ${summary(c).short}.`
      : 'Each country has its own currency and taxes.';
  });

  q('[data-cancel]').addEventListener('click', () => hooks.onCancel());
  q('form').addEventListener('submit', (e) => {
    e.preventDefault();
    hooks.onCreate({
      firstName: q('#f-first').value, lastName: q('#f-last').value,
      gender: choice.gender || undefined,
      trans: choice.trans === '' ? undefined : choice.trans === 'yes',
      orientation: choice.orientation || undefined,
      countryId: q('#f-country').value || undefined,
      city: q('#f-city').value || undefined,
      appearance: look ?? undefined,
      talent: choice.talent || undefined,
      background: choice.background || undefined,
      birthRank: choice.birthRank || undefined,
    });
  });

  preview();
}

// Character creator. Every field can be left on "Random" / "Inherited".
import { getEra } from '../../engine/history.js';
import { technologies } from '../../engine/digital/tech.js';
import { cityLine } from '../../engine/cities.js';
import { esc } from '../../util.js';
import { COUNTRIES, COUNTRY_LIST, surnameFor } from '../../data/countries.js';
import { BACKGROUNDS } from '../../data/traits.js';
import { avatarSvg } from '../../avatar/render.js';
import { openAppearanceEditor } from '../../avatar/editor.js';
import { openWorld } from '../world.js';
import { browse } from '../../engine/world.js';
import { randomAppearance } from '../../avatar/inherit.js';
import { ORIENTATIONS } from '../../engine/identity.js';
import { MONARCHIES } from '../../data/royalty.js';
import { BIRTH_CHOICES } from '../../engine/health/index.js';
import { CONDITION_BY_ID } from '../../data/health/conditions.js';

const TALENTS = { singing: 'Singing', dance: 'Dance', acting: 'Acting', music: 'Music', sports: 'Sports', crime: 'Mischief' };

/** A dropdown whose first option means "let the game decide". */
const optionsHtml = (autoLabel, options) => `<option value="">${esc(autoLabel)}</option>${options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}`;
function picker(key, label, autoLabel, options) {
  return `
    <div class="field"><label for="f-${key}">${esc(label)}</label>
      <select id="f-${key}" data-pick="${key}">${optionsHtml(autoLabel, options)}</select>
    </div>`;
}

/** The births a monarchy offers, with the titles they come with there, for the sex chosen (or both). */
function rankOptions(countryId, gender) {
  const crown = MONARCHIES[countryId];
  if (!crown) return [];
  const row = (rank) => crown.ranks.find((r) => r[0] === rank);
  const title = (r) => (!r ? '' : gender === 'male' ? r[1] : gender === 'female' ? r[2] : r[1] === r[2] ? r[1] : `${r[1]} or ${r[2]}`);
  const nobles = crown.ranks.filter((r) => !['monarch', 'heir', 'royal', 'knight'].includes(r[0]));
  const out = [{ value: 'commoner', label: 'Commoner' }];
  if (nobles.length) out.push({ value: 'noble', label: `Nobility: a future ${nobles.slice(0, 2).map(title).join(', ')}${nobles.length > 2 ? '…' : ''}` });
  out.push({ value: 'royal', label: `Royal family: ${title(row('royal')) || 'a royal'}` });
  if (!(crown.law?.order === 'maleOnly' && gender === 'female')) out.push({ value: 'heir', label: `Heir to the throne: ${title(row('heir')) || 'the heir'}` });
  return out;
}

/** A small die: the button beside each name box that picks a name at random. */
const DIE = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/>
  <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>
  <circle cx="8.5" cy="15.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.5" fill="currentColor"/></svg>`;

const pickFrom = (list) => list[Math.floor(Math.random() * list.length)];
/** Picks a key of `weights` in proportion to its weight. */
function weightedKey(weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  let r = Math.random() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return entries[entries.length - 1][0];
}
/** Restarts a die's shake. */
function shake(btn) {
  btn.classList.remove('rolling');
  void btn.offsetWidth;
  btn.classList.add('rolling');
}

const named = (map) => Object.entries(map).map(([value, label]) => ({ value, label: label.label ?? label }));

/**
 * @param {HTMLElement} app
 * @param {{onCreate:(opts:object)=>void, onCancel:Function}} hooks
 */
export function renderCreator(app, hooks) {
  const choice = { talent: '', background: '', sex: '', trans: '', orientation: '', birthRank: '', health: '' };
  let look = null; // a designed appearance, or null to inherit one
  const sample = randomAppearance();

  app.innerHTML = `
    <main class="title-screen creator">
      <div class="creator-head">
        <div class="avatar preview" data-preview></div>
        <div><h1>Design a life</h1><p class="muted" data-head-note>Leave anything on Random and fate will decide.</p></div>
      </div>
      <button type="button" class="btn randomize-all" data-randomize>${DIE}<span>Randomize everything</span></button>
      <form novalidate>
        <div class="card"><h3>Identity</h3>
          <div class="field-row">
            <div class="field"><label for="f-first">First name</label>
              <div class="with-dice"><input id="f-first" maxlength="20" autocomplete="off" placeholder="Random">
                <button type="button" class="dice-btn" data-dice="first" aria-label="Pick a random first name">${DIE}</button></div></div>
            <div class="field"><label for="f-last">Last name</label>
              <div class="with-dice"><input id="f-last" maxlength="24" autocomplete="off" placeholder="Random">
                <button type="button" class="dice-btn" data-dice="last" aria-label="Pick a random last name">${DIE}</button></div></div>
          </div>
          ${picker('sex', 'Sex', 'Random', named({ female: 'Female', male: 'Male' }))}
          ${picker('trans', 'Transgender', 'Random', named({ yes: 'Yes', no: 'No', nonbinary: 'Non-binary' }))}
          ${picker('orientation', 'Sexuality', 'Random', ORIENTATIONS.map((o) => ({ value: o.id, label: o.name })))}
        </div>
        <div class="card"><h3>Birthplace</h3>
          <div class="field"><label for="f-country">Country</label>
            <select id="f-country"><option value="">Random</option>
              <optgroup label="👑 Monarchies: you can be born royal">${Object.keys(MONARCHIES).filter((id) => COUNTRIES[id]).map((id) => COUNTRIES[id]).sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${c.id}">${c.flag} ${esc(c.name)}</option>`).join('')}</optgroup>
              ${browse().map((g) => `<optgroup label="${esc(g.group)}">${[...g.places].sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${c.id}">${c.flag} ${esc(c.name)}</option>`).join('')}</optgroup>`).join('')}
            </select></div>
          <div data-rank-field hidden>
            ${picker('birthRank', 'Born into', 'Random', [])}
            <p class="muted" data-rank-note></p>
          </div>
          <div class="field"><label for="f-city">City</label>
            <select id="f-city"><option value="">Random</option></select><p class="muted" data-city-note style="margin-top:4px"></p></div>
          <p class="muted" data-country-info>Each country has its own currency and taxes.</p>
          <div class="btn-stack"><button type="button" class="btn" data-browse-world>Explore the world</button></div>
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
          ${picker('health', 'Born with', 'Random', [{ value: 'none', label: 'Nothing in particular' }, ...BIRTH_CHOICES.map((id) => ({ value: id, label: CONDITION_BY_ID[id].name }))])}
          
          <div class="field"><label for="f-year">Year of birth</label>
            <input id="f-year" type="number" inputmode="numeric" min="1800" max="${new Date().getFullYear()}" placeholder="${new Date().getFullYear()} (now)">
            <div class="era-note" data-era-note aria-live="polite"></div></div>
        </div>
        <div class="btn-row">
          <button type="button" class="btn" data-cancel>Back</button>
          <button type="submit" class="btn peach">Be born</button>
        </div>
      </form>
    </main>`;

  const q = (sel) => app.querySelector(sel);

  /** Who the person grows up to be, as far as the choices say: the other sex if transgender. */
  const grownGender = () => (choice.sex && choice.trans === 'yes' ? (choice.sex === 'male' ? 'female' : 'male') : choice.sex || undefined);

  function preview() {
    q('[data-preview]').innerHTML = avatarSvg({ age: 24, gender: grownGender() || 'female', face: choice.sex || grownGender() || 'female', mood: 70, appearance: look ?? sample, seed: 'creator' });
    q('[data-preview]').style.opacity = look ? '1' : '0.45';
    q('[data-look-note]').textContent = look ? 'This is the face you will grow into. Your family will take after you.' : 'Left alone, you will take after your parents.';
    q('[data-clear-look]').hidden = !look;
    q('[data-design-look]').textContent = look ? 'Change your look' : 'Design your look';
  }

  q('[data-design-look]').addEventListener('click', async () => {
    const result = await openAppearanceEditor({ title: 'Your look', appearance: look ?? sample, age: 24, gender: grownGender(), seed: 'creator' });
    if (result) { look = result; preview(); }
  });
  q('[data-clear-look]').addEventListener('click', () => { look = null; preview(); });

  app.querySelectorAll('select[data-pick]').forEach((sel) => {
    sel.addEventListener('change', () => {
      choice[sel.dataset.pick] = sel.value;
      if (sel.dataset.pick === 'sex' || sel.dataset.pick === 'trans') ranks();
      preview();
    });
  });

  /** The "Born into" dropdown, for the country chosen: shown only for a monarchy, with its own titles. */
  function ranks() {
    const c = COUNTRIES[q('#f-country').value];
    const crown = c ? MONARCHIES[c.id] : null;
    q('[data-rank-field]').hidden = !crown;
    const sel = q('#f-birthRank');
    const opts = crown ? rankOptions(c.id, grownGender()) : [];
    const keep = opts.some((o) => o.value === choice.birthRank) ? choice.birthRank : '';
    sel.innerHTML = optionsHtml('Random (a royal birth is very rare)', opts);
    sel.value = keep;
    choice.birthRank = keep;
    if (crown) {
      q('[data-rank-note]').textContent = `${c.name} is a monarchy.${crown.law?.order === 'maleOnly' ? ' Only men inherit the throne.' : ''} Nobody is born a king or queen: the heir is crowned when the monarch dies.`;
    }
  }

  q('[data-browse-world]').addEventListener('click', () => openWorld({ start: q('#f-country').value || undefined, choose: 'Be born here',
    onChoose: (id) => { q('#f-country').value = id; q('#f-country').dispatchEvent(new Event('change')); } }));
  const cityNote = () => { const id = q('#f-country').value; const n = q('#f-city').value; q('[data-city-note]').textContent = id && n ? cityLine(id, n).replace(/^./, (x) => x.toUpperCase()) + '.' : ''; };
  q('#f-city').addEventListener('change', cityNote);
  q('#f-country').addEventListener('change', (e) => {
    const c = COUNTRIES[e.target.value];
    q('#f-city').innerHTML = '<option value="">Random</option>'
      + (c?.cities ?? []).map((city) => `<option>${esc(city)}</option>`).join('');
    ranks();
    q('[data-country-info]').textContent = c
      ? `${c.currency.code} (${c.currency.symbol}) · income tax ${Math.round(c.incomeTax * 100)}% · ${c.freeHealthcare ? 'public' : 'private'} health care`
      : 'Each country has its own currency and taxes.';
  });

  // The dice: a name from the chosen country (or any country, if that is left on Random),
  // a first name to suit the sex chosen (the name a baby is given). Each box rolls on its own.
  function rollName(which) {
    const c = COUNTRIES[q('#f-country').value] ?? pickFrom(COUNTRY_LIST);
    const gender = choice.sex || pickFrom(['male', 'female']);
    const box = q(which === 'first' ? '#f-first' : '#f-last');
    let name;
    for (let tries = 0; tries < 6 && (!name || name === box.value); tries++) {
      name = which === 'first' ? pickFrom(c.names[gender]) : surnameFor(c.id, pickFrom(c.names.last), gender);
    }
    box.value = name;
    shake(q(`[data-dice="${which}"]`));
  }
  app.querySelectorAll('[data-dice]').forEach((btn) => btn.addEventListener('click', () => rollName(btn.dataset.dice)));
  app.querySelectorAll('[data-dice], [data-randomize]').forEach((btn) => btn.addEventListener('animationend', () => btn.classList.remove('rolling')));

  /** Sets a row of options as if the player had tapped one. */
  const setPick = (key, value) => { const sel = q(`select[data-pick="${key}"]`); if (!sel) return; sel.value = value; sel.dispatchEvent(new Event('change')); };

  // Everything at once: a whole random person, every choice filled in and
  // showing, so the player can keep what they like and change the rest.
  // Odds follow the ones the game uses for lives left to chance.
  q('[data-randomize]').addEventListener('click', () => {
    const c = pickFrom(COUNTRY_LIST);
    q('#f-country').value = c.id;
    q('#f-country').dispatchEvent(new Event('change'));
    q('#f-city').value = pickFrom(c.cities);
    cityNote();
    setPick('sex', Math.random() < 0.5 ? 'female' : 'male');
    setPick('trans', weightedKey({ no: 95, yes: 3, nonbinary: 2 }));
    setPick('orientation', weightedKey(Object.fromEntries(ORIENTATIONS.map((o) => [o.id, o.weight]))));
    rollName('first');
    rollName('last');
    look = randomAppearance(undefined, choice.sex || grownGender()); // the face they are born with: a trans boy's changes with hormones, later
    setPick('talent', pickFrom(Object.keys(TALENTS)));
    setPick('background', pickFrom(Object.keys(BACKGROUNDS)));
    const crown = MONARCHIES[c.id];
    if (crown) {
      const nobles = crown.ranks.some((r) => !['monarch', 'heir', 'royal', 'knight'].includes(r[0]));
      setPick('birthRank', weightedKey({ commoner: 96, noble: nobles ? 3 : 0, royal: 1 }));
    }
    preview();
    q('[data-head-note]').textContent = 'Here is someone at random. Change anything you like.';
    shake(q('[data-randomize]'));
  });

  q('[data-cancel]').addEventListener('click', () => hooks.onCancel());
  q('form').addEventListener('submit', (e) => {
    e.preventDefault();
    hooks.onCreate({
      firstName: q('#f-first').value, lastName: q('#f-last').value,
      sex: choice.sex || undefined,
      gender: choice.trans === 'nonbinary' ? 'nonbinary' : undefined,
      trans: choice.trans === '' ? undefined : choice.trans !== 'no',
      orientation: choice.orientation || undefined,
      countryId: q('#f-country').value || undefined,
      city: q('#f-city').value || undefined,
      appearance: look ?? undefined,
      talent: choice.talent || undefined,
      background: choice.background || undefined,
      birthRank: choice.birthRank || undefined,
      health: choice.health === '' ? undefined : { conditions: choice.health === 'none' ? [] : [choice.health] },
      year: (() => { const y = Math.round(Number(q('#f-year').value)); return y >= 1800 && y <= new Date().getFullYear() ? y : undefined; })(),
    });
  });

  // What the chosen year means: its era, and what life is like then (Historical Eras).
  const eraNote = () => {
    const y = Math.round(Number(q('#f-year').value));
    const year = y >= 1800 && y <= new Date().getFullYear() ? y : new Date().getFullYear();
    const era = getEra(year);
    const countryId = q('#f-country').value || null;
    const tech = countryId ? technologies(year, countryId).filter((t) => t.status === 'common' || t.status === 'spreading').map((t) => t.tech.name.toLowerCase()) : [];
    q('[data-era-note]').innerHTML = `<p><strong>Born in ${year}: ${esc(era.name)}</strong> <span class="muted">(${esc(era.short)})</span></p>
      <p class="muted">${esc(era.description)}${era.id === 'now' ? '' : ' Careers, money, schools, laws and medicine follow the times, and new opportunities come as you grow older.'}</p>
      ${era.id === 'now' ? '' : `<details><summary>More about the times</summary><ul class="era-list">
        <li><strong>Work:</strong> ${esc(era.careers)}</li><li><strong>Money:</strong> ${esc(era.economy)}</li>
        <li><strong>School:</strong> ${esc(era.schooling)}</li><li><strong>The law:</strong> ${esc(era.law)}</li>
        ${tech.length ? `<li><strong>To keep in touch:</strong> ${esc(tech.slice(-4).join(', '))}.</li>` : ''}</ul></details>`}`;
  };
  q('#f-year').addEventListener('input', eraNote);
  q('#f-country').addEventListener('change', eraNote);
  eraNote();

  preview();
}

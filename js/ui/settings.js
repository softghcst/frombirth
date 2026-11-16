// Settings. For now one thing lives here: the list of people you know, who
// are written into your lives as friends, classmates, colleagues and dates.
import { esc } from '../util.js';
import { getPeople, addPerson, removePerson, GENDERS, MAX_PEOPLE } from '../people.js';
import { openModal } from './modals.js';

/** Opens Settings. Resolves when it is closed. */
export function openSettings() {
  return new Promise((resolve) => {
    const m = openModal(`
      <h2>Settings</h2>
      <div class="section-label" style="margin-top:6px">People you know</div>
      <p class="body muted">Add the names of people from your own life. They will turn up in the game as friends, classmates, people at work, dates and strangers. Each appears at most once in a life. The list stays in this browser.</p>
      <div class="field-row">
        <div class="field"><label for="kp-first">First name</label><input id="kp-first" maxlength="20" autocomplete="off"></div>
        <div class="field"><label for="kp-last">Last name (optional)</label><input id="kp-last" maxlength="24" autocomplete="off"></div>
      </div>
      <div class="field"><label>Gender</label>
        <div class="picker" data-gender role="radiogroup" aria-label="Gender">
          ${GENDERS.map(([id, label], i) => `<button type="button" class="pick ${i ? '' : 'on'}" data-value="${id}" role="radio" aria-checked="${i ? 'false' : 'true'}">${label}</button>`).join('')}
        </div></div>
      <p class="muted" data-note style="min-height:1.2em"></p>
      <button class="btn primary" data-add>Add them</button>
      <div data-list style="margin-top:14px"></div>
      <button class="btn" data-close style="margin-top:14px">Done</button>`,
    { dismissable: true, onDismiss: () => resolve() });
    const q = (sel) => m.el.querySelector(sel);
    let gender = GENDERS[0][0];

    function draw() {
      const list = getPeople();
      q('[data-list]').innerHTML = list.length
        ? `<div class="section-label" style="margin-top:0">${list.length} of ${MAX_PEOPLE}</div>` + list.map((x) => `
          <div class="kv"><span>${esc(x.first)} ${esc(x.last ?? '')}</span>
            <span>${esc(GENDERS.find((g) => g[0] === x.gender)?.[1] ?? '')}
              <button class="icon-btn" data-remove="${esc(x.id)}" aria-label="Remove ${esc(x.first)}" style="margin-left:8px">✕</button></span></div>`).join('')
        : '<p class="muted">Nobody added yet.</p>';
    }

    function add() {
      const r = addPerson(q('#kp-first').value, q('#kp-last').value, gender);
      q('[data-note]').textContent = r.text;
      if (r.ok) { q('#kp-first').value = ''; q('#kp-last').value = ''; q('#kp-first').focus(); draw(); }
    }

    m.el.addEventListener('click', (e) => {
      const pick = e.target.closest('[data-gender] .pick');
      if (pick) {
        gender = pick.dataset.value;
        m.el.querySelectorAll('[data-gender] .pick').forEach((b) => { b.classList.toggle('on', b === pick); b.setAttribute('aria-checked', String(b === pick)); });
        return;
      }
      const rm = e.target.closest('[data-remove]');
      if (rm) { removePerson(rm.dataset.remove); draw(); return; }
      if (e.target.closest('[data-add]')) add();
      if (e.target.closest('[data-close]')) { m.close(); resolve(); }
    });
    m.el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); add(); } });
    draw();
  });
}

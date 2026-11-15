// Obituary screen, shown at death and when visiting a grave. Phase 9 adds
// epitaph awards and the option to continue as a child.
import { esc, fmtMoney } from '../../util.js';
import { COUNTRIES } from '../../data/countries.js';

/**
 * @param {HTMLElement} app
 * @param {import('../../types.js').GraveyardEntry} g
 * @param {{onDone:Function}} hooks
 */
export function renderObituary(app, g, hooks) {
  const c = COUNTRIES[g.countryId];
  const k = g.counters;
  const facts = [
    ['Lived', `${g.ageAtDeath} ${g.ageAtDeath === 1 ? 'year' : 'years'}`],
    ['Home', `${g.city}, ${c.name}`],
    ['Occupation', g.lastOccupation],
    ['Net worth', fmtMoney(g.netWorth, c)],
    ['Children', String(g.childrenCount)],
    ['Jobs held', String(k.jobsHeld)],
    ['Given to charity', fmtMoney(k.donated * c.currency.scale, c)],
    ['Crimes committed', String(k.crimes)],
  ];

  app.innerHTML = `
    <section class="title-screen">
      <div class="stone">
        <p class="muted">In memory of</p>
        <h1>${esc(g.fullName)}</h1>
        <p class="years">${g.birthYear} – ${g.deathYear}</p>
        <p class="cause">Died of ${esc(g.causeOfDeath)}, aged ${g.ageAtDeath}.</p>
      </div>
      <div class="card"><h3>A life in brief</h3>
        ${facts.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('')}
      </div>
      <div class="card"><h3>Milestones</h3>
        ${g.milestones.map((m) => `<div class="kv"><span>Age ${m.age}</span><span>${esc(m.text)}</span></div>`).join('')}
      </div>
      <button class="btn primary" data-done>Return to title</button>
    </section>`;
  app.querySelector('[data-done]').addEventListener('click', () => hooks.onDone());
}

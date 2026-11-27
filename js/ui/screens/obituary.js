// Obituary screen, shown at death and when visiting a grave: the stone and
// its epitaph, the life in brief, what became of the estate, and (at death)
// the choice to carry on as a child.
import { esc, fmtMoney, theCountry } from '../../util.js';
import { COUNTRIES } from '../../data/countries.js';
import { EPITAPHS, EPITAPH_BY_ID } from '../../data/epitaphs.js';
import { epitaphsEarned } from '../../save.js';
import { openModal } from '../modals.js';
import { cardFile, shareText } from '../shareCard.js';

/** The share window: the card, and ways to send it on. */
async function openShare(g) {
  const m = openModal(`
    <h2>Share this life</h2>
    <div class="share-preview" aria-live="polite"><p class="muted">Making the picture…</p></div>
    <div class="btn-stack" style="margin-top:12px">
      <button class="btn primary" data-share hidden>Share</button>
      <a class="btn" data-save download hidden style="text-decoration:none">Save the picture</a>
      <button class="btn" data-copy>Copy the words</button>
      <button class="btn" data-close>Close</button>
    </div>`, { dismissable: true });
  const el = m.el;
  const text = shareText(g);
  let url = null;
  el.querySelector('[data-close]').addEventListener('click', () => { m.close(); if (url) URL.revokeObjectURL(url); });
  el.querySelector('[data-copy]').addEventListener('click', async (ev) => {
    try { await navigator.clipboard.writeText(text); ev.target.textContent = 'Copied'; } catch { ev.target.textContent = 'Could not copy'; }
  });
  let file;
  try { file = await cardFile(g); } catch { el.querySelector('.share-preview').innerHTML = '<p class="muted">The picture could not be made on this device. The words can still be copied.</p>'; return; }
  url = URL.createObjectURL(file);
  el.querySelector('.share-preview').innerHTML = `<img src="${url}" alt="${esc(`A gravestone card for ${g.fullName}, ${g.birthYear} to ${g.deathYear}`)}">`;
  const save = el.querySelector('[data-save]');
  save.href = url; save.download = file.name; save.hidden = false;
  const share = el.querySelector('[data-share]');
  if (navigator.canShare?.({ files: [file] })) {
    share.hidden = false;
    share.addEventListener('click', async () => { try { await navigator.share({ files: [file], title: `${g.fullName}, ${g.birthYear}–${g.deathYear}`, text }); } catch { /* the player closed the share sheet */ } });
  }
}

const kv = (rows) => rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');

function estateCard(g, c) {
  const e = g.estate;
  if (!e) return '';
  const shares = e.shares ?? [];
  if (e.gross <= 0 && !shares.some((s) => s.items?.length)) return '<div class="card"><h3>The estate</h3><p class="muted">There was nothing to leave. The debts were written off.</p></div>';
  const rows = [['Everything they owned', fmtMoney(e.gross, c)]];
  if (e.tax && e.taxBy?.length > 1) for (const t of e.taxBy) rows.push([`Estate tax, ${t.name} (${Math.round(t.rate * 100)}%)`, `− ${fmtMoney(t.amount, c)}`]);
  else if (e.tax) rows.push([`Estate tax (${Math.round((e.taxBy?.[0]?.rate ?? 0) * 100)}% of the estate)`, `− ${fmtMoney(e.tax, c)}`]);
  if (e.charity) rows.push(['Left to charity', fmtMoney(e.charity, c)]);
  for (const s of shares) {
    rows.push([`${s.name} (${s.role.toLowerCase()})`, fmtMoney(s.amount, c)]);
    for (const it of s.items ?? []) rows.push([`   and the ${it.name.charAt(0).toLowerCase() + it.name.slice(1)}`, fmtMoney(it.value, c)]);
  }
  if (e.lost) rows.push(['Buried in the garden, never found', fmtMoney(e.lost, c)]);
  if (e.toState) rows.push(['With no heirs, taken by the state', fmtMoney(e.toState, c)]);
  return `<div class="card"><h3>The estate</h3>${kv(rows)}<p class="muted" style="margin-top:8px">Nothing was sold. Property and vehicles passed on as they were.</p></div>`;
}

/** Every epitaph in the game, showing which have been earned across all lives. */
export function openEpitaphCollection() {
  const have = new Set(epitaphsEarned());
  const rows = EPITAPHS.map((e) => (have.has(e.id)
    ? `<div class="epitaph-row"><strong>${esc(e.title)}</strong><small>${esc(e.line)}</small></div>`
    : `<div class="epitaph-row locked"><strong>Not yet earned</strong><small>${esc(e.hint)}</small></div>`)).join('');
  const m = openModal(`
    <h2>Epitaphs</h2>
    <p class="body muted">${have.size} of ${EPITAPHS.length} earned across all your lives.</p>
    <div class="epitaph-list">${rows}</div>
    <button class="btn" data-close style="margin-top:14px">Close</button>`, { dismissable: true });
  m.el.querySelector('[data-close]').addEventListener('click', () => m.close());
}

/**
 * @param {HTMLElement} app
 * @param {import('../../types.js').GraveyardEntry} g
 * @param {{onDone:Function, onRestart?:Function, heirs?:{id:string, name:string, label:string, age:number}[], onContinue?:(id:string)=>void}} hooks
 */
export function renderObituary(app, g, hooks) {
  const c = COUNTRIES[g.countryId];
  const k = g.counters;
  const titles = (g.epitaphIds ?? []).map((id) => EPITAPH_BY_ID[id]).filter(Boolean);
  const [main, ...others] = titles;
  const family = [g.spouseName ? `married to ${g.spouseName}` : null,
    g.childrenCount ? `${g.childrenCount} ${g.childrenCount === 1 ? 'child' : 'children'}` : null,
    g.grandchildrenCount ? `${g.grandchildrenCount} ${g.grandchildrenCount === 1 ? 'grandchild' : 'grandchildren'}` : null].filter(Boolean);
  const facts = [
    ['Lived', `${g.ageAtDeath} ${g.ageAtDeath === 1 ? 'year' : 'years'}`],
    ['Home', `${g.city}, ${theCountry(c.name)}`],
    ['Occupation', g.lastOccupation],
    ['Family', family.length ? family.join(', ') : 'None'],
    ...(g.lifetimeEarned != null ? [['Earned in a lifetime', fmtMoney(g.lifetimeEarned, c)]] : []),
    ['Net worth', fmtMoney(g.netWorth, c)],
    ['Jobs held', String(k.jobsHeld)],
    ['Given to charity', fmtMoney(k.donated * c.currency.scale, c)],
    ...(k.crimes ? [['Crimes committed', String(k.crimes)]] : []),
    ...(k.yearsJailed ? [['Years in prison', String(k.yearsJailed)]] : []),
    ...(k.countriesLived > 1 ? [['Countries lived in', String(k.countriesLived)]] : []),
    ...((g.generation ?? 1) > 1 ? [['Generation', String(g.generation)]] : []),
    ...(g.continuedAs ? [['The story carried on with', g.continuedAs]] : []),
  ];
  const heirs = hooks.heirs ?? [];

  app.innerHTML = `
    <main class="title-screen">
      <div class="stone">
        <p class="muted">In memory of</p>
        <h1>${esc(g.fullName)}</h1>
        <p class="years">${g.birthYear} – ${g.deathYear}</p>
        ${main ? `<p class="epitaph">${esc(main.title)}</p><p class="epitaph-line">${esc(main.line)}</p>` : ''}
        <p class="cause">Died of ${esc(g.causeOfDeath)}, aged ${g.ageAtDeath}.</p>
      </div>
      ${others.length ? `<div class="card"><h3>Also remembered as</h3>
        ${others.map((e) => `<div class="epitaph-row"><strong>${esc(e.title)}</strong><small>${esc(e.line)}</small></div>`).join('')}
      </div>` : ''}
      <div class="card"><h3>A life in brief</h3>${kv(facts)}</div>
      ${estateCard(g, c)}
      <div class="card"><h3>Milestones</h3>
        ${g.milestones.map((m) => `<div class="kv"><span>Age ${m.age}</span><span>${esc(m.text)}</span></div>`).join('')}
      </div>
      ${heirs.length ? `<div class="card"><h3>Carry on as ${heirs[0].label.includes('grand') ? 'a grandchild' : 'a child'}</h3>
        
        <div class="btn-stack">${heirs.map((h) => `<button class="btn" data-heir="${h.id}">Continue as ${esc(h.name)} <small>${esc(h.label)}, age ${h.age}</small></button>`).join('')}</div>
      </div>` : ''}
      <div class="btn-stack">
        ${hooks.onUndo ? '<button class="btn" data-undo-death>Go back a year</button>' : ''}
        ${hooks.onRestart ? '<button class="btn" data-restart>Start this life again</button>' : ''}
        <button class="btn" data-share-life>Share this life</button>
        <button class="btn" data-epitaphs>Epitaphs Earned</button>
        <button class="btn primary" data-done>${heirs.length ? 'End the story here' : 'Return to title'}</button>
      </div>
    </main>`;
  app.scrollTop = 0;
  window.scrollTo(0, 0);
  app.querySelector('[data-done]').addEventListener('click', () => hooks.onDone());
  app.querySelector('[data-epitaphs]').addEventListener('click', openEpitaphCollection);
  app.querySelector('[data-share-life]').addEventListener('click', () => openShare(g));
  app.querySelector('[data-restart]')?.addEventListener('click', () => hooks.onRestart());
  app.querySelector('[data-undo-death]')?.addEventListener('click', () => hooks.onUndo());
  for (const b of app.querySelectorAll('[data-heir]')) b.addEventListener('click', () => hooks.onContinue(b.dataset.heir));
}

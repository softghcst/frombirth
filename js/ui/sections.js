// Every tab, the same shape: a short list of rows, each opening its own screen.
// After a tab draws, each card in it becomes one row (its title, an icon and a chevron), and the card waits,
// hidden, until its row is tapped. Nothing is redrawn or rebound: the tab's own buttons and handlers stay
// exactly where they were. A card that is only a line of text and one button becomes that button.
import { esc } from '../util.js';
import { icon } from './kit.js';

/** Icons for section titles, by the first word or phrase that matches. */
const ICONS = [
  [/wellbeing|health|conditions|born with|care/i, 'health'], [/aptitude|skill|talent/i, 'star'], [/crown|royal|court/i, 'trophy'],
  [/identity/i, 'id'], [/times|news|era/i, 'news'], [/life in|world|abroad|travel/i, 'globe'], [/trait/i, 'sparkle'],
  [/milestone|this year|week|calendar/i, 'calendar'], [/school|universit|education|campus/i, 'school'], [/work|job|career|office|politic/i, 'briefcase'],
  [/contact|people|friend|family/i, 'people'], [/money|loan|debt|tax|gambl/i, 'coin'], [/will|letter|digital|online/i, 'letter'],
  [/crime|legal|court|prison|police/i, 'passport'], [/athlet|sport|riding|race/i, 'trophy'], [/radio|television/i, 'news'],
  [/moving|home|house|propert/i, 'home'], [/things to do|hobby|fun/i, 'compass'], [/past|history|archive/i, 'archive'],
];
const iconFor = (title) => ICONS.find(([re]) => re.test(title))?.[1] ?? 'sparkle';

/** The title of a card: its heading, without anything after a line break. */
function titleOf(card) {
  const h = card.querySelector(':scope > h3, :scope > .info-head h3');
  return h ? h.textContent.trim() : '';
}

const rowInner = (title, sub, alert) => `<span class="nr-icon">${icon(iconFor(title))}</span>
  <span class="nr-main"><span class="nr-label">${esc(title)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</span>
  ${alert ? '<span class="nr-dot" aria-hidden="true"></span>' : ''}${icon('chevron', 'nr-chev')}`;

/**
 * Turns the cards in a tab's body into rows, and shows the one that is open, if any.
 * @param {HTMLElement} body  the panel body, just drawn by the tab
 * @param {string|null} open  the title of the section to show, or null for the list
 * @returns {string|null}     the title of the section shown (null if none, or if it no longer exists)
 */
export function sectionize(body, open) {
  for (const card of [...body.children]) {
    if (!card.classList.contains('card')) continue;
    const title = titleOf(card);
    if (!title) continue;
    const buttons = card.querySelectorAll('button');
    const fields = card.querySelectorAll('input, select, textarea, .kv, .meter, .row, details');
    // Just a line and a button: the row is the button.
    if (buttons.length === 1 && !fields.length) {
      const btn = buttons[0];
      const note = [...card.querySelectorAll('p')].map((p) => p.textContent.trim()).join(' ').trim();
      btn.className = 'nav-row sec-row';
      btn.innerHTML = rowInner(title, note.length <= 60 ? note : '', false);
      card.replaceWith(btn);
      continue;
    }
    const row = document.createElement('button');
    row.className = 'nav-row sec-row';
    row.dataset.sec = title;
    // A section with something waiting for the player (its main action is highlighted) gets a dot.
    row.innerHTML = rowInner(title, '', !!card.querySelector('.btn.primary:not([disabled]), .btn.peach:not([disabled])'));
    card.before(row);
    card.classList.add('sec-body');
    card.dataset.secBody = title;
  }
  // Rows next to each other share one list.
  let group = null;
  for (const el of [...body.children]) {
    const isRow = el.classList.contains('sec-row') || el.classList.contains('nav-group');
    const isBody = el.classList.contains('sec-body');
    if (isBody) continue; // hidden cards do not break a list
    if (!isRow) { group = null; continue; }
    // A list under its own heading keeps to itself: rows after it start a new list.
    const labeled = el.classList.contains('nav-group') && el.previousElementSibling?.classList.contains('section-label');
    if (labeled) { group = null; continue; }
    if (!group) {
      if (el.classList.contains('nav-group')) { group = el; continue; }
      group = document.createElement('div');
      group.className = 'nav-group';
      el.before(group);
    }
    if (el.classList.contains('nav-group')) { group.append(...el.children); el.remove(); } else group.append(el);
  }
  return show(body, open);
}

/** Shows one section (by title), or the list when there is none. Returns the title shown. */
export function show(body, open) {
  const card = open ? body.querySelector(`.sec-body[data-sec-body="${CSS.escape(open)}"]`) : null;
  body.classList.toggle('sec-open', !!card);
  body.querySelectorAll('.sec-body').forEach((c) => c.classList.toggle('shown', c === card));
  return card ? open : null;
}

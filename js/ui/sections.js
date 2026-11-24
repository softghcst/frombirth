// Every tab, the same shape: a short list of rows, each opening its own screen.
// After a tab draws, each card in it becomes one row (its title, an icon and a chevron), and the card waits,
// hidden, until its row is tapped. Nothing is redrawn or rebound: the tab's own buttons and handlers stay
// exactly where they were. A card that is only a line of text and one button becomes that button.
// Rows show their picture, their name and one line saying what they are for (data/menus.js).
import { esc } from '../util.js';
import { icon, rowTile } from './kit.js';
import { menuInfo } from '../data/menus.js';

/** Icons for section titles, by the first word or phrase that matches. */
const ICONS = [
  [/wellbeing|health|conditions|born with|care/i, 'health'], [/aptitude|skill|talent/i, 'star'], [/crown|royal|court/i, 'trophy'],
  [/identity/i, 'id'], [/times|news|era/i, 'news'], [/life in|world|abroad|travel/i, 'globe'], [/trait/i, 'sparkle'],
  [/milestone|this year|week|calendar/i, 'calendar'], [/school|universit|education|campus/i, 'school'], [/work|job|career|office|politic/i, 'briefcase'],
  [/contact|people|friend|family|club/i, 'people'], [/money|loan|debt|tax|gambl/i, 'coin'], [/will|letter|digital|online/i, 'letter'],
  [/crime|legal|court|prison|police/i, 'passport'], [/athlet|sport|riding|race/i, 'trophy'], [/radio|television/i, 'news'],
  [/moving|home|house|propert/i, 'home'], [/things to do|hobby|fun/i, 'compass'], [/past|history|archive/i, 'archive'],
];
const iconFor = (title) => ICONS.find(([re]) => re.test(title))?.[1] ?? 'sparkle';

/** The title of a card: its heading, without anything after a line break. */
function titleOf(card) {
  const h = card.querySelector(':scope > h3, :scope > .info-head h3');
  return h ? h.textContent.trim() : '';
}

const rowInner = (title, sub, alert) => `${rowTile(title, iconFor(title))}
  <span class="nr-main"><span class="nr-label">${esc(title)}</span>${(sub || menuInfo(title)?.desc) ? `<small>${esc(sub || menuInfo(title).desc)}</small>` : ''}</span>
  ${alert ? '<span class="nr-dot" aria-hidden="true"></span>' : ''}${icon('chevron', 'nr-chev')}`;

/** Sections inside sections are named by their path: "Work › Politics". */
export const SEP = ' › ';

/**
 * Turns the cards in a tab's body into rows, and shows the one that is open, if any.
 * Cards inside a section become rows inside it in turn, so a section can hold sections of its own.
 * @param {HTMLElement} body  the panel body, just drawn by the tab
 * @param {string|null} open  the path of the section to show, or null for the list
 * @returns {string|null}     the path of the section shown (null if none; the nearest one that still exists)
 */
export function sectionize(body, open) {
  build(body, '');
  return show(body, open);
}

function build(container, prefix) {
  const made = [];
  for (const card of [...container.children]) {
    if (!card.classList.contains('card')) continue;
    const title = titleOf(card);
    if (!title) continue;
    const buttons = card.querySelectorAll('button');
    const fields = card.querySelectorAll('input, select, textarea, .kv, .meter, .row, details');
    // Just a line and a button: the row is the button.
    if (buttons.length === 1 && !fields.length) {
      const btn = buttons[0];
      btn.className = 'nav-row sec-row';
      btn.removeAttribute('style'); // the card's own spacing does not belong on a row
      btn.innerHTML = rowInner(title, '', false);
      card.replaceWith(btn);
      continue;
    }
    const key = prefix ? `${prefix}${SEP}${title}` : title;
    const row = document.createElement('button');
    row.className = 'nav-row sec-row';
    row.dataset.sec = key;
    // A section with something waiting for the player (its main action is highlighted) gets a dot.
    row.innerHTML = rowInner(title, '', !!card.querySelector('.btn.primary:not([disabled]), .btn.peach:not([disabled])'));
    card.before(row);
    card.classList.add('sec-body');
    card.dataset.secBody = key;
    made.push([card, key]);
  }
  // Rows next to each other share one list.
  let group = null;
  for (const el of [...container.children]) {
    const isRow = el.classList.contains('sec-row') || el.classList.contains('nav-group');
    const isBody = el.classList.contains('sec-body');
    if (isBody) continue; // hidden cards do not break a list
    if (!isRow) { group = null; continue; }
    // A list under its own heading starts a new list, and rows that follow it belong to that heading too (a heading
    // ends only at the next heading or at something that is not a row).
    const labeled = el.classList.contains('nav-group') && el.previousElementSibling?.classList.contains('section-label');
    if (labeled) { group = el; continue; }
    if (!group) {
      if (el.classList.contains('nav-group')) { group = el; continue; }
      group = document.createElement('div');
      group.className = 'nav-group';
      el.before(group);
    }
    if (el.classList.contains('nav-group')) { group.append(...el.children); el.remove(); } else group.append(el);
  }
  for (const [card, key] of made) build(card, key);
}

/** Shows one section (by its path), or the list when there is none. Returns the path shown. */
export function show(body, open) {
  body.querySelectorAll('.sec-body.shown').forEach((c) => c.classList.remove('shown'));
  body.querySelectorAll('.sec-open').forEach((c) => c.classList.remove('sec-open'));
  body.classList.remove('sec-open');
  let container = body;
  let shown = null;
  const parts = open ? open.split(SEP) : [];
  for (let i = 0; i < parts.length; i++) {
    const key = parts.slice(0, i + 1).join(SEP);
    const card = [...container.children].find((c) => c.classList.contains('sec-body') && c.dataset.secBody === key);
    if (!card) break;
    container.classList.add('sec-open');
    card.classList.add('shown');
    container = card;
    shown = key;
  }
  return shown;
}

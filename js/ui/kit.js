// Afterglow building blocks shared by every screen: the Pathways mark, outline icons, navigation rows and
// paired actions. Markup only; the look lives in css/components.css.
import { esc } from '../util.js';
import { menuInfo } from '../data/menus.js';

/** The Pathways mark: a road from a first step to a bright point. The same shape as always, in Afterglow colors. */
export const markSvg = (cls = 'title-mark') => `
  <svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="pw-mark-${cls}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8A66B2"/><stop offset="1" stop-color="#5E3F84"/></linearGradient></defs>
    <rect width="64" height="64" rx="16" fill="url(#pw-mark-${cls})"/>
    <path d="M18 52c0-12 28-10 28-22S18 22 18 12" fill="none" stroke="#F6EFFB" stroke-width="5" stroke-linecap="round"/>
    <circle cx="18" cy="52" r="4.5" fill="#F6EFFB"/><circle cx="18" cy="12" r="4.8" fill="#FFB699"/>
  </svg>`;

/** Outline icons, 24-unit grid, drawn with currentColor. */
const PATHS = {
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  paw: '<circle cx="7" cy="10" r="1.8"/><circle cx="11" cy="6.5" r="1.8"/><circle cx="15.5" cy="7" r="1.8"/><circle cx="18" cy="11" r="1.8"/><path d="M8.5 17c0-3 1.8-5 3.8-5s3.7 2 3.7 5c0 1.7-1.3 2.5-2.5 2.2-.8-.2-1.4-.5-2.2-.2-1.2.4-2.8 0-2.8-2z"/>',
  archive: '<rect x="3.5" y="4" width="17" height="5" rx="1.5"/><path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4"/>',
  tree: '<circle cx="12" cy="5" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="18" r="2.2"/><path d="M12 7.2V12M6 15.8V12h12v3.8"/>',
  letter: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  child: '<circle cx="12" cy="6" r="2.6"/><path d="M8 21v-5l-2-3 3-3h6l3 3-2 3v5"/>',
  school: '<path d="m3 9 9-4.5L21 9l-9 4.5z"/><path d="M7 11v4.5c1.5 1.5 3 2 5 2s3.5-.5 5-2V11M21 9v5"/>',
  book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.6l5.8-.8z"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
  passport: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10.5" r="3"/><path d="M9 16.5h6"/>',
  news: '<rect x="3.5" y="5" width="14" height="14" rx="1.5"/><path d="M17.5 9h3v8.5a1.5 1.5 0 0 1-3 0zM7 9h7M7 12.5h7M7 16h4"/>',
  health: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M8.5 11.5h2l1-2 1.5 4 1-2h1.5"/>',
  doctor: '<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/>',
  scissors: '<circle cx="6" cy="6.5" r="2.5"/><circle cx="6" cy="17.5" r="2.5"/><path d="m8 8 12 10M8 16 20 6"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M10.3 3h3.4l.5 2.3 1.6.7 2-1.3 2.4 2.4-1.3 2 .7 1.6 2.3.5v3.4l-2.3.5-.7 1.6 1.3 2-2.4 2.4-2-1.3-1.6.7-.5 2.3h-3.4l-.5-2.3-1.6-.7-2 1.3-2.4-2.4 1.3-2-.7-1.6L3 13.7v-3.4l2.3-.5.7-1.6-1.3-2 2.4-2.4 2 1.3 1.6-.7z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  exit: '<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 16l-4-4 4-4M6 12h10"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.5-.9-1.5-1.4-2.6-1.4-1.5 0-2.6.8-2.6 2s1 1.7 2.7 2.1c1.7.4 2.7 1 2.7 2.2s-1.2 2.1-2.8 2.1c-1.2 0-2.3-.6-2.8-1.5M12 6v1.8M12 16.2V18"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17.5" cy="9" r="2.4"/><path d="M16.5 14.2c2.6.3 4.5 2.4 4.5 5.3"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.3"/><path d="M5.8 16c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 10h3.5M14.5 13.5h3.5"/>',
  family: '<circle cx="8" cy="7" r="2.5"/><circle cx="16" cy="7" r="2.5"/><circle cx="12" cy="13.5" r="2"/><path d="M3.5 20c0-3 2-5 4.5-5M20.5 20c0-3-2-5-4.5-5M9 20.5c0-2 1.3-3.5 3-3.5s3 1.5 3 3.5"/>',
  home: '<path d="M4 11 12 4l8 7v8.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5z"/><path d="M10 21v-6h4v6"/>',
  crown: '<path d="M4 18 3 7l5 4 4-6 4 6 5-4-1 11z"/><path d="M4 21h16"/>',
  chat: '<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4"/>',
  medal: '<circle cx="12" cy="15" r="5"/><path d="m8.5 11-3-8h4l2.5 6M15.5 11l3-8h-4L12 9"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5v1.5A3.5 3.5 0 0 0 8 11M16 6h3.5v1.5A3.5 3.5 0 0 1 16 11M12 13v4M8.5 20h7M9.5 17h5"/>',
};

/** An outline icon. */
export const icon = (name, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] ?? PATHS.sparkle}</svg>`;

/** The tile at the start of a row: the row's picture (data/menus.js) where it has one, else the drawn icon. */
export function rowTile(label, ico = 'sparkle') {
  const info = menuInfo(label);
  return info ? `<span class="nr-icon emoji" aria-hidden="true">${info.emoji}</span>` : `<span class="nr-icon">${icon(ico)}</span>`;
}

/**
 * A row that opens another screen: picture, label, a line saying what it is for, chevron.
 * `attrs` is the data attribute(s) the screen's click handler listens for, e.g. 'data-top="tree"'.
 * A row that is not open to the player yet is shown greyed, with why in place of its line (`why`), and cannot be tapped.
 */
export function navRow({ attrs, label, sub = '', ico = 'sparkle', tone = '', disabled = false, why = '', extra = '', art = '', menu = null }) {
  // `menu`: the menu entry this row is, for its picture and line, when its label changes (a job title).
  const line = (disabled && why) || sub || menuInfo(menu ?? label)?.desc || '';
  return `<button class="nav-row${tone ? ` ${tone}` : ''}${disabled ? ' locked' : ''}" ${attrs} ${disabled ? 'disabled aria-disabled="true"' : ''}>
    ${art ? `<span class="nr-icon nr-art" aria-hidden="true">${art}</span>` : rowTile(menu ?? label, ico)}
    <span class="nr-main"><span class="nr-label">${esc(label)}</span>${line ? `<small>${esc(line)}</small>` : ''}${extra}</span>
    ${disabled ? '<span class="nr-lock" aria-hidden="true">🔒</span>' : icon('chevron', 'nr-chev')}
  </button>`;
}

/** A row for something not open yet, greyed with the reason: "From age 18". */
export const lockedRow = (label, why, ico) => navRow({ attrs: 'data-locked', label, disabled: true, why, ico });
/** "From age 18", or '' when the player is old enough. */
export const fromAge = (age, min) => (age < min ? `From age ${min}` : '');

/** A group of navigation rows on one card. */
export const navGroup = (rows, title = '') => (rows.length
  ? `${title ? `<div class="section-label">${esc(title)}</div>` : ''}<div class="nav-group">${rows.join('')}</div>` : '');

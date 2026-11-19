// Special memories: the occasional journal moment that deserves a scrapbook card.
// Drawn from what the life already records: milestones (state.player.milestones, with their kind) and a few
// journal lines that are firsts in anyone's life. Routine lines stay plain text; this only dresses the big ones.
import { esc } from '../util.js';

/** Small scrapbook pieces. Their own warm paper palette, so they read the same on light and dark pages. */
const ART = {
  // A notebook page with a doodled star: school.
  notebook: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="8" width="40" height="50" rx="4" fill="#FFF9F1" stroke="#C9B3DD" stroke-width="1.6" transform="rotate(-4 32 33)"/>
    <g transform="rotate(-4 32 33)" stroke="#D8C7E8" stroke-width="1.2"><path d="M18 22h28M18 30h28M18 38h28M18 46h20"/></g>
    <path d="M20 8v50" stroke="#F2A28A" stroke-width="1.4" transform="rotate(-4 32 33)"/>
    <path d="m40 14 2.4 5 5.4.6-4 3.7 1.1 5.3-4.9-2.7-4.8 2.7 1-5.3-4-3.7 5.4-.6z" fill="#FFB699" stroke="#B76E58" stroke-width="1"/></svg>`,
  // A certificate with a rosette: graduation, qualifications.
  certificate: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="12" width="52" height="38" rx="3" fill="#FFF9F1" stroke="#C9B3DD" stroke-width="1.6" transform="rotate(3 32 31)"/>
    <g transform="rotate(3 32 31)"><rect x="10" y="16" width="44" height="30" rx="2" fill="none" stroke="#E2D2EF" stroke-width="1.2"/>
    <path d="M18 24h28M20 30h24M24 36h16" stroke="#9C84B5" stroke-width="1.6" stroke-linecap="round"/></g>
    <circle cx="46" cy="44" r="7" fill="#FFB699" stroke="#B76E58" stroke-width="1.2"/><path d="m42 50-2 8 4-2 2 4 1-8M50 50l2 8-4-2-2 4" fill="#7956A0"/></svg>`,
  // A ticket stub: a first job, a debut, a big break.
  ticket: `<svg viewBox="0 0 64 64" aria-hidden="true"><g transform="rotate(-8 32 32)"><path d="M6 20h52v8a4 4 0 0 0 0 8v8H6v-8a4 4 0 0 0 0-8z" fill="#FFD9C8" stroke="#B76E58" stroke-width="1.4"/>
    <path d="M44 21v22" stroke="#B76E58" stroke-width="1.2" stroke-dasharray="2 2.5"/>
    <path d="M12 28h26M12 34h20" stroke="#7956A0" stroke-width="1.8" stroke-linecap="round"/><circle cx="51" cy="32" r="3" fill="#7956A0"/></g></svg>`,
  // A pinned photograph: people, family, friendship.
  photo: `<svg viewBox="0 0 64 64" aria-hidden="true"><g transform="rotate(5 32 32)"><rect x="12" y="8" width="40" height="48" rx="2" fill="#FFF9F1" stroke="#C9B3DD" stroke-width="1.4"/>
    <rect x="16" y="12" width="32" height="32" fill="#E7DBF5"/><circle cx="27" cy="27" r="5" fill="#FFB699"/><circle cx="38" cy="29" r="4.2" fill="#BA97DF"/>
    <path d="M18 44c2-7 6-10 9-10s6 3 8 7c1-3 3-5 5-5s5 3 6 8z" fill="#9C84B5"/></g><rect x="27" y="4" width="12" height="6" rx="1" fill="#F2C9B5" opacity=".9" transform="rotate(-6 33 7)"/></svg>`,
  // A sealed letter: love, marriage, the big promises.
  letter: `<svg viewBox="0 0 64 64" aria-hidden="true"><g transform="rotate(-5 32 32)"><rect x="8" y="16" width="48" height="34" rx="3" fill="#FFF9F1" stroke="#C9B3DD" stroke-width="1.6"/>
    <path d="m9 18 23 18 23-18" fill="none" stroke="#C9B3DD" stroke-width="1.6"/>
    <path d="M32 44c-5-3.6-8-6.2-8-9.2a4 4 0 0 1 8-1.3 4 4 0 0 1 8 1.3c0 3-3 5.6-8 9.2z" fill="#F38C93" stroke="#B4505C" stroke-width="1"/></g></svg>`,
  // A ribbon medal: awards, honors, the top of a profession.
  medal: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="m22 6 10 20 10-20h-7l-3 6-3-6z" fill="#BA97DF" stroke="#7956A0" stroke-width="1.2"/>
    <circle cx="32" cy="40" r="15" fill="#FFD27A" stroke="#B8862F" stroke-width="1.6"/><circle cx="32" cy="40" r="10" fill="none" stroke="#B8862F" stroke-width="1.2"/>
    <path d="m32 33 2 4.2 4.6.5-3.4 3.1 1 4.5-4.2-2.4-4.2 2.4 1-4.5-3.4-3.1 4.6-.5z" fill="#FFF3D6"/></svg>`,
  // A postcard with a stamp: moves, journeys, the times.
  postcard: `<svg viewBox="0 0 64 64" aria-hidden="true"><g transform="rotate(4 32 32)"><rect x="6" y="14" width="52" height="36" rx="3" fill="#FFF9F1" stroke="#C9B3DD" stroke-width="1.6"/>
    <path d="M34 20v24" stroke="#E2D2EF" stroke-width="1.2"/><path d="M38 32h14M38 38h12" stroke="#9C84B5" stroke-width="1.6" stroke-linecap="round"/>
    <rect x="44" y="18" width="10" height="10" fill="#FFB699" stroke="#B76E58" stroke-dasharray="1.5 1.2"/>
    <path d="M10 40c4-8 8-12 11-12s5 6 9 6" fill="none" stroke="#7956A0" stroke-width="1.8" stroke-linecap="round"/><circle cx="16" cy="22" r="3" fill="#FFD27A"/></g></svg>`,
  // A folded newspaper clipping: the headlines a life makes.
  clipping: `<svg viewBox="0 0 64 64" aria-hidden="true"><g transform="rotate(-3 32 32)"><path d="M10 10h44v44H10z" fill="#FFF9F1" stroke="#C9B3DD" stroke-width="1.6"/>
    <path d="M15 17h34" stroke="#5A4470" stroke-width="3.2"/><path d="M15 25h16M15 30h16M15 35h16M15 40h16M15 45h12" stroke="#B9A6CD" stroke-width="1.4"/>
    <rect x="35" y="24" width="14" height="14" fill="#E7DBF5"/></g></svg>`,
};

const KIND_ART = { education: 'certificate', career: 'ticket', fame: 'medal', family: 'letter', life: 'postcard', era: 'postcard', money: 'ticket', crime: 'clipping', digital: 'photo', personal: 'photo' };
const KIND_LABEL = { education: 'A milestone in learning', career: 'A working life', fame: 'In the spotlight', family: 'Family', life: 'A turning point', era: 'The times', money: 'A money milestone', crime: 'On the record', digital: 'Online', personal: 'Just for you' };

// Firsts and big days, recognized in a journal line. Each gives a card, its art and a small caption.
const LINES = [
  [/\b(first day (of|at) (school|kindergarten|nursery|preschool|primary|elementary)|started (school|kindergarten|primary school|elementary school))\b/i, 'notebook', 'First day of school'],
  [/\bhas become your best friend\b|\byour first (real )?friend\b|\bbecame (best )?friends\b/i, 'photo', 'A friendship'],
  [/\b(you graduated|graduated from|completed your (degree|apprenticeship|doctorate))\b/i, 'certificate', 'Graduation'],
  [/\b(fell in love|you are in love|said yes|you got engaged|you were married|you married|wedding day)\b/i, 'letter', 'Love'],
  [/\b(was born|were born)\b.*\b(your (son|daughter|child|twins|baby))|\byour (son|daughter|baby|twins)\b.*\b(was|were) born\b/i, 'photo', 'A new arrival'],
  [/\b(won|awarded|received) (the |an? )?(award|prize|medal|trophy|grand prize|title)\b/i, 'medal', 'An honor'],
];

/** The memory a journal line makes, if it is one of life's firsts or big days. */
export function lineMemory(entry) {
  if (!entry?.text || entry.tone === 'bad') return null;
  for (const [re, art, label] of LINES) if (re.test(entry.text)) return { art, label };
  return null;
}

/** The milestones of one age, in the order they happened, that are the player's to see. */
export function milestonesAt(p, age) {
  return (p.milestones ?? []).filter((m) => m.age === age && m.kind !== 'health' && (!m.private || m.shared));
}

/** A journal line, dressed as a memory card. */
export function lineMemoryHtml(entry, mem, extra = '') {
  return `<div class="memory${extra}" data-memory="${mem.art}">
    <div class="memory-art">${ART[mem.art]}</div>
    <div class="memory-body"><span class="memory-label">${esc(mem.label)}</span><p class="memory-text">${esc(entry.text)}</p></div>
  </div>`;
}

/** A milestone, as a memory card. */
export function milestoneHtml(m) {
  const art = KIND_ART[m.kind] ?? 'photo';
  return `<div class="memory milestone" data-memory="${art}">
    <div class="memory-art">${ART[art]}</div>
    <div class="memory-body"><span class="memory-label">${esc(KIND_LABEL[m.kind] ?? 'A memory')}</span><p class="memory-text">${esc(m.text)}</p></div>
  </div>`;
}

export const memoryArt = (name) => ART[name] ?? '';

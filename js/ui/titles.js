// Titles read in Title Case everywhere: card headings, screen and dialog titles, menu rows and section labels
// ("Your team" shows as "Your Team"). The words in the game's code stay as written; this changes only what is shown,
// so a section's key (ui/sections.js) and anything matched by its name are unaffected.

/** Short words left in lower case inside a title, unless they start or end it. */
const SMALL = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'as', 'at', 'by', 'in', 'of', 'on',
  'to', 'up', 'via', 'vs', 'vs.', 'per', 'from', 'with', 'into', 'onto', 'off', 'over', 'out']);

const upFirst = (w) => w.replace(/^([^\p{L}]*)(\p{Ll})/u, (_, pre, c) => pre + c.toUpperCase());

/** "your team in the league" → "Your Team in the League". Words already holding a capital (K-pop, iPhone, BBC) are kept. */
export function titleCase(text) {
  const parts = String(text ?? '').split(/(\s+)/);
  const words = parts.map((p, i) => (i % 2 ? null : p)).filter((p) => p && /\p{L}/u.test(p));
  const first = words[0];
  const last = words.at(-1);
  let afterBreak = false;
  return parts.map((p, i) => {
    if (i % 2 || !p) return p;
    const out = (() => {
      if (/^[@#]|https?:|\d/.test(p)) return p; // handles, tags, links and numbers as written
      const bare = p.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}.]+$/gu, '');
      const keepSmall = SMALL.has(bare) && p !== first && p !== last && !afterBreak;
      if (keepSmall) return p;
      // Each part of a hyphenated word: Part-Time, Jiu-Jitsu. A word with a capital inside is left alone, and so is
      // one that starts with a single capital letter: K-pop, T-shirt, X-ray.
      if (/^[^\p{L}]*\p{Lu}-/u.test(p)) return p;
      return p.split('-').map((seg) => (/\p{Lu}/u.test(seg.slice(1)) ? seg : upFirst(seg))).join('-');
    })();
    afterBreak = /[:—–]$/.test(p) || /^[—–]$/.test(p);
    return out;
  }).join('');
}

const SELECTOR = 'h1, h2, h3, h4, .nr-label, .section-label, .tab-label, .sec-title, .sub-head, .dyn-head, .world-head, .panel-head, .gl-head, .season-head, .mm-head';
/** An option named after something: "Join: Dance classes" shows the name in Title Case, "Join: Dance Classes". */
const NAMED = '.choice-btn';

function fix(el) {
  // A heading that is a whole sentence ("You have come down with flu.") stays one.
  if (/[.…]\s*$/.test(el.textContent) && !/\b(vs|St|Jr|Dr|Mr|Mrs|Ms)\.\s*$/.test(el.textContent)) return;
  // Only the heading's own words: text inside a badge, a number or an input in it is left alone.
  for (const node of el.childNodes) {
    if (node.nodeType !== 3 || !/\p{Ll}/u.test(node.nodeValue)) continue;
    const next = titleCase(node.nodeValue);
    if (next !== node.nodeValue) node.nodeValue = next;
  }
  for (const child of el.children) if (/^(SPAN|B|STRONG|EM|I)$/.test(child.tagName) && !child.matches('.badge, .pill, .num, [data-raw]')) fix(child);
}

function fixNamed(el) {
  const node = [...el.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());
  const m = node?.nodeValue.match(/^(\s*[\p{L} ]{2,16}: )(.+?)(\s*)$/u);
  if (m) { const next = m[1] + titleCase(m[2]) + m[3]; if (next !== node.nodeValue) node.nodeValue = next; }
}

function sweep(root) {
  if (root.nodeType !== 1) return;
  if (root.matches(NAMED)) fixNamed(root);
  root.querySelectorAll(NAMED).forEach(fixNamed);
  if (root.matches(SELECTOR)) fix(root);
  else { const h = root.closest?.(SELECTOR); if (h) fix(h); }
  root.querySelectorAll(SELECTOR).forEach(fix);
}

let watching = false;
/** Keeps every title on the page in Title Case, now and whenever something new is drawn. */
export function watchTitles(root = globalThis.document?.body) {
  if (watching || !root || typeof MutationObserver === 'undefined') return;
  watching = true;
  sweep(root);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'childList') {
        if (m.target.nodeType === 1 && m.target.closest?.(SELECTOR)) fix(m.target.closest(SELECTOR));
        m.addedNodes.forEach(sweep);
      }
    }
  }).observe(root, { childList: true, subtree: true });
}

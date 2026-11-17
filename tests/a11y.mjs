// Accessibility checks that need no browser: zoom, colour contrast, dialogs, landmarks.
// The full audit (axe-core in a browser, and a keyboard-only playthrough) is described in docs/ACCESSIBILITY.md.
// Run with: node tests/a11y.mjs
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };

// 1. Pinch-zoom is never disabled.
const html = read('index.html');
const viewport = html.match(/<meta name="viewport" content="([^"]+)"/)?.[1] ?? '';
check(viewport && !/user-scalable\s*=\s*(no|0)/.test(viewport) && !/maximum-scale\s*=\s*1(\.0)?\b/.test(viewport), `the viewport stops people zooming: ${viewport}`);
check(/<html lang="[a-z]{2}/.test(html), 'the page declares its language');
section('zoom: allowed, and the page language is declared');

// 2. Colour contrast of the theme, in both light and dark (WCAG 2.1 AA: 4.5:1 for text).
const css = read('css/base.css');
const block = (src) => Object.fromEntries([...src.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const light = block(css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)')));
const darkSrc = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
const dark = { ...light, ...block(darkSrc.slice(0, darkSrc.indexOf('}\n}') + 3)) };
const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const worst = [];
for (const [name, t] of [['light', light], ['dark', dark]]) {
  for (const fg of ['ink', 'muted']) for (const bg of ['paper', 'card']) {
    const r = ratio(t[fg], t[bg]);
    worst.push(r);
    check(r >= 4.5, `${name} theme: --${fg} on --${bg} is ${r.toFixed(2)}:1, below 4.5:1`);
  }
  check(ratio(t['accent-ink'], t.accent) >= 4.5, `${name} theme: button text on the accent colour is ${ratio(t['accent-ink'], t.accent).toFixed(2)}:1`);
}
section(`contrast: text meets WCAG AA in both themes (lowest ${Math.min(...worst).toFixed(2)}:1)`);

// 3. Dialogs: named, focused on open, focus returned on close, Escape closes the dismissable ones.
const modals = read('js/ui/modals.js');
check(/role="dialog" aria-modal="true"/.test(modals), 'dialogs are marked as modal dialogs');
check(/nameDialog\(card\)/.test(modals) && /aria-labelledby/.test(modals), 'every dialog is given an accessible name');
check(/\.focus\(\{ preventScroll: true \}\)/.test(modals) && /_returnTo/.test(modals), 'focus moves into a dialog and back out of it');
check(/'Escape'/.test(modals), 'Escape closes a dismissable dialog');
for (const f of ['js/ui/screens/title.js']) for (const m of read(f).matchAll(/role="dialog"[^>]*>/g)) check(/aria-label(ledby)?=/.test(m[0]), `${f}: a hand-built dialog has no name`);
section('dialogs: named, focus managed, Escape works');

// 4. Landmarks: each full screen is a <main>; the game has one <main>, a keyboard-reachable journal and a labelled nav.
for (const f of ['js/ui/screens/title.js', 'js/ui/screens/creator.js', 'js/ui/screens/obituary.js']) check(/app\.innerHTML = `\s*<main/.test(read(f)), `${f}: the screen is not a <main> landmark`);
const shell = read('js/ui/shell.js');
check((shell.match(/<main\b/g) ?? []).length === 1, 'the game screen has exactly one <main>');
check(/data-journal role="log"[^>]*tabindex="0"/.test(shell), 'the journal is a log reachable by keyboard');
check(/<nav aria-label=/.test(shell), 'the tab bar is a labelled navigation landmark');
check(/aria-labelledby="panel-title"/.test(shell), 'the open panel is a named region');
check(/keepFocus/.test(shell), 'focus returns to the age-up button after a year');
section('landmarks: one main per screen, a labelled navigation, a keyboard-reachable journal');

// 5. Motion: animations respect the reduced-motion setting.
const layout = read('css/layout.css') + read('css/components.css');
check(/prefers-reduced-motion: reduce/.test(layout), 'animations ignore the reduced-motion setting');
section('motion: reduced-motion is respected');

if (problems.length) { console.log('PROBLEMS:'); for (const p of problems) console.log(' -', p); process.exit(1); }
for (const m of ok) console.log('ok  ', m);
console.log('Accessible by the checks that run here.');

// From Birth: the brand assets are the supplied artwork, the default icon is Afterglow, the app-icon choice is kept
// apart from the theme, and data kept under the old Pathways name is carried over, never lost.
//   node tests/branding.mjs
import { readFileSync, existsSync } from 'node:fs';
const mem = new Map();
const store = (m = new Map()) => ({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i], get length() { return m.size; }, _m: m });
globalThis.localStorage = store(mem);
globalThis.sessionStorage = store();

const problems = [];
const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const section = (m) => { if (!problems.length) ok.push(m); };
const root = new URL('..', import.meta.url).pathname;
const png = (f) => { const b = readFileSync(root + f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), sig: b.slice(1, 4).toString() }; };

// 1. The assets: the supplied files, and the sizes made from them.
for (const f of ['from_birth_logo.png', 'icon_afterglow.png', 'icon_midnight.png', 'icon_daydream.png']) check(existsSync(`${root}assets/branding/${f}`) && png(`assets/branding/${f}`).sig === 'PNG', `assets/branding/${f} is there`);
check(png('assets/branding/from_birth_logo-640.png').w === 640, 'the landing logo has a sharp sized copy');
for (const id of ['afterglow', 'midnight', 'daydream']) for (const s of [32, 180, 192, 256, 512, 1024]) { const i = png(`icons/icon-${id}-${s}.png`); check(i.w === s && i.h === s, `icons/icon-${id}-${s}.png is ${s}x${s}`); }
const mf = JSON.parse(readFileSync(`${root}manifest.json`, 'utf8'));
check(mf.name === 'From Birth' && mf.short_name === 'From Birth', 'the manifest is From Birth');
check(mf.icons.every((i) => existsSync(root + i.src.replace('./', '')) && png(i.src.replace('./', '')).w === Number(i.sizes.split('x')[0])), 'every manifest icon exists at its stated size');
const html = readFileSync(`${root}index.html`, 'utf8');
check(/<title>From Birth<\/title>/.test(html) && /apple-mobile-web-app-title" content="From Birth"/.test(html) && /og:title" content="From Birth"/.test(html), 'the page, the home-screen title and sharing say From Birth');
check(/apple-touch-icon" sizes="180x180" href="\.\/icons\/apple-touch-icon\.png"/.test(html) && /favicon-32\.png/.test(html), 'the install and tab icons are Afterglow');
// Afterglow is the default install icon: the files the manifest and the page use are Afterglow's.
check(readFileSync(`${root}icons/icon-192.png`).equals(readFileSync(`${root}icons/icon-afterglow-192.png`)) && readFileSync(`${root}icons/apple-touch-icon.png`).equals(readFileSync(`${root}icons/icon-afterglow-180.png`)), 'the default installed icon is Afterglow');
check(/og:image" content="https:\/\/softghcst\.github\.io\/frombirth\/icons\/icon-afterglow-1024\.png"/.test(html) && /og:url" content="https:\/\/softghcst\.github\.io\/frombirth\/"/.test(html), 'link previews use the site\'s full address');
section('the supplied artwork, sized copies, and Afterglow as the installed icon');

// 2. The choice: Afterglow by default, kept apart from the theme, restorable.
globalThis.document = { documentElement: { setAttribute() {}, removeAttribute() {} }, querySelector: () => null };
const ic = await import('../js/appIcon.js');
const theme = await import('../js/theme.js');
check(ic.getAppIcon() === 'afterglow', 'Afterglow is chosen by default');
check(ic.setAppIcon('midnight') && ic.getAppIcon() === 'midnight' && mem.get('frombirth.appIcon') === 'midnight', 'Midnight can be chosen, and is kept');
check(!ic.setAppIcon('neon') && ic.getAppIcon() === 'midnight', 'an unknown icon is refused');
theme.setTheme('dark'); theme.setTheme('light');
check(ic.getAppIcon() === 'midnight', 'changing the theme does not change the icon');
check(ic.setAppIcon('daydream') && ic.getAppIcon() === 'daydream', 'Daydream can be chosen');
ic.restoreDefaultIcon();
check(ic.getAppIcon() === 'afterglow' && !mem.has('frombirth.appIcon'), 'restoring the default goes back to Afterglow');
const pf = await import('../js/platform/appIcon.js');
check(pf.iconSupport() === 'web' && !pf.applyAppIcon('midnight').changedInstalled && /home screen/.test(pf.applyAppIcon('midnight').note), 'on the web, it says plainly that an installed icon cannot change');
globalThis.window = { FromBirthNative: { setAlternateIcon: (x) => { globalThis.nativeIcon = x; } } };
check(pf.iconSupport() === 'native' && pf.applyAppIcon('daydream').changedInstalled && globalThis.nativeIcon === 'daydream' && (pf.applyAppIcon('afterglow'), globalThis.nativeIcon === null), 'a native build changes the installed icon through its own call');
delete globalThis.window;
section('the app icon: Afterglow by default, apart from the theme, restorable, honest about the platform');

// 3. Old Pathways data is carried over, never lost; running it again changes nothing.
const save = await import('../js/save.js');
mem.clear();
mem.set('pathways.index', JSON.stringify([{ slotId: 'a', updatedAt: 1 }]));
mem.set('pathways.slot.a', '{"slot":"a"}');
mem.set('pathways.graveyard', JSON.stringify([{ id: 'g1' }]));
mem.set('pathways.theme', 'dark');
mem.set('frombirth.index', JSON.stringify([{ slotId: 'b', updatedAt: 2 }]));
mem.set('frombirth.graveyard', JSON.stringify([{ id: 'g2' }]));
const n = save.carryOldName([localStorage]);
check(n === 4 && ![...mem.keys()].some((k) => k.startsWith('pathways.')), `old keys carried over and then cleared (${n})`);
check(mem.get('frombirth.slot.a') === '{"slot":"a"}' && mem.get('frombirth.theme') === 'dark', 'a saved life and a setting keep their data');
check(JSON.parse(mem.get('frombirth.index')).map((x) => x.slotId).sort().join() === 'a,b' && JSON.parse(mem.get('frombirth.graveyard')).length === 2, 'lists of lives and graves are merged, not overwritten');
const snap = JSON.stringify([...mem]);
check(save.carryOldName([localStorage]) === 0 && JSON.stringify([...mem]) === snap, 'running it again changes nothing');
const lives = save.listSlots().map((x) => x.slotId).sort().join();
check(lives === 'a,b', `both lives are listed (${lives})`);
// A full storage keeps the old key, to try again later.
const full = store(new Map([['pathways.slot.z', 'x']]));
full.setItem = () => { throw new Error('full'); };
save.carryOldName([full]);
check(full.getItem('pathways.slot.z') === 'x', 'if the new key cannot be written, the old data stays');
section('old Pathways data is carried over, merged, and never lost');

for (const m of ok) console.log(`ok   ${m}`);
if (problems.length) { console.log(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('From Birth, from the first screen.');

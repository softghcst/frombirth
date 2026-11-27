// Makes www/: the files the iOS (and later Android) app ships, copied from the game exactly as the website serves
// them. Nothing in the game is rewritten except index.html's font link, which points at the fonts kept in the app
// (mobile/fonts/, from scripts/vendor-fonts.mjs) so the app needs no connection to draw its text.
//
// The website (GitHub Pages, the repository root) is untouched by this. www/ is never committed: make it again with
//   npm run build:app          (this script, then `npx cap sync`)
//   node scripts/build-app.mjs  (this script only)
//
// What goes in is a list of what the game loads while it runs (INCLUDE). Development tools, the art pipeline's
// sources, prompts, tests, docs and scripts stay out (checked by checkApp below, and by tests/app-build.mjs).
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, extname, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** What the running game loads, relative to the repository root. Folders are copied whole, minus EXCLUDE. */
export const INCLUDE = [
  'index.html',
  'privacy.html',
  'manifest.json',
  'css',
  'js',
  'icons',
  'assets/avatars',
  'assets/heads',
  'assets/hair_fitted',
  'assets/hair_manifest.json',
  'assets/clothes_fit',
  'assets/postcards',
  // Branding: only the sizes the game shows. The full-size PNG masters (several MB each) are artwork sources.
  'assets/branding/from_birth_logo-640.png',
  ...['afterglow', 'midnight', 'daydream'].flatMap((x) => [`assets/branding/hero_${x}.webp`, `assets/branding/hero_${x}-thumb.webp`]),
];

/** Never shipped, wherever it turns up (paths relative to the repository root, or to www/). */
export const EXCLUDE = [
  /(^|\/)\./, // dotfiles: .gitkeep, .DS_Store, .env…
  /(^|\/)source\//, // artwork sources (assets/avatars/crowns/source/…)
  /\.(md|py|pyc|txt|sql|log|map|ts)$/i,
  /^js\/avatar\/lab\.js$/, // the avatar lab, a development page (avatar-lab.html)
  /(^|\/)node_modules\//,
];

/** Anything here in www/ means something private or development-only slipped in. */
export const FORBIDDEN = [
  /(^|\/)\.(env|git|github|claude)/, /(^|\/)node_modules\//, /(^|\/)(tests|scripts|docs|ios|android|mobile)\//,
  /^avatar-lab\.html$/, /^sw\.js$/, /^package(-lock)?\.json$/, /^capacitor\.config\./, /^README|^CREDITS/,
  /CHATGPT_.*PROMPT/, /hair_raw\//, /hair_png\//, /eyes_png\//, /clothes_templates\//, /raw_batch/, /landmarks\.json$/,
  /\.(md|py|sql|txt|pem|key|p12|p8|mobileprovision|keystore|jks)$/i, /service[_-]?role/i,
];

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const rel = (base, p) => relative(base, p).split('\\').join('/');

/**
 * Builds www/ (or `out`). @returns {{files:number, bytes:number}}
 */
export function buildApp(out = join(root, 'www')) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  let files = 0; let bytes = 0;
  for (const item of INCLUDE) {
    const from = join(root, item);
    if (!existsSync(from)) throw new Error(`build-app: ${item} is listed in INCLUDE but does not exist`);
    for (const f of statSync(from).isDirectory() ? walk(from) : [from]) {
      const r = rel(root, f);
      if (EXCLUDE.some((re) => re.test(r))) continue;
      cpSync(f, join(out, r));
      files += 1; bytes += statSync(f).size;
    }
  }
  // The fonts, kept in the app.
  const fonts = join(root, 'mobile/fonts');
  for (const f of readdirSync(fonts).filter((n) => /\.(woff2?|css)$/.test(n))) { cpSync(join(fonts, f), join(out, 'fonts', f)); files += 1; bytes += statSync(join(fonts, f)).size; }
  // index.html: the same page, with the fonts from the app instead of Google.
  const indexPath = join(out, 'index.html');
  let html = readFileSync(indexPath, 'utf8');
  const before = html;
  html = html.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.g(oogleapis|static)\.com"[^>]*>/g, '');
  html = html.replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2[^"]*">/, '<link rel="stylesheet" href="./fonts/fonts.css">');
  if (html === before || /fonts\.googleapis\.com/.test(html)) throw new Error('build-app: could not swap the Google Fonts link in index.html for the local fonts');
  writeFileSync(indexPath, html);
  // Which copy of the game this is, for support and bug reports (Settings can show it later).
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a git checkout */ }
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  writeFileSync(join(out, 'build-info.json'), `${JSON.stringify({ app: 'From Birth', version: pkg.version ?? '0.0.0', commit }, null, 2)}\n`);
  files += 1;
  const problems = checkApp(out);
  if (problems.length) throw new Error(`build-app: www/ is not right:\n  ${problems.join('\n  ')}`);
  return { files, bytes };
}

/** Static import specifiers in a module's source: `import … from '…'`, `export … from '…'`, `import('…')`. */
export const importsOf = (src) => [...src.matchAll(/(?:^|[;\s])(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm)]
  .map((m) => m[1] ?? m[2] ?? m[3]);

/**
 * Checks a built www/: nothing forbidden in it, and every module import and every local file named in the HTML and
 * CSS resolves to a file that is there. @returns {string[]} problems (none when all is well)
 */
export function checkApp(out = join(root, 'www')) {
  const problems = [];
  const all = walk(out).map((f) => rel(out, f));
  const have = new Set(all);
  for (const f of all) if (FORBIDDEN.some((re) => re.test(f))) problems.push(`should not be shipped: ${f}`);
  const resolve = (from, spec) => { const p = rel(out, join(out, dirname(from), spec.split(/[?#]/)[0])); return p === '' || spec.endsWith('/') ? `${p ? `${p}/` : ''}index.html` : p; };
  for (const f of all.filter((x) => x.endsWith('.js'))) {
    for (const spec of importsOf(readFileSync(join(out, f), 'utf8'))) {
      if (spec.startsWith('node:')) continue; // only reached when the game is run by Node, for the tests (avatar/fittedHair.js)
      if (!spec.startsWith('.')) { problems.push(`${f}: imports "${spec}", which is not a local file`); continue; }
      if (!have.has(resolve(f, spec))) problems.push(`${f}: imports "${spec}", which is missing`);
    }
  }
  for (const f of all.filter((x) => /\.(html|css)$/.test(x))) {
    const src = readFileSync(join(out, f), 'utf8');
    const refs = [...src.matchAll(/(?:src|href)="([^"]+)"|url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1] ?? m[2]);
    for (const r of refs) {
      if (/^(https?:|data:|mailto:|#|about:|javascript:)/.test(r) || r.includes('${') || r.includes('var(')) continue;
      if (!have.has(resolve(f, r))) problems.push(`${f}: refers to "${r}", which is missing`);
    }
    if (f === 'index.html' && /fonts\.(googleapis|gstatic)\.com/.test(src)) problems.push('index.html still loads fonts from Google');
  }
  return problems;
}

if (process.argv[1] && basename(process.argv[1]) === basename(fileURLToPath(import.meta.url))) {
  const { files, bytes } = buildApp(process.argv[2] ? join(process.cwd(), process.argv[2]) : undefined);
  console.log(`www/: ${files} files, ${(bytes / 1048576).toFixed(1)} MB`);
}

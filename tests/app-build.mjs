// The app's files (scripts/build-app.mjs → www/) and the iOS project: everything the game loads is there and resolves,
// nothing private or development-only is shipped, the fonts are the app's own, and the native settings are the ones
// decided on (name, bundle id, portrait iPhone, iOS 16.4, privacy manifest). Run with: node tests/app-build.mjs
import { mkdtempSync, readFileSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildApp, checkApp, INCLUDE, FORBIDDEN } from '../scripts/build-app.mjs';

const root = new URL('..', import.meta.url).pathname;
const problems = []; const ok = [];
const check = (c, m) => { if (!c) problems.push(m); };
const section = (m, n) => ok.push(problems.length === n ? m : `(failed) ${m}`);
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)).map((x) => `${n}/${x}`) : [n]));

const out = mkdtempSync(join(tmpdir(), 'frombirth-www-'));
try {
  // 1. It builds, twice the same.
  {
    const n = problems.length;
    const { files, bytes } = buildApp(out);
    check(files > 1000 && bytes > 10e6, `www/ holds the game (${files} files, ${(bytes / 1048576).toFixed(1)} MB)`);
    const first = walk(out).sort();
    buildApp(out);
    check(JSON.stringify(walk(out).sort()) === JSON.stringify(first), 'building again gives the same files');
    check(checkApp(out).length === 0, `every import and local file resolves: ${checkApp(out).slice(0, 5).join('; ')}`);
    section(`www/ is built from the game (${files} files)`, n);
  }
  const files = walk(out);
  const has = new Set(files);

  // 2. Everything the game loads is there.
  {
    const n = problems.length;
    for (const item of INCLUDE) check(has.has(item) || files.some((f) => f.startsWith(`${item}/`)), `${item} is in www/`);
    const jsHere = walk(join(root, 'js')).filter((f) => f !== 'avatar/lab.js');
    check(jsHere.every((f) => has.has(`js/${f}`)), 'every module of the game is in www/');
    const { PART_BY_ID } = await import(join(out, 'js/avatarManifest.js'));
    const partFiles = Object.values(PART_BY_ID).map((p) => p.file).filter(Boolean);
    check(partFiles.length > 100 && partFiles.every((f) => has.has(`assets/${f}`)), `every avatar part file is in www/ (${partFiles.filter((f) => !has.has(`assets/${f}`)).slice(0, 3).join(', ')})`);
    const hair = JSON.parse(readFileSync(join(out, 'assets/hair_manifest.json'), 'utf8'));
    const hairFiles = hair.hairstyles.flatMap((h) => h.heads.map((head) => `assets/hair_fitted/${h.id}_${head}.svg`));
    const missingHair = hairFiles.filter((f) => !has.has(f));
    check(missingHair.length === 0, `every fitted hairstyle is in www/ (${missingHair.length} missing, e.g. ${missingHair.slice(0, 2).join(', ')})`);
    // Local files named as plain strings in the code (logo, scenery, postcards…).
    const named = new Set();
    for (const f of files.filter((x) => x.endsWith('.js'))) {
      for (const m of readFileSync(join(out, f), 'utf8').matchAll(/['"`]\.\/((?:assets|icons|css)\/[A-Za-z0-9_\-./]+\.(?:png|webp|svg|json|css))['"`]/g)) named.add(m[1]);
    }
    const missingNamed = [...named].filter((x) => !has.has(x));
    check(named.size > 5 && missingNamed.length === 0, `every file named in the code is in www/ (${missingNamed.join(', ')})`);
    const postcards = files.filter((f) => f.startsWith('assets/postcards/')).length;
    check(postcards === readdirSync(join(root, 'assets/postcards')).length, 'all the postcards are there');
    section('everything the game loads is in www/', n);
  }

  // 3. Nothing private or development-only.
  {
    const n = problems.length;
    const bad = files.filter((f) => FORBIDDEN.some((re) => re.test(f)));
    check(bad.length === 0, `nothing forbidden is shipped (${bad.slice(0, 5).join(', ')})`);
    for (const f of ['sw.js', 'avatar-lab.html', 'js/avatar/lab.js', 'package.json', 'README.md', 'assets/hair_raw', 'assets/CHATGPT_HAIR_PROMPT.md', 'assets/branding/hero_afterglow.png', 'tests', 'scripts', 'docs', 'ios', 'node_modules']) {
      check(!has.has(f) && !files.some((x) => x.startsWith(`${f}/`)), `${f} is not shipped`);
    }
    check(!files.some((f) => /(^|\/)\./.test(f)), 'no hidden files are shipped');
    // The cloud key in js/sync/config.js is the public ("anon"/"publishable") one, meant for web pages; never the secret one.
    const cfg = readFileSync(join(out, 'js/sync/config.js'), 'utf8');
    const jwt = cfg.match(/key:\s*'([^']+)'/)?.[1] ?? '';
    let role = '';
    try { role = jwt.startsWith('sb_') ? (jwt.startsWith('sb_publishable_') ? 'anon' : 'secret') : JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).role; } catch { role = 'unreadable'; }
    check(!jwt || role === 'anon', `the cloud key shipped is the public one (role: ${role})`);
    for (const f of files.filter((x) => /\.(js|json|html)$/.test(x))) {
      const src = readFileSync(join(out, f), 'utf8');
      if (/service_role|sb_secret_|BEGIN (RSA |EC )?PRIVATE KEY/.test(src)) problems.push(`${f} holds what looks like a secret`);
    }
    section('nothing private or development-only is shipped', n);
  }

  // 4. The fonts are the app's own; nothing is loaded from outside.
  {
    const n = problems.length;
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    check(html.includes('href="./fonts/fonts.css"') && !/fonts\.(googleapis|gstatic)\.com/.test(html), 'index.html uses the fonts in the app');
    const css = readFileSync(join(out, 'fonts/fonts.css'), 'utf8');
    const fontFiles = [...css.matchAll(/url\(\.\/([^)]+)\)/g)].map((m) => m[1]);
    check(fontFiles.length > 20 && fontFiles.every((f) => has.has(`fonts/${f}`)), 'every font face has its file');
    for (const fam of ['Nunito Sans', 'Fraunces', 'Nunito', 'Caveat', 'Great Vibes', 'Lobster', 'Sacramento', 'Abril Fatface', 'Bebas Neue', 'Playfair Display', 'Montserrat']) check(css.includes(`'${fam}'`), `${fam} is in the app`);
    const web = readFileSync(join(root, 'index.html'), 'utf8');
    check(/fonts\.googleapis\.com/.test(web), 'the website itself still loads its fonts from Google (unchanged)');
    const info = JSON.parse(readFileSync(join(out, 'build-info.json'), 'utf8'));
    check(info.app === 'From Birth' && info.version && info.commit, 'build-info.json says which copy of the game this is');
    section('the app carries its own fonts', n);
  }

  // 5. The Capacitor and iOS settings.
  {
    const n = problems.length;
    const cap = JSON.parse(readFileSync(join(root, 'capacitor.config.json'), 'utf8'));
    check(cap.appName === 'From Birth' && cap.webDir === 'www' && /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(cap.appId), `Capacitor: From Birth, www/, a valid id (${cap.appId})`);
    // The origin the saves live under: changing it after release would leave every player's saves behind.
    check(cap.server?.iosScheme === 'capacitor' && cap.server?.hostname === 'localhost', 'the app\'s origin is pinned (capacitor://localhost), so saves survive updates');
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const capv = pkg.dependencies?.['@capacitor/core'];
    check(capv && pkg.dependencies['@capacitor/ios'] === capv && pkg.devDependencies?.['@capacitor/cli'] === capv, `core, ios and cli are the same version (${capv})`);
    const extra = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((d) => !d.startsWith('@capacitor/'));
    check(extra.length === 0, `no other packages (no ads, analytics or purchases): ${extra.join(', ')}`);
    if (existsSync(join(root, 'ios'))) {
      const plist = readFileSync(join(root, 'ios/App/App/Info.plist'), 'utf8');
      const iphone = plist.match(/<key>UISupportedInterfaceOrientations<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1] ?? '';
      check(/Portrait/.test(iphone) && !/Landscape/.test(iphone), 'iPhone is portrait only');
      check(/<key>CFBundleDisplayName<\/key>\s*<string>From Birth<\/string>/.test(plist), 'the home screen name is From Birth');
      const pbx = readFileSync(join(root, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
      const targets = [...pbx.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([\d.]+);/g)].map((m) => m[1]);
      check(targets.length && targets.every((t) => t === '16.4'), `minimum iOS 16.4 everywhere (${[...new Set(targets)]})`);
      check([...pbx.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].every((m) => m[1] === cap.appId), 'the Xcode bundle id matches capacitor.config.json');
      check(/PrivacyInfo\.xcprivacy in Resources/.test(pbx) && !/= undefined;/.test(pbx), 'the privacy manifest is in the app target');
      const privacy = readFileSync(join(root, 'ios/App/App/PrivacyInfo.xcprivacy'), 'utf8');
      check(/<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(privacy) && /NSPrivacyAccessedAPICategoryFileTimestamp/.test(privacy), 'the privacy manifest: no tracking, file timestamps declared');
      const spm = readFileSync(join(root, 'ios/App/CapApp-SPM/Package.swift'), 'utf8');
      check(spm.includes(`exact: "${capv}"`), 'the iOS project uses the same Capacitor version');
      for (const p of ['app', 'filesystem', 'haptics', 'share', 'status-bar', 'keyboard']) check(spm.includes(`node_modules/@capacitor/${p}`), `the ${p} plugin is in the iOS project`);
    } else problems.push('ios/ is missing');
    section('Capacitor and the iOS project are set up as decided', n);
  }
} finally {
  rmSync(out, { recursive: true, force: true });
}

for (const line of ok) console.log(line);
if (problems.length) { console.log(`\n${problems.length} problem(s):`); for (const p of problems) console.log(` - ${p}`); process.exit(1); }
console.log('\nThe app is built from the game, whole and nothing more.');

// A shareable picture of a finished life: the gravestone, the face, the epitaph and a few facts, drawn
// on a canvas as a 1080×1350 PNG (the 4:5 shape social feeds show whole). Shared through the system
// share sheet where the browser offers one, and otherwise downloaded; a short text goes with it.
import { COUNTRIES } from '../data/countries.js';
import { EPITAPH_BY_ID } from '../data/epitaphs.js';
import { fmtMoney, theCountry } from '../util.js';
import { avatarSvg } from '../avatar/render.js';

export const CARD = { width: 1080, height: 1350 };
const INK = '#30233F', MUTED = '#66567A', ACCENT = '#6A4892', PAPER = '#F1EBFA', STONE = '#E7DBF5', LINE = '#CBB8DF', PLUM = '#7956A0';
const SERIF = '"Fraunces", Georgia, serif', SANS = '"Nunito Sans", "Helvetica Neue", Arial, sans-serif';

// The milestones worth putting on a gravestone, most telling first.
const NOTABLE = [/president|prime minister|chancellor|king|queen|crowned|monarch|throne/i, /elected|governor|mayor|senator|minister|parliament|congress/i,
  /nobel|olympic|world champion|oscar|grammy|famous|celebrity|best-?sell/i, /billion|million/i, /citizen|emigrat|moved to|settled in/i,
  /founded|started a business|ceo/i, /graduated|degree|doctorate/i, /prison|convicted|sentenced|escaped/i, /married/i];

/** The link to the game: where it is served from, without "index.html". */
export const gameUrl = () => (typeof location === 'undefined' ? '' : `${location.origin}${location.pathname.replace(/index\.html$/, '')}`);

/** What goes on the card, worked out from a grave entry. Pure: no drawing. */
export function cardFacts(g) {
  const c = COUNTRIES[g.countryId];
  const epitaph = EPITAPH_BY_ID[(g.epitaphIds ?? [])[0]] ?? null;
  const ranked = (g.milestones ?? []).map((m, i) => ({ ...m, rank: NOTABLE.findIndex((re) => re.test(m.text)), i }))
    .filter((m) => m.rank >= 0).sort((a, b) => a.rank - b.rank || a.i - b.i);
  const highlights = [...new Map(ranked.map((m) => [m.text, m])).values()].slice(0, 2).sort((a, b) => a.age - b.age).map((m) => `Age ${m.age} · ${m.text}`);
  const family = [g.spouseName ? 'married' : null, g.childrenCount ? `${g.childrenCount} ${g.childrenCount === 1 ? 'child' : 'children'}` : null,
    g.grandchildrenCount ? `${g.grandchildrenCount} ${g.grandchildrenCount === 1 ? 'grandchild' : 'grandchildren'}` : null].filter(Boolean);
  const lived = g.counters?.countriesLived ?? 1;
  return {
    name: g.fullName,
    years: `${g.birthYear} – ${g.deathYear}`,
    epitaph: epitaph ? { title: epitaph.title, line: epitaph.line } : null,
    cause: `Died of ${g.causeOfDeath}, aged ${g.ageAtDeath}.`,
    facts: [
      ['Home', `${g.city}, ${c ? theCountry(c.name) : ''}`.replace(/, $/, '')],
      ['Work', g.lastOccupation || 'None'],
      ['Net worth', c ? fmtMoney(g.netWorth, c) : String(g.netWorth)],
      [lived > 1 ? 'Lived in' : 'Family', lived > 1 ? `${lived} countries` : family.length ? family.join(', ') : 'None'],
    ],
    highlights,
  };
}

/** The words that go with the picture. */
export function shareText(g, url = gameUrl()) {
  const f = cardFacts(g);
  const where = f.facts[0][1];
  return [`${f.name} (${f.years})${f.epitaph ? `: ${f.epitaph.title}` : ''}.`, `${f.cause.replace(/\.$/, '')} in ${where}.`,
    ...(f.highlights[0] ? [f.highlights[0].replace(/^Age (\d+) · /, 'At $1: ')] : []), `A life lived in Pathways${url ? `: ${url}` : '.'}`].join(' ');
}

// ---------- The portrait, made drawable ----------

/**
 * The portrait SVG uses <use href="./assets/...svg#id"> for its parts, which an image on a canvas cannot load.
 * This fetches each file once, prefixes its ids so files cannot collide, and puts it inside the SVG's own defs.
 */
export async function selfContained(svg, fetchText = (u) => fetch(u).then((r) => (r.ok ? r.text() : ''))) {
  const files = [...new Set([...svg.matchAll(/href="([^"#]+)#[^"]*"/g)].map((m) => m[1]))];
  const parts = await Promise.all(files.map(async (file, n) => {
    const text = await fetchText(file).catch(() => '');
    const inner = text.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const p = `f${n}_`;
    return { file, p, body: inner.replace(/\bid="([^"]+)"/g, `id="${p}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`).replace(/(xlink:)?href="#([^"]+)"/g, `href="#${p}$2"`) };
  }));
  let out = svg;
  for (const { file, p } of parts) out = out.split(`href="${file}#`).join(`href="#${p}`);
  const defs = parts.map((x) => `<g style="display:none">${x.body}</g>`).join('');
  return out.replace(/<defs>/, `<defs>${defs}`).replace(/^<svg(?![^>]*xmlns:xlink)/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
}

const loadImage = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });

async function portraitImage(g) {
  if (!g.portrait) return null;
  try {
    const svg = await selfContained(avatarSvg({ age: g.ageAtDeath, gender: g.portrait.gender ?? g.gender, appearance: g.portrait.appearance, seed: g.portrait.seed, mood: 60, ...(g.portrait.dress ?? {}) }));
    return await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  } catch { return null; }
}

// ---------- Drawing ----------

/** Lines of text no wider than `max`, at most `limit` of them (the last ends with an ellipsis if cut). */
function wrap(ctx, text, max, limit = 3) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= max || !line) line = test; else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > limit) { lines.length = limit; let last = lines[limit - 1]; while (ctx.measureText(`${last}…`).width > max && last.includes(' ')) last = last.slice(0, last.lastIndexOf(' ')); lines[limit - 1] = `${last}…`; }
  return lines;
}
/** The largest size, up to `size`, at which one line fits. */
function fit(ctx, text, weight, family, size, max) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > max && s > 24);
}

/** Draws the card. @returns {Promise<HTMLCanvasElement>} */
export async function drawCard(g, url = gameUrl()) {
  const f = cardFacts(g);
  const { width: W, height: H } = CARD;
  try { await Promise.all([`700 64px ${SERIF}`, `600 36px ${SERIF}`, `400 30px ${SANS}`, `700 28px ${SANS}`].map((x) => document.fonts.load(x))); } catch { /* system fonts will do */ }
  const face = await portraitImage(g);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

  // Page and stone.
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  const sx = 90, sw = W - 180, top = 70, bottom = 1035, r = sw / 2;
  ctx.beginPath(); ctx.moveTo(sx, bottom); ctx.lineTo(sx, top + r); ctx.arc(W / 2, top + r, r, Math.PI, 0); ctx.lineTo(sx + sw, bottom);
  ctx.arcTo(sx + sw, bottom + 24, sx + sw - 24, bottom + 24, 24); ctx.lineTo(sx + 24, bottom + 24); ctx.arcTo(sx, bottom + 24, sx, bottom, 24); ctx.closePath();
  const grad = ctx.createLinearGradient(0, top, 0, bottom); grad.addColorStop(0, STONE); grad.addColorStop(1, '#FAF6FE');
  ctx.fillStyle = grad; ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = 3; ctx.stroke();

  ctx.fillStyle = MUTED; ctx.font = `400 30px ${SANS}`; ctx.fillText('In memory of', W / 2, 205);
  // The face, or the initials where an older grave has none.
  const cx = W / 2, cy = 375, pr = 140;
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.closePath();
  const bg = ctx.createRadialGradient(cx, cy - 30, 10, cx, cy, pr); bg.addColorStop(0, '#FBEFF6'); bg.addColorStop(1, '#DCC9EF');
  ctx.fillStyle = bg; ctx.fill(); ctx.clip();
  if (face) ctx.drawImage(face, cx - pr * 1.08, cy - pr * 1.0, pr * 2.16, pr * 2.16);
  else { ctx.fillStyle = ACCENT; ctx.font = `700 110px ${SERIF}`; ctx.textBaseline = 'middle'; ctx.fillText(f.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join(''), cx, cy + 6); ctx.textBaseline = 'alphabetic'; }
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.strokeStyle = LINE; ctx.lineWidth = 4; ctx.stroke();

  let y = 595;
  ctx.fillStyle = INK; fit(ctx, f.name, 700, SERIF, 66, sw - 120); ctx.fillText(f.name, W / 2, y);
  y += 56; ctx.fillStyle = MUTED; ctx.font = `500 36px ${SERIF}`; ctx.fillText(f.years, W / 2, y);
  if (f.epitaph) {
    y += 78; ctx.fillStyle = ACCENT; fit(ctx, f.epitaph.title, 700, SERIF, 46, sw - 140); ctx.fillText(f.epitaph.title, W / 2, y);
    ctx.fillStyle = MUTED; ctx.font = `400 29px ${SANS}`;
    for (const l of wrap(ctx, f.epitaph.line, sw - 180, 2)) { y += 42; ctx.fillText(l, W / 2, y); }
  }
  y += 66; ctx.fillStyle = INK; ctx.font = `italic 400 31px ${SANS}`;
  for (const l of wrap(ctx, f.cause, sw - 160, 2)) { ctx.fillText(l, W / 2, y); y += 42; }
  if (f.highlights.length) {
    y += 14; ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(W / 2 - 180, y - 26); ctx.lineTo(W / 2 + 180, y - 26); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = INK; ctx.font = `600 28px ${SANS}`;
    for (const h of f.highlights) { if (y > bottom - 20) break; ctx.fillText(wrap(ctx, h, sw - 160, 1)[0], W / 2, y + 12); y += 44; }
  }

  // The facts, two by two, under the stone.
  const colW = (W - 180) / 2;
  f.facts.forEach(([label, value], i) => {
    const x = 90 + colW * (i % 2) + colW / 2, fy = 1112 + Math.floor(i / 2) * 82;
    ctx.fillStyle = MUTED; ctx.font = `700 22px ${SANS}`; ctx.fillText(label.toUpperCase(), x, fy);
    ctx.fillStyle = INK; ctx.font = `600 30px ${SANS}`; ctx.fillText(wrap(ctx, value, colW - 30, 1)[0], x, fy + 38);
  });

  // The game, and where to find it.
  ctx.fillStyle = PLUM; ctx.fillRect(0, H - 92, W, 92);
  ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left'; ctx.font = `700 40px ${SERIF}`; ctx.fillText('Pathways', 60, H - 32);
  ctx.textAlign = 'right'; ctx.font = `600 26px ${SANS}`;
  ctx.fillText(wrap(ctx, url ? `Live a life: ${url.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : 'Live a life of your own', W - 420, 1)[0], W - 60, H - 36);
  return canvas;
}

/** The card as a PNG file. */
export async function cardFile(g, url) {
  const canvas = await drawCard(g, url);
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
  const slug = g.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'a-life';
  return new File([blob], `pathways-${slug}.png`, { type: 'image/png' });
}

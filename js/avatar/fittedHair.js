// The hairstyles from the fitting pipeline, read from assets/hair_manifest.json, which
// scripts/fit_hair.py writes (`npm run fit-hair`). There is no list of them in the code: a style
// dropped into assets/hair_raw/ is offered in the creator as soon as the pipeline has run.
//
// Each style is drawn on each head from assets/hair_fitted/<id>_<head>.svg (see fittedHairFile in
// js/CharacterAvatar.js). A manifest entry:
//   { id, name, clipToHead, length, type, heads: [head names it was fitted to] }
// clipToHead: a buzz cut or fade, clipped to the head's skin so it hugs the skull exactly.
//
// The manifest is loaded once, before anything that imports this module runs (top-level await).
// In the browser it is fetched (and cached for offline play by sw.js); under Node, for the tests,
// it is read from disk. If it cannot be loaded the game still runs, without these styles, and
// FITTED_LOADED is false so that saves which use one are not changed (see normalize in catalog.js).
const url = new URL('../../assets/hair_manifest.json', import.meta.url);

async function load() {
  try {
    if (url.protocol === 'file:') {
      const { readFileSync } = await import('node:fs');
      return JSON.parse(readFileSync(url, 'utf8'));
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`Fitted hairstyles are unavailable: could not load ${url.pathname} (${err.message}).`);
    return null;
  }
}

const manifest = await load();

/** Whether the manifest loaded. */
export const FITTED_LOADED = !!manifest;
/** The head every style was drawn on; a head a style was not fitted to is given this head's version. */
export const FITTED_BASE_HEAD = manifest?.baseHead ?? null;
/** Every fitted hairstyle, by id. */
export const FITTED_HAIR = Object.fromEntries((manifest?.hairstyles ?? []).map((h) => [h.id, h]));

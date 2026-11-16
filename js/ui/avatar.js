// Portraits. The avatar system lives in js/avatar/; this file keeps the old
// import path working and adds the glyphs used for pets.
export { avatarSvg, dressOfPlayer, royalDress } from '../avatar/render.js';

const PET_GLYPH = { dog: '🐕', cat: '🐈', rabbit: '🐇', parrot: '🦜', hamster: '🐹' };
export const petGlyph = (species) => PET_GLYPH[species] ?? '🐾';

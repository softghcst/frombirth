// Shared 0–100 meter markup with red / amber / green banding.
import { esc } from '../util.js';

export const band = (v) => (v < 34 ? 'low' : v < 67 ? 'mid' : 'high');

export function meterHtml(name, value, wide = false) {
  const v = Math.round(value);
  return `
    <div class="meter ${wide ? 'wide' : ''}" role="meter" aria-label="${esc(name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}">
      <span class="name">${esc(name)}</span>
      <span class="track"><span class="fill ${band(v)}" style="width:${v}%; display:block"></span></span>
      <span class="val">${v}%</span>
    </div>`;
}

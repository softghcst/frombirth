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

/**
 * Draws meters into a container, updating the ones already there so their bars glide to the new value
 * instead of jumping. `list` is [name, value] pairs, always in the same order.
 */
export function syncMeters(container, list) {
  const now = container.querySelectorAll('.meter');
  if (now.length !== list.length || [...now].some((m, i) => m.getAttribute('aria-label') !== list[i][0])) {
    container.innerHTML = list.map(([n, v]) => meterHtml(n, v)).join('');
    return;
  }
  list.forEach(([, value], i) => {
    const v = Math.round(value);
    const m = now[i];
    if (m.getAttribute('aria-valuenow') === String(v)) return;
    m.setAttribute('aria-valuenow', String(v));
    const fill = m.querySelector('.fill');
    fill.className = `fill ${band(v)}`;
    fill.style.width = `${v}%`;
    m.querySelector('.val').textContent = `${v}%`;
  });
}

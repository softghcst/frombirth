// A team's jersey, drawn: the shirt in the home color with the away color as trim, and a number on the front.
import { esc } from '../util.js';

/** Black or white, whichever reads on this color. */
export function inkOn(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#141414' : '#ffffff';
}

/** A shirt. `label` names it for screen readers. */
export function jerseySvg({ home, away }, num = '', size = 44, label = 'Team jersey') {
  return `<svg class="jersey-svg" width="${size}" height="${size}" viewBox="0 0 48 48" role="img" aria-label="${esc(label)}">
    <path d="M16 5 L10 7 L2 15 L8 23 L12 20 L12 44 L36 44 L36 20 L40 23 L46 15 L38 7 L32 5 Q24 12 16 5 Z" fill="${home}" stroke="${away}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M16 5 Q24 12 32 5" fill="none" stroke="${away}" stroke-width="3"/>
    ${num !== '' && num != null ? `<text x="24" y="35" text-anchor="middle" font-size="14" font-weight="700" font-family="system-ui, sans-serif" fill="${inkOn(home)}">${esc(String(num))}</text>` : ''}
  </svg>`;
}

/** A small two-color mark beside a team's name in lists. */
export const jerseyDot = ({ home, away }) => `<span class="jersey-dot" aria-hidden="true" style="background:linear-gradient(135deg, ${home} 55%, ${away} 55%)"></span>`;

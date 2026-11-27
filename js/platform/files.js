// Handing the player a file (a transfer file of their saves). In a browser it is downloaded; in the app, where a
// download goes nowhere the player can find, it is written to the app's cache and offered through the share sheet
// (Save to Files, AirDrop, Mail…). Choosing a file to load works the same everywhere (<input type="file">).
import { isNative, plugin } from './native.js';

/**
 * @returns {Promise<{ok:boolean, how:'downloaded'|'shared'|'cancelled'|'failed', text?:string}>}
 */
export async function giveFile(name, text, title = 'From Birth saves') {
  const fs = plugin('Filesystem'); const share = plugin('Share');
  if (isNative() && fs && share) {
    let uri;
    try {
      ({ uri } = await fs.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' }));
    } catch (e) { return { ok: false, how: 'failed', text: `The file could not be made: ${e?.message ?? e}` }; }
    try {
      await share.share({ title, files: [uri], dialogTitle: title });
      return { ok: true, how: 'shared' };
    } catch (e) {
      // Closing the share sheet without choosing is not a failure.
      if (/cancel/i.test(String(e?.message ?? e))) return { ok: false, how: 'cancelled' };
      return { ok: false, how: 'failed', text: `The share sheet could not be opened: ${e?.message ?? e}` };
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { ok: true, how: 'downloaded' };
}

# The iOS app

From Birth's iOS app is the same game as the website, wrapped by [Capacitor](https://capacitorjs.com) 8. Nothing in the
game was rewritten for it: the app ships the website's own files, and a small platform layer (`js/platform/`) adds what
only an app can do. The website on GitHub Pages is unchanged and keeps working exactly as before.

App readiness, store requirements and what is still missing are in [APP_STORE_READINESS.md](APP_STORE_READINESS.md).

## What is where

| Path | What it is |
|---|---|
| `capacitor.config.json` | App name (From Birth), bundle id, the folder the app ships (`www`), the app's origin, plugin settings |
| `scripts/build-app.mjs` | Makes `www/` from the game: only the files the game loads, with the app's own fonts. Checks every import and file reference, and refuses anything private or development-only |
| `www/` | What the app ships. Made by the build, never committed |
| `mobile/fonts/` | The game's Google Fonts, copied for the app so it needs no connection (`scripts/vendor-fonts.mjs`; SIL Open Font License, see `LICENSE.txt` there) |
| `ios/` | The Xcode project (Swift Package Manager). `ios/App/App/public` is filled by `cap sync` and not committed |
| `ios/App/App/PrivacyInfo.xcprivacy` | The app's privacy manifest. Keep it true to what the code does |
| `scripts/make-app-images.py` | The app icon (Afterglow) and the launch image, from the game's artwork |
| `js/platform/native.js` | The one place that knows whether the game is in a browser or in the app |
| `js/platform/saveBackup.js` | The app's second copy of the saves, as a file |
| `js/platform/files.js` | Transfer files: a download in a browser, the share sheet in the app |
| `js/platform/keyboard.js` | In the app, a tap outside a field puts the keyboard away |
| `js/platform/appIcon.js` | What the platform can do with the chosen app icon |
| `tests/app-build.mjs`, `tests/app-ui.mjs`, `tests/save-safety.mjs` | The app's checks (part of `npm test`) |

## Building

You need a Mac with Xcode to build, run or submit the iOS app; no part of that can be done on Linux or Windows.
Capacitor 8's own documentation lists the Xcode and macOS versions it needs. Check it before you start: this
repository was set up without access to that page or to a Mac.

```bash
npm ci
npm run build:app      # makes www/ from the game, then copies it into ios/ (npx cap sync)
npx cap open ios       # opens the project in Xcode
```

In Xcode: choose the **App** target → **Signing & Capabilities** → your team, then run it on a simulator or a phone.
Each time the game changes, run `npm run build:app` again before building in Xcode.

Versions: Capacitor core, iOS and CLI are pinned to the same release (8.6.3) in `package.json`; the plugins are the
8.x releases that go with it. Node 22 or later is needed (Capacitor CLI 8's requirement). The app needs **iOS 16.4 or
later**: the game uses CSS `color-mix()` (Safari 16.2) and gzip transfer codes (`CompressionStream`, Safari 16.4).
Do not lower it without replacing both.

## Never change these after the first release

- **The bundle id** (`appId`, now `com.softghcst.frombirth`, still waiting for the owner's approval). It is the app's
  identity in the App Store: a new one is a new app, and players would lose their saves.
- **The app's origin** (`server.iosScheme` `capacitor` and `server.hostname` `localhost`). The WebView keeps saves
  per origin. Change either one and every player's saves are left behind under the old origin, out of the game's
  reach. `tests/app-build.mjs` checks that both are still pinned.

## How the app differs from the website

All of these do nothing in a browser. They are reached through `js/platform/native.js`, which uses the
`window.Capacitor` global that the app's WebView provides, so the website loads nothing extra and there is still
nothing to build.

| | Website | App |
|---|---|---|
| Fonts | Google Fonts | Kept in the app (`mobile/fonts`) |
| Offline | Service worker (`sw.js`) | Every file is in the app; no service worker |
| Haptics | Vibration API; the switch tick on iPhone | iOS haptics (`@capacitor/haptics`): light taps, success and warning for good and bad news |
| Transfer file | Downloaded | Share sheet: Save to Files, AirDrop, Mail (`@capacitor/share`, `@capacitor/filesystem`) |
| Save backup | None | A verified copy of every save in the app's Library folder (see below) |
| Status bar | `theme-color` | Light or dark text to match the theme (`@capacitor/status-bar`) |
| Keyboard | As the browser does | Goes away on a tap outside the field |
| App icon choice | Changes the tab's icon | Kept and shown in Settings. The home screen icon stays Afterglow, and Settings says so |
| Password reset link | Comes back to the website page | Opens the website; the player then signs in in the app |
| Orientation | Any | iPhone: portrait. iPad: any |

## Saved lives in the app

### Where they are
The app keeps saves the way the website does, in the WebView's `localStorage`, under the app's own origin
(`capacitor://localhost`). **Nothing moves across from the website by itself.** The website and the app are
separate places, even on the same phone. To bring lives across, either:

- **Settings → Transfer saves**: copy a code (or save a file) on the website, then **Load saves** in the app; or
- **Settings → Cloud saves**: sign in with the same account in both.

`tests/app-ui.mjs` plays a life on the website, copies its code through Settings, loads it in the app, and opens it
at the same age.

### How they are protected
- **Transfer codes are verified.** Each code is read back and compared before it is shown or saved, and checked
  again before it is loaded. In a code, a damaged life is left out (and reported), duplicates become one, and a life
  missing from the list is listed.
- **Loading is all or nothing.** If the device runs out of room partway through a load or a cloud sync, everything
  already written is put back and the player is told. Nothing is half-loaded.
- **Only a deliberate deletion removes a life.** A sync or a combine never deletes a life just because this device
  could not read it.
- **A life that cannot be opened is never changed.** If a save is unreadable, or cannot be brought up to date, the
  title screen says the life could not be opened. The save stays exactly as it was.
- **Lost lives are found again.** If a save was written but its entry in the list of lives was not (storage ran out
  between the two writes), it is put back on the list at the next launch.
- **The app's backup file** (`js/platform/saveBackup.js`). After every save, and at once when the app goes to the
  background, the whole set of lives, graves and people is written to `Library/saves/backup.fbsave`. It is checked
  by reading it back first, and replaced safely: the new copy is written beside the old one, and the old one is kept
  as `backup-prev.fbsave`. If iOS clears the app's website data, or the WebView loses it, the next launch brings back
  anything missing and says so. A life deleted on purpose stays deleted. The Library folder is included in the
  phone's own iCloud or computer backup, and is not shown in the Files app.
- **Updates keep saves.** An update replaces the game's files but not the WebView's data or the Library folder, as
  long as the origin and bundle id are never changed (above). Older saves are brought up to date when they load
  (`migrate` in `js/save.js`), as on the website.

### Limits, honestly
- **Storage size.** `localStorage` holds about five million characters for everything, and a long life saves close
  to a million. The backup file does not raise that limit. A player with many long lives can fill it; the game then
  drops the age-down history first, and a load that does not fit is refused (and rolled back). Moving the saves
  themselves to files would remove the limit. That is a larger change to `js/save.js`, whose functions are
  synchronous today.
- **Cloud saves** have their own conflict handling (versioned uploads; on a conflict, the newest copy of each life
  wins). That code exists, but this work did not test it against a live Supabase project, so it is not claimed
  reliable here. It also cannot recover a life that was never uploaded.
- **The backup file is per device.** Deleting the app deletes it, along with the WebView's data, unless the phone's
  own backup is restored.

### Recovery, for players and for support
1. **A life shows "could not be opened".** Its save is still on the device. Make a transfer file (Settings →
   Transfer saves → Save a transfer file) and keep it: a fixed version of the game can open it, and the file is what
   support needs.
2. **Lives are missing after an update or a full device (app).** Open the app again: the backup is checked at every
   launch, and anything it brings back is announced as "Saves recovered".
3. **Moving to a new phone.** Restore the phone from an iCloud or computer backup (the app's Library folder comes
   with it), or use a transfer file or cloud saves.
4. **A transfer code will not load.** The message says why: not a code, cut off, damaged, or not enough room.
   Nothing on the device changes when a code is refused. Copy the whole code again, or use a transfer file instead.
5. **Last resort (support).** On a Mac, Xcode → Devices → From Birth → Download Container gives the app's files,
   including `Library/saves/backup.fbsave` and `backup-prev.fbsave`. Each is a transfer code that **Load saves**
   accepts.

## Checking it on a device

`npm test` runs the app's automated checks along with the rest (`app-build`, `app-ui`, `save-safety`). They use
Chromium, with a stand-in for the native side. These need a real iPhone or the iOS Simulator:

- [ ] It builds and runs in Xcode with no warnings about the privacy manifest or signing.
- [ ] Launch: the launch image, then the title screen, with no blank flash, in light and dark.
- [ ] Safe areas: nothing under the notch or Dynamic Island, or behind the home indicator (title, game, every kind
      of dialog, the birth globe), on a small iPhone (SE), a standard one and a Pro Max.
- [ ] Portrait stays portrait on iPhone; iPad turns.
- [ ] Haptics on Age up, answers, good and bad news; none with Settings → Haptics off.
- [ ] Status bar text readable in light and dark, and when the system appearance changes while playing.
- [ ] Keyboard: typing a name in the creator, and signing in. The field stays visible above the keyboard, and a tap
      outside puts it away.
- [ ] Dialogs scroll with a finger, and the page behind does not.
- [ ] Avatar creation: every part draws, including hair and clothes, at each age.
- [ ] Larger Text (Settings → Accessibility → Display & Text Size) and VoiceOver: the game reads in order, buttons
      have names. WKWebView does not apply Dynamic Type to this game's text by itself. Whether it should, and how,
      is a decision still to make.
- [ ] Airplane mode from a fresh install: the whole game plays.
- [ ] Background and back during a turn, and after a long time away: the same life, nothing lost.
- [ ] Transfer: a code from the website loads; a transfer file saves to Files and loads back; AirDrop to an iPad.
- [ ] Backup: play, force-quit, then delete the app's website data (or test with Xcode by replacing the container):
      the lives come back.
- [ ] Cloud saves: sign in, sync between the website and the app, sign out, delete the account.
- [ ] An app update (build 1, then build 2 over it): every life is still there.

## Paying for the game, later

No business model has been chosen, and none is built in: no purchases, no ads, no paywall, no analytics. Whatever
is chosen later (a free game, a paid one, or optional one-time expansions), these hold:

- What can be played today stays playable. No existing part of the game is ever locked.
- Purchases in the iOS app go through Apple's In-App Purchase, as non-consumable items for expansions, and need a
  **Restore Purchases** button. Nothing is ever shown as bought until Apple confirms it.
- When it is needed, one module (`js/platform/entitlements.js`) should answer one question, "does this player have
  X?". It would be backed by StoreKit in the app and by nothing at all (always no) on the website, and expansions
  would check it. It does not exist yet on purpose: nothing needs it.

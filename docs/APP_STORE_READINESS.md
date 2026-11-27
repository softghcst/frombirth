# App Store readiness

Where From Birth stands on the way to the App Store, as of the Capacitor foundation (November 2026). How the app is
built and how saves are kept safe: [IOS_APP.md](IOS_APP.md).

This is a working checklist, not legal or compliance advice. Apple's rules and App Store Connect's forms change: check
each item against Apple's current App Review Guidelines and App Store Connect help when you do it. Nothing here has
been reviewed by Apple.

## Where it stands

**The foundation is in place. Nothing has been built for iOS yet.** The Xcode project exists and is set up. The
app's files are built from the game and checked automatically. The game runs offline with its own fonts. The native
features degrade cleanly in a browser, and saves have more protection than before. All of this was tested in Chromium
with a stand-in for the native side. **No iOS build has been made**: this work was done without a Mac or Xcode, so
the app has never been compiled, signed, or run on a simulator or phone.

## Decisions for the owner

| Decision | Now | Notes |
|---|---|---|
| Bundle id | `com.softghcst.frombirth` | Permanent once the app is in App Store Connect. Must be registered under your Apple Developer account |
| iPhone only, or iPhone and iPad | Both (`TARGETED_DEVICE_FAMILY = 1,2`) | Keeping iPad means iPad screenshots and iPad testing. iPhone-only is less work for a first release |
| Minimum iOS | 16.4 | The game needs it (see IOS_APP.md). Lower needs code changes |
| Version | `0.1.0` (package.json), Xcode `1.0 (1)` | Set Xcode's version and build number for each upload |
| Business model | None chosen | See "Purchases, if ever" below |
| Dynamic Type | Not applied | WKWebView does not scale this game's text with the system text size. A CSS-only change could, but it is a design decision |
| Encryption answer | Not set | See "Export compliance" |

## Audit

### Name and icon
- Name on the home screen: **From Birth** (`CFBundleDisplayName`). Before you build anything else, check in App
  Store Connect that the name is free.
- Icon: Afterglow at 1024 × 1024, no transparency (`ios/App/App/Assets.xcassets`). Look at it at small sizes on a
  real home screen.
- The in-game icon picker cannot change the home screen icon in this version, and Settings says so plainly. Alternate
  icons would need native code and their own icon sets.

### Screenshots
Needed for every device family the app supports. Use the sizes App Store Connect currently asks for (a large iPhone
set, and a large iPad set if iPad stays). Use real screens from the app on a simulator: the title, a life in
progress, the avatar creator, a scene with choices, Settings. Use no mock-ups showing things the game does not do.
`SHOT=dir node tests/app-ui.mjs` produces browser screenshots for layout checking only. They are not store
screenshots.

### Privacy
- **Privacy policy.** `privacy.html` already exists, covers cloud saves, and gives a contact. Before submission it
  needs a few app-specific updates, which only the owner should make:
  - In the app, fonts come with the app, so Google Fonts sees nothing. The policy currently says they are downloaded
    from Google.
  - In the app, files come with the app, not from GitHub Pages.
  - The app keeps a backup copy of the saves in its own storage on the device (not sent anywhere).
  - The policy's URL goes in App Store Connect.
- **App Privacy answers (App Store Connect).** Today's code collects data only when a player chooses cloud saves:
  - their email address, linked to them, for app functionality;
  - their saved lives, which hold anything they typed (names under People you know), linked to them, for app
    functionality;
  - the kind of device that last saved ("iPhone", "iPad").

  There is no tracking, advertising or analytics. Whether Supabase's own server logs (IP addresses) need declaring
  is for the owner to decide from Apple's definitions and Supabase's terms.
- **Privacy manifest** (`ios/App/App/PrivacyInfo.xcprivacy`) declares:
  - no tracking;
  - the two kinds of data above;
  - file timestamps (reason `C617.1`), because the Filesystem plugin reads them in the app's own container.

  Capacitor's own framework ships an empty manifest. Re-check this file whenever a plugin is added, and against
  Xcode's privacy report once a build exists.
- **Permissions.** The app asks for none: no camera, photos, location, contacts, tracking or notifications. The
  share sheet and file picker need none. `Info.plist` has no usage descriptions, and needs none until a feature asks
  for one.

### Account deletion
Apps that let people make an account must let them delete it in the app. **Settings → Cloud saves → Delete my
account** does this, through the `delete_my_account` database function in `docs/cloud-saves.sql`. Before
submission, check that the live Supabase project has that function: without it, the game removes the saves but asks
the player to email for the account itself. Apple may not accept that.

Sign-in is by email and password only, with no third-party sign-in, so Sign in with Apple is not required for that
reason. Check this against the current guideline.

### Age rating and content
Answer Apple's age-rating questionnaire against what the game really contains. It is a text life simulation from
birth to death, and its data includes, among other things:

- alcohol, tobacco and drug references and choices;
- sexual relationships, pregnancy and contraception (as text, with health sources);
- crime, violence and weapons, including homicide;
- a casino activity and gambling statistics (simulated gambling);
- serious illness, death and grief;
- mature themes such as abuse and mental health.

Expect a high rating. The game already opens with a notice that it is fiction and not medical, legal or financial
advice. Medical topics (contraception, health) should be described accurately in the questionnaire.

### Offline
The app needs no connection to play: `tests/app-ui.mjs` refuses every request outside the app and plays a whole
session. A connection is used only for cloud saves, when a player signs in.

### App Review risks
- **Minimum functionality (4.2).** Apps that are mainly a website in a wrapper are often rejected. In From Birth's
  favor:
  - the whole game is in the app and works offline;
  - it uses native haptics, the share sheet and file storage;
  - it has no web-page chrome or outside links for its core.

  Still the most likely reason for a rejection. Make sure the review notes describe what is native.
- **Accuracy of health content.** Contraception and health facts cite sources (`docs/CONTRACEPTION.md`,
  `docs/HEALTH.md`). Reviewers may look at medical claims.
- **Real people and brands.** Check names of real organizations, employers and places used in the game, against
  the content guidelines.
- **Account deletion** (above), if the database function is missing.
- **Crashes on launch.** Never run on iOS yet: TestFlight first.

### Export compliance
The app uses only HTTPS (through iOS) to talk to Supabase. App Store Connect asks about encryption for each build.
Once the owner has confirmed the answer, `ITSAppUsesNonExemptEncryption` can be set in `Info.plist` so the question
is not asked every time. It is not set now, on purpose.

### Purchases, if ever
Nothing is built: no StoreKit, no ads SDK, no paywall, no "purchase succeeded" screens. If a model is chosen:

- Selling the app (paid up front) needs no code.
- Optional expansions need In-App Purchase (non-consumable), a **Restore Purchases** button, Paid Apps agreements,
  tax and banking in App Store Connect, and the entitlement module described in IOS_APP.md.
- Nothing already in the game is locked. Purchases bought on the website could not unlock iOS content without
  following Apple's rules on that.

## Before TestFlight

1. Approve the bundle id and choose iPhone-only or universal.
2. Join the Apple Developer Program. Register the bundle id, and create the app in App Store Connect.
3. On a Mac with the Xcode version Capacitor 8 needs:
   - `npm ci && npm run build:app && npx cap open ios`;
   - set the signing team;
   - build and run on a simulator, then on a phone.
4. Fix whatever the first real build shows: warnings, the launch image, safe areas, the keyboard.
5. Work through the device checklist in IOS_APP.md.
6. Answer the encryption question. Set the version and build number.
7. Archive, upload, and add internal testers.

## Before the public release

1. Update the privacy policy for the app (above). Enter its URL and the App Privacy answers.
2. Make sure the live Supabase project has `delete_my_account`, and test account deletion from the app.
3. Answer the age-rating questionnaire against the content list.
4. Prepare screenshots, a description, keywords, a support URL and review notes (what is native, how to try cloud
   saves without making an account, or a demo account).
5. Run external TestFlight testing, including moving saves from the website and an update over an earlier build.
6. Decide on Dynamic Type and test with VoiceOver.
7. Decide the price (free or paid). Only after that, and with approval, anything to do with purchases.
8. Submit for review. Do not publish or create paid products without the owner's explicit go-ahead.

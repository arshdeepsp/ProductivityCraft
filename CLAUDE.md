# CLAUDE.md — ProductivityCraft

Pixel-art gamified habit/productivity app. Web PWA (GitHub Pages) + Android app (Capacitor). All data local; no backend.

## Working with Arsh
- Keep answers short; lead with the answer.
- Pastable commands contain no comments; explain in prose outside the code block.
- Run `npm test` before calling anything done. Add a test for every behaviour change or bug fix.
- He tests on a real Android phone; native code can only be verified there.

## Commands
```
npm install
npx playwright install chromium
npm run build
npm test
npm run serve
npm run android:apk
```
- `build` → `dist/` (single `index.html` + assets + `sw.js` with versioned cache).
- `test` → build + Playwright (headless Chromium, fake clock, seeded localStorage). ~55 tests, ~1 min.
- `android:apk` → build, `npx cap sync android`, `node scripts/add-native.cjs`, `./gradlew assembleDebug`. Never run `assembleDebug` alone after source changes.
- First Android setup: `npx cap add android`, `node scripts/add-permissions.cjs`, `npx @capacitor/assets generate --android`, then `npm run android:apk`.
- Push to `main` → GitHub Actions runs tests, deploys `dist/` to Pages only if green.

## Layout
```
src/index.html         markup with /*@inject:css|ach|js*/ points
src/styles/NN-*.css    concatenated in filename order
src/js/NN-*.js         concatenated in filename order inside ONE closure
src/assets/achievements.json
public/                static files copied to dist (fonts, icons, vendor, manifest, sw.template.js)
native/android/        FocusNotifier/FocusNotifyPlugin/FocusNotifyReceiver (Java), layouts, icon, pc_chime.wav
scripts/               add-native.cjs, add-permissions.cjs (.cjs because package.json is "type": "module")
tests/*.spec.mjs       Playwright specs; helpers.mjs has openApp() and dayRange()
build.mjs              the whole build
```
- All JS shares one scope. Function declarations are hoisted, but top-level `var`s and immediate code run in file order. A `var` used during startup must be defined in an earlier file (this has bitten us).
- File names reflect history, not features. Use grep. Examples: starter packs live in `07-generic-drag-to-reorder.js`; weekly totals in `26-momentum-bank-rolling-targets-sessions.js`; notifications in `35-quest-subject-links-finish-lines-cap.js`.
- Two dist-only artifacts exist outside the repo (old claude.ai artifact, old `productivitycraft-android` folder). Both are retired; this repo is the only source.

## State and data
- Global `S` = `{days, refl, cfg, timer, sprint, ...}`; persisted to `localStorage["pc-cache-v1"]` via `cache()`.
- `cfg()` returns settings; change settings with `saveCfg(clone)`. Edit today via `entry()` then `commit()`.
- No store/subscriptions: after a change, call `render()` (and `qSig=""` if the quest list structure changed). Forgetting this is a common bug.
- Each day entry stores a snapshot of its quest defs in `e.q` (`slim()` decides which fields are copied — add new quest fields to that list).
- `SCHEMA` and `migrate()` in `00-core.js`. Changing stored shape: bump SCHEMA, add a migrate step, add a test in `tests/data.spec.mjs`. Backups from a newer schema are refused.
- UI-only prefs live in separate localStorage keys (`pc-focusview`, `pc-doneopen`, `pc-adv`, `pc-todoreview`, ...).

## Core rules (keep tests green when touching these)
- **Day cleared**: every required quest met and no limit broken. Required = not optional, not weekly-X-times, not to-do. Nothing required → rest day.
- **Misses**: first miss = grace; second consecutive resets streak unless a freeze is available.
- **Daily time quests**: minutes ≥ min. Plan is a stretch goal (gold day).
- **Weekly-total quests (`q.roll`, minutes)**: fixed Mon–Sun week. Pace by the quest's ticked **work days**: need by day k = roll × workdays elapsed / workdays in week (`rollNeed`). First week prorated from `startOn || addedOn || firstSeen`. On non-work days the quest is shown but optional; extra time counts.
- **Carried days**: empty day where all required quests are weekly totals on pace → streak held, no XP. Surplus doesn't cross Monday. `emptyCover()` powers the banner/notification.
- **Start dates (`q.startOn`)**: hidden until then; listed under "Starting soon". Weekly totals created after Thursday noon default to next Monday.
- **Late start**: daily quests added after the day's midpoint (`dayMidMin`) are optional that day.
- **Easing changes** (lower target, delete, pause, optional, remove days, later start, daily→weekly, looser lock) take effect tomorrow via `lockDay`. Budget of 3/week and per-quest locks only in **Strict mode** (`cfg.strict`, off by default).
- **Daily quest limit** (`cfg.cap`, ≤10): counts required quests per weekday (`dayLoad`). No limit on total quests.
- **To-dos**: done ones deleted the next day; open ones get a keep/delete review (End day, next app open, notification 2400).
- **Just 5**: first unfinished time quest in list order; all done → Bonus 5 picker.
- **Timer running** → forces Minimal view (`focusView`), shows one enlarged card, blocks leaving until stopped.
- **Multiple subjects per quest**: `q.subjs` (array) with `q.subj` = first, for backward compatibility. Use `qSubjs(q)`.

## Notifications (native only; inert on web)
- `nfPlan()` builds the schedule; `notifSync()` diff-reschedules via `@capacitor/local-notifications` on channel `pc_alerts2` (sound `pc_chime.wav`).
- IDs: 1001–1003 timer goals, 1101–1103 sprint, 2000+ check-in, 2100+ end-day, 2200 streak risk, 2300 carry cover, 2400 open to-dos, 2500 day midpoint pace, 2600 Thursday weekly pace, 3000+ deadlines, 4001 review topics, 4998/4999 tests.
- Live timer: custom plugin `FocusNotify` (channel `pc_focus_live2`, id 901) with a Chronometer RemoteViews layout. Countdowns hand off at zero via an exact AlarmManager alarm → `FocusNotifyReceiver`. Timestamps must be passed as integers (`Math.round`) and read with `optLong`.
- Android caveats: exact alarms need `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` (remove `USE_EXACT_ALARM` before Play Store); channel importance/sound are immutable once created — use a new channel id to change them.

## Testing patterns
- `openApp(page, { now, cfg, days, extra, hash })` installs a fake clock and seeds storage; then drive the real UI.
- Mock native plugins by defining `window.Capacitor = { isNativePlatform: () => true, Plugins: {...} }` in `addInitScript` (see `native.spec.mjs`, `pace.spec.mjs`).
- Prefer `expect.poll` / `toBeHidden` over fixed waits; parallel runs expose races.
- Phone layout tests use `test.use({ viewport: { width: 360|390 }, isMobile: true, hasTouch: true })`.

## Known debt (planned clean-up, in order)
1. Auto-format (code is dense one-liners).
2. Remove dead code: bank, Top 3, old quest-cap picker, legacy fields.
3. Rename/regroup files by feature.
4. Consolidate CSS per screen; reduce `!important` layering (mobile rules are scattered; later files override earlier).
5. Introduce a small store (actions + subscriptions) and real ES modules.

## Before publishing (not started)
- Reskin away from Minecraft look: grass-block icon/tiles, grey bevel panel palette, "Nether" theme name, "Achievement unlocked!" toast. Check the name on the Play Store.
- Release signing + AAB, privacy policy, Data safety ("no data collected"), credits for Press Start 2P / VT323 (OFL) and jsPDF (MIT), remove `USE_EXACT_ALARM`.
- Play closed test: 12+ testers for 14 days.

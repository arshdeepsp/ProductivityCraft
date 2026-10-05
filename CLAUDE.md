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
- `test` → build + Playwright (headless Chromium, fake clock, seeded localStorage), served over http by `tests/serve.mjs` on :4173 (file:// lost localStorage across reloads and made reload tests flaky). ~110 tests, ~2 min.
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
- **Weekly-total quests (`q.roll`, minutes)**: fixed Mon–Sun week. Pace by the quest's ticked **work days**: need by day k = roll × workdays elapsed / workdays in week (`rollNeed`). First week prorated from `startOn || addedOn || firstSeen`. On non-work days `activeDefs` marks it `opt` + `off`: it sits in a collapsed "Off today" group (`pc-offopen`), never counts as done, and is left out of the schedule, Just 5 and Pick; extra time logged there still counts toward the week.
- **Carried days**: empty day where all required quests are weekly totals on pace → streak held, no XP. Surplus doesn't cross Monday. `emptyCover()` powers the banner/notification.
- **Start dates (`q.startOn`)**: hidden until then; listed under "Starting soon". Weekly totals created after Thursday noon default to next Monday.
- **Your day**: `cfg.day` = `{wake, bed}` (default 07:00–23:00); `cfg.dayOv` = `{date, wake, bed}` overrides one day. `dayWin(k)` → `{s, e}` in minutes from that day's midnight (`e` > 1440 past midnight). It is the only source of day bounds: midpoint, pace alert 2500, end-day 2100 (bed − 1h), to-dos 2400 (bed − 30m), and the schedule. Clock-time (`wake`) quests are ordinary quests and never define the day. `winErr()` validates: bedtime ≤ the day-end lock, ≥ 1h window.
- **Late start**: daily quests added after the midpoint of Your day (`dayMidMin`) are optional that day.
- **Schedule (today only)**: `51-today-schedule.js`. `e.sched = {questId: {f, t, j5}}` on the day entry, minutes on the `dayWin` scale. Time quests only. Default length `schLen(q)` = min, or roll ÷ work days (ceil to 5). `j5` = 5-min start: fixed length, notification starts Just 5; otherwise a range (resizable, 15-min steps) whose notification starts the normal timer. No overlaps, nothing before now. `hasEntry` ignores `sched`, so a schedule never counts as logging. Notifications 3500+ carry `extra: {sched, j5}`; the tap handler in `50-todo-lifecycle.js` calls `schTap`.
- **Easing changes** (lower target, delete, pause, optional, remove days, later start, daily→weekly, looser lock) take effect tomorrow via `lockDay`. Budget of 3/week and per-quest locks only in **Strict mode** (`cfg.strict`, off by default).
- **Daily quest limit** (`cfg.cap`, ≤10): counts required quests per weekday (`dayLoad`). No limit on total quests.
- **To-dos**: done ones deleted the next day; open ones get a keep/delete review (End day, next app open, notification 2400).
- **Just 5**: first unfinished time quest in list order; all done → Bonus 5 picker.
- **Timer running** → forces Minimal view (`focusView`), shows one enlarged card, blocks leaving until stopped.
- **Multiple subjects per quest**: `q.subjs` (array) with `q.subj` = first, for backward compatibility. Use `qSubjs(q)`.

## Notifications (native only; inert on web)
- `nfPlan()` builds the schedule; `notifSync()` diff-reschedules via `@capacitor/local-notifications` on channel `pc_alerts2` (sound `pc_chime.wav`).
- IDs: 1001–1003 timer goals, 1101–1103 sprint, 2000+ check-in, 2100+ end-day, 2200 streak risk, 2300 carry cover, 2400 open to-dos, 2500 day midpoint pace, 2600 Thursday weekly pace, 3000+ deadlines, 3500+ schedule starts, 4001 review topics, 4998/4999 tests.
- **Answered the call**: every scheduled notification carries `extra.at` (fire time). Tapping a reminder (check-in, streak risk, carry, midday/weekly pace, schedule start) within `CALL_MIN` (2) min sets `S.call`; the next timer/Just 5/sprint start (`callCheck`) adds `e.calls`, worth `CALL_XP` (10) each in `dayXP`, capped at `CALL_CAP` (5)/day. `hasEntry` ignores `calls`. Constants live in `00-core.js` because `dayXP` runs during startup.
- **Tapping a notification** runs `notifAction(id, extra)` (`52-notification-actions.js`): each id opens its own prompt (`nfCall`) or screen — timer prompts with Stop & log / Keep going, sprint panel, check-in / streak-risk lists with Just 5 on the furthest-behind quest, End day, to-do review, midday/weekly progress bars, deadline (extra `{dl}`) → Plan today, review topics, schedule starts → `schTap`. Live timer taps: native puts `pcTap` on the launch intent, `MainActivity` (written by `add-native.cjs`) passes it to `FocusNotifyPlugin.capture`, JS reads it with `FocusNotify.takeTap()` on open and on return to the front.
- Live timer: custom plugin `FocusNotify` (channel `pc_focus_live2`, id 901) with a Chronometer RemoteViews layout. Countdowns hand off at zero via an exact AlarmManager alarm → `FocusNotifyReceiver`. Timestamps must be passed as integers (`Math.round`) and read with `optLong`. Growing sapling: JS passes `grow = {from, dur, art}` (`focusArt()` renders 7 `drawPlant` stages as 24×36 PNGs; goal = plan/min, weekly share for roll quests, 5 min for Just 5, block length for sprints, none while paused). Native picks the stage from `(now − from) / dur`, upscales nearest-neighbour, fills `pc_prog` (big layout only — never touch an id a layout lacks), and re-posts itself at the next stage via a second alarm (request 9012, skipped when it would collide with the countdown handoff). Stopping always goes through `focusOff()` (hides 901 and cancels the fallback 900) via `focusSync(true)`; the app also clears a leftover live notification on open when nothing is running.
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

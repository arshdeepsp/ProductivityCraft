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
- **Your day**: `cfg.day` = `{wake, bed}` (default 07:00–23:00); `cfg.dayOv` = `{date, wake, bed}` overrides one day. There is no separate "Day ends at": `dayEnd()` = `lockHour(bed, wake)` — midnight, or the usual bedtime when it's after midnight, rounded up to the hour (max 5 am). It drives `todayKey()` and the lock. SCHEMA 5 folded the old `cfg.dayEnd` into the bedtime. `dayWin(k)` → `{s, e}` in minutes from that day's midnight (`e` > 1440 past midnight). It is the only source of day bounds: midpoint, pace alert 2500, to-dos 2400 (bed − 30m), and the schedule. Clock-time (`wake`) quests are ordinary quests and never define the day. `winErr(w, b, today)` validates: ≥ 1h window, usual bedtime ≤ 5 am, wake after the lock, and a today-only bedtime no later than the usual lock.
- **Late start**: daily quests added after the midpoint of Your day (`dayMidMin`) are optional that day.
- **Schedule (today only)**: `51-today-schedule.js`, a full-screen page (`#schPage`, `openSchedule`/`closeSchedule`; body gets `sch-open`, only `#schScroll` scrolls). Tap a free time → pick a quest in the footer (`schPick`); tap a block → footer controls (`schSel`); hold-drag moves (touch: 350 ms long-press); only the selected block gets a resize tab (`.sch-h`, 44×30 bottom-right, `touch-action:none`), so scrolling can never resize. Drags use timeline coordinates plus `schAutoScroll` (rAF loop while the pointer is within `SCH_EDGE` of the scroller’s top/bottom, or beyond it), so a held block follows the finger as the day scrolls; Auto-plan (`schAuto`) fills free gaps with what's left, 15-min breaks, ≥30m shots. `e.sched = [{id, q, f, t, j5}]` on the day entry (one entry per shot, so a quest can be split; SCHEMA 4 migrated the old `{questId: {f, t, j5}}` map), minutes on the `dayWin` scale. A new shot fills what's left of the daily share (or 30m once full) and stops short of the next block; Split halves a block. Read via `schAll`/`schOfQ`, write via `schSave`. Time quests only. Default length `schLen(q)` = min, or roll ÷ work days (ceil to 5). `j5` = 5-min start: fixed length, notification starts Just 5; otherwise a range (resizable, 15-min steps) whose notification starts the normal timer. No overlaps; quest shots never go before now, but busy blocks can (tapping a past time opens the busy picker directly), so a lecture that already happened can be blocked and repeated. `hasEntry` ignores `sched`, so a schedule never counts as logging. Notifications 3500+ carry `extra: {sched, j5}`; the tap handler in `50-todo-lifecycle.js` calls `schTap`.
- **Busy blocks and repeats**: a shot with `lb` instead of `q` is a busy block (named, never notifies, Auto-plan and overlap checks treat it like any block). `cfg.rep = [{id, q|lb, f, t, j5?, dows, from, until}]` repeats a block weekly; `schAll(k)` merges matching repeats as `{id:"r-"+rep, rep}` unless `e.schSkip` lists them. Edits to an occurrence go through `schEdit`, which detaches it into a one-off + skip; `schDet` then offers Every week (`schRepEvery`). Skip today = add to `schSkip`; Stop = drop the repeat. A quest repeat only lands on days the quest runs (`schRepDays`). SCHEMA 8 marks this shape; `hasEntry` ignores `schSkip`. Footer actions sit in `.sch-acts` (44px thumb row, primary right).
- **Easing changes** (lower target, delete, pause, optional, remove days, later start, daily→weekly, looser lock) take effect tomorrow via `lockDay`. Budget of 3/week and per-quest locks only in **Strict mode** (`cfg.strict`, off by default).
- **Daily quest limit** (`cfg.cap`, ≤10): counts required quests per weekday (`dayLoad`). No limit on total quests.
- **To-dos**: done ones deleted the next day; open ones get a keep/delete review the next time the app opens on a new day (or from notification 2400, 30 min before bed). There is no End day: days lock on their own (`lockHour`), past days are read-only, and `ended`/`endedAt` were dropped in SCHEMA 6.
- **Just 5**: first unfinished time quest in list order; all done → Bonus 5 picker.
- **Timer running** → forces Minimal view (`focusView`), shows one enlarged card, blocks leaving until stopped.
- **Topics are the unit; subjects classify them.** `q.topics` = topic ids the quest feeds; `q.subjs`/`q.subj` (first) are kept in step for subject minutes and finish lines (a topic-less subject can be linked whole). Edit only via `linkTopic`/`linkSubj` (`topicPick` + `wireTopicPick` render/wire the editor chips); read via `qTopics(q)`, `qSubjs(q)`, `qTopicPool(q)` (chosen topics plus every topic of a subject linked with none chosen). SCHEMA 7 turned subject links into topic links (old `q.topic` → `[topic]`, else all topics of its subjects) and dropped `q.topic`. `fin.t==="topic"` = all its topics reach the level.
- **Every timer lands on a topic**: `timerTopicStart` sets `S.timer.topic = defaultTopic(q)` (`topicOrder`: due for review, then largest target − p, then latest `e.tt` day). The running card lists the pool as chips (`.rb-tp`); `switchTopic` banks `now − tAt` into `S.timer.tacc`; `stopTimer` logs `topicSplit` (largest remainder, sums to the logged minutes) via `addTopicTime` → `e.tt`. Sprints still use their own topic select.
- **Subjects page** (`renderSubjects`): one panel, a dark header per subject (`.sjsec`/`.sjsec-h`: name, topic count, avg, Fed by) followed by topic rows (`.tr`: level pips, goal, last 30 days, total, review flag; Goal opens target + next step). `jumpSubj` flashes the `.sjsec`.
- **Weekly rerate**: first open of a week (`pc-rerate` = that Monday), `openRerate` asks for the top 3 topics by last week's `e.tt` with ≥ `RERATE_MIN` (60) min each; Save writes `setRating` (p + today's `hist`) for all shown. Waits for other modals, timers, sprints.

## Design system (keep new UI consistent with this)
- Pixel look: Press Start 2P (`--px`) for headings/labels, VT323 (`--vt`) for body text. Panels `#C6C6C6` with bevel borders (light top-left, dark bottom-right); sunken areas reverse the bevel. Buttons are `.stone`; primary `.save` (green), destructive `.del` (red). On/off is always the `.sw` switch, never an "X on/off" button.
- Full-screen pages (Schedule `#schPage`, How it works `#helpPage`): dark header bar with a yellow Press Start title and a green Done, one scroll area (`overscroll-behavior: contain`), body class (`sch-open`/`hp-open`) to stop the page behind scrolling. Android back closes them.
- Settings (`10-settings-panel.js`): home list of categories (`SET_CATS`, each with a live summary) → a page per category built from `sgroup(title, rows, helpTopic)` and `srow(title, hint, control)`. Hints are one line; anything longer goes in How it works (`HELP` in `24-help-onboarding.js`, opened with `openHelp(topicId)`). Wiring uses `bind(id, …)` because only one category is in the DOM at a time.
- Today-only wake/bed lives on the Schedule page ("Adjust today"), not in Settings.

## Badges and Trends
- Badges: `D.ach` (20, in `D.groups`) in `src/assets/achievements.json` with pixel icons (`D.icons`, 16×16 rows). `03-achievements.js`: `badgeStats(st)` scans history once, `BADGE_RULE[id](o)` → `[have, need, unit]`, `renderBadges(st)` (called from `render`) records newly met badges in `cfg.badges = {id: date}` (they stay earned), toasts once (several at once share one toast), and drives the desktop "Next badge" card (`nextBadge`). Certificates are drawn on demand by `certPDF`. Custom achievements were removed (SCHEMA 9 drops `cfg.customAch`). Toast kicker is "Badge earned!" (`showToast({kicker})` for other uses).
- Trends (`31-trends.js`, add-on page): this week (focus, days cleared, topic time, plan kept, reminders answered, deep sessions), top topics by time over 4 weeks with levels and 30-day level gains, focus by hour of day (from `e.sess`), 14-day focus, days cleared per week, records.
- Proficiency is only ever self-rated (`setRating`); time and quests never change it. `PROF_DO` anchors each level to a can-do test, shown under the pips and in the weekly check-in. `topicFlat(t)` flags effort without progress (≥ `STALL_MIN` 300 min in `STALL_DAYS` 28 days and no rating rise since the window began) on Subjects rows, the check-in and Trends.
- Subjects page boxes fold from their header (`.sjsec.fold`, ids kept in `pc-sjfold`).

## Splash
- `#splash` is in `index.html` (visible before JS runs, so cold start never flashes the app); `53-splash.js` animates it: the grove sapling (`drawPlant`) grows over a filling bar, with a status line (focusing / streak + today), ~1.25 s, tap skips, reduced motion = static 0.7 s. Shows on launch and on return after `SPLASH_AWAY` (30 min) hidden. A CSS fallback hides it at 4 s if JS fails. No Minecraft imagery: we're moving away from it.
- Native launch screen is a plain `#212121` (no icon) so it hands off seamlessly; `add-native.cjs` writes `pc_splash_blank.xml` and patches `AppTheme.NoActionBarLaunch` in `styles.xml`.
- Tests: `openApp` sets `pc-splash=off` unless `extra` sets it (`splash.spec.mjs` turns it on).

## Sound and haptics
- `haptic(k, quiet)` also plays a short 8-bit click (`tapSound`) for light/medium/heavy taps unless `quiet`; `sfx()` passes `quiet` so game sounds don't double up. Muted by Settings › Tap sounds (`cfg.tapSound`) or the master Sound toggle (`sfxOn`, `pc-sfx`). Vibration (`cfg.haptics`) is separate.

## Notifications (native only; inert on web)
- `nfPlan()` builds the schedule; `notifSync()` diff-reschedules via `@capacitor/local-notifications` on channel `pc_alerts2` (sound `pc_chime.wav`).
- IDs: 1001–1003 timer goals, 1101–1103 sprint, 2000+ check-in, 2200 streak risk, 2300 carry cover, 2400 open to-dos, 2500 day midpoint pace, 2600 Thursday weekly pace, 3000+ deadlines, 3500+ schedule starts, 4001 review topics, 4998/4999 tests.
- **Answered the call**: every scheduled notification carries `extra.at` (fire time). Tapping a reminder (check-in, streak risk, carry, midday/weekly pace, schedule start) within `CALL_MIN` (2) min sets `S.call`; the next timer/Just 5/sprint start (`callCheck`) adds `e.calls`, worth `CALL_XP` (10) each in `dayXP`, capped at `CALL_CAP` (5)/day. `hasEntry` ignores `calls`. Constants live in `00-core.js` because `dayXP` runs during startup.
- **Tapping a notification** runs `notifAction(id, extra)` (`52-notification-actions.js`): each id opens its own prompt (`nfCall`) or screen — timer prompts with Stop & log / Keep going, sprint panel, check-in / streak-risk lists with Just 5 on the furthest-behind quest, to-do review, midday/weekly progress bars, deadline (extra `{dl}`) → Plan today, review topics, schedule starts → `schTap`. Live timer taps: native puts `pcTap` on the launch intent, `MainActivity` (written by `add-native.cjs`) passes it to `FocusNotifyPlugin.capture`, JS reads it with `FocusNotify.takeTap()` on open and on return to the front.
- Live timer: custom plugin `FocusNotify` (channel `pc_focus_live2`, id 901) with a Chronometer RemoteViews layout. Countdowns hand off at zero via an exact AlarmManager alarm → `FocusNotifyReceiver`. Timestamps must be passed as integers (`Math.round`) and read with `optLong`. Growing sapling: JS passes `grow = {from, dur, art}` (`focusArt()` renders 7 `drawPlant` stages as 24×36 PNGs; goal = plan/min, weekly share for roll quests, 5 min for Just 5, block length for sprints, none while paused). Native picks the stage from `(now − from) / dur`, upscales nearest-neighbour, fills `pc_prog` (big layout only — never touch an id a layout lacks), and re-posts itself at the next stage via a second alarm (request 9012, skipped when it would collide with the countdown handoff). Expanded layout `notif_focus.xml` is a fixed 196dp (Android caps expanded custom views at ~252dp; the collapsed height is set by the system and can’t grow): 80×120dp sapling, 44sp timer. Bitmaps are upscaled nearest-neighbour to `ART_HEIGHT_PX` 324 / `BG_HEIGHT_PX` 432 / `BG_SMALL_PX` 128. Background: JS passes `bg = {big, small, dark}` (`focusBg()`: 96×54 / 120×16 pixel day or night sky over grass, cached per day/night); native upscales it into `pc_bg` (a FrameLayout behind the content in both layouts) and sets light or dark text colours. Every posted state, including `next` handoffs, carries `bg`. Stopping always goes through `focusOff()` (hides 901 and cancels the fallback 900) via `focusSync(true)`; the app also clears a leftover live notification on open when nothing is running.
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

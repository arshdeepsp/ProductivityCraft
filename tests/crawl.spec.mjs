import { test, expect } from "@playwright/test";
import { openApp, dayRange } from "./helpers.mjs";

/* A slow exploratory crawl (~8 min): every screen and flow in three data states on phone and desktop, reporting
   uncaught errors and console errors. Opt in with CRAWL=1 npx playwright test tests/crawl.spec.mjs */
test.skip(!process.env.CRAWL, "set CRAWL=1 to run the exploratory crawl");

const Q = [
  { id: "th", type: "time", label: "Thesis writing", min: 90, roll: 900, addedOn: "2026-10-01", subj: "s1", subjs: ["s1"], topics: ["t1", "t2"] },
  { id: "rd", type: "time", label: "Paper reading", min: 45, lim: 90, addedOn: "2026-10-01", subj: "s1", subjs: ["s1"], topics: ["t1"] },
  { id: "fr", type: "time", label: "French", min: 30, roll: 240, per: "2w", days: [1, 2, 3, 4, 5], addedOn: "2026-10-01", subj: "s2", subjs: ["s2"], topics: ["t3"] },
  { id: "mo", type: "time", label: "Monthly reading", min: 30, roll: 600, per: "month", addedOn: "2026-10-01" },
  { id: "gym", type: "check", label: "Gym", days: [1, 3, 5], addedOn: "2026-10-01" },
  { id: "med", type: "time", label: "Meditation", min: 10, total: 600, addedOn: "2026-10-01" },
  { id: "wk", type: "wake", label: "Up by 7", from: "06:00", to: "07:30", addedOn: "2026-10-01" },
  { id: "wt", type: "target", label: "Water", min: 8, ul: "glasses", step: 1, addedOn: "2026-10-01" },
  { id: "sc", type: "limit", label: "Social media", max: 30, unit: "min", addedOn: "2026-10-01" },
  { id: "jr", type: "weekly", label: "Journal", min: 4, addedOn: "2026-10-01" },
  { id: "cl", type: "check", label: "Call parents", opt: true, addedOn: "2026-10-01" },
  { id: "dl", type: "target", label: "Flashcards", min: 20, ul: "cards", step: 5, dl: { from: "2026-10-20", due: "2026-11-15", total: 400 }, addedOn: "2026-10-20" },
  { id: "td1", type: "todo", label: "Email supervisor about chapter 3", addedOn: "2026-11-02" },
  { id: "td2", type: "todo", label: "Renew library books", addedOn: "2026-11-01" }
];
const SUBJ = [
  { id: "s1", name: "Machine Learning", topics: [{ id: "t1", name: "Transformers", p: 3, hist: [{ d: "2026-10-01", p: 2 }], target: 4 }, { id: "t2", name: "Optimization", p: 2, hist: [] }] },
  { id: "s2", name: "French", topics: [{ id: "t3", name: "Subjunctive", p: 1, hist: [] }] },
  { id: "s3", name: "Empty subject", topics: [] }
];
const RULES = [{ title: "Mornings", motto: "Start slow", blocks: [{ h: "No phone", t: "Until coffee.\n- then plan\n1. first\n+ allowed\nx not allowed\n> lead\ncard: A | B | C\nfact: 10 | things\nchips: a, b" }] }, { title: "Evenings", motto: "", blocks: [{ h: "Lights out", t: "- 23:00" }] }];
const at = (d, h) => Date.parse(`${d}T${h}:00:00-05:00`);
function days() {
  const D = {};
  for (let i = 1; i <= 32; i++) {
    const d = new Date(Date.UTC(2026, 9, i)); if (d.getUTCMonth() !== 9) break;
    const k = `2026-10-${String(i).padStart(2, "0")}`;
    D[k] = { th: 100 + (i % 5) * 10, rd: 30, med: 10, gym: true, wk: "06:50", wt: 8, jr: i % 3 === 0, sc: 10, cl: i % 2 === 0, tt: { t1: 60 + i, t2: 40 }, sess: [{ id: "x", s: at(k, "09"), e: at(k, "11"), m: 120 }], sched: [{ id: "a" + i, q: "th", f: 540, t: 660 }], q: Q };
  }
  D["2026-11-01"] = { th: 100, rd: 45, med: 10, wk: "06:40", wt: 8, fr: 60, tt: { t1: 100, t3: 60 }, q: Q };
  D["2026-11-02"] = { th: 40, rd: 20, wt: 3, sc: 12, q: Q, tt: { t1: 40 }, sched: [{ id: "a", q: "th", f: 540, t: 660 }, { id: "b", q: "rd", f: 780, t: 840 }, { id: "c", q: "fr", f: 1020, t: 1050 }, { id: "d", q: "med", f: 1320, t: 1330, j5: true }] };
  return D;
}
const busy = [{ id: "bz1", lb: "Lecture", f: 600, t: 720, dows: [1, 3], from: "2026-10-01" }];
const rep = [{ id: "r1", q: "fr", f: 900, t: 930, dows: [2, 4], from: "2026-10-26" }];

async function crawl(page, label, opts) {
  const errs = [];
  page.setDefaultTimeout(3000);
  page.on("pageerror", (e) => errs.push(label + " | pageerror: " + e.message + " @ " + String(e.stack || "").split("\n")[1]));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Service Worker|AudioContext|vibrate|net::ERR/.test(m.text())) errs.push(label + " | console: " + m.text().slice(0, 200)); });
  await openApp(page, opts);
  const tc = async (sel) => { try { await page.locator(sel).first().click({ timeout: 1500 }); return true; } catch (e) { return false; } };
  const tf = async (sel, v) => { try { await page.locator(sel).first().fill(v, { timeout: 1500 }); } catch (e) {} };
  const go = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(250); };
  const step = async (name, fn) => { try { await fn(); } catch (e) { errs.push(label + " | step " + name + ": " + String(e.message).split("\n")[0].slice(0, 160)); } await page.keyboard.press("Escape").catch(() => {}); };
  const fresh = !(opts.cfg && opts.cfg.quests && opts.cfg.quests.length);
  await step("today-render", async () => { if (fresh) await expect(page.locator("#quests")).toBeVisible(); else await expect(page.locator("#quests .q").first()).toBeVisible(); });
  await step("hud", async () => { await tc("#hudLine"); await tc("#statsToggle"); await tc("#hudLine"); });
  if (!fresh) {
    await step("details-each-type", async () => { for (const t of ["Thesis", "Paper reading", "French", "Monthly", "Gym", "Meditation", "Up by 7", "Water", "Social", "Journal", "Call parents", "Flashcards", "Email"]) { const row = page.locator("#quests .q", { hasText: t }).first(); if (!(await row.count())) { errs.push(label + " | row missing: " + t); continue; } await row.locator(".pzb").click(); if (await tc(".qmenu button:has-text('View details')")) { await expect(page.locator("#gModal")).toBeVisible(); await tc("#gModal .stone:has-text('Close')"); } await page.keyboard.press("Escape"); } });
    await step("plus-minus-tap", async () => { await tc("#quests .q:has-text('Water') .qsum"); await tc("#quests .q:has-text('Water') .act button[aria-label^='More']"); await tc("#quests .q:has-text('Water') .act button[aria-label^='Less']"); await tc("#quests .q:has-text('Water') .act output"); await tf("#numIn", "6"); await tc("#numGo"); await tc("#quests .q:has-text('Social') .act button[aria-label^='More']"); await tc("#quests .q:has-text('Up by 7') .act output"); await page.keyboard.press("Escape"); });
    await step("check-toggles", async () => { await tc("#quests .q:has-text('Gym') .sw"); await tc("#quests .q:has-text('Gym') .sw"); await tc("#quests .q:has-text('Journal') .stone:has-text('Done')"); await tc("#quests .q:has-text('Email') .stone:has-text('Mark done')"); });
    await step("timer", async () => { if (!(await tc("#quests .q:has-text('Thesis') .qplay"))) { await tc("#quests .q:has-text('Thesis') .qsum"); await tc("#quests .q:has-text('Thesis') .tmr"); } await expect(page.locator("#quests .q.running")).toHaveCount(1); await tc(".rb-tp button"); await page.clock.runFor(61000); await tc("#quests .q.running .tmr"); await expect(page.locator("#quests .q.running")).toHaveCount(0); });
    await step("just5", async () => { await tc("#sp5Btn"); await expect(page.locator("#quests .q.running")).toHaveCount(1); await page.clock.runFor(6 * 60000); await tc("#quests .q.running .tmr"); });
    await step("sprint", async () => { await tc("#toolsBtn"); await tc(".qmenu button:has-text('Sprint')"); await expect(page.locator("#gModal")).toBeVisible(); await tc("#spGo"); await page.clock.runFor(2000); await tc("#spStop"); await tc("#spStop"); await tc("#spDone"); await expect(page.locator("#sprint")).toBeHidden(); });
    await step("pick-batch", async () => { await tc("#toolsBtn"); await tc(".qmenu button:has-text('Pick for me')"); await page.waitForTimeout(200); await tc("#gModal .stone:has-text('Close')"); await page.keyboard.press("Escape"); await tc("#toolsBtn"); await tc(".qmenu button:has-text('Batch to-dos')"); await tf("#gBody textarea", "one\ntwo"); await tc("#gBody .save"); await page.keyboard.press("Escape"); });
    await step("schedule", async () => { await tc("#schBtn"); await expect(page.locator("#schPage")).toBeVisible(); await tc("#schTl .sch-b:not(.past):not(.busy)"); await tc("#schSplit"); await tc("#schDesel"); await tc("#schAuto"); await tc("#schNowBtn"); await tc("#schDN"); await tc("#schAuto"); await tc("#schDN"); await tc("#schDP"); await tc("#schDP"); await tc("#schAdjB"); await tc("#schAdjB"); await tc("#schFt .stone:has-text('Busy times')"); await tc(".sch-wds .stone"); await tc("#schOk"); await tc("#schOk"); await expect(page.locator("#schPage")).toBeHidden(); });
    await step("new-quest-every-type", async () => { for (const t of ["check", "time", "todo", "target", "limit", "weekly", "wake", "scale"]) { await tc("#fabAdd"); await tc("#hdrAdd"); await tc("#aoQuest"); if (!(await page.locator(`#nqBody .tcard[data-t='${t}']`).count())) await tc("#nqMore"); await tc(`#nqBody .tcard[data-t='${t}']`); if (t === "time") { await tc("#nqBody .gcard[data-goal='1']"); await tc("#nqBody [data-per='2w']"); await tc("#nqBody .gcard[data-goal='']"); } await tc("#nqMoreOpt"); await tc("#nqBody [data-start]:nth-child(2)"); await tf("#nqName", "Crawl " + t); await tc("#nqSave"); await expect(page.locator("#nqModal")).toBeHidden(); } });
    await step("edit-quests", async () => { await tc("#hdrEdit"); if (!(await page.locator("#qmgr").isVisible())) { await tc("#toolsBtn"); await tc(".qmenu button:has-text('Edit quests')"); } await expect(page.locator("#qmgr")).toBeVisible(); for (const id of ["th", "fr", "mo", "gym", "wt", "sc", "jr", "wk", "dl", "td1"]) { await tc(`#qmgr [data-tog='${id}']`); await tc(`#qmgr [data-more='${id}']`); await tc(`#qmgr [data-tog='${id}']`); } await tc("#qmgr [data-drag]"); await tc("#mgrSaveTop"); await expect(page.locator("#qmgr")).toBeHidden(); });
  }
  await step("subjects", async () => { await go("#subjects"); await tc("#rrSkip"); await tc(".tr [data-tedit]"); await tc(".sjsec-tg"); await tc(".sjsec-tg"); await tc("#sjNew"); await tf("#sjCustom", "Crawl subject"); await tc("#sjAdd"); await tf("[data-tadd]", "Crawl topic"); await tc("[data-tbtn]"); await tc(".pp"); await tc(".tr-g, [data-tnext]"); });
  await step("rules", async () => { await go("#rules"); await tc("details.rules summary"); await tc("[data-edit='0']"); await tc("#gModal [data-add]"); await tc("#gModal [data-add-l]"); await tc("#gModal [data-cancel]"); await tc("#addSec"); await tc("#gModal [data-cancel]"); await tc("#resetRules"); });
  await step("badges", async () => { await go("#achievements"); await tc(".ach"); await tc("#achGrid .ach .stone"); await page.keyboard.press("Escape"); });
  await step("grove", async () => { await go("#grove"); await page.waitForTimeout(500); await tc("#groveInfo, .grove-h .stone"); await page.keyboard.press("Escape"); });
  await step("trends", async () => { await go("#trends"); await page.waitForTimeout(400); });
  await step("settings-all", async () => { for (const c of ["day", "quests", "alerts", "look", "sound", "extras", "data"]) { await go("#settings"); await tc(`[data-st='${c}']`); await page.waitForTimeout(150); for (const b of (await page.locator("#settingsBody .sq[data-help]").all()).slice(0, 1)) { await b.click().catch(() => {}); await tc("#helpDone, #helpPage .save"); } } });
  await step("settings-toggles", async () => { await go("#settings"); await tc("[data-st='quests']"); await tc("#setPlan"); await tc("#setStreak"); await tc("#setStreak"); try { await page.selectOption("#setCap", "5", { timeout: 1500 }); } catch (e) {} await go("#settings"); await tc("[data-st='look']"); for (const b of await page.locator("#settingsBody .sw").all()) await b.click({ timeout: 1500 }).catch(() => {}); for (const sel of await page.locator("#settingsBody select").all()) { const n = await sel.locator("option").count(); if (n > 1) await sel.selectOption({ index: 1 }).catch(() => {}); } await go("#settings"); await tc("[data-st='sound']"); for (const b of await page.locator("#settingsBody .sw").all()) await b.click({ timeout: 1500 }).catch(() => {}); await go("#settings"); await tc("[data-st='day']"); await tf("#setBed", "00:30"); await tc("#setDay, #settingsBody .save"); await go("#settings"); await tc("[data-st='alerts']"); for (const b of await page.locator("#settingsBody .sw").all()) await b.click({ timeout: 1500 }).catch(() => {}); await go("#settings"); await tc("[data-st='extras']"); for (const b of await page.locator("#settingsBody .sw").all()) await b.click({ timeout: 1500 }).catch(() => {}); });
  await step("help", async () => { await go("#today"); await tc(".titlebar .stone[aria-label='How it works'], #helpBtn"); if (await page.locator("#helpPage").isVisible()) { for (const b of (await page.locator("#helpPage button").all()).slice(0, 12)) await b.click({ timeout: 800 }).catch(() => {}); await tc("#helpDone, #helpPage .save"); } });
  await step("past-day", async () => { await go("#today"); await tc("#strip i[data-k='2026-10-30']"); await expect(page.locator("#gModal")).toBeVisible(); await tc("#gModal .stone:has-text('Open')"); await tc("#backToday"); });
  await step("backup", async () => { await go("#settings"); await tc("[data-st='data']"); const dl = page.waitForEvent("download", { timeout: 2500 }).catch(() => null); await tc("#setExp"); await dl; });
  await step("share-week", async () => { await go("#today"); await tc("#shareBtn"); await page.waitForTimeout(300); });
  await step("next-day", async () => { await page.clock.setFixedTime(new Date("2026-11-03T09:00:00-05:00")); await page.reload(); await expect(page.locator("#quests")).toBeVisible(); await tc("#tdrGo"); });
  await step("week-later", async () => { await page.clock.setFixedTime(new Date("2026-11-09T09:00:00-05:00")); await page.reload(); await expect(page.locator("#quests")).toBeVisible(); await tc("#tdrGo"); await go("#trends"); await go("#achievements"); await go("#subjects"); await tc("#rrSave"); });
  await step("far-future", async () => { await page.clock.setFixedTime(new Date("2026-12-20T09:00:00-05:00")); await page.reload(); await expect(page.locator("#quests")).toBeVisible(); await tc("#tdrGo"); await go("#trends"); await go("#today"); });
  return errs;
}

for (const [label, vp] of [["phone", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }], ["desktop", { viewport: { width: 1280, height: 900 } }]]) {
  test.describe(label, () => {
    test.use(vp);
    for (const [mode, cfgX] of [["challenge", {}], ["casual", { noStreak: [{ from: "2026-10-20" }] }], ["fresh", null]]) {
      test(`${label} ${mode}`, async ({ page }) => {
        test.setTimeout(420000);
        const opts = mode === "fresh" ? { cfg: { quests: [], rules: [] }, days: {} } : { cfg: { quests: Q, subjects: SUBJ, rules: RULES, busy, rep, nf: { on: true }, showPlan: true, addTrends: true, sparkTools: true, ...cfgX }, days: days(), extra: { "pc-doneopen": "1" } };
        const errs = await crawl(page, `${label}/${mode}`, opts);
        console.log("CRAWL " + label + "/" + mode + ": " + errs.length + " issue(s)\n" + errs.map((e) => "  - " + e).join("\n"));
      });
    }
  });
}

import { test, expect } from "@playwright/test";
import { openApp, dayRange } from "./helpers.mjs";

const RQ = [{ id: "cs", type: "time", label: "CS work", min: 60, roll: 420 }];

const JW = [{ id: "j", type: "check", label: "Journal" }, { id: "cs", type: "time", label: "CS work", min: 60, roll: 420, addedOn: "2026-10-26" }];
const wk = (csPerDay) => dayRange("2026-10-26", "2026-11-01", () => ({ j: true, cs: csPerDay, q: JW }));
const strip = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#strip i[data-k]")].map((i) => [i.getAttribute("data-k"), i.className.split(" ")[0]])));

test("weekly totals aren't required day to day: a day with only a total is a rest day", async ({ page }) => {
  const W = [{ id: "cs", type: "time", label: "CS work", min: 60, roll: 420, addedOn: "2026-11-02" }];
  await openApp(page, { now: "2026-11-04T09:00:00-05:00", cfg: { quests: [...W, { id: "j", type: "check", label: "Journal" }] }, days: { "2026-11-02": { j: true, q: W.concat([{ id: "j", type: "check", label: "Journal" }]) }, "2026-11-03": { j: true, q: W.concat([{ id: "j", type: "check", label: "Journal" }]) } } });
  const m = await strip(page);
  expect([m["2026-11-02"], m["2026-11-03"]]).toEqual(["ok", "ok"]);
  await expect(page.locator("#qCount")).toHaveText("0/1 done");
  await expect(page.locator("#carryNote")).toContainText("Keep this week: CS work 0m/2h 20m by Thu");
});

test("reaching the weekly total keeps the week's cleared days", async ({ page }) => {
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: JW, start: "2026-10-26T04:00:00.000Z" }, days: { ...wk(60), "2026-11-02": { j: true, q: JW } } });
  const m = await strip(page);
  expect(["2026-10-26", "2026-10-29", "2026-11-01", "2026-11-02"].map((d) => m[d])).toEqual(["ok", "ok", "ok", "ok"]);
  await expect(page.locator("#gModal")).toBeHidden();
});

test("missing the weekly total loses the whole week and resets the streak", async ({ page }) => {
  const days = dayRange("2026-10-26", "2026-11-01", (k) => ({ j: true, cs: k <= "2026-10-29" ? 60 : 0, q: JW }));
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: JW, start: "2026-10-26T04:00:00.000Z" }, days: { ...days, "2026-11-02": { j: true, q: JW } } });
  const m = await strip(page);
  expect(["2026-10-26", "2026-10-29", "2026-11-01", "2026-11-02"].map((d) => m[d])).toEqual(["lost", "lost", "lost", "ok"]);
  await page.click("#strip i[data-k='2026-10-29']");
  await expect(page.locator("#gBody .mhead")).toContainText("Lost: a weekly total was missed that period (CS work)");
  await expect(page.locator("#gBody")).toContainText("1h · 4h of 7h this week");
});

test("strict mode adds the commitment check and weekly easing budget", async ({ page }) => {
  const Q = [...Array(5)].map((_, i) => ({ id: "a" + i, type: "check", label: "Quest " + i })).concat([{ id: "cs", type: "time", label: "CS", min: 60 }]);
  await openApp(page, { now: "2026-11-20T09:00:00-05:00", cfg: { quests: Q, strict: true } });
  await page.click("#quests .q.t-time .tmr");
  await expect(page.locator("#gTitle")).toHaveText("Commit to this timer?");
  await page.click("#ccNo");
  await page.click("#hdrEdit");
  for (let k = 0; k < 4; k++) await page.evaluate(() => { const b = document.querySelector("#qmgr [data-del]"); b.click(); document.querySelector("#qmgr [data-del]").click(); });
  await page.click("#mgrSaveTop");
  await expect(page.locator("#qmgr [data-mmsg]")).toContainText("3 of 3 left");
});

test("without strict mode timers start immediately", async ({ page }) => {
  await openApp(page, { cfg: { quests: [{ id: "cs", type: "time", label: "CS", min: 60 }] } });
  await page.click("#quests .q.t-time .tmr");
  await expect(page.locator("#gModal")).toBeHidden();
  await expect(page.locator("#quests .q.running")).toBeVisible();
});

test("weekly totals reset on Monday and need a share of the week so far", async ({ page }) => {
  const RQ2 = [{ id: "cs", type: "time", label: "CS work", min: 60, roll: 420, addedOn: "2026-10-01" }];
  const days = { "2026-11-07": { cs: 420, q: RQ2, ended: true }, "2026-11-08": { cs: 0, q: RQ2, ended: true } };
  await openApp(page, { now: "2026-11-10T09:00:00-05:00", cfg: { quests: RQ2 }, days: { ...days, "2026-11-09": { cs: 60, q: RQ2, ended: true } } });
  await page.locator("#quests .q", { hasText: "CS work" }).locator(".pzb").click();
  await page.click(".qmenu button:has-text('View details')");
  const row = await page.locator("#gBody .dt-r").filter({ has: page.locator("span", { hasText: /^This week$/ }) }).textContent();
  expect(row).toContain("1h of 7h");
  expect(row).toContain("need 2h by today");
});

test("switching a daily quest to a weekly total starts tomorrow", async ({ page }) => {
  const D = [{ id: "cs", type: "time", label: "CS work", min: 60 }];
  await openApp(page, { now: "2026-11-20T09:00:00-05:00", cfg: { quests: D } });
  await page.click("#hdrEdit");
  await page.click("#qmgr [data-tog='cs']");
  await page.selectOption("#qmgr select[data-p=rollmode]", "roll");
  await page.click("#mgrSaveTop");
  await expect(page.locator("#sync")).toContainText("tomorrow");
  await expect(page.locator("#quests .q .req")).toHaveText("min 1 hour");
});

test("a weekly quest that started mid-week explains its smaller first-week target", async ({ page }) => {
  const W = [{ id: "w", type: "time", label: "Deep work", min: 90, roll: 420, addedOn: "2026-11-05" }];
  await openApp(page, { now: "2026-11-08T09:00:00-05:00", cfg: { quests: W, start: "2026-11-05T05:00:00.000Z" }, days: { "2026-11-05": { w: 90, q: W, ended: true }, "2026-11-06": { w: 90, q: W, ended: true }, "2026-11-07": { w: 90, q: W, ended: true } } });
  await expect(page.locator("#quests .q .req")).toContainText("4h this week (started");
  await page.locator("#quests .q .pzb").click();
  await page.click(".qmenu button:has-text('View details')");
  await expect(page.locator("#gBody .dt-r", { hasText: "This week’s target" })).toContainText("4 of 7 work days");
});

const MWF = [{ id: "w", type: "time", label: "Deep work", min: 60, roll: 360, days: [1, 3, 5], addedOn: "2026-10-01" }];

test("weekly totals pace by work days only", async ({ page }) => {
  await openApp(page, { now: "2026-11-10T09:00:00-05:00", cfg: { quests: MWF }, days: { "2026-11-09": { w: 120, q: MWF, ended: true } } });
  await page.click("#offSep");
  await page.locator("#quests .q", { hasText: "Deep work" }).locator(".pzb").click();
  await page.click(".qmenu button:has-text('View details')");
  const row = await page.locator("#gBody .dt-r").filter({ has: page.locator("span", { hasText: /^This week$/ }) }).textContent();
  expect(row).toContain("2h of 6h");
  expect(row).toContain("need 2h by today");
});

test("on an off day the weekly quest is visible but optional", async ({ page }) => {
  await openApp(page, { now: "2026-11-10T09:00:00-05:00", cfg: { quests: MWF }, days: { "2026-11-09": { w: 120, q: MWF, ended: true } } });
  const row = page.locator("#quests .q", { hasText: "Deep work" });
  await expect(row.locator(".req")).toContainText("off day");
  await expect(page.locator("#qCount")).toBeHidden();
  await expect(page.locator("#offSep")).toContainText("Off today (1)");
  await expect(page.locator("#pausedNote")).not.toContainText("Not scheduled");
  await expect(row).toBeHidden();
  await page.click("#offSep");
  await expect(row).toBeVisible();
});

test("logging time on an off day counts for the week but never marks it done", async ({ page }) => {
  const TT = [{ id: "w", type: "time", label: "Deep work", min: 60, roll: 240, days: [2, 4], addedOn: "2026-10-01" }];
  await openApp(page, { now: "2026-11-09T09:00:00-05:00", cfg: { quests: TT } });
  await page.click("#offSep");
  const row = page.locator("#quests .q", { hasText: "Deep work" });
  await row.locator(".tapnum").last().click();
  await page.fill("#numIn", "10");
  await page.click("#numGo");
  await expect(row).toHaveClass(/offq/);
  await expect(row).not.toHaveClass(/indone/);
  await expect(row).not.toHaveClass(/\bmet\b/);
  await expect(page.locator("#doneSep")).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).days["2026-11-09"].w)).toBe(10);
});

test("off-day weekly quests stay out of the schedule and Just 5", async ({ page }) => {
  const Q = [...MWF, { id: "cs", type: "time", label: "CS", min: 60 }];
  await openApp(page, { now: "2026-11-10T09:00:00-05:00", cfg: { quests: Q } });
  await page.click("#schBtn");
  await expect(page.locator("[data-sq]")).toHaveText(["CS 1h"]);
  await page.click("#schOk");
  await page.click("#sp5Btn");
  await expect(page.locator("#quests .q.running")).toContainText("CS");
});

test("first-week target counts remaining work days", async ({ page }) => {
  const Q = [{ ...MWF[0], addedOn: "2026-11-11" }];
  await openApp(page, { now: "2026-11-11T09:00:00-05:00", cfg: { quests: Q } });
  await page.locator("#quests .q", { hasText: "Deep work" }).locator(".pzb").click();
  await page.click(".qmenu button:has-text('View details')");
  await expect(page.locator("#gBody .dt-r", { hasText: "This week’s target" })).toContainText("4h (started Nov 11, so 2 of 3 work days)");
});

const PQ = [{ id: "cs", type: "time", label: "CS work", min: 60 }, { id: "j", type: "check", label: "Journal" }];
const pq = (page) => page.evaluate(() => { const q = JSON.parse(localStorage.getItem("pc-cache-v1")).cfg.quests[0]; return [q.pausedFrom || null, q.pausedUntil || null]; });
async function menu(page) {
  await page.locator("#quests .q", { hasText: "CS work" }).locator(".pzb").click();
  return page.locator(".qmenu button").allTextContents();
}
for (const [now, from, until] of [["2026-11-04T09:00:00-05:00", "2026-11-05", "2026-11-09"], ["2026-11-07T09:00:00-05:00", "2026-11-08", "2026-11-09"]]) {
  test(`pausing lasts until Sunday of this week (${now.slice(0, 10)})`, async ({ page }) => {
    await openApp(page, { now, cfg: { quests: PQ } });
    expect(await menu(page)).toContain("Pause until Sunday");
    await page.click(".qmenu button:has-text('Pause until Sunday')");
    await expect.poll(() => pq(page)).toEqual([from, until]);
    await expect(page.locator("#sync")).toContainText("from tomorrow through Sunday");
  });
}

test("on a Sunday there's nothing left to pause this week", async ({ page }) => {
  await openApp(page, { now: "2026-11-08T09:00:00-05:00", cfg: { quests: PQ } });
  const items = await menu(page);
  expect(items.some((t) => /^Pause/.test(t))).toBe(false);
});

test("during setup, a Sunday pause covers just today", async ({ page }) => {
  await openApp(page, { now: "2026-11-08T09:00:00-05:00", cfg: { quests: PQ, start: "2026-11-05T05:00:00.000Z" } });
  await menu(page);
  await page.click(".qmenu button:has-text('Pause for today')");
  await expect.poll(() => pq(page)).toEqual(["2026-11-08", "2026-11-09"]);
  await expect(page.locator("#pausedNote")).toContainText("Paused: CS work (until Nov 8)");
});

const MW = [{ id: "j", type: "check", label: "Journal" }, { id: "cs", type: "time", label: "Coursework", min: 60, roll: 1200, days: [1, 3, 5, 0], addedOn: "2026-10-26" }];
test("halfway checkpoint: 20h over Mo/We/Fr/Su needs a third (6h 40m) by Wednesday, or Monday to Wednesday is lost at once", async ({ page }) => {
  const d = (cs) => ({ j: true, cs, q: MW });
  await openApp(page, { now: "2026-11-05T09:00:00-05:00", cfg: { quests: MW, start: "2026-11-02T05:00:00.000Z" }, days: { "2026-11-02": d(120), "2026-11-03": d(0), "2026-11-04": d(240) } });
  const m = await strip(page);
  expect(["2026-11-02", "2026-11-03", "2026-11-04"].map((k) => m[k])).toEqual(["lost", "lost", "lost"]);
  await page.click("#strip i[data-k='2026-11-03']");
  await expect(page.locator("#gBody .mhead")).toContainText("Lost: a weekly total was missed that halfway checkpoint (Coursework)");
});

test("halfway checkpoint met: the week carries on, and the banner shows the full total", async ({ page }) => {
  const d = (cs) => ({ j: true, cs, q: MW });
  await openApp(page, { now: "2026-11-05T09:00:00-05:00", cfg: { quests: MW, start: "2026-11-02T05:00:00.000Z" }, days: { "2026-11-02": d(300), "2026-11-03": d(0), "2026-11-04": d(300) } });
  const m = await strip(page);
  expect(["2026-11-02", "2026-11-03", "2026-11-04"].map((k) => m[k])).toEqual(["ok", "ok", "ok"]);
  await expect(page.locator("#carryNote")).toContainText("Keep this week: Coursework 10h/20h by Sun");
});

test("before the checkpoint the banner asks for a third by the middle work day", async ({ page }) => {
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: MW, start: "2026-11-02T05:00:00.000Z" }, days: { "2026-11-02": { j: true, cs: 120, q: MW } } });
  await expect(page.locator("#carryNote")).toContainText("Coursework 2h/6h 40m by Wed");
});

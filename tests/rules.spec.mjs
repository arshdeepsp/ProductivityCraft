import { test, expect } from "@playwright/test";
import { openApp, dayRange } from "./helpers.mjs";

const RQ = [{ id: "cs", type: "time", label: "CS work", min: 60, roll: 420 }];

test("weekly totals carry empty days only while the surplus lasts", async ({ page }) => {
  const days = dayRange("2026-10-01", "2026-11-02", (k) => ({ cs: k === "2026-11-02" ? 240 : 60, q: RQ, ended: true }));
  await openApp(page, { now: "2026-11-07T09:00:00-05:00", cfg: { quests: RQ }, days });
  const marks = await page.evaluate(() => [...document.querySelectorAll("#strip i")].slice(-5, -1).map((i) => i.className));
  expect(marks).toEqual(["carried", "carried", "carried", "grace"]);
  await expect(page.locator("#carryNote")).toContainText("don’t cover today");
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
  await page.locator("#quests .q", { hasText: "Deep work" }).locator(".pzb").click();
  await page.click(".qmenu button:has-text('View details')");
  const row = await page.locator("#gBody .dt-r").filter({ has: page.locator("span", { hasText: /^This week$/ }) }).textContent();
  expect(row).toContain("2h of 6h");
  expect(row).toContain("need 2h by today");
});

test("on an off day the weekly quest is visible but optional", async ({ page }) => {
  await openApp(page, { now: "2026-11-10T09:00:00-05:00", cfg: { quests: MWF }, days: { "2026-11-09": { w: 120, q: MWF, ended: true } } });
  await expect(page.locator("#quests .q", { hasText: "Deep work" }).locator(".req")).toContainText("off day");
  await expect(page.locator("#qCount")).toBeHidden();
});

test("first-week target counts remaining work days", async ({ page }) => {
  const Q = [{ ...MWF[0], addedOn: "2026-11-11" }];
  await openApp(page, { now: "2026-11-11T09:00:00-05:00", cfg: { quests: Q } });
  await page.locator("#quests .q", { hasText: "Deep work" }).locator(".pzb").click();
  await page.click(".qmenu button:has-text('View details')");
  await expect(page.locator("#gBody .dt-r", { hasText: "This week’s target" })).toContainText("4h (started Nov 11, so 2 of 3 work days)");
});

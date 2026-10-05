import { test, expect } from "@playwright/test";
import { openApp, visibleLabels } from "./helpers.mjs";

const Q = [
  { id: "cs", type: "time", label: "CS work", min: 60 },
  { id: "j", type: "check", label: "Journal" },
  { id: "sl", type: "limit", label: "Slips", max: 30, unit: "min" },
  { id: "td", type: "todo", label: "Email advisor" }
];

test("loads every tab without errors", async ({ page }) => {
  const errors = await openApp(page, { cfg: { quests: Q, addTrends: true } });
  for (const v of ["subjects", "rules", "achievements", "trends", "settings", "today"]) {
    await page.evaluate((h) => (location.hash = "#" + h), v);
    await page.waitForTimeout(150);
  }
  expect(errors).toEqual([]);
});

test("count chip counts required quests only", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-02": { j: true, q: Q } } });
  await expect(page.locator("#qCount")).toHaveText("1/2 done");
});

test("clearing every required quest clears the day", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-02": { cs: 60, j: true, q: Q } } });
  await page.waitForTimeout(200);
  const mark = await page.evaluate(() => document.querySelector("#strip i.today, #strip i:last-child").className);
  expect(mark).toMatch(/ok/);
});

test("breaking a limit fails the day", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-02": { cs: 60, j: true, sl: 45, q: Q } } });
  await expect(page.locator("#qCount")).toHaveText("2/2 done");
  await page.waitForTimeout(200);
  const mark = await page.evaluate(() => document.querySelector("#strip i:last-child").className);
  expect(mark).not.toMatch(/\bok\b/);
});

test("finished quests fold into Done today", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-02": { j: true, q: Q } } });
  expect(await visibleLabels(page)).not.toContain("Journal");
  await page.click("#doneSep");
  expect(await visibleLabels(page)).toContain("Journal");
});

test("easing a quest only takes effect tomorrow", async ({ page }) => {
  await openApp(page, { now: "2026-11-20T09:00:00-05:00", cfg: { quests: Q } });
  await page.click("#hdrEdit");
  await page.click("#qmgr [data-tog='cs']");
  await page.fill("#qmgr input[data-p=min][data-i='0']", "30");
  await page.click("#mgrSaveTop");
  await expect(page.locator("#sync")).toContainText("tomorrow");
  const req = await page.evaluate(() => document.querySelector("#quests .q.t-time .req").textContent);
  expect(req).toBe("min 1 hour");
});

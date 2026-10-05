import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const base = [{ id: "j", type: "check", label: "Journal" }];

async function addQuest(page, name, weekly) {
  await page.click("#hdrAdd");
  await page.click("#aoQuest");
  await page.click("#nqBody [data-t='time']");
  await page.fill("#nqName", name);
  if (weekly) await page.click("[data-goal='1']");
  await page.click("#nqSave");
  await page.waitForTimeout(150);
}

test("a daily quest added after the day's midpoint doesn't count today", async ({ page }) => {
  await openApp(page, { now: "2026-11-03T17:00:00-05:00", cfg: { quests: base }, days: { "2026-11-03": { j: true, q: base } } });
  await addQuest(page, "Late study");
  await expect(page.locator("#qCount")).toHaveText("1/1 done");
  await expect(page.locator("#quests .q", { hasText: "Late study" }).locator(".req")).toContainText("counts from tomorrow");
});

test("a daily quest added in the morning counts today", async ({ page }) => {
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: base }, days: { "2026-11-03": { j: true, q: base } } });
  await addQuest(page, "Morning study");
  await expect(page.locator("#qCount")).toHaveText("1/2 done");
});

test("a weekly quest added after midweek waits until next Monday", async ({ page }) => {
  await openApp(page, { now: "2026-11-08T05:00:00-05:00", cfg: { quests: base }, days: { "2026-11-08": { j: true, q: base } } });
  await addQuest(page, "Weekly reading", true);
  await expect(page.locator("#quests .q", { hasText: "Weekly reading" })).toHaveCount(0);
  await expect(page.locator("#waitList")).toContainText("Weekly reading");
  await expect(page.locator("#qCount")).toHaveText("1/1 done");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).cfg.quests.find((x) => x.label === "Weekly reading").startOn)).toBe("2026-11-09");
});

test("a waiting quest appears on its start day with a fresh weekly target", async ({ page }) => {
  const W = [{ id: "w", type: "time", label: "Weekly reading", min: 30, roll: 960, startOn: "2026-11-09" }];
  await openApp(page, { now: "2026-11-09T09:00:00-05:00", cfg: { quests: W } });
  await expect(page.locator("#quests .q", { hasText: "Weekly reading" })).toHaveCount(1);
  await expect(page.locator("#waitList")).toBeHidden();
});

test("an existing quest can be moved to start next week from Edit quests", async ({ page }) => {
  const W = [{ id: "w", type: "time", label: "Weekly reading", min: 30, roll: 960 }];
  await openApp(page, { now: "2026-11-08T05:00:00-05:00", cfg: { quests: W } });
  await page.click("#hdrEdit");
  await page.click("#qmgr [data-tog='w']");
  await page.fill("#qmgr input[data-p=startOn]", "2026-11-09");
  await page.dispatchEvent("#qmgr input[data-p=startOn]", "change");
  await page.click("#mgrSaveTop");
  await page.waitForTimeout(150);
  await expect(page.locator("#waitList")).toContainText("Weekly reading");
});

test("a weekly quest added early in the week is prorated from the day it was added", async ({ page }) => {
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: base }, days: { "2026-11-03": { j: true, q: base } } });
  await addQuest(page, "Weekly reading", true);
  const req = await page.locator("#quests .q", { hasText: "Weekly reading" }).locator(".req").textContent();
  expect(req).not.toContain("counts from");
  const need = await page.evaluate(() => { const q = JSON.parse(localStorage.getItem("pc-cache-v1")).cfg.quests.find((x) => x.label === "Weekly reading"); return [q.addedOn, q.roll]; });
  expect(need[0]).toBe("2026-11-03");
});

test("an older weekly quest is prorated from the first day it appeared", async ({ page }) => {
  const W = [{ id: "w", type: "time", label: "Weekly reading", min: 30, roll: 420 }];
  const days = { "2026-11-06": { w: 60, q: W, ended: true }, "2026-11-07": { w: 60, q: W, ended: true }, "2026-11-08": { q: W } };
  await openApp(page, { now: "2026-11-08T05:00:00-05:00", cfg: { quests: W }, days });
  await page.locator("#quests .q", { hasText: "Weekly reading" }).locator(".pzb").click();
  await page.click(".qmenu button:has-text('View details')");
  const row = await page.locator("#gBody .dt-r").filter({ has: page.locator("span", { hasText: /^This week$/ }) }).textContent();
  expect(row).toContain("2h of 3h");
  expect(row).toContain("1h more today keeps you on pace");
});

test("pushing an existing quest's start date can't remove it from today", async ({ page }) => {
  const W = [{ id: "w", type: "check", label: "Read" }];
  await openApp(page, { now: "2026-11-04T09:00:00-05:00", cfg: { quests: W } });
  await page.click("#hdrEdit");
  await page.click("#qmgr [data-tog='w']");
  await page.fill("#qmgr input[data-p=startOn]", "2026-11-09");
  await page.dispatchEvent("#qmgr input[data-p=startOn]", "change");
  await page.click("#mgrSaveTop");
  await page.waitForTimeout(150);
  await expect(page.locator("#quests .q", { hasText: "Read" })).toHaveCount(1);
});

test("the late-start cutoff is the middle of Your day", async ({ page }) => {
  await openApp(page, { now: "2026-11-03T14:30:00-05:00", cfg: { quests: base, day: { wake: "06:00", bed: "22:00" } }, days: { "2026-11-03": { j: true, q: base } } });
  await addQuest(page, "Afternoon study");
  await expect(page.locator("#quests .q", { hasText: "Afternoon study" }).locator(".req")).toContainText("counts from tomorrow");
});

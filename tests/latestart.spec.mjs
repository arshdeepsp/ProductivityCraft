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

test("a weekly quest added after midweek doesn't count until next week", async ({ page }) => {
  await openApp(page, { now: "2026-11-06T10:00:00-05:00", cfg: { quests: base }, days: { "2026-11-06": { j: true, q: base } } });
  await addQuest(page, "Weekly reading", true);
  await expect(page.locator("#qCount")).toHaveText("1/1 done");
  await expect(page.locator("#quests .q", { hasText: "Weekly reading" }).locator(".req")).toContainText("counts from next week");
});

test("a weekly quest added early in the week is prorated from the day it was added", async ({ page }) => {
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: base }, days: { "2026-11-03": { j: true, q: base } } });
  await addQuest(page, "Weekly reading", true);
  const req = await page.locator("#quests .q", { hasText: "Weekly reading" }).locator(".req").textContent();
  expect(req).not.toContain("counts from");
  const need = await page.evaluate(() => { const q = JSON.parse(localStorage.getItem("pc-cache-v1")).cfg.quests.find((x) => x.label === "Weekly reading"); return [q.addedOn, q.roll]; });
  expect(need[0]).toBe("2026-11-03");
});

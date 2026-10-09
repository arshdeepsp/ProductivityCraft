import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const J = { id: "j", type: "check", label: "Journal" };
const CS = { id: "cs", type: "time", label: "Coursework", min: 60 };
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));

test("Settings names the modes: Challenge on, Casual off", async ({ page }) => {
  await openApp(page, { cfg: { quests: [J] }, hash: "#settings" });
  await expect(page.locator("[data-st='quests']")).toContainText("challenge");
  await page.click("[data-st='quests']");
  const row = page.locator(".srow", { has: page.locator("#setStreak") });
  await expect(row).toContainText("Challenge mode");
  await expect(row).toContainText("Off = Casual");
  await page.click("#setStreak");
  await expect(row).toContainText("Casual since Nov 2");
  await expect(page.locator("#sync")).toContainText("Casual mode");
});

test("in Casual an easing change applies today; in Challenge it waits for tomorrow", async ({ page }) => {
  await openApp(page, { now: "2026-11-20T09:00:00-05:00", cfg: { quests: [CS], noStreak: [{ from: "2026-11-01" }] }, days: { "2026-11-20": { cs: 30, q: [CS] } } });
  await page.click("#hdrEdit");
  await page.click("#qmgr [data-tog='cs']");
  await page.fill("#qmgr input[data-p=min][data-i='0']", "30");
  await page.click("#mgrSaveTop");
  await expect(page.locator("#sync")).not.toContainText("tomorrow");
  await expect(page.locator("#quests .q.t-time")).toHaveClass(/met/);
  expect((await store(page)).cfg.lockDay).toBeUndefined();
});

test("in Casual a pause starts today, not tomorrow", async ({ page }) => {
  await openApp(page, { now: "2026-11-04T09:00:00-05:00", cfg: { quests: [J, CS], noStreak: [{ from: "2026-11-01" }] } });
  await page.locator("#quests .q", { hasText: "Coursework" }).locator(".pzb").click();
  await page.click(".qmenu button:has-text('Pause until')");
  const q = (await store(page)).cfg.quests.find((x) => x.id === "cs");
  expect(q.pausedFrom).toBe("2026-11-04");
  await expect(page.locator("#quests .q", { hasText: "Coursework" })).toHaveCount(0);
});

test("each daily quest shows its own streak from history, skipping days it wasn't scheduled; Details adds 30-day consistency", async ({ page }) => {
  const G = { id: "g", type: "check", label: "Gym", days: [1, 3, 5] };
  const days = { "2026-10-26": { j: true, g: true, q: [J, G] }, "2026-10-28": { j: true, g: true, q: [J, G] }, "2026-10-29": { j: false, q: [J, G] }, "2026-10-30": { j: true, g: true, q: [J, G] }, "2026-10-31": { j: true, q: [J, G] }, "2026-11-01": { j: true, q: [J, G] } };
  await openApp(page, { cfg: { quests: [J, G] }, days, extra: { "pc-doneopen": "1" } });
  const chip = (t) => page.locator("#quests .q", { hasText: t }).locator(".qstk");
  await expect(chip("Gym")).toHaveText("3");
  await expect(chip("Journal")).toHaveText("3");
  await expect(page.locator("#quests .q", { hasText: "Gym" })).toHaveCount(1);
  await page.locator("#quests .q", { hasText: "Journal" }).locator(".sw").click();
  await expect(chip("Journal")).toHaveText("4");
  await page.locator("#quests .q", { hasText: "Journal" }).locator(".pzb").click();
  await page.click(".qmenu button:has-text('View details')");
  await expect(page.locator("#gBody .dt-r", { hasText: "In a row" })).toContainText("4 days");
  await expect(page.locator("#gBody .dt-r", { hasText: "Last 30 days" })).toContainText("6 of 8 (75%)");
});

test("a day the quest was paused is skipped, not broken; a day it was simply missed breaks it", async ({ page }) => {
  const JP = { ...J, pausedFrom: "2026-11-01", pausedUntil: "2026-11-02" };
  const days = { "2026-10-30": { j: true, q: [J] }, "2026-10-31": { j: true, q: [J] }, "2026-11-01": { q: [] } };
  await openApp(page, { cfg: { quests: [JP] }, days });
  await expect(page.locator("#quests .q .qstk")).toHaveText("2");
  await page.evaluate(() => { const c = JSON.parse(localStorage.getItem("pc-cache-v1")); c.days["2026-10-31"] = { q: c.days["2026-10-31"].q }; localStorage.setItem("pc-cache-v1", JSON.stringify(c)); });
  await page.reload();
  await expect(page.locator("#quests .q .qstk")).toBeHidden();
});

test("Repair for 200 XP buys back the day that reset the streak; the level pays for it", async ({ page }) => {
  const days = { "2026-10-27": { j: true, q: [J] }, "2026-10-28": { j: true, q: [J] }, "2026-10-29": { j: true, q: [J] }, "2026-10-30": { j: true, q: [J] }, "2026-10-31": { q: [J] }, "2026-11-01": { q: [J] } };
  await openApp(page, { cfg: { quests: [J] }, days });
  await expect(page.locator("#stStreak")).toHaveText("0 days");
  await expect(page.locator("#lvlText")).toHaveText("380 / 600 XP");
  const card = page.locator("#resetCard");
  await expect(card).toContainText("Streak reset on Nov 1");
  await page.click("#rcRepair");
  await expect(page.locator("#rcRepair")).toHaveText("Spend 200 XP?");
  await page.click("#rcRepair");
  await expect(card).toBeHidden();
  await expect(page.locator("#stStreak")).toHaveText("5 days");
  await expect(page.locator("#lvlText")).toHaveText("180 / 600 XP");
  const s = await store(page);
  expect(s.cfg.xpSpent).toBe(200);
  expect(s.days["2026-11-01"].rep).toBe(true);
  expect(s.refl["2026-11-01"].repaired).toBe(true);
  await page.reload();
  await expect(page.locator("#resetCard")).toBeHidden();
  await expect(page.locator("#stStreak")).toHaveText("5 days");
});

test("no repair button without the XP to pay, or in Casual", async ({ page }) => {
  const days = { "2026-10-30": { j: true, q: [J] }, "2026-10-31": { q: [J] }, "2026-11-01": { q: [J] } };
  await openApp(page, { cfg: { quests: [J] }, days });
  await expect(page.locator("#resetCard")).toBeVisible();
  await expect(page.locator("#rcRepair")).toHaveCount(0);
});

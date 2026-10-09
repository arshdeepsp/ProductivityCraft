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

import { test, expect } from "@playwright/test";
import { openApp, visibleLabels } from "./helpers.mjs";

const Q = [
  { id: "cs", type: "time", label: "CS work", min: 60 },
  { id: "mu", type: "time", label: "Music", min: 60 }
];

test("a running timer enters Focus, shows one card, and restores on stop", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q } });
  await page.click("#quests .q:nth-child(1) .tmr");
  await page.clock.runFor(30 * 60 * 1000);
  expect(await page.evaluate(() => document.body.classList.contains("focusview"))).toBe(true);
  expect(await visibleLabels(page)).toEqual(["CS work"]);
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.body.classList.contains("focusview")), { timeout: 5000 }).toBe(true);
  await page.click("#quests .q.running .tmr");
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.body.classList.contains("focusview"))).toBe(false);
  await expect(page.locator("#quests .q.t-time").first().locator(".act output")).toHaveText("30m");
});

test("the screen wake lock is taken again when the app comes back to the front", async ({ page }) => {
  await page.addInitScript(() => {
    window.__wl = 0;
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: () => { window.__wl++; return Promise.resolve({ release: () => Promise.resolve() }); } } });
  });
  await openApp(page, { cfg: { quests: Q } });
  await page.click("#quests .q:nth-child(1) .tmr");
  await expect.poll(() => page.evaluate(() => window.__wl)).toBe(1);
  const flip = (v) => page.evaluate((st) => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => st }); document.dispatchEvent(new Event("visibilitychange")); }, v);
  await flip("hidden");
  await flip("visible");
  await expect.poll(() => page.evaluate(() => window.__wl)).toBe(2);
});

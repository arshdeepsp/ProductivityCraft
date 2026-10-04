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

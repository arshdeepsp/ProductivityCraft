import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const Q = [{ id: "th", type: "time", label: "Thesis", min: 90, addedOn: "2026-10-01" }, { id: "gym", type: "check", label: "Gym", addedOn: "2026-10-01" }];

test("ending a sprint takes two taps on Stop even though the panel redraws every second", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q } });
  await page.click("#toolsBtn");
  await page.click(".qmenu button:has-text('Sprint')");
  await page.click("#spGo");
  await page.click("#spStop");
  await expect(page.locator("#spStop")).toHaveText("Confirm stop");
  await page.clock.runFor(2500);
  await expect(page.locator("#spStop")).toHaveText("Confirm stop");
  await page.click("#spStop");
  await expect(page.locator("#sprint")).toContainText("Sprint complete");
  await page.click("#spDone");
  await expect(page.locator("#sprint")).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).sprint)).toBeNull();
});

test("an armed Stop disarms on its own after a few seconds", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q } });
  await page.click("#toolsBtn");
  await page.click(".qmenu button:has-text('Sprint')");
  await page.click("#spGo");
  await page.click("#spStop");
  await expect(page.locator("#spStop")).toHaveText("Confirm stop");
  await page.clock.runFor(5000);
  await expect(page.locator("#spStop")).toHaveText("Stop sprint");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).sprint.phase)).toBe("focus");
});

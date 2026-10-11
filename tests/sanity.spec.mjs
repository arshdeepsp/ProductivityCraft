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

test("the to-do review waits while the schedule is open and shows once it closes", async ({ page }) => {
  const Q = [{ id: "a", type: "todo", label: "Email advisor", addedOn: "2026-11-01" }, { id: "cs", type: "time", label: "CS", min: 30 }];
  await openApp(page, { cfg: { quests: Q }, extra: { "pc-todoreview": "2026-11-02" } });
  await page.click("#schBtn");
  await page.evaluate(() => { localStorage.removeItem("pc-todoreview"); document.dispatchEvent(new Event("visibilitychange")); });
  await page.clock.runFor(1500);
  await expect(page.locator("#gModal")).toBeHidden();
  await page.click("#schOk");
  await page.clock.runFor(1500);
  await expect(page.locator("#gTitle")).toHaveText("Still need these to-dos?");
});

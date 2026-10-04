import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const Q = [
  { id: "cs", type: "time", label: "CS work", min: 60 },
  { id: "mu", type: "time", label: "Music", min: 30 }
];

test("Just 5 picks the first unfinished time quest in list order", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-02": { cs: 40, q: Q } } });
  await page.click("#sp5Btn");
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).timer.id)).toBe("cs");
});

test("Just 5 skips time quests that are already done", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-02": { cs: 60, q: Q } } });
  await page.click("#sp5Btn");
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).timer.id)).toBe("mu");
});

test("when everything is done, Just 5 offers a bonus instead of guessing", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-02": { cs: 60, mu: 30, q: Q } } });
  await expect(page.locator("#sp5Btn")).toContainText("Bonus 5");
  await page.click("#sp5Btn");
  await expect(page.locator("#gTitle")).toHaveText("All done today");
  await page.click("[data-b5='cs']");
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).timer.id)).toBe("cs");
});

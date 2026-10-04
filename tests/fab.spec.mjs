import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test("the + button sits above the tab bar, including after leaving Focus", async ({ page }) => {
  await openApp(page, { cfg: { quests: [{ id: "j", type: "check", label: "Journal" }] }, extra: { "pc-focusview": "1" } });
  await page.click("#focusBtn");
  await page.waitForTimeout(200);
  const gap = await page.evaluate(() => document.getElementById("mainnav").getBoundingClientRect().top - document.getElementById("fabAdd").getBoundingClientRect().bottom);
  expect(gap).toBeGreaterThanOrEqual(8);
});

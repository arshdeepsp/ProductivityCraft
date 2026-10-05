import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const mk = (n, days, extra = {}) => [...Array(n)].map((_, i) => ({ id: `${days.join("")}${i}`, type: "check", label: `Q${days.join("")}-${i}`, days, ...extra }));

test("more than the limit in total is fine when each day stays under it", async ({ page }) => {
  const Q = [...mk(6, [1, 3, 5]), ...mk(6, [2, 4])];
  await openApp(page, { cfg: { quests: Q, cap: 6 } });
  await page.click("#hdrAdd");
  await page.click("#aoQuest");
  await page.fill("#nqName", "Weekend walk");
  await page.click("#nqBody [data-d='1']");
  await page.click("#nqBody [data-d='2']");
  await page.click("#nqBody [data-d='3']");
  await page.click("#nqBody [data-d='4']");
  await page.click("#nqBody [data-d='5']");
  await page.click("#nqSave");
  await page.waitForTimeout(150);
  const n = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).cfg.quests.length);
  expect(n).toBe(13);
});

test("adding a 7th quest to a full day is blocked with the day named", async ({ page }) => {
  await openApp(page, { cfg: { quests: mk(6, [1, 3, 5]), cap: 6 } });
  await page.click("#hdrAdd");
  await page.click("#aoQuest");
  await page.fill("#nqName", "One more");
  await page.click("#nqSave");
  await expect(page.locator("#nqBody .cmsg2")).toContainText("Mondays would have 7");
});

test("optional quests don't count toward the daily limit", async ({ page }) => {
  await openApp(page, { cfg: { quests: mk(6, [0, 1, 2, 3, 4, 5, 6]), cap: 6 } });
  await page.click("#hdrAdd");
  await page.click("#aoQuest");
  await page.fill("#nqName", "Stretch goal");
  await page.click("#nqBody #nqOpt");
  await page.click("#nqSave");
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).cfg.quests.length)).toBe(7);
});

test("lowering the limit below a busy day explains which days to lighten", async ({ page }) => {
  await openApp(page, { cfg: { quests: mk(7, [1]), cap: 10 } });
  await page.click("#setBtn");
  await page.click("[data-st='quests']");
  await page.selectOption("#setCap", "5");
  await expect(page.locator("#gTitle")).toHaveText("Too many quests on some days");
  await expect(page.locator("#gBody .dt-r")).toContainText("Mondays");
});

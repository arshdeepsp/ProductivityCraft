import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const SJ = [{ id: "s1", name: "Maths", topics: [{ id: "a", name: "Algebra", p: 3, hist: [] }] }];
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));

test("the new-quest form is name + goal + days; starts, limit and topics wait under More options", async ({ page }) => {
  await openApp(page, { cfg: { quests: [], subjects: SJ } });
  await page.click("#hdrAdd");
  await page.click("#aoQuest");
  await page.click("#nqBody .tcard[data-t='time']");
  await expect(page.locator("#nqBody input[data-n='min']")).toBeVisible();
  await expect(page.locator("#nqBody .days")).toBeVisible();
  await expect(page.locator("#nqBody [data-start]")).toHaveCount(0);
  await expect(page.locator("#nqBody input[data-n='lim']")).toHaveCount(0);
  await expect(page.locator("#nqBody [data-ltp]")).toHaveCount(0);
  await expect(page.locator("#nqMoreOpt")).toContainText("More options");
  await expect(page.locator("#nqMoreOpt small")).toHaveText("starts today, no limit, no topics");
  await page.click("#nqMoreOpt");
  await expect(page.locator("#nqMoreOpt")).toContainText("Fewer options");
  await expect(page.locator("#nqBody [data-start]")).toHaveCount(3);
  await page.fill("#nqBody input[data-n='lim']", "45");
  await page.click("#nqBody [data-ltp='a']");
  await page.click("#nqBody [data-start='2026-11-03']");
  await page.click("#nqMoreOpt");
  await expect(page.locator("#nqMoreOpt small")).toHaveText("starts Nov 3 · up to 45 min/day · 1 topic");
  await page.fill("#nqName", "Problem sets");
  await page.click("#nqSave");
  await expect.poll(async () => (await store(page)).cfg.quests.map((q) => [q.label, q.lim, q.topics, q.startOn])).toEqual([["Problem sets", 45, ["a"], "2026-11-03"]]);
});

test("Edit quests folds the same way, and the fold stays open across the editor's redraws", async ({ page }) => {
  const Q = [{ id: "cs", type: "time", label: "CS work", min: 60, note: "Ch. 3", total: 1200 }];
  await openApp(page, { cfg: { quests: Q, subjects: SJ } });
  await page.click("#hdrEdit");
  await page.click("#qmgr [data-tog='cs']");
  await expect(page.locator("#qmgr input[data-p=min]")).toBeVisible();
  await expect(page.locator("#qmgr .days")).toBeVisible();
  await expect(page.locator("#qmgr input[data-p=note]")).toHaveCount(0);
  await expect(page.locator("#qmgr [data-more='cs'] small")).toHaveText("project 20h · note");
  await page.click("#qmgr [data-more='cs']");
  await expect(page.locator("#qmgr input[data-p=note]")).toHaveValue("Ch. 3");
  await expect(page.locator("#qmgr input[data-p=totalh]")).toHaveValue("20");
  await page.selectOption("#qmgr select[data-p=rollmode]", "roll");
  await expect(page.locator("#qmgr input[data-p=note]")).toHaveValue("Ch. 3");
  await expect(page.locator("#qmgr [data-more='cs']")).toContainText("Fewer options");
  await page.click("#qmgr [data-more='cs']");
  await expect(page.locator("#qmgr input[data-p=note]")).toHaveCount(0);
  await expect(page.locator("#qmgr [data-more='cs'] small")).toHaveText("project 20h · note");
});

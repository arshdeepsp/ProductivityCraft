import { test, expect } from "@playwright/test";
import { openApp, dayRange } from "./helpers.mjs";

const RQ = [{ id: "cs", type: "time", label: "CS work", min: 60, roll: 420 }];

test("weekly totals carry empty days only while the surplus lasts", async ({ page }) => {
  const days = dayRange("2026-10-01", "2026-11-02", (k) => ({ cs: k === "2026-11-02" ? 240 : 60, q: RQ, ended: true }));
  await openApp(page, { now: "2026-11-07T09:00:00-05:00", cfg: { quests: RQ }, days });
  const marks = await page.evaluate(() => [...document.querySelectorAll("#strip i")].slice(-5, -1).map((i) => i.className));
  expect(marks).toEqual(["carried", "carried", "carried", "grace"]);
  await expect(page.locator("#carryNote")).toContainText("don’t cover today");
});

test("strict mode adds the commitment check and weekly easing budget", async ({ page }) => {
  const Q = [...Array(5)].map((_, i) => ({ id: "a" + i, type: "check", label: "Quest " + i })).concat([{ id: "cs", type: "time", label: "CS", min: 60 }]);
  await openApp(page, { now: "2026-11-20T09:00:00-05:00", cfg: { quests: Q, strict: true } });
  await page.click("#quests .q.t-time .tmr");
  await expect(page.locator("#gTitle")).toHaveText("Commit to this timer?");
  await page.click("#ccNo");
  await page.click("#hdrEdit");
  for (let k = 0; k < 4; k++) await page.evaluate(() => { const b = document.querySelector("#qmgr [data-del]"); b.click(); document.querySelector("#qmgr [data-del]").click(); });
  await page.click("#mgrSaveTop");
  await expect(page.locator("#qmgr [data-mmsg]")).toContainText("3 of 3 left");
});

test("without strict mode timers start immediately", async ({ page }) => {
  await openApp(page, { cfg: { quests: [{ id: "cs", type: "time", label: "CS", min: 60 }] } });
  await page.click("#quests .q.t-time .tmr");
  await expect(page.locator("#gModal")).toBeHidden();
  await expect(page.locator("#quests .q.running")).toBeVisible();
});

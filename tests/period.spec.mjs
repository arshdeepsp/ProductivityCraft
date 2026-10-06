import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
async function details(page, label) {
  await page.waitForTimeout(200);
  if (!(await page.locator("#quests .q", { hasText: label }).locator(".pzb").isVisible()) && (await page.locator("#doneSep").isVisible())) await page.click("#doneSep");
  await page.locator("#quests .q", { hasText: label }).locator(".pzb").click();
  await page.click(".qmenu button:has-text('View details')");
  const rows = await page.locator("#gBody .dt-r").evaluateAll((L) => Object.fromEntries(L.map((r) => [r.querySelector("span").textContent, r.querySelector("b").textContent])));
  return rows;
}

test("a monthly total runs over the calendar month and paces across its work days", async ({ page }) => {
  const M = [{ id: "m", type: "time", label: "Side project", min: 30, roll: 1200, per: "month" }];
  await openApp(page, { cfg: { quests: M }, days: { "2026-11-01": { m: 40, q: M }, "2026-11-02": { m: 40, q: M } } });
  await expect(page.locator("#quests .q", { hasText: "Side project" }).locator(".req")).toContainText("20 hours per month");
  const r = await details(page, "Side project");
  expect(r["This period (Nov 1–Nov 30)"]).toBe("1h 20m of 20h · need 1h 20m by today · on pace");
});

test("a 2-week total counts from the week the quest started", async ({ page }) => {
  const F = [{ id: "f", type: "time", label: "Sprint work", min: 30, roll: 840, per: "2w", addedOn: "2026-10-26" }];
  await openApp(page, { cfg: { quests: F, start: "2026-10-26T04:00:00.000Z" }, days: { "2026-10-27": { f: 420, q: F }, "2026-11-02": { f: 60, q: F } } });
  const r = await details(page, "Sprint work");
  expect(r["This period (Oct 26–Nov 8)"]).toBe("8h of 14h · need 8h by today · on pace");
});

test("weeks can start on Sunday: totals, pauses and day order follow", async ({ page }) => {
  const W = [{ id: "w", type: "time", label: "Reading", min: 30, roll: 420 }];
  await openApp(page, { cfg: { quests: W, weekStart: 0 }, days: { "2026-11-01": { w: 60, q: W }, "2026-10-31": { w: 200, q: W } } });
  const r = await details(page, "Reading");
  expect(r["This week"]).toMatch(/^1h of 7h/);
  await page.keyboard.press("Escape");
  await page.locator("#quests .q", { hasText: "Reading" }).locator(".pzb").click();
  await expect(page.locator(".qmenu")).toContainText("Pause until Saturday");
  await page.click(".qmenu button:has-text('Pause until Saturday')");
  await expect.poll(async () => (await store(page)).cfg.quests[0].pausedUntil).toBe("2026-11-08");
  await page.click("#hdrAdd");
  await page.click("#aoQuest");
  await expect(page.locator("#nqBody .days button").first()).toHaveText("Su");
});

test("week start is a setting under Your day", async ({ page }) => {
  await openApp(page, { hash: "#settings" });
  await page.click("[data-st='day']");
  await page.selectOption("#setWkS", "0");
  await expect.poll(async () => (await store(page)).cfg.weekStart).toBe(0);
  await page.selectOption("#setWkS", "1");
  await expect.poll(async () => (await store(page)).cfg.weekStart).toBeUndefined();
});

test("a new quest can total over a month, and the editor can switch it to every 2 weeks", async ({ page }) => {
  await openApp(page, { cfg: { quests: [] } });
  await page.click("#hdrAdd");
  await page.click("#aoQuest");
  await page.click("#nqBody .tcard[data-t='time']");
  await page.fill("#nqName", "Thesis");
  await page.click("[data-goal='1']");
  await page.click("[data-per='month']");
  await page.fill("#nqRollH", "40");
  await page.click("#nqSave");
  await expect.poll(async () => (await store(page)).cfg.quests.map((q) => [q.label, q.roll, q.per])).toEqual([["Thesis", 2400, "month"]]);
  await page.click("#hdrEdit");
  await page.click("#qmgr .mq-tog");
  await page.selectOption("#qmgr [data-p='rollmode']", "roll2w");
  await page.click("#mgrSaveTop");
  const q = (await store(page)).cfg.quests[0];
  expect(q.per).toBe("2w");
  expect(q.roll).toBe(1110);
});

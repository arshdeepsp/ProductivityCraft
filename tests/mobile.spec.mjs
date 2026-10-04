import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

test.use({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });

const Q = [
  { id: "cs", type: "time", label: "CS/Technical work", min: 60 },
  { id: "pg", type: "target", label: "Pages read", min: 10, ul: "pages" },
  { id: "ex", type: "weekly", label: "Gym", min: 3 },
  { id: "td", type: "todo", label: "Email advisor" }
];

test("no tab scrolls sideways on a small phone", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, addTrends: true, sparkTools: true } });
  for (const v of ["today", "subjects", "rules", "achievements", "trends", "settings"]) {
    await page.evaluate((h) => (location.hash = "#" + h), v);
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), v).toBe(0);
  }
});

test("the + button adds a to-do", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q } });
  await page.tap("#fabAdd");
  await page.fill("#aoTd", "Buy groceries");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.locator("#quests .lbl", { hasText: "Buy groceries" })).toBeVisible();
});

test("the app header stays pinned while scrolling every tab", async ({ page }) => {
  const SUBJ = [...Array(5)].map((_, i) => ({ id: "s" + i, name: "Subject " + i, topics: [...Array(4)].map((_, j) => ({ id: `t${i}${j}`, name: "Topic " + j, p: 2, hist: [] })) }));
  await openApp(page, { cfg: { quests: Q, subjects: SUBJ } });
  for (const v of ["subjects", "rules", "achievements"]) {
    await page.evaluate((h) => (location.hash = "#" + h), v);
    await page.waitForTimeout(150);
    for (const y of [600, 200, 0]) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(80);
      expect(await page.evaluate(() => Math.round(document.querySelector(".titlebar").getBoundingClientRect().top)), `${v} at ${y}`).toBe(0);
    }
  }
});

test("trends tiles fit on a small phone", async ({ page }) => {
  const TQ = [{ id: "cs", type: "time", label: "CS work", min: 60 }];
  const days = {};
  for (let i = 1; i <= 30; i++) days[`2026-10-${String(i).padStart(2, "0")}`] = { cs: 180, q: TQ, ended: true, sess: [{ id: "cs", s: 0, e: 1, m: 125 }] };
  await openApp(page, { now: "2026-11-02T20:00:00-05:00", cfg: { quests: TQ, addTrends: true }, days, hash: "#trends" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  expect(await page.evaluate(() => [...document.querySelectorAll(".ttile")].filter((t) => t.scrollWidth > t.clientWidth + 1).length)).toBe(0);
});

test("the on/off switch knob stays inside its track", async ({ page }) => {
  const SQ = [{ id: "j", type: "check", label: "Journal" }, { id: "k", type: "check", label: "Read" }];
  await openApp(page, { cfg: { quests: SQ } });
  const inside = () => page.evaluate(() => [...document.querySelectorAll("#quests .sw")].filter((s) => s.offsetParent).every((s) => {
    const t = s.getBoundingClientRect(), k = s.querySelector("span").getBoundingClientRect();
    return k.left >= t.left && k.right <= t.right && k.top >= t.top && k.bottom <= t.bottom;
  }));
  expect(await inside()).toBe(true);
  await page.tap("#quests .q:nth-child(2) .sw");
  await page.click("#doneSep");
  await page.waitForTimeout(200);
  expect(await inside()).toBe(true);
});

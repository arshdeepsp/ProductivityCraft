import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const SUBJ = [
  { id: "s1", name: "Computer Science", topics: [{ id: "t1", name: "Consensus", p: 2, hist: [] }] },
  { id: "s2", name: "Mathematics", topics: [{ id: "t2", name: "Probability", p: 3, hist: [] }] },
  { id: "s3", name: "Statistics", topics: [] }
];

test("a quest can feed several subjects and shows a compact +N chip", async ({ page }) => {
  const Q = [{ id: "cs", type: "time", label: "Thesis reading", min: 60 }];
  await openApp(page, { cfg: { quests: Q, subjects: SUBJ } });
  await page.click("#hdrEdit");
  await page.click("#qmgr [data-tog='cs']");
  await page.click("#qmgr [data-sj='s1']");
  await page.click("#qmgr [data-sj='s2']");
  await page.click("#qmgr [data-sj='s3']");
  await page.click("#mgrSaveTop");
  await expect(page.locator("#quests .sjchip")).toContainText("Computer Science");
  await expect(page.locator("#quests .sjchip .sjmore")).toHaveText("+2");
  await page.click("#quests .sjchip");
  await expect(page.locator("#gBody [data-js]")).toHaveCount(3);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).cfg.quests[0]);
  expect(saved.subjs).toEqual(["s1", "s2", "s3"]);
  expect(saved.subj).toBe("s1");
});

test("time logged on a multi-subject quest counts for each subject", async ({ page }) => {
  const Q = [{ id: "cs", type: "time", label: "Thesis reading", min: 60, subj: "s1", subjs: ["s1", "s2"] }];
  await openApp(page, { cfg: { quests: Q, subjects: SUBJ }, days: { "2026-11-01": { cs: 90, q: Q, ended: true } }, hash: "#subjects" });
  const links = await page.evaluate(() => [...document.querySelectorAll(".sj-link")].map((x) => x.textContent));
  expect(links.filter((t) => t.includes("1h 30m")).length).toBe(2);
});

test("old single-subject quests still work", async ({ page }) => {
  const Q = [{ id: "cs", type: "time", label: "CS work", min: 60, subj: "s1" }];
  await openApp(page, { cfg: { quests: Q, subjects: SUBJ } });
  await expect(page.locator("#quests .sjchip")).toContainText("Computer Science");
  await expect(page.locator("#quests .sjchip .sjmore")).toHaveCount(0);
});

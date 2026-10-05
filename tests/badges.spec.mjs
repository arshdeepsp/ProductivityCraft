import { test, expect } from "@playwright/test";
import { openApp, dayRange } from "./helpers.mjs";

const Q = [{ id: "j", type: "check", label: "Journal" }, { id: "cs", type: "time", label: "CS work", min: 60 }];
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
const card = (page, id) => page.locator(`.ach[data-bid='${id}']`);

test("there are 20 badges in five groups, and no custom achievements", async ({ page }) => {
  const errors = await openApp(page, { cfg: { quests: Q }, hash: "#achievements" });
  await expect(page.locator("#achGrid .ach")).toHaveCount(20);
  await expect(page.locator("#achGrid .ach-sub")).toHaveCount(5);
  await expect(page.locator("#achSum")).toHaveText("0 of 20 earned");
  await expect(page.locator("#caNewBtn")).toHaveCount(0);
  await expect(page.locator("#achievements h2")).toHaveText("Badges");
  expect(errors).toEqual([]);
});

test("a 7-day streak earns Seedling, which is saved with its date and toasted", async ({ page }) => {
  const days = dayRange("2026-10-26", "2026-11-01", () => ({ j: true, cs: 60, q: Q }));
  await openApp(page, { cfg: { quests: Q }, days, hash: "#achievements" });
  await expect.poll(async () => (await store(page)).cfg.badges?.week).toBe("2026-11-02");
  await expect(card(page, "week")).not.toHaveClass(/locked/);
  await expect(card(page, "week").locator(".st")).toHaveText("Earned Nov 2");
  await expect(card(page, "3weeks").locator(".st")).toHaveText("7 of 21 days");
});

test("an earned badge stays earned after the streak breaks", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, badges: { week: "2026-10-20" } }, hash: "#achievements" });
  await expect(card(page, "week")).not.toHaveClass(/locked/);
  await expect(card(page, "week").locator(".st")).toHaveText("Earned Oct 20");
  await expect(page.locator("#achSum")).toHaveText("1 of 20 earned");
});

test("locked badges show how far along you are", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-01": { cs: 90, q: Q, sess: [{ id: "cs", s: 0, e: 1, m: 50 }] } }, hash: "#achievements" });
  await expect(card(page, "focus10").locator(".st")).toHaveText("1h 30m of 10h");
  await expect(card(page, "deep").locator(".st")).toHaveText("50m of 1h 30m");
  await expect(card(page, "focus10").locator(".abar i")).toHaveAttribute("style", /width: 15%/);
});

test("topic badges: level up, on target, expert, and several at once share one toast", async ({ page }) => {
  const SJ = [{ id: "s1", name: "Maths", topics: [{ id: "a", name: "Algebra", p: 5, target: 4, hist: [{ d: "2026-10-01", p: 2 }, { d: "2026-10-20", p: 5 }] }] }];
  await openApp(page, { cfg: { quests: Q, subjects: SJ }, extra: { "pc-rerate": "2026-11-02" } });
  await expect.poll(async () => Object.keys((await store(page)).cfg.badges || {}).sort()).toEqual(["expert", "goal", "levelup"]);
  await expect(page.locator("#toast .t1")).toHaveText("Badge earned!");
  await expect(page.locator("#toast .t2")).toHaveText("3 badges");
});

test("keeping the day's plan earns Plan kept", async ({ page }) => {
  const day = { cs: 60, q: Q, sched: [{ id: "a", q: "cs", f: 600, t: 630 }, { id: "b", q: "cs", f: 700, t: 730 }] };
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-01": day } });
  await expect.poll(async () => (await store(page)).cfg.badges?.plankept).toBe("2026-11-02");
  expect((await store(page)).cfg.badges.architect).toBeUndefined();
});

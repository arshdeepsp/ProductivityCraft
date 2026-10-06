import { test, expect } from "@playwright/test";
import { openApp, dayRange } from "./helpers.mjs";

const strip = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#strip i[data-k]")].map((i) => [i.getAttribute("data-k"), i.className.split(" ")[0]])));
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
const J = { id: "j", type: "check", label: "Journal" };
const K = { id: "k", type: "check", label: "Read" };
const week = (from, to, f, Q) => dayRange(from, to, (k) => ({ q: typeof Q === "function" ? Q(k) : Q, ...f(k) }));

test("a passed day keeps the quests it had, even after they're deleted", async ({ page }) => {
  await openApp(page, { now: "2026-11-05T09:00:00-05:00", cfg: { quests: [J, K] }, days: { "2026-11-02": { j: true, k: true, q: [J, K] } } });
  expect((await strip(page))["2026-11-03"]).toBe("miss");
  expect((await store(page)).days["2026-11-03"].q.map((q) => q.id)).toEqual(["j", "k"]);
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("pc-cache-v1")); s.cfg.quests = []; s.cfg.updated = "2026-11-05T14:00:00Z"; localStorage.setItem("pc-cache-v1", JSON.stringify(s)); });
  await page.reload();
  await page.waitForTimeout(300);
  const m = await strip(page);
  expect([m["2026-11-03"], m["2026-11-04"]]).toEqual(["miss", "miss"]);
});

test("a total paused before the end of the week is still checked at the end, prorated", async ({ page }) => {
  const CS = { id: "cs", type: "time", label: "Coursework", min: 30, roll: 420, addedOn: "2026-10-01", pausedFrom: "2026-11-04", pausedUntil: "2026-11-09" };
  const days = week("2026-11-02", "2026-11-08", (k) => ({ j: true, cs: k === "2026-11-02" ? 60 : 0 }), (k) => (k < "2026-11-04" ? [J, CS] : [J]));
  await openApp(page, { now: "2026-11-09T09:00:00-05:00", cfg: { quests: [J, CS] }, days });
  const m = await strip(page);
  expect(["2026-11-02", "2026-11-05", "2026-11-08"].map((k) => m[k])).toEqual(["lost", "lost", "lost"]);
});

test("pausing never moves the halfway checkpoint onto a day already gone", async ({ page }) => {
  const CS = { id: "cs", type: "time", label: "Coursework", min: 30, roll: 600, days: [1, 2, 3, 4, 5], addedOn: "2026-10-01" };
  await openApp(page, { now: "2026-11-04T09:00:00-05:00", cfg: { quests: [J, CS] }, days: { "2026-11-02": { j: true, q: [J, CS] }, "2026-11-03": { j: true, q: [J, CS] } } });
  await expect(page.locator("#carryNote")).toContainText("Checkpoint today: Coursework 0m/5h");
  await page.locator("#quests .q", { hasText: "Coursework" }).locator(".pzb").click();
  await page.click(".qmenu button:has-text('Pause')");
  await page.waitForTimeout(300);
  const m = await strip(page);
  expect([m["2026-11-02"], m["2026-11-03"]]).toEqual(["ok", "ok"]);
  await expect(page.locator("#carryNote")).toContainText("Checkpoint today: Coursework 0m/3h");
});

test("a total marked optional is never judged, not even on its off days", async ({ page }) => {
  const CS = { id: "cs", type: "time", label: "Coursework", min: 30, roll: 300, days: [1, 2, 3, 4, 5], opt: true, addedOn: "2026-10-01" };
  await openApp(page, { now: "2026-11-09T09:00:00-05:00", cfg: { quests: [J, CS] }, days: week("2026-11-02", "2026-11-08", () => ({ j: true }), [J, CS]) });
  const m = await strip(page);
  expect(["2026-11-02", "2026-11-05", "2026-11-08"].map((k) => m[k])).toEqual(["ok", "ok", "ok"]);
});

test("a missed total only takes back days from when the quest started", async ({ page }) => {
  const CS = { id: "cs", type: "time", label: "Coursework", min: 30, roll: 420, addedOn: "2026-11-04" };
  await openApp(page, { now: "2026-11-09T09:00:00-05:00", cfg: { quests: [J, CS] }, days: week("2026-11-02", "2026-11-08", () => ({ j: true }), (k) => (k < "2026-11-04" ? [J] : [J, CS])) });
  const m = await strip(page);
  expect(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-08"].map((k) => m[k])).toEqual(["ok", "ok", "lost", "lost"]);
});

test("lost days don't count toward the best streak or its badges", async ({ page }) => {
  const CS = { id: "cs", type: "time", label: "Coursework", min: 30, roll: 420, addedOn: "2026-10-01" };
  await openApp(page, { now: "2026-11-09T09:00:00-05:00", cfg: { quests: [J, CS] }, days: week("2026-11-02", "2026-11-08", (k) => ({ j: true, cs: k <= "2026-11-05" ? 60 : 0 }), [J, CS]) });
  await expect(page.locator("#stBest")).toHaveText("0");
  expect((await store(page)).cfg.badges || {}).not.toHaveProperty("week");
});

test("a streak badge waits until the running period's totals are in", async ({ page }) => {
  const CS = { id: "cs", type: "time", label: "Coursework", min: 30, roll: 420, addedOn: "2026-11-02" };
  await openApp(page, { now: "2026-11-05T09:00:00-05:00", cfg: { quests: [J, CS], start: "2026-10-27T04:00:00.000Z" }, days: week("2026-10-27", "2026-11-04", () => ({ j: true }), (k) => (k < "2026-11-02" ? [J] : [J, CS])) });
  await expect(page.locator("#stBest")).toHaveText("9");
  expect((await store(page)).cfg.badges || {}).not.toHaveProperty("week");
  await expect(page.locator('[data-bid="week"] .st')).toHaveText("Earned once this period's totals are in");
});

test("a timer running past the day's lock splits its minutes between the two days", async ({ page }) => {
  const CS = { id: "cs", type: "time", label: "Coursework", min: 60 };
  const state = { days: {}, cfg: { quests: [CS], rules: [], idleGrove: 0, start: "2026-10-01T04:00:00.000Z", updated: "2026-10-01T10:00:00Z" }, timer: { id: "cs", label: "Coursework", start: Date.parse("2026-11-02T23:30:00-05:00"), day: "2026-11-02" } };
  await page.addInitScript((s) => { if (!localStorage.getItem("pc-cache-v1")) localStorage.setItem("pc-cache-v1", s); }, JSON.stringify(state));
  await openApp(page, { now: "2026-11-03T00:20:00-05:00", cfg: { quests: [CS] } });
  expect((await store(page)).days["2026-11-02"].cs).toBe(30);
  await page.click("#quests .q.running .tmr");
  await page.waitForTimeout(300);
  const s = await store(page);
  expect(s.days["2026-11-02"].cs).toBe(30);
  expect(s.days["2026-11-03"].cs).toBe(20);
});

test("a subject finish line still works after the quest's first subject is deleted", async ({ page }) => {
  const Q = { id: "cs", type: "time", label: "Coursework", min: 30, subj: "gone", subjs: ["gone", "s2"], fin: { t: "subject", lvl: 4 } };
  await openApp(page, { cfg: { quests: [Q], subjects: [{ id: "s2", name: "Math", topics: [{ id: "t1", name: "Algebra", p: 4, hist: [], created: "2026-10-01" }] }] } });
  await expect.poll(async () => ((await store(page)).cfg.quests[0].completed || {}).how).toContain("Math reached");
});

for (const [name, raw, head] of [["unreadable", "{oops", "couldn’t be read"], ["from a newer version", JSON.stringify({ schema: 99, days: { "2026-11-01": { cs: 5 } }, cfg: { quests: [] } }), "newer version"]]) {
  test(`saved data that's ${name} is kept, not overwritten`, async ({ page }) => {
    await page.addInitScript((r) => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("pc-cache-v1", r); } }, raw);
    await openApp(page, { cfg: { quests: [J] } });
    await expect(page.locator("#gBody .mhead")).toContainText(head);
    await page.click("#cbOk");
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => [localStorage.getItem("pc-cache-v1"), localStorage.getItem("pc-cache-rescue")])).toEqual([raw, raw]);
  });
}

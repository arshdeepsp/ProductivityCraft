import { test, expect } from "@playwright/test";
import { openApp, dayRange } from "./helpers.mjs";

const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
const strip = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#strip i[data-k]")].map((i) => [i.getAttribute("data-k"), i.className.split(" ")[0]])));
const J = { id: "j", type: "check", label: "Journal" };
const mock = `window.__ln=[];window.Capacitor={isNativePlatform:()=>true,Plugins:{LocalNotifications:{requestPermissions:()=>Promise.resolve({display:'granted'}),createChannel:()=>Promise.resolve(),getPending:()=>Promise.resolve({notifications:[]}),cancel:()=>Promise.resolve(),schedule:(o)=>{o.notifications.forEach(n=>window.__ln.push({id:n.id}));return Promise.resolve()},addListener:()=>Promise.resolve({})},App:{addListener:()=>Promise.resolve({})},KeepAwake:{keepAwake:()=>Promise.resolve(),allowSleep:()=>Promise.resolve()}}};`;

test("Settings pauses streaks from tomorrow; switching back the same day undoes it", async ({ page }) => {
  await openApp(page, { cfg: { quests: [J] }, hash: "#settings" });
  await page.click("[data-st='quests']");
  await expect(page.locator("#setStreak")).toHaveAttribute("aria-checked", "true");
  await page.click("#setStreak");
  expect((await store(page)).cfg.noStreak).toEqual([{ from: "2026-11-03" }]);
  await expect(page.locator("#setStreak")).toHaveAttribute("aria-checked", "false");
  await expect(page.locator(".srow", { has: page.locator("#setStreak") })).toContainText("Pauses from tomorrow");
  await expect(page.locator("body")).not.toHaveClass(/nostreak/);
  await page.click("#setStreak");
  expect((await store(page)).cfg.noStreak).toBeUndefined();
});

test("during setup a pause starts today", async ({ page }) => {
  await openApp(page, { cfg: { quests: [J], start: "2026-10-30T04:00:00.000Z" }, hash: "#settings" });
  await page.click("[data-st='quests']");
  await page.click("#setStreak");
  expect((await store(page)).cfg.noStreak).toEqual([{ from: "2026-11-02" }]);
});

test("while paused the reward UI is hidden and Badges or Grove can't be opened", async ({ page }) => {
  await openApp(page, { cfg: { quests: [J], noStreak: [{ from: "2026-11-01" }], addTrends: true }, hash: "#achievements" });
  await expect(page.locator("[data-view='today']")).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/nostreak/);
  await expect(page.locator("#hudNote")).toContainText("Streaks paused: tracking only");
  await expect(page.locator("#hudLine")).toContainText("Tracking only");
  await expect(page.locator(".mainnav [data-go='achievements']")).toBeHidden();
  await expect(page.locator(".mainnav [data-go='grove']")).toBeHidden();
  await expect(page.locator("#stStreak")).toBeHidden();
  await expect(page.locator("#lvlText")).toBeHidden();
  await page.locator("#quests .q .sw").click();
  await expect(page.locator("#cleared")).toHaveText("");
  await page.evaluate(() => { location.hash = "grove"; });
  await page.waitForTimeout(200);
  await expect(page.locator("#grove")).toBeHidden();
  await page.click("#trendsBtn");
  await expect(page.locator(".ttile", { hasText: "Gold days" })).toHaveCount(0);
});

test("switching back on ends the pause today", async ({ page }) => {
  await openApp(page, { cfg: { quests: [J], noStreak: [{ from: "2026-10-20" }] }, hash: "#settings" });
  await page.click("[data-st='quests']");
  await page.click("#setStreak");
  expect((await store(page)).cfg.noStreak).toEqual([{ from: "2026-10-20", to: "2026-11-02" }]);
});

test("a paused day between two misses stays paused", async ({ page }) => {
  const days = dayRange("2026-10-27", "2026-10-30", () => ({ j: true, q: [J] }));
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: [J], start: "2026-10-27T04:00:00.000Z", noStreak: [{ from: "2026-11-01", to: "2026-11-02" }] }, days });
  const m = await strip(page);
  expect([m["2026-10-31"], m["2026-11-01"], m["2026-11-02"]]).toEqual(["miss", "pause", "miss"]);
});

test("a weekly quest's bonus doesn't count a check-off made while paused", async ({ page }) => {
  const W = { id: "w", type: "weekly", label: "Gym", min: 2 };
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: [W], start: "2026-11-02T05:00:00.000Z", noStreak: [{ from: "2026-11-02", to: "2026-11-03" }] }, days: { "2026-11-02": { w: true, q: [W] }, "2026-11-03": { w: true, q: [W] } } });
  await expect(page.locator("#lvlText")).toHaveText("20 / 300 XP");
});

test("no commitment check or XP stakes while paused, even in strict mode", async ({ page }) => {
  const CS = { id: "cs", type: "time", label: "Coursework", min: 30 };
  await openApp(page, { cfg: { quests: [CS], strict: true, noStreak: [{ from: "2026-11-01" }] } });
  await page.click("#quests .q .tmr");
  await expect(page.locator("#quests .q.running")).toHaveCount(1);
  await expect(page.locator("#gModal")).toBeHidden();
});

test("paused days are neutral: the streak picks up where it was", async ({ page }) => {
  const days = { ...dayRange("2026-10-27", "2026-10-31", () => ({ j: true, q: [J] })), "2026-11-04": { j: true, q: [J] } };
  await openApp(page, { now: "2026-11-05T09:00:00-05:00", cfg: { quests: [J], start: "2026-10-27T04:00:00.000Z", noStreak: [{ from: "2026-11-01", to: "2026-11-04" }] }, days });
  await expect(page.locator("#stStreak")).toHaveText("6 days");
  const m = await strip(page);
  expect([m["2026-11-01"], m["2026-11-03"], m["2026-11-04"]]).toEqual(["pause", "pause", "ok"]);
});

test("a paused day never earns XP, even after streaks are back on", async ({ page }) => {
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: [J], start: "2026-11-02T05:00:00.000Z", noStreak: [{ from: "2026-11-02", to: "2026-11-03" }] }, days: { "2026-11-02": { j: true, q: [J] } } });
  await expect(page.locator("#lvlText")).toHaveText("0 / 300 XP");
});

test("a total isn't judged in a period that had a paused day", async ({ page }) => {
  const CS = { id: "cs", type: "time", label: "Coursework", min: 30, roll: 420, addedOn: "2026-10-01" };
  const days = dayRange("2026-11-02", "2026-11-08", () => ({ j: true, q: [J, CS] }));
  await openApp(page, { now: "2026-11-09T09:00:00-05:00", cfg: { quests: [J, CS], noStreak: [{ from: "2026-11-05", to: "2026-11-06" }] }, days });
  const m = await strip(page);
  expect(["2026-11-02", "2026-11-05", "2026-11-08"].map((k) => m[k])).toEqual(["ok", "pause", "ok"]);
});

test("badges don't count paused days", async ({ page }) => {
  const at = (h) => Date.parse(`2026-11-02T${h}:00:00-05:00`);
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: [J], noStreak: [{ from: "2026-11-02", to: "2026-11-03" }] }, days: { "2026-11-02": { j: true, q: [J], sess: [{ id: "x", s: at(10), e: at(12), m: 120 }] } } });
  await page.waitForTimeout(300);
  expect((await store(page)).cfg.badges || {}).not.toHaveProperty("deep");
});

for (const paused of [false, true]) {
  test(`streak-risk and checkpoint alerts ${paused ? "stop while paused" : "fire normally"}`, async ({ page }) => {
    await page.addInitScript(mock);
    const CS = { id: "cs", type: "time", label: "Coursework", min: 30, roll: 420, addedOn: "2026-10-01" };
    const days = dayRange("2026-10-27", "2026-10-31", () => ({ j: true, cs: 90, q: [J, CS] }));
    await openApp(page, { now: "2026-11-02T09:00:00-05:00", cfg: { quests: [J, CS], start: "2026-10-27T04:00:00.000Z", nf: { on: true }, ...(paused ? { noStreak: [{ from: "2026-11-02" }] } : {}) }, days });
    await page.clock.runFor(2000);
    const ids = (await page.evaluate(() => window.__ln)).map((x) => x.id);
    expect(ids.includes(2200)).toBe(!paused);
    expect(ids.includes(2600)).toBe(!paused);
  });

  test(`a lost-streak gate ${paused ? "stays out of the way while paused" : "blocks quests"}`, async ({ page }) => {
    const days = dayRange("2026-10-27", "2026-10-30", () => ({ j: true, q: [J] }));
    await openApp(page, { now: "2026-11-02T09:00:00-05:00", cfg: { quests: [J], ...(paused ? { noStreak: [{ from: "2026-11-02" }] } : {}) }, days });
    if (paused) await expect(page.locator("#gate")).toBeHidden(); else await expect(page.locator("#gate")).toBeVisible();
  });
}

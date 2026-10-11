import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";
import { fake } from "./fakecloud.mjs";

const J = { id: "j", type: "check", label: "Journal" };
const ev = async (page, fn) => { try { return await page.evaluate(fn); } catch (e) { return null; } };
const mark = (page) => page.evaluate(() => { window.__pre = 1; });
const reloadedNow = async (page) => expect.poll(() => ev(page, () => !window.__pre && document.readyState === "complete"), { timeout: 10000 }).toBe(true);
const backup = (cfgUpdated) => Buffer.from(JSON.stringify({ app: "personal-operating-playbook", version: 2, schema: 11, exported: "2026-10-06T16:10:43.247Z",
  days: { "2026-10-05": { q: [{ id: "grad", type: "time", label: "TA Work", min: 90 }], grad: 95 } }, refl: { "2026-10-03": { text: "Just resting" } },
  cfg: { quests: [{ id: "grad", type: "time", label: "TA Work", min: 90 }, { id: "music", type: "time", label: "Piano Practice", min: 60 }], rules: [], start: "2026-10-01T04:00:00.000Z", updated: cfgUpdated, strict: true,
    subjects: [{ id: "s1", name: "Computer Science", topics: [{ id: "t1", name: "Networks", p: 1, hist: [], created: "2026-10-03" }] }] } }));
async function importIt(page) {
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='data']");
  await mark(page);
  await page.setInputFiles("#impFile", { name: "playbook-backup.json", mimeType: "application/json", buffer: backup("2026-10-06T01:17:23.358Z") });
  await reloadedNow(page);
}

test.describe("import", () => {
  test("an import shows everywhere at once, without a manual refresh", async ({ page }) => {
    await openApp(page, { now: "2026-10-10T09:00:00-04:00", cfg: { quests: [J], updated: "2026-10-02T00:00:00Z", start: "2026-10-08T04:00:00.000Z" } });
    await importIt(page);
    await expect(page.locator("#sync")).toHaveText("Imported 1 day and 1 reflection and your quests/rules");
    await page.evaluate(() => { location.hash = "today"; });
    await expect(page.locator("#quests .q .lbl")).toHaveText(["TA Work", "Piano Practice"]);
    await page.evaluate(() => { location.hash = "subjects"; });
    await expect(page.locator(".sjsec", { hasText: "Computer Science" })).toBeVisible();
  });

  test("signed in, an import shows at once and goes to the account", async ({ page }) => {
    await page.addInitScript(fake);
    await page.addInitScript(() => { if (localStorage.getItem("__fc")) return; localStorage.setItem("pc-account", JSON.stringify({ uid: "u1", email: "a@b.c" })); window.__cloud.user = { uid: "u1", email: "a@b.c" }; window.__cloud.save(); });
    await openApp(page, { now: "2026-10-10T09:00:00-04:00", cfg: { quests: [J], updated: "2026-10-02T00:00:00Z", start: "2026-10-08T04:00:00.000Z" } });
    await expect.poll(() => ev(page, () => Object.keys(window.__cloud.docs).length)).toBeGreaterThan(0);
    await importIt(page);
    await page.evaluate(() => { location.hash = "today"; });
    await expect(page.locator("#quests .q .lbl")).toHaveText(["TA Work", "Piano Practice"]);
    await expect.poll(() => ev(page, () => ((window.__cloud.docs["users/u1/data/cfg"] || {}).quests || []).map((q) => q.label))).toEqual(["TA Work", "Piano Practice"]);
    await expect.poll(() => ev(page, () => !!window.__cloud.docs["users/u1/days/2026-10-05"])).toBe(true);
  });
});

test.describe("pull to refresh", () => {
  test.use({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  async function pull(page, dist) {
    const cdp = await page.context().newCDPSession(page);
    const x = 195, y = 140;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    for (let i = 1; i <= 10; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (dist * i) / 10, id: 1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  test("pulling down from the top and letting go reloads the app, without the splash", async ({ page }) => {
    await openApp(page, { cfg: { quests: [J] }, extra: { "pc-splash": "on" } });
    await expect(page.locator("#splash")).toBeHidden({ timeout: 4000 });
    await mark(page);
    await pull(page, 220);
    await reloadedNow(page);
    await expect(page.locator("#splash")).toBeHidden();
    await expect(page.locator("#quests .q .lbl")).toHaveText(["Journal"]);
  });
  test("a short pull, or one over the schedule, does nothing", async ({ page }) => {
    await openApp(page, { cfg: { quests: [J] } });
    await mark(page);
    await pull(page, 80);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__pre)).toBe(1);
    await expect(page.locator("#ptr")).toBeHidden();
    await page.click("#schBtn");
    await pull(page, 260);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__pre)).toBe(1);
  });
});

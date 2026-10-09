import { test, expect } from "@playwright/test";
import { openApp, dayRange } from "./helpers.mjs";

const Q = [
  { id: "th", type: "time", label: "Thesis", min: 60, roll: 600, subj: "s1", subjs: ["s1"], topics: ["t1"] },
  { id: "rd", type: "time", label: "Reading", min: 30 },
  { id: "gym", type: "check", label: "Gym" }
];
const SUBJ = [{ id: "s1", name: "ML", topics: [{ id: "t1", name: "Transformers", p: 2, hist: [] }] }];
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));

test.describe("compact phone rows", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("every time row has a play button; one tap starts the timer, and it hides while running or done", async ({ page }) => {
    await openApp(page, { cfg: { quests: Q, subjects: SUBJ }, days: { "2026-11-02": { rd: 30, q: Q } }, extra: { "pc-doneopen": "1" } });
    await expect(page.locator("#quests .q.t-time:has-text('Thesis') .qplay")).toBeVisible();
    await expect(page.locator("#quests .q.t-check .qplay")).toHaveCount(0);
    await expect(page.locator("#quests .q:has-text('Reading') .qplay")).toBeHidden();
    await expect(page.locator("#quests .q .qgrip")).toHaveCount(3);
    for (const g of await page.locator("#quests .q .qgrip").all()) await expect(g).toBeHidden();
    await page.click("#quests .q:has-text('Thesis') .qplay");
    await expect(page.locator("#quests .q.running:has-text('Thesis')")).toHaveCount(1);
    await expect(page.locator("#quests .q.running .qplay")).toBeHidden();
  });

  test("rows are slim: the subjects box sits inline after the label", async ({ page }) => {
    await openApp(page, { cfg: { quests: Q, subjects: SUBJ } });
    const row = page.locator("#quests .q:has-text('Thesis')");
    const [rb, lb, cb] = await Promise.all([row.boundingBox(), row.locator(".lbl").boundingBox(), row.locator(".sjchip").boundingBox()]);
    expect(rb.height).toBeLessThanOrEqual(60);
    expect(Math.abs((cb.y + cb.height / 2) - (lb.y + lb.height / 2))).toBeLessThan(8);
    expect(cb.x).toBeGreaterThan(lb.x + lb.width - 2);
  });

  test("holding a row and dragging it reorders the quests; a quick drag just scrolls", async ({ page }) => {
    await openApp(page, { cfg: { quests: Q, subjects: SUBJ } });
    const cdp = await page.context().newCDPSession(page);
    const box = async (t) => page.locator("#quests .q", { hasText: t }).locator(".lbl").boundingBox();
    async function drag(from, to, hold) {
      const a = await box(from), b = await box(to), x = a.x + 5, y = a.y + a.height / 2, y2 = b.y + b.height - 4;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
      await page.clock.runFor(hold);
      for (let i = 1; i <= 5; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (y2 - y) * i / 5, id: 1 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(200);
    }
    await drag("Thesis", "Reading", 100);
    expect((await store(page)).cfg.quests.map((q) => q.id)).toEqual(["th", "rd", "gym"]);
    await drag("Thesis", "Reading", 450);
    await expect.poll(async () => (await store(page)).cfg.quests.map((q) => q.id)).toEqual(["rd", "th", "gym"]);
    await expect(page.locator("#quests .q .lbl")).toHaveText(["Reading", "Thesis", "Gym"]);
  });
});

test("a badge toast raised on launch waits for the first tap", async ({ page }) => {
  const G = [Q[2]];
  await openApp(page, { cfg: { quests: G }, days: dayRange("2026-10-26", "2026-11-01", () => ({ gym: true, q: G })) });
  await expect.poll(async () => (await store(page)).cfg.badges?.week).toBe("2026-11-02");
  await expect(page.locator("#toast")).not.toHaveClass(/show/);
  await page.mouse.click(5, 5);
  await expect(page.locator("#toast")).toHaveClass(/show/);
  await expect(page.locator("#toast .t1")).toHaveText("Badge earned!");
});

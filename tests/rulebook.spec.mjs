import { test, expect } from "@playwright/test";
import { openApp, swipe } from "./helpers.mjs";

const RULES = [
  { title: "Mornings", motto: "Start slow", blocks: [{ h: "No phone", t: "Until coffee." }] },
  { title: "Evenings", motto: "", blocks: [{ h: "Lights out", t: "- 23:00" }] }
];
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));

test.describe("rulebook swipe menu (phone)", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("swiping a section header left offers Edit and an armed Delete", async ({ page }) => {
    await openApp(page, { cfg: { rules: RULES }, hash: "#rules" });
    const sm = page.locator("details.rules[data-i='0'] > summary");
    await swipe(page, sm, "left");
    await expect(page.locator(".qmenu button")).toHaveText(["Edit section", "Delete section", "Cancel"]);
    await page.click(".qmenu button:has-text('Delete section')");
    await expect(page.locator(".qmenu button.armed")).toHaveText("Delete section?");
    expect((await store(page)).cfg.rules).toHaveLength(2);
    await page.click(".qmenu button.armed");
    expect((await store(page)).cfg.rules.map((r) => r.title)).toEqual(["Evenings"]);
    await expect(page.locator("details.rules h2")).toHaveText(["Evenings"]);
    await swipe(page, page.locator("details.rules[data-i='0'] > summary"), "left");
    await page.click(".qmenu button:has-text('Edit section')");
    await expect(page.locator("#gModal input[data-f='title']")).toHaveValue("Evenings");
  });
});

test.describe("rulebook hold-to-reorder (phone)", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("holding a section and dragging reorders it; the grip is hidden on phones", async ({ page }) => {
    await openApp(page, { cfg: { rules: RULES }, hash: "#rules" });
    for (const g of await page.locator("details.rules .sdrag").all()) await expect(g).toBeHidden();
    const cdp = await page.context().newCDPSession(page);
    const box = (i) => page.locator(`details.rules[data-i='${i}'] > summary h2`).boundingBox();
    const a = await box(0), b = await box(1);
    const x = a.x + 5, y = a.y + a.height / 2, y2 = b.y + b.height + 30;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    await page.clock.runFor(450);
    for (let i = 1; i <= 5; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (y2 - y) * i / 5, id: 1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(async () => (await store(page)).cfg.rules.map((r) => r.title)).toEqual(["Evenings", "Mornings"]);
    await expect(page.locator("details.rules h2")).toHaveText(["Evenings", "Mornings"]);
  });
});

import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const Q = [{ id: "cs", type: "time", label: "CS work", min: 60 }, { id: "j", type: "check", label: "Journal" }];
const spy = () => {
  window.__osc = [];
  const Real = window.AudioContext;
  window.AudioContext = function () { const ac = new Real(); const mk = ac.createOscillator.bind(ac); ac.createOscillator = () => { const o = mk(); const set = o.frequency.setValueAtTime.bind(o.frequency); o.frequency.setValueAtTime = (f, t) => { window.__osc.push(f); return set(f, t); }; return o; }; return ac; };
};
const tapPlus = (page) => page.click("#quests .q.t-time .act button[aria-label^='More']");

test("tapping a control plays a click along with the haptic", async ({ page }) => {
  await page.addInitScript(spy);
  await openApp(page, { cfg: { quests: Q } });
  await tapPlus(page);
  expect(await page.evaluate(() => window.__osc)).toContain(1568);
});

test("tap sounds can be turned off in Settings, separately from vibration", async ({ page }) => {
  await page.addInitScript(spy);
  await openApp(page, { hash: "#settings", cfg: { quests: Q } });
  await page.click("[data-st='sound']");
  await expect(page.locator("#setTapSnd")).toHaveAttribute("aria-checked", "true");
  await page.click("#setTapSnd");
  await expect(page.locator("#setTapSnd")).toHaveAttribute("aria-checked", "false");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).cfg.tapSound)).toBe(false);
  await page.evaluate(() => { window.__osc = []; });
  await page.click("[data-go='today']");
  await tapPlus(page);
  expect(await page.evaluate(() => window.__osc)).not.toContain(1568);
});

test("Sound off mutes tap sounds too", async ({ page }) => {
  await page.addInitScript(spy);
  await openApp(page, { cfg: { quests: Q }, extra: { "pc-sfx": "off" } });
  await tapPlus(page);
  expect(await page.evaluate(() => window.__osc)).toEqual([]);
});

test("a game sound doesn't also play a tap click", async ({ page }) => {
  await page.addInitScript(spy);
  await openApp(page, { cfg: { quests: Q } });
  await page.locator("#quests .q .sw").click();
  await page.waitForTimeout(100);
  const f = await page.evaluate(() => window.__osc);
  expect(f).toContain(988);
  expect(f.filter((x) => x === 1175)).toEqual([]);
});

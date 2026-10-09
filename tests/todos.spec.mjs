import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const cfgQuests = () => JSON.parse(localStorage.getItem("pc-cache-v1")).cfg.quests.map((q) => q.label);

test("to-dos finished on an earlier day are deleted", async ({ page }) => {
  const Q = [{ id: "t1", type: "todo", label: "Old done", doneOn: "2026-11-01" }, { id: "t2", type: "todo", label: "Done today", doneOn: "2026-11-02" }, { id: "j", type: "check", label: "Journal" }];
  await openApp(page, { cfg: { quests: Q } });
  expect(await page.evaluate(cfgQuests)).toEqual(["Done today", "Journal"]);
});


test("leftover to-dos from yesterday are reviewed once when the app opens", async ({ page }) => {
  const Q = [{ id: "a", type: "todo", label: "Email advisor", addedOn: "2026-11-01" }];
  await openApp(page, { cfg: { quests: Q } });
  await page.clock.runFor(1500);
  await expect(page.locator("#gTitle")).toHaveText("Still need these to-dos?");
  await page.click("#tdrGo");
  await expect(page.locator("#gModal")).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pc-todoreview"))).toBe("2026-11-02");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.clock.runFor(1500);
  await expect(page.locator("#gModal")).toBeHidden();
  expect(await page.evaluate(cfgQuests)).toEqual(["Email advisor"]);
});

test("a notification is scheduled when to-dos are still open", async ({ page }) => {
  await page.addInitScript(`window.__ln=[];window.Capacitor={isNativePlatform:()=>true,Plugins:{LocalNotifications:{requestPermissions:()=>Promise.resolve({display:'granted'}),createChannel:()=>Promise.resolve(),getPending:()=>Promise.resolve({notifications:[]}),cancel:()=>Promise.resolve(),schedule:(o)=>{o.notifications.forEach(n=>window.__ln.push(n.id+' '+n.title));return Promise.resolve()},addListener:()=>Promise.resolve({})},App:{addListener:()=>Promise.resolve({})},KeepAwake:{keepAwake:()=>Promise.resolve(),allowSleep:()=>Promise.resolve()}}};`);
  const Q = [{ id: "a", type: "todo", label: "Email advisor", addedOn: "2026-11-02" }];
  await openApp(page, { cfg: { quests: Q, nf: { on: true } } });
  await page.clock.runFor(2000);
  expect(await page.evaluate(() => window.__ln)).toContain("2400 To-dos still open");
});



test("the leftover to-do review waits until a running timer stops", async ({ page }) => {
  const Q = [{ id: "cs", type: "time", label: "CS", min: 60 }, { id: "a", type: "todo", label: "Email advisor", addedOn: "2026-11-01" }];
  const state = { days: {}, cfg: { quests: Q, rules: [], idleGrove: 0, start: "2026-10-01T04:00:00.000Z", updated: "2026-10-01T10:00:00Z" }, timer: { id: "cs", label: "CS", start: Date.parse("2026-11-02T08:50:00-05:00"), day: "2026-11-02" } };
  await page.addInitScript((s) => { if (!localStorage.getItem("pc-cache-v1")) localStorage.setItem("pc-cache-v1", s); }, JSON.stringify(state));
  await openApp(page, { cfg: { quests: Q } });
  await page.clock.runFor(1500);
  await expect(page.locator("#gModal")).toBeHidden();
  await page.click("#quests .q.running .tmr");
  await page.clock.runFor(1000);
  await expect(page.locator("#gTitle")).toHaveText("Still need these to-dos?");
});

test("there is no End day: open to-dos are reviewed the next time the app opens, and the reminder comes before bed", async ({ page }) => {
  await page.addInitScript(`window.__ln=[];window.Capacitor={isNativePlatform:()=>true,Plugins:{LocalNotifications:{requestPermissions:()=>Promise.resolve({display:'granted'}),createChannel:()=>Promise.resolve(),getPending:()=>Promise.resolve({notifications:[]}),cancel:()=>Promise.resolve(),schedule:(o)=>{o.notifications.forEach(n=>window.__ln.push({id:n.id,at:String(n.schedule.at)}));return Promise.resolve()},addListener:()=>Promise.resolve({})},App:{addListener:()=>Promise.resolve({})},KeepAwake:{keepAwake:()=>Promise.resolve(),allowSleep:()=>Promise.resolve()}}};`);
  const Q = [{ id: "j", type: "check", label: "Journal" }, { id: "a", type: "todo", label: "Email advisor", addedOn: "2026-11-02" }];
  await openApp(page, { cfg: { quests: Q, nf: { on: true } } });
  await expect(page.locator("#endBtn")).toHaveCount(0);
  await page.clock.runFor(2000);
  const ln = await page.evaluate(() => window.__ln);
  expect(ln.some((x) => x.id >= 2100 && x.id < 2200)).toBe(false);
  expect(ln.find((x) => x.id === 2400).at).toContain("22:30");
});

test.describe("review swipes (phone)", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("swipe left marks a to-do for deletion, swipe right keeps it; Done applies", async ({ page }) => {
    const { swipe } = await import("./helpers.mjs");
    const Q = [{ id: "a", type: "todo", label: "Email advisor", addedOn: "2026-11-01" }, { id: "b", type: "todo", label: "Buy stamps", addedOn: "2026-11-01" }];
    await openApp(page, { cfg: { quests: Q } });
    await page.clock.runFor(1500);
    await expect(page.locator("#gTitle")).toHaveText("Still need these to-dos?");
    await expect(page.locator("#gBody .help")).toContainText("Swipe right to keep, left to delete");
    const row = (t) => page.locator("#gBody .tdrev", { hasText: t });
    await swipe(page, row("Buy stamps"), "left");
    await expect(row("Buy stamps")).toHaveClass(/dropq/);
    await expect(row("Buy stamps").locator("[data-tdr]")).toHaveText("Delete");
    await swipe(page, row("Buy stamps"), "right");
    await expect(row("Buy stamps")).not.toHaveClass(/dropq/);
    await swipe(page, row("Email advisor"), "left");
    await page.click("#tdrGo");
    await expect(page.locator("#gModal")).toBeHidden();
    expect(await page.evaluate(cfgQuests)).toEqual(["Buy stamps"]);
  });
});

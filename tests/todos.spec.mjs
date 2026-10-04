import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const cfgQuests = () => JSON.parse(localStorage.getItem("pc-cache-v1")).cfg.quests.map((q) => q.label);

test("to-dos finished on an earlier day are deleted", async ({ page }) => {
  const Q = [{ id: "t1", type: "todo", label: "Old done", doneOn: "2026-11-01" }, { id: "t2", type: "todo", label: "Done today", doneOn: "2026-11-02" }, { id: "j", type: "check", label: "Journal" }];
  await openApp(page, { cfg: { quests: Q } });
  expect(await page.evaluate(cfgQuests)).toEqual(["Done today", "Journal"]);
});

test("ending the day asks about open to-dos and deletes the chosen ones", async ({ page }) => {
  const Q = [{ id: "j", type: "check", label: "Journal" }, { id: "a", type: "todo", label: "Email advisor", addedOn: "2026-11-02" }, { id: "b", type: "todo", label: "Print form", addedOn: "2026-11-02" }];
  await openApp(page, { cfg: { quests: Q } });
  await page.click("#endBtn");
  await page.click("#emYes");
  await page.click("#edClose");
  await expect(page.locator("#gTitle")).toHaveText("Still need these to-dos?");
  await page.click("[data-tdr='b']");
  await page.click("#tdrGo");
  await page.waitForTimeout(150);
  expect(await page.evaluate(cfgQuests)).toEqual(["Journal", "Email advisor"]);
});

test("leftover to-dos from yesterday are reviewed once when the app opens", async ({ page }) => {
  const Q = [{ id: "a", type: "todo", label: "Email advisor", addedOn: "2026-11-01" }];
  await openApp(page, { cfg: { quests: Q } });
  await page.clock.runFor(1500);
  await expect(page.locator("#gTitle")).toHaveText("Still need these to-dos?");
  await page.click("#tdrGo");
  await expect(page.locator("#gModal")).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pc-todoreview"))).toBe("2026-11-02");
  await page.reload();
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

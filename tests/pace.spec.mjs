import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const mock = `window.__ln=[];window.Capacitor={isNativePlatform:()=>true,Plugins:{LocalNotifications:{requestPermissions:()=>Promise.resolve({display:'granted'}),createChannel:()=>Promise.resolve(),getPending:()=>Promise.resolve({notifications:[]}),cancel:()=>Promise.resolve(),schedule:(o)=>{o.notifications.forEach(n=>window.__ln.push({id:n.id,title:n.title,body:n.body,at:new Date(n.schedule.at).toString()}));return Promise.resolve()},addListener:()=>Promise.resolve({})},App:{addListener:()=>Promise.resolve({})},KeepAwake:{keepAwake:()=>Promise.resolve(),allowSleep:()=>Promise.resolve()}}};`;

const Q = [
  { id: "cs", type: "time", label: "CS work", min: 60 },
  { id: "mu", type: "time", label: "Music", min: 60 },
  { id: "fr", type: "time", label: "French", min: 30, roll: 210 }
];

test("halfway-through-the-day alert uses the combined daily total", async ({ page }) => {
  await page.addInitScript(mock);
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: Q, nf: { on: true } }, days: { "2026-11-03": { cs: 40, q: Q } } });
  await page.clock.runFor(2000);
  const n = (await page.evaluate(() => window.__ln)).find((x) => x.id === 2500);
  expect(n.body).toBe("40m of 2h done across your daily time quests.");
  expect(n.at).toContain("15:30");
});

test("no daily alert once half the combined daily total is done", async ({ page }) => {
  await page.addInitScript(mock);
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: Q, nf: { on: true } }, days: { "2026-11-03": { cs: 60, q: Q } } });
  await page.clock.runFor(2000);
  expect((await page.evaluate(() => window.__ln)).some((x) => x.id === 2500)).toBe(false);
});

test("Thursday-morning alert for weekly totals under 50%", async ({ page }) => {
  await page.addInitScript(mock);
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: Q, nf: { on: true } }, days: { "2026-11-02": { fr: 30, q: Q } } });
  await page.clock.runFor(2000);
  const n = (await page.evaluate(() => window.__ln)).find((x) => x.id === 2600);
  expect(n.body).toBe("30m of 3h 30m done across your weekly time quests.");
  expect(n.at).toContain("Thu Nov 05 2026 09:00");
});

test("no weekly alert once half the weekly target is done", async ({ page }) => {
  await page.addInitScript(mock);
  await openApp(page, { now: "2026-11-03T09:00:00-05:00", cfg: { quests: Q, nf: { on: true } }, days: { "2026-11-02": { fr: 120, q: Q } } });
  await page.clock.runFor(2000);
  expect((await page.evaluate(() => window.__ln)).some((x) => x.id === 2600)).toBe(false);
});

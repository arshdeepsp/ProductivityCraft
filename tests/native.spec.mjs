import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const mock = (fail) => `
window.__fn=[];window.__ln=[];
window.Capacitor={isNativePlatform:()=>true,Plugins:{
  FocusNotify:{show:(o)=>{window.__fn.push(o);return ${fail ? "Promise.reject(new Error('not implemented'))" : "Promise.resolve()"}},hide:()=>{window.__fn.push('hide');return Promise.resolve()}},
  LocalNotifications:{requestPermissions:()=>Promise.resolve({display:'granted'}),createChannel:()=>Promise.resolve(),getPending:()=>Promise.resolve({notifications:[]}),cancel:()=>Promise.resolve(),schedule:(o)=>{o.notifications.forEach(n=>window.__ln.push(n.id));return Promise.resolve()}},
  App:{addListener:()=>Promise.resolve({})},KeepAwake:{keepAwake:()=>Promise.resolve(),allowSleep:()=>Promise.resolve()}}};`;

const Q = [{ id: "cs", type: "time", label: "CS work", min: 60 }];

test("live timer: counts up for a timer, counts down for Just 5, hides on stop", async ({ page }) => {
  await page.addInitScript(mock(false));
  await openApp(page, { cfg: { quests: Q, nf: { on: true } } });
  await page.click("#quests .q .tmr");
  await page.clock.runFor(4000);
  let calls = await page.evaluate(() => window.__fn);
  const up = calls.filter((c) => c && c.title).pop();
  expect(up.title).toBe("Focusing: CS work");
  expect(up.chrono).toBe(true);
  expect(up.countdown).toBe(false);
  await page.click("#quests .q.running .tmr");
  await page.clock.runFor(4000);
  calls = await page.evaluate(() => window.__fn);
  expect(calls[calls.length - 1]).toBe("hide");
  await page.click("#sp5Btn");
  await page.clock.runFor(4000);
  calls = await page.evaluate(() => window.__fn);
  const down = calls.filter((c) => c && c.title).pop();
  expect(down.title).toBe("Just 5 minutes: CS work");
  expect(down.countdown).toBe(true);
});

test("falls back to a plain notification if the native plugin is missing", async ({ page }) => {
  await page.addInitScript(mock(true));
  await openApp(page, { cfg: { quests: Q, nf: { on: true } } });
  await page.click("#quests .q .tmr");
  await page.clock.runFor(4000);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__ln)).toContain(900);
});

import { test, expect } from "@playwright/test";
import { openApp, dayRange } from "./helpers.mjs";

const Q = [
  { id: "cs", type: "time", label: "CS work", min: 60 },
  { id: "fr", type: "time", label: "French", min: 30, roll: 300, days: [1, 2, 3, 4, 5] },
  { id: "j", type: "check", label: "Journal" }
];
const sched = (page) => page.evaluate(() => (JSON.parse(localStorage.getItem("pc-cache-v1")).days["2026-11-02"] || {}).sched || null);

async function tapTime(page, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  await page.locator("#schTl").click({ position: { x: 120, y: ((h * 60 + m - 7 * 60) / 15) * 18 + 6 }, force: true });
}

async function open(page, opts = {}) {
  const errors = await openApp(page, { cfg: { quests: Q, ...(opts.cfg || {}) }, ...opts, cfg: { quests: Q, ...(opts.cfg || {}) } });
  await page.click("#schBtn");
  await expect(page.locator("#gTitle")).toHaveText("Today’s schedule");
  return errors;
}

test("only time quests can be scheduled, within Your day", async ({ page }) => {
  await open(page);
  await expect(page.locator("[data-sq]")).toHaveText(["CS work 1h", "French 1h"]);
  await expect(page.locator(".sch-hr").first()).toHaveText("07:00");
  await expect(page.locator(".sch-hr").last()).toHaveText("22:00");
});

test("tap a quest then a time to block its daily minimum", async ({ page }) => {
  await open(page);
  await page.click("[data-sq='cs']");
  await tapTime(page, "10:00");
  expect(await sched(page)).toEqual({ cs: { f: 600, t: 660 } });
  await expect(page.locator("[data-sb='cs'] span")).toHaveText("10:00–11:00");
});

test("a weekly total blocks its weekly hours divided by its work days", async ({ page }) => {
  await open(page);
  await page.click("[data-sq='fr']");
  await tapTime(page, "13:00");
  expect(await sched(page)).toEqual({ fr: { f: 780, t: 840 } });
});

test("a 5-min start keeps the daily share and its length is fixed", async ({ page }) => {
  await open(page);
  await page.click("[data-sq='cs']");
  await tapTime(page, "10:00");
  await page.click("[data-sb='cs']");
  await page.click("[data-sm='j5']");
  expect(await sched(page)).toEqual({ cs: { f: 600, t: 660, j5: true } });
  await expect(page.locator("[data-sb='cs'] .sch-h")).toHaveCount(0);
  await expect(page.locator("[data-sb='cs'] b")).toContainText("▶ 5");
});

test("dragging the bottom edge changes a range in 15-minute steps", async ({ page }) => {
  await open(page);
  await page.click("[data-sq='cs']");
  await tapTime(page, "10:00");
  const h = await page.locator("[data-sb='cs'] .sch-h").boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + 18 * 2, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => sched(page)).toEqual({ cs: { f: 600, t: 690 } });
});

test("overlaps and past times are refused", async ({ page }) => {
  await open(page);
  await page.click("[data-sq='cs']");
  await tapTime(page, "10:00");
  await page.click("[data-sq='fr']");
  await tapTime(page, "09:30");
  await expect(page.locator("#gBody .cmsg2")).toContainText("overlaps CS work");
  await tapTime(page, "08:00");
  await expect(page.locator("#gBody .cmsg2")).toContainText("already passed");
  expect(await sched(page)).toEqual({ cs: { f: 600, t: 660 } });
});

test("a placed block can be moved and removed", async ({ page }) => {
  await open(page);
  await page.click("[data-sq='cs']");
  await tapTime(page, "10:00");
  await page.click("[data-sb='cs']");
  await tapTime(page, "15:00");
  expect(await sched(page)).toEqual({ cs: { f: 900, t: 960 } });
  await page.click("[data-sb='cs']");
  await page.click("#schRm");
  expect(await sched(page)).toBeNull();
});

test("the quest row shows its scheduled time", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-02": { q: Q, sched: { cs: { f: 600, t: 660 }, fr: { f: 780, t: 840, j5: true } } } } });
  await expect(page.locator("#quests .q", { hasText: "CS work" }).locator(".req")).toContainText("10:00–11:00");
  await expect(page.locator("#quests .q", { hasText: "French" }).locator(".req")).toContainText("5-min start 13:00");
});

test("a schedule alone doesn't count as logging the day", async ({ page }) => {
  const RQ = [{ id: "cs", type: "time", label: "CS work", min: 60, roll: 420 }];
  const days = dayRange("2026-10-01", "2026-11-06", (k) => k <= "2026-11-02" ? { cs: k === "2026-11-02" ? 240 : 60, q: RQ, ended: true } : { q: RQ, sched: { cs: { f: 600, t: 660 } } });
  await openApp(page, { now: "2026-11-07T09:00:00-05:00", cfg: { quests: RQ }, days });
  const marks = await page.evaluate(() => [...document.querySelectorAll("#strip i")].slice(-5, -1).map((i) => i.className));
  expect(marks).toEqual(["carried", "carried", "carried", "grace"]);
});

const mock = `window.__ln=[];window.Capacitor={isNativePlatform:()=>true,Plugins:{LocalNotifications:{requestPermissions:()=>Promise.resolve({display:'granted'}),createChannel:()=>Promise.resolve(),getPending:()=>Promise.resolve({notifications:[]}),cancel:()=>Promise.resolve(),schedule:(o)=>{o.notifications.forEach(n=>window.__ln.push({id:n.id,title:n.title,body:n.body,at:String(n.schedule.at),extra:n.extra}));return Promise.resolve()},addListener:(n,cb)=>{if(n==='localNotificationActionPerformed')window.__tap=cb;return Promise.resolve({})}},App:{addListener:()=>Promise.resolve({})},KeepAwake:{keepAwake:()=>Promise.resolve(),allowSleep:()=>Promise.resolve()}}};`;

test("each scheduled start gets a notification, and done quests are skipped", async ({ page }) => {
  await page.addInitScript(mock);
  await openApp(page, { cfg: { quests: Q, nf: { on: true } }, days: { "2026-11-02": { q: Q, fr: 60, sched: { cs: { f: 600, t: 660, j5: true }, fr: { f: 780, t: 840 } } } } });
  await page.clock.runFor(2000);
  const n = (await page.evaluate(() => window.__ln)).filter((x) => x.id >= 3500 && x.id < 4000);
  expect(n.map((x) => x.title)).toEqual(["5 minutes on CS work"]);
  expect(n[0].at).toContain("10:00");
  expect(n[0].extra).toMatchObject({ sched: "cs", j5: true });
});

test("tapping a 5-min start notification starts Just 5 on that quest", async ({ page }) => {
  await page.addInitScript(mock);
  await openApp(page, { cfg: { quests: Q, nf: { on: true } }, days: { "2026-11-02": { q: Q, sched: { fr: { f: 600, t: 660, j5: true } } } } });
  await page.evaluate(() => window.__tap({ notification: { id: 3500, extra: { sched: "fr", j5: true } } }));
  await page.clock.runFor(1000);
  await expect(page.locator("#quests .q.running")).toContainText("French");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).timer.commit)).toBe(5);
});

test("tapping a range notification starts the normal timer", async ({ page }) => {
  await page.addInitScript(mock);
  await openApp(page, { cfg: { quests: Q, nf: { on: true } }, days: { "2026-11-02": { q: Q, sched: { cs: { f: 600, t: 660 } } } } });
  await page.evaluate(() => window.__tap({ notification: { id: 3500, extra: { sched: "cs" } } }));
  await page.clock.runFor(1000);
  await expect(page.locator("#quests .q.running")).toContainText("CS work");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).timer.commit || null)).toBeNull();
});

test.describe("phone", () => {
  test.use({ viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true });
  test("the schedule fits a small phone without sideways scroll", async ({ page }) => {
    await open(page);
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.getElementById("gBody").scrollWidth > document.getElementById("gBody").clientWidth);
    expect(over).toBe(false);
  });
});

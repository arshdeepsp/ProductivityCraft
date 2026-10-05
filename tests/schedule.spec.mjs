import { test, expect } from "@playwright/test";
import { openApp, dayRange } from "./helpers.mjs";

const Q = [
  { id: "cs", type: "time", label: "CS work", min: 60 },
  { id: "fr", type: "time", label: "French", min: 30, roll: 300, days: [1, 2, 3, 4, 5] },
  { id: "j", type: "check", label: "Journal" }
];
const sched = (page) => page.evaluate(() => { const s = (JSON.parse(localStorage.getItem("pc-cache-v1")).days["2026-11-02"] || {}).sched; return s ? s.map((b) => [b.q, b.f, b.t].concat(b.j5 ? ["j5"] : [])) : null; });

async function tapTime(page, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  await page.locator("#schTl").click({ position: { x: 160, y: ((h * 60 + m - 7 * 60) / 15) * 22 + 6 }, force: true });
}
async function place(page, qid, hhmm) {
  await tapTime(page, hhmm);
  await page.click(`[data-pk='${qid}']`);
}
async function open(page, opts = {}) {
  const errors = await openApp(page, { ...opts, cfg: { quests: Q, ...(opts.cfg || {}) } });
  await page.click("#schBtn");
  await expect(page.locator("#schPage")).toBeVisible();
  return errors;
}

test("the schedule is its own full-screen page, and Done returns to Today", async ({ page }) => {
  await open(page);
  const box = await page.locator("#schPage").boundingBox();
  const vp = page.viewportSize();
  expect([box.x, box.y, box.width, box.height]).toEqual([0, 0, vp.width, vp.height]);
  expect(await page.evaluate(() => document.body.classList.contains("sch-open"))).toBe(true);
  await page.click("#schOk");
  await expect(page.locator("#schPage")).toBeHidden();
  expect(await page.evaluate(() => document.body.classList.contains("sch-open"))).toBe(false);
});

test("only time quests can be scheduled, within Your day", async ({ page }) => {
  await open(page);
  await expect(page.locator("[data-sq]")).toHaveText(["CS work 1h", "French 1h"]);
  await expect(page.locator(".sch-hr").first()).toHaveText("07:00");
  await expect(page.locator(".sch-hr").last()).toHaveText("22:00");
});

test("tap a free time, pick a quest, and it blocks its daily minimum", async ({ page }) => {
  await open(page);
  await tapTime(page, "10:00");
  await expect(page.locator(".sch-ft-h")).toHaveText("Add at 10:00");
  await expect(page.locator("[data-pk]")).toHaveText(["CS work 1h", "French 1h"]);
  await page.click("[data-pk='cs']");
  expect(await sched(page)).toEqual([["cs", 600, 660]]);
  await expect(page.locator(".sch-b span")).toHaveText("10:00–11:00");
});

test("a weekly total blocks its weekly hours divided by its work days", async ({ page }) => {
  await open(page);
  await place(page, "fr", "13:00");
  expect(await sched(page)).toEqual([["fr", 780, 840]]);
});

test("a 5-min start keeps its length fixed", async ({ page }) => {
  await open(page);
  await place(page, "cs", "10:00");
  await page.click(".sch-b");
  await page.click("[data-sm='j5']");
  expect(await sched(page)).toEqual([["cs", 600, 660, "j5"]]);
  await expect(page.locator(".sch-b .sch-h")).toHaveCount(0);
  await expect(page.locator(".sch-b b")).toContainText("▶ 5");
});

test("dragging the bottom edge changes a range in 15-minute steps", async ({ page }) => {
  await open(page);
  await place(page, "cs", "10:00");
  const h = await page.locator(".sch-b .sch-h").boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + 22 * 2, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => sched(page)).toEqual([["cs", 600, 690]]);
});

test("dragging a block moves it", async ({ page }) => {
  await open(page);
  await place(page, "cs", "10:00");
  const b = await page.locator(".sch-b").boundingBox();
  await page.mouse.move(b.x + 40, b.y + 10);
  await page.mouse.down();
  await page.mouse.move(b.x + 40, b.y + 10 + 22 * 4, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => sched(page)).toEqual([["cs", 660, 720]]);
});

test("overlaps and past times are refused", async ({ page }) => {
  await open(page);
  await place(page, "cs", "10:00");
  await place(page, "fr", "13:00");
  await page.click(".sch-b >> nth=1");
  await tapTime(page, "09:30");
  await expect(page.locator("#schMsg")).toContainText("overlaps CS work");
  await tapTime(page, "08:00");
  await expect(page.locator("#schMsg")).toContainText("already passed");
  expect(await sched(page)).toEqual([["cs", 600, 660], ["fr", 780, 840]]);
});

test("a placed block can be moved by tapping a free time, and removed", async ({ page }) => {
  await open(page);
  await place(page, "cs", "10:00");
  await page.click(".sch-b");
  await tapTime(page, "15:00");
  expect(await sched(page)).toEqual([["cs", 900, 960]]);
  await page.click(".sch-b");
  await page.click("#schRm");
  expect(await sched(page)).toBeNull();
});

test("a quest can be split into several shots across the day", async ({ page }) => {
  await open(page);
  await place(page, "cs", "10:00");
  await page.click(".sch-b");
  await page.click("#schSplit");
  expect(await sched(page)).toEqual([["cs", 600, 630], ["cs", 630, 660]]);
  await tapTime(page, "16:00");
  expect(await sched(page)).toEqual([["cs", 600, 630], ["cs", 960, 990]]);
  await expect(page.locator("[data-sq='cs'] small")).toHaveText("1h / 1h · 2 shots");
  await expect(page.locator(".sch-b b").first()).toContainText("1/2");
  await page.click(".sch-b >> nth=1");
  await page.click("#schRm");
  await tapTime(page, "18:00");
  await expect(page.locator("[data-pk='cs'] small")).toHaveText("30m left");
  await page.click("[data-pk='cs']");
  expect(await sched(page)).toEqual([["cs", 600, 630], ["cs", 1080, 1110]]);
});

test("a new shot stops short of the next block instead of overlapping it", async ({ page }) => {
  await open(page, { days: { "2026-11-02": { q: Q, sched: [{ id: "a", q: "fr", f: 630, t: 690 }] } } });
  await place(page, "cs", "10:00");
  expect(await sched(page)).toEqual([["cs", 600, 630], ["fr", 630, 690]]);
  await expect(page.locator("#schMsg")).toContainText("Add another shot for the rest");
});

test("Auto-plan fills free time with what's left, with breaks between", async ({ page }) => {
  await open(page, { days: { "2026-11-02": { q: Q, sched: [{ id: "a", q: "cs", f: 570, t: 600 }] } } });
  await page.click("#schAuto");
  expect(await sched(page)).toEqual([["cs", 570, 600], ["cs", 615, 645], ["fr", 660, 720]]);
  await expect(page.locator("#schMsg")).toContainText("Planned 2 shots");
  await expect(page.locator("#schAuto")).toBeDisabled();
});

test("the quest row shows its scheduled times", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-02": { q: Q, sched: [{ id: "a", q: "cs", f: 600, t: 630 }, { id: "b", q: "cs", f: 840, t: 870 }, { id: "c", q: "fr", f: 780, t: 840, j5: true }] } } });
  await expect(page.locator("#quests .q", { hasText: "CS work" }).locator(".req")).toContainText("10:00–10:30, 14:00–14:30");
  await expect(page.locator("#quests .q", { hasText: "French" }).locator(".req")).toContainText("5-min start 13:00");
});

test("a schedule alone doesn't count as logging the day", async ({ page }) => {
  const RQ = [{ id: "cs", type: "time", label: "CS work", min: 60, roll: 420 }];
  const days = dayRange("2026-10-01", "2026-11-06", (k) => k <= "2026-11-02" ? { cs: k === "2026-11-02" ? 240 : 60, q: RQ, ended: true } : { q: RQ, sched: [{ id: "a", q: "cs", f: 600, t: 660 }] });
  await openApp(page, { now: "2026-11-07T09:00:00-05:00", cfg: { quests: RQ }, days });
  const marks = await page.evaluate(() => [...document.querySelectorAll("#strip i")].slice(-5, -1).map((i) => i.className));
  expect(marks).toEqual(["carried", "carried", "carried", "grace"]);
});

const mock = `window.__ln=[];window.Capacitor={isNativePlatform:()=>true,Plugins:{LocalNotifications:{requestPermissions:()=>Promise.resolve({display:'granted'}),createChannel:()=>Promise.resolve(),getPending:()=>Promise.resolve({notifications:[]}),cancel:()=>Promise.resolve(),schedule:(o)=>{o.notifications.forEach(n=>window.__ln.push({id:n.id,title:n.title,body:n.body,at:String(n.schedule.at),extra:n.extra}));return Promise.resolve()},addListener:(n,cb)=>{if(n==='localNotificationActionPerformed')window.__tap=cb;return Promise.resolve({})}},App:{addListener:()=>Promise.resolve({})},KeepAwake:{keepAwake:()=>Promise.resolve(),allowSleep:()=>Promise.resolve()}}};`;

test("each shot gets its own reminder, and done quests are skipped", async ({ page }) => {
  await page.addInitScript(mock);
  await openApp(page, { cfg: { quests: Q, nf: { on: true } }, days: { "2026-11-02": { q: Q, fr: 60, sched: [{ id: "a", q: "cs", f: 600, t: 630, j5: true }, { id: "b", q: "fr", f: 780, t: 840 }, { id: "c", q: "cs", f: 900, t: 930 }] } } });
  await page.clock.runFor(2000);
  const n = (await page.evaluate(() => window.__ln)).filter((x) => x.id >= 3500 && x.id < 4000);
  expect(n.map((x) => x.title)).toEqual(["5 minutes on CS work", "Time for CS work"]);
  expect(n.map((x) => x.at.slice(16, 21))).toEqual(["10:00", "15:00"]);
  expect(n[0].extra).toMatchObject({ sched: "cs", j5: true });
});

test("tapping a 5-min start notification starts Just 5 on that quest", async ({ page }) => {
  await page.addInitScript(mock);
  await openApp(page, { cfg: { quests: Q, nf: { on: true } }, days: { "2026-11-02": { q: Q, sched: [{ id: "a", q: "fr", f: 600, t: 660, j5: true }] } } });
  await page.evaluate(() => window.__tap({ notification: { id: 3500, extra: { sched: "fr", j5: true } } }));
  await page.clock.runFor(1000);
  await expect(page.locator("#quests .q.running")).toContainText("French");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).timer.commit)).toBe(5);
});

test("tapping a range notification starts the normal timer", async ({ page }) => {
  await page.addInitScript(mock);
  await openApp(page, { cfg: { quests: Q, nf: { on: true } }, days: { "2026-11-02": { q: Q, sched: [{ id: "a", q: "cs", f: 600, t: 660 }] } } });
  await page.evaluate(() => window.__tap({ notification: { id: 3500, extra: { sched: "cs" } } }));
  await page.clock.runFor(1000);
  await expect(page.locator("#quests .q.running")).toContainText("CS work");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).timer.commit || null)).toBeNull();
});

for (const width of [360, 390]) {
  test.describe(`phone ${width}`, () => {
    test.use({ viewport: { width, height: 760 }, isMobile: true, hasTouch: true });
    test("the page fits: no sideways scroll, footer never covers the timeline, Today doesn't scroll underneath", async ({ page }) => {
      await open(page);
      await tapTime(page, "10:00");
      const r = await page.evaluate(() => {
        const sc = document.getElementById("schScroll").getBoundingClientRect(), ft = document.getElementById("schFt").getBoundingClientRect(), hd = document.querySelector(".sch-hd").getBoundingClientRect();
        return { side: document.documentElement.scrollWidth > window.innerWidth, gapTop: sc.top >= hd.bottom - 1, gapBottom: sc.bottom <= ft.top + 1, ftOnScreen: ft.bottom <= window.innerHeight + 1, overflow: getComputedStyle(document.body).overflow, contain: getComputedStyle(document.getElementById("schScroll")).overscrollBehaviorY };
      });
      expect(r).toEqual({ side: false, gapTop: true, gapBottom: true, ftOnScreen: true, overflow: "hidden", contain: "contain" });
    });
  });
}

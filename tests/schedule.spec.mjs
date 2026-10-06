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

test("the corner tab of a selected block changes its length in 15-minute steps", async ({ page }) => {
  await open(page);
  await place(page, "cs", "10:00");
  await page.click(".sch-b");
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
  const RQ = [{ id: "cs", type: "time", label: "CS work", min: 60 }];
  const days = dayRange("2026-10-01", "2026-11-06", (k) => k <= "2026-11-02" ? { cs: 60, q: RQ } : { q: RQ, sched: [{ id: "a", q: "cs", f: 600, t: 660 }] });
  await openApp(page, { now: "2026-11-07T09:00:00-05:00", cfg: { quests: RQ }, days });
  const marks = await page.evaluate(() => [...document.querySelectorAll("#strip i")].slice(-5, -1).map((i) => i.className));
  expect(marks).toEqual(["grace", "frozen", "miss", "miss"]);
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

const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
const raw = async (page, k = "2026-11-02") => ((await store(page)).days[k] || {});

const REP = [{ id: "r1", q: "cs", f: 600, t: 660, dows: [1, 3], from: "2026-11-02", until: "2026-11-29" }];
for (const [now, n] of [["2026-11-04T08:00:00-05:00", 1], ["2026-11-03T08:00:00-05:00", 0], ["2026-11-30T08:00:00-05:00", 0]]) {
  test(`repeats show on the right days only (${now.slice(0, 10)})`, async ({ page }) => {
    await open(page, { now, cfg: { rep: REP } });
    await expect(page.locator(".sch-b.rep")).toHaveCount(n);
  });
}

test("a repeated quest shot can only repeat on the quest's own days", async ({ page }) => {
  await open(page);
  await place(page, "fr", "13:00");
  await page.click(".sch-b");
  await page.click("#schRepB");
  await expect(page.locator("[data-rd='6']")).toBeDisabled();
  await expect(page.locator("[data-rd='0']")).toBeDisabled();
  await page.click("[data-rd='2']");
  await page.click("#schRepOk");
  expect((await store(page)).cfg.rep[0]).toMatchObject({ q: "fr", f: 780, t: 840, dows: [1, 2] });
  await expect(page.locator("[data-sq='fr']")).toContainText("1h / 1h");
});

test("moving one repeat changes today only, with one tap to change every week", async ({ page }) => {
  await open(page, { cfg: { rep: REP } });
  await page.click(".sch-b.rep");
  await tapTime(page, "11:00");
  let d = await raw(page);
  expect(d.schSkip).toEqual(["r1"]);
  expect(d.sched.map((b) => [b.q, b.f, b.t])).toEqual([["cs", 660, 720]]);
  await expect(page.locator(".sch-help")).toHaveText("Changed for today only.");
  await page.click("#schEvery");
  const st = await store(page);
  expect(st.cfg.rep[0]).toMatchObject({ f: 660, t: 720 });
  d = st.days["2026-11-02"];
  expect(d.sched).toBeUndefined();
  expect(d.schSkip).toBeUndefined();
  await expect(page.locator(".sch-b.rep span")).toHaveText("11:00–12:00");
});

test("skip one occurrence, or stop the repeat", async ({ page }) => {
  await open(page, { cfg: { rep: REP } });
  await page.click(".sch-b.rep");
  await page.click("#schRm");
  expect((await raw(page)).schSkip).toEqual(["r1"]);
  await expect(page.locator(".sch-b")).toHaveCount(0);
  expect((await store(page)).cfg.rep).toHaveLength(1);
  await page.click("#schOk");
  await page.evaluate(() => { const c = JSON.parse(localStorage.getItem("pc-cache-v1")); delete c.days["2026-11-02"].schSkip; localStorage.setItem("pc-cache-v1", JSON.stringify(c)); });
  await page.reload();
  await page.click("#schBtn");
  await page.click(".sch-b.rep");
  await page.click("#schStop");
  expect((await store(page)).cfg.rep).toBeUndefined();
  await expect(page.locator(".sch-b")).toHaveCount(0);
});

test("Repeat on a moved occurrence changes its series instead of adding a second one", async ({ page }) => {
  await open(page, { cfg: { rep: REP } });
  await page.click(".sch-b.rep");
  await tapTime(page, "11:00");
  await page.click("#schRepB");
  await page.click("#schRepOk");
  const st = await store(page);
  expect(st.cfg.rep).toHaveLength(1);
  expect(st.cfg.rep[0]).toMatchObject({ id: "r1", f: 660, t: 720 });
  expect(st.days["2026-11-02"].sched).toBeUndefined();
  expect(st.days["2026-11-02"].schSkip).toBeUndefined();
  await expect(page.locator(".sch-b")).toHaveCount(1);
});

test("a repeat that would clash with a busy time on a later day is refused", async ({ page }) => {
  await open(page, { cfg: { busy: [{ id: "zL", lb: "Lecture", f: 600, t: 690, dows: [3], from: "2026-10-01" }] } });
  await place(page, "cs", "10:00");
  await page.click(".sch-b:not(.ro)");
  await page.click("#schRepB");
  await page.click("[data-rd='3']");
  await page.click("#schRepOk");
  expect((await store(page)).cfg.rep).toBeUndefined();
  await expect(page.locator("#schPage")).toContainText("That clashes with Lecture on Wed");
});

test("Auto-plan counts minutes already logged and ignores blocks already past", async ({ page }) => {
  await open(page, { days: { "2026-11-02": { q: Q, cs: 40, sched: [{ id: "a", q: "cs", f: 450, t: 480 }] } } });
  await page.click("#schAuto");
  expect(await sched(page)).toEqual([["cs", 450, 480], ["cs", 540, 560], ["fr", 575, 635]]);
});

test("a repeated quest shot reminds you like any other", async ({ page }) => {
  await page.addInitScript(mock);
  await openApp(page, { cfg: { quests: Q, nf: { on: true }, rep: [{ id: "r2", q: "cs", f: 600, t: 660, dows: [1], from: "2026-11-02", until: "2026-11-29" }] } });
  await page.clock.runFor(2000);
  const n = (await page.evaluate(() => window.__ln)).filter((x) => x.id >= 3500 && x.id < 4000);
  expect(n.map((x) => [x.title, x.extra.sched])).toEqual([["Time for CS work", "cs"]]);
});

for (const width of [320, 360]) {
  test.describe(`repeat panel ${width}`, () => {
    test.use({ viewport: { width, height: 700 }, isMobile: true, hasTouch: true });
    test("the repeat controls fit and are thumb-sized", async ({ page }) => {
      await open(page, { cfg: { rep: REP } });
      await page.locator(".sch-b.rep").click();
      await page.click("#schRepB");
      const r = await page.evaluate(() => {
        const ft = document.getElementById("schFt").getBoundingClientRect(), btns = [...document.querySelectorAll("#schFt button")];
        return { side: document.documentElement.scrollWidth > innerWidth, inFt: btns.every((b) => { const x = b.getBoundingClientRect(); return x.left >= ft.left && x.right <= ft.right && x.bottom <= innerHeight + 1; }), small: btns.filter((b) => b.getBoundingClientRect().height < 40).map((b) => b.textContent) };
      });
      expect(r).toEqual({ side: false, inFt: true, small: [] });
    });
  });
}

test("the resize tab only appears on the selected block, in its bottom-right corner", async ({ page }) => {
  await open(page);
  await place(page, "cs", "10:00");
  await place(page, "fr", "13:00");
  await expect(page.locator(".sch-h")).toHaveCount(0);
  await page.click(".sch-b >> nth=0");
  await expect(page.locator(".sch-h")).toHaveCount(1);
  const [b, h] = [await page.locator(".sch-b.on").boundingBox(), await page.locator(".sch-b.on .sch-h").boundingBox()];
  expect(Math.round(b.x + b.width - (h.x + h.width))).toBeLessThanOrEqual(4);
  expect(Math.round(b.y + b.height - (h.y + h.height))).toBeLessThanOrEqual(4);
  expect(h.width).toBeGreaterThanOrEqual(40);
  expect(h.height).toBeGreaterThanOrEqual(28);
  await page.click(".sch-b.on .sch-h");
  await expect(page.locator(".sch-b.on")).toHaveCount(1);
});

test("holding a dragged block at the bottom edge keeps scrolling the day, and the block stays under the pointer", async ({ page }) => {
  await open(page);
  await place(page, "cs", "10:00");
  const b = await page.locator(".sch-b").boundingBox();
  const sc = await page.locator("#schScroll").boundingBox();
  await page.mouse.move(b.x + 40, b.y + 10);
  await page.mouse.down();
  await page.mouse.move(b.x + 40, sc.y + sc.height - 10, { steps: 8 });
  await page.waitForTimeout(1500);
  const top = await page.evaluate(() => document.getElementById("schScroll").scrollTop);
  expect(top).toBeGreaterThan(100);
  const under = await page.evaluate((y) => { const r = document.getElementById("schTl").getBoundingClientRect(); return 420 + Math.round((y - 10 - r.top) / 22) * 15; }, sc.y + sc.height - 10);
  await page.mouse.up();
  const f = (await sched(page))[0][1];
  expect(f).toBeGreaterThanOrEqual(840);
  expect(Math.abs(f - Math.min(under, 1380 - 60))).toBeLessThanOrEqual(15);
});

test.describe("touch", () => {
  test.use({ viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true });
  test("long-press drag to the bottom keeps scrolling with the block under the finger", async ({ page }) => {
    await open(page);
    await place(page, "cs", "10:00");
    const cdp = await page.context().newCDPSession(page);
    const b = await page.locator(".sch-b").boundingBox();
    const sc = await page.locator("#schScroll").boundingBox();
    const pt = (x, y) => [{ x, y, id: 1 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(b.x + 40, b.y + 10) });
    await page.waitForTimeout(500);
    for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(b.x + 40, b.y + 10 + ((sc.y + sc.height - 8 - b.y - 10) * i) / 8) });
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => document.getElementById("schScroll").scrollTop)).toBeGreaterThan(100);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(async () => (await sched(page))[0][1]).toBeGreaterThanOrEqual(840);
  });

  test("a quick swipe over an unselected block scrolls instead of resizing it", async ({ page }) => {
    await open(page);
    await place(page, "cs", "10:00");
    const cdp = await page.context().newCDPSession(page);
    const b = await page.locator(".sch-b").boundingBox();
    const pt = (x, y) => [{ x, y, id: 1 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(b.x + b.width - 10, b.y + b.height - 5) });
    for (let i = 1; i <= 6; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(b.x + b.width - 10, b.y + b.height - 5 - i * 30) });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);
    expect(await sched(page)).toEqual([["cs", 600, 660]]);
  });
});

const BUSY = [{ id: "zL", lb: "Lecture", f: 600, t: 690, dows: [1, 3], from: "2026-10-01" }];
async function openBusyFromSettings(page, opts = {}) {
  const errors = await openApp(page, { ...opts, cfg: { quests: Q, ...(opts.cfg || {}) }, hash: "#settings" });
  await page.click("[data-st='day']");
  await page.click("#setBusy");
  await expect(page.locator("#schTitle")).toHaveText("Busy times");
  return errors;
}

test("busy times are set on their own weekday timeline in Settings, including hours already past", async ({ page }) => {
  const errors = await openBusyFromSettings(page);
  await expect(page.locator("[data-wd='1']")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".sch-past")).toHaveCount(0);
  await tapTime(page, "08:00");
  await expect(page.locator(".sch-ft-h")).toContainText("Busy at 08:00 on Mondays");
  await page.click("[data-bz='Lecture']");
  const b = (await store(page)).cfg.busy;
  expect(b.map(({ lb, f, t, dows, from }) => ({ lb, f, t, dows, from }))).toEqual([{ lb: "Lecture", f: 480, t: 540, dows: [1], from: "2026-11-02" }]);
  await expect(page.locator("#schMsg")).toHaveText("Applies from today.");
  await expect(page.locator(".sch-b.on .sch-h")).toHaveCount(1);
  await page.click("[data-wd='2']");
  await expect(page.locator(".sch-b")).toHaveCount(0);
  await page.click("#schOk");
  await expect(page.locator("#schPage")).toBeHidden();
  await expect(page.locator("#settingsBody, #setPage").first()).toContainText("1 block · Mon");
  expect(errors).toEqual([]);
});

test("a busy block can be resized from its corner tab, renamed, and given more days", async ({ page }) => {
  await openBusyFromSettings(page, { cfg: { busy: BUSY } });
  await page.click(".sch-b");
  const h = await page.locator(".sch-b.on .sch-h").boundingBox();
  expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y).closest(".sch-h"), { x: h.x + h.width / 2, y: h.y + h.height / 2 })).toBe(true);
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + 22 * 2, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => (await store(page)).cfg.busy[0].t).toBe(720);
  await page.fill("#schBzName", "Algorithms lecture");
  await page.locator("#schBzName").press("Enter");
  await expect.poll(async () => (await store(page)).cfg.busy[0].lb, { timeout: 10000 }).toBe("Algorithms lecture");
  await expect(page.locator(".sch-b.on b")).toHaveText("Algorithms lecture");
  await page.click("[data-bd='5']");
  await page.click("#schWkP");
  const z = (await store(page)).cfg.busy[0];
  expect(z).toMatchObject({ lb: "Algorithms lecture", f: 600, t: 720, dows: [1, 3, 5] });
  expect(z.until).toBeTruthy();
  await page.click("#schBzAlways");
  expect((await store(page)).cfg.busy[0].until).toBeUndefined();
  await expect(page.locator("#schBzAlways")).toHaveAttribute("aria-pressed", "true");
});

test("touch: the corner tab resizes a busy block", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await openBusyFromSettings(page, { cfg: { busy: BUSY } });
  await page.locator(".sch-b").tap();
  const h = await page.locator(".sch-b.on .sch-h").boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const pt = (y) => [{ x: h.x + h.width / 2, y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(h.y + h.height / 2) });
  for (let i = 1; i <= 4; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(h.y + h.height / 2 + i * 11) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(async () => (await store(page)).cfg.busy[0].t).toBe(720);
  await ctx.close();
});

test("adding a day that clashes with another busy block is refused", async ({ page }) => {
  await openBusyFromSettings(page, { cfg: { busy: [...BUSY, { id: "zM", lb: "Meeting", f: 630, t: 660, dows: [2], from: "2026-10-01" }] } });
  await page.click(".sch-b");
  await page.click("[data-bd='2']");
  await expect(page.locator("#schMsg")).toHaveText("That clashes with Meeting on Tuesdays.");
});

test("on Today, busy times are read-only, planned around, and shots placed before them stay", async ({ page }) => {
  await open(page, { cfg: { busy: BUSY }, days: { "2026-11-02": { q: Q, sched: [{ id: "a", q: "cs", f: 630, t: 690 }] } } });
  await expect(page.locator(".sch-b.busy.ro")).toHaveCount(1);
  await expect(page.locator(".sch-b.clash")).toHaveCount(1);
  await page.click(".sch-b.clash");
  await expect(page.locator(".sch-clash")).toHaveText("Overlaps Lecture. It stays for today, but can’t be moved onto busy time.");
  await page.click("#schDesel");
  await page.locator(".sch-b.busy").click({ position: { x: 20, y: 10 } });
  await expect(page.locator(".sch-b.busy .sch-h")).toHaveCount(0);
  await expect(page.locator("#schBzEdit")).toBeVisible();
  await tapTime(page, "12:00");
  await expect(page.locator(".sch-b.on")).toHaveCount(0);
  await expect(page.locator(".sch-ft-h")).toHaveText("Add at 12:00");
  await page.click("#schPkNo");
  await page.click("#schAuto");
  const s = (await raw(page)).sched.filter((b) => b.id !== "a");
  expect(s.every((b) => b.t <= 600 || b.f >= 690)).toBe(true);
  expect(s.length).toBeGreaterThan(0);
  await page.locator(".sch-b.busy").click({ position: { x: 20, y: 10 } });
  await page.click("#schBzEdit");
  await expect(page.locator("#schTitle")).toHaveText("Busy times");
  await expect(page.locator(".sch-b.on")).toHaveCount(1);
  await page.click("#schOk");
  await expect(page.locator("#schTitle")).toHaveText("Today’s schedule");
});

test("tapping a past time on Today offers to block it as busy", async ({ page }) => {
  await open(page);
  await tapTime(page, "08:00");
  await expect(page.locator("[data-pk]")).toHaveCount(0);
  await page.click("#schBzB");
  await expect(page.locator("#schTitle")).toHaveText("Busy times");
  await expect(page.locator(".sch-ft-h")).toContainText("Busy at 08:00 on Mondays");
  await page.click("[data-bz='Lecture']");
  await page.click("#schOk");
  await expect(page.locator(".sch-b.busy")).toHaveCount(1);
});

test("schema 10: old busy blocks and busy repeats move into Busy times", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, rep: [{ id: "r1", lb: "Class", f: 600, t: 660, dows: [1, 3], from: "2026-11-02", until: "2026-11-29" }, { id: "r2", q: "cs", f: 900, t: 960, dows: [1], from: "2026-11-02", until: "2026-11-29" }] }, days: { "2026-11-02": { q: Q, sched: [{ id: "x", lb: "Lab", f: 480, t: 540 }, { id: "y", q: "cs", f: 780, t: 840 }] } } });
  await page.click("#quests .q .act button[aria-label^='More']");
  await page.waitForTimeout(900);
  const st = await store(page);
  expect(st.schema).toBe(12);
  expect(st.cfg.rep.map((r) => r.id)).toEqual(["r2"]);
  expect(st.cfg.busy).toEqual([{ id: "zr1", lb: "Class", f: 600, t: 660, dows: [1, 3], from: "2026-11-02", until: "2026-11-29" }, { id: "zx", lb: "Lab", f: 480, t: 540, dows: [1], from: "2026-11-02", until: "2026-11-02" }]);
  expect(st.days["2026-11-02"].sched.map((b) => b.id)).toEqual(["y"]);
});

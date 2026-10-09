import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
const WK = { "2026-10-27": { tt: { a: 70, b: 30 } }, "2026-10-29": { tt: { b: 50, c: 200, d: 90 } } };
const WS = [{ id: "s1", name: "Maths", topics: ["a", "b", "c", "d"].map((id) => ({ id, name: "Topic " + id, p: 0, hist: [] })) }];
const mock = `window.__ln=[];window.Capacitor={isNativePlatform:()=>true,Plugins:{LocalNotifications:{requestPermissions:()=>Promise.resolve({display:'granted'}),createChannel:()=>Promise.resolve(),getPending:()=>Promise.resolve({notifications:[]}),cancel:()=>Promise.resolve(),schedule:(o)=>{o.notifications.forEach(n=>window.__ln.push({id:n.id,title:n.title,at:String(n.schedule.at)}));return Promise.resolve()},addListener:()=>Promise.resolve({})},App:{addListener:()=>Promise.resolve({})},KeepAwake:{keepAwake:()=>Promise.resolve(),allowSleep:()=>Promise.resolve()}}};`;

test("weekly check-in only saves the ratings you changed", async ({ page }) => {
  await openApp(page, { cfg: { quests: [], subjects: WS }, days: WK });
  await expect(page.locator("#gTitle")).toHaveText("Weekly check-in");
  await page.click("#gBody [data-rr='c'][data-pv='3']");
  await page.click("#rrSave");
  const t = (await store(page)).cfg.subjects[0].topics;
  expect(t.find((x) => x.id === "c").hist).toEqual([{ d: "2026-11-02", p: 3 }]);
  expect(t.find((x) => x.id === "d").hist).toEqual([]);
  expect(t.find((x) => x.id === "a").p).toBe(0);
});

test("weekly check-in waits while the schedule is open", async ({ page }) => {
  await openApp(page, { cfg: { quests: [{ id: "cs", type: "time", label: "CS", min: 30 }], subjects: WS }, days: WK, extra: { "pc-rerate": "" } });
  await page.evaluate(() => document.body.classList.add("sch-open"));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForTimeout(1200);
  await expect(page.locator("#gModal")).toBeHidden();
});

test("moving the week start doesn't ask for the weekly check-in twice", async ({ page }) => {
  await openApp(page, { now: "2026-11-02T09:00:00-05:00", cfg: { quests: [], subjects: WS }, days: WK, extra: { "pc-rerate": "2026-11-01" } });
  await page.waitForTimeout(1500);
  await expect(page.locator("#gModal")).toBeHidden();
});

test("Pick's topic review uses a quest linked to the topic's subject before an unrelated one", async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  const PS = [{ id: "s1", name: "Maths", topics: [{ id: "old", name: "Old proofs", p: 2, hist: [], created: "2026-01-01" }, { id: "n", name: "New", p: 1, hist: [], created: "2026-11-01" }] }];
  const Q = [{ id: "a", type: "time", label: "Other", min: 30 }, { id: "m", type: "time", label: "Maths", min: 30, subj: "s1", subjs: ["s1"], topics: ["n"] }];
  await openApp(page, { cfg: { quests: Q, subjects: PS, sparkTools: true } });
  await page.click("#toolsBtn");
  await page.click(".qmenu button:has-text('Pick for me')");
  await page.click("#pkGo");
  await expect.poll(async () => { const t = (await store(page)).timer; return t && [t.id, t.topic]; }).toEqual(["m", "old"]);
});

test.describe("phone", () => {
  test.use({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
  test("a date picker doesn't count as typing", async ({ page }) => {
    await openApp(page, { cfg: { quests: [] } });
    await page.evaluate(() => { const i = document.createElement("input"); i.type = "date"; i.id = "dt"; document.body.appendChild(i); i.focus(); });
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => document.body.classList.contains("typing"))).toBe(false);
  });
});

test("Settings counts only busy times still in use, and saving drops expired ones", async ({ page }) => {
  const busy = [{ id: "zA", lb: "Old lab", f: 600, t: 660, dows: [2], from: "2026-09-01", until: "2026-10-20" }, { id: "zB", lb: "Lecture", f: 600, t: 690, dows: [1, 3], from: "2026-10-01" }];
  await openApp(page, { cfg: { quests: [], busy }, hash: "#settings" });
  await page.click("[data-st='day']");
  await expect(page.locator(".srow", { has: page.locator("#setBusy") })).toContainText("1 block · Mon, Wed");
  await page.click("#setBusy");
  await page.click(".sch-b");
  await page.click("[data-bd='5']");
  expect((await store(page)).cfg.busy.map((b) => b.id)).toEqual(["zB"]);
});

test("repeat and busy-day labels follow the week start", async ({ page }) => {
  const rep = [{ id: "r1", q: "cs", f: 600, t: 660, dows: [0, 1], from: "2026-11-01", until: "2026-11-29" }];
  await openApp(page, { cfg: { quests: [{ id: "cs", type: "time", label: "CS", min: 60 }], rep, weekStart: 0 } });
  await page.click("#schBtn");
  await page.click(".sch-b.rep");
  await expect(page.locator(".sch-rep")).toContainText("Sun, Mon until");
});

test("unticking today in a repeat keeps today's block as a one-off", async ({ page }) => {
  const rep = [{ id: "r1", q: "cs", f: 600, t: 660, dows: [1, 3], from: "2026-11-02", until: "2026-11-29" }];
  await openApp(page, { cfg: { quests: [{ id: "cs", type: "time", label: "CS", min: 60 }], rep } });
  await page.click("#schBtn");
  await page.click(".sch-b.rep");
  await page.click("#schRepB");
  await page.click("[data-rd='1']");
  await page.click("#schRepOk");
  const s = await store(page);
  expect(s.cfg.rep[0].dows).toEqual([3]);
  expect(s.days["2026-11-02"].sched.map((b) => [b.q, b.f, b.t, b.src])).toEqual([["cs", 600, 660, "r1"]]);
  await expect(page.locator(".sch-b")).toHaveCount(1);
});

test("blocks for a quest that isn't on today don't take up time", async ({ page }) => {
  const Q = [{ id: "cs", type: "time", label: "CS", min: 60 }];
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-02": { q: Q, sched: [{ id: "x", q: "gone", f: 600, t: 720 }] } } });
  await page.click("#schBtn");
  await page.click("#schAuto");
  const s = (await store(page)).days["2026-11-02"].sched;
  expect(s.map((b) => [b.q, b.f, b.t])).toEqual([["cs", 540, 600], ["gone", 600, 720]]);
});

test("repeats on the next 13 days get their reminders now", async ({ page }) => {
  await page.addInitScript(mock);
  const rep = [{ id: "r1", q: "cs", f: 600, t: 660, dows: [3], from: "2026-11-02", until: "2026-11-29" }];
  await openApp(page, { cfg: { quests: [{ id: "cs", type: "time", label: "CS", min: 60 }], rep, nf: { on: true } } });
  await page.clock.runFor(2000);
  const n = (await page.evaluate(() => window.__ln)).filter((x) => x.id >= 3700 && x.id < 4000);
  expect(n.map((x) => [x.id, x.title])).toEqual([[3740, "Time for CS"], [3880, "Time for CS"]]);
  expect(n[0].at).toContain("Wed Nov 04 2026 10:00");
  expect(n[1].at).toContain("Wed Nov 11 2026 10:00");
});

test("Trends' topic time leaves out deleted topics", async ({ page }) => {
  const SJ = [{ id: "s1", name: "Maths", topics: [{ id: "a", name: "Algebra", p: 3, hist: [] }] }];
  await openApp(page, { cfg: { quests: [], subjects: SJ, addTrends: true }, days: { "2026-11-02": { tt: { a: 60, gone: 90 } } }, extra: { "pc-rerate": "2026-11-02" }, hash: "#trends" });
  await expect(page.locator(".ttile", { hasText: "Topic time" }).locator(".tt-v")).toHaveText("1h");
});

test("changing a new quest's type keeps its topic links", async ({ page }) => {
  const SJ = [{ id: "s1", name: "Maths", topics: [{ id: "a", name: "Algebra", p: 3, hist: [] }] }];
  await openApp(page, { cfg: { quests: [], subjects: SJ } });
  await page.click("#hdrAdd");
  await page.click("#aoQuest");
  await page.click("#nqBody .tcard[data-t='time']");
  await page.fill("#nqName", "Problem sets");
  await page.click("#nqBody [data-ltp='a']");
  await page.click("#nqBody .tcard[data-t='check']");
  await page.click("#nqSave");
  expect((await store(page)).cfg.quests[0]).toMatchObject({ type: "check", topics: ["a"] });
});

test("placing a quest counts minutes already logged", async ({ page }) => {
  const Q = [{ id: "cs", type: "time", label: "CS", min: 60 }];
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-02": { q: Q, cs: 40 } } });
  await page.click("#schBtn");
  await page.locator("#schTl").click({ position: { x: 160, y: ((10 * 60 - 7 * 60) / 15) * 22 + 6 }, force: true });
  await page.click("[data-pk='cs']");
  const s = (await store(page)).days["2026-11-02"].sched;
  expect(s.map((b) => [b.f, b.t])).toEqual([[600, 620]]);
});

test("editing a repeat's days keeps its end date and only its quest's days", async ({ page }) => {
  const Q = [{ id: "fr", type: "time", label: "French", min: 30, days: [1, 2, 3, 4, 5] }];
  const rep = [{ id: "r1", q: "fr", f: 600, t: 630, dows: [1], from: "2026-10-26", until: "2026-11-22" }];
  await openApp(page, { cfg: { quests: Q, rep } });
  await page.click("#schBtn");
  await page.click(".sch-b.rep");
  await page.click("#schRepB");
  await page.click("[data-rd='3']");
  await page.click("#schRepOk");
  expect((await store(page)).cfg.rep[0]).toMatchObject({ dows: [1, 3], until: "2026-11-22" });
});

test("swapping a block for another quest at the same time updates its reminder", async ({ page }) => {
  await page.addInitScript(`window.__all=[];window.Capacitor={isNativePlatform:()=>true,Plugins:{LocalNotifications:{requestPermissions:()=>Promise.resolve({display:'granted'}),createChannel:()=>Promise.resolve(),getPending:()=>Promise.resolve({notifications:[]}),cancel:()=>Promise.resolve(),schedule:(o)=>{o.notifications.forEach(n=>window.__all.push({id:n.id,title:n.title}));return Promise.resolve()},addListener:()=>Promise.resolve({})},App:{addListener:()=>Promise.resolve({})},KeepAwake:{keepAwake:()=>Promise.resolve(),allowSleep:()=>Promise.resolve()}}};`);
  const Q = [{ id: "cs", type: "time", label: "CS", min: 60 }, { id: "fr", type: "time", label: "French", min: 60 }];
  await openApp(page, { cfg: { quests: Q, nf: { on: true } }, days: { "2026-11-02": { q: Q, sched: [{ id: "a", q: "cs", f: 600, t: 660 }] } } });
  await page.clock.runFor(2000);
  await page.click("#schBtn");
  await page.click(".sch-b");
  await page.click("#schRm");
  await page.locator("#schTl").click({ position: { x: 160, y: ((10 * 60 - 7 * 60) / 15) * 22 + 6 }, force: true });
  await page.click("[data-pk='fr']");
  await page.clock.runFor(2000);
  const last = (await page.evaluate(() => window.__all)).filter((x) => x.id === 3500).pop();
  expect(last.title).toBe("Time for French");
});

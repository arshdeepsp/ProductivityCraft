import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const SUBJ = [
  { id: "s1", name: "Computer Science", topics: [{ id: "t1", name: "Consensus", p: 2, hist: [] }] },
  { id: "s2", name: "Mathematics", topics: [{ id: "t2", name: "Probability", p: 3, hist: [] }, { id: "t3", name: "Linear algebra", p: 1, hist: [] }] },
  { id: "s3", name: "Statistics", topics: [] }
];
const store = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));

test("the quest editor picks topics grouped by subject, and the subjects follow", async ({ page }) => {
  const Q = [{ id: "cs", type: "time", label: "Thesis reading", min: 60 }];
  await openApp(page, { cfg: { quests: Q, subjects: SUBJ } });
  await page.click("#hdrEdit");
  await page.click("#qmgr [data-tog='cs']");
  await expect(page.locator("#qmgr .tpg")).toHaveCount(3);
  await page.click("#qmgr [data-ltp='t1']");
  await page.click("#qmgr [data-lsj='s2']");
  await page.click("#qmgr [data-lsj='s3']");
  await expect(page.locator("#qmgr .tpg[data-sid='s2'] .lnk")).toHaveText("None");
  await page.click("#mgrSaveTop");
  const q = (await store(page)).cfg.quests[0];
  expect(q.topics).toEqual(["t1", "t2", "t3"]);
  expect(q.subjs).toEqual(["s1", "s2", "s3"]);
  expect(q.subj).toBe("s1");
  await expect(page.locator("#quests .sjchip .sjmore")).toHaveText("+2");
});

test("unticking a subject's last topic unlinks the subject", async ({ page }) => {
  const Q = [{ id: "cs", type: "time", label: "Thesis reading", min: 60, subj: "s1", subjs: ["s1", "s2"], topics: ["t1", "t2"] }];
  await openApp(page, { cfg: { quests: Q, subjects: SUBJ } });
  await page.click("#hdrEdit");
  await page.click("#qmgr [data-tog='cs']");
  await page.click("#qmgr [data-ltp='t2']");
  await page.click("#mgrSaveTop");
  const q = (await store(page)).cfg.quests[0];
  expect(q.topics).toEqual(["t1"]);
  expect(q.subjs).toEqual(["s1"]);
});

test("a new quest can feed a topic", async ({ page }) => {
  await openApp(page, { cfg: { quests: [], subjects: SUBJ } });
  await page.click("#hdrAdd");
  await page.click("#aoQuest");
  await page.fill("#nqName", "Proofs");
  await page.click("#nqBody [data-ltp='t3']");
  await expect(page.locator("#nqBody [data-ltp='t3']")).toHaveAttribute("aria-pressed", "true");
  await page.click("#nqSave");
  await expect.poll(async () => (await store(page)).cfg.quests.map((q) => [q.topics, q.subjs])).toEqual([[["t3"], ["s2"]]]);
});

test("the today chip shows the topic the next timer will land on, with its level", async ({ page }) => {
  const Q = [{ id: "cs", type: "time", label: "Maths", min: 60, subj: "s2", subjs: ["s2"], topics: ["t2", "t3"] }];
  const S2 = [SUBJ[0], { ...SUBJ[1], topics: [SUBJ[1].topics[0], { ...SUBJ[1].topics[1], target: 4 }] }];
  await openApp(page, { cfg: { quests: Q, subjects: S2 } });
  await expect(page.locator("#quests .sjchip .sjn")).toHaveText("Linear algebra");
  await expect(page.locator("#quests .sjchip")).toContainText("1/5");
  await expect(page.locator("#quests .sjchip .sjmore")).toHaveText("+1");
});

test("time logged on a multi-subject quest counts for each subject", async ({ page }) => {
  const Q = [{ id: "cs", type: "time", label: "Thesis reading", min: 60, subj: "s1", subjs: ["s1", "s2"] }];
  await openApp(page, { cfg: { quests: Q, subjects: SUBJ }, days: { "2026-11-01": { cs: 90, q: Q } }, hash: "#subjects" });
  const links = await page.evaluate(() => [...document.querySelectorAll(".sj-link")].map((x) => x.textContent));
  expect(links.filter((t) => t.includes("1h 30m")).length).toBe(2);
});

test("old single-subject quests still work and feed all of that subject's topics", async ({ page }) => {
  const Q = [{ id: "cs", type: "time", label: "CS work", min: 60, subj: "s1" }];
  await openApp(page, { cfg: { quests: Q, subjects: SUBJ } });
  await expect(page.locator("#quests .sjchip")).toContainText("Consensus");
  await expect(page.locator("#quests .sjchip .sjmore")).toHaveCount(0);
});

const TS = (over) => [{ id: "s1", name: "Maths", topics: [
  { id: "a", name: "Algebra", p: 3, hist: [], created: "2026-01-01", ...over.a },
  { id: "b", name: "Bayes", p: 1, hist: [], created: "2026-11-01", ...over.b },
  { id: "c", name: "Calculus", p: 3, hist: [], created: "2026-11-01", ...over.c }
] }];
const TQ = [{ id: "m", type: "time", label: "Maths", min: 60, subj: "s1", subjs: ["s1"], topics: ["c", "b", "a"] }];
for (const [name, subj, days, want] of [
  ["a topic due for review comes first", TS({ b: { target: 4 } }), {}, "a"],
  ["then the topic furthest below its target", TS({ a: { created: "2026-11-01" }, b: { target: 4 }, c: { target: 4 } }), {}, "b"],
  ["then the topic used most recently", TS({ a: { created: "2026-11-01" } }), { "2026-10-30": { tt: { b: 20 } }, "2026-11-01": { tt: { a: 10 } } }, "a"]
]) {
  test(`every timer lands on a topic: ${name}`, async ({ page }) => {
    await openApp(page, { cfg: { quests: TQ, subjects: subj }, days });
    await page.click("#quests .q .tmr");
    await expect.poll(async () => (await store(page)).timer?.topic).toBe(want);
    await expect(page.locator("#gModal")).toBeHidden();
  });
}

test("switching topic mid-session splits the time between them", async ({ page }) => {
  await openApp(page, { cfg: { quests: TQ, subjects: TS({ a: { created: "2026-11-01" }, c: { target: 5 } }) } });
  await page.click("#quests .q .tmr");
  await expect(page.locator(".runbox .rb-tp [data-rtp]")).toHaveCount(3);
  await expect(page.locator(".runbox [data-rtp='c']")).toHaveAttribute("aria-pressed", "true");
  await page.clock.fastForward(20 * 60 * 1000);
  await page.click(".runbox [data-rtp='a']");
  await expect(page.locator(".runbox [data-rtp='a']")).toHaveAttribute("aria-pressed", "true");
  await page.clock.fastForward(10 * 60 * 1000);
  await page.click("#quests .q.running .tmr");
  await expect.poll(async () => (await store(page)).days["2026-11-02"]?.tt).toEqual({ c: 20, a: 10 });
  expect((await store(page)).days["2026-11-02"].m).toBe(30);
});

const WK = { "2026-10-27": { tt: { a: 70, b: 30 } }, "2026-10-29": { tt: { b: 50, c: 200, d: 90 } }, "2026-11-01": { tt: { e: 59 } } };
const WS = [{ id: "s1", name: "Maths", topics: ["a", "b", "c", "d", "e"].map((id) => ({ id, name: "Topic " + id, p: 2, hist: [] })) }];

test("once a week, the top 3 topics by time (an hour or more) get a rerate check-in", async ({ page }) => {
  await openApp(page, { cfg: { quests: [], subjects: WS }, days: WK });
  await expect(page.locator("#gTitle")).toHaveText("Weekly check-in");
  await expect(page.locator("#gBody .rr-n b")).toHaveText(["Topic c", "Topic d", "Topic b"]);
  await page.click("#gBody [data-rr='c'][data-pv='4']");
  await page.click("#rrSave");
  await expect(page.locator("#gModal")).toBeHidden();
  const t = (await store(page)).cfg.subjects[0].topics;
  expect(t.find((x) => x.id === "c")).toMatchObject({ p: 4, hist: [{ d: "2026-11-02", p: 4 }] });
  expect(t.find((x) => x.id === "d").hist).toEqual([]);
  expect(t.find((x) => x.id === "a").hist).toEqual([]);
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(page.locator("#gModal")).toBeHidden();
});

test("no check-in when no topic got an hour last week", async ({ page }) => {
  await openApp(page, { cfg: { quests: [], subjects: WS }, days: { "2026-10-29": { tt: { a: 59 } }, "2026-11-02": { tt: { b: 300 } } } });
  await page.waitForTimeout(1500);
  await expect(page.locator("#gModal")).toBeHidden();
});

test("the Subjects page lists topics under subject headers with level, goal, month time and review", async ({ page }) => {
  const SJ = [{ id: "s1", name: "Maths", topics: [
    { id: "a", name: "Algebra", p: 2, hist: [], created: "2026-01-01" },
    { id: "b", name: "Bayes", p: 1, hist: [], created: "2026-10-30", target: 4 }
  ] }];
  const Q = [{ id: "m", type: "time", label: "Maths", min: 60, subj: "s1", subjs: ["s1"], topics: ["a", "b"] }];
  await openApp(page, { cfg: { quests: Q, subjects: SJ }, days: { "2026-09-01": { tt: { b: 500 } }, "2026-10-31": { tt: { b: 80 } } }, extra: { "pc-rerate": "2026-11-02" }, hash: "#subjects" });
  await expect(page.locator(".sjsec .sjsec-h b")).toHaveText("Maths");
  await expect(page.locator(".sjsec-h .sj-link")).toContainText("Fed by: Maths");
  await expect(page.locator(".tr")).toHaveCount(2);
  const b = page.locator(".tr[data-tid='b']");
  await expect(b.locator(".tr-mo")).toContainText("1h 20m");
  await expect(b.locator(".tr-meta")).toContainText("9h 40m total");
  await expect(b.locator(".tr-g")).toHaveText("→ Advanced");
  await expect(page.locator(".tr[data-tid='a']")).toHaveClass(/due/);
  await expect(page.locator(".tl-sum")).toContainText("1 due for review");
  await page.click(".tr[data-tid='b'] [data-pv='4']");
  await expect(b.locator(".tr-g")).toHaveText("✔ Goal");
});

const PS = [{ id: "s1", name: "Maths", topics: [{ id: "old", name: "Old proofs", p: 2, hist: [], created: "2026-01-01" }, { id: "n", name: "New", p: 1, hist: [], created: "2026-11-01" }] }];
async function pickReview(page) {
  await page.click("#toolsBtn");
  await page.click(".qmenu button:has-text('Pick for me')");
  await expect(page.locator("#pkGo")).toHaveText("Review for 5 minutes");
  await page.click("#pkGo");
}

test("Pick for me starts a topic review on a quest that feeds that topic", async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  const Q = [{ id: "a", type: "time", label: "Other", min: 30 }, { id: "m", type: "time", label: "Maths", min: 30, subj: "s1", subjs: ["s1"], topics: ["n", "old"] }];
  await openApp(page, { cfg: { quests: Q, subjects: PS, sparkTools: true } });
  await pickReview(page);
  await expect.poll(async () => { const t = (await store(page)).timer; return t && [t.id, t.topic]; }).toEqual(["m", "old"]);
  await expect(page.locator(".runbox [data-rtp='old']")).toHaveAttribute("aria-pressed", "true");
});

test("a reviewed topic no quest feeds still shows as the running topic", async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  const Q = [{ id: "a", type: "time", label: "Other", min: 30 }];
  await openApp(page, { cfg: { quests: Q, subjects: PS, sparkTools: true } });
  await pickReview(page);
  await expect.poll(async () => (await store(page)).timer?.topic).toBe("old");
  await expect(page.locator(".runbox .rb-tp")).toContainText("Old proofs");
});

test("subject boxes collapse to their header and stay collapsed", async ({ page }) => {
  await openApp(page, { cfg: { quests: [], subjects: SUBJ }, extra: { "pc-rerate": "2026-11-02" }, hash: "#subjects" });
  const s2 = page.locator(".sjsec[data-sid='s2']");
  await expect(s2.locator(".tr")).toHaveCount(2);
  await s2.locator(".sjsec-tg").click();
  await expect(s2).toHaveClass(/fold/);
  await expect(s2.locator(".sjsec-tg")).toHaveAttribute("aria-expanded", "false");
  await expect(s2.locator(".tr").first()).toBeHidden();
  await expect(page.locator(".sjsec[data-sid='s1'] .tr").first()).toBeVisible();
  await page.reload();
  await expect(page.locator(".sjsec[data-sid='s2']")).toHaveClass(/fold/);
  await page.locator(".sjsec[data-sid='s2'] .sjsec-tg").click();
  await expect(page.locator(".sjsec[data-sid='s2'] .tr").first()).toBeVisible();
});

const FS = [{ id: "s1", name: "Maths", topics: [
  { id: "f", name: "Flat one", p: 2, hist: [{ d: "2026-09-01", p: 2 }] },
  { id: "u", name: "Rising", p: 3, hist: [{ d: "2026-09-01", p: 2 }, { d: "2026-10-25", p: 3 }] },
  { id: "l", name: "Light", p: 1, hist: [] }
] }];
const FD = { "2026-10-20": { tt: { f: 200, u: 200, l: 100 } }, "2026-10-30": { tt: { f: 160, u: 160, l: 100 } } };

test("each level says what you can do, and time alone never changes it", async ({ page }) => {
  await openApp(page, { cfg: { quests: [], subjects: FS }, days: FD, extra: { "pc-rerate": "2026-11-02" }, hash: "#subjects" });
  await expect(page.locator(".tr[data-tid='u'] .tr-do")).toHaveText("I can solve standard problems without notes");
  await expect(page.locator(".tr[data-tid='l'] [data-pv='4']")).toHaveAttribute("title", "Advanced: I can apply it to new problems or explain it");
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).cfg.subjects[0].topics.map((t) => t.p)))).toEqual([2, 3, 1]);
});

test("a topic with 5h+ in 4 weeks and a flat level is flagged on Subjects and Trends", async ({ page }) => {
  await openApp(page, { cfg: { quests: [], subjects: FS, addTrends: true }, days: FD, extra: { "pc-rerate": "2026-11-02" }, hash: "#subjects" });
  await expect(page.locator(".tr.flat")).toHaveCount(1);
  await expect(page.locator(".tr[data-tid='f'] .tr-flat")).toHaveText("6h in 4 weeks, level unchanged. Does the rating still fit?");
  await page.evaluate(() => (location.hash = "#trends"));
  await expect(page.locator(".ttop-flat")).toHaveCount(1);
  await expect(page.locator(".ttop-r", { hasText: "Flat one" }).locator(".ttop-flat")).toHaveText("level flat");
  await expect(page.locator(".ttop-warn")).toContainText("1 topic got 5h+ in 4 weeks with no level change");
  await page.evaluate(() => (location.hash = "#subjects"));
  await page.click(".tr[data-tid='f'] [data-pv='3']");
  await expect(page.locator(".tr.flat")).toHaveCount(0);
});

test("the weekly check-in rates what you can do and points out flat topics", async ({ page }) => {
  await openApp(page, { cfg: { quests: [], subjects: FS }, days: FD });
  await expect(page.locator("#gTitle")).toHaveText("Weekly check-in");
  await expect(page.locator("#gBody .help").first()).toContainText("not how much time you put in");
  const f = page.locator("#gBody .rr-r", { hasText: "Flat one" });
  await expect(f.locator(".rr-do")).toHaveText("I can follow a worked example");
  await expect(f.locator(".rr-flat")).toHaveText("Lots of time lately, level unchanged.");
  await f.locator("[data-pv='4']").click();
  await expect(f.locator(".rr-do")).toHaveText("I can apply it to new problems or explain it");
});

test.describe("phone keyboard", () => {
  test.use({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
  test("adding a topic, then closing the keyboard, brings the tab bar back", async ({ page }) => {
    await page.addInitScript(() => { const v = new EventTarget(); v.height = 800; v.offsetTop = 0; v.width = 390; Object.defineProperty(window, "visualViewport", { configurable: true, value: v }); window.__kb = (h) => { v.height = h; v.dispatchEvent(new Event("resize")); }; });
    await openApp(page, { cfg: { quests: [], subjects: SUBJ }, extra: { "pc-rerate": "2026-11-02" }, hash: "#subjects" });
    const inp = page.locator("[data-tadd='s3']");
    await inp.focus();
    await page.evaluate(() => window.__kb(450));
    await expect(page.locator("body")).toHaveClass(/typing/);
    await inp.fill("Regression");
    await inp.press("Enter");
    await expect(page.locator(".sjsec[data-sid='s3'] .tr")).toHaveCount(1);
    await expect(page.locator("body")).toHaveClass(/typing/);
    await page.evaluate(() => window.__kb(800));
    await expect(page.locator("body")).not.toHaveClass(/typing/);
    await expect(page.locator("#mainnav")).toBeVisible();
  });
});

test("a topic can be renamed from Edit", async ({ page }) => {
  await openApp(page, { cfg: { quests: [], subjects: SUBJ }, extra: { "pc-rerate": "2026-11-02" }, hash: "#subjects" });
  await page.click(".tr[data-tid='t2'] [data-tedit]");
  await page.fill("[data-tname='s2,t2']", "Probability theory");
  await page.locator("[data-tname='s2,t2']").press("Enter");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).cfg.subjects[1].topics[0].name)).toBe("Probability theory");
  await expect(page.locator(".tr[data-tid='t2'] .tr-n")).toHaveText("Probability theory");
});

import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";
import { writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const Q = [{ id: "cs", type: "time", label: "CS work", min: 60 }];

test("export then import round-trips data and stamps the schema", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-01": { cs: 75, q: Q, ended: true } } });
  await page.click("#setBtn");
  await page.click("[data-st='data']");
  const dl = page.waitForEvent("download");
  await page.click("#setExp");
  const file = join(tmpdir(), "pc-backup.json");
  await (await dl).saveAs(file);
  const data = JSON.parse(readFileSync(file, "utf8"));
  expect(data.schema).toBe(12);
  expect(data.days["2026-11-01"].cs).toBe(75);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click("#setBtn");
  await page.click("[data-st='data']");
  const chooser = page.waitForEvent("filechooser");
  await page.click("#setImp");
  await (await chooser).setFiles(file);
  await page.waitForTimeout(300);
  const cs = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).days["2026-11-01"].cs);
  expect(cs).toBe(75);
});

test("old schema-2 backups import and lose retired settings", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q } });
  const file = join(tmpdir(), "pc-old.json");
  writeFileSync(file, JSON.stringify({ app: "personal-operating-playbook", version: 2, days: { "2026-10-30": { cs: 60, q: Q } }, refl: {}, cfg: { quests: Q, bank: true, updated: "2026-12-01T00:00:00Z" } }));
  await page.click("#setBtn");
  await page.click("[data-st='data']");
  const chooser = page.waitForEvent("filechooser");
  await page.click("#setImp");
  await (await chooser).setFiles(file);
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
  expect(st.days["2026-10-30"].cs).toBe(60);
  expect(st.cfg.bank).toBeUndefined();
  expect(st.schema).toBe(12);
});

test("newer backups are refused", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q } });
  const file = join(tmpdir(), "pc-new.json");
  writeFileSync(file, JSON.stringify({ app: "personal-operating-playbook", version: 2, schema: 99, days: {}, cfg: { quests: Q } }));
  await page.click("#setBtn");
  await page.click("[data-st='data']");
  const chooser = page.waitForEvent("filechooser");
  await page.click("#setImp");
  await (await chooser).setFiles(file);
  await expect(page.locator("#sync")).toContainText("newer version");
});

test("schema 4: a one-block-per-quest schedule becomes a list of shots", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-02": { q: Q, sched: { cs: { f: 600, t: 660, j5: true } } } } });
  await page.click("#quests .q .act button[aria-label^='More']");
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
  expect(st.schema).toBe(12);
  expect(st.days["2026-11-02"].sched).toEqual([{ id: "b-cs", q: "cs", f: 600, t: 660, j5: true }]);
});

test("schema 5: an old Day ends at becomes the bedtime, so the day still locks at the same hour", async ({ page }) => {
  await openApp(page, { now: "2026-11-03T01:30:00-05:00", cfg: { quests: Q, dayEnd: 2, day: { wake: "07:00", bed: "23:00" } } });
  await page.waitForTimeout(300);
  await page.click("#quests .q .act button[aria-label^='More']");
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
  expect(st.cfg.dayEnd).toBeUndefined();
  expect(st.cfg.day).toEqual({ wake: "07:00", bed: "02:00" });
  expect(Object.keys(st.days).filter((k) => st.days[k].cs)).toEqual(["2026-11-02"]);
});

test("schema 6: the old ended flag is dropped, so an already-ended today can be edited again", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q }, days: { "2026-11-01": { cs: 75, q: Q, ended: true, endedAt: "x" }, "2026-11-02": { cs: 10, q: Q, ended: true } } });
  await page.click("#quests .q .act button[aria-label^='More']");
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
  expect(st.days["2026-11-01"]).toEqual({ cs: 75, q: Q, ck: [] });
  expect(st.days["2026-11-02"].cs).toBe(20);
  expect(st.days["2026-11-02"].ended).toBeUndefined();
});

test("schema 7: subject links become topic links, keeping a quest's old default topic", async ({ page }) => {
  const SJ = [{ id: "s1", name: "CS", topics: [{ id: "t1", name: "A", p: 1 }, { id: "t2", name: "B", p: 1 }] }, { id: "s2", name: "Maths", topics: [{ id: "t3", name: "C", p: 1 }] }, { id: "s3", name: "Stats", topics: [] }];
  const Qs = [
    { id: "cs", type: "time", label: "CS", min: 60, subj: "s1", subjs: ["s1", "s2"] },
    { id: "rd", type: "time", label: "Reading", min: 30, subj: "s1", topic: "t2", fin: { t: "topic", lvl: 4 } },
    { id: "st", type: "time", label: "Stats", min: 30, subj: "s3" }
  ];
  await openApp(page, { cfg: { quests: Qs, subjects: SJ } });
  await page.click("#quests .q .act button[aria-label^='More']");
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
  expect(st.schema).toBe(12);
  const [cs, rd, sq] = st.cfg.quests;
  expect(cs).toMatchObject({ topics: ["t1", "t2", "t3"], subjs: ["s1", "s2"] });
  expect(rd).toMatchObject({ topics: ["t2"], subj: "s1", fin: { t: "topic", lvl: 4 } });
  expect(rd.topic).toBeUndefined();
  expect(sq.topics).toBeUndefined();
  expect(sq.subj).toBe("s3");
});

test("schema 9: custom achievements are dropped", async ({ page }) => {
  await openApp(page, { cfg: { quests: Q, customAch: [{ id: "a", title: "Mine", desc: "", icon: "star", kind: "streak", n: 10 }] } });
  await page.click("#quests .q .act button[aria-label^='More']");
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")));
  expect(st.schema).toBe(12);
  expect(st.cfg.customAch).toBeUndefined();
});

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
  expect(data.schema).toBe(3);
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
  expect(st.schema).toBe(3);
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

import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const day = (page) => page.evaluate(() => { const c = JSON.parse(localStorage.getItem("pc-cache-v1")).cfg; return { day: c.day || null, ov: c.dayOv || null }; });

async function openSchedule(page) {
  await openApp(page, { hash: "#settings" });
  await page.click("[data-st='schedule']");
}

test("Your day saves wake-up and bedtime", async ({ page }) => {
  await openSchedule(page);
  await page.fill("#setWake", "06:30");
  await page.fill("#setBed", "22:00");
  await expect.poll(() => day(page)).toEqual({ day: { wake: "06:30", bed: "22:00" }, ov: null });
});

test("a bedtime after the day ends is refused", async ({ page }) => {
  await openSchedule(page);
  await page.fill("#setBed", "01:00");
  await expect(page.locator("#sync")).toContainText("Bedtime can’t be after the day ends");
  expect((await day(page)).day).toBeNull();
});

test("a late bedtime works once the day ends later", async ({ page }) => {
  await openApp(page, { hash: "#settings", cfg: { dayEnd: 2 } });
  await page.click("[data-st='schedule']");
  await page.fill("#setBed", "01:00");
  await expect.poll(async () => (await day(page)).day).toEqual({ wake: "07:00", bed: "01:00" });
});

test("today-only hours can be set and cleared", async ({ page }) => {
  await openSchedule(page);
  await page.fill("#setWakeT", "10:00");
  await expect.poll(async () => (await day(page)).ov).toEqual({ date: "2026-11-02", wake: "10:00", bed: "23:00" });
  await page.click("#setDayReset");
  await expect.poll(async () => (await day(page)).ov).toBeNull();
  await expect(page.locator("#setWakeT")).toHaveValue("07:00");
});

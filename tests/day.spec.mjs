import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

const day = (page) => page.evaluate(() => { const c = JSON.parse(localStorage.getItem("pc-cache-v1")).cfg; return { day: c.day || null, ov: c.dayOv || null }; });

async function openSchedule(page) {
  await openApp(page, { hash: "#settings" });
  await page.click("[data-st='day']");
}
async function openToday(page) {
  await page.click("[data-go='today']");
  await page.click("#schBtn");
  await page.click("#schAdjB");
}

test("Your day saves wake-up and bedtime", async ({ page }) => {
  await openSchedule(page);
  await page.fill("#setWake", "06:30");
  await page.fill("#setBed", "22:00");
  await expect.poll(() => day(page)).toEqual({ day: { wake: "06:30", bed: "22:00" }, ov: null });
});

test("there is one day setting: no separate Day ends at", async ({ page }) => {
  await openSchedule(page);
  await expect(page.locator("#setDayEnd")).toHaveCount(0);
  await expect(page.locator("#settingsBody")).not.toContainText("Day ends at");
});

test("a bedtime after midnight moves the day's lock to that hour", async ({ page }) => {
  await openSchedule(page);
  await page.fill("#setBed", "01:30");
  await expect.poll(async () => (await day(page)).day).toEqual({ wake: "07:00", bed: "01:30" });
  await page.click("[data-go='today']");
  await expect(page.locator("#lockIn")).toHaveText("");
  await page.clock.setFixedTime(new Date("2026-11-03T00:15:00-05:00"));
  await page.clock.runFor(16000);
  await expect(page.locator("#lockIn")).toHaveText(/Locks in 1h (44|45)m/);
});

test("late at night, work still counts for the day before until bedtime", async ({ page }) => {
  await openApp(page, { now: "2026-11-03T00:40:00-05:00", cfg: { quests: [{ id: "j", type: "check", label: "Journal" }], day: { wake: "08:00", bed: "01:00" } } });
  await expect(page.locator("#lockIn")).toHaveText(/Locks in (19|20)m/);
  await page.locator("#quests .q .sw").click();
  await page.waitForTimeout(200);
  const days = await page.evaluate(() => { const D = JSON.parse(localStorage.getItem("pc-cache-v1")).days; return Object.keys(D).filter((k) => D[k].j); });
  expect(days).toEqual(["2026-11-02"]);
});

test("bedtimes later than 5 am, or today's bedtime past the usual lock, are refused", async ({ page }) => {
  await openSchedule(page);
  await page.fill("#setBed", "05:30");
  await expect(page.locator("#sync")).toContainText("5:00 am at the latest");
  expect((await day(page)).day).toBeNull();
  await openToday(page);
  await page.fill("#setBedT", "01:00");
  await expect(page.locator("#sync")).toContainText("Change your usual bedtime first");
  expect((await day(page)).ov).toBeNull();
});

test("today-only hours live on the schedule page and can be set and cleared", async ({ page }) => {
  await openSchedule(page);
  await expect(page.locator("#setWakeT")).toHaveCount(0);
  await openToday(page);
  await page.fill("#setWakeT", "10:00");
  await expect.poll(async () => (await day(page)).ov).toEqual({ date: "2026-11-02", wake: "10:00", bed: "23:00" });
  await page.click("#setDayReset");
  await expect.poll(async () => (await day(page)).ov).toBeNull();
  await expect(page.locator("#setWakeT")).toHaveValue("07:00");
});

test("the schedule shows today's hours, and the timeline follows a today-only change", async ({ page }) => {
  await openApp(page);
  await page.click("#schBtn");
  await expect(page.locator("#schSum")).toContainText("07:00–23:00");
  await page.click("#schAdjB");
  await page.fill("#setWakeT", "09:00");
  await expect(page.locator("#schSum")).toContainText("09:00–23:00 (today only)");
  await expect(page.locator(".sch-hr").first()).toHaveText("09:00");
});

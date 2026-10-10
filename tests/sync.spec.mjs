import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";
import { Q, SUBJ, RULES, days, busy, rep } from "./fixture.mjs";

const J = { id: "j", type: "check", label: "Journal" };
const CS = { id: "cs", type: "time", label: "Coursework", min: 60 };
/* The signed-in account's copy (pc-cache-u-<uid>), else the guest copy. */
const store = (page) => page.evaluate(() => { const a = JSON.parse(localStorage.getItem("pc-account") || "null"); return JSON.parse(localStorage.getItem(a ? "pc-cache-u-" + a.uid : "pc-cache-v1")); });
const gate = { "pc-noacct": "" };
/* Sign-in, sign-out and account switches reload the page; this waits for the reloaded document. */
/* page.evaluate that survives a reload in progress (returns null instead of throwing). */
const ev = async (page, fn) => { try { return await page.evaluate(fn); } catch (e) { return null; } };
async function reloadOn(page, fn) {
  await page.evaluate(() => { window.__pre = 1; });
  await fn();
  await expect.poll(async () => { try { return await page.evaluate(() => !window.__pre && document.readyState === "complete"); } catch (e) { return false; } }, { timeout: 10000 }).toBe(true);
}

/* In-memory stand-in for window.PCFB (see src/firebase/fb.js): docs keyed by path, snapshot listeners, auth with one
   known user. window.__cloud exposes the docs and a remote() helper that writes "from another device". */
const fake = `window.__cloud={docs:{},listeners:[],user:null,authCbs:[],fail:false};
/* The fake "cloud" survives reloads (the app reloads on sign-in/out) through localStorage __fc. */
(function(){try{var s=JSON.parse(localStorage.getItem("__fc")||"null");if(s){window.__cloud.docs=s.docs||{};window.__cloud.user=s.user||null}}catch(e){}})();
window.__cloud.save=function(){localStorage.setItem("__fc",JSON.stringify({docs:window.__cloud.docs,user:window.__cloud.user}))};
function segs(path,even){var n=path.split("/").length;if((n%2===0)!==even)throw new Error("Invalid "+(even?"document":"collection")+" reference: "+path+" has "+n+" segments")}
window.PCFB={init:function(){},
  auth:{user:function(){return window.__cloud.user},onAuth:function(cb){window.__cloud.authCbs.push(cb);setTimeout(function(){cb(window.__cloud.user)},0);return function(){}},
    signIn:function(e,p){if(p!=="secret1")return Promise.reject({code:"auth/invalid-credential",message:"bad"});window.__cloud.user={uid:"u1",email:e};window.__cloud.save();return Promise.resolve(window.__cloud.user)},
    signUp:function(e,p){window.__cloud.user={uid:"u1",email:e};window.__cloud.save();return Promise.resolve(window.__cloud.user)},
    signOut:function(){window.__cloud.user=null;window.__cloud.save();return Promise.resolve()},reset:function(){return Promise.resolve()}},
  db:{get:function(path){if(window.__cloud.throwGet)throw new Error(window.__cloud.throwGet);segs(path,true);var d=window.__cloud.docs[path];return Promise.resolve({id:path.split("/").pop(),data:d?JSON.parse(JSON.stringify(d)):null,pending:false})},
    list:function(path){segs(path,false);var out=[];Object.keys(window.__cloud.docs).forEach(function(p){if(p.indexOf(path+"/")===0&&p.slice(path.length+1).indexOf("/")<0)out.push({id:p.split("/").pop(),data:JSON.parse(JSON.stringify(window.__cloud.docs[p])),pending:false})});return Promise.resolve(out)},
    set:function(path,data){segs(path,true);window.__cloud.docs[path]=JSON.parse(JSON.stringify(data));window.__cloud.save();return Promise.resolve()},
    batch:function(ops){ops.forEach(function(o){segs(o.path,true)});if(window.__cloud.fail)return Promise.reject(new Error("offline"));try{ops.forEach(function(o){check(o.data,o.path)})}catch(e){window.__cloud.bad=(window.__cloud.bad||[]).concat(e.message);return Promise.reject(e)}ops.forEach(function(o){window.__cloud.docs[o.path]=JSON.parse(JSON.stringify(o.data))});window.__cloud.save();window.__cloud.writes=(window.__cloud.writes||0)+ops.length;return Promise.resolve()},
    onDoc:function(path,cb){segs(path,true);var l={path:path,cb:cb};window.__cloud.listeners.push(l);return function(){window.__cloud.listeners=window.__cloud.listeners.filter(function(x){return x!==l})}},
    onCol:function(path,cb){segs(path,false);var l={col:path,cb:cb};window.__cloud.listeners.push(l);return function(){window.__cloud.listeners=window.__cloud.listeners.filter(function(x){return x!==l})}}}};
/* What Firestore refuses in a document: undefined, functions, an array directly inside an array, reserved __x__ field names, documents over 1 MiB. */
function check(v,at){if(v===undefined||typeof v==="function")throw new Error("bad value at "+at);
  if(Array.isArray(v)){v.forEach(function(x,i){if(Array.isArray(x))throw new Error("nested array at "+at+"["+i+"]");check(x,at+"["+i+"]")})}
  else if(v&&typeof v==="object"){Object.keys(v).forEach(function(k){if(/^__.*__$/.test(k)||k==="")throw new Error("bad field name "+JSON.stringify(k)+" at "+at);check(v[k],at+"."+k)});if(at.indexOf(".")<0&&JSON.stringify(v).length>1048576)throw new Error("document too big: "+at)}}
window.__cloud.remote=function(path,data){window.__cloud.docs[path]=JSON.parse(JSON.stringify(data));window.__cloud.save();var id=path.split("/").pop(),col=path.slice(0,path.lastIndexOf("/"));window.__cloud.listeners.forEach(function(l){if(l.path===path)l.cb({id:id,data:data,pending:false});if(l.col===col)l.cb([{id:id,data:data,pending:false,type:"modified"}])})};`;

async function signIn(page) {
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='account']");
  await page.click("#acOpen");
  await page.fill("#auEmail", "arsh@example.com");
  await page.fill("#auPw", "secret1");
  await reloadOn(page, () => page.click("#auGo"));
  await page.click("[data-st='account']");
  await expect(page.locator(".srow", { hasText: "Signed in as" })).toContainText("arsh@example.com");
}
const docs = (page) => page.evaluate(() => window.__cloud.docs);

test("signing in pushes local data as documents under users/<uid>, with stamps", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [J, CS], repFrozen: true }, days: { "2026-11-01": { j: true, cs: 30, q: [J, CS] } } });
  await page.locator("#quests .q .sw").first().click();
  await signIn(page);
  await expect.poll(async () => Object.keys(await docs(page)).sort()).toEqual(expect.arrayContaining(["users/u1/data/cfg", "users/u1/days/2026-11-01", "users/u1/days/2026-11-02"]));
  const d = await docs(page);
  expect(d["users/u1/data/cfg"].quests.map((q) => q.id)).toEqual(["j", "cs"]);
  expect(d["users/u1/data/cfg"].u).toBeGreaterThan(0);
  expect(d["users/u1/days/2026-11-02"]).toMatchObject({ j: true });
  expect(d["users/u1/days/2026-11-02"].u).toBeGreaterThan(0);
  expect(d["users/u1/days/2026-11-02"].sess).toBeUndefined();
  expect(d["users/u1/days/2026-11-01"].u).toBeGreaterThan(0);
  expect((await store(page)).meta.u["days/2026-11-01"]).toBe(d["users/u1/days/2026-11-01"].u);
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Up to date");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-account")))).toEqual({ uid: "u1", email: "arsh@example.com" });
});

test("later edits push only the changed documents; a removed day is pushed as a tombstone", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { now: "2026-11-02T09:00:00-05:00", cfg: { quests: [J, CS], repFrozen: true } });
  await signIn(page);
  await expect.poll(async () => (await docs(page))["users/u1/data/cfg"]).toBeTruthy();
  await page.evaluate(() => { window.__cloud.writes = 0; });
  await page.goto("http://127.0.0.1:4173/index.html#today");
  await page.locator("#quests .q .sw").first().click();
  await expect.poll(async () => (await docs(page))["users/u1/days/2026-11-02"]).toMatchObject({ j: true });
  expect(await page.evaluate(() => window.__cloud.writes)).toBe(1);
  await page.click("#schBtn"); await page.click("#schDN"); await page.click("#schAuto");
  await expect.poll(async () => ((await docs(page))["users/u1/days/2026-11-03"] || {}).sched).toBeTruthy();
  await page.click("#schClr"); await page.click("#schClr");
  await expect.poll(async () => (await docs(page))["users/u1/days/2026-11-03"]).toMatchObject({ del: true });
});

test("a signed-in device with nothing local pulls everything; remote changes arrive live and the newer stamp wins", async ({ page }) => {
  await page.addInitScript(fake);
  await page.addInitScript(() => { if (localStorage.getItem("__fc")) return; localStorage.setItem("pc-account", JSON.stringify({ uid: "u1", email: "arsh@example.com" })); window.__cloud.user = { uid: "u1", email: "arsh@example.com" };
    const now = Date.parse("2026-11-02T08:00:00-05:00");
    window.__cloud.docs["users/u1/data/cfg"] = { quests: [{ id: "r", type: "check", label: "Remote quest" }], rules: [], idleGrove: 0, start: "2026-10-01T04:00:00.000Z", updated: "2026-11-01T10:00:00Z", repFrozen: true, u: now };
    window.__cloud.docs["users/u1/days/2026-11-01"] = { r: true, q: [{ id: "r", type: "check", label: "Remote quest" }], u: now };
    window.__cloud.docs["users/u1/data/refl"] = { map: { "2026-10-20": { text: "late night" } }, u: now }; });
  await openApp(page, { cfg: { quests: [] } });
  await expect(page.locator("#quests .q .lbl")).toHaveText(["Remote quest"]);
  let s = await store(page);
  expect(s.days["2026-11-01"]).toMatchObject({ r: true });
  expect(s.refl["2026-10-20"].text).toBe("late night");
  expect(s.meta.u.cfg).toBe(Date.parse("2026-11-02T08:00:00-05:00"));
  await page.evaluate(() => window.__cloud.remote("users/u1/days/2026-11-01", { r: false, q: [{ id: "r", type: "check", label: "Remote quest" }], u: Date.parse("2026-11-02T09:30:00-05:00") }));
  await expect.poll(async () => (await store(page)).days["2026-11-01"].r).toBe(false);
  await page.evaluate(() => window.__cloud.remote("users/u1/days/2026-11-01", { r: true, q: [{ id: "r", type: "check", label: "Remote quest" }], u: Date.parse("2026-11-02T07:00:00-05:00") }));
  await page.waitForTimeout(400);
  expect((await store(page)).days["2026-11-01"].r).toBe(false);
  await page.evaluate(() => window.__cloud.remote("users/u1/data/cfg", { quests: [{ id: "r", type: "check", label: "Renamed remotely" }], rules: [], idleGrove: 0, start: "2026-10-01T04:00:00.000Z", repFrozen: true, u: Date.parse("2026-11-02T09:40:00-05:00") }));
  await expect(page.locator("#quests .q .lbl")).toHaveText(["Renamed remotely"]);
  await page.evaluate(() => window.__cloud.remote("users/u1/days/2026-11-05", { sched: [{ id: "z", q: "r", f: 600, t: 660 }], u: Date.parse("2026-11-02T09:45:00-05:00") }));
  await expect.poll(async () => ((await store(page)).days["2026-11-05"] || {}).sched).toHaveLength(1);
  await page.evaluate(() => window.__cloud.remote("users/u1/days/2026-11-05", { del: true, u: Date.parse("2026-11-02T09:50:00-05:00") }));
  await expect.poll(async () => (await store(page)).days["2026-11-05"]).toBeUndefined();
  expect((await store(page)).meta.del["days/2026-11-05"]).toBe(Date.parse("2026-11-02T09:50:00-05:00"));
});

test("sign out removes the account's data from this device and signing back in brings it back; a wrong password is explained", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [J], repFrozen: true }, extra: gate });
  await page.fill("#auEmail", "arsh@example.com");
  await page.fill("#auPw", "nope");
  await page.click("#auGo");
  await expect(page.locator("#auMsg")).toHaveText("Wrong email or password.");
  await page.fill("#auPw", "secret1");
  await reloadOn(page, () => page.click("#auGo"));
  await expect(page.locator("#authPage")).toHaveCount(0);
  await page.locator("#quests .q .sw").first().click();
  await expect.poll(async () => ((await docs(page))["users/u1/days/2026-11-02"] || {}).j).toBe(true);
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='account']");
  await reloadOn(page, () => page.click("#acOut"));
  await expect(page.locator("#auNote")).toHaveText("Signed out. Your data is in your account and comes back when you sign in.");
  expect(await page.evaluate(() => [localStorage.getItem("pc-account"), localStorage.getItem("pc-cache-u-u1")])).toEqual([null, null]);
  expect(((await store(page)).days["2026-11-02"] || {}).j).toBeFalsy();
  await page.fill("#auEmail", "arsh@example.com");
  await page.fill("#auPw", "secret1");
  await page.click("#auGo");
  await expect.poll(async () => { try { return (((await store(page)) || { days: {} }).days["2026-11-02"] || {}).j; } catch (e) { return null; } }).toBe(true);
});

test("sign out asks first when changes haven't synced, and waits for a running timer", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [J, CS], repFrozen: true } });
  await signIn(page);
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Up to date");
  await page.evaluate(() => { window.__cloud.fail = true; });
  await page.goto("http://127.0.0.1:4173/index.html#today");
  await page.locator("#quests .q .sw").first().click();
  await page.waitForTimeout(600);
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='account']");
  await page.click("#acOut");
  await expect(page.locator("#sync")).toHaveText("Some changes haven’t synced yet. Signing out now loses them.");
  await expect(page.locator("#acOut")).toHaveText("Sign out anyway");
  expect(await page.evaluate(() => localStorage.getItem("pc-account"))).not.toBeNull();
  await reloadOn(page, () => page.click("#acOut"));
  expect(await page.evaluate(() => [localStorage.getItem("pc-account"), localStorage.getItem("pc-cache-u-u1")])).toEqual([null, null]);
});

test("a failed push is retried on the next change, and the Account page says so", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [J], repFrozen: true } });
  await signIn(page);
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Up to date");
  await page.evaluate(() => { window.__cloud.fail = true; });
  await page.goto("http://127.0.0.1:4173/index.html#today");
  await page.locator("#quests .q .sw").first().click();
  await page.waitForTimeout(600);
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='account']");
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Problem: offline");
  await page.evaluate(() => { window.__cloud.fail = false; });
  await page.click("#acSync");
  await expect.poll(async () => (await docs(page))["users/u1/days/2026-11-02"]).toMatchObject({ j: true });
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Up to date");
});

test("a full account's worth of data pushes as documents Firestore accepts, and comes back whole on another device", async ({ page, browser }) => {
  await page.addInitScript(fake);
  const D = days();
  const cfg = { quests: Q, subjects: SUBJ, rules: RULES, busy, rep, nf: { on: true, checkinAt: "20:00" }, showPlan: true, addTrends: true, sparkTools: true, badges: { first: "2026-10-03" }, noStreak: [{ from: "2026-10-10", to: "2026-10-15" }], ignore: ["cl"], xpSpent: 200, weekStart: 0 };
  await openApp(page, { cfg, days: D });
  await page.evaluate(() => { const S = JSON.parse(localStorage.getItem("pc-cache-v1")); S.refl = { "2026-10-12": { text: "exam week", tags: ["tired"] } }; localStorage.setItem("pc-cache-v1", JSON.stringify(S)); });
  await page.reload();
  await signIn(page);
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Up to date");
  const d = await docs(page);
  expect(await page.evaluate(() => window.__cloud.bad || [])).toEqual([]);
  const local = await store(page);
  const dayKeys = Object.keys(local.days).sort();
  expect(dayKeys.length).toBeGreaterThanOrEqual(Object.keys(D).length);
  expect(Object.keys(d).sort()).toEqual(["users/u1/data/cfg", "users/u1/data/refl"].concat(dayKeys.map((k) => "users/u1/days/" + k)).sort());
  const clean = (o) => { const x = JSON.parse(JSON.stringify(o)); delete x.u; return x; };
  expect(clean(d["users/u1/data/cfg"])).toEqual(local.cfg);
  expect(clean(d["users/u1/data/refl"]).map).toEqual(local.refl);
  for (const k of dayKeys) expect(clean(d["users/u1/days/" + k])).toEqual(local.days[k]);
  // a second, empty device signed into the same account ends up with the same data
  const ctx = await browser.newContext({ timezoneId: "America/Toronto", serviceWorkers: "block" });
  const other = await ctx.newPage();
  await other.addInitScript(fake);
  await other.addInitScript((remote) => { if (localStorage.getItem("__fc")) return; window.__cloud.docs = remote; window.__cloud.user = { uid: "u1", email: "arsh@example.com" }; localStorage.setItem("pc-account", JSON.stringify(window.__cloud.user)); }, d);
  await openApp(other, { now: "2026-11-02T09:00:00-05:00", cfg: { quests: [] } });
  await expect(other.locator("#quests .q .lbl").first()).toBeVisible();
  const mirror = await store(other);
  expect(mirror.cfg).toEqual(local.cfg);
  expect(mirror.refl).toEqual(local.refl);
  for (const k of dayKeys) expect(mirror.days[k]).toEqual(local.days[k]);
  expect(await other.evaluate(() => window.__cloud.bad || [])).toEqual([]);
  await ctx.close();
});

test("a running timer pushes nothing until it is stopped", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { now: "2026-11-02T09:00:00-05:00", cfg: { quests: [CS], repFrozen: true } });
  await signIn(page);
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Up to date");
  await page.goto("http://127.0.0.1:4173/index.html#today");
  await page.evaluate(() => { window.__cloud.writes = 0; });
  await page.click("#quests .q.t-time .tmr");
  await expect(page.locator("#quests .q.running")).toHaveCount(1);
  await page.clock.runFor(10 * 60000);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__cloud.writes)).toBe(0);
  await page.click("#quests .q.running .tmr");
  await expect.poll(async () => ((await docs(page))["users/u1/days/2026-11-02"] || {}).cs).toBe(10);
  expect(await page.evaluate(() => window.__cloud.writes)).toBe(1);
});

test("signing out and back in starts one set of listeners; a session that ends elsewhere signs this device out but keeps its copy", async ({ page }) => {
  await page.addInitScript(fake);
  await page.addInitScript(() => { if (localStorage.getItem("__fc")) return; localStorage.setItem("pc-account", JSON.stringify({ uid: "u1", email: "arsh@example.com" })); window.__cloud.user = { uid: "u1", email: "arsh@example.com" }; window.__cloud.save(); });
  await openApp(page, { cfg: { quests: [J], repFrozen: true }, extra: gate });
  await expect.poll(async () => (await docs(page))["users/u1/data/cfg"]).toBeTruthy();
  await expect.poll(() => page.evaluate(() => window.__cloud.listeners.length)).toBe(3);
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='account']");
  await reloadOn(page, () => page.click("#acOut"));
  await expect(page.locator("#authPage")).toBeVisible();
  expect(await page.evaluate(() => window.__cloud.listeners.length)).toBe(0);
  await page.fill("#auEmail", "arsh@example.com");
  await page.fill("#auPw", "secret1");
  await page.click("#auGo");
  await expect.poll(() => ev(page, () => window.__cloud.listeners.length)).toBe(3);
  await expect.poll(() => ev(page, () => localStorage.getItem("pc-cache-u-u1"))).not.toBeNull();
  await page.evaluate(() => { window.__cloud.user = null; window.__cloud.save(); window.__cloud.authCbs.forEach((cb) => cb(null)); });
  await expect.poll(() => ev(page, () => document.querySelector("#auNote") && document.querySelector("#auNote").textContent)).toContain("You were signed out.");
  expect(await page.evaluate(() => localStorage.getItem("pc-account"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("pc-cache-u-u1"))).not.toBeNull();
  expect(await page.evaluate(() => window.__cloud.listeners.length)).toBe(0);
});

test("a sync error on sign-in still signs you in and shows the problem in Settings", async ({ page }) => {
  await page.addInitScript(fake);
  await page.addInitScript(() => { if (!sessionStorage.getItem("thrown")) { window.__cloud.throwGet = "Invalid document reference"; } });
  await openApp(page, { cfg: { quests: [J], repFrozen: true } });
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='account']");
  await page.click("#acOpen");
  await page.fill("#auEmail", "arsh@example.com");
  await page.fill("#auPw", "secret1");
  await reloadOn(page, () => page.click("#auGo"));
  await page.click("[data-st='account']");
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Problem: Invalid document reference");
  await page.evaluate(() => { window.__cloud.throwGet = ""; sessionStorage.setItem("thrown", "1"); });
  await page.click("#acSync");
  await expect(page.locator(".srow", { has: page.locator("b", { hasText: /^Sync$/ }) })).toContainText("Up to date");
  expect(Object.keys(await docs(page))).toContain("users/u1/data/cfg");
});

test("signing in to an account that already has data shows that account's data; this device's own data stays apart and is back after signing out", async ({ page }) => {
  await page.addInitScript(fake);
  await page.addInitScript(() => { if (localStorage.getItem("__fc")) return; const now = Date.parse("2026-11-02T08:00:00-05:00");
    window.__cloud.docs["users/u1/data/cfg"] = { quests: [{ id: "r", type: "check", label: "Account quest" }], rules: [], idleGrove: 0, start: "2026-10-01T04:00:00.000Z", repFrozen: true, u: now }; window.__cloud.save(); });
  await openApp(page, { cfg: { quests: [{ id: "g", type: "check", label: "Device quest" }], repFrozen: true }, extra: gate });
  await page.fill("#auEmail", "arsh@example.com");
  await page.fill("#auPw", "secret1");
  await reloadOn(page, () => page.click("#auGo"));
  await expect(page.locator("#quests .q .lbl")).toHaveText(["Account quest"]);
  expect(((await docs(page))["users/u1/data/cfg"].quests || []).map((q) => q.label)).toEqual(["Account quest"]);
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem("pc-cache-v1"))).cfg.quests.map((q) => q.label)).toEqual(["Device quest"]);
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='account']");
  await reloadOn(page, () => page.click("#acOut"));
  await page.click("#auSkip");
  await expect(page.locator("#quests .q .lbl")).toHaveText(["Device quest"]);
});

test("a new account takes the data made without an account", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [{ id: "g", type: "check", label: "Device quest" }], repFrozen: true }, extra: gate });
  await page.click("[data-av='signup']");
  await page.fill("#auEmail", "new@example.com");
  await page.fill("#auPw", "abcdef");
  await page.fill("#auPw2", "abcdef");
  await reloadOn(page, () => page.click("#auGo"));
  await expect(page.locator("#quests .q .lbl")).toHaveText(["Device quest"]);
  await expect.poll(async () => (((await docs(page))["users/u1/data/cfg"] || {}).quests || []).map((q) => q.label)).toEqual(["Device quest"]);
  expect(await page.evaluate(() => localStorage.getItem("pc-cache-u-u1"))).not.toBeNull();
});

test("a device that was signed in before data was linked to accounts hands its data to that account", async ({ page }) => {
  await page.addInitScript(fake);
  await page.addInitScript(() => { if (localStorage.getItem("__fc")) return; localStorage.setItem("pc-account", JSON.stringify({ uid: "u1", email: "arsh@example.com" })); window.__cloud.user = { uid: "u1", email: "arsh@example.com" }; window.__cloud.save(); });
  await openApp(page, { cfg: { quests: [{ id: "g", type: "check", label: "My quest" }], repFrozen: true } });
  await expect(page.locator("#quests .q .lbl")).toHaveText(["My quest"]);
  const slots = await page.evaluate(() => [!!localStorage.getItem("pc-cache-u-u1"), localStorage.getItem("pc-slots")]);
  expect(slots).toEqual([true, "1"]);
  await expect.poll(async () => (((await docs(page))["users/u1/data/cfg"] || {}).quests || []).map((q) => q.label)).toEqual(["My quest"]);
});

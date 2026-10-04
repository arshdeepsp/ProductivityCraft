const fs = require("fs");
const p = "android/app/src/main/AndroidManifest.xml";
let m = fs.readFileSync(p, "utf8");
const perms = [
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.SCHEDULE_EXACT_ALARM",
  "android.permission.USE_EXACT_ALARM",
  "android.permission.RECEIVE_BOOT_COMPLETED",
  "android.permission.VIBRATE"
];
for (const x of perms) {
  if (!m.includes(x)) m = m.replace("</manifest>", `    <uses-permission android:name="${x}" />\n</manifest>`);
}
fs.writeFileSync(p, m);
console.log("Permissions added to", p);

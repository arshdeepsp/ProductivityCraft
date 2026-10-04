const fs = require("fs");
const path = require("path");

const pkg = "com.arsh.productivitycraft";
if (!fs.existsSync("android")) {
  console.error("No android/ folder. Run: npx cap add android");
  process.exit(1);
}

const javaDir = path.join("android", "app", "src", "main", "java", ...pkg.split("."));
const resDir = path.join("android", "app", "src", "main", "res", "drawable");
const layoutDir = path.join("android", "app", "src", "main", "res", "layout");
fs.mkdirSync(javaDir, { recursive: true });
fs.mkdirSync(resDir, { recursive: true });
fs.mkdirSync(layoutDir, { recursive: true });

for (const f of ["FocusNotifyPlugin.java", "FocusNotifier.java", "FocusNotifyReceiver.java"]) {
  fs.copyFileSync(path.join("native", "android", f), path.join(javaDir, f));
}
fs.copyFileSync(path.join("native", "android", "ic_stat_focus.xml"), path.join(resDir, "ic_stat_focus.xml"));
fs.copyFileSync(path.join("native", "android", "notif_focus.xml"), path.join(layoutDir, "notif_focus.xml"));
fs.copyFileSync(path.join("native", "android", "notif_focus_small.xml"), path.join(layoutDir, "notif_focus_small.xml"));
const rawDir = path.join("android", "app", "src", "main", "res", "raw");
fs.mkdirSync(rawDir, { recursive: true });
fs.copyFileSync(path.join("native", "android", "pc_chime.wav"), path.join(rawDir, "pc_chime.wav"));

fs.writeFileSync(path.join(javaDir, "MainActivity.java"), `package ${pkg};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FocusNotifyPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);

const manifestPath = path.join("android", "app", "src", "main", "AndroidManifest.xml");
let manifest = fs.readFileSync(manifestPath, "utf8");
if (!manifest.includes("FocusNotifyReceiver")) {
  manifest = manifest.replace("</application>", '    <receiver android:name=".FocusNotifyReceiver" android:exported="false" />\n    </application>');
  fs.writeFileSync(manifestPath, manifest);
}

console.log("Native focus timer plugin added to android/");

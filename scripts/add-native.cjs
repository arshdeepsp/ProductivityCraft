const fs = require("fs");
const path = require("path");

const pkg = "com.arsh.productivitycraft";
if (!fs.existsSync("android")) {
  console.error("No android/ folder. Run: npx cap add android");
  process.exit(1);
}

const javaDir = path.join("android", "app", "src", "main", "java", ...pkg.split("."));
const resDir = path.join("android", "app", "src", "main", "res", "drawable");
fs.mkdirSync(javaDir, { recursive: true });
fs.mkdirSync(resDir, { recursive: true });

fs.copyFileSync(path.join("native", "android", "FocusNotifyPlugin.java"), path.join(javaDir, "FocusNotifyPlugin.java"));
fs.copyFileSync(path.join("native", "android", "ic_stat_focus.xml"), path.join(resDir, "ic_stat_focus.xml"));

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

console.log("Native focus timer plugin added to android/");

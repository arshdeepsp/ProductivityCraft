package com.arsh.productivitycraft;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FocusNotify")
public class FocusNotifyPlugin extends Plugin {

    static final String TAP_EXTRA = "pcTap";
    private static String pendingTap = null;

    static void capture(Intent intent) {
        if (intent == null) return;
        String tap = intent.getStringExtra(TAP_EXTRA);
        if (tap != null) {
            pendingTap = tap;
            intent.removeExtra(TAP_EXTRA);
        }
    }

    @PluginMethod
    public void takeTap(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("tap", pendingTap);
        pendingTap = null;
        call.resolve(ret);
    }

    @PluginMethod
    public void show(PluginCall call) {
        try {
            call.resolve(FocusNotifier.post(getContext(), call.getData()));
        } catch (SecurityException e) {
            call.reject("Notification permission not granted");
        } catch (Exception e) {
            call.reject(e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    @PluginMethod
    public void hide(PluginCall call) {
        FocusNotifier.hide(getContext());
        call.resolve();
    }
}

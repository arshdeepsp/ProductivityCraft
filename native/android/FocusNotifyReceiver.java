package com.arsh.productivitycraft;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONObject;

public class FocusNotifyReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String state = intent.getStringExtra("state");
        if (state == null) return;
        try {
            FocusNotifier.post(ctx, new JSONObject(state));
        } catch (Exception ignored) {
        }
    }
}

package com.arsh.productivitycraft;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.SystemClock;
import android.util.Base64;
import android.view.View;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import org.json.JSONArray;
import org.json.JSONObject;

public final class FocusNotifier {

    static final String CHANNEL_ID = "pc_focus_live2";
    static final int NOTIFICATION_ID = 901;
    static final int ALARM_REQUEST = 9011;
    static final int GROW_REQUEST = 9012;
    static final int ART_HEIGHT_PX = 324;
    static final int BG_HEIGHT_PX = 432;
    static final int BG_SMALL_PX = 128;

    private FocusNotifier() { }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Live focus timer", NotificationManager.IMPORTANCE_DEFAULT);
        channel.setSound(null, null);
        channel.enableVibration(false);
        channel.setDescription("A ticking timer while you focus");
        channel.setShowBadge(false);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(channel);
    }

    private static Long readWhen(JSONObject d) {
        if (d == null || !d.has("when") || d.isNull("when")) return null;
        long w = d.optLong("when", 0L);
        return w == 0L ? null : w;
    }

    static JSObject post(Context ctx, JSONObject d) {
        ensureChannel(ctx);
        cancelNext(ctx);
        cancelGrow(ctx);

        String title = d.optString("title", "Focusing");
        String body = d.optString("body", "");
        Long when = readWhen(d);
        boolean countdown = d.optBoolean("countdown", false);
        boolean chrono = d.optBoolean("chrono", true) && when != null;
        long now = System.currentTimeMillis();
        if (countdown && when != null && when <= now) chrono = false;

        int icon = ctx.getResources().getIdentifier("ic_stat_focus", "drawable", ctx.getPackageName());
        if (icon == 0) icon = ctx.getApplicationInfo().icon;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(icon)
            .setContentTitle(title)
            .setContentText(body)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);

        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (launch != null) {
            launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            launch.putExtra(FocusNotifyPlugin.TAP_EXTRA, d.optString("tap", "live"));
            PendingIntent pi = PendingIntent.getActivity(ctx, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            builder.setContentIntent(pi);
        }

        Bitmap art = null;
        int prog = -1;
        long nextStage = 0L;
        JSONObject grow = d.optJSONObject("grow");
        if (grow != null) {
            long from = grow.optLong("from", 0L);
            long dur = grow.optLong("dur", 0L);
            JSONArray arts = grow.optJSONArray("art");
            if (dur > 0L) {
                double p = Math.max(0d, Math.min(1d, (now - from) / (double) dur));
                int last = arts == null ? 0 : Math.max(0, arts.length() - 1);
                int idx = p >= 1d ? last : (int) Math.floor(p * last);
                prog = (int) Math.round(p * 1000d);
                if (arts != null && arts.length() > 0) art = decodeArt(arts.optString(idx, ""), ART_HEIGHT_PX);
                if (p < 1d && last > 0) nextStage = from + (long) Math.ceil(dur * (idx + 1) / (double) last);
            }
        }

        JSONObject bgo = d.optJSONObject("bg");
        Bitmap bgBig = null, bgSmall = null;
        boolean darkBg = false;
        if (bgo != null) {
            bgBig = decodeArt(bgo.optString("big", ""), BG_HEIGHT_PX);
            bgSmall = decodeArt(bgo.optString("small", ""), BG_SMALL_PX);
            darkBg = bgo.optBoolean("dark", false);
        }

        String customError = null;
        RemoteViews big = null, small = null;
        try {
            big = buildView(ctx, R.layout.notif_focus, true, title, body, when, chrono, countdown, art, prog, bgBig, darkBg);
            small = buildView(ctx, R.layout.notif_focus_small, false, title, body, when, chrono, countdown, art, -1, bgSmall, darkBg);
        } catch (Exception e) {
            customError = e.getClass().getSimpleName() + ": " + e.getMessage();
        }
        boolean custom = big != null && small != null;
        if (custom) {
            builder.setStyle(new NotificationCompat.DecoratedCustomViewStyle())
                .setCustomContentView(small)
                .setCustomBigContentView(big);
        }

        if (chrono) {
            builder.setShowWhen(true)
                .setWhen(when)
                .setUsesChronometer(true)
                .setChronometerCountDown(countdown);
        } else {
            builder.setShowWhen(false);
        }

        boolean nextScheduled = false;
        if (chrono && countdown) {
            JSONObject next = d.optJSONObject("next");
            if (next != null) {
                nextScheduled = scheduleNext(ctx, when, next);
            }
            if (!nextScheduled) builder.setTimeoutAfter((when - now) + 500);
        }
        boolean growScheduled = false;
        if (nextStage > now && !(chrono && countdown && when != null && nextStage >= when)) {
            growScheduled = scheduleAlarm(ctx, GROW_REQUEST, nextStage, d);
        }

        NotificationManagerCompat.from(ctx).notify(NOTIFICATION_ID, builder.build());

        JSObject ret = new JSObject();
        ret.put("custom", custom);
        ret.put("version", 9);
        ret.put("when", when == null ? 0 : when);
        ret.put("nextScheduled", nextScheduled);
        ret.put("art", art != null);
        ret.put("growNext", growScheduled ? nextStage : 0);
        if (customError != null) ret.put("error", customError);
        return ret;
    }

    private static PendingIntent alarmIntent(Context ctx, int request, String state, int flags) {
        Intent i = new Intent(ctx, FocusNotifyReceiver.class);
        if (state != null) i.putExtra("state", state);
        return PendingIntent.getBroadcast(ctx, request, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    private static boolean scheduleNext(Context ctx, long at, JSONObject next) {
        return scheduleAlarm(ctx, ALARM_REQUEST, at, next);
    }

    private static boolean scheduleAlarm(Context ctx, int request, long at, JSONObject state) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return false;
        PendingIntent pi = alarmIntent(ctx, request, state.toString(), PendingIntent.FLAG_UPDATE_CURRENT);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            }
            return true;
        } catch (SecurityException e) {
            return false;
        }
    }

    static void cancelNext(Context ctx) {
        cancelAlarm(ctx, ALARM_REQUEST);
    }

    static void cancelGrow(Context ctx) {
        cancelAlarm(ctx, GROW_REQUEST);
    }

    private static void cancelAlarm(Context ctx, int request) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = alarmIntent(ctx, request, null, PendingIntent.FLAG_NO_CREATE);
        if (am != null && pi != null) {
            am.cancel(pi);
            pi.cancel();
        }
    }

    private static Bitmap decodeArt(String b64, int targetHeight) {
        if (b64 == null || b64.isEmpty()) return null;
        try {
            byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
            Bitmap raw = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (raw == null) return null;
            int k = Math.max(1, targetHeight / Math.max(1, raw.getHeight()));
            return k == 1 ? raw : Bitmap.createScaledBitmap(raw, raw.getWidth() * k, raw.getHeight() * k, false);
        } catch (Exception e) {
            return null;
        }
    }

    static void hide(Context ctx) {
        cancelNext(ctx);
        cancelGrow(ctx);
        NotificationManagerCompat.from(ctx).cancel(NOTIFICATION_ID);
    }

    private static RemoteViews buildView(Context ctx, int layout, boolean withBody, String title, String body, Long when, boolean chrono, boolean countdown, Bitmap art, int prog, Bitmap bg, boolean darkBg) {
        RemoteViews view = new RemoteViews(ctx.getPackageName(), layout);
        view.setTextViewText(R.id.pc_title, title);
        if (withBody) view.setTextViewText(R.id.pc_body, body);
        if (bg != null) {
            view.setImageViewBitmap(R.id.pc_bg, bg);
            view.setViewVisibility(R.id.pc_bg, View.VISIBLE);
            view.setTextColor(R.id.pc_title, darkBg ? 0xFFFFFFFF : 0xFF1E1E1E);
            view.setTextColor(R.id.pc_chrono, darkBg ? 0xFFFFFF55 : 0xFF14320C);
            if (withBody) view.setTextColor(R.id.pc_body, darkBg ? 0xFFD6DCE6 : 0xFF2A2A2A);
        } else {
            view.setViewVisibility(R.id.pc_bg, View.GONE);
        }
        if (art != null) {
            view.setImageViewBitmap(R.id.pc_art, art);
            view.setViewVisibility(R.id.pc_art, View.VISIBLE);
        } else {
            view.setViewVisibility(R.id.pc_art, View.GONE);
        }
        if (withBody) {
            if (prog >= 0) {
                view.setProgressBar(R.id.pc_prog, 1000, prog, false);
                view.setViewVisibility(R.id.pc_prog, View.VISIBLE);
            } else {
                view.setViewVisibility(R.id.pc_prog, View.GONE);
            }
        }
        if (chrono && when != null) {
            long base = SystemClock.elapsedRealtime() + (when - System.currentTimeMillis());
            view.setViewVisibility(R.id.pc_chrono, View.VISIBLE);
            view.setChronometer(R.id.pc_chrono, base, null, true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                view.setChronometerCountDown(R.id.pc_chrono, countdown);
            }
        } else {
            view.setViewVisibility(R.id.pc_chrono, View.GONE);
        }
        return view;
    }
}

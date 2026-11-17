package com.badshah.orders;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.speech.tts.TextToSpeech;
import androidx.core.app.NotificationCompat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

public class OrderBackgroundService extends Service {
    public static final String BG_CHANNEL_ID = "badshah_orders_bg_channel";
    public static final String ALERT_CHANNEL_ID = "badshah_orders_alert_channel";
    private static final int FOREGROUND_NOTIFICATION_ID = 2001;
    private static final int ORDER_ALERT_NOTIFICATION_ID = 2002;
    private static final int SERVICE_ALERT_NOTIFICATION_ID = 2003;

    private static TextToSpeech tts;
    private static volatile boolean ttsReady = false;
    private static String pendingSpeech = null;
    private static Context appContext = null;
    private static PowerManager.WakeLock alertWakeLock = null;

    private static final Set<String> announcedOrderIds = Collections.synchronizedSet(new HashSet<>());
    private static final Set<String> announcedServiceRequestIds = Collections.synchronizedSet(new HashSet<>());
    private PowerManager.WakeLock wakeLock;
    private volatile boolean isRunning = false;
    private boolean isFirstPoll = true;
    private String lastEtag = null;
    private boolean isFirstServicePoll = true;
    private String lastServiceEtag = null;

    public static void setAppContext(Context ctx) {
        if (ctx != null) {
            appContext = ctx.getApplicationContext();
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        setAppContext(this);
        createNotificationChannels();

        // 1. Start Foreground Service IMMEDIATELY at line 1 to satisfy Android's 5-second deadline
        Notification notification = buildForegroundNotification();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    FOREGROUND_NOTIFICATION_ID,
                    notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                );
            } else {
                startForeground(FOREGROUND_NOTIFICATION_ID, notification);
            }
        } catch (Throwable t) {
            t.printStackTrace();
            try {
                // Guaranteed fallback to untyped foreground service if device rejects typed FGS
                startForeground(FOREGROUND_NOTIFICATION_ID, notification);
            } catch (Throwable ignored) {}
        }

        // 2. Keep CPU active so voice announcements & background poller run when screen is off
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BadshahOrders:BgWakeLock");
                wakeLock.acquire();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 3. Initialize native Text-to-Speech (Google TTS with Hindi locale)
        initTTS(this);

        // 4. Start native background order listener thread
        isRunning = true;
        startBackgroundPoller();
    }

    public static synchronized void initTTS(Context context) {
        if (context != null) {
            appContext = context.getApplicationContext();
        }
        if (tts != null && ttsReady) return;

        Context target = context != null ? context.getApplicationContext() : appContext;
        if (target == null) return;

        tts = new TextToSpeech(target, status -> {
            if (status == TextToSpeech.SUCCESS) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    try {
                        AudioAttributes attrs = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build();
                        tts.setAudioAttributes(attrs);
                    } catch (Exception ignored) {}
                }
                int res = tts.setLanguage(new Locale("hi", "IN"));
                if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                    tts.setLanguage(new Locale("en", "IN"));
                }
                ttsReady = true;
                if (pendingSpeech != null) {
                    speakAloud(pendingSpeech);
                    pendingSpeech = null;
                }
            }
        });
    }

    public static boolean isTtsReady() {
        return ttsReady && tts != null;
    }

    public static synchronized void speakAloud(String text) {
        if (text == null || text.trim().isEmpty()) return;
        if (ttsReady && tts != null) {
            try {
                // QUEUE_ADD ensures multiple rapid incoming orders are spoken completely without truncation
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    android.os.Bundle params = new android.os.Bundle();
                    params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);
                    tts.speak(text, TextToSpeech.QUEUE_ADD, params, "order_announcement_" + System.currentTimeMillis());
                } else {
                    java.util.HashMap<String, String> params = new java.util.HashMap<>();
                    params.put(TextToSpeech.Engine.KEY_PARAM_VOLUME, "1.0");
                    tts.speak(text, TextToSpeech.QUEUE_ADD, params);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        } else {
            pendingSpeech = text;
            if (appContext != null) {
                initTTS(appContext);
            }
        }
    }

    public static void stopSpeech() {
        if (tts != null) {
            try {
                tts.stop();
            } catch (Exception ignored) {}
        }
    }

    private static synchronized void acquireTempWakeLock(Context context, long timeoutMs) {
        if (context == null) return;
        try {
            if (alertWakeLock == null) {
                PowerManager pm = (PowerManager) context.getApplicationContext().getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    alertWakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BadshahOrders:AlertWakeLock");
                    alertWakeLock.setReferenceCounted(false);
                }
            }
            if (alertWakeLock != null) {
                if (alertWakeLock.isHeld()) {
                    alertWakeLock.release();
                }
                alertWakeLock.acquire(timeoutMs);
            }
        } catch (Exception ignored) {}
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            // Channel 1: Background service status (Low importance, silent)
            NotificationChannel bgChannel = new NotificationChannel(
                BG_CHANNEL_ID,
                "Badshah Orders Background Listener",
                NotificationManager.IMPORTANCE_LOW
            );
            bgChannel.setDescription("Keeps restaurant audio announcements active in background");
            bgChannel.setShowBadge(false);
            manager.createNotificationChannel(bgChannel);

            // Channel 2: Incoming order alert (High importance, heads-up banner, vibration, sound)
            NotificationChannel alertChannel = new NotificationChannel(
                ALERT_CHANNEL_ID,
                "Badshah New Order Alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            alertChannel.setDescription("Incoming table order popups with order items and sound");
            alertChannel.enableVibration(true);
            alertChannel.setVibrationPattern(new long[]{0, 350, 150, 350});
            alertChannel.enableLights(true);
            alertChannel.setLightColor(0xFFFFB703);
            alertChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            try {
                android.net.Uri soundUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION);
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build();
                alertChannel.setSound(soundUri, audioAttributes);
            } catch (Exception ignored) {}

            manager.createNotificationChannel(alertChannel);
        }
    }

    private Notification buildForegroundNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setAction(Intent.ACTION_MAIN);
        notificationIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, BG_CHANNEL_ID)
            .setContentTitle("Badshah Restaurant Orders")
            .setContentText("पृष्ठभूमि में आर्डर व आवाज़ अलर्ट चालू है (Listening in background)")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW);

        try {
            android.graphics.Bitmap largeIcon = android.graphics.BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher);
            if (largeIcon != null) {
                builder.setLargeIcon(largeIcon);
            }
        } catch (Exception ignored) {}

        return builder.build();
    }

    /**
     * Post a high-priority Heads-Up Notification that displays and dictates order items.
     */
    public static void postOrderAlert(Context context, String orderNumber, String tableLabel, String itemsSummary, String speechAnnouncement) {
        if (context == null) return;
        if (orderNumber != null && !orderNumber.isEmpty()) {
            announcedOrderIds.add(orderNumber);
        }

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        Intent notificationIntent = new Intent(context, MainActivity.class);
        notificationIntent.setAction(Intent.ACTION_MAIN);
        notificationIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            (int) System.currentTimeMillis(),
            notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        String displayTable = (tableLabel != null && !tableLabel.trim().isEmpty()) ? tableLabel : "काउंटर";
        String displayOrder = (orderNumber != null && !orderNumber.trim().isEmpty()) ? orderNumber : "";
        String title = "🔔 नया ऑर्डर: टेबल " + displayTable + (!displayOrder.isEmpty() ? " (#" + displayOrder + ")" : "");
        String contentText = (itemsSummary != null && !itemsSummary.trim().isEmpty())
            ? "📋 " + itemsSummary
            : "रसोई में नया ऑर्डर तैयार करें";

        NotificationCompat.BigTextStyle bigStyle = new NotificationCompat.BigTextStyle()
            .setBigContentTitle(title)
            .setSummaryText("नया ऑर्डर")
            .bigText("📍 टेबल: " + displayTable + "\n" +
                     ((itemsSummary != null && !itemsSummary.trim().isEmpty()) ? "🍽️ आइटम: " + itemsSummary + "\n" : "") +
                     "डैशबोर्ड खोलने के लिए टैप करें");

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, ALERT_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(contentText)
            .setStyle(bigStyle)
            .setSmallIcon(R.drawable.ic_notification)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);

        try {
            android.graphics.Bitmap largeIcon = android.graphics.BitmapFactory.decodeResource(context.getResources(), R.mipmap.ic_launcher);
            if (largeIcon != null) {
                builder.setLargeIcon(largeIcon);
            }
        } catch (Exception ignored) {}

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            android.net.Uri soundUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION);
            builder.setSound(soundUri);
            builder.setVibrate(new long[]{0, 350, 150, 350});
        }

        Notification notification = builder.build();
        manager.notify(ORDER_ALERT_NOTIFICATION_ID, notification);

        // Hardware vibration fallback only on pre-Oreo Android (Oreo+ channels manage vibration)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            try {
                android.os.Vibrator v = (android.os.Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) {
                    v.vibrate(new long[]{0, 350, 150, 350}, -1);
                }
            } catch (Exception ignored) {}
        }

        // Safe non-blocking CPU wake lock during audio announcement (avoids lock stacking & leaks)
        acquireTempWakeLock(context, 4000);

        // Dictate items out loud via Native Android TTS
        if (speechAnnouncement != null && !speechAnnouncement.trim().isEmpty()) {
            speakAloud(speechAnnouncement);
        }
    }

    /**
     * Post a high-priority Heads-Up Notification for customer staff requests (water, bill, assistance).
     */
    public static void postServiceAlert(Context context, String requestId, String tableLabel, String serviceType, String note, String speechAnnouncement) {
        if (context == null) return;
        if (requestId != null && !requestId.isEmpty()) {
            announcedServiceRequestIds.add(requestId);
        }

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        Intent notificationIntent = new Intent(context, MainActivity.class);
        notificationIntent.setAction(Intent.ACTION_MAIN);
        notificationIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            (int) System.currentTimeMillis(),
            notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        String displayTable = (tableLabel != null && !tableLabel.trim().isEmpty()) ? tableLabel : "काउंटर";
        String serviceHindiLabel;
        String emoji;

        if ("water".equalsIgnoreCase(serviceType)) {
            serviceHindiLabel = "पीने का पानी";
            emoji = "💧";
        } else if ("bill".equalsIgnoreCase(serviceType)) {
            serviceHindiLabel = "बिल रिक्वेस्ट";
            emoji = "💵";
        } else if ("cleaning".equalsIgnoreCase(serviceType)) {
            serviceHindiLabel = "टेबल सफाई";
            emoji = "🧹";
        } else if ("other".equalsIgnoreCase(serviceType)) {
            serviceHindiLabel = "कटलरी / प्लेट्स";
            emoji = "🍴";
        } else {
            serviceHindiLabel = "वेटर कॉल (सहायता)";
            emoji = "🛎️";
        }

        String title = "🔔 " + emoji + " सर्विस अलर्ट: टेबल " + displayTable + " (" + serviceHindiLabel + ")";
        String contentText = "टेबल " + displayTable + " से " + serviceHindiLabel + " के लिए अनुरोध प्राप्त हुआ है।";
        if (note != null && !note.trim().isEmpty()) {
            contentText += " नोट: " + note.trim();
        }

        NotificationCompat.BigTextStyle bigStyle = new NotificationCompat.BigTextStyle()
            .setBigContentTitle(title)
            .setSummaryText("स्टाफ सहायता")
            .bigText("📍 टेबल: " + displayTable + "\n" +
                     emoji + " सेवा: " + serviceHindiLabel + "\n" +
                     (note != null && !note.trim().isEmpty() ? "📝 नोट: " + note.trim() + "\n" : "") +
                     "डैशबोर्ड खोलने के लिए टैप करें");

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, ALERT_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(contentText)
            .setStyle(bigStyle)
            .setSmallIcon(R.drawable.ic_notification)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);

        try {
            android.graphics.Bitmap largeIcon = android.graphics.BitmapFactory.decodeResource(context.getResources(), R.mipmap.ic_launcher);
            if (largeIcon != null) {
                builder.setLargeIcon(largeIcon);
            }
        } catch (Exception ignored) {}

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            android.net.Uri soundUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION);
            builder.setSound(soundUri);
            builder.setVibrate(new long[]{0, 350, 150, 350});
        }

        Notification notification = builder.build();
        manager.notify(SERVICE_ALERT_NOTIFICATION_ID, notification);

        // Hardware vibration fallback only on pre-Oreo Android (Oreo+ channels manage vibration)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            try {
                android.os.Vibrator v = (android.os.Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) {
                    v.vibrate(new long[]{0, 350, 150, 350}, -1);
                }
            } catch (Exception ignored) {}
        }

        // Safe non-blocking CPU wake lock during audio announcement (avoids lock stacking & leaks)
        acquireTempWakeLock(context, 4000);

        // Dictate service alert out loud via Native Android TTS
        if (speechAnnouncement != null && !speechAnnouncement.trim().isEmpty()) {
            speakAloud(speechAnnouncement);
        }
    }

    /**
     * Native background poller that checks active orders and staff requests directly via HTTP when WebView is sleeping.
     */
    private void startBackgroundPoller() {
        new Thread(() -> {
            while (isRunning) {
                try {
                    Thread.sleep(8000);
                    if (!isRunning) break;
                    pollOrdersNative();
                    pollServiceRequestsNative();
                } catch (InterruptedException e) {
                    break;
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }).start();
    }

    private void pollOrdersNative() {
        try {
            URL url = new URL("https://biriyani-badshah.vercel.app/api/business/orders?status=active&limit=15");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
            conn.setRequestProperty("Cache-Control", "no-cache");
            if (lastEtag != null) {
                conn.setRequestProperty("If-None-Match", lastEtag);
            }

            // Forward session cookies from persistent storage safely without blocking WebView
            try {
                String cookies = getSharedPreferences("badshah_prefs", Context.MODE_PRIVATE)
                    .getString("saved_cookies", null);
                if ((cookies == null || cookies.trim().isEmpty())) {
                    android.webkit.CookieManager cm = android.webkit.CookieManager.getInstance();
                    cookies = cm.getCookie("https://biriyani-badshah.vercel.app");
                }
                if (cookies != null && !cookies.trim().isEmpty()) {
                    conn.setRequestProperty("Cookie", cookies);
                }
            } catch (Exception ignored) {}

            int responseCode = conn.getResponseCode();
            if (responseCode == 304) {
                // Zero changes on server — skip download and JSON parsing
                conn.disconnect();
                return;
            }

            if (responseCode == 200) {
                String newEtag = conn.getHeaderField("ETag");
                if (newEtag != null) {
                    lastEtag = newEtag;
                }
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();

                JSONArray orders = new JSONArray(sb.toString());

                // Seed existing orders on first tick to avoid announcing historical orders
                if (isFirstPoll) {
                    for (int i = 0; i < orders.length(); i++) {
                        JSONObject o = orders.getJSONObject(i);
                        announcedOrderIds.add(o.optString("id", ""));
                        announcedOrderIds.add(o.optString("orderNumber", ""));
                    }
                    isFirstPoll = false;
                    conn.disconnect();
                    return;
                }

                for (int i = 0; i < orders.length(); i++) {
                    JSONObject order = orders.getJSONObject(i);
                    String id = order.optString("id", "");
                    String orderNumber = order.optString("orderNumber", "");
                    String fulfilment = order.optString("fulfilment", "");

                    if ("RECEIVED".equalsIgnoreCase(fulfilment) && !id.isEmpty() && !announcedOrderIds.contains(id) && !announcedOrderIds.contains(orderNumber)) {
                        announcedOrderIds.add(id);
                        announcedOrderIds.add(orderNumber);

                        String tableLabel = order.optString("tableLabel", "काउंटर");
                        if (tableLabel.isEmpty() || "null".equalsIgnoreCase(tableLabel)) {
                            tableLabel = "काउंटर";
                        }

                        // Extract order items
                        JSONArray items = order.optJSONArray("items");
                        StringBuilder itemsSummary = new StringBuilder();
                        StringBuilder itemsSpeech = new StringBuilder();

                        if (items != null && items.length() > 0) {
                            for (int j = 0; j < items.length(); j++) {
                                JSONObject it = items.getJSONObject(j);
                                String rawName = it.optString("itemName", it.optString("name", "आइटम"));
                                String speechName = rawName.replaceAll("\\s*\\([^)]*\\)", "").trim();
                                if (speechName.isEmpty()) speechName = rawName;
                                int qty = it.optInt("quantity", it.optInt("qty", 1));

                                if (j > 0) {
                                    itemsSummary.append(", ");
                                    itemsSpeech.append(j == items.length() - 1 ? " और " : ", ");
                                }
                                itemsSummary.append(qty).append("x ").append(rawName);
                                itemsSpeech.append(qty).append(" ").append(speechName);
                            }
                        }

                        String speechText = "नया ऑर्डर आया है। टेबल " + tableLabel + " से ऑर्डर प्राप्त हुआ है।";
                        if (itemsSpeech.length() > 0) {
                            speechText += " ऑर्डर में है: " + itemsSpeech.toString() + "।";
                        }

                        postOrderAlert(
                            getApplicationContext(),
                            orderNumber,
                            tableLabel,
                            itemsSummary.toString(),
                            speechText
                        );
                    }
                }
            }
            conn.disconnect();
        } catch (Exception ignored) {
            // will retry automatically on next tick
        }
    }

    private void pollServiceRequestsNative() {
        try {
            URL url = new URL("https://biriyani-badshah.vercel.app/api/business/service-requests?status=OPEN");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
            conn.setRequestProperty("Cache-Control", "no-cache");
            if (lastServiceEtag != null) {
                conn.setRequestProperty("If-None-Match", lastServiceEtag);
            }

            try {
                String cookies = getSharedPreferences("badshah_prefs", Context.MODE_PRIVATE)
                    .getString("saved_cookies", null);
                if ((cookies == null || cookies.trim().isEmpty())) {
                    android.webkit.CookieManager cm = android.webkit.CookieManager.getInstance();
                    cookies = cm.getCookie("https://biriyani-badshah.vercel.app");
                }
                if (cookies != null && !cookies.trim().isEmpty()) {
                    conn.setRequestProperty("Cookie", cookies);
                }
            } catch (Exception ignored) {}

            int responseCode = conn.getResponseCode();
            if (responseCode == 304) {
                conn.disconnect();
                return;
            }

            if (responseCode == 200) {
                String newEtag = conn.getHeaderField("ETag");
                if (newEtag != null) {
                    lastServiceEtag = newEtag;
                }
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();

                JSONArray requests = new JSONArray(sb.toString());

                // Seed existing requests on first tick to avoid announcing historical calls
                if (isFirstServicePoll) {
                    for (int i = 0; i < requests.length(); i++) {
                        JSONObject r = requests.getJSONObject(i);
                        announcedServiceRequestIds.add(r.optString("id", ""));
                    }
                    isFirstServicePoll = false;
                    conn.disconnect();
                    return;
                }

                for (int i = 0; i < requests.length(); i++) {
                    JSONObject req = requests.getJSONObject(i);
                    String id = req.optString("id", "");
                    String status = req.optString("status", "OPEN");

                    if ("OPEN".equalsIgnoreCase(status) && !id.isEmpty() && !announcedServiceRequestIds.contains(id)) {
                        announcedServiceRequestIds.add(id);

                        String tableLabel = req.optString("tableLabel", "काउंटर");
                        if (tableLabel.isEmpty() || "null".equalsIgnoreCase(tableLabel)) {
                            tableLabel = "काउंटर";
                        }
                        String type = req.optString("type", "assistance");
                        String note = req.optString("note", "");

                        String servicePhraseHindi;
                        if ("water".equalsIgnoreCase(type)) {
                            servicePhraseHindi = "पीने का पानी मांगा गया है।";
                        } else if ("bill".equalsIgnoreCase(type)) {
                            servicePhraseHindi = "बिल मांगा गया है।";
                        } else if ("cleaning".equalsIgnoreCase(type)) {
                            servicePhraseHindi = "टेबल साफ करने के लिए बुलाया गया है।";
                        } else if ("other".equalsIgnoreCase(type)) {
                            servicePhraseHindi = "चम्मच और प्लेट मांगी गई है।";
                        } else {
                            servicePhraseHindi = "वेटर को बुलाया गया है।";
                        }

                        String speechText = "सर्विस अलर्ट! टेबल " + tableLabel + " से " + servicePhraseHindi;
                        if (!note.isEmpty() && !"null".equalsIgnoreCase(note)) {
                            speechText += " नोट: " + note + "।";
                        }

                        postServiceAlert(
                            getApplicationContext(),
                            id,
                            tableLabel,
                            type,
                            note,
                            speechText
                        );
                    }
                }
            }
            conn.disconnect();
        } catch (Exception ignored) {
            // will retry automatically on next tick
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {}
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}

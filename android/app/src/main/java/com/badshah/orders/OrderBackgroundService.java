package com.badshah.orders;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
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

    private static TextToSpeech tts;
    private static volatile boolean ttsReady = false;
    private static String pendingSpeech = null;

    private static final Set<String> announcedOrderIds = Collections.synchronizedSet(new HashSet<>());
    private PowerManager.WakeLock wakeLock;
    private volatile boolean isRunning = false;
    private boolean isFirstPoll = true;
    private String lastEtag = null;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();

        // 1. Keep CPU active so voice announcements & background poller run when screen is off
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BadshahOrders:BgWakeLock");
                wakeLock.acquire();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 2. Initialize native Text-to-Speech (Google TTS with Hindi locale)
        initTTS(this);

        // 3. Start Foreground Service with persistent status notification
        Notification notification = buildForegroundNotification();
        try {
            startForeground(FOREGROUND_NOTIFICATION_ID, notification);
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 4. Start native background order listener thread
        isRunning = true;
        startBackgroundPoller();
    }

    public static synchronized void initTTS(Context context) {
        if (tts != null && ttsReady) return;

        tts = new TextToSpeech(context.getApplicationContext(), status -> {
            if (status == TextToSpeech.SUCCESS) {
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
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "order_announcement_" + System.currentTimeMillis());
            } catch (Exception e) {
                e.printStackTrace();
            }
        } else {
            pendingSpeech = text;
        }
    }

    public static void stopSpeech() {
        if (tts != null) {
            try {
                tts.stop();
            } catch (Exception ignored) {}
        }
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
            manager.createNotificationChannel(bgChannel);

            // Channel 2: Incoming order alert (High importance, heads-up banner, vibration)
            NotificationChannel alertChannel = new NotificationChannel(
                ALERT_CHANNEL_ID,
                "Badshah New Order Alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            alertChannel.setDescription("Incoming table order popups with order items and sound");
            alertChannel.enableVibration(true);
            alertChannel.setVibrationPattern(new long[]{0, 300, 200, 300});
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

        return new NotificationCompat.Builder(this, BG_CHANNEL_ID)
            .setContentTitle("Badshah Restaurant Orders")
            .setContentText("पृष्ठभूमि में आर्डर व आवाज़ अलर्ट चालू है (Listening in background)")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
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

        Notification notification = new NotificationCompat.Builder(context, ALERT_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(contentText)
            .setStyle(bigStyle)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setDefaults(Notification.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build();

        int alertNotifId = (int) (System.currentTimeMillis() % 100000) + 100;
        manager.notify(alertNotifId, notification);

        // Dictate items out loud via Native Android TTS
        if (speechAnnouncement != null && !speechAnnouncement.trim().isEmpty()) {
            speakAloud(speechAnnouncement);
        }
    }

    /**
     * Native background poller that checks active orders directly via HTTP when WebView is sleeping.
     */
    private void startBackgroundPoller() {
        new Thread(() -> {
            while (isRunning) {
                try {
                    Thread.sleep(8000);
                    if (!isRunning) break;
                    pollOrdersNative();
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

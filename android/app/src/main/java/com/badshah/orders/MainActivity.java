package com.badshah.orders;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQ_POST_NOTIF = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Keep screen on while operating on counter (safe kitchen display mode)
        try {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } catch (Exception ignored) {}

        // Connect application context & pre-warm native Text-to-Speech engine
        OrderBackgroundService.setAppContext(this);
        OrderBackgroundService.initTTS(this);

        // Start foreground background service to keep orders active in background
        try {
            Intent serviceIntent = new Intent(this, OrderBackgroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Request Android 13+ (API 33+) POST_NOTIFICATIONS permission safely after UI loads
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            try {
                getWindow().getDecorView().postDelayed(() -> {
                    if (!isFinishing() && !isDestroyed()) {
                        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, PERMISSION_REQ_POST_NOTIF);
                        }
                    }
                }, 1200);
            } catch (Exception ignored) {}
        }

        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebSettings settings = this.bridge.getWebView().getSettings();
            // Allow auto-playing Hindi chime & speech announcements without requiring touch gestures
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);

            // Enable persistent cookies in Android WebView across app restarts and sleeping screens
            try {
                android.webkit.CookieManager cookieManager = android.webkit.CookieManager.getInstance();
                cookieManager.setAcceptCookie(true);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    cookieManager.setAcceptThirdPartyCookies(this.bridge.getWebView(), true);
                }
                cookieManager.flush();
            } catch (Exception e) {
                e.printStackTrace();
            }

            // Expose native Android TTS & Order Notifications to JavaScript (window.AndroidTTS)
            this.bridge.getWebView().addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void speak(String text) {
                    OrderBackgroundService.speakAloud(text);
                }

                @JavascriptInterface
                public void showOrderNotification(String orderNumber, String tableLabel, String itemsSummary, String speechAnnouncement) {
                    OrderBackgroundService.postOrderAlert(
                        MainActivity.this,
                        orderNumber,
                        tableLabel,
                        itemsSummary,
                        speechAnnouncement
                    );
                }

                @JavascriptInterface
                public void showServiceNotification(String requestId, String tableLabel, String serviceType, String note, String speechAnnouncement) {
                    OrderBackgroundService.postServiceAlert(
                        MainActivity.this,
                        requestId,
                        tableLabel,
                        serviceType,
                        note,
                        speechAnnouncement
                    );
                }

                @JavascriptInterface
                public boolean isAvailable() {
                    return OrderBackgroundService.isTtsReady();
                }

                @JavascriptInterface
                public void stop() {
                    OrderBackgroundService.stopSpeech();
                }

                @JavascriptInterface
                public void syncCookies() {
                    persistCookies(MainActivity.this);
                }

                @JavascriptInterface
                public boolean hasNotificationPermission() {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        return checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
                    }
                    return true;
                }

                @JavascriptInterface
                public void requestNotificationPermission() {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, PERMISSION_REQ_POST_NOTIF);
                        }
                    }
                }

                @JavascriptInterface
                public boolean isBatteryOptimizationIgnored() {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                        return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
                    }
                    return true;
                }

                @JavascriptInterface
                public void requestIgnoreBatteryOptimization() {
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                            intent.setData(Uri.parse("package:" + getPackageName()));
                            startActivity(intent);
                        }
                    } catch (Exception ignored) {}
                }

                @JavascriptInterface
                public void testNotification() {
                    OrderBackgroundService.postOrderAlert(
                        MainActivity.this,
                        "TEST-01",
                        "1",
                        "Chicken Biryani (x2)",
                        "टेबल नंबर 1 पर नया आर्डर आया है"
                    );
                }
            }, "AndroidTTS");
        }
    }

    public static void persistCookies(Context context) {
        try {
            android.webkit.CookieManager cm = android.webkit.CookieManager.getInstance();
            cm.flush();
            String c = cm.getCookie("https://biriyani-badshah.vercel.app");
            if ((c == null || c.trim().isEmpty()) && cm.hasCookies()) {
                c = cm.getCookie("http://localhost:3000");
            }
            if (c != null && !c.trim().isEmpty() && context != null) {
                context.getSharedPreferences("badshah_prefs", Context.MODE_PRIVATE)
                    .edit()
                    .putString("saved_cookies", c)
                    .apply();
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onResume() {
        super.onResume();
        persistCookies(this);
    }

    @Override
    public void onPause() {
        super.onPause();
        persistCookies(this);
        // Keep JavaScript timers and background order announcements running when minimized or screen off
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().resumeTimers();
        }
    }

    @Override
    public void onDestroy() {
        // Note: Do not shutdown OrderBackgroundService TTS here as it continues running as a foreground service
        super.onDestroy();
    }
}


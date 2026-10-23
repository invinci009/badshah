package com.badshah.orders;

import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Prevent screen from sleeping while on counter (kitchen display mode)
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Connect application context & pre-warm native Text-to-Speech engine
        OrderBackgroundService.setAppContext(this);
        OrderBackgroundService.initTTS(this);

        // Start foreground background service to keep orders active in background
        try {
            android.content.Intent serviceIntent = new android.content.Intent(this, OrderBackgroundService.class);
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebSettings settings = this.bridge.getWebView().getSettings();
            // Allow auto-playing Hindi chime & speech announcements without requiring touch gestures
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setDomStorageEnabled(true);

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
            }, "AndroidTTS");
        }
    }

    @Override
    public void onPause() {
        super.onPause();
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


package com.badshah.orders;

import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;
    private String pendingSpeech = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Prevent screen from sleeping while on counter (kitchen display mode)
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Initialize Android Native Text-to-Speech (Google TTS engine)
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int result = tts.setLanguage(new Locale("hi", "IN"));
                if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                    // Fallback to Indian English or system default if Hindi voice pack not installed
                    tts.setLanguage(new Locale("en", "IN"));
                }
                ttsReady = true;
                if (pendingSpeech != null) {
                    speakNative(pendingSpeech);
                    pendingSpeech = null;
                }
            }
        });

        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebSettings settings = this.bridge.getWebView().getSettings();
            // Allow auto-playing Hindi chime & speech announcements without requiring touch gestures
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setDomStorageEnabled(true);

            // Expose native Android TTS to JavaScript (window.AndroidTTS)
            this.bridge.getWebView().addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void speak(String text) {
                    if (text == null || text.trim().isEmpty()) return;
                    if (ttsReady && tts != null) {
                        speakNative(text);
                    } else {
                        pendingSpeech = text;
                    }
                }

                @JavascriptInterface
                public boolean isAvailable() {
                    return tts != null && ttsReady;
                }

                @JavascriptInterface
                public void stop() {
                    if (tts != null) {
                        tts.stop();
                    }
                }
            }, "AndroidTTS");
        }
    }

    private void speakNative(String text) {
        try {
            if (tts != null) {
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "order_announcement_" + System.currentTimeMillis());
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onDestroy() {
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception ignored) {}
        }
        super.onDestroy();
    }
}


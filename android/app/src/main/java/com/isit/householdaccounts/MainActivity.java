package com.isit.householdaccounts;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android 시스템 글꼴 크기 설정이 WebView에 영향을 주지 않도록 고정
        WebSettings webSettings = this.bridge.getWebView().getSettings();
        webSettings.setTextZoom(100);
    }
}

# Add project specific ProGuard rules here.
# Capacitor + WebView 기반이므로 필수 keep 규칙

# Capacitor core
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod *;
}

# Cordova plugins (capacitor-cordova-android-plugins 사용)
-keep class org.apache.cordova.** { *; }

# WebView JavaScript interface 보존
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# AndroidX / Material 리플렉션 사용 클래스
-keep class androidx.appcompat.** { *; }
-keep class androidx.core.** { *; }

# 디버깅용 라인 정보 유지(스택트레이스 가독성)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Local Notifications 플러그인
-keep class com.capacitorjs.plugins.localnotifications.** { *; }

# Annotation / Signature 유지
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod

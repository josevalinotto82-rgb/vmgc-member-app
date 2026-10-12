# Capacitor and AndroidX supply their own consumer keep rules.
# Preserve source locations for retracing release crash reports.
-keepattributes SourceFile,LineNumberTable
# Preserve the WebView JavaScript bridge accessed by JavaScript.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

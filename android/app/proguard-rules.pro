# capacitor-core
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }

# keep classes related to capacitor plugins
-keep class * extends com.getcapacitor.Plugin
-keep class * extends com.getcapacitor.PluginMethod

# Keep specific plugins
-keep class com.capacitorjs.plugins.** { *; }
-keep interface com.capacitorjs.plugins.** { *; }
-keep class io.capawesome.capacitorjs.** { *; }
-keep interface io.capawesome.capacitorjs.** { *; }

# Webview
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# General Android
-dontwarn android.webkit.**

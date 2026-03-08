# React Native
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# SQLite
-keep class org.sqlite.** { *; }
-keep class org.sqlite.database.** { *; }

# Vector Icons
-keep class com.vectoricons.** { *; }

# AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# Floating Bubble Service
-keep class com.dip83287.bubbleoverlayapp.FloatingBubbleService { *; }
-keep class com.dip83287.bubbleoverlayapp.OverlayModule { *; }

# Keep native methods
-keepclasseswithmembers class * {
    native <methods>;
}

# Keep JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

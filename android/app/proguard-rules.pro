# Remove support library annotations
-dontwarn android.support.**
-dontwarn androidx.**

# Keep React Native
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters

-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.** { *; }

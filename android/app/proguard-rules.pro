# React Native
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.** { *; }

# SQLite
-keep class org.sqlite.** { *; }
-keep class org.sqlite.database.** { *; }

# Vector Icons
-keep class com.vectoricons.** { *; }

# AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# React Native File System
-keep class com.rnfs.** { *; }

# React Native Blob Util
-keep class com.ReactNativeBlobUtil.** { *; }

# React Native SQLite Storage
-keep class org.pgsqlite.** { *; }

# React Native Permissions
-keep class com.zoontek.rnpermissions.** { *; }

# Keep native methods
-keepclasseswithmembers class * {
    native <methods>;
}

# Keep JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
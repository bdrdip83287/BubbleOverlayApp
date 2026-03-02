package com.dip83287.bubbleoverlayapp

import android.content.Intent
import android.provider.Settings
import android.net.Uri
import android.os.Build
import com.facebook.react.bridge.*

class OverlayModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "OverlayModule"

    @ReactMethod
    fun startBubble() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(reactContext)) {
                val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + reactContext.packageName))
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactContext.startActivity(intent)
                return
            }
        }
        val serviceIntent = Intent(reactContext, OverlayService::class.java)
        reactContext.startService(serviceIntent)
    }

    @ReactMethod
    fun stopBubble() {
        val serviceIntent = Intent(reactContext, OverlayService::class.java)
        reactContext.stopService(serviceIntent)
    }
}

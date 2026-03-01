package com.dip83287.bubbleoverlayapp

import android.content.Intent
import android.provider.Settings
import android.net.Uri
import android.os.Build
import com.facebook.react.bridge.*
import androidx.core.content.ContextCompat

class OverlayModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "OverlayModule"

    @ReactMethod
    fun startBubble() {

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            !Settings.canDrawOverlays(reactContext)
        ) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${reactContext.packageName}")
            )
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            return
        }

        val intent = Intent(reactContext, OverlayService::class.java)

        ContextCompat.startForegroundService(
            reactContext,
            intent
        )
    }

    @ReactMethod
    fun stopBubble() {
        val intent = Intent(reactContext, OverlayService::class.java)
        reactContext.stopService(intent)
    }
}

package com.dip83287.bubbleoverlayapp

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class OverlayModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "OverlayModule"
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun startBubble(promise: Promise) {
        try {
            val context = reactApplicationContext

            // Check permission first
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (!Settings.canDrawOverlays(context)) {
                    // Open permission settings
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:${context.packageName}")
                    )
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                    promise.reject("PERMISSION_DENIED", "Overlay permission not granted")
                    return
                }
            }

            // Start floating bubble service
            val serviceIntent = Intent(context, FloatingBubbleService::class.java)
            context.startService(serviceIntent)
            promise.resolve("Bubble started successfully")
        } catch (e: Exception) {
            promise.reject("ERROR", e.message ?: "Unknown error")
        }
    }

    @ReactMethod
    fun stopBubble(promise: Promise) {
        try {
            val context = reactApplicationContext
            val serviceIntent = Intent(context, FloatingBubbleService::class.java)
            context.stopService(serviceIntent)
            promise.resolve("Bubble stopped successfully")
        } catch (e: Exception) {
            promise.reject("ERROR", e.message ?: "Unknown error")
        }
    }

    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        try {
            val hasPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(reactApplicationContext)
            } else {
                true
            }
            promise.resolve(hasPermission)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message ?: "Unknown error")
        }
    }
}

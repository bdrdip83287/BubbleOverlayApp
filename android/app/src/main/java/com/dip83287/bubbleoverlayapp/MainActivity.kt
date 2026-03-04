package com.dip83287.bubbleoverlayapp

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import android.os.Bundle
import android.os.Build
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.widget.Toast
import android.app.AlertDialog

class MainActivity : ReactActivity() {

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "BubbleOverlayApp"

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
     * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // ✅ Floating bubble permission check for Android 6.0+
        checkOverlayPermission()
    }

    private fun checkOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                // Show explanation dialog before requesting permission
                AlertDialog.Builder(this)
                    .setTitle("Overlay Permission Required")
                    .setMessage("This app needs overlay permission to show floating bubble notes on top of other apps.")
                    .setPositiveButton("Grant Permission") { _, _ ->
                        // Open system settings for overlay permission
                        val intent = Intent(
                            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:$packageName")
                        )
                        startActivityForResult(intent, 1234)
                    }
                    .setNegativeButton("Cancel") { _, _ ->
                        Toast.makeText(this, "App may not function properly without overlay permission", Toast.LENGTH_LONG).show()
                    }
                    .show()
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        
        if (requestCode == 1234) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (Settings.canDrawOverlays(this)) {
                    Toast.makeText(this, "✓ Overlay permission granted", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, "✗ Overlay permission denied. Bubble feature may not work.", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}
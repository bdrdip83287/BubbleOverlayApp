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

    companion object {
        const val OVERLAY_PERMISSION_REQUEST_CODE = 1234
    }

    override fun getMainComponentName(): String = "BubbleOverlayApp"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Check if opened from bubble
        val fromBubble = intent.getBooleanExtra("openFromBubble", false)
        if (fromBubble) {
            // React Native UI automatically loads, no extra action needed
            Toast.makeText(this, "Opening Floating Notes...", Toast.LENGTH_SHORT).show()
        }
        
        // Request overlay permission on start
        requestOverlayPermission()
    }

    private fun requestOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                AlertDialog.Builder(this)
                    .setTitle("Floating Bubble Permission Required")
                    .setMessage("This app needs 'Display over other apps' permission to show floating notes.")
                    .setPositiveButton("Grant Permission") { _, _ ->
                        openOverlaySettings()
                    }
                    .setNegativeButton("Cancel") { _, _ ->
                        Toast.makeText(this, "Bubble feature disabled", Toast.LENGTH_SHORT).show()
                    }
                    .show()
            } else {
                // Permission already granted, no need to show toast every time
                // Toast.makeText(this, "✓ Permission already granted", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun openOverlaySettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            )
            startActivityForResult(intent, OVERLAY_PERMISSION_REQUEST_CODE)
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == OVERLAY_PERMISSION_REQUEST_CODE) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (Settings.canDrawOverlays(this)) {
                    Toast.makeText(this, "✓ Permission granted! Restart app", Toast.LENGTH_LONG).show()
                } else {
                    Toast.makeText(this, "✗ Permission denied", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}

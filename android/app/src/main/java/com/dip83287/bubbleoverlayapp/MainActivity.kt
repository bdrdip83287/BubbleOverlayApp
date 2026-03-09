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
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : ReactActivity() {

    companion object {
        const val OVERLAY_PERMISSION_REQUEST_CODE = 1234
        const val SYSTEM_ALERT_WINDOW_PERMISSION = "android.permission.SYSTEM_ALERT_WINDOW"
    }

    override fun getMainComponentName(): String = "BubbleOverlayApp"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // ✅ Permission check for Android 6.0+
        checkAndRequestOverlayPermission()
    }

    private fun checkAndRequestOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                showOverlayPermissionDialog()
            } else {
                Toast.makeText(this, "✓ Overlay permission already granted", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun showOverlayPermissionDialog() {
        AlertDialog.Builder(this)
            .setTitle("Overlay Permission Required")
            .setMessage("This app needs overlay permission to show floating bubble notes on top of other apps.")
            .setPositiveButton("Grant Permission") { _, _ ->
                openOverlayPermissionSettings()
            }
            .setNegativeButton("Cancel") { _, _ ->
                Toast.makeText(this, "App may not function properly without overlay permission", Toast.LENGTH_LONG).show()
            }
            .show()
    }

    private fun openOverlayPermissionSettings() {
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
                    Toast.makeText(this, "✓ Overlay permission granted! Restart app to use bubble.", Toast.LENGTH_LONG).show()
                    // Optionally restart app or notify React Native
                } else {
                    Toast.makeText(this, "✗ Overlay permission denied. Bubble feature will not work.", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}
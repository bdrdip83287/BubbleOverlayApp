package com.bubbleoverlayapp

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String {
    return "main"
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    if (!Settings.canDrawOverlays(this)) {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:$packageName")
      )
      startActivity(intent)
    }
  }
}
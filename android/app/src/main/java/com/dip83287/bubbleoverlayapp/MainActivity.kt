package com.dip83287.bubbleoverlayapp

import android.os.Bundle
import android.widget.Toast
import com.facebook.react.ReactActivity
import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String {
        return "main"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        try {
            super.onCreate(null)
        } catch (e: Exception) {
            Toast.makeText(
                this,
                "MAIN ACTIVITY CRASH:\n${e.message}",
                Toast.LENGTH_LONG
            ).show()
            e.printStackTrace()
        }
    }
}

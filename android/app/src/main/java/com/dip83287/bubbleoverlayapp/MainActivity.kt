package com.dip83287.bubbleoverlayapp

import android.os.Bundle
import android.widget.Toast
import com.facebook.react.ReactActivity
import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String {
        return "App" // index.js এর main component নাম
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        try {
            super.onCreate(null) // null দিয়ে ঠিক আছে
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "MAIN ACTIVITY CRASH: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }
}
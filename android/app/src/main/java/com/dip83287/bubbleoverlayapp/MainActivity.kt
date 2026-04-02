package com.dip83287.bubbleoverlayapp

import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "BubbleOverlayApp"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Make React Native UI floating on top of other apps
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.apply {
                // Transparent background
                setBackgroundDrawableResource(android.R.color.transparent)
                
                // Floating window parameters
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    setType(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY)
                } else {
                    setType(WindowManager.LayoutParams.TYPE_PHONE)
                }
                
                // Window flags for floating behavior
                addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL)
                addFlags(WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH)
                addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
                addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS)
                
                // Set window size and position
                val params = attributes
                params.gravity = Gravity.CENTER or Gravity.TOP
                params.x = 100
                params.y = 200
                params.width = 600
                params.height = WindowManager.LayoutParams.WRAP_CONTENT
                attributes = params
            }
        }
    }
}

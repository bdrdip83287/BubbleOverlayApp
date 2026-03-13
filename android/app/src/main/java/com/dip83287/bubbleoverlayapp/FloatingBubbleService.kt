// FloatingBubbleService is disabled - using React Native bubble instead
package com.dip83287.bubbleoverlayapp

import android.app.Service
import android.content.Intent
import android.os.IBinder

class FloatingBubbleService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null
}

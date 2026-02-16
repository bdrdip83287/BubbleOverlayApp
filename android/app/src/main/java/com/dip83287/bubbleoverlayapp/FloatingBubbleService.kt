package com.dip83287.bubbleoverlayapp

import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.IBinder
import android.view.Gravity
import android.view.WindowManager
import android.widget.ImageView

class FloatingBubbleService : Service() {

    companion object {
        private var bubbleView: ImageView? = null
    }

    private lateinit var windowManager: WindowManager

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {

        if (bubbleView != null) return START_STICKY

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        val bubble = ImageView(this)
        bubble.setImageResource(android.R.drawable.sym_def_app_icon)

        val params = WindowManager.LayoutParams(
            200,
            200,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        )

        params.gravity = Gravity.TOP or Gravity.START
        params.x = 0
        params.y = 300

        bubbleView = bubble
        windowManager.addView(bubbleView, params)

        bubble.setOnClickListener {
            val intentMain = Intent(this, MainActivity::class.java)
            intentMain.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intentMain)
        }

        bubble.setOnLongClickListener {
            stopSelf()
            true
        }

        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        bubbleView?.let {
            windowManager.removeView(it)
            bubbleView = null
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}

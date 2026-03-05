package com.dip83287.bubbleoverlayapp

import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.Toast

class FloatingBubbleService : Service() {

    companion object {
        private var bubbleView: View? = null
        private var isServiceRunning = false
    }

    private lateinit var windowManager: WindowManager
    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        isServiceRunning = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (bubbleView != null) return START_STICKY

        try {
            // Create bubble view
            val inflater = getSystemService(LAYOUT_INFLATER_SERVICE) as LayoutInflater
            bubbleView = inflater.inflate(R.layout.floating_bubble, null)

            val params = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams(
                    200,
                    200,
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                    PixelFormat.TRANSLUCENT
                )
            } else {
                WindowManager.LayoutParams(
                    200,
                    200,
                    WindowManager.LayoutParams.TYPE_PHONE,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                    PixelFormat.TRANSLUCENT
                )
            }

            params.gravity = Gravity.TOP or Gravity.START
            params.x = 0
            params.y = 300

            // Set touch listener for dragging
            bubbleView?.setOnTouchListener { view, event ->
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = params.x
                        initialY = params.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        params.x = initialX + (event.rawX - initialTouchX).toInt()
                        params.y = initialY + (event.rawY - initialTouchY).toInt()
                        windowManager.updateViewLayout(view, params)
                        true
                    }
                    MotionEvent.ACTION_UP -> {
                        // Handle click if not dragged
                        if (Math.abs(event.rawX - initialTouchX) < 10 && 
                            Math.abs(event.rawY - initialTouchY) < 10) {
                            // Open main app
                            val intent = Intent(this, MainActivity::class.java)
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            startActivity(intent)
                        }
                        true
                    }
                    else -> false
                }
            }

            bubbleView?.setOnLongClickListener {
                Toast.makeText(this, "Long press to close", Toast.LENGTH_SHORT).show()
                stopSelf()
                true
            }

            windowManager.addView(bubbleView, params)

        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "Failed to create bubble: ${e.message}", Toast.LENGTH_LONG).show()
        }

        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            bubbleView?.let {
                windowManager.removeView(it)
                bubbleView = null
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        isServiceRunning = false
    }

    override fun onBind(intent: Intent?): IBinder? = null

    fun isRunning(): Boolean = isServiceRunning
}
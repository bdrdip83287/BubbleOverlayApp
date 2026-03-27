package com.dip83287.bubbleoverlayapp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.Toast
import androidx.core.app.NotificationCompat

class FloatingBubbleService : Service() {

    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "FloatingBubbleChannel"
        private var bubbleView: View? = null
    }

    private lateinit var windowManager: WindowManager
    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Floating Notes",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows floating bubble for quick notes"
                setShowBadge(false)
            }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Floating Notes")
            .setContentText("Tap to open, long press to close")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                stopSelf()
                return START_NOT_STICKY
            }
        }

        if (bubbleView == null) {
            createBubbleView()
        }

        return START_STICKY
    }

    private fun createBubbleView() {
        // Simple bubble view
        bubbleView = ImageView(this).apply {
            setImageResource(android.R.drawable.ic_menu_edit)
            setBackgroundColor(0xFFF9E79F.toInt()) // React Native bubble color
            scaleType = ImageView.ScaleType.CENTER_INSIDE
            setPadding(20, 20, 20, 20)
        }

        val layoutParams = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams(
                100,
                150,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT
            )
        } else {
            WindowManager.LayoutParams(
                150,
                150,
                WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT
            )
        }

        layoutParams.gravity = Gravity.TOP or Gravity.START
        layoutParams.x = 100
        layoutParams.y = 300

        bubbleView?.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = layoutParams.x
                    initialY = layoutParams.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    layoutParams.x = initialX + (event.rawX - initialTouchX).toInt()
                    layoutParams.y = initialY + (event.rawY - initialTouchY).toInt()
                    windowManager.updateViewLayout(bubbleView!!, layoutParams)
                    true
                }
                MotionEvent.ACTION_UP -> {
                    val dx = event.rawX - initialTouchX
                    val dy = event.rawY - initialTouchY
                    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
                        // Click - open main app
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
            Toast.makeText(this, "Floating notes closed", Toast.LENGTH_SHORT).show()
            stopSelf()
            true
        }

        windowManager.addView(bubbleView, layoutParams)
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
    }

    override fun onBind(intent: Intent?): IBinder? = null
}

package com.dip83287.bubbleoverlayapp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.Toast
import androidx.core.app.NotificationCompat

class FloatingBubbleService : Service() {

    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "FloatingBubbleChannel"
        private var bubbleView: View? = null
        private var closeButton: View? = null
        private var isCloseButtonVisible = false
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
                description = "Tap to open notes"
                setShowBadge(false)
            }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Floating Notes")
            .setContentText("Tap to open")
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
            createBubbleViewWithCloseButton()
        }

        return START_STICKY
    }

    private fun createBubbleViewWithCloseButton() {
        // Main container - React Native bubble-এর মতো
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(12, 12, 12, 12)
            
            val shape = GradientDrawable()
            shape.shape = GradientDrawable.OVAL
            shape.setColor(0xFFF9E79F.toInt()) // React Native bubble color
            shape.setStroke(2, 0xFFF1C40F.toInt())
            background = shape
        }

        // Icon (documents-outline)
        val icon = ImageView(this).apply {
            setImageResource(android.R.drawable.ic_menu_edit)
            setColorFilter(0xFF333333.toInt())
            layoutParams = LinearLayout.LayoutParams(50, 50)
        }
        container.addView(icon)

        // Close button (X) - React Native-এর close icon-এর মতো
        val closeIcon = ImageView(this).apply {
            setImageResource(android.R.drawable.ic_menu_close_clear_cancel)
            setColorFilter(0xFFC0392B.toInt())
            layoutParams = LinearLayout.LayoutParams(25, 25).apply {
                topMargin = -10
                gravity = Gravity.CENTER_HORIZONTAL
            }
            visibility = View.GONE // initially hidden
        }
        container.addView(closeIcon)

        bubbleView = container
        closeButton = closeIcon

        val layoutParams = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams(
                120,
                120,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT
            )
        } else {
            WindowManager.LayoutParams(
                120,
                120,
                WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT
            )
        }

        layoutParams.gravity = Gravity.TOP or Gravity.START
        layoutParams.x = 100
        layoutParams.y = 300

        var isDragging = false
        var startX = 0
        var startY = 0
        var longPressTriggered = false

        // Touch handler for bubble
        bubbleView?.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    startX = layoutParams.x
                    startY = layoutParams.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    isDragging = false
                    longPressTriggered = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - initialTouchX
                    val dy = event.rawY - initialTouchY
                    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                        isDragging = true
                        // Hide close button when dragging
                        if (isCloseButtonVisible) {
                            closeButton?.visibility = View.GONE
                            isCloseButtonVisible = false
                        }
                    }
                    layoutParams.x = startX + dx.toInt()
                    layoutParams.y = startY + dy.toInt()
                    windowManager.updateViewLayout(bubbleView!!, layoutParams)
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!isDragging && !longPressTriggered) {
                        // Click - open React Native UI
                        val intent = Intent(this, MainActivity::class.java)
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        startActivity(intent)
                    }
                    true
                }
                else -> false
            }
        }

        // Long press to show close button (React Native-এর মতো)
        bubbleView?.setOnLongClickListener {
            longPressTriggered = true
            if (isCloseButtonVisible) {
                // If close button already visible, close bubble
                Toast.makeText(this, "Closing floating notes", Toast.LENGTH_SHORT).show()
                stopSelf()
            } else {
                // Show close button
                closeButton?.visibility = View.VISIBLE
                isCloseButtonVisible = true
                // Auto hide after 3 seconds
                bubbleView?.postDelayed({
                    if (isCloseButtonVisible) {
                        closeButton?.visibility = View.GONE
                        isCloseButtonVisible = false
                    }
                }, 3000)
            }
            true
        }

        // Close button click handler
        closeButton?.setOnClickListener {
            Toast.makeText(this, "Closing floating notes", Toast.LENGTH_SHORT).show()
            stopSelf()
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

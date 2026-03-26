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
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class FloatingBubbleService : Service() {

    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "FloatingBubbleChannel"
        private var bubbleView: View? = null
        private var isRunning = false
    }

    private lateinit var windowManager: WindowManager
    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var noteCount = 0

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        isRunning = true
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
            .setContentText("$noteCount notes available")
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

        // Get note count from intent
        noteCount = intent?.getIntExtra("noteCount", 0) ?: 0

        if (bubbleView == null) {
            createBubbleView()
        } else {
            updateBubbleUI()
        }

        return START_STICKY
    }

    private fun updateBubbleUI() {
        bubbleView?.let { view ->
            // Update note count if needed
            val countText = view.findViewById<TextView>(R.id.note_count)
            countText?.text = noteCount.toString()
            countText?.visibility = if (noteCount > 0) View.VISIBLE else View.GONE

            // Update notification
            updateNotification()
        }
    }

    private fun updateNotification() {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Floating Notes")
            .setContentText("$noteCount notes available")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
        startForeground(NOTIFICATION_ID, notification)
    }

    private fun createBubbleView() {
        // Create a view that looks exactly like your React Native bubble
        val inflater = getSystemService(LAYOUT_INFLATER_SERVICE) as LayoutInflater
        
        // Try to load layout if exists, otherwise create programmatically
        bubbleView = try {
            inflater.inflate(R.layout.floating_bubble, null)
        } catch (e: Exception) {
            // Fallback - create programmatically
            createBubbleViewProgrammatically()
            return
        }

        // Set background color matching React Native bubble (#f9e79f)
        bubbleView?.setBackgroundColor(0xFFF9E79F.toInt())
        
        // Set rounded corners
        bubbleView?.background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(0xFFF9E79F.toInt())
            setStroke(2, 0xFFF1C40F.toInt())
        }
        
        // Set size
        val params = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams(
                150,
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

        params.gravity = Gravity.TOP or Gravity.START
        params.x = 100
        params.y = 300

        // Setup icon
        val iconView = bubbleView?.findViewById<ImageView>(R.id.bubble_icon)
        iconView?.setImageResource(android.R.drawable.ic_menu_edit)
        iconView?.setColorFilter(0xFF333333.toInt())

        // Setup note count
        val countView = bubbleView?.findViewById<TextView>(R.id.note_count)
        countView?.text = noteCount.toString()
        countView?.visibility = if (noteCount > 0) View.VISIBLE else View.GONE
        countView?.setTextColor(0xFF333333.toInt())
        countView?.setBackgroundColor(0xFFFFFFFF.toInt())

        // Set touch listener for dragging
        bubbleView?.setOnTouchListener { _, event ->
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
                    windowManager.updateViewLayout(bubbleView!!, params)
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

        // Long press to close
        bubbleView?.setOnLongClickListener {
            Toast.makeText(this, "Floating notes closed", Toast.LENGTH_SHORT).show()
            stopSelf()
            true
        }

        windowManager.addView(bubbleView, params)
    }

    private fun createBubbleViewProgrammatically(): View {
        // Create a LinearLayout programmatically
        val layout = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(20, 20, 20, 20)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(0xFFF9E79F.toInt())
                setStroke(2, 0xFFF1C40F.toInt())
            }
        }

        // Add icon
        val icon = ImageView(this).apply {
            setImageResource(android.R.drawable.ic_menu_edit)
            setColorFilter(0xFF333333.toInt())
            layoutParams = android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
        layout.addView(icon)

        // Add note count
        val countText = TextView(this).apply {
            text = noteCount.toString()
            setTextColor(0xFF333333.toInt())
            setBackgroundColor(0xFFFFFFFF.toInt())
            setPadding(4, 2, 4, 2)
            visibility = if (noteCount > 0) View.VISIBLE else View.GONE
            layoutParams = android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = -10
            }
        }
        layout.addView(countText)

        bubbleView = layout
        return layout
    }

    fun updateNoteCount(count: Int) {
        noteCount = count
        updateBubbleUI()
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            bubbleView?.let {
                windowManager.removeView(it)
                bubbleView = null
            }
            isRunning = false
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    fun isRunning(): Boolean = isRunning
}

package com.tiwlo.support

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

class SupportMonitorService : Service() {
  private var scheduler: ScheduledExecutorService? = null

  companion object {
    const val PREFS_NAME = "tiwlo_support_monitor"
    const val CHANNEL_SERVICE = "tiwlo_support_service"
    const val CHANNEL_ALERTS = "tiwlo_support_alerts"
    const val CHANNEL_RING = "tiwlo_support_ring"
    const val SERVICE_NOTIF_ID = 41001
    const val ACTION_STOP_RING = "com.tiwlo.support.ACTION_STOP_RING"
    const val DEFAULT_RING_MS = 10_000L

    private val ringLock = Any()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var activePlayer: MediaPlayer? = null
    private var activeVibrator: Vibrator? = null
    private var stopRingRunnable: Runnable? = null

    fun ensureChannels(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val mgr = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

      if (mgr.getNotificationChannel(CHANNEL_SERVICE) == null) {
        val svcChannel = NotificationChannel(
          CHANNEL_SERVICE,
          "Support Desk Connection",
          NotificationManager.IMPORTANCE_LOW
        ).apply {
          description = "Keeps live support queue monitoring active in the background."
          setShowBadge(false)
        }
        mgr.createNotificationChannel(svcChannel)
      }

      if (mgr.getNotificationChannel(CHANNEL_ALERTS) == null) {
        val alertChannel = NotificationChannel(
          CHANNEL_ALERTS,
          "Live Chats & Ticket Updates",
          NotificationManager.IMPORTANCE_HIGH
        ).apply {
          description = "Notifications when customers reply to active tickets or chats."
          enableLights(true)
          lightColor = Color.RED
          enableVibration(true)
          vibrationPattern = longArrayOf(0L, 250L, 180L, 250L)
          setSound(
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
            Notification.AUDIO_ATTRIBUTES_DEFAULT
          )
        }
        mgr.createNotificationChannel(alertChannel)
      }

      if (mgr.getNotificationChannel(CHANNEL_RING) == null) {
        val ringChannel = NotificationChannel(
          CHANNEL_RING,
          "Incoming Unaccepted Support Call Alerts",
          NotificationManager.IMPORTANCE_HIGH
        ).apply {
          description = "Mandatory call-style alerts for unaccepted tickets and waiting chats every 5 minutes until accepted."
          enableLights(true)
          lightColor = Color.RED
          lockscreenVisibility = Notification.VISIBILITY_PUBLIC
          // Sound and vibration are handled cleanly by the 10-second MediaPlayer ringtone controller
          setSound(null, null)
          enableVibration(false)
        }
        mgr.createNotificationChannel(ringChannel)
      }
    }

    fun stopGlobalRingtone() {
      synchronized(ringLock) {
        stopRingRunnable?.let { mainHandler.removeCallbacks(it) }
        stopRingRunnable = null
        try {
          activePlayer?.let { p ->
            if (p.isPlaying) p.stop()
            p.release()
          }
        } catch (_: Throwable) {
          // Safe cleanup
        } finally {
          activePlayer = null
        }
        try {
          activeVibrator?.cancel()
        } catch (_: Throwable) {
          // Safe cleanup
        } finally {
          activeVibrator = null
        }
      }
    }

    fun ringGlobalForDuration(context: Context, durationMs: Long = DEFAULT_RING_MS) {
      val safeMs = durationMs.coerceIn(2_000L, 15_000L)
      synchronized(ringLock) {
        stopGlobalRingtone()

        try {
          val ringUri =
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
              ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
          if (ringUri != null) {
            val attrs = AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build()
            val player = MediaPlayer().apply {
              setAudioAttributes(attrs)
              setDataSource(context.applicationContext, ringUri)
              isLooping = true
              prepare()
              start()
            }
            activePlayer = player
          }
        } catch (_: Throwable) {
          activePlayer = null
        }

        try {
          val vib: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vm?.defaultVibrator
          } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
          }
          if (vib != null && vib.hasVibrator()) {
            val pattern = longArrayOf(0L, 650L, 450L, 650L, 450L)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
              vib.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
              @Suppress("DEPRECATION")
              vib.vibrate(pattern, 0)
            }
            activeVibrator = vib
          }
        } catch (_: Throwable) {
          activeVibrator = null
        }

        val stopper = Runnable { stopGlobalRingtone() }
        stopRingRunnable = stopper
        mainHandler.postDelayed(stopper, safeMs)
      }
    }

    fun pollPulseAndNotify(context: Context): Boolean {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val enabled = prefs.getBoolean("enabled", false)
      val apiBase = prefs.getString("apiBase", "") ?: ""
      val token = prefs.getString("sessionToken", "") ?: ""
      if (!enabled || apiBase.isBlank() || token.isBlank()) {
        return false
      }

      ensureChannels(context)

      val url = URL("${apiBase.trimEnd('/')}/pulse-alerts")
      val conn = (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "GET"
        connectTimeout = 8000
        readTimeout = 8000
        setRequestProperty("Accept", "application/json")
        setRequestProperty("Authorization", "Bearer $token")
        setRequestProperty("x-desk-strict", "1")
      }

      try {
        val code = conn.responseCode
        if (code == 401 || code == 403) {
          prefs.edit().putBoolean("enabled", false).remove("sessionToken").apply()
          stopGlobalRingtone()
          return false
        }
        if (code !in 200..299) return true

        val body = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
        val json = JSONObject(body)
        if (!json.optBoolean("success", false)) return true

        val waitingCount = json.optInt("waitingChatsCount", 0)
        val ticketCount = json.optInt("unacceptedTicketsCount", 0)
        var shouldRing = false

        val latestChat = json.optJSONObject("latestWaitingChat")
        if (waitingCount > 0 && latestChat != null) {
          val chatId = latestChat.optString("id", "")
          val alertKey = latestChat.optString("alertKey", "").ifBlank { chatId }
          val prevChatKey = prefs.getString("lastChatAlertKey", "") ?: ""
          if (chatId.isNotBlank() && alertKey != prevChatKey) {
            prefs.edit().putString("lastChatAlertKey", alertKey).putString("lastChatId", chatId).apply()
            val num = latestChat.optString("chatNumber", "Live Chat")
            val guest = latestChat.optString("guestName", "Visitor")
            val topic = latestChat.optString("topic", "Needs live support")
            val cycle = latestChat.optInt("reminderCycle", 0)
            val prefix = if (cycle > 0) "Reminder (${cycle * 5}m): " else "Incoming "
            emitCallStyleNotification(
              context = context,
              notifId = ("chat:$chatId").hashCode(),
              title = "${prefix}Live Chat $num",
              body = "$guest: $topic — Tap to Accept",
              deepLink = "tiwlosupport://open?type=livechat&id=$chatId",
              useRingChannel = true
            )
            shouldRing = true
          }
        } else if (waitingCount == 0) {
          prefs.edit().putString("lastChatAlertKey", "").putString("lastChatId", "").apply()
        }

        val latestTicket = json.optJSONObject("latestUnacceptedTicket")
        if (ticketCount > 0 && latestTicket != null) {
          val tId = latestTicket.optString("id", "")
          val alertKey = latestTicket.optString("alertKey", "").ifBlank { tId }
          val prevTKey = prefs.getString("lastTicketAlertKey", "") ?: ""
          if (tId.isNotBlank() && alertKey != prevTKey) {
            prefs.edit().putString("lastTicketAlertKey", alertKey).putString("lastTicketId", tId).apply()
            val serial = latestTicket.optString("serialNumber", "#Ticket")
            val subject = latestTicket.optString("subject", "New support request")
            val customer = latestTicket.optString("customerName", "Customer")
            val cycle = latestTicket.optInt("reminderCycle", 0)
            val prefix = if (cycle > 0) "Reminder (${cycle * 5}m): " else "New "
            emitCallStyleNotification(
              context = context,
              notifId = ("tkt:$tId").hashCode(),
              title = "${prefix}Ticket $serial",
              body = "$customer — $subject (Tap to Accept)",
              deepLink = "tiwlosupport://open?type=ticket&id=$tId",
              useRingChannel = true
            )
            shouldRing = true
          }
        } else if (ticketCount == 0) {
          prefs.edit().putString("lastTicketAlertKey", "").putString("lastTicketId", "").apply()
        }

        val unreadTicket = json.optJSONObject("latestUnreadTicket")
        if (unreadTicket != null) {
          val tId = unreadTicket.optString("id", "")
          val uKey = unreadTicket.optString("alertKey", "").ifBlank {
            "${tId}:${unreadTicket.optString("updatedAt", "")}"
          }
          val prevUKey = prefs.getString("lastUnreadKey", "") ?: ""
          if (tId.isNotBlank() && uKey != ":" && uKey != prevUKey) {
            prefs.edit().putString("lastUnreadKey", uKey).apply()
            val serial = unreadTicket.optString("serialNumber", "Ticket")
            val customer = unreadTicket.optString("customerName", "Customer")
            emitCallStyleNotification(
              context = context,
              notifId = ("unread:$tId").hashCode(),
              title = "New Reply on $serial",
              body = "$customer sent a message",
              deepLink = "tiwlosupport://open?type=ticket&id=$tId",
              useRingChannel = false
            )
          }
        }

        if (waitingCount == 0 && ticketCount == 0) {
          stopGlobalRingtone()
        } else if (shouldRing) {
          ringGlobalForDuration(context, DEFAULT_RING_MS)
        }
        return true
      } finally {
        conn.disconnect()
      }
    }

    private fun emitCallStyleNotification(
      context: Context,
      notifId: Int,
      title: String,
      body: String,
      deepLink: String,
      useRingChannel: Boolean
    ) {
      val openIntent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink), context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
      }
      val openPending = PendingIntent.getActivity(
        context,
        notifId,
        openIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

      val stopIntent = Intent(context, SupportMonitorService::class.java).apply {
        action = ACTION_STOP_RING
      }
      val stopPending = PendingIntent.getService(
        context,
        notifId + 1001,
        stopIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

      val channelId = if (useRingChannel) CHANNEL_RING else CHANNEL_ALERTS
      val mgr = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val builder = NotificationCompat.Builder(context, channelId)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setAutoCancel(true)
        .setColor(Color.RED)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setContentIntent(openPending)
        .setDeleteIntent(stopPending)

      if (useRingChannel) {
        builder
          .setPriority(NotificationCompat.PRIORITY_MAX)
          .setCategory(NotificationCompat.CATEGORY_CALL)
          .setFullScreenIntent(openPending, true)
          .addAction(R.mipmap.ic_launcher, "Open & Accept", openPending)
          .addAction(R.mipmap.ic_launcher, "Silence", stopPending)
      } else {
        builder
          .setPriority(NotificationCompat.PRIORITY_HIGH)
          .setDefaults(NotificationCompat.DEFAULT_ALL)
      }

      mgr.notify(notifId, builder.build())
    }
  }

  override fun onCreate() {
    super.onCreate()
    ensureChannels(this)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP_RING) {
      stopGlobalRingtone()
      return START_STICKY
    }

    ensureChannels(this)
    val ongoing = buildServiceNotification()
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(SERVICE_NOTIF_ID, ongoing, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
      } else {
        startForeground(SERVICE_NOTIF_ID, ongoing)
      }
    } catch (_: Throwable) {
      SupportWatchdogJobService.schedulePeriodic(this)
      stopSelf()
      return START_NOT_STICKY
    }

    SupportWatchdogJobService.schedulePeriodic(this)
    startPollingLoop()
    return START_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    SupportWatchdogJobService.scheduleImmediateRestart(this)
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    scheduler?.shutdownNow()
    scheduler = null
    stopGlobalRingtone()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun buildServiceNotification(): Notification {
    val openIntent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pending = PendingIntent.getActivity(
      this,
      0,
      openIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    return NotificationCompat.Builder(this, CHANNEL_SERVICE)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle("Tiwlo Support Active")
      .setContentText("Monitoring live chats & tickets with call alerts")
      .setOngoing(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setContentIntent(pending)
      .build()
  }

  private fun startPollingLoop() {
    if (scheduler != null && !scheduler!!.isShutdown) return
    scheduler = Executors.newSingleThreadScheduledExecutor()
    scheduler?.scheduleWithFixedDelay({
      try {
        val keepRunning = pollPulseAndNotify(this)
        if (!keepRunning) {
          stopSelf()
        }
      } catch (_: Throwable) {
        // Resilient background loop
      }
    }, 3, 12, TimeUnit.SECONDS)
  }
}

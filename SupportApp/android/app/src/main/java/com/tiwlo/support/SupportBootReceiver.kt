package com.tiwlo.support

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class SupportBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val action = intent?.action ?: return
    val supported =
      action == Intent.ACTION_BOOT_COMPLETED ||
      action == Intent.ACTION_LOCKED_BOOT_COMPLETED ||
      action == Intent.ACTION_MY_PACKAGE_REPLACED ||
      action == "android.intent.action.QUICKBOOT_POWERON" ||
      action == "com.htc.intent.action.QUICKBOOT_POWERON"
    if (!supported) return

    val prefs = context.getSharedPreferences(SupportMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
    val enabled = prefs.getBoolean("enabled", false)
    val apiBase = prefs.getString("apiBase", "") ?: ""
    val token = prefs.getString("sessionToken", "") ?: ""
    if (!enabled || apiBase.isBlank() || token.isBlank()) return

    // Always arm JobScheduler watchdog (survives reboot & OEM restrictions)
    SupportWatchdogJobService.schedulePeriodic(context)
    SupportWatchdogJobService.scheduleImmediateRestart(context)

    // Attempt direct foreground service restart (succeeds cleanly when battery optimization is ignored / API allowed)
    try {
      val svcIntent = Intent(context, SupportMonitorService::class.java)
      ContextCompat.startForegroundService(context, svcIntent)
    } catch (_: Throwable) {
      // Android 12+ may defer boot foreground starts unless battery-exempt; watchdog job will handle polling.
    }
  }
}

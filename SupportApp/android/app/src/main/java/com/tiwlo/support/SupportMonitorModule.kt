package com.tiwlo.support

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SupportMonitorModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "SupportMonitorModule"

  @ReactMethod
  fun startMonitor(apiBase: String, sessionToken: String, staffId: String, promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences(SupportMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit()
        .putBoolean("enabled", true)
        .putString("apiBase", apiBase)
        .putString("sessionToken", sessionToken)
        .putString("staffId", staffId)
        .apply()

      SupportWatchdogJobService.schedulePeriodic(reactContext)
      val intent = Intent(reactContext, SupportMonitorService::class.java)
      ContextCompat.startForegroundService(reactContext, intent)
      promise.resolve(true)
    } catch (t: Throwable) {
      promise.reject("MONITOR_START_ERR", t.message, t)
    }
  }

  @ReactMethod
  fun stopMonitor(promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences(SupportMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
      prefs.edit()
        .putBoolean("enabled", false)
        .remove("sessionToken")
        .putString("lastChatAlertKey", "")
        .putString("lastTicketAlertKey", "")
        .apply()
      SupportWatchdogJobService.cancelAll(reactContext)
      SupportMonitorService.stopGlobalRingtone()
      val intent = Intent(reactContext, SupportMonitorService::class.java)
      reactContext.stopService(intent)
      promise.resolve(true)
    } catch (t: Throwable) {
      promise.reject("MONITOR_STOP_ERR", t.message, t)
    }
  }

  @ReactMethod
  fun isMonitorRunning(promise: Promise) {
    val prefs = reactContext.getSharedPreferences(SupportMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
    promise.resolve(prefs.getBoolean("enabled", false))
  }

  @ReactMethod
  fun stopRingtone(promise: Promise) {
    try {
      SupportMonitorService.stopGlobalRingtone()
      promise.resolve(true)
    } catch (t: Throwable) {
      promise.reject("STOP_RING_ERR", t.message, t)
    }
  }

  @ReactMethod
  fun triggerLocalRingtone(durationMs: Double, promise: Promise) {
    try {
      val ms = if (durationMs.isFinite() && durationMs > 0) durationMs.toLong() else SupportMonitorService.DEFAULT_RING_MS
      SupportMonitorService.ringGlobalForDuration(reactContext, ms)
      promise.resolve(true)
    } catch (t: Throwable) {
      promise.reject("START_RING_ERR", t.message, t)
    }
  }

  @ReactMethod
  fun markAlertHandled(kind: String, alertKey: String, promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences(SupportMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
      val editor = prefs.edit()
      if (kind == "livechat") {
        editor.putString("lastChatAlertKey", alertKey)
      } else if (kind == "ticket") {
        editor.putString("lastTicketAlertKey", alertKey)
      }
      editor.apply()
      promise.resolve(true)
    } catch (_: Throwable) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun isIgnoringBatteryOptimizations(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
        promise.resolve(true)
        return
      }
      val pm = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
      val ignoring = pm?.isIgnoringBatteryOptimizations(reactContext.packageName) ?: true
      promise.resolve(ignoring)
    } catch (_: Throwable) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun requestIgnoreBatteryOptimizations(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
        promise.resolve(true)
        return
      }
      val pm = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
      if (pm != null && pm.isIgnoringBatteryOptimizations(reactContext.packageName)) {
        promise.resolve(true)
        return
      }
      try {
        val intent = Intent(
          Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
          Uri.parse("package:${reactContext.packageName}")
        ).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(intent)
        promise.resolve(true)
      } catch (_: Throwable) {
        val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(fallback)
        promise.resolve(true)
      }
    } catch (t: Throwable) {
      promise.reject("BATTERY_OPT_ERR", t.message, t)
    }
  }
}

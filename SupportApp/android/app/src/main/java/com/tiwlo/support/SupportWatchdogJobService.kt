package com.tiwlo.support

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat
import java.util.concurrent.Executors

class SupportWatchdogJobService : JobService() {
  private val executor = Executors.newSingleThreadExecutor()

  companion object {
    private const val PERIODIC_JOB_ID = 41010
    private const val IMMEDIATE_JOB_ID = 41011

    fun schedulePeriodic(context: Context) {
      try {
        val scheduler = context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as? JobScheduler ?: return
        if (scheduler.getPendingJob(PERIODIC_JOB_ID) != null) return

        val component = ComponentName(context, SupportWatchdogJobService::class.java)
        val builder = JobInfo.Builder(PERIODIC_JOB_ID, component)
          .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
          .setPersisted(true)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
          builder.setPeriodic(15 * 60 * 1000L, 5 * 60 * 1000L)
        } else {
          builder.setPeriodic(15 * 60 * 1000L)
        }

        scheduler.schedule(builder.build())
      } catch (_: Throwable) {
        // Best-effort scheduling
      }
    }

    fun scheduleImmediateRestart(context: Context) {
      try {
        val scheduler = context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as? JobScheduler ?: return
        val component = ComponentName(context, SupportWatchdogJobService::class.java)
        val info = JobInfo.Builder(IMMEDIATE_JOB_ID, component)
          .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
          .setMinimumLatency(5_000L)
          .setOverrideDeadline(30_000L)
          .build()
        scheduler.schedule(info)
      } catch (_: Throwable) {
        // Best-effort immediate check
      }
    }

    fun cancelAll(context: Context) {
      try {
        val scheduler = context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as? JobScheduler ?: return
        scheduler.cancel(PERIODIC_JOB_ID)
        scheduler.cancel(IMMEDIATE_JOB_ID)
      } catch (_: Throwable) {
        // Safe cancel
      }
    }
  }

  override fun onStartJob(params: JobParameters?): Boolean {
    val ctx = applicationContext
    executor.execute {
      try {
        val prefs = ctx.getSharedPreferences(SupportMonitorService.PREFS_NAME, Context.MODE_PRIVATE)
        val enabled = prefs.getBoolean("enabled", false)
        if (!enabled) {
          cancelAll(ctx)
          jobFinished(params, false)
          return@execute
        }

        try {
          val svcIntent = Intent(ctx, SupportMonitorService::class.java)
          ContextCompat.startForegroundService(ctx, svcIntent)
        } catch (_: Throwable) {
          // If OS blocks FGS launch from background, poll directly in this job
        }

        SupportMonitorService.pollPulseAndNotify(ctx)
      } catch (_: Throwable) {
        // Retry gracefully
      } finally {
        jobFinished(params, false)
      }
    }
    return true
  }

  override fun onStopJob(params: JobParameters?): Boolean {
    return true
  }

  override fun onDestroy() {
    executor.shutdownNow()
    super.onDestroy()
  }
}

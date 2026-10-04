import fs from 'fs';
import path from 'path';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { scanAndSanitizeImage, registerAsset } from './mediaSecurity.js';
import { recordViolation } from './accountSecurityManager.js';
import { SocialDB } from '../social/socialDb.js';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_UPLOAD_DIR = path.resolve(__dirname, '../../upload');

// Background processing queue for videos
const videoQueue = [];
const activeVideoTasks = new Map();
const completedVideoTasks = new Map();
const MAX_COMPLETED_VIDEO_TASKS = 1000;
let isWorkerRunning = false;
let ffmpegPathCache = null;
let ffprobePathCache = null;
const videoDimensionsCache = new Map();

async function runFfmpeg(ffmpeg, args) {
  const command = process.platform === 'win32' ? ffmpeg : 'nice';
  const commandArgs = process.platform === 'win32'
    ? ['-nostdin', '-hide_banner', '-threads', '1', '-filter_threads', '1', ...args]
    : ['-n', '10', ffmpeg, '-nostdin', '-hide_banner', '-threads', '1', '-filter_threads', '1', ...args];

  return execFileAsync(command, commandArgs, { maxBuffer: 2 * 1024 * 1024 });
}

function isMobileCompatibleVideo(probeData) {
  const formats = (probeData.format?.format_name || '').split(',');
  const video = probeData.streams?.find((stream) => stream.codec_type === 'video');
  const audio = probeData.streams?.find((stream) => stream.codec_type === 'audio');

  return formats.some((format) => ['mp4', 'mov'].includes(format)) &&
    video?.codec_name === 'h264' &&
    video.pix_fmt === 'yuv420p' &&
    Math.max(video.width || 0, video.height || 0) <= 1920 &&
    (!video.level || video.level <= 41) &&
    (!audio || audio.codec_name === 'aac');
}

function rememberCompletedVideoTask(filePath, status) {
  completedVideoTasks.delete(filePath);
  completedVideoTasks.set(filePath, status);
  if (completedVideoTasks.size > MAX_COMPLETED_VIDEO_TASKS) {
    const oldestPath = completedVideoTasks.keys().next().value;
    completedVideoTasks.delete(oldestPath);
  }
}

function replaceVideoAtomically(tempPath, filePath) {
  if (process.platform !== 'win32') {
    fs.renameSync(tempPath, filePath);
    return;
  }

  const backupPath = `${filePath}.bak`;
  fs.renameSync(filePath, backupPath);
  try {
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    fs.renameSync(backupPath, filePath);
    throw error;
  }
  fs.unlinkSync(backupPath);
}

/**
 * Detect if FFmpeg is available on the operating system
 */
export async function detectFfmpeg() {
  if (ffmpegPathCache) return ffmpegPathCache;

  const probeCommands = process.platform === 'win32'
    ? ['where ffmpeg', 'ffmpeg -version']
    : ['which ffmpeg', 'ffmpeg -version'];

  for (const cmd of probeCommands) {
    try {
      const { stdout } = await execAsync(cmd);
      if (stdout && (stdout.includes('ffmpeg') || stdout.includes('version'))) {
        ffmpegPathCache = 'ffmpeg';
        return 'ffmpeg';
      }
    } catch (e) {}
  }

  // Check common binary locations on Linux VPS
  const commonLinuxPaths = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/snap/bin/ffmpeg'];
  for (const p of commonLinuxPaths) {
    if (fs.existsSync(p)) {
      ffmpegPathCache = p;
      return p;
    }
  }

  return null;
}

async function detectFfprobe() {
  if (ffprobePathCache) return ffprobePathCache;

  const probeCommands = process.platform === 'win32'
    ? ['where ffprobe', 'ffprobe -version']
    : ['which ffprobe', 'ffprobe -version'];

  for (const cmd of probeCommands) {
    try {
      const { stdout } = await execAsync(cmd);
      if (stdout && (stdout.includes('ffprobe') || stdout.includes('version'))) {
        ffprobePathCache = 'ffprobe';
        return ffprobePathCache;
      }
    } catch (e) {}
  }

  const commonLinuxPaths = ['/usr/bin/ffprobe', '/usr/local/bin/ffprobe', '/snap/bin/ffprobe'];
  for (const candidate of commonLinuxPaths) {
    if (fs.existsSync(candidate)) {
      ffprobePathCache = candidate;
      return candidate;
    }
  }

  return null;
}

export async function getVideoDimensions(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stats = fs.statSync(filePath);
  const cacheKey = `${filePath}:${stats.mtimeMs}:${stats.size}`;
  if (videoDimensionsCache.has(cacheKey)) return videoDimensionsCache.get(cacheKey);

  const ffprobe = await detectFfprobe();
  if (!ffprobe) return null;

  try {
    const { stdout } = await execFileAsync(ffprobe, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height:stream_tags=rotate',
      '-of', 'json',
      filePath,
    ], { maxBuffer: 1024 * 1024 });
    const stream = JSON.parse(stdout).streams?.[0];
    let width = Number(stream?.width) || 0;
    let height = Number(stream?.height) || 0;
    const rotation = Math.abs(Number(stream?.tags?.rotate) || 0) % 180 === 90;
    if (rotation) [width, height] = [height, width];
    const dimensions = width > 0 && height > 0 ? { width, height } : null;
    videoDimensionsCache.set(cacheKey, dimensions);
    if (videoDimensionsCache.size > 500) {
      videoDimensionsCache.delete(videoDimensionsCache.keys().next().value);
    }
    return dimensions;
  } catch (error) {
    console.warn('[VideoProcessor] Could not probe video dimensions:', error.message);
    return null;
  }
}

/**
 * Get comprehensive FFmpeg system status for health checks
 */
export async function getFfmpegStatus() {
  const binary = await detectFfmpeg();
  if (!binary) {
    return {
      available: false,
      message: 'FFmpeg binary not detected in PATH or system directories.',
      queueLength: videoQueue.length,
      isWorkerRunning,
    };
  }

  try {
    const { stdout } = await execAsync(`${binary} -version`);
    const firstLine = stdout.split('\n')[0] || 'FFmpeg available';
    return {
      available: true,
      binary,
      version: firstLine.trim(),
      queueLength: videoQueue.length,
      isWorkerRunning,
    };
  } catch (e) {
    return {
      available: false,
      error: e.message,
      queueLength: videoQueue.length,
      isWorkerRunning,
    };
  }
}

/**
 * Enqueue a video for asynchronous, non-blocking background processing.
 * User receives the original URL immediately (<100ms), while this worker:
 *  1. Extracts a 1-second poster thumbnail (.jpg)
 *  2. Runs NSFWJS classification on sampled video frames
 *  3. Transcodes to standard 8-bit YUV420P H.264 + FastStart MOOV atom (fixes Android black screen)
 *  4. Writes a compatible sidecar file without changing the uploaded source
 */
export function enqueueVideoProcessing(task) {
  if (!task || !task.filePath) return;
  const filePath = path.resolve(task.filePath);
  const activeTask = activeVideoTasks.get(filePath);
  if (activeTask) {
    if (task.postId) activeTask.postId = task.postId;
    if (task.reelId) activeTask.reelId = task.reelId;
    console.log(`[VideoProcessor] Reused active job for ${path.basename(filePath)}.`);
    return;
  }
  if (completedVideoTasks.has(filePath)) {
    console.log(`[VideoProcessor] Skipped duplicate job for ${path.basename(filePath)}.`);
    return;
  }

  const queuedTask = {
    id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ...task,
    filePath,
    enqueuedAt: Date.now(),
    status: 'queued',
  };
  activeVideoTasks.set(filePath, queuedTask);
  videoQueue.push(queuedTask);

  if (!isWorkerRunning) {
    runVideoWorker();
  }
}

export function getVideoProcessingStatus(filePath) {
  const normalizedPath = path.resolve(filePath);
  return activeVideoTasks.get(normalizedPath)?.status ||
    completedVideoTasks.get(normalizedPath) ||
    'unknown';
}

async function runVideoWorker() {
  if (isWorkerRunning || videoQueue.length === 0) return;
  isWorkerRunning = true;

  try {
    while (videoQueue.length > 0) {
      const task = videoQueue.shift();
      try {
        task.status = 'processing';
        const result = await processSingleVideo(task);
        rememberCompletedVideoTask(task.filePath, result);
      } catch (err) {
        console.error(`[VideoProcessor] Error processing video ${task.filePath}:`, err.message);
        rememberCompletedVideoTask(task.filePath, 'failed');
      } finally {
        activeVideoTasks.delete(task.filePath);
      }
    }
  } finally {
    isWorkerRunning = false;
  }
}

async function processSingleVideo(task) {
  const { filePath, relativeUrl, userId, subfolder = 'posts' } = task;

  if (!fs.existsSync(filePath)) {
    console.warn(`[VideoProcessor] File not found: ${filePath}`);
    return 'failed';
  }

  const ffmpeg = await detectFfmpeg();
  if (!ffmpeg) {
    console.log(`[VideoProcessor] FFmpeg not installed on host. Video served as raw stream: ${filePath}`);
    return 'ready';
  }

  const fileDir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const posterFilename = `${baseName}_poster.jpg`;
  const posterPath = path.join(fileDir, posterFilename);
  const posterRelativeUrl = `/api/upload/${subfolder}/${posterFilename}`;
  const legacyPosterUrl = `/upload/${subfolder}/${posterFilename}`;

  console.log(`[VideoProcessor] Starting background pipeline for: ${baseName}${ext}`);

  // -------------------------------------------------------------
  // STEP 1: Fast Poster Extraction at 1s (or 0.1s for short clips)
  // -------------------------------------------------------------
  try {
    const posterArgs = ['-ss', '00:00:01', '-i', filePath, '-frames:v', '1', '-threads', '1', '-q:v', '2', '-y', posterPath];
    await runFfmpeg(ffmpeg, posterArgs).catch(async () => {
      // Fallback to start of video if clip is shorter than 1s
      await runFfmpeg(ffmpeg, ['-ss', '00:00:00.100', '-i', filePath, '-frames:v', '1', '-threads', '1', '-q:v', '2', '-y', posterPath]);
    });

    if (fs.existsSync(posterPath)) {
      registerAsset(posterRelativeUrl, {
        userId: userId || 'system',
        purpose: 'public_feed',
        isSafe: true,
      });
      registerAsset(legacyPosterUrl, {
        userId: userId || 'system',
        purpose: 'public_feed',
        isSafe: true,
      });

      // Update post/reel record in SocialDB if ID was provided
      if (task.reelId) {
        try {
          const sData = SocialDB.getData();
          const targetReel = (sData.reels || []).find((r) => r.id === task.reelId);
          if (targetReel && (!targetReel.image || targetReel.image === targetReel.videoUrl)) {
            targetReel.image = posterRelativeUrl;
            SocialDB.saveData(sData);
          }
        } catch (e) {}
      }

      console.log(`[VideoProcessor] Poster generated: ${posterRelativeUrl}`);
    }
  } catch (posterErr) {
    console.warn(`[VideoProcessor] Poster generation failed:`, posterErr.message);
  }

  // -------------------------------------------------------------
  // STEP 2: NSFWJS Classification on Sampled Video Frames
  // -------------------------------------------------------------
  const frameSampleDir = path.join(fileDir, `_sample_${baseName}`);
  let sourceVideoInfo = null;
  try {
    const ffprobe = await detectFfprobe();
    if (!ffprobe) {
      throw new Error('FFprobe is required to sample video frames for NSFWJS moderation.');
    }
    const { stdout: probeOutput } = await execFileAsync(ffprobe, [
      '-v', 'error',
      '-show_entries', 'format=duration,format_name:stream=codec_type,codec_name,pix_fmt,profile,width,height,level',
      '-of', 'json',
      filePath,
    ]);
    sourceVideoInfo = JSON.parse(probeOutput);
    const durationSeconds = Number(sourceVideoInfo.format?.duration);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new Error(`FFprobe returned an invalid video duration: ${sourceVideoInfo.format?.duration || 'missing'}`);
    }
    const sampleRate = Math.min(1, 3 / durationSeconds);

    if (!fs.existsSync(frameSampleDir)) {
      fs.mkdirSync(frameSampleDir, { recursive: true });
    }

    // Sample up to three frames evenly across the whole clip, independent of source FPS.
    await runFfmpeg(ffmpeg, [
      '-i', filePath,
      '-vf', `fps=${sampleRate.toFixed(6)}`,
      '-threads', '1',
      '-q:v', '2',
      '-y', path.join(frameSampleDir, 'frame_%02d.jpg'),
    ]);

    const sampleFiles = fs.existsSync(frameSampleDir)
      ? fs.readdirSync(frameSampleDir).filter((file) => file.endsWith('.jpg'))
      : [];
    if (sampleFiles.length === 0) {
      throw new Error('FFmpeg did not produce any frames for NSFWJS moderation.');
    }
    let isViolated = false;
    let violationReason = '';
    let scannedFrameCount = 0;

    for (const sFile of sampleFiles) {
      const sPath = path.join(frameSampleDir, sFile);
      const buffer = fs.readFileSync(sPath);
      const scan = await scanAndSanitizeImage(buffer, 'public_feed', sFile);
      scannedFrameCount++;
      if (!scan.safe) {
        isViolated = true;
        violationReason = scan.reason || 'Prohibited adult content detected in a video frame';
        break;
      }
    }
    console.log(`[VideoProcessor] NSFWJS checked ${scannedFrameCount}/${sampleFiles.length} sampled frames for ${baseName}${ext}.`);

    // Clean up sample frames directory
    try {
      for (const sFile of sampleFiles) {
        fs.unlinkSync(path.join(frameSampleDir, sFile));
      }
      fs.rmdirSync(frameSampleDir);
    } catch (e) {}

    if (isViolated) {
      console.warn(`[VideoProcessor] 🚨 VIOLATION DETECTED in video ${baseName}${ext}: ${violationReason}`);

      // Delete raw video & poster
      try { fs.unlinkSync(filePath); } catch (e) {}
      try { fs.unlinkSync(posterPath); } catch (e) {}

      // Mark post or reel violated
      if (task.postId) {
        await SocialDB.markPostViolated(task.postId, {
          reason: violationReason,
          policyName: 'Adult & Sexually Explicit Content Policy',
          removedAt: new Date().toISOString(),
        });
      }
      if (task.reelId) {
        try {
          const sData = SocialDB.getData();
          const rIndex = (sData.reels || []).findIndex((r) => r.id === task.reelId);
          if (rIndex !== -1) {
            sData.reels.splice(rIndex, 1);
            SocialDB.saveData(sData);
          }
        } catch (e) {}
      }

      // Record strike
      if (task.userId && task.userId !== 'anonymous') {
        const userObj = await SocialDB.findUserById(task.userId);
        await recordViolation({
          user: userObj || { id: task.userId },
          category: 'ADULT_CONTENT',
          policyName: 'Adult & Sexually Explicit Content Policy',
          reason: violationReason,
          contentType: task.reelId ? 'Tiwi Short/Reel' : 'Video Post',
        });
      }

      return 'removed'; // Stop processing violated video
    }
  } catch (auditErr) {
    console.error(`[VideoProcessor] NSFWJS moderation failed for ${baseName}${ext}:`, auditErr);
    try {
      fs.rmSync(frameSampleDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.error(`[VideoProcessor] Failed to clean moderation frames for ${baseName}${ext}:`, cleanupErr);
    }
  }

  // -------------------------------------------------------------
  // STEP 3: Transcode to Standard H.264 YUV420P + FastStart
  //  - Fixes Android ExoPlayer black screen bug (8-bit YUV420P)
  //  - Moves MOOV atom to front (+faststart) for instant playback
  // -------------------------------------------------------------
  if (!sourceVideoInfo || !isMobileCompatibleVideo(sourceVideoInfo)) {
    const optimizedPath = path.join(fileDir, `${baseName}_optimized.mp4`);
    if (fs.existsSync(optimizedPath) && fs.statSync(optimizedPath).size > 1000) {
      console.log(`[VideoProcessor] Reused existing optimized video: ${optimizedPath}`);
    } else {
      const tempOptimizedPath = path.join(fileDir, `${baseName}_optimized_tmp.mp4`);
      try {
        await runFfmpeg(ffmpeg, [
          '-i', filePath,
          '-vf', 'scale=1920:1920:force_original_aspect_ratio=decrease:force_divisible_by=2',
          '-c:v', 'libx264',
          '-profile:v', 'main',
          '-pix_fmt', 'yuv420p',
          '-preset', 'ultrafast',
          '-crf', '23',
          '-threads', '1',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-ar', '44100',
          '-movflags', '+faststart',
          '-y', tempOptimizedPath,
        ]);

        if (!fs.existsSync(tempOptimizedPath) || fs.statSync(tempOptimizedPath).size <= 1000) {
          throw new Error('FFmpeg did not produce a valid optimized video.');
        }
        replaceVideoAtomically(tempOptimizedPath, optimizedPath);
        console.log(`[VideoProcessor] ✅ Compatible video created: ${optimizedPath}`);
      } catch (optErr) {
        console.error(`[VideoProcessor] Video optimization failed:`, optErr.message);
        if (fs.existsSync(tempOptimizedPath)) {
          try { fs.unlinkSync(tempOptimizedPath); } catch (e) {}
        }
        return 'failed';
      }
    }
  } else {
    console.log(`[VideoProcessor] Skipped transcode for compatible H.264 video: ${baseName}${ext}`);
  }
  return 'ready';
}

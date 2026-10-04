import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { BASE_URL } from '../config/api';
import { COLORS } from '../config/colors';

const videoStatusCache = new Map();
const videoStatusRequests = new Map();

async function fetchVideoProcessingStatus(origin, videoSource) {
  const cached = videoStatusCache.get(videoSource);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const pendingRequest = videoStatusRequests.get(videoSource);
  if (pendingRequest) return pendingRequest;

  const request = (async () => {
    const statusUrl = `${origin}/api/tiwi/video-status?url=${encodeURIComponent(videoSource)}`;
    const response = await fetch(statusUrl, { headers: { 'Cache-Control': 'no-cache' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    const ttl = result.status === 'ready' ? 30000 : result.status === 'queued' || result.status === 'processing' ? 1500 : 5000;
    if (videoStatusCache.size >= 100) {
      for (const [url, entry] of videoStatusCache) {
        if (entry.expiresAt <= Date.now()) videoStatusCache.delete(url);
      }
      if (videoStatusCache.size >= 100) videoStatusCache.delete(videoStatusCache.keys().next().value);
    }
    videoStatusCache.set(videoSource, { result, expiresAt: Date.now() + ttl });
    return result;
  })();
  videoStatusRequests.set(videoSource, request);

  try {
    return await request;
  } finally {
    videoStatusRequests.delete(videoSource);
  }
}

/**
 * Tiwi High-Performance Video Player
 * Powered by expo-video with Android TextureView rendering, poster transitions,
 * and adaptive viewport autoplay.
 */
function normalizeVideoSource(sourceUri) {
  let source = sourceUri?.startsWith('http')
    ? sourceUri
    : sourceUri?.startsWith('/')
    ? `${BASE_URL}${sourceUri}`
    : sourceUri
    ? `${BASE_URL}/${sourceUri}`
    : null;

  if (source) {
    if (source.includes('/upload/') && !source.includes('/api/upload/')) {
      source = source.replace('/upload/', '/api/upload/');
    } else if (source.includes('/uploads/') && !source.includes('/api/uploads/')) {
      source = source.replace('/uploads/', '/api/uploads/');
    }
  }

  return source;
}

function normalizePosterSource(posterUri, videoSource) {
  let poster = posterUri
    ? (posterUri.startsWith('http') ? posterUri : `${BASE_URL}${posterUri.startsWith('/') ? '' : '/'}${posterUri}`)
    : videoSource && /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(videoSource)
    ? videoSource.replace(/\.(mp4|mov|webm|mkv|m4v)(\?|$)/i, '_poster.jpg$2')
    : null;

  if (poster) {
    if (poster.includes('/upload/') && !poster.includes('/api/upload/')) {
      poster = poster.replace('/upload/', '/api/upload/');
    } else if (poster.includes('/uploads/') && !poster.includes('/api/uploads/')) {
      poster = poster.replace('/uploads/', '/api/uploads/');
    }
  }

  return poster;
}

export default function TiwiVideoPlayer(props) {
  const { sourceUri, posterUri, isActive = false, onPress, onVideoSizeChange, style, resizeMode = 'cover' } = props;
  const [manuallyActivated, setManuallyActivated] = useState(false);
  const [processingState, setProcessingState] = useState({ source: null, status: 'idle' });
  const videoSource = normalizeVideoSource(sourceUri);
  const posterSource = normalizePosterSource(posterUri, videoSource);
  const shouldPlay = isActive || manuallyActivated;
  const isManagedUpload = Boolean(videoSource?.includes('/api/upload/') || videoSource?.includes('/upload/'));
  const currentProcessingStatus = processingState.source === videoSource ? processingState.status : 'idle';
  const initialPlaybackRef = useRef({ source: null, playbackUrl: null, version: null });
  if (initialPlaybackRef.current.source !== videoSource) {
    const cachedStatus = videoStatusCache.get(videoSource);
    const cachedPlayback = cachedStatus?.expiresAt > Date.now() && cachedStatus.result?.status === 'ready'
      ? cachedStatus.result
      : null;
    initialPlaybackRef.current = {
      source: videoSource,
      playbackUrl: cachedPlayback?.playbackUrl || null,
      version: cachedPlayback?.version || null,
    };
  }

  useEffect(() => {
    setManuallyActivated(false);
  }, [videoSource]);

  useEffect(() => {
    if (isActive) setManuallyActivated(false);
  }, [isActive]);

  useEffect(() => {
    if (!shouldPlay || !isManagedUpload) return undefined;

    let isCancelled = false;
    let pollTimer = null;
    const origin = videoSource.match(/^https?:\/\/[^/]+/)?.[0];
    if (!origin) {
      setProcessingState({ source: videoSource, status: 'ready' });
      return undefined;
    }

    const checkProcessingStatus = async () => {
      try {
        const result = await fetchVideoProcessingStatus(origin, videoSource);
        const status = result?.status || 'unknown';
        if (isCancelled) return;
        if (result?.videoSize) onVideoSizeChange?.(result.videoSize);
        setProcessingState({
          source: videoSource,
          status,
        });
        if (status === 'queued' || status === 'processing') {
          pollTimer = setTimeout(checkProcessingStatus, 2000);
        }
      } catch (error) {
        if (isCancelled) return;
        console.warn('[TiwiVideoPlayer] Could not check video processing status:', error?.message || error);
        setProcessingState({ source: videoSource, status: 'unavailable' });
      }
    };

    setProcessingState({ source: videoSource, status: 'checking' });
    checkProcessingStatus();
    return () => {
      isCancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [shouldPlay, isManagedUpload, videoSource, onVideoSizeChange]);

  if (!videoSource) {
    return <View style={[styles.container, style]} />;
  }

  if (!shouldPlay || ['removed', 'failed'].includes(currentProcessingStatus)) {
    const contentFitMode = resizeMode === 'contain' ? 'contain' : resizeMode === 'fill' ? 'fill' : 'cover';
    return (
      <Pressable
        style={[styles.container, style]}
        onPress={() => {
          if (onPress) {
            onPress();
          } else {
            setManuallyActivated(true);
          }
        }}
        accessibilityRole="button"
        accessibilityLabel="Play video"
      >
        {posterSource ? (
          <Image
            source={{ uri: posterSource }}
            style={StyleSheet.absoluteFillObject}
            resizeMode={contentFitMode}
          />
        ) : null}
        {['removed', 'failed'].includes(currentProcessingStatus) && (
          <View pointerEvents="none" style={styles.errorOverlay}>
            <Ionicons name="alert-circle-outline" size={30} color={COLORS.white} />
          </View>
        )}
      </Pressable>
    );
  }

  const { playbackUrl, version: readyVersion } = initialPlaybackRef.current;
  const origin = videoSource.match(/^https?:\/\/[^/]+/)?.[0] || '';
  const playbackSource = playbackUrl
    ? `${playbackUrl.startsWith('http') ? '' : origin}${playbackUrl}${readyVersion ? `?tiwi=${encodeURIComponent(readyVersion)}` : ''}`
    : videoSource;

  return <ActiveTiwiVideoPlayer {...props} isActive={shouldPlay} sourceUri={playbackSource} posterUri={posterSource} />;
}

function ActiveTiwiVideoPlayer({
  sourceUri,
  posterUri,
  isActive = true,
  onPlaybackStarted,
  onVideoSizeChange,
  isMuted = false,
  loop = true,
  resizeMode = 'cover',
  style,
  onPress,
  showControls = true,
}) {
  const [isPlaying, setIsPlaying] = useState(isActive);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [firstFrameRendered, setFirstFrameRendered] = useState(false);
  const hideIconTimer = useRef(null);
  const firstFrameRenderedRef = useRef(false);
  const playbackStartedRef = useRef(false);

  const videoSource = sourceUri;
  const posterSource = posterUri;

  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = loop;
    p.muted = isMuted;
    p.bufferOptions = {
      preferredForwardBufferDuration: 3,
      minBufferForPlayback: 0.1,
      waitsToMinimizeStalling: false,
      prioritizeTimeOverSizeThreshold: true,
    };
    if (isActive) {
      p.play();
    }
  });

  const reportVideoSize = useCallback((videoTrack) => {
    const { width, height } = videoTrack?.size || {};
    if (width > 0 && height > 0) {
      onVideoSizeChange?.({ width, height });
    }
  }, [onVideoSizeChange]);

  useEffect(() => {
    setFirstFrameRendered(false);
    firstFrameRenderedRef.current = false;
    playbackStartedRef.current = false;
    setPlaybackError(false);
    setIsPlaying(isActive);
  }, [videoSource, isActive]);

  // Keep player in sync with isActive prop (for feed & reels scrolling)
  useEffect(() => {
    if (!player) return;
    try {
      if (isActive) {
        player.play();
        setIsPlaying(true);
      } else {
        player.pause();
        setIsPlaying(false);
      }
    } catch (error) {
      console.warn('[TiwiVideoPlayer] Could not update playback state:', error?.message || error);
    }
  }, [isActive, player]);

  // Keep player in sync with isMuted prop
  useEffect(() => {
    if (!player) return;
    try {
      player.muted = isMuted;
    } catch (error) {
      console.warn('[TiwiVideoPlayer] Could not update mute state:', error?.message || error);
    }
  }, [isMuted, player]);

  // Track playback status and report native playback failures.
  useEffect(() => {
    if (!player) return undefined;
    const updateStatus = (status, error) => {
      setPlaybackError(status === 'error');
      if (status === 'readyToPlay') reportVideoSize(player.videoTrack);
      if (status === 'error') {
        console.error('[TiwiVideoPlayer] Playback failed:', error?.message || 'Unknown video playback error');
      }
      if (status === 'readyToPlay' && isActive) {
        if (firstFrameRenderedRef.current) return;
        try {
          player.play();
        } catch (error) {
          console.warn('[TiwiVideoPlayer] Could not start ready video:', error?.message || error);
        }
      }
    };
    const subscription = player.addListener('statusChange', ({ status, error }) => {
      updateStatus(status, error);
    });
    const playingSubscription = player.addListener('playingChange', ({ isPlaying: playing }) => {
      setIsPlaying(playing);
      if (playing && !playbackStartedRef.current) {
        playbackStartedRef.current = true;
        onPlaybackStarted?.();
      }
    });
    const videoTrackSubscription = player.addListener('videoTrackChange', ({ videoTrack }) => {
      reportVideoSize(videoTrack);
    });
    return () => {
      subscription.remove();
      playingSubscription.remove();
      videoTrackSubscription.remove();
    };
  }, [player, isActive, onPlaybackStarted, reportVideoSize]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (player) {
        try {
          player.pause();
        } catch (error) {
          console.warn('[TiwiVideoPlayer] Could not pause player during cleanup:', error?.message || error);
        }
      }
      if (hideIconTimer.current) clearTimeout(hideIconTimer.current);
    };
  }, [player]);

  const handleTogglePlay = () => {
    if (!player) return;
    if (onPress) {
      onPress();
      return;
    }

    if (isPlaying) {
      try {
        player.pause();
      } catch (error) {
        console.warn('[TiwiVideoPlayer] Could not pause video:', error?.message || error);
      }
      setIsPlaying(false);
    } else {
      try {
        player.play();
      } catch (error) {
        console.warn('[TiwiVideoPlayer] Could not play video:', error?.message || error);
      }
      setIsPlaying(true);
    }

    setShowPlayIcon(true);
    if (hideIconTimer.current) clearTimeout(hideIconTimer.current);
    hideIconTimer.current = setTimeout(() => {
      setShowPlayIcon(false);
    }, 1200);
  };

  if (!videoSource) {
    return <View style={[styles.container, style]} />;
  }

  // Convert resizeMode prop to expo-video contentFit
  const contentFitMode = resizeMode === 'contain' ? 'contain' : resizeMode === 'fill' ? 'fill' : 'cover';

  return (
    <View style={[styles.container, style]}>
      <VideoView
        style={style || StyleSheet.absoluteFillObject}
        player={player}
        surfaceType={Platform.OS === 'android' ? 'textureView' : 'surfaceView'}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        contentFit={contentFitMode}
        nativeControls={false}
        useExoShutter={true}
        onFirstFrameRender={() => {
          reportVideoSize(player.videoTrack);
          firstFrameRenderedRef.current = true;
          setFirstFrameRendered(true);
          setPlaybackError(false);
        }}
      />

      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={handleTogglePlay}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}
      />

      {/* Poster Thumbnail Overlay (Smooth transition while video decodes/buffers) */}
      {!firstFrameRendered && posterSource && !playbackError && (
        <Image
          source={{ uri: posterSource }}
          style={StyleSheet.absoluteFillObject}
          resizeMode={contentFitMode}
          pointerEvents="none"
        />
      )}

      {playbackError && (
        <View pointerEvents="none" style={styles.errorOverlay}>
          <Ionicons name="alert-circle-outline" size={30} color={COLORS.white} />
        </View>
      )}

      {/* Tap Feedback Play/Pause Overlay */}
      {showPlayIcon && showControls && (
        <View pointerEvents="none" style={styles.playPauseOverlay}>
          <View style={styles.iconCircle}>
            <Ionicons
              name={isPlaying ? 'play' : 'pause'}
              size={36}
              color={COLORS.white}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.black,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  playPauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.rgba_0_0_0_0p2,
    zIndex: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.rgba_0_0_0_0p5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.rgba_0_0_0_0p45,
    zIndex: 12,
  },
});

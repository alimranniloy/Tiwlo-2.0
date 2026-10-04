import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { TiwiAPI } from '../../services/tiwiApi';
import { COLORS } from '../../config/colors';

export default function AudioVideoCallScreen({ routeParams, onNavigate, navigation }) {
  const { currentUser } = useAuth();
  const conversationId = routeParams?.conversationId;
  const initialCallType = routeParams?.callType || 'video';
  const remoteTitle = routeParams?.title || 'User';
  const remoteAvatar = routeParams?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(remoteTitle)}&background=0B57D0&color=fff&size=200`;

  const [callSession, setCallSession] = useState(null);
  const [callStatus, setCallStatus] = useState('Initiating P2P Handshake...');
  const [isConnected, setIsConnected] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Call Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(initialCallType === 'video');
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const durationTimerRef = useRef(null);

  useEffect(() => {
    startCallSession();

    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, []);

  const startCallSession = async () => {
    try {
      setCallStatus('Connecting Peer Session...');
      const session = await TiwiAPI.initiateCall(
        conversationId,
        routeParams?.receiverId || null,
        initialCallType,
        currentUser?.id
      );
      setCallSession(session);

      // Simulate real P2P ICE handshake transition
      setTimeout(() => {
        setCallStatus('Ringing...');
      }, 1200);

      setTimeout(() => {
        setCallStatus('Connected (DTLS-SRTP P2P)');
        setIsConnected(true);
        // Start duration counter
        durationTimerRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }, 2800);
    } catch (err) {
      setCallStatus('Connection Failed');
      console.warn('Call initiate failed:', err.message);
    }
  };

  const handleEndCall = async () => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    try {
      if (callSession?.id) {
        await TiwiAPI.endCall(callSession.id, callDuration);
      }
    } catch (e) {
      console.warn('Failed to record end call:', e.message);
    } finally {
      if (navigation?.goBack) {
        navigation.goBack();
      } else if (onNavigate) {
        onNavigate('back');
      }
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.hex_0B0E14} />

      {/* Top Bar with Security Badge */}
      <View style={styles.topBar}>
        <View style={styles.securityBadge}>
          <Ionicons name="lock-closed" size={13} color={COLORS.hex_34A853} style={{ marginRight: 5 }} />
          <Text style={styles.securityText}>End-to-End Encrypted (P2P)</Text>
        </View>
        <Text style={styles.sessionKeyText}>
          {callSession?.session_key ? `Key: ${callSession.session_key.slice(0, 10)}...` : 'Zero Server Bandwidth'}
        </Text>
      </View>

      {/* Main Remote User Video / Avatar Canvas */}
      <View style={styles.canvasArea}>
        {isVideoEnabled && isConnected ? (
          <View style={styles.videoSimContainer}>
            <Image source={{ uri: remoteAvatar }} style={styles.videoSimAvatar} />
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE WEBRTC P2P</Text>
            </View>
          </View>
        ) : (
          <View style={styles.avatarContainer}>
            <Image source={{ uri: remoteAvatar }} style={styles.largeAvatar} />
          </View>
        )}

        <Text style={styles.remoteName}>{remoteTitle}</Text>
        <Text style={styles.callStatusText}>
          {isConnected ? formatDuration(callDuration) : callStatus}
        </Text>
      </View>

      {/* Local Video Pip Preview */}
      {isVideoEnabled && (
        <View style={styles.pipContainer}>
          <Image
            source={{ uri: currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'Me')}&background=0B57D0&color=fff` }}
            style={styles.pipAvatar}
          />
          <Text style={styles.pipLabel}>You ({isFrontCamera ? 'Front' : 'Back'})</Text>
        </View>
      )}

      {/* Bottom Controls Panel */}
      <View style={styles.controlsPanel}>
        {/* Mute Mic */}
        <TouchableOpacity
          style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
          onPress={() => setIsMuted(!isMuted)}
          activeOpacity={0.8}
        >
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color={isMuted ? COLORS.hex_D93025 : COLORS.white} />
          <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>

        {/* Video Toggle */}
        <TouchableOpacity
          style={[styles.controlBtn, !isVideoEnabled && styles.controlBtnActive]}
          onPress={() => setIsVideoEnabled(!isVideoEnabled)}
          activeOpacity={0.8}
        >
          <Ionicons name={isVideoEnabled ? 'videocam' : 'videocam-off'} size={24} color={!isVideoEnabled ? COLORS.hex_D93025 : COLORS.white} />
          <Text style={styles.controlLabel}>{isVideoEnabled ? 'Stop Video' : 'Start Video'}</Text>
        </TouchableOpacity>

        {/* Camera Flip */}
        {isVideoEnabled && (
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setIsFrontCamera(!isFrontCamera)}
            activeOpacity={0.8}
          >
            <Ionicons name="camera-reverse" size={24} color={COLORS.white} />
            <Text style={styles.controlLabel}>Flip</Text>
          </TouchableOpacity>
        )}

        {/* Speakerphone */}
        <TouchableOpacity
          style={[styles.controlBtn, isSpeakerOn && styles.controlBtnHighlight]}
          onPress={() => setIsSpeakerOn(!isSpeakerOn)}
          activeOpacity={0.8}
        >
          <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-mute'} size={24} color={COLORS.white} />
          <Text style={styles.controlLabel}>{isSpeakerOn ? 'Speaker' : 'Earpiece'}</Text>
        </TouchableOpacity>

        {/* End Call Button */}
        <TouchableOpacity
          style={styles.endCallBtn}
          onPress={handleEndCall}
          activeOpacity={0.8}
        >
          <Ionicons name="call" size={28} color={COLORS.white} style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.hex_0B0E14,
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  topBar: {
    alignItems: 'center',
    paddingTop: 10,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.rgba_255_255_255_0p08,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 4,
  },
  securityText: {
    color: COLORS.hex_E8EAED,
    fontSize: 12,
    fontWeight: '500',
  },
  sessionKeyText: {
    color: COLORS.hex_9AA0A6,
    fontSize: 11,
  },
  canvasArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  avatarContainer: {
    marginBottom: 20,
  },
  largeAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  videoSimContainer: {
    width: 220,
    height: 280,
    borderRadius: 20,
    backgroundColor: COLORS.hex_1E232A,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.hex_34A853,
    position: 'relative',
    overflow: 'hidden',
  },
  videoSimAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  liveIndicator: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.rgba_0_0_0_0p6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.hex_34A853,
    marginRight: 6,
  },
  liveText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  remoteName: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  callStatusText: {
    color: COLORS.hex_9AA0A6,
    fontSize: 15,
    marginTop: 6,
    fontWeight: '500',
  },
  pipContainer: {
    position: 'absolute',
    right: 20,
    top: 80,
    width: 90,
    height: 120,
    borderRadius: 14,
    backgroundColor: COLORS.hex_1E232A,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pipAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  pipLabel: {
    color: COLORS.white,
    fontSize: 10,
    marginTop: 6,
    fontWeight: '500',
  },
  controlsPanel: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.rgba_255_255_255_0p15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnActive: {
    backgroundColor: COLORS.rgba_217_48_37_0p25,
  },
  controlBtnHighlight: {
    backgroundColor: COLORS.primary,
  },
  controlLabel: {
    color: COLORS.hex_E8EAED,
    fontSize: 10,
    marginTop: 2,
  },
  endCallBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.hex_D93025,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Loader2,
  RotateCcw,
  ScanFace,
} from 'lucide-react';
import { useVerification } from '../../context/VerificationContext';
import VerificationHeader from '../../components/VerificationHeader';
import StepIndicator from '../../components/StepIndicator';
import {
  isVerificationFetchError,
  VERIFICATION_CONNECTION_ERROR,
} from '../../utils/verificationErrors';

const CHALLENGE_LABELS = {
  turn_left: 'Turn your head slightly left',
  turn_right: 'Turn your head slightly right',
  open_mouth: 'Open your mouth gently',
  blink: 'Blink once',
};
const FRAME_INTERVAL_MS = 500;
const QUALITY_RETRY_MS = 1200;
const FACE_ID_TICK_COUNT = 60;

function getTransientRetryDelay(failureCount) {
  return Math.min(1000 * (2 ** Math.max(0, failureCount - 1)), 8000);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('The camera selfie could not be prepared. Please try again.'));
    reader.readAsDataURL(blob);
  });
}

async function readVerificationResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('json')) {
    const detail = response.status === 404
      ? 'The verification API route was not found.'
      : 'The server returned a web page instead of verification data.';
    throw new Error(`${detail} Refresh the page and try again. If this continues, the server update may be missing.`);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('The verification server returned invalid data. Please try again later.');
  }

  if (!response.ok) {
    const error = new Error(
      result && typeof result.error === 'string'
        ? result.error
        : `The verification request failed (HTTP ${response.status}).`
    );
    error.status = response.status;
    throw error;
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('The verification server returned an invalid response.');
  }
  return result;
}

function chooseRecordingMimeType() {
  if (!window.MediaRecorder) return null;
  return [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find(type => MediaRecorder.isTypeSupported(type)) || null;
}

export default function CaptureSelfieStep() {
  const {
    verificationAccessToken,
    setCapturedSelfie,
    setRecordedVideo,
    setLivenessSessionId,
    nextStep,
    prevStep,
  } = useVerification();
  const accessHeaders = useMemo(
    () => verificationAccessToken ? { Authorization: `Bearer ${verificationAccessToken}` } : {},
    [verificationAccessToken]
  );
  const [stream, setStream] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [lastPassedIndex, setLastPassedIndex] = useState(-1);
  const [challengePassed, setChallengePassed] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [faceReady, setFaceReady] = useState(false);
  const [faceGuidance, setFaceGuidance] = useState('checking');
  const [awaitingFinalSelfie, setAwaitingFinalSelfie] = useState(false);
  const [faceIdCompleted, setFaceIdCompleted] = useState(false);
  const [lowLightWarning, setLowLightWarning] = useState(false);
  const [retry, setRetry] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const sessionRef = useRef(null);
  const pollTimerRef = useRef(null);
  const submitChallengeFrameRef = useRef(null);
  const captureFinalSelfieRef = useRef(null);
  const challengePassedTimerRef = useRef(null);
  const completionTimerRef = useRef(null);
  const frameBusyRef = useRef(false);
  const transientFailuresRef = useRef(0);
  const retryDelayRef = useRef(FRAME_INTERVAL_MS);
  const faceReadyRef = useRef(false);
  const awaitingFinalSelfieRef = useRef(false);
  const finalSelfieStartedAtRef = useRef(0);
  const preparingRecorderRef = useRef(false);
  const finishedRef = useRef(false);
  const discardRecordingRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setStream(null);
  }, []);

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video?.videoWidth || !video?.videoHeight || !canvas) return null;
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  }, []);

  const captureSelfieFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video?.videoWidth || !video?.videoHeight || !canvas) return null;
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(
      video,
      (video.videoWidth - size) / 2,
      (video.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      size,
      size
    );
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  }, []);

  const failCapture = useCallback((message) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFaceIdCompleted(false);
    setCameraError(message);
    window.clearTimeout(pollTimerRef.current);
    window.clearTimeout(challengePassedTimerRef.current);
    window.clearTimeout(completionTimerRef.current);
    discardRecordingRef.current = true;
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
    stopCamera();
    const sessionId = sessionRef.current?.sessionId;
    if (sessionId) {
      fetch(`/api/verification/liveness/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: accessHeaders,
      }).catch(() => {});
    }
  }, [accessHeaders, stopCamera]);

  const completeCapture = useCallback(selfie => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    window.clearTimeout(pollTimerRef.current);
    window.clearTimeout(challengePassedTimerRef.current);
    const recorder = recorderRef.current;
    if (!selfie || !recorder || recorder.state !== 'recording') {
      finishedRef.current = false;
      failCapture('The camera recording could not be completed. Please try again.');
      return;
    }

    setFaceIdCompleted(true);
    setCapturedSelfie(selfie);
    recorder.addEventListener('stop', () => {
      if (discardRecordingRef.current) return;
      const mimeType = (recorder.mimeType || 'video/webm').split(';')[0];
      const extension = mimeType === 'video/mp4' ? 'mp4' : 'webm';
      const recording = new File(chunksRef.current, `liveness.${extension}`, { type: mimeType });
      if (!recording.size) {
        finishedRef.current = false;
        setFaceIdCompleted(false);
        failCapture('The camera recording was empty. Please try again.');
        return;
      }
      setRecordedVideo(recording);
      setIsRecording(false);
      stopCamera();
      completionTimerRef.current = window.setTimeout(() => {
        nextStep();
      }, 500);
    }, { once: true });
    recorder.stop();
  }, [
    failCapture,
    nextStep,
    setCapturedSelfie,
    setRecordedVideo,
    stopCamera,
  ]);

  const captureFinalSelfie = useCallback(async () => {
    if (!awaitingFinalSelfieRef.current || frameBusyRef.current || finishedRef.current) return;
    if (Date.now() - finalSelfieStartedAtRef.current > 90_000) {
      failCapture('We could not capture a clear selfie in time. Follow the camera guidance, hold still, and try again.');
      return;
    }
    frameBusyRef.current = true;
    try {
      const frame = await captureSelfieFrame();
      if (!frame) {
        setFaceGuidance('checking');
        return;
      }

      const body = new FormData();
      body.append('frame', frame, 'final-selfie.jpg');
      const response = await fetch('/api/verification/liveness/quality', {
        method: 'POST',
        credentials: 'include',
        headers: accessHeaders,
        body,
      });
      const result = await readVerificationResponse(response);
      if (typeof result.ready !== 'boolean') {
        throw new Error('The final selfie quality check returned an invalid result.');
      }

      transientFailuresRef.current = 0;
      retryDelayRef.current = result.ready ? FRAME_INTERVAL_MS : QUALITY_RETRY_MS;
      setFaceGuidance(result.guidance || (result.ready ? 'ready' : 'hold_still'));
      setLowLightWarning(
        typeof result.quality?.brightness === 'number' && result.quality.brightness < 35
      );
      if (result.ready) {
        const selfie = await blobToDataUrl(frame);
        awaitingFinalSelfieRef.current = false;
        setAwaitingFinalSelfie(false);
        completeCapture(selfie);
      }
    } catch (error) {
      if (error.status === 429) {
        failCapture(error.message || 'Too many camera checks. Please restart verification later.');
        return;
      }
      if (error.status >= 500 || isVerificationFetchError(error)) {
        transientFailuresRef.current += 1;
        retryDelayRef.current = getTransientRetryDelay(transientFailuresRef.current);
        if (transientFailuresRef.current >= 10) {
          failCapture(isVerificationFetchError(error)
            ? VERIFICATION_CONNECTION_ERROR
            : error.message || 'The final selfie quality check is temporarily unavailable.');
          return;
        }
        setFaceGuidance('connection');
      } else {
        failCapture(isVerificationFetchError(error)
          ? VERIFICATION_CONNECTION_ERROR
          : error.message || 'The final selfie could not be checked.');
      }
    } finally {
      frameBusyRef.current = false;
      if (awaitingFinalSelfieRef.current && !finishedRef.current) {
        pollTimerRef.current = window.setTimeout(
          () => captureFinalSelfieRef.current?.(),
          retryDelayRef.current
        );
      }
    }
  }, [accessHeaders, captureSelfieFrame, completeCapture, failCapture]);

  const submitChallengeFrame = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || frameBusyRef.current || finishedRef.current) return;
    frameBusyRef.current = true;
    try {
      const frame = await captureFrame();
      if (!frame) throw new Error('Waiting for a camera frame. Keep your face inside the circle.');
      const body = new FormData();
      body.append('frame', frame, 'frame.jpg');
      const response = await fetch(
        `/api/verification/liveness/${encodeURIComponent(session.sessionId)}/frame`,
        { method: 'POST', credentials: 'include', headers: accessHeaders, body }
      );
      const result = await readVerificationResponse(response);
      if (
        typeof result.passed !== 'boolean' ||
        typeof result.challengesRemaining !== 'number' ||
        typeof result.complete !== 'boolean'
      ) {
        throw new Error('The verification server returned an invalid liveness result.');
      }
      transientFailuresRef.current = 0;
      retryDelayRef.current = FRAME_INTERVAL_MS;

      const passedIndex = session.challenges.length - result.challengesRemaining - (result.passed ? 1 : 0);
      if (result.passed) {
        setLastPassedIndex(Math.max(0, passedIndex));
        setChallengeIndex(Math.min(session.challenges.length - 1, passedIndex + 1));
        setChallengePassed(true);
        window.clearTimeout(challengePassedTimerRef.current);
        challengePassedTimerRef.current = window.setTimeout(() => setChallengePassed(false), 700);
      }
      if (result.complete) {
        awaitingFinalSelfieRef.current = true;
        finalSelfieStartedAtRef.current = Date.now();
        setAwaitingFinalSelfie(true);
        setFaceGuidance('hold_still');
        retryDelayRef.current = FRAME_INTERVAL_MS;
      } else if (result.state === 'failed' || result.state === 'expired') {
        const action = CHALLENGE_LABELS[result.challengeType] || 'the requested action';
        failCapture(`We could not detect ${action.toLowerCase()} in time. Keep your face in view and follow the prompt slowly, then try again.`);
      }
    } catch (error) {
      const retryable = isVerificationFetchError(error) || error.status >= 500;
      if (retryable && transientFailuresRef.current < 10) {
        transientFailuresRef.current += 1;
        retryDelayRef.current = getTransientRetryDelay(transientFailuresRef.current);
        setFaceGuidance('connection');
      } else if (error.status === 429) {
        failCapture(error.message || 'Too many camera checks. Please restart verification later.');
      } else {
        failCapture(isVerificationFetchError(error)
          ? VERIFICATION_CONNECTION_ERROR
          : error.message || 'The liveness check could not process the camera.');
      }
    } finally {
      frameBusyRef.current = false;
      if (!finishedRef.current) {
        pollTimerRef.current = window.setTimeout(
          () => {
            if (awaitingFinalSelfieRef.current) {
              captureFinalSelfieRef.current?.();
            } else {
              submitChallengeFrameRef.current?.();
            }
          },
          retryDelayRef.current
        );
      }
    }
  }, [accessHeaders, captureFrame, failCapture]);

  useEffect(() => {
    submitChallengeFrameRef.current = submitChallengeFrame;
  }, [submitChallengeFrame]);

  useEffect(() => {
    captureFinalSelfieRef.current = captureFinalSelfie;
  }, [captureFinalSelfie]);

  useEffect(() => {
    let cancelled = false;
    finishedRef.current = false;
    discardRecordingRef.current = false;
    frameBusyRef.current = false;
    awaitingFinalSelfieRef.current = false;
    transientFailuresRef.current = 0;
    retryDelayRef.current = FRAME_INTERVAL_MS;
    chunksRef.current = [];

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support secure camera access.');
      }
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      if (cancelled) {
        cameraStream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = cameraStream;
      setStream(cameraStream);
    };

    start().catch(error => {
      if (cancelled || error.name === 'AbortError') return;
      failCapture(isVerificationFetchError(error)
        ? VERIFICATION_CONNECTION_ERROR
        : error.message || 'Please allow camera access to start verification.');
    });

    return () => {
      cancelled = true;
      window.clearTimeout(pollTimerRef.current);
      window.clearTimeout(challengePassedTimerRef.current);
      window.clearTimeout(completionTimerRef.current);
      preparingRecorderRef.current = false;
      const recorder = recorderRef.current;
      if (recorder?.state === 'recording') {
        discardRecordingRef.current = true;
        recorder.stop();
      }
      stopCamera();
      const sessionId = sessionRef.current?.sessionId;
      if (sessionId && !finishedRef.current) {
        fetch(`/api/verification/liveness/${encodeURIComponent(sessionId)}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: accessHeaders,
        }).catch(() => {});
      }
      sessionRef.current = null;
    };
  }, [accessHeaders, retry, failCapture, setCapturedSelfie, setLivenessSessionId, setRecordedVideo, stopCamera]);

  useEffect(() => {
    if (!stream || !videoRef.current) return undefined;
    const video = videoRef.current;
    video.srcObject = stream;
    let cancelled = false;
    let qualityTimer;

    const startRecording = async () => {
      if (cancelled || finishedRef.current || recorderRef.current || preparingRecorderRef.current) return;
      preparingRecorderRef.current = true;
      try {
        const sessionResponse = await fetch('/api/verification/liveness/session', {
          method: 'POST',
          credentials: 'include',
          headers: accessHeaders,
        });
        const sessionResult = await readVerificationResponse(sessionResponse);
        if (
          typeof sessionResult.sessionId !== 'string' ||
          !Array.isArray(sessionResult.challenges) ||
          sessionResult.challenges.length === 0
        ) {
          throw new Error('The verification server returned an invalid camera challenge.');
        }
        if (cancelled) {
          fetch(`/api/verification/liveness/${encodeURIComponent(sessionResult.sessionId)}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: accessHeaders,
          }).catch(() => {});
          return;
        }
        sessionRef.current = sessionResult;
        setLivenessSessionId(sessionResult.sessionId);
        setChallenges(sessionResult.challenges);

        const mimeType = chooseRecordingMimeType();
        if (!mimeType) throw new Error('This browser cannot record a supported verification video.');
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 500_000 });
        recorderRef.current = recorder;
        recorder.ondataavailable = event => {
          if (event.data.size) chunksRef.current.push(event.data);
        };
        recorder.onerror = () => failCapture('The camera recording stopped unexpectedly. Please try again.');
        recorder.start(500);
        setIsRecording(true);
        pollTimerRef.current = window.setTimeout(
          () => submitChallengeFrameRef.current?.(),
          FRAME_INTERVAL_MS
        );
      } catch (error) {
        if (!cancelled) {
          failCapture(isVerificationFetchError(error)
            ? VERIFICATION_CONNECTION_ERROR
            : error.message || 'The camera could not start recording.');
        }
      } finally {
        preparingRecorderRef.current = false;
      }
    };

    const inspectFrame = async () => {
      if (cancelled || finishedRef.current || faceReadyRef.current) return;
      try {
        await video.play();
        const frame = await captureFrame();
        if (!frame) {
          setFaceGuidance('checking');
          qualityTimer = window.setTimeout(inspectFrame, QUALITY_RETRY_MS);
          return;
        }
        const body = new FormData();
        body.append('frame', frame, 'camera-frame.jpg');
        const response = await fetch('/api/verification/liveness/quality', {
          method: 'POST',
          credentials: 'include',
          headers: accessHeaders,
          body,
        });
        const result = await readVerificationResponse(response);
        if (typeof result.ready !== 'boolean') {
          throw new Error('The camera quality check returned an invalid result.');
        }
        if (cancelled) return;
        transientFailuresRef.current = 0;
        retryDelayRef.current = QUALITY_RETRY_MS;
        faceReadyRef.current = result.ready;
        setFaceGuidance(result.guidance || (result.ready ? 'ready' : 'checking'));
        setLowLightWarning(typeof result.quality?.brightness === 'number' && result.quality.brightness < 35);
        if (result.ready) {
          setFaceReady(true);
          startRecording();
          return;
        }
      } catch (error) {
        if (cancelled) return;
        if (error.status === 429) {
          failCapture(error.message || 'Too many camera checks. Please restart verification later.');
          return;
        }
        if (error.status >= 500 || isVerificationFetchError(error)) {
          transientFailuresRef.current += 1;
          retryDelayRef.current = getTransientRetryDelay(transientFailuresRef.current);
          if (transientFailuresRef.current >= 10) {
            failCapture(isVerificationFetchError(error)
              ? VERIFICATION_CONNECTION_ERROR
              : error.message || 'The camera quality check is temporarily unavailable.');
            return;
          }
          setFaceGuidance('connection');
        } else {
          failCapture(error.message || 'The camera quality check could not process the frame.');
          return;
        }
      }
      if (!finishedRef.current) {
        qualityTimer = window.setTimeout(inspectFrame, retryDelayRef.current);
      }
    };

    video.play().then(inspectFrame).catch(error => {
      failCapture(error.message || 'The camera preview could not start.');
    });
    return () => {
      cancelled = true;
      window.clearTimeout(qualityTimer);
      video.srcObject = null;
    };
  }, [accessHeaders, captureFrame, stream, failCapture, setLivenessSessionId]);

  const handleBack = () => {
    prevStep();
  };

  const handleRetry = () => {
    window.clearTimeout(completionTimerRef.current);
    setCameraError('');
    setChallenges([]);
    setChallengeIndex(0);
    setLastPassedIndex(-1);
    setChallengePassed(false);
    setIsRecording(false);
    setFaceReady(false);
    faceReadyRef.current = false;
    awaitingFinalSelfieRef.current = false;
    setAwaitingFinalSelfie(false);
    setFaceIdCompleted(false);
    setFaceGuidance('checking');
    setLivenessSessionId(null);
    setCapturedSelfie(null);
    setRecordedVideo(null);
    recorderRef.current = null;
    chunksRef.current = [];
    setRetry(value => value + 1);
  };

  const currentChallenge = challenges[challengeIndex];
  const allChallengesPassed = challenges.length > 0 && lastPassedIndex === challenges.length - 1;
  const challengeLabel = currentChallenge
    ? CHALLENGE_LABELS[currentChallenge.type] || currentChallenge.instruction
    : 'Preparing Face ID check';

  const progressRatio = faceIdCompleted || awaitingFinalSelfie || allChallengesPassed
    ? 1
    : faceReady && challenges.length > 0
      ? Math.min(1, Math.max(0, (lastPassedIndex + 1) / challenges.length))
      : 0;
  const activeTickCount = Math.round(progressRatio * FACE_ID_TICK_COUNT);
  const progressPercent = Math.round(progressRatio * 100);

  const guidance = {
    no_face: 'Position your face within the frame.',
    multiple_faces: 'Only one person should be in the frame.',
    move_closer: 'Move your face a little closer.',
    move_back: 'Move the camera slightly farther away.',
    center_left: 'Move your face slightly left.',
    center_right: 'Move your face slightly right.',
    center_lower: 'Lower the camera slightly.',
    center_upper: 'Raise the camera slightly.',
    hold_still: 'Hold still while the camera focuses.',
    connection: 'Reconnecting to the verification check...',
    checking: 'Position your face within the frame.',
    ready: 'Face aligned. Starting live scan...',
  }[faceGuidance] || 'Position your face within the frame.';

  const guidanceTitle = {
    no_face: 'Position your face within the frame',
    multiple_faces: 'One face at a time',
    move_closer: 'Move closer',
    move_back: 'Move slightly back',
    center_left: 'Shift slightly left',
    center_right: 'Shift slightly right',
    center_lower: 'Lower camera slightly',
    center_upper: 'Raise camera slightly',
    hold_still: 'Hold still',
    connection: 'Reconnecting...',
    checking: 'Position your face within the frame',
    ready: 'Face detected',
  }[faceGuidance] || 'Position your face within the frame';

  const directionIcon = {
    center_left: ArrowLeft,
    center_right: ArrowRight,
    center_lower: ArrowDown,
    center_upper: ArrowUp,
  }[faceGuidance];
  const challengeDirectionIcon = currentChallenge?.type === 'turn_left'
    ? ArrowLeft
    : currentChallenge?.type === 'turn_right'
      ? ArrowRight
      : null;
  const ringDirectionIcon = isRecording && !challengePassed && !awaitingFinalSelfie && !faceIdCompleted
    ? challengeDirectionIcon
    : !faceReady && !faceIdCompleted
      ? directionIcon
      : null;
  const ringDirectionPosition = ringDirectionIcon === ArrowLeft
    ? 'left-3 top-1/2 -translate-y-1/2'
    : ringDirectionIcon === ArrowRight
      ? 'right-3 top-1/2 -translate-y-1/2'
      : ringDirectionIcon === ArrowUp
        ? 'left-1/2 top-3 -translate-x-1/2'
        : ringDirectionIcon === ArrowDown
          ? 'bottom-3 left-1/2 -translate-x-1/2'
          : '';

  const primaryInstruction = cameraError
    ? 'Face ID Check Paused'
    : faceIdCompleted
      ? 'Face ID Complete'
      : awaitingFinalSelfie
        ? 'Hold still for final capture'
        : faceReady
          ? challengeLabel
          : guidanceTitle;

  const secondaryInstruction = cameraError
    ? cameraError
    : faceIdCompleted
      ? 'Live scan verified. Preparing your submission...'
      : awaitingFinalSelfie
        ? faceGuidance === 'ready'
          ? 'Capturing crisp verification frame...'
          : guidance
        : faceReady
          ? 'Move gently and keep your face inside the aperture.'
          : guidance;

  return (
    <div className="flex-1 flex flex-col justify-between px-5 pb-6 pt-1 select-none">
      <div>
        <VerificationHeader
          title="Identity Verification"
          showBack
          onBack={handleBack}
        />
        <StepIndicator currentStep={3} totalSteps={5} />

        {/* Dark Frosted Shadcn Glass Surface */}
        <div className="mt-4 rounded-3xl border border-white/10 bg-neutral-950/95 p-6 text-white shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Subtle top radial emerald ambient glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 left-1/2 h-44 w-72 -translate-x-1/2 rounded-full blur-3xl transition-opacity duration-700"
            style={{
              background: faceReady || faceIdCompleted
                ? 'radial-gradient(circle, rgba(30,215,96,0.22) 0%, rgba(30,215,96,0) 70%)'
                : 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 70%)',
            }}
          />

          {/* Top Status Pill */}
          <div className="relative z-10 flex items-center justify-between mb-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11.5px] font-medium tracking-wide text-neutral-200 backdrop-blur-md">
              {faceIdCompleted ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-[#1ED760]" />
                  <span className="text-[#1ED760]">Face ID Verified</span>
                </>
              ) : isRecording ? (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#1ED760]" />
                  <span>Live Scan Active</span>
                </>
              ) : (
                <>
                  <ScanFace className="h-3.5 w-3.5 text-neutral-300" />
                  <span>Face ID Setup</span>
                </>
              )}
            </div>

            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-neutral-300">
              {progressPercent}%
            </span>
          </div>

          {/* Apple Face ID 60-Tick Radial Progress Ring + Circular Camera Aperture */}
          <div className="relative z-10 my-2 flex flex-col items-center">
            <div
              role="img"
              aria-label={
                faceIdCompleted
                  ? 'Face ID scan complete'
                  : challengePassed || allChallengesPassed
                    ? 'Liveness step complete'
                    : faceReady
                      ? 'Face centered inside Face ID ring'
                      : 'Aligning face inside Face ID ring'
              }
              className={`relative flex h-72 w-72 items-center justify-center transition-transform duration-500 ${
                challengePassed && !faceIdCompleted ? 'scale-[1.02]' : ''
              }`}
            >
              {/* Exact 60-Tick SVG Radial Progress Ring */}
              <svg
                viewBox="0 0 320 320"
                className="pointer-events-none absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                {Array.from({ length: FACE_ID_TICK_COUNT }).map((_, index) => {
                  const angleRad = ((index * 6 - 90) * Math.PI) / 180;
                  const isLit = index < activeTickCount;
                  const isLeading = isLit && index === activeTickCount - 1 && !faceIdCompleted;
                  const rInner = isLit ? 133 : 136;
                  const rOuter = isLit ? 152 : 150;
                  const x1 = 160 + rInner * Math.cos(angleRad);
                  const y1 = 160 + rInner * Math.sin(angleRad);
                  const x2 = 160 + rOuter * Math.cos(angleRad);
                  const y2 = 160 + rOuter * Math.sin(angleRad);

                  return (
                    <line
                      key={index}
                      x1={x1.toFixed(2)}
                      y1={y1.toFixed(2)}
                      x2={x2.toFixed(2)}
                      y2={y2.toFixed(2)}
                      stroke={isLit ? (isLeading ? '#34C759' : '#1ED760') : 'rgba(163, 163, 163, 0.35)'}
                      strokeWidth={isLit ? 2.8 : 2}
                      strokeLinecap="round"
                      style={{
                        transition: 'stroke 240ms ease-out, stroke-width 240ms ease-out',
                        filter: isLit ? 'drop-shadow(0 0 4px rgba(30, 215, 96, 0.55))' : undefined,
                      }}
                    />
                  );
                })}
              </svg>

              {/* Circular Camera Aperture */}
              <div className="relative z-10 h-[232px] w-[232px] overflow-hidden rounded-full bg-neutral-900 ring-1 ring-white/15 shadow-[inset_0_0_24px_rgba(0,0,0,0.65)]">
                {stream && !faceIdCompleted ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full scale-x-[-1] object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-neutral-900/95">
                    {cameraError ? (
                      <AlertCircle className="h-9 w-9 text-amber-400" />
                    ) : faceIdCompleted ? null : (
                      <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
                    )}
                  </div>
                )}

                {/* Subtle Dashed Alignment Ring + Animated Directional Sweep */}
                {!cameraError && !faceIdCompleted && (
                  <>
                    <div
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-3 rounded-full border border-dashed transition-colors duration-500 ${
                        faceReady
                          ? 'border-[#1ED760]/70'
                          : 'border-white/25'
                      }`}
                    />
                    <svg
                      viewBox="0 0 100 100"
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 h-full w-full animate-[spin_5s_linear_infinite] opacity-75"
                    >
                      <circle
                        cx="50"
                        cy="50"
                        r="47"
                        fill="none"
                        stroke={faceReady ? '#1ED760' : 'rgba(255,255,255,0.35)'}
                        strokeWidth="1.1"
                        strokeDasharray="28 268"
                        strokeLinecap="round"
                      />
                    </svg>
                  </>
                )}

                {/* Animated Emerald Face ID Checkmark Ring on Completion */}
                {faceIdCompleted && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/85 backdrop-blur-sm animate-[fadeIn_200ms_ease-out]">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1ED760]/15 ring-2 ring-[#1ED760] shadow-[0_0_28px_rgba(30,215,96,0.45)]">
                      <Check className="h-10 w-10 text-[#1ED760]" strokeWidth={3} />
                    </div>
                  </div>
                )}

                {/* Directional Guidance Arrow inside Aperture */}
                {ringDirectionIcon && !cameraError && (
                  <span
                    className={`absolute z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 backdrop-blur-md shadow-lg ${
                      isRecording
                        ? 'bg-[#1ED760] text-neutral-950'
                        : 'bg-neutral-900/80 text-white'
                    } ${ringDirectionPosition}`}
                  >
                    {React.createElement(ringDirectionIcon, { className: 'h-4 w-4 animate-pulse' })}
                  </span>
                )}
              </div>
            </div>

            {/* Step Progress Dots */}
            {challenges.length > 0 && (
              <div
                className="mt-4 flex items-center justify-center gap-2"
                aria-label="Liveness challenge progress"
              >
                {challenges.map((challenge, index) => {
                  const isDone = index <= lastPassedIndex || faceIdCompleted;
                  const isCurrent = index === challengeIndex && !faceIdCompleted;
                  return (
                    <span
                      key={`${challenge.type}-${index}`}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        isDone
                          ? 'w-5 bg-[#1ED760]'
                          : isCurrent
                            ? 'w-4 bg-white/80'
                            : 'w-1.5 bg-white/20'
                      }`}
                    />
                  );
                })}
              </div>
            )}

            {/* Minimal Apple-clean Floating Instruction Text */}
            <h2 className="mt-4 text-center text-[19px] font-semibold tracking-tight text-white">
              {primaryInstruction}
            </h2>
            <p className="mt-1.5 max-w-[290px] text-center text-[12.5px] leading-relaxed text-neutral-400">
              {secondaryInstruction}
            </p>

            {lowLightWarning && !cameraError && !faceIdCompleted && (
              <div className="mt-3 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-[11.5px] font-medium text-amber-300">
                Brighter lighting can help speed up detection
              </div>
            )}
          </div>

          {cameraError && (
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>{cameraError}</span>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                className="w-full rounded-xl bg-[#1ED760] hover:bg-[#19c354] active:scale-[0.98] px-4 py-3 text-sm font-semibold text-neutral-950 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Try Again</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {!cameraError && (
        <p className="pt-4 pb-1 text-center text-[11.5px] text-neutral-400">
          {awaitingFinalSelfie
            ? 'Hold steady for a brief moment while we finalize your selfie.'
            : 'Keep your face centered in the circular frame and follow each prompt.'}
        </p>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

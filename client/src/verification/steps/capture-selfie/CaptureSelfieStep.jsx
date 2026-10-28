import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Loader2,
  Video,
} from 'lucide-react';
import { useVerification } from '../../context/VerificationContext';
import VerificationHeader from '../../components/VerificationHeader';
import StepIndicator from '../../components/StepIndicator';
import {
  isVerificationFetchError,
  VERIFICATION_CONNECTION_ERROR,
} from '../../utils/verificationErrors';

const CHALLENGE_LABELS = {
  turn_left: 'Turn your head to the left',
  turn_right: 'Turn your head to the right',
  open_mouth: 'Open your mouth',
  blink: 'Close and open your eyes',
};
const FRAME_INTERVAL_MS = 500;
const QUALITY_RETRY_MS = 1200;

function getTransientRetryDelay(failureCount) {
  return Math.min(1000 * (2 ** Math.max(0, failureCount - 1)), 8000);
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
  const challengePassedTimerRef = useRef(null);
  const frameBusyRef = useRef(false);
  const transientFailuresRef = useRef(0);
  const retryDelayRef = useRef(FRAME_INTERVAL_MS);
  const faceReadyRef = useRef(false);
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

  const captureSelfieImage = useCallback(async () => {
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
    return canvas.toDataURL('image/jpeg', 0.92);
  }, []);

  const failCapture = useCallback((message) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setCameraError(message);
    window.clearTimeout(pollTimerRef.current);
    window.clearTimeout(challengePassedTimerRef.current);
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

  const completeCapture = useCallback(async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    window.clearTimeout(pollTimerRef.current);
    window.clearTimeout(challengePassedTimerRef.current);
    let selfie;
    try {
      selfie = await captureSelfieImage();
    } catch {
      finishedRef.current = false;
      failCapture('The camera selfie could not be captured. Please try again.');
      return;
    }
    const recorder = recorderRef.current;
    if (!selfie || !recorder || recorder.state !== 'recording') {
      finishedRef.current = false;
      failCapture('The camera recording could not be completed. Please try again.');
      return;
    }

    setCapturedSelfie(selfie);
    recorder.addEventListener('stop', () => {
      if (discardRecordingRef.current) return;
      const mimeType = (recorder.mimeType || 'video/webm').split(';')[0];
      const extension = mimeType === 'video/mp4' ? 'mp4' : 'webm';
      const recording = new File(chunksRef.current, `liveness.${extension}`, { type: mimeType });
      if (!recording.size) {
        finishedRef.current = false;
        failCapture('The camera recording was empty. Please try again.');
        return;
      }
      setRecordedVideo(recording);
      setIsRecording(false);
      stopCamera();
      nextStep();
    }, { once: true });
    recorder.stop();
  }, [
    captureSelfieImage,
    failCapture,
    nextStep,
    setCapturedSelfie,
    setRecordedVideo,
    stopCamera,
  ]);

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
        completeCapture();
      } else if (result.state === 'failed' || result.state === 'expired') {
        failCapture('That action was not detected in time. Please restart and follow each instruction.');
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
          () => submitChallengeFrameRef.current?.(),
          retryDelayRef.current
        );
      }
    }
  }, [accessHeaders, captureFrame, completeCapture, failCapture]);

  useEffect(() => {
    submitChallengeFrameRef.current = submitChallengeFrame;
  }, [submitChallengeFrame]);

  useEffect(() => {
    let cancelled = false;
    finishedRef.current = false;
    discardRecordingRef.current = false;
    frameBusyRef.current = false;
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
    setCameraError('');
    setChallenges([]);
    setChallengeIndex(0);
    setLastPassedIndex(-1);
    setChallengePassed(false);
    setIsRecording(false);
    setFaceReady(false);
    faceReadyRef.current = false;
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
    : 'Preparing your secure camera check';
  const guidance = {
    no_face: 'Move your face into the circle.',
    multiple_faces: 'Only one person should be in the frame.',
    move_closer: 'Move a little closer to the camera.',
    move_back: 'Move the phone a little farther away.',
    center_left: 'Shift your face slightly left.',
    center_right: 'Shift your face slightly right.',
    center_lower: 'Lower the phone a little.',
    center_upper: 'Raise the phone a little.',
    hold_still: 'Hold still for a moment so the camera can focus.',
    connection: 'Reconnecting to the camera check. Keep your face in view.',
    checking: 'Finding your face and checking focus…',
    ready: 'Face centered and in focus. Starting the live check…',
  }[faceGuidance] || 'Center your face inside the circle.';
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

  return (
    <div className="flex-1 flex flex-col justify-between px-6 pb-6 pt-1 select-none">
      <div>
        <VerificationHeader
          title="Identity Verification"
          showBack
          onBack={handleBack}
        />
        <StepIndicator currentStep={3} totalSteps={5} />

        <div className="my-5 flex flex-col items-center">
          <div className={`mb-4 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
            isRecording ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'
          }`}>
            {isRecording ? <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> : <Video className="h-3.5 w-3.5" />}
            <span>{isRecording ? 'Recording securely' : faceReady ? 'Face is in position' : 'Finding your face'}</span>
          </div>

          <div
            role="img"
            aria-label={challengePassed || allChallengesPassed
              ? 'Liveness action detected'
              : faceReady
                ? 'Face centered and in focus'
                : 'Aligning face in camera'}
            className={`relative h-64 w-64 rounded-full border-[5px] p-1.5 shadow-lg transition-all duration-500 ${
              challengePassed || allChallengesPassed || faceReady
                ? 'border-emerald-500 shadow-emerald-200'
                : 'border-rose-500 shadow-rose-200'
            } ${challengePassed && !allChallengesPassed ? 'scale-[1.03]' : ''}`}
          >
            <div className="relative h-full w-full overflow-hidden rounded-full bg-slate-900">
              {stream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full scale-x-[-1] object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  {cameraError ? <AlertCircle className="h-8 w-8 text-amber-400" /> : <Loader2 className="h-8 w-8 animate-spin text-blue-300" />}
                </div>
              )}
              {faceReady && (
                <div className="pointer-events-none absolute inset-3 rounded-full border border-emerald-300/80 animate-pulse" />
              )}
            </div>
            {directionIcon && !faceReady && (
              <span className="absolute -right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-rose-600 shadow-md ring-1 ring-rose-100">
                {React.createElement(directionIcon, { className: 'h-5 w-5 animate-pulse' })}
              </span>
            )}
            {isRecording && challengeDirectionIcon && !challengePassed && (
              <span className="absolute -right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md ring-4 ring-white">
                {React.createElement(challengeDirectionIcon, { className: 'h-5 w-5 animate-pulse' })}
              </span>
            )}
            {faceReady && (
              <span className="absolute -bottom-1 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md ring-4 ring-white">
                <Check className="h-5 w-5" strokeWidth={3} />
              </span>
            )}
          </div>

          <div className="mt-5 flex items-center justify-center gap-2" aria-label="Liveness challenge progress">
            {challenges.map((challenge, index) => (
              <span
                key={`${challenge.type}-${index}`}
                className={`h-2.5 w-2.5 rounded-full ${
                  index <= lastPassedIndex ? 'bg-emerald-500' : index === challengeIndex ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <h2 className="mt-3 text-center text-lg font-bold text-slate-900">
            {cameraError ? 'Camera check stopped' : faceReady ? challengeLabel : 'Center your face'}
          </h2>
          <p className="mt-1 text-center text-xs leading-relaxed text-slate-500">
            {cameraError
              ? cameraError
              : faceReady
                ? 'Follow each action shown. Camera video is used only for this check and is not saved.'
                : guidance}
          </p>
          {lowLightWarning && !cameraError && (
            <p className="mt-2 text-center text-xs text-amber-700">
              A little more light may help; slight darkness is okay.
            </p>
          )}
        </div>
        {cameraError && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{cameraError}</span>
          </div>
        )}
      </div>

      {cameraError ? (
        <button
          type="button"
          onClick={handleRetry}
          className="w-full rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white"
        >
          Try again
        </button>
      ) : (
        <p className="pb-2 text-center text-[11px] text-slate-400">
          Keep your face inside the circle and follow the instructions.
        </p>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

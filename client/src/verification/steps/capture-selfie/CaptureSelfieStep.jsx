import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Video } from 'lucide-react';
import { useVerification } from '../../context/VerificationContext';
import VerificationHeader from '../../components/VerificationHeader';
import StepIndicator from '../../components/StepIndicator';

const CHALLENGE_LABELS = {
  turn_left: 'Turn your head to the left',
  turn_right: 'Turn your head to the right',
  open_mouth: 'Open your mouth',
  blink: 'Close and open your eyes',
};
const FRAME_INTERVAL_MS = 850;

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
    throw new Error(
      result && typeof result.error === 'string'
        ? result.error
        : `The verification request failed (HTTP ${response.status}).`
    );
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
    setCapturedSelfie,
    setRecordedVideo,
    setLivenessSessionId,
    nextStep,
    prevStep,
  } = useVerification();
  const [stream, setStream] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [lastPassedIndex, setLastPassedIndex] = useState(-1);
  const [challengePassed, setChallengePassed] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
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
      }).catch(() => {});
    }
  }, [stopCamera]);

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
        { method: 'POST', credentials: 'include', body }
      );
      const result = await readVerificationResponse(response);
      if (
        typeof result.passed !== 'boolean' ||
        typeof result.challengesRemaining !== 'number' ||
        typeof result.complete !== 'boolean'
      ) {
        throw new Error('The verification server returned an invalid liveness result.');
      }

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
      failCapture(error.message || 'The liveness check could not process the camera.');
    } finally {
      frameBusyRef.current = false;
      if (!finishedRef.current) {
        pollTimerRef.current = window.setTimeout(
          () => submitChallengeFrameRef.current?.(),
          FRAME_INTERVAL_MS
        );
      }
    }
  }, [captureFrame, completeCapture, failCapture]);

  useEffect(() => {
    submitChallengeFrameRef.current = submitChallengeFrame;
  }, [submitChallengeFrame]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    finishedRef.current = false;
    discardRecordingRef.current = false;
    frameBusyRef.current = false;
    chunksRef.current = [];

    const start = async () => {
      const sessionResponse = await fetch('/api/verification/liveness/session', {
        method: 'POST',
        credentials: 'include',
        signal: controller.signal,
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
        }).catch(() => {});
        return;
      }
      sessionRef.current = sessionResult;
      setLivenessSessionId(sessionResult.sessionId);
      setChallenges(sessionResult.challenges);

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
      failCapture(error.message || 'Please allow camera access to start verification.');
    });

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(pollTimerRef.current);
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
        }).catch(() => {});
      }
      sessionRef.current = null;
    };
  }, [retry, failCapture, setCapturedSelfie, setLivenessSessionId, setRecordedVideo, stopCamera]);

  useEffect(() => {
    if (!stream || !videoRef.current || !sessionRef.current) return undefined;
    const video = videoRef.current;
    video.srcObject = stream;
    let cancelled = false;

    const startRecording = async () => {
      try {
        await video.play();
        if (cancelled) return;
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
          250
        );
      } catch (error) {
        failCapture(error.message || 'The camera could not start recording.');
      }
    };

    startRecording();
    return () => {
      cancelled = true;
      video.srcObject = null;
    };
  }, [stream, failCapture, submitChallengeFrame]);

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
    setLivenessSessionId(null);
    setCapturedSelfie(null);
    setRecordedVideo(null);
    setRetry(value => value + 1);
  };

  const currentChallenge = challenges[challengeIndex];
  const allChallengesPassed = challenges.length > 0 && lastPassedIndex === challenges.length - 1;
  const challengeLabel = currentChallenge
    ? CHALLENGE_LABELS[currentChallenge.type] || currentChallenge.instruction
    : 'Preparing your secure camera check';

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
            <span>{isRecording ? 'Recording securely' : 'Starting camera check'}</span>
          </div>

          <div
            role="img"
            aria-label={challengePassed || allChallengesPassed ? 'Liveness action detected' : 'Camera challenge in progress'}
            className={`relative h-52 w-52 rounded-full border-4 p-1 shadow-md transition-colors ${
            challengePassed || allChallengesPassed
              ? 'border-emerald-500 shadow-emerald-200'
              : 'border-blue-600'
          } ${challengePassed && !allChallengesPassed ? 'animate-pulse' : ''}`}
          >
            <div className="h-full w-full overflow-hidden rounded-full bg-slate-900">
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
            </div>
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
            {cameraError ? 'Camera check stopped' : challengeLabel}
          </h2>
          <p className="mt-1 text-center text-xs leading-relaxed text-slate-500">
            {cameraError
              ? cameraError
              : 'Follow each randomly selected action. Your camera video is recorded only for this check and is not saved.'}
          </p>
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

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Image as ImageIcon, RotateCcw, Camera, AlertCircle, Check } from 'lucide-react';
import { useVerification } from '../../context/VerificationContext';
import VerificationHeader from '../../components/VerificationHeader';
import StepIndicator from '../../components/StepIndicator';

/**
 * Step 3: Capture Selfie (Front Camera)
 * Screen 3 in reference mockup
 * Opens the mobile device front camera stream directly inside the circular viewfinder.
 */
export default function CaptureSelfieStep({ onNext = null, onBack = null, isStaticShowcase = false }) {
  const { selfieImage, setCapturedSelfie, nextStep, prevStep } = useVerification();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const galleryInputRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('user'); // 'user' is front camera
  const [capturedPreview, setCapturedPreview] = useState(selfieImage || null);
  const [isCapturing, setIsCapturing] = useState(false);

  const streamRef = useRef(null);
  const cameraRequestRef = useRef(0);

  // Initialize front-facing camera
  const startCamera = useCallback(async (facing = 'user') => {
    const requestId = ++cameraRequestRef.current;
    try {
      // Stop existing tracks if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (requestId !== cameraRequestRef.current) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setCameraActive(true);
    } catch (err) {
      if (requestId !== cameraRequestRef.current) return;
      console.warn('Camera access error:', err);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
      setCameraActive(false);
      setCameraError('Please allow camera access to take your selfie, or choose a photo from your gallery.');
    }
  }, []);

  useEffect(() => {
    if (!cameraActive || !stream || !videoRef.current) return undefined;
    const video = videoRef.current;
    video.srcObject = stream;
    video.play().catch(() => {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
      setCameraActive(false);
      setCameraError('Please allow camera access to take your selfie, or choose a photo from your gallery.');
    });
    return () => {
      video.srcObject = null;
    };
  }, [cameraActive, stream]);

  // Stop pending camera requests and streams when this step is left.
  useEffect(() => {
    return () => {
      cameraRequestRef.current += 1;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Flip between front and back camera
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setCameraError(null);
    setFacingMode(nextMode);
    if (!isStaticShowcase) startCamera(nextMode);
  };

  // Capture photo from video frame
  const takeSnapshot = () => {
    if (isStaticShowcase) return;
    if (!cameraActive || !videoRef.current?.videoWidth || !videoRef.current?.videoHeight) {
      if (!cameraActive) {
        startCamera(facingMode);
      } else {
        setCameraError('Wait for the camera preview or choose a selfie image from your device.');
      }
      return;
    }
    setIsCapturing(true);

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const size = Math.min(video.videoWidth || 480, video.videoHeight || 480);

      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsCapturing(false);
        setCameraError('The selfie camera is unavailable. Please try again.');
        return;
      }

      // Mirror horizontally if using front camera
      if (facingMode === 'user') {
        ctx.translate(size, 0);
        ctx.scale(-1, 1);
      }

      // Draw center crop square
      const sx = ((video.videoWidth || size) - size) / 2;
      const sy = ((video.videoHeight || size) - size) / 2;
      ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setCapturedPreview(dataUrl);
      setCapturedSelfie(dataUrl);

      // Stop camera stream after capture
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setCameraActive(false);

      // Small delay for natural snap feedback before moving to Step 4
      setTimeout(() => {
        setIsCapturing(false);
        if (onNext) {
          onNext(dataUrl);
        } else {
          nextStep();
        }
      }, 450);
    }
  };

  // Retake selfie
  const retakeSelfie = () => {
    setCameraError(null);
    setCapturedPreview(null);
    setCapturedSelfie(null);
  };

  // Gallery file select fallback
  const handleGallerySelect = (e) => {
    const file = e.target.files?.[0];
    if (!file || isStaticShowcase) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setCameraError('Choose a JPEG, PNG or WebP selfie image no larger than 10MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl !== 'string') {
        setCameraError('Could not read the selected selfie image. Please try another image.');
        return;
      }
      setCameraError(null);
      setCapturedPreview(dataUrl);
      setCapturedSelfie(dataUrl);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setCameraActive(false);
      setTimeout(() => {
        if (onNext) onNext(dataUrl);
        else nextStep();
      }, 450);
    };
    reader.onerror = () => setCameraError('Could not read the selected selfie image. Please try another image.');
    reader.readAsDataURL(file);
  };

  const handleBack = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (onBack) {
      onBack();
    } else {
      prevStep();
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between px-6 pb-6 pt-1 select-none">
      <div>
        {/* Top Header & Stepper */}
        <VerificationHeader
          title="Identity Verification"
          showBack={true}
          onBack={handleBack}
        />
        <StepIndicator currentStep={3} totalSteps={5} />

        {/* Central Circular Camera Viewfinder with Solid Blue Ring Border */}
        <div className="w-full flex items-center justify-center my-6">
          <div className="relative w-52 h-52 rounded-full border-4 border-blue-600 p-1 flex items-center justify-center bg-white shadow-md">
            {/* Inner Circular Viewport */}
            <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 relative flex items-center justify-center">
              {/* Captured Photo Preview (if taken) */}
              {capturedPreview ? (
                <img
                  src={capturedPreview}
                  alt="Captured Selfie"
                  className="w-full h-full object-cover"
                />
              ) : cameraActive ? (
                /* Live Front Camera Stream */
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${
                    facingMode === 'user' ? 'scale-x-[-1]' : ''
                  }`}
                />
              ) : isStaticShowcase ? (
                /* High-Fidelity Reference Portrait & Live Camera Launch */
                <div
                  className="w-full h-full relative select-none"
                >
                  <img
                    src="/sample-selfie.jpg"
                    alt="Selfie Frame"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-slate-900/15 group-hover:bg-slate-900/25 transition-all flex items-end justify-center pb-2.5">
                    <span className="px-2.5 py-1 rounded-full bg-slate-900/75 text-white text-[11px] font-medium backdrop-blur-xs flex items-center space-x-1.5 shadow-xs">
                      <Camera className="w-3.5 h-3.5 text-blue-400" />
                      <span>Preview only</span>
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCameraError(null);
                    startCamera(facingMode);
                  }}
                  className="w-full h-full text-sm text-slate-300"
                >
                  Tap to open camera
                </button>
              )}

              {/* Shutter flash animation overlay */}
              {isCapturing && (
                <div className="absolute inset-0 bg-white/90 animate-pulse pointer-events-none" />
              )}
            </div>
          </div>
        </div>

        {/* Hidden Canvas for Frame Capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Hidden Gallery Input */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="user"
          onChange={handleGallerySelect}
          className="hidden"
        />

        {/* Title & Guidance Description */}
        <div className="text-center px-4 mb-4">
          <h2 className="text-[24px] font-bold text-slate-900 tracking-tight">
            Take a selfie
          </h2>
          <p className="text-[13.5px] text-slate-500 font-normal mt-2 leading-relaxed">
            Please <strong className="text-slate-700 font-semibold">take a clear selfie</strong> of yourself. Make sure your face is fully visible and well lit. No sunglasses or hats.
          </p>
        </div>

        {/* Error notification if camera permission was denied */}
        {cameraError && (
          <div className="mx-2 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2 text-amber-800 text-[12px]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{cameraError}</span>
          </div>
        )}
      </div>

      {/* Bottom Shutter Controls Bar */}
      <div className="pt-2">
        {capturedPreview ? (
          /* If preview is showing, provide Retake or Continue */
          <div className="flex items-center space-x-3">
            <button
              onClick={retakeSelfie}
              type="button"
              className="flex-1 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[15px] rounded-xl transition-all cursor-pointer"
            >
              Retake
            </button>
            <button
              onClick={() => {
                if (onNext) onNext(capturedPreview);
                else nextStep();
              }}
              type="button"
              className="flex-1 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[15px] rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center space-x-2"
            >
              <span>Continue</span>
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Triple control buttons matching image: Gallery | Capture Shutter | Switch Camera */
          <div className="w-full flex items-center justify-around px-4 py-2">
            {/* Gallery Upload Button */}
            <button
              onClick={() => galleryInputRef.current?.click()}
              type="button"
              aria-label="Upload from gallery"
              disabled={isStaticShowcase}
              className="w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            {/* Central Shutter Capture Button */}
            <button
              onClick={takeSnapshot}
              type="button"
              aria-label="Take selfie"
              disabled={isStaticShowcase}
              className="w-18 h-18 rounded-full border-4 border-blue-200/90 hover:border-blue-300 p-1 flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-95 shadow-md"
            >
              <div className="w-14 h-14 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-full flex items-center justify-center shadow-inner" />
            </button>

            {/* Camera Switch / Flip Facing Button */}
            <button
              onClick={toggleFacingMode}
              type="button"
              aria-label="Switch camera"
              disabled={isStaticShowcase}
              className="w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

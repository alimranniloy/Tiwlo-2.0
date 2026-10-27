import React from 'react';
import MobileFrame from './MobileFrame';

// Step components
import SelectDocumentStep from '../steps/select-document/SelectDocumentStep';
import UploadDocumentStep from '../steps/upload-document/UploadDocumentStep';
import CaptureSelfieStep from '../steps/capture-selfie/CaptureSelfieStep';
import ProcessingStep from '../steps/processing/ProcessingStep';
import VerificationSuccessStep from '../steps/verification-success/VerificationSuccessStep';
import VerificationFailedStep from '../steps/verification-failed/VerificationFailedStep';

/**
 * 6-Screen Side-by-Side Showcase Board
 * Exactly reproduces the entire reference image layout with all 6 mobile screens
 * and their step descriptions at the bottom.
 */
export default function VerificationShowcase({ onSelectStep = null }) {
  const steps = [
    {
      num: 1,
      name: 'Select Document',
      desc: 'Choose between Passport, National ID or Aadhaar.',
      component: <SelectDocumentStep onNext={() => onSelectStep && onSelectStep(2)} />,
    },
    {
      num: 2,
      name: 'Upload Document',
      desc: 'Provide a clear photo or scan of your government-issued document.',
      component: <UploadDocumentStep onNext={() => onSelectStep && onSelectStep(3)} onBack={() => onSelectStep && onSelectStep(1)} />,
    },
    {
      num: 3,
      name: 'Capture Selfie',
      desc: 'Take a clear selfie using your camera.',
      component: <CaptureSelfieStep isStaticShowcase onNext={() => onSelectStep && onSelectStep(4)} onBack={() => onSelectStep && onSelectStep(2)} />,
    },
    {
      num: 4,
      name: 'Processing',
      desc: 'Please wait while we verify your information.',
      component: <ProcessingStep isStaticShowcase={true} onNext={() => onSelectStep && onSelectStep(5)} />,
    },
    {
      num: 5,
      name: 'Success / Failure',
      desc: "You'll see the result after verification is complete.",
      isDual: true,
      componentSuccess: <VerificationSuccessStep onContinue={() => onSelectStep && onSelectStep(1)} />,
      componentFailed: <VerificationFailedStep onTryAgain={() => onSelectStep && onSelectStep(1)} />,
    },
  ];

  return (
    <div className="w-full min-h-screen bg-[#F0F5FA] py-10 px-4 md:px-8 select-none flex flex-col items-center">
      {/* Outer rounded card container matching the mockup backdrop */}
      <div className="w-full max-w-[1580px] bg-white/70 backdrop-blur-xl rounded-[40px] border border-blue-100/80 p-6 md:p-10 shadow-2xl shadow-blue-500/5">
        {/* Horizontal scrollable track for the screens */}
        <div className="flex flex-nowrap items-start justify-start xl:justify-center space-x-6 md:space-x-8 overflow-x-auto pb-6 pt-2 scrollbar-thin">
          {steps.map((step) => {
            if (step.isDual) {
              return (
                <div key={step.num} className="flex flex-col items-center shrink-0 space-y-4">
                  {/* Two screens vertically stacked or side-by-side for step 5 (Success and Failure) */}
                  <div className="flex flex-col space-y-6">
                    {/* Screen 5: Success */}
                    <div className="w-[280px] sm:w-[300px]">
                      <MobileFrame
                        showHomeIndicator={true}
                        className="w-full !max-w-none !min-h-[580px] !max-h-[600px] !rounded-[32px] !border-slate-200/90 shadow-lg text-[13px]"
                      >
                        {step.componentSuccess}
                      </MobileFrame>
                    </div>

                    {/* Screen 6: Failure */}
                    <div className="w-[280px] sm:w-[300px]">
                      <MobileFrame
                        showHomeIndicator={true}
                        className="w-full !max-w-none !min-h-[580px] !max-h-[600px] !rounded-[32px] !border-slate-200/90 shadow-lg text-[13px]"
                      >
                        {step.componentFailed}
                      </MobileFrame>
                    </div>
                  </div>

                  {/* Step 5 Number and Label below */}
                  <div className="flex flex-col items-center text-center max-w-[240px] pt-4">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center mb-2 shadow-xs">
                      {step.num}
                    </div>
                    <h4 className="text-[16px] font-bold text-slate-900 tracking-tight">
                      {step.name}
                    </h4>
                    <p className="text-[12.5px] text-slate-500 font-normal mt-1 leading-snug">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div key={step.num} className="flex flex-col items-center shrink-0 space-y-4">
                {/* Single Screen */}
                <div className="w-[280px] sm:w-[300px]">
                  <MobileFrame
                    showHomeIndicator={true}
                    className="w-full !max-w-none !min-h-[720px] !max-h-[760px] !rounded-[32px] !border-slate-200/90 shadow-lg text-[13px]"
                  >
                    {step.component}
                  </MobileFrame>
                </div>

                {/* Step Number and Label below */}
                <div className="flex flex-col items-center text-center max-w-[240px] pt-4">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center mb-2 shadow-xs">
                    {step.num}
                  </div>
                  <h4 className="text-[16px] font-bold text-slate-900 tracking-tight">
                    {step.name}
                  </h4>
                  <p className="text-[12.5px] text-slate-500 font-normal mt-1 leading-snug">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

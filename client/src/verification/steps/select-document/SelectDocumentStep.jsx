import React from 'react';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { useVerification } from '../../context/VerificationContext';
import VerificationHeader from '../../components/VerificationHeader';
import StepIndicator from '../../components/StepIndicator';
import { PassportIcon, NationalIdIcon, AadhaarIcon } from '../../components/DocumentIllustrations';

/**
 * Step 1: Choose your government document
 * Screen 1 in reference mockup
 */
export default function SelectDocumentStep({ onNext = null, onBack = null }) {
  const { selectedDocument, selectDocumentType, nextStep, prevStep } = useVerification();

  const handleSelect = (docType) => {
    selectDocumentType(docType);
    if (onNext) {
      onNext(docType);
    } else {
      nextStep();
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      prevStep();
    }
  };

  const documents = [
    {
      id: 'passport',
      title: 'Passport',
      subtitle: <>International passport<br />(cover page)</>,
      icon: <PassportIcon className="w-12 h-14" />,
    },
    {
      id: 'national_id',
      title: 'National ID Card',
      subtitle: <>Government-issued<br />national ID card</>,
      icon: <NationalIdIcon className="w-13 h-10" />,
    },
    {
      id: 'aadhaar',
      title: 'Aadhaar Card',
      subtitle: <>Indian Aadhaar card<br />(front and back)</>,
      icon: <AadhaarIcon className="w-13 h-10" />,
    },
  ];

  return (
    <div className="flex-1 flex flex-col justify-between px-6 pb-6 pt-1 select-none">
      {/* Top Header & Step Indicator */}
      <div>
        <VerificationHeader
          title="Identity Verification"
          showBack={true}
          onBack={handleBack}
        />
        <StepIndicator currentStep={1} totalSteps={5} />

        {/* Heading & Subtitle */}
        <div className="mt-5 mb-6">
          <h2 className="text-[26px] font-bold text-slate-900 tracking-tight leading-[1.25]">
            Choose your <br />
            government document
          </h2>
          <p className="text-[14px] text-slate-500 font-normal mt-2.5 leading-relaxed">
            Choose the document image whose portrait you want to compare with your selfie.
          </p>
        </div>

        {/* Document Selection Cards */}
        <div className="space-y-3.5">
          {documents.map((doc) => {
            const isSelected = selectedDocument === doc.id;
            return (
              <button
                key={doc.id}
                onClick={() => handleSelect(doc.id)}
                type="button"
                className={`w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/40 shadow-sm ring-1 ring-blue-500/30'
                    : 'border-slate-200/90 bg-white hover:border-blue-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center space-x-4">
                  {/* Document Illustration Badge */}
                  <div className="w-14 h-12 flex items-center justify-center shrink-0">
                    {doc.icon}
                  </div>

                  {/* Title & Description */}
                  <div className="min-w-0 pr-2">
                    <h3 className="text-[16px] font-semibold text-slate-900 leading-snug">
                      {doc.title}
                    </h3>
                    <p className="text-[13px] text-slate-500 font-normal mt-0.5 leading-tight">
                      {doc.subtitle}
                    </p>
                  </div>
                </div>

                {/* Right Arrow Chevron */}
                <div className="shrink-0 text-slate-400 pl-2">
                  <ChevronRight className="w-5 h-5 text-slate-400" strokeWidth={2.2} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Security Assurance Note */}
      <div className="mt-8 pt-2">
        <div className="flex items-start space-x-3 px-1 py-1">
          <div className="mt-0.5 shrink-0 text-slate-400">
            <ShieldCheck className="w-5 h-5 text-slate-400" strokeWidth={1.8} />
          </div>
          <p className="text-[12px] text-slate-500 leading-relaxed font-normal">
            Only a face match is checked; document authenticity is not verified.
          </p>
        </div>
      </div>
    </div>
  );
}

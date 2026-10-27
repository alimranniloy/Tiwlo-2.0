import React from 'react';

/**
 * 5-Step Stepper bar matching reference design
 * Displays animated blue capsule for active step and soft gray pills for other steps
 */
export default function StepIndicator({ currentStep = 1, totalSteps = 5, className = "" }) {
  const activeIndex = Math.min(Math.max(currentStep, 1), totalSteps);

  return (
    <div className={`w-full flex items-center justify-center space-x-1.5 py-2 ${className}`}>
      {Array.from({ length: totalSteps }).map((_, index) => {
        const stepNum = index + 1;
        const isActive = stepNum === activeIndex;

        return (
          <div
            key={stepNum}
            className={`transition-all duration-300 ease-out ${
              isActive
                ? 'w-6 h-1 bg-blue-600 rounded-full'
                : 'w-1.5 h-1.5 bg-slate-200 rounded-full'
            }`}
          />
        );
      })}
    </div>
  );
}

import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function CloudFeatureUnavailable({ title, description }) {
  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <h1 className="text-lg font-bold">{title}</h1>
          <p className="mt-2 text-sm leading-6">{description}</p>
          <p className="mt-3 text-xs font-semibold">
            This feature is unavailable until a cloud provider API is connected. No resource has been created or changed.
          </p>
        </div>
      </div>
    </section>
  );
}

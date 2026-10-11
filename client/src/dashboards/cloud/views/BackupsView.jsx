import React from 'react';
import CloudFeatureUnavailable from '../components/CloudFeatureUnavailable';

export default function BackupsView() {
  return (
    <CloudFeatureUnavailable
      title="Cloud backups are unavailable"
      description="Tiwlo does not currently have a connected backup provider or backup scheduling API. There are no recovery points available, and no droplets are protected by this dashboard."
    />
  );
}

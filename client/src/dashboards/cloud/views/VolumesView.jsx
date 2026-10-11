import React from 'react';
import CloudFeatureUnavailable from '../components/CloudFeatureUnavailable';

export default function VolumesView() {
  return (
    <CloudFeatureUnavailable
      title="Block storage volumes are unavailable"
      description="There is no volume provisioning API connected to this account. This page cannot create, attach, or delete storage volumes."
    />
  );
}

import React from 'react';
import CloudFeatureUnavailable from '../components/CloudFeatureUnavailable';

export default function SnapshotsView() {
  return (
    <CloudFeatureUnavailable
      title="Droplet snapshots are unavailable"
      description="There is no snapshot API connected to this account. This page cannot create, restore, or delete snapshots."
    />
  );
}

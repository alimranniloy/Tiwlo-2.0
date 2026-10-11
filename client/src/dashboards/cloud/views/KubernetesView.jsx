import React from 'react';
import CloudFeatureUnavailable from '../components/CloudFeatureUnavailable';

export default function KubernetesView() {
  return (
    <CloudFeatureUnavailable
      title="Managed Kubernetes is unavailable"
      description="There is no Kubernetes provider API connected to this account. Clusters cannot be created or managed, and kubeconfig files are not available."
    />
  );
}

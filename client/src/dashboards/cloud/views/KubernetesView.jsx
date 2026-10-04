import React, { useState } from 'react';
import {
  Boxes,
  Plus,
  Server,
  Download,
  CheckCircle2,
  Activity,
  Layers,
  Cpu,
  HardDrive,
  RefreshCw,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

export default function KubernetesView({ showToast }) {
  const [clusters, setClusters] = useState([
    {
      id: 'k8s-prod-cluster-01',
      name: 'tiwlo-core-prod-k8s',
      version: 'v1.30.2 (HA Control Plane)',
      region: 'Frankfurt (FRA1)',
      nodes: 3,
      nodeType: '4 vCPU • 8 GB RAM • 160 GB NVMe',
      status: 'Healthy',
      endpoint: 'https://k8s-fra1.tiwlo.internal:6443',
      created: 'Sep 15, 2026'
    }
  ]);

  const handleDownloadKubeconfig = (clusterName) => {
    showToast?.(`Kubeconfig downloaded for cluster: ${clusterName}`);
  };

  const handleCreateCluster = () => {
    showToast?.('Tiwlo Kubernetes cluster provisioning wizard ready.');
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(60,64,67,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Tiwlo Managed Kubernetes (TMK)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Production-ready Kubernetes with zero-cost managed HA control planes and automated node self-healing.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreateCluster}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition shadow-xs cursor-pointer w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>Create K8s Cluster</span>
        </button>
      </div>

      {/* Cluster Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(60,64,67,0.08)]">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Active Clusters</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{clusters.length}</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">Free HA Master Control Plane</div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(60,64,67,0.08)]">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Worker Nodes</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">3 Nodes</div>
          <div className="text-[11px] text-slate-400 mt-1">Auto-scaler enabled</div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(60,64,67,0.08)]">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Total Pods</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">24 Running</div>
          <div className="text-[11px] text-slate-400 mt-1">100% capacity healthy</div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(60,64,67,0.08)]">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">K8s Version</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">v1.30.2</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">Up to date</div>
        </div>
      </div>

      {/* Cluster Card */}
      <div className="space-y-4">
        {clusters.map(cluster => (
          <div
            key={cluster.id}
            className="p-6 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 shadow-[0_1px_3px_rgba(60,64,67,0.08)] space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-gray-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{cluster.name}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{cluster.status}</span>
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {cluster.endpoint}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDownloadKubeconfig(cluster.name)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer border border-slate-200 dark:border-gray-700 w-fit"
              >
                <Download className="w-4 h-4" />
                <span>Download Kubeconfig</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50/50 dark:bg-gray-800/40 border border-slate-100 dark:border-gray-800">
                <div className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-blue-600" />
                  <span>Node Pool Specs</span>
                </div>
                <div className="font-bold text-slate-900 dark:text-white">{cluster.nodes} Nodes</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{cluster.nodeType}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/50 dark:bg-gray-800/40 border border-slate-100 dark:border-gray-800">
                <div className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Region & Network</span>
                </div>
                <div className="font-bold text-slate-900 dark:text-white">{cluster.region}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">VPC Network Isolated</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/50 dark:bg-gray-800/40 border border-slate-100 dark:border-gray-800">
                <div className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Security & Ingress</span>
                </div>
                <div className="font-bold text-slate-900 dark:text-white">Cilium CNI Active</div>
                <div className="text-[11px] text-slate-500 mt-0.5">TLS 1.3 Endpoints</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

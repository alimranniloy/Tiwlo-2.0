import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Search,
  Filter,
  RotateCw,
  Activity,
  Layers
} from 'lucide-react';
import { WorkspaceAPI } from '../../api/workspaceApi';

export default function WorkspaceOperationsView({ onBack, onNavigate }) {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadOps = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const ops = await WorkspaceAPI.getWorkspaceOperations();
      setOperations(ops);
    } catch (err) {
      console.warn('Failed to load workspace operations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOps();
  }, []);

  const filtered = operations.filter((op) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (op.operation || op.action || '').toLowerCase().includes(q) ||
      (op.serviceName || op.targetService || '').toLowerCase().includes(q) ||
      (op.result || op.status || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 font-sans">
      {/* 1. Google Cloud Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#DADCE0] pb-4">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#1A73E8] hover:text-[#174EA6] cursor-pointer mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Workspace</span>
            <span className="text-[#BDC1C6]">/</span>
            <span className="text-[#5F6368]">Audit logs</span>
          </button>

          <h1 className="text-xl sm:text-2xl font-normal text-[#202124] tracking-tight">
            Workspace Operations & Audit Logs
          </h1>
          <p className="text-xs sm:text-sm text-[#5F6368] mt-1">
            Real-time immutable audit stream of automated lifecycle events, service deployments, and mutations.
          </p>
        </div>

        <button
          onClick={() => loadOps(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#1A73E8] bg-white border border-[#DADCE0] hover:bg-[#F8F9FA] rounded-md transition-colors cursor-pointer disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 2. Google Cloud Table Filter Container */}
      <div className="bg-white border border-[#DADCE0] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#DADCE0] px-4 py-2.5 bg-[#FFFFFF]">
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <Filter className="w-4 h-4 text-[#5F6368] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter logs by operation, service, or status..."
              className="w-full text-[13px] text-[#202124] placeholder-[#5F6368] bg-transparent focus:outline-none"
            />
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-[12px] text-[#1A73E8] hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-[#DADCE0] bg-[#F8F9FA] text-[11px] font-medium text-[#5F6368] uppercase tracking-wider">
                <th className="py-3 px-4">Operation Event</th>
                <th className="py-3 px-4">Service Resource</th>
                <th className="py-3 px-4">Result</th>
                <th className="py-3 px-4 text-right pr-6">Recorded Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED]">
              {loading ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-[#5F6368]">
                    <RotateCw className="w-5 h-5 text-[#1A73E8] animate-spin mx-auto mb-2" />
                    <span>Loading audit records...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-[#5F6368]">
                    <Activity className="w-8 h-8 text-[#BDC1C6] mx-auto mb-2" />
                    <p className="font-medium text-[#202124]">No audit operations found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((op) => (
                  <tr key={op.id} className="hover:bg-[#F8F9FA] transition-colors">
                    <td className="py-3.5 px-4 font-medium text-[#202124]">
                      {op.operation || op.action}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-[#1A73E8]">{op.serviceName || op.targetService}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#137333] bg-[#E6F4EA] border border-[#CEEAD6] px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 fill-[#137333] text-white" />
                        <span>{op.result || op.status || 'Success'}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#5F6368] text-[12px] font-mono text-right pr-6">
                      {op.timeAgo || op.timestamp || 'Just now'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

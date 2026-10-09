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
    <div className="max-w-5xl mx-auto space-y-6 pb-16 font-sans bg-white">
      {/* 1. Modern Google Material 3 Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E0E2EC] pb-5">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#0B57D0] hover:text-[#0842A0] cursor-pointer mb-2.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Workspace</span>
            <span className="text-[#C4C7C5]">/</span>
            <span className="text-[#444746]">Audit logs</span>
          </button>

          <h1 className="text-xl sm:text-2xl font-normal text-[#1F1F1F] tracking-tight">
            Workspace Operations & Audit Logs
          </h1>
          <p className="text-xs sm:text-sm text-[#444746] mt-1">
            Real-time immutable audit stream of automated lifecycle events, service deployments, and mutations.
          </p>
        </div>

        <button
          onClick={() => loadOps(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-[#0B57D0] bg-white border border-[#747775]/30 hover:bg-[#F0F4F9] rounded-full transition-colors cursor-pointer disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 2. Google Material 3 Table Container */}
      <div className="bg-white border border-[#E0E2EC] rounded-2xl overflow-hidden shadow-none">
        <div className="flex items-center justify-between border-b border-[#E0E2EC] px-5 py-3 bg-[#FFFFFF]">
          <div className="flex items-center gap-2.5 flex-1 max-w-lg bg-[#F0F4F9] rounded-full px-4 py-2 border border-transparent focus-within:bg-white focus-within:border-[#0B57D0] transition-all">
            <Search className="w-4 h-4 text-[#747775] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter logs by operation, service, or status..."
              className="w-full text-[13px] text-[#1F1F1F] placeholder-[#747775] bg-transparent focus:outline-none"
            />
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-[12px] text-[#0B57D0] hover:underline cursor-pointer ml-3 font-medium"
            >
              Clear
            </button>
          )}
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-[#E0E2EC] bg-[#F0F4F9]/60 text-[11px] font-medium text-[#747775] uppercase tracking-wider">
                <th className="py-3 px-5">Operation Event</th>
                <th className="py-3 px-5">Service Resource</th>
                <th className="py-3 px-5">Result</th>
                <th className="py-3 px-5 text-right pr-6">Recorded Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E2EC]/60">
              {loading ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-[#747775]">
                    <RotateCw className="w-5 h-5 text-[#0B57D0] animate-spin mx-auto mb-2" />
                    <span>Loading audit records...</span>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-[#747775]">
                    <Activity className="w-8 h-8 text-[#C4C7C5] mx-auto mb-2" />
                    <p className="font-medium text-[#1F1F1F]">No audit operations found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((op) => (
                  <tr key={op.id} className="hover:bg-[#F0F4F9]/40 transition-colors">
                    <td className="py-3.5 px-5 font-medium text-[#1F1F1F]">
                      {op.operation || op.action}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="font-medium text-[#0B57D0]">{op.serviceName || op.targetService}</span>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#072711] bg-[#C4EED0] px-3 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#137333]" />
                        <span>{op.result || op.status || 'Success'}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-[#747775] text-[12px] font-mono text-right pr-6">
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

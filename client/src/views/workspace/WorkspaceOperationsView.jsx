import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Search
} from 'lucide-react';
import { WorkspaceAPI } from '../../api/workspaceApi';

export default function WorkspaceOperationsView({ onBack, onNavigate }) {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const ops = await WorkspaceAPI.getWorkspaceOperations();
        setOperations(ops);
      } catch (err) {
        console.warn('Failed to load workspace operations:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = operations.filter((op) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      op.operation.toLowerCase().includes(q) ||
      op.serviceName.toLowerCase().includes(q) ||
      (op.result || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-4xl mx-auto space-y-7 pb-16">
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Workspace</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
            Workspace Operations Log
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Complete audit record of automated events, activations, and server link operations.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter operations by service or event name..."
          className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-11 pr-4 py-2.5 text-sm text-[#0F172A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
        />
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#FAFAFA] text-xs font-semibold text-gray-500">
                <th className="py-3 px-6 font-semibold">Operation Event</th>
                <th className="py-3 px-6 font-semibold">Service Involved</th>
                <th className="py-3 px-6 font-semibold">Result</th>
                <th className="py-3 px-6 font-semibold">Logged Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filtered.map((op) => (
                <tr key={op.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="py-3.5 px-6 font-medium text-[#0F172A]">
                    {op.operation}
                  </td>
                  <td className="py-3.5 px-6">
                    <span className="font-semibold text-blue-600">{op.serviceName}</span>
                  </td>
                  <td className="py-3.5 px-6">
                    <div className="flex items-center gap-1.5 font-medium text-xs text-[#0F172A]">
                      <CheckCircle2 className="w-3.5 h-3.5 fill-[#16A34A] text-white" />
                      <span>{op.result || 'Completed'}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-6 text-gray-500 text-xs">
                    {op.timeAgo || 'Recent'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

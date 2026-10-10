import React, { useEffect, useState } from 'react';
import { ArrowLeft, CreditCard, Plus, RotateCw } from 'lucide-react';
import { WorkspaceAPI } from '../../api/workspaceApi';

export default function WorkspaceBillingView({ onBack, onNavigate }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    WorkspaceAPI.getWorkspace()
      .then((workspace) => setServices(workspace.services || []))
      .catch((err) => setError(err.message || 'Could not load activated services.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 font-sans bg-white">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E0E2EC] pb-5">
        <div>
          <button onClick={onBack} className="inline-flex items-center gap-2 text-[13px] font-medium text-[#0B57D0] hover:text-[#0842A0] cursor-pointer mb-2.5">
            <ArrowLeft className="w-4 h-4" />
            <span>Workspace</span><span className="text-[#C4C7C5]">/</span><span className="text-[#444746]">Billing</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-normal text-[#1F1F1F] tracking-tight">Workspace Billing</h1>
          <p className="text-xs sm:text-sm text-[#444746] mt-1">Billing provider and payment details are not connected.</p>
        </div>
        <button onClick={() => onNavigate?.('workspace/activate')} className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-medium text-white bg-[#0B57D0] hover:bg-[#0842A0] rounded-full transition-colors cursor-pointer">
          <Plus className="w-4 h-4" /><span>Browse Marketplace</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E0E2EC] rounded-2xl p-5">
          <div className="text-[12px] font-medium text-[#747775]">Payment provider</div>
          <div className="text-base font-medium text-[#1F1F1F] mt-2 flex items-center gap-2"><CreditCard className="w-4 h-4 text-[#747775]" />Not connected</div>
          <p className="text-[12px] text-[#747775] mt-1">No payment method or invoice data is available.</p>
        </div>
        <div className="bg-white border border-[#E0E2EC] rounded-2xl p-5">
          <div className="text-[12px] font-medium text-[#747775]">Activated Marketplace services</div>
          <div className="text-2xl font-normal text-[#1F1F1F] mt-1.5">{services.length}</div>
          <p className="text-[12px] text-[#747775] mt-1">Count from this account's Workspace records.</p>
        </div>
      </div>

      <div className="bg-white border border-[#E0E2EC] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E0E2EC]">
          <h2 className="text-[15px] font-medium text-[#1F1F1F]">Activated Marketplace Services</h2>
        </div>
        {error ? (
          <p className="p-8 text-center text-sm text-[#B3261E]">{error}</p>
        ) : loading ? (
          <div className="p-8 text-center text-sm text-[#747775]"><RotateCw className="w-5 h-5 animate-spin mx-auto mb-2" />Loading services...</div>
        ) : services.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#747775]">No Marketplace services have been activated.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] border-collapse min-w-[640px]">
              <thead><tr className="bg-[#F0F4F9]/60 border-b border-[#E0E2EC] text-[11px] font-medium text-[#747775] uppercase tracking-wider">
                <th className="py-3 px-6">Product</th><th className="py-3 px-6">Server</th><th className="py-3 px-6">Plan</th><th className="py-3 px-6">Billing status</th>
              </tr></thead>
              <tbody className="divide-y divide-[#E0E2EC]/60">{services.map((service) => (
                <tr key={service.id}>
                  <td className="py-3.5 px-6 font-medium text-[#1F1F1F]">{service.name}</td>
                  <td className="py-3.5 px-6 text-[#444746]">{service.serverName || '—'}</td>
                  <td className="py-3.5 px-6 text-[#444746]">{service.plan || '—'}</td>
                  <td className="py-3.5 px-6 text-[#747775]">Unavailable</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

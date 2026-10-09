import React from 'react';
import {
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  Calendar,
  Shield,
  Zap,
  ArrowRight
} from 'lucide-react';

export default function WorkspaceBillingView({ onBack, onNavigate }) {
  const billingItems = [
    { name: 'TicketFlow Pro', server: 'Creative Hub', amount: '$5.00/mo', renewal: 'Nov 1, 2026', status: 'Active' },
    { name: 'Insight Growth', server: 'Design Collective', amount: '$8.00/mo', renewal: 'Nov 1, 2026', status: 'Active' },
    { name: 'EventKit Starter', server: 'Gaming Lounge', amount: '$4.00/mo', renewal: 'Nov 1, 2026', status: 'Active' },
    { name: 'Sentinel Standard', server: 'Creative Hub', amount: '$0.00/mo', renewal: 'Free Forever', status: 'Active' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Workspace</span>
        </button>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
          Workspace Billing & Subscriptions
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Review active service tiers, renewal dates, and payment history.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Monthly Cost
          </div>
          <div className="text-2xl font-extrabold text-[#0F172A] mt-2">$17.00</div>
          <div className="text-xs text-emerald-600 font-semibold mt-1">All services active</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Next Renewal Date
          </div>
          <div className="text-2xl font-extrabold text-[#0F172A] mt-2">Nov 1, 2026</div>
          <div className="text-xs text-gray-500 mt-1">Auto-renews automatically</div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Default Payment Method
          </div>
          <div className="text-base font-bold text-[#0F172A] mt-2 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-600" />
            <span>•••• 4242</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">Visa (Expires 08/28)</div>
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xs overflow-hidden">
        <div className="p-6 border-b border-[#E2E8F0] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0F172A]">Active Subscriptions</h2>
          <button
            onClick={() => onNavigate?.('workspace/activate')}
            className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] uppercase cursor-pointer"
          >
            + ADD SERVICE
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[600px]">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#E2E8F0] text-xs font-semibold text-gray-500">
                <th className="py-3 px-6">Service</th>
                <th className="py-3 px-6">Server</th>
                <th className="py-3 px-6">Cost</th>
                <th className="py-3 px-6">Renewal</th>
                <th className="py-3 px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {billingItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-[#F8FAFC]">
                  <td className="py-3.5 px-6 font-bold text-[#0F172A]">{item.name}</td>
                  <td className="py-3.5 px-6 text-gray-600">{item.server}</td>
                  <td className="py-3.5 px-6 font-medium text-gray-800">{item.amount}</td>
                  <td className="py-3.5 px-6 text-gray-500 text-xs">{item.renewal}</td>
                  <td className="py-3.5 px-6">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 fill-emerald-600 text-white" />
                      {item.status}
                    </span>
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

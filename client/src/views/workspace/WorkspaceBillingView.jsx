import React from 'react';
import {
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  Calendar,
  Shield,
  Zap,
  ArrowRight,
  Plus
} from 'lucide-react';

export default function WorkspaceBillingView({ onBack, onNavigate }) {
  const billingItems = [
    { name: 'TicketFlow Pro', server: 'Creative Hub', amount: '$5.00/mo', renewal: 'Nov 1, 2026', status: 'Active' },
    { name: 'Insight Growth', server: 'Design Collective', amount: '$8.00/mo', renewal: 'Nov 1, 2026', status: 'Active' },
    { name: 'EventKit Starter', server: 'Gaming Lounge', amount: '$4.00/mo', renewal: 'Nov 1, 2026', status: 'Active' },
    { name: 'Sentinel Standard', server: 'Creative Hub', amount: '$0.00/mo', renewal: 'Free Forever', status: 'Active' },
  ];

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
            <span className="text-[#444746]">Billing</span>
          </button>

          <h1 className="text-xl sm:text-2xl font-normal text-[#1F1F1F] tracking-tight">
            Workspace Billing & Cost Management
          </h1>
          <p className="text-xs sm:text-sm text-[#444746] mt-1">
            Review subscription charges, renewal cycles, and invoice line items.
          </p>
        </div>

        <button
          onClick={() => onNavigate?.('workspace/activate')}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-medium text-white bg-[#0B57D0] hover:bg-[#0842A0] rounded-full transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add service</span>
        </button>
      </div>

      {/* 2. Modern Google KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E0E2EC] rounded-2xl p-5 shadow-none hover:border-[#C4C7C5] transition-all">
          <div className="text-[12px] font-medium text-[#747775]">
            Total Monthly Spend
          </div>
          <div className="text-2xl font-normal text-[#1F1F1F] mt-1.5">$17.00</div>
          <div className="text-[12px] text-[#137333] font-medium mt-1">4 active services provisioned</div>
        </div>

        <div className="bg-white border border-[#E0E2EC] rounded-2xl p-5 shadow-none hover:border-[#C4C7C5] transition-all">
          <div className="text-[12px] font-medium text-[#747775]">
            Upcoming Invoice Date
          </div>
          <div className="text-2xl font-normal text-[#1F1F1F] mt-1.5">Nov 1, 2026</div>
          <div className="text-[12px] text-[#747775] mt-1">Standard auto-debit cycle</div>
        </div>

        <div className="bg-white border border-[#E0E2EC] rounded-2xl p-5 shadow-none hover:border-[#C4C7C5] transition-all">
          <div className="text-[12px] font-medium text-[#747775]">
            Default Billing Method
          </div>
          <div className="text-base font-medium text-[#1F1F1F] mt-2 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#0B57D0]" />
            <span>•••• 4242</span>
          </div>
          <div className="text-[12px] text-[#747775] mt-1">Visa Corporate (Expires 08/28)</div>
        </div>
      </div>

      {/* 3. Modern Google Subscriptions Table */}
      <div className="bg-white border border-[#E0E2EC] rounded-2xl overflow-hidden shadow-none">
        <div className="px-6 py-4 border-b border-[#E0E2EC] bg-[#FFFFFF] flex items-center justify-between">
          <h2 className="text-[15px] font-medium text-[#1F1F1F]">Active Subscription Sub-accounts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-[#F0F4F9]/60 border-b border-[#E0E2EC] text-[11px] font-medium text-[#747775] uppercase tracking-wider">
                <th className="py-3 px-6">Service Resource</th>
                <th className="py-3 px-6">Target Server</th>
                <th className="py-3 px-6">Rate</th>
                <th className="py-3 px-6">Renewal Cycle</th>
                <th className="py-3 px-6">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E2EC]/60">
              {billingItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-[#F0F4F9]/40 transition-colors">
                  <td className="py-3.5 px-6 font-medium text-[#0B57D0]">{item.name}</td>
                  <td className="py-3.5 px-6 text-[#444746] font-mono text-[12px]">{item.server}</td>
                  <td className="py-3.5 px-6 font-medium text-[#1F1F1F]">{item.amount}</td>
                  <td className="py-3.5 px-6 text-[#747775] text-[12px]">{item.renewal}</td>
                  <td className="py-3.5 px-6">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#072711] bg-[#C4EED0] px-3 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#137333]" />
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

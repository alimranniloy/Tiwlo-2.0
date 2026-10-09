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
            <span className="text-[#5F6368]">Billing</span>
          </button>

          <h1 className="text-xl sm:text-2xl font-normal text-[#202124] tracking-tight">
            Workspace Billing & Cost Management
          </h1>
          <p className="text-xs sm:text-sm text-[#5F6368] mt-1">
            Review subscription charges, renewal cycles, and invoice line items.
          </p>
        </div>

        <button
          onClick={() => onNavigate?.('workspace/activate')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium text-white bg-[#1A73E8] hover:bg-[#174EA6] rounded-md transition-colors shadow-2xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add service</span>
        </button>
      </div>

      {/* 2. Google Cloud KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#DADCE0] rounded-lg p-5">
          <div className="text-[12px] font-medium text-[#5F6368]">
            Total Monthly Spend
          </div>
          <div className="text-2xl font-normal text-[#202124] mt-1.5">$17.00</div>
          <div className="text-[12px] text-[#137333] font-medium mt-1">4 active services provisioned</div>
        </div>

        <div className="bg-white border border-[#DADCE0] rounded-lg p-5">
          <div className="text-[12px] font-medium text-[#5F6368]">
            Upcoming Invoice Date
          </div>
          <div className="text-2xl font-normal text-[#202124] mt-1.5">Nov 1, 2026</div>
          <div className="text-[12px] text-[#5F6368] mt-1">Standard auto-debit cycle</div>
        </div>

        <div className="bg-white border border-[#DADCE0] rounded-lg p-5">
          <div className="text-[12px] font-medium text-[#5F6368]">
            Default Billing Method
          </div>
          <div className="text-base font-medium text-[#202124] mt-2 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#1A73E8]" />
            <span>•••• 4242</span>
          </div>
          <div className="text-[12px] text-[#5F6368] mt-1">Visa Corporate (Expires 08/28)</div>
        </div>
      </div>

      {/* 3. Google Cloud Subscriptions Table */}
      <div className="bg-white border border-[#DADCE0] rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-[#DADCE0] bg-[#F8F9FA] flex items-center justify-between">
          <h2 className="text-[14px] font-medium text-[#202124]">Active Subscription Sub-accounts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-[#DADCE0] text-[11px] font-medium text-[#5F6368] uppercase tracking-wider">
                <th className="py-3 px-5">Service Resource</th>
                <th className="py-3 px-5">Target Server</th>
                <th className="py-3 px-5">Rate</th>
                <th className="py-3 px-5">Renewal Cycle</th>
                <th className="py-3 px-5">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED]">
              {billingItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-[#F8F9FA] transition-colors">
                  <td className="py-3.5 px-5 font-medium text-[#1A73E8]">{item.name}</td>
                  <td className="py-3.5 px-5 text-[#3C4043] font-mono text-[12px]">{item.server}</td>
                  <td className="py-3.5 px-5 font-medium text-[#202124]">{item.amount}</td>
                  <td className="py-3.5 px-5 text-[#5F6368] text-[12px]">{item.renewal}</td>
                  <td className="py-3.5 px-5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#137333] bg-[#E6F4EA] border border-[#CEEAD6] px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 fill-[#137333] text-white" />
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

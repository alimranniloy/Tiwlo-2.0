import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Plus,
  RotateCw,
  CreditCard,
  CheckCircle2,
  Filter,
  Search,
  Columns,
  ArrowDown,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Shield,
  MessageSquare,
  BarChart2,
  Calendar,
  Users,
  Settings,
  Zap,
  TrendingUp,
  Layers,
  ArrowRight,
  Check
} from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';

export default function WorkspaceView({ onNavigate }) {
  const [services, setServices] = useState([]);
  const [operations, setOperations] = useState([]);
  const [stats, setStats] = useState({ totalServices: 6, connectedServersCount: 3, allServicesHealthy: true });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [sortOrder, setSortOrder] = useState('asc'); // asc or desc by name
  const [activeMenuId, setActiveMenuId] = useState(null);

  const loadWorkspace = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await DiscordAPI.getWorkspace({ search });
      setServices(data.services || []);
      setOperations(data.operations || []);
      setStats({
        totalServices: data.totalServices || (data.services || []).length,
        connectedServersCount: data.connectedServersCount || 3,
        allServicesHealthy: data.allServicesHealthy !== false
      });
    } catch (err) {
      console.warn('Could not load workspace data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadWorkspace();
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(services.map((s) => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSortToggle = () => {
    const nextOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(nextOrder);
    setServices((prev) =>
      [...prev].sort((a, b) => {
        return nextOrder === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      })
    );
  };

  // Render product/service icon based on type
  const renderServiceIcon = (iconType) => {
    switch (iconType) {
      case 'shield':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#0F2D6B] text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Shield className="w-5 h-5 stroke-[2]" />
          </div>
        );
      case 'ticket':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#0D9488] text-white flex items-center justify-center shrink-0 shadow-2xs">
            <MessageSquare className="w-5 h-5 stroke-[2]" />
          </div>
        );
      case 'chart':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#7C3AED] text-white flex items-center justify-center shrink-0 shadow-2xs">
            <BarChart2 className="w-5 h-5 stroke-[2]" />
          </div>
        );
      case 'calendar':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Calendar className="w-5 h-5 stroke-[2]" />
          </div>
        );
      case 'users':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#16A34A] text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Users className="w-5 h-5 stroke-[2]" />
          </div>
        );
      case 'settings':
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-[#475569] text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Settings className="w-5 h-5 stroke-[2]" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-16">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Title & Help */}
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
            Workspace
          </h1>
          <button
            type="button"
            title="Workspace overview and activated services information"
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm font-bold tracking-wide">
          {/* + ACTIVATE SERVICE */}
          <button
            onClick={() => onNavigate('/discord/workspace/activate')}
            className="inline-flex items-center gap-1.5 text-[#2563EB] hover:text-[#1D4ED8] transition-colors cursor-pointer uppercase"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>ACTIVATE SERVICE</span>
          </button>

          {/* REFRESH */}
          <button
            onClick={() => loadWorkspace(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 text-[#2563EB] hover:text-[#1D4ED8] transition-colors cursor-pointer uppercase disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 stroke-[2.5] ${refreshing ? 'animate-spin' : ''}`} />
            <span>REFRESH</span>
          </button>

          {/* VIEW BILLING */}
          <button
            onClick={() => onNavigate('/discord/workspace/billing')}
            className="inline-flex items-center gap-1.5 text-[#2563EB] hover:text-[#1D4ED8] transition-colors cursor-pointer uppercase"
          >
            <CreditCard className="w-4 h-4 stroke-[2]" />
            <span>VIEW BILLING</span>
          </button>
        </div>
      </div>

      {/* Subtitle */}
      <p className="text-sm text-gray-500 -mt-4">
        Manage the services activated in your workspace.
      </p>

      {/* 2. Meta Stats Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
        <div className="text-[#334155] font-medium">
          <span>{stats.totalServices} services</span>
          <span className="mx-2 font-bold text-gray-400">·</span>
          <span>{stats.connectedServersCount} connected servers</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#15803D]">
          <CheckCircle2 className="w-4 h-4 fill-[#16A34A] text-white" />
          <span>All services healthy</span>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex items-center bg-white border border-[#E2E8F0] rounded-xl shadow-2xs overflow-hidden"
      >
        {/* Filter Button */}
        <button
          type="button"
          onClick={() => {}}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors border-r border-[#E2E8F0] shrink-0 cursor-pointer"
        >
          <Filter className="w-4 h-4 text-gray-500" />
          <span>Filter</span>
        </button>

        {/* Search Input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name, server, status or plan"
            className="w-full pl-4 pr-10 py-2.5 text-sm text-[#0F172A] placeholder-gray-400 bg-transparent focus:outline-none"
          />
        </div>

        {/* Right Search & Columns Icons */}
        <div className="flex items-center gap-1 pr-3 pl-2 text-gray-400 shrink-0">
          <button
            type="submit"
            className="p-1 hover:text-gray-600 transition-colors cursor-pointer"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="p-1 hover:text-gray-600 transition-colors cursor-pointer"
            aria-label="Toggle columns view"
          >
            <Columns className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* 4. Active Services Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#FAFAFA] text-xs font-semibold text-gray-500">
                <th className="py-3.5 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={services.length > 0 && selectedIds.length === services.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th
                  onClick={handleSortToggle}
                  className="py-3.5 px-4 font-semibold text-gray-600 hover:text-gray-900 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Service name</span>
                    <ArrowDown className={`w-3.5 h-3.5 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                  </div>
                </th>
                <th className="py-3.5 px-4 font-semibold text-gray-600">Status</th>
                <th className="py-3.5 px-4 font-semibold text-gray-600">Connected server</th>
                <th className="py-3.5 px-4 font-semibold text-gray-600">Plan</th>
                <th className="py-3.5 px-4 font-semibold text-gray-600">Usage</th>
                <th className="py-3.5 px-4 font-semibold text-gray-600">Renewal</th>
                <th className="py-3.5 px-4 font-semibold text-gray-600 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {services.map((service) => {
                const isSelected = selectedIds.includes(service.id);
                return (
                  <tr
                    key={service.id}
                    className={`hover:bg-[#F8FAFC] transition-colors ${isSelected ? 'bg-blue-50/30' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="py-4 px-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(service.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>

                    {/* Service Name & Category */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        {renderServiceIcon(service.iconType)}
                        <div>
                          <div className="font-bold text-[#0F172A] leading-tight">
                            {service.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {service.category}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-medium text-xs text-[#0F172A]">
                        <CheckCircle2 className="w-3.5 h-3.5 fill-[#16A34A] text-white" />
                        <span>{service.status || 'Active'}</span>
                      </div>
                    </td>

                    {/* Connected Server */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <button
                        onClick={() => onNavigate(`/discord/servers`)}
                        className="text-[#2563EB] hover:text-[#1D4ED8] hover:underline font-medium text-sm cursor-pointer"
                      >
                        {service.serverName}
                      </button>
                    </td>

                    {/* Plan */}
                    <td className="py-4 px-4 whitespace-nowrap text-gray-700 font-medium">
                      {service.plan}
                    </td>

                    {/* Usage */}
                    <td className="py-4 px-4 whitespace-nowrap text-gray-600">
                      {service.usageLabel || '—'}
                    </td>

                    {/* Renewal */}
                    <td className="py-4 px-4 whitespace-nowrap text-gray-600">
                      {service.renewalDate || '—'}
                    </td>

                    {/* Actions: Manage + ⋮ */}
                    <td className="py-4 px-4 whitespace-nowrap text-right pr-6">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => onNavigate(`/discord/workspace/service/${service.id}`)}
                          className="text-[#2563EB] hover:text-[#1D4ED8] font-bold text-sm hover:underline cursor-pointer"
                        >
                          Manage
                        </button>
                        <div className="relative">
                          <button
                            onClick={() =>
                              setActiveMenuId(activeMenuId === service.id ? null : service.id)
                            }
                            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                            aria-label="Options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {activeMenuId === service.id && (
                            <div className="absolute right-0 mt-1 w-44 bg-white border border-[#E2E8F0] rounded-xl shadow-lg py-1.5 z-20 text-left">
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  onNavigate(`/discord/workspace/service/${service.id}`);
                                }}
                                className="w-full px-3.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                              >
                                <span>Service Settings</span>
                              </button>
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  onNavigate('/discord/workspace/billing');
                                }}
                                className="w-full px-3.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                              >
                                <span>Change Plan</span>
                              </button>
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  onNavigate(`/discord/servers`);
                                }}
                                className="w-full px-3.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                              >
                                <span>Switch Server</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Bar */}
        <div className="flex items-center justify-end gap-5 px-6 py-3.5 border-t border-[#E2E8F0] text-xs font-medium text-gray-500 bg-white">
          <div className="flex items-center gap-1.5">
            <span>Rows per page:</span>
            <span className="font-semibold text-gray-700">10 ▾</span>
          </div>
          <div>
            1–{services.length} of {services.length}
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled
              className="p-1 rounded text-gray-300 disabled:opacity-40 cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled
              className="p-1 rounded text-gray-300 disabled:opacity-40 cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Recent Operations Section */}
      <section className="space-y-3 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#0F172A]">Recent operations</h2>
          <button
            onClick={() => onNavigate('/discord/workspace/operations')}
            className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] uppercase tracking-wider cursor-pointer"
          >
            VIEW ALL
          </button>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#FAFAFA] text-xs font-semibold text-gray-500">
                  <th className="py-3 px-6 font-semibold">Operation</th>
                  <th className="py-3 px-6 font-semibold">Service</th>
                  <th className="py-3 px-6 font-semibold">Result</th>
                  <th className="py-3 px-6 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {operations.map((op) => (
                  <tr key={op.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3.5 px-6 font-medium text-[#0F172A]">
                      {op.operation}
                    </td>
                    <td className="py-3.5 px-6">
                      <button
                        onClick={() => onNavigate(`/discord/marketplace`)}
                        className="text-[#2563EB] hover:text-[#1D4ED8] font-medium hover:underline cursor-pointer"
                      >
                        {op.serviceName}
                      </button>
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
      </section>
    </div>
  );
}

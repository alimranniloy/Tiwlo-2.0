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
  ArrowRight,
  Activity,
  Layers,
  ExternalLink,
  SlidersHorizontal,
  Bot
} from 'lucide-react';
import { WorkspaceAPI } from '../../api/workspaceApi';

export default function WorkspaceView({ onNavigate }) {
  const [services, setServices] = useState([]);
  const [operations, setOperations] = useState([]);
  const [stats, setStats] = useState({ totalServices: 6, connectedServersCount: 3, allServicesHealthy: true });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [sortOrder, setSortOrder] = useState('asc');
  const [activeMenuId, setActiveMenuId] = useState(null);

  const loadWorkspace = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await WorkspaceAPI.getWorkspace({ search });
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

  const renderServiceIcon = (iconType) => {
    switch (iconType) {
      case 'shield':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#E8F0FE] text-[#0B57D0] flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 stroke-[2]" />
          </div>
        );
      case 'ticket':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#C4EED0] text-[#072711] flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5 stroke-[2]" />
          </div>
        );
      case 'chart':
        return (
          <div className="w-10 h-10 rounded-xl bg-[#FEEDAD] text-[#2C1F00] flex items-center justify-center shrink-0">
            <BarChart2 className="w-5 h-5 stroke-[2]" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-[#F0F4F9] text-[#444746] flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 stroke-[2]" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans bg-white">
      {/* 1. Modern Google Workspace Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E0E2EC] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-normal text-[#1F1F1F] tracking-tight">
              Workspace
            </h1>
            <span className="text-xs px-3 py-1 rounded-full bg-[#E8F0FE] text-[#0B57D0] font-medium">
              Enterprise Hub
            </span>
          </div>
          <p className="text-sm text-[#444746] mt-1">
            Centrally manage, monitor, and provision active workspace services, community bots, and extensions.
          </p>
        </div>

        {/* Action Buttons (Modern Google Material 3 Pill Styling) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Primary: ACTIVATE SERVICE */}
          <button
            onClick={() => onNavigate?.('workspace/activate')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white bg-[#0B57D0] hover:bg-[#0842A0] rounded-full transition-all shadow-xs hover:shadow cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Activate service</span>
          </button>

          {/* Secondary: REFRESH */}
          <button
            onClick={() => loadWorkspace(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-[#0B57D0] bg-white border border-[#747775]/30 hover:bg-[#F2F6FC] rounded-full transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Secondary: BILLING */}
          <button
            onClick={() => onNavigate?.('workspace/billing')}
            className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-[#1F1F1F] bg-white border border-[#747775]/30 hover:bg-[#F2F6FC] rounded-full transition-colors cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5 text-[#444746]" />
            <span>Billing</span>
          </button>

          {/* Secondary: AUDIT LOG */}
          <button
            onClick={() => onNavigate?.('workspace/operations')}
            className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-[#1F1F1F] bg-white border border-[#747775]/30 hover:bg-[#F2F6FC] rounded-full transition-colors cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-[#444746]" />
            <span>Audit log</span>
          </button>
        </div>
      </div>

      {/* 2. Modern Google Summary Status Card */}
      <div className="bg-[#F8FAFD] border border-[#E0E2EC] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px]">
        <div className="text-[#444746] flex items-center gap-3">
          <span className="font-semibold text-[#1F1F1F] text-base">{stats.totalServices}</span> active services
          <span className="text-[#C4C7C5]">•</span>
          <span className="font-semibold text-[#1F1F1F] text-base">{stats.connectedServersCount}</span> connected clusters
          <span className="text-[#C4C7C5]">•</span>
          <span>Zero incident reports</span>
        </div>

        <div className="flex items-center gap-2 font-medium text-[12px] text-[#072711] bg-[#C4EED0] px-3.5 py-1.5 rounded-full w-fit">
          <CheckCircle2 className="w-4 h-4 fill-[#072711] text-white" />
          <span>All operational services healthy</span>
        </div>
      </div>

      {/* 3. Modern Google Table Card Container */}
      <div className="bg-white border border-[#E0E2EC] rounded-2xl shadow-xs overflow-hidden">
        {/* Modern Pill Omnibox Filter Toolbar */}
        <form
          onSubmit={handleSearchSubmit}
          className="p-4 bg-white border-b border-[#E0E2EC] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-[#444746] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services by name, cluster, plan or status..."
              className="w-full bg-[#F0F4F9] hover:bg-[#E9EEF6] focus:bg-white border border-transparent focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0] rounded-full pl-11 pr-4 py-2.5 text-[13px] text-[#1F1F1F] placeholder-[#444746] transition-all outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-[#444746] shrink-0">
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); loadWorkspace(); }}
                className="text-[12px] font-medium text-[#0B57D0] hover:underline px-2 py-1 cursor-pointer"
              >
                Clear filter
              </button>
            )}
            <button
              type="button"
              onClick={() => loadWorkspace(true)}
              className="p-2 hover:bg-[#F0F4F9] text-[#444746] hover:text-[#1F1F1F] rounded-full transition-colors cursor-pointer"
              title="Refresh table"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse min-w-[840px]">
            <thead>
              <tr className="border-b border-[#E0E2EC] bg-[#F8FAFD] text-[11px] font-medium text-[#444746] uppercase tracking-wider">
                <th className="py-3.5 px-5 w-12">
                  <input
                    type="checkbox"
                    checked={services.length > 0 && selectedIds.length === services.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-[#C4C7C5] accent-[#0B57D0] cursor-pointer"
                  />
                </th>
                <th
                  onClick={handleSortToggle}
                  className="py-3.5 px-5 font-medium text-[#444746] hover:text-[#1F1F1F] cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Service name</span>
                    <ArrowDown className={`w-3.5 h-3.5 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                  </div>
                </th>
                <th className="py-3.5 px-5 font-medium">Status</th>
                <th className="py-3.5 px-5 font-medium">Cluster / Environment</th>
                <th className="py-3.5 px-5 font-medium">Tier Plan</th>
                <th className="py-3.5 px-5 font-medium">Resource Usage</th>
                <th className="py-3.5 px-5 font-medium">Renewal</th>
                <th className="py-3.5 px-5 font-medium text-right pr-6">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F3F8]">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-[#444746]">
                    <RotateCw className="w-6 h-6 text-[#0B57D0] animate-spin mx-auto mb-3" />
                    <span>Loading workspace services...</span>
                  </td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-[#444746]">
                    <Layers className="w-10 h-10 text-[#C4C7C5] mx-auto mb-3" />
                    <p className="font-medium text-[#1F1F1F] text-base">No services match your search</p>
                    <button
                      onClick={() => { setSearch(''); loadWorkspace(); }}
                      className="mt-3 px-4 py-1.5 rounded-full text-[13px] font-medium text-[#0B57D0] border border-[#747775]/30 hover:bg-[#F2F6FC] transition-colors"
                    >
                      Clear search
                    </button>
                  </td>
                </tr>
              ) : (
                services.map((service) => {
                  const isSelected = selectedIds.includes(service.id);
                  return (
                    <tr
                      key={service.id}
                      className={`hover:bg-[#F8FAFD] transition-colors ${isSelected ? 'bg-[#E8F0FE]/50' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-4 px-5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(service.id)}
                          className="w-4 h-4 rounded border-[#C4C7C5] accent-[#0B57D0] cursor-pointer"
                        />
                      </td>

                      {/* Service Name & Category */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3.5">
                          {renderServiceIcon(service.iconType)}
                          <div>
                            <button
                              onClick={() => onNavigate?.(`workspace/service/${service.id}`)}
                              className="font-medium text-[#0B57D0] hover:underline text-left leading-tight cursor-pointer text-[14px]"
                            >
                              {service.name}
                            </button>
                            <div className="text-[12px] text-[#444746] mt-0.5 capitalize">
                              {service.category || 'Extension Service'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium bg-[#C4EED0] text-[#072711]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#072711]" />
                          <span>{service.status || 'Active'}</span>
                        </span>
                      </td>

                      {/* Cluster */}
                      <td className="py-4 px-5 text-[#1F1F1F] font-mono text-[12px]">
                        {service.connectedServer || 'production-cluster-01'}
                      </td>

                      {/* Plan */}
                      <td className="py-4 px-5">
                        <span className="inline-block px-3 py-1 rounded-full text-[11px] font-medium bg-[#F0F4F9] text-[#1F1F1F]">
                          {service.plan || 'Standard'}
                        </span>
                      </td>

                      {/* Usage */}
                      <td className="py-4 px-5 min-w-[140px]">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px] text-[#444746] font-medium">
                            <span>Capacity</span>
                            <span>{service.usage || '32%'}</span>
                          </div>
                          <div className="w-full bg-[#E0E2EC] rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-[#0B57D0] h-1.5 rounded-full transition-all duration-500"
                              style={{ width: service.usage || '32%' }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Renewal */}
                      <td className="py-4 px-5 text-[#444746] text-[12px] whitespace-nowrap">
                        {service.renewal || 'Monthly • Auto-renews'}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right pr-6 relative">
                        <button
                          onClick={() => setActiveMenuId(activeMenuId === service.id ? null : service.id)}
                          className="p-1.5 rounded-full hover:bg-[#F0F4F9] text-[#444746] hover:text-[#1F1F1F] transition-colors cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Modern Google Menu Dropdown */}
                        {activeMenuId === service.id && (
                          <div className="absolute right-6 top-10 w-48 bg-white border border-[#E0E2EC] rounded-2xl shadow-lg py-2 z-20 text-left text-[13px]">
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                onNavigate?.(`workspace/service/${service.id}`);
                              }}
                              className="w-full px-4 py-2.5 text-[#1F1F1F] hover:bg-[#F0F4F9] transition-colors"
                            >
                              View details
                            </button>
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                onNavigate?.('workspace/billing');
                              }}
                              className="w-full px-4 py-2.5 text-[#1F1F1F] hover:bg-[#F0F4F9] transition-colors"
                            >
                              Manage billing
                            </button>
                            <div className="border-t border-[#E0E2EC] my-1" />
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                onNavigate?.('workspace/operations');
                              }}
                              className="w-full px-4 py-2.5 text-[#1F1F1F] hover:bg-[#F0F4F9] transition-colors"
                            >
                              Audit logs
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-[#E0E2EC] px-6 py-4 bg-white text-[12px] text-[#444746] gap-3">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <span className="font-semibold text-[#1F1F1F]">10</span>
          </div>

          <div className="flex items-center gap-4">
            <span>1-{services.length} of {services.length}</span>
            <div className="flex items-center gap-1">
              <button
                disabled
                className="p-1.5 rounded-full hover:bg-[#F0F4F9] text-[#C4C7C5] disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled
                className="p-1.5 rounded-full hover:bg-[#F0F4F9] text-[#C4C7C5] disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Modern Google Operations Audit Card */}
      <div className="bg-white border border-[#E0E2EC] rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#F1F3F8] pb-4 mb-4">
          <div>
            <h2 className="text-[16px] font-medium text-[#1F1F1F]">
              Recent Lifecycle Operations
            </h2>
            <p className="text-[12px] text-[#444746] mt-0.5">
              Live immutable audit stream of daemon executions and provisioning events.
            </p>
          </div>
          <button
            onClick={() => onNavigate?.('workspace/operations')}
            className="text-[13px] font-medium text-[#0B57D0] hover:underline cursor-pointer"
          >
            View all logs →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-[#E0E2EC] text-[#444746] uppercase text-[11px] font-medium">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Operation</th>
                <th className="py-2.5 px-4">Target Service</th>
                <th className="py-2.5 px-4">Initiator</th>
                <th className="py-2.5 px-4 text-right">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F3F8]">
              {(operations.slice(0, 4)).map((op) => (
                <tr key={op.id} className="hover:bg-[#F8FAFD] transition-colors">
                  <td className="py-3 px-4 text-[#444746] font-mono">{op.timestamp || 'Just now'}</td>
                  <td className="py-3 px-4 font-medium text-[#1F1F1F]">{op.action}</td>
                  <td className="py-3 px-4 text-[#0B57D0] font-medium">{op.targetService}</td>
                  <td className="py-3 px-4 text-[#444746]">{op.user || 'system'}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#C4EED0] text-[#072711]">
                      {op.status || 'Success'}
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

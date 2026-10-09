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

  // Google Cloud styled service icon
  const renderServiceIcon = (iconType) => {
    switch (iconType) {
      case 'shield':
        return (
          <div className="w-8 h-8 rounded-md bg-[#E8F0FE] text-[#1A73E8] border border-[#D2E3FC] flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 stroke-[2]" />
          </div>
        );
      case 'ticket':
        return (
          <div className="w-8 h-8 rounded-md bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6] flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 stroke-[2]" />
          </div>
        );
      case 'chart':
        return (
          <div className="w-8 h-8 rounded-md bg-[#FEF7E0] text-[#B06000] border border-[#FEEFC3] flex items-center justify-center shrink-0">
            <BarChart2 className="w-4 h-4 stroke-[2]" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-md bg-[#F1F3F4] text-[#5F6368] border border-[#DADCE0] flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 stroke-[2]" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* 1. Google Cloud Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#DADCE0] pb-4">
        {/* Title & Description */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-normal text-[#202124] tracking-tight">
              Workspace
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#E8F0FE] text-[#1A73E8] font-medium border border-[#D2E3FC]">
              Enterprise Console
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#5F6368] mt-1">
            Centrally manage, monitor, and provision active workspace services and community extensions.
          </p>
        </div>

        {/* Action Buttons (Google Cloud styling) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Primary: ACTIVATE SERVICE */}
          <button
            onClick={() => onNavigate?.('workspace/activate')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium text-white bg-[#1A73E8] hover:bg-[#174EA6] rounded-md transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Activate service</span>
          </button>

          {/* Secondary: REFRESH */}
          <button
            onClick={() => loadWorkspace(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#1A73E8] bg-white border border-[#DADCE0] hover:bg-[#F8F9FA] rounded-md transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Secondary: BILLING */}
          <button
            onClick={() => onNavigate?.('workspace/billing')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#3C4043] bg-white border border-[#DADCE0] hover:bg-[#F8F9FA] rounded-md transition-colors cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5 text-[#5F6368]" />
            <span>Billing</span>
          </button>

          {/* Secondary: OPERATIONS AUDIT */}
          <button
            onClick={() => onNavigate?.('workspace/operations')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#3C4043] bg-white border border-[#DADCE0] hover:bg-[#F8F9FA] rounded-md transition-colors cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-[#5F6368]" />
            <span>Audit log</span>
          </button>
        </div>
      </div>

      {/* 2. Google Cloud Status & Summary Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-[13px]">
        <div className="text-[#3C4043] flex items-center gap-2">
          <span className="font-medium text-[#202124]">{stats.totalServices}</span> active services
          <span className="text-[#BDC1C6]">•</span>
          <span className="font-medium text-[#202124]">{stats.connectedServersCount}</span> connected environments
        </div>

        <div className="flex items-center gap-1.5 font-medium text-[12px] text-[#137333] bg-[#E6F4EA] border border-[#CEEAD6] px-2.5 py-1 rounded-full w-fit">
          <CheckCircle2 className="w-3.5 h-3.5 fill-[#137333] text-white" />
          <span>All operational services healthy</span>
        </div>
      </div>

      {/* 3. Google Cloud Table Container */}
      <div className="bg-white border border-[#DADCE0] rounded-lg shadow-2xs overflow-hidden">
        {/* Table Filter Toolbar */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center justify-between border-b border-[#DADCE0] px-4 py-2.5 bg-[#FFFFFF]"
        >
          <div className="flex items-center gap-2 flex-1 max-w-xl">
            <Filter className="w-4 h-4 text-[#5F6368] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter table by service name, plan, server or status..."
              className="w-full text-[13px] text-[#202124] placeholder-[#5F6368] bg-transparent focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-[#5F6368] shrink-0">
            <button
              type="submit"
              className="p-1.5 hover:text-[#202124] hover:bg-[#F1F3F4] rounded-full transition-colors cursor-pointer"
              title="Filter"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => loadWorkspace(true)}
              className="p-1.5 hover:text-[#202124] hover:bg-[#F1F3F4] rounded-full transition-colors cursor-pointer"
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
              <tr className="border-b border-[#DADCE0] bg-[#F8F9FA] text-[11px] font-medium text-[#5F6368] uppercase tracking-wider">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={services.length > 0 && selectedIds.length === services.length}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 rounded border-[#DADCE0] accent-[#1A73E8] cursor-pointer"
                  />
                </th>
                <th
                  onClick={handleSortToggle}
                  className="py-3 px-4 font-medium text-[#5F6368] hover:text-[#202124] cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Service name</span>
                    <ArrowDown className={`w-3 h-3 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
                  </div>
                </th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Environment</th>
                <th className="py-3 px-4 font-medium">Plan tier</th>
                <th className="py-3 px-4 font-medium">Capacity usage</th>
                <th className="py-3 px-4 font-medium">Billing renewal</th>
                <th className="py-3 px-4 font-medium text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED]">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-[#5F6368]">
                    <RotateCw className="w-5 h-5 text-[#1A73E8] animate-spin mx-auto mb-2" />
                    <span>Loading workspace services...</span>
                  </td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-[#5F6368]">
                    <Layers className="w-8 h-8 text-[#BDC1C6] mx-auto mb-2" />
                    <p className="font-medium text-[#202124]">No services match your filter</p>
                    <button
                      onClick={() => { setSearch(''); loadWorkspace(); }}
                      className="mt-2 text-[#1A73E8] hover:underline font-medium cursor-pointer"
                    >
                      Reset filter
                    </button>
                  </td>
                </tr>
              ) : (
                services.map((service) => {
                  const isSelected = selectedIds.includes(service.id);
                  return (
                    <tr
                      key={service.id}
                      className={`hover:bg-[#F8F9FA] transition-colors ${isSelected ? 'bg-[#E8F0FE]/40' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(service.id)}
                          className="w-3.5 h-3.5 rounded border-[#DADCE0] accent-[#1A73E8] cursor-pointer"
                        />
                      </td>

                      {/* Service Name & Category */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {renderServiceIcon(service.iconType)}
                          <div>
                            <button
                              onClick={() => onNavigate?.(`workspace/service/${service.id}`)}
                              className="font-medium text-[#1A73E8] hover:underline text-left leading-tight cursor-pointer"
                            >
                              {service.name}
                            </button>
                            <div className="text-[11px] text-[#5F6368] mt-0.5 capitalize">
                              {service.category || 'Service extension'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#137333]" />
                          <span>{service.status || 'Active'}</span>
                        </span>
                      </td>

                      {/* Connected Server */}
                      <td className="py-3.5 px-4 text-[#3C4043] font-mono text-[12px]">
                        {service.connectedServer || 'production-cluster-01'}
                      </td>

                      {/* Plan */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#F1F3F4] text-[#3C4043] border border-[#DADCE0]">
                          {service.plan || 'Standard'}
                        </span>
                      </td>

                      {/* Usage */}
                      <td className="py-3.5 px-4 min-w-[130px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-[#5F6368]">
                            <span>{service.usage || '32%'}</span>
                          </div>
                          <div className="w-full bg-[#E8EAED] rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-[#1A73E8] h-1.5 rounded-full"
                              style={{ width: service.usage || '32%' }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Renewal */}
                      <td className="py-3.5 px-4 text-[#5F6368] text-[12px] whitespace-nowrap">
                        {service.renewal || 'Monthly • Auto-renews'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right pr-6 relative">
                        <button
                          onClick={() => setActiveMenuId(activeMenuId === service.id ? null : service.id)}
                          className="p-1 rounded-full hover:bg-[#F1F3F4] text-[#5F6368] hover:text-[#202124] transition-colors cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Google Cloud action dropdown */}
                        {activeMenuId === service.id && (
                          <div className="absolute right-6 top-10 w-44 bg-white border border-[#DADCE0] rounded-md shadow-lg py-1 z-20 text-left text-[13px]">
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                onNavigate?.(`workspace/service/${service.id}`);
                              }}
                              className="w-full px-4 py-2 text-[#202124] hover:bg-[#F8F9FA] transition-colors"
                            >
                              View details
                            </button>
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                onNavigate?.('workspace/billing');
                              }}
                              className="w-full px-4 py-2 text-[#202124] hover:bg-[#F8F9FA] transition-colors"
                            >
                              Manage billing
                            </button>
                            <div className="border-t border-[#DADCE0] my-1" />
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                onNavigate?.('workspace/operations');
                              }}
                              className="w-full px-4 py-2 text-[#202124] hover:bg-[#F8F9FA] transition-colors"
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

        {/* Table Pagination Footer (Google Cloud style) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-[#DADCE0] px-4 py-3 bg-[#FFFFFF] text-[12px] text-[#5F6368] gap-3">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <span className="font-medium text-[#202124]">10</span>
          </div>

          <div className="flex items-center gap-4">
            <span>1-{services.length} of {services.length}</span>
            <div className="flex items-center gap-1">
              <button
                disabled
                className="p-1 rounded hover:bg-[#F1F3F4] text-[#BDC1C6] disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled
                className="p-1 rounded hover:bg-[#F1F3F4] text-[#BDC1C6] disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Google Cloud Operations Audit Card */}
      <div className="bg-white border border-[#DADCE0] rounded-lg p-5">
        <div className="flex items-center justify-between border-b border-[#F1F3F4] pb-3 mb-4">
          <div>
            <h2 className="text-[15px] font-medium text-[#202124]">
              Recent Workspace Operations
            </h2>
            <p className="text-[12px] text-[#5F6368] mt-0.5">
              Live audit stream of lifecycle operations recorded across services.
            </p>
          </div>
          <button
            onClick={() => onNavigate?.('workspace/operations')}
            className="text-[13px] font-medium text-[#1A73E8] hover:underline cursor-pointer"
          >
            View all logs →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px] border-collapse">
            <thead>
              <tr className="border-b border-[#DADCE0] text-[#5F6368] uppercase text-[11px] font-medium">
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">Operation</th>
                <th className="py-2 px-3">Target Service</th>
                <th className="py-2 px-3">Initiator</th>
                <th className="py-2 px-3 text-right">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F3F4]">
              {(operations.slice(0, 4)).map((op) => (
                <tr key={op.id} className="hover:bg-[#F8F9FA]">
                  <td className="py-2.5 px-3 text-[#5F6368] font-mono">{op.timestamp || 'Just now'}</td>
                  <td className="py-2.5 px-3 font-medium text-[#202124]">{op.action}</td>
                  <td className="py-2.5 px-3 text-[#3C4043]">{op.targetService}</td>
                  <td className="py-2.5 px-3 text-[#5F6368]">{op.user || 'system'}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#E6F4EA] text-[#137333]">
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

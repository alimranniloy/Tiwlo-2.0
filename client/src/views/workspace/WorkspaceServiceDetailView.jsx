import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Server,
  Shield,
  MessageSquare,
  BarChart2,
  Calendar,
  Users,
  Settings,
  AlertTriangle,
  Save,
  Trash2,
  CreditCard,
  Check,
  RotateCw,
  Layers,
  Activity,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { WorkspaceAPI } from '../../api/workspaceApi';

export default function WorkspaceServiceDetailView({ serviceId, onBack, onNavigate }) {
  const [service, setService] = useState(null);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [msg, setMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [serverName, setServerName] = useState('');
  const [serverId, setServerId] = useState('');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [srv, serverList] = await Promise.all([
          WorkspaceAPI.getWorkspaceServiceById(serviceId),
          WorkspaceAPI.getConnectedServers()
        ]);
        if (srv) {
          setService(srv);
          setStatus(srv.status || '');
          setPlan(srv.plan || '');
          setServerName(srv.serverName || '');
          setServerId(srv.serverId || '');
        }
        setServers(serverList || []);
      } catch (err) {
        setMsg({ text: err.message || 'Failed to load service', type: 'error' });
      } finally {
        setLoading(false);
      }
    }
    if (serviceId) fetchData();
  }, [serviceId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const updated = await WorkspaceAPI.updateWorkspaceService(serviceId, {
        status,
        plan,
        serverName,
        serverId
      });
      setService(updated.service || updated);
      setMsg({ text: 'Configuration committed and synchronized across clusters.', type: 'success' });
    } catch (err) {
      setMsg({ text: err.message || 'Failed to update service', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      await WorkspaceAPI.deleteWorkspaceService(serviceId);
      onBack();
    } catch (err) {
      setMsg({ text: err.message || 'Failed to deactivate service', type: 'error' });
      setDeactivating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#E0E2EC] rounded-2xl p-16 text-center max-w-4xl mx-auto shadow-none">
        <RotateCw className="w-6 h-6 text-[#0B57D0] animate-spin mx-auto mb-3" />
        <p className="text-[13px] text-[#444746]">Loading service details...</p>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="bg-white border border-[#E0E2EC] rounded-2xl p-12 text-center max-w-2xl mx-auto space-y-4 shadow-none">
        <AlertTriangle className="w-10 h-10 text-[#B3261E] mx-auto" />
        <h2 className="text-lg font-medium text-[#1F1F1F]">Service Not Found</h2>
        <p className="text-[13px] text-[#444746]">The requested workspace service does not exist.</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0B57D0] hover:bg-[#0842A0] text-white text-[13px] font-medium rounded-full transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Workspace</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 font-sans bg-white">
      {/* 1. Modern Google Header with Material 3 Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E0E2EC] pb-5">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#0B57D0] hover:text-[#0842A0] cursor-pointer mb-2.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Workspace</span>
            <span className="text-[#C4C7C5]">/</span>
            <span className="text-[#444746]">Services</span>
          </button>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-normal text-[#1F1F1F] tracking-tight">{service.name}</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium bg-[#C4EED0] text-[#072711]">
              <span className="w-2 h-2 rounded-full bg-[#137333]" />
              {service.status || 'Status unavailable'}
            </span>
          </div>
          <p className="text-xs text-[#747775] font-mono mt-1">ID: {service.id}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate?.('workspace/billing')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-[#0B57D0] bg-white border border-[#747775]/30 hover:bg-[#F0F4F9] rounded-full transition-colors cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5 text-[#0B57D0]" />
            <span>Plan & billing</span>
          </button>
          <button
            onClick={() => onNavigate?.('workspace/operations')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-[#444746] bg-white border border-[#747775]/30 hover:bg-[#F0F4F9] rounded-full transition-colors cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-[#444746]" />
            <span>Audit log</span>
          </button>
        </div>
      </div>

      {/* 2. Modern Google Material 3 Navigation Pill Tabs */}
      <div className="flex gap-2 text-[13px] pb-1">
        {[
          { id: 'overview', label: 'Overview & Properties' },
          { id: 'configuration', label: 'Configuration' },
          { id: 'danger', label: 'Lifecycle Management' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-full font-medium cursor-pointer transition-colors ${
              activeTab === t.id
                ? 'bg-[#C2E7FF] text-[#001D35]'
                : 'text-[#444746] hover:bg-[#F0F4F9]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 3. Feedback Banner */}
      {msg && (
        <div
          className={`p-4 rounded-2xl border text-[13px] flex items-center gap-2.5 ${
            msg.type === 'error'
              ? 'bg-[#FCE8E6] text-[#B3261E] border-[#F9DEDC]'
              : 'bg-[#C4EED0]/30 text-[#072711] border-[#C4EED0]'
          }`}
        >
          {msg.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#B3261E]" />
          ) : (
            <Check className="w-4 h-4 shrink-0 text-[#137333]" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* 4. Tab: Overview & Properties */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white border border-[#E0E2EC] rounded-2xl p-6 space-y-4 shadow-none">
              <h2 className="text-[15px] font-medium text-[#1F1F1F] border-b border-[#F0F4F9] pb-3">
                Service Properties
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-[13px]">
                <div>
                  <span className="text-[#747775] block text-xs mb-1">Service Type</span>
                  <span className="font-medium text-[#1F1F1F] capitalize">{service.type || service.category || 'General'}</span>
                </div>
                <div>
                  <span className="text-[#747775] block text-xs mb-1">Target Environment</span>
                  <span className="font-medium text-[#1F1F1F] font-mono">{service.serverName || '—'}</span>
                </div>
                <div>
                  <span className="text-[#747775] block text-xs mb-1">Allocated Tier</span>
                  <span className="font-medium text-[#1F1F1F]">{service.plan || '—'}</span>
                </div>
                <div>
                  <span className="text-[#747775] block text-xs mb-1">Current Capacity Utilization</span>
                  <span className="font-medium text-[#1F1F1F]">{service.usageLabel || '—'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#E0E2EC] rounded-2xl p-6 space-y-3 shadow-none">
              <h2 className="text-[15px] font-medium text-[#1F1F1F] border-b border-[#F0F4F9] pb-3">
                Health & SLA Telemetry
              </h2>
              <div className="flex items-center gap-3 text-[13px] text-[#444746]">
                <Info className="w-5 h-5 text-[#747775] shrink-0" />
                <span>Live health and SLA telemetry is not available for this service.</span>
              </div>
            </div>
          </div>

          {/* Quick Actions sidebar */}
          <div className="space-y-4">
            <div className="bg-white border border-[#E0E2EC] rounded-2xl p-5 space-y-3 shadow-none">
              <h3 className="text-[14px] font-medium text-[#1F1F1F]">Quick Actions</h3>
              <button
                onClick={() => setActiveTab('configuration')}
                className="w-full text-left py-2 px-3 text-[13px] rounded-xl hover:bg-[#F0F4F9] text-[#0B57D0] font-medium transition-colors"
              >
                Edit configuration →
              </button>
              <button
                onClick={() => onNavigate?.('workspace/operations')}
                className="w-full text-left py-2 px-3 text-[13px] rounded-xl hover:bg-[#F0F4F9] text-[#444746] transition-colors"
              >
                View audit history →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Tab: Configuration Form */}
      {activeTab === 'configuration' && (
        <form onSubmit={handleSave} className="bg-white border border-[#E0E2EC] rounded-2xl p-6 sm:p-7 max-w-2xl space-y-5 shadow-none">
          <h2 className="text-[16px] font-medium text-[#1F1F1F] border-b border-[#F0F4F9] pb-3">
            Update Service Settings
          </h2>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-[#444746]">
              Operational Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] focus:bg-white focus:border-[#0B57D0] focus:outline-none transition-colors"
            >
              <option value="Active">Active (Serving traffic)</option>
              <option value="Paused">Paused (Standby)</option>
              <option value="Maintenance">Maintenance Window</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-[#444746]">
              Target Connected Server
            </label>
            <select
              value={serverId}
              onChange={(e) => {
                setServerId(e.target.value);
                const s = servers.find((item) => item.id === e.target.value);
                if (s) setServerName(s.name);
              }}
              className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] focus:bg-white focus:border-[#0B57D0] focus:outline-none transition-colors"
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.region ? ` (${s.region})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-[#444746]">
              Plan Tier
            </label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] focus:bg-white focus:border-[#0B57D0] focus:outline-none transition-colors"
            >
              <option value="Free">Free Community Tier</option>
              <option value="Standard">Standard Tier ($9.99/mo)</option>
              <option value="Pro">Pro Enterprise Tier ($29.99/mo)</option>
            </select>
          </div>

          <div className="pt-4 border-t border-[#F0F4F9] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="px-4 py-2 text-[13px] font-medium text-[#444746] bg-white border border-[#747775]/30 hover:bg-[#F0F4F9] rounded-full"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-[13px] font-medium text-white bg-[#0B57D0] hover:bg-[#0842A0] rounded-full transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Configuration</span>
            </button>
          </div>
        </form>
      )}

      {/* 6. Tab: Lifecycle Management / Deactivate */}
      {activeTab === 'danger' && (
        <div className="bg-white border border-[#FAD2CF] rounded-2xl p-6 sm:p-7 max-w-2xl space-y-4 shadow-none">
          <div className="flex items-center gap-2 text-[#B3261E]">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="text-[16px] font-medium">Decommission Service</h2>
          </div>
          <p className="text-[13px] text-[#444746]">
            Deactivating this service will terminate all running background tasks, disconnect linked webhooks, and revoke associated API tokens immediately.
          </p>

          {!confirmDeactivate ? (
            <button
              type="button"
              onClick={() => setConfirmDeactivate(true)}
              className="px-5 py-2 text-[13px] font-medium text-[#B3261E] bg-white border border-[#B3261E]/40 hover:bg-[#FCE8E6] rounded-full transition-colors cursor-pointer"
            >
              Deactivate service...
            </button>
          ) : (
            <div className="p-5 bg-[#FCE8E6]/50 border border-[#FAD2CF] rounded-2xl space-y-4">
              <p className="text-[13px] text-[#B3261E] font-medium">
                Are you sure you want to deactivate "{service.name}"?
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDeactivate}
                  disabled={deactivating}
                  className="px-5 py-2 text-[13px] font-medium text-white bg-[#B3261E] hover:bg-[#8C1D18] rounded-full cursor-pointer"
                >
                  {deactivating ? 'Deactivating...' : 'Confirm Deactivation'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeactivate(false)}
                  className="px-4 py-2 text-[13px] font-medium text-[#444746] bg-white border border-[#747775]/30 rounded-full"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

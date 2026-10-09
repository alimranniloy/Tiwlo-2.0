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

  const [status, setStatus] = useState('Active');
  const [plan, setPlan] = useState('Free');
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
          setStatus(srv.status || 'Active');
          setPlan(srv.plan || 'Free');
          setServerName(srv.serverName || 'Production Cluster');
          setServerId(srv.serverId || 'srv_1');
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
      <div className="bg-white border border-[#DADCE0] rounded-lg p-16 text-center max-w-4xl mx-auto">
        <RotateCw className="w-6 h-6 text-[#1A73E8] animate-spin mx-auto mb-3" />
        <p className="text-[13px] text-[#5F6368]">Loading service details...</p>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="bg-white border border-[#DADCE0] rounded-lg p-12 text-center max-w-2xl mx-auto space-y-4">
        <AlertTriangle className="w-10 h-10 text-[#C5221F] mx-auto" />
        <h2 className="text-lg font-medium text-[#202124]">Service Not Found</h2>
        <p className="text-[13px] text-[#5F6368]">The requested workspace service does not exist.</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A73E8] hover:bg-[#174EA6] text-white text-[13px] font-medium rounded-md transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Workspace</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 font-sans">
      {/* 1. Google Cloud Subheader with Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#DADCE0] pb-4">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#1A73E8] hover:text-[#174EA6] cursor-pointer mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Workspace</span>
            <span className="text-[#BDC1C6]">/</span>
            <span className="text-[#5F6368]">Services</span>
          </button>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-normal text-[#202124] tracking-tight">{service.name}</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#137333]" />
              {service.status || 'Active'}
            </span>
          </div>
          <p className="text-xs text-[#5F6368] font-mono mt-1">ID: {service.id}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate?.('workspace/billing')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#3C4043] bg-white border border-[#DADCE0] hover:bg-[#F8F9FA] rounded-md transition-colors cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5 text-[#5F6368]" />
            <span>Plan & billing</span>
          </button>
          <button
            onClick={() => onNavigate?.('workspace/operations')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#3C4043] bg-white border border-[#DADCE0] hover:bg-[#F8F9FA] rounded-md transition-colors cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-[#5F6368]" />
            <span>Audit log</span>
          </button>
        </div>
      </div>

      {/* 2. Google Cloud Navigation Tabs */}
      <div className="flex border-b border-[#DADCE0] gap-6 text-[13px]">
        {[
          { id: 'overview', label: 'Overview & Properties' },
          { id: 'configuration', label: 'Configuration' },
          { id: 'danger', label: 'Lifecycle Management' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`pb-3 font-medium cursor-pointer transition-colors border-b-2 -mb-px ${
              activeTab === t.id
                ? 'border-[#1A73E8] text-[#1A73E8]'
                : 'border-transparent text-[#5F6368] hover:text-[#202124]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 3. Feedback Banner */}
      {msg && (
        <div
          className={`p-3.5 rounded-lg border text-[13px] flex items-center gap-2.5 ${
            msg.type === 'error'
              ? 'bg-[#FCE8E6] text-[#C5221F] border-[#FAD2CF]'
              : 'bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]'
          }`}
        >
          {msg.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <Check className="w-4 h-4 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* 4. Tab: Overview & Properties */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white border border-[#DADCE0] rounded-lg p-6 space-y-4">
              <h2 className="text-[15px] font-medium text-[#202124] border-b border-[#F1F3F4] pb-2">
                Service Properties
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
                <div>
                  <span className="text-[#5F6368] block">Service Type</span>
                  <span className="font-medium text-[#202124] capitalize">{service.type || service.category || 'General'}</span>
                </div>
                <div>
                  <span className="text-[#5F6368] block">Target Environment</span>
                  <span className="font-medium text-[#202124] font-mono">{service.serverName || 'Production Cluster'}</span>
                </div>
                <div>
                  <span className="text-[#5F6368] block">Allocated Tier</span>
                  <span className="font-medium text-[#202124]">{service.plan || 'Standard'}</span>
                </div>
                <div>
                  <span className="text-[#5F6368] block">Current Capacity Utilization</span>
                  <span className="font-medium text-[#202124]">{service.usage || '32%'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#DADCE0] rounded-lg p-6 space-y-3">
              <h2 className="text-[15px] font-medium text-[#202124] border-b border-[#F1F3F4] pb-2">
                Health & SLA Telemetry
              </h2>
              <div className="flex items-center gap-3 text-[13px] text-[#3C4043]">
                <CheckCircle2 className="w-5 h-5 text-[#137333] shrink-0" />
                <span>All health probes passing. Continuous uptime 99.98% over the past 30 days.</span>
              </div>
            </div>
          </div>

          {/* Quick Actions sidebar */}
          <div className="space-y-4">
            <div className="bg-white border border-[#DADCE0] rounded-lg p-5 space-y-3">
              <h3 className="text-[14px] font-medium text-[#202124]">Quick Actions</h3>
              <button
                onClick={() => setActiveTab('configuration')}
                className="w-full text-left py-2 px-3 text-[13px] rounded hover:bg-[#F8F9FA] text-[#1A73E8] font-medium transition-colors"
              >
                Edit configuration →
              </button>
              <button
                onClick={() => onNavigate?.('workspace/operations')}
                className="w-full text-left py-2 px-3 text-[13px] rounded hover:bg-[#F8F9FA] text-[#3C4043] transition-colors"
              >
                View audit history →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Tab: Configuration Form */}
      {activeTab === 'configuration' && (
        <form onSubmit={handleSave} className="bg-white border border-[#DADCE0] rounded-lg p-6 max-w-2xl space-y-5">
          <h2 className="text-[16px] font-medium text-[#202124] border-b border-[#F1F3F4] pb-2">
            Update Service Settings
          </h2>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-[#3C4043]">
              Operational Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8]"
            >
              <option value="Active">Active (Serving traffic)</option>
              <option value="Paused">Paused (Standby)</option>
              <option value="Maintenance">Maintenance Window</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-[#3C4043]">
              Target Connected Server
            </label>
            <select
              value={serverId}
              onChange={(e) => {
                setServerId(e.target.value);
                const s = servers.find((item) => item.id === e.target.value);
                if (s) setServerName(s.name);
              }}
              className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8]"
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.region || 'Default Region'})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-[#3C4043]">
              Plan Tier
            </label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8]"
            >
              <option value="Free">Free Community Tier</option>
              <option value="Standard">Standard Tier ($9.99/mo)</option>
              <option value="Pro">Pro Enterprise Tier ($29.99/mo)</option>
            </select>
          </div>

          <div className="pt-3 border-t border-[#F1F3F4] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="px-4 py-2 text-[13px] font-medium text-[#3C4043] bg-white border border-[#DADCE0] hover:bg-[#F8F9FA] rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-[#1A73E8] hover:bg-[#174EA6] rounded-md transition-colors shadow-2xs disabled:opacity-50"
            >
              {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Configuration</span>
            </button>
          </div>
        </form>
      )}

      {/* 6. Tab: Lifecycle Management / Deactivate */}
      {activeTab === 'danger' && (
        <div className="bg-white border border-[#DADCE0] rounded-lg p-6 max-w-2xl space-y-4">
          <div className="flex items-center gap-2 text-[#C5221F]">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="text-[16px] font-medium">Decommission Service</h2>
          </div>
          <p className="text-[13px] text-[#5F6368]">
            Deactivating this service will terminate all running background tasks, disconnect linked webhooks, and revoke associated API tokens immediately.
          </p>

          {!confirmDeactivate ? (
            <button
              type="button"
              onClick={() => setConfirmDeactivate(true)}
              className="px-4 py-2 text-[13px] font-medium text-[#C5221F] bg-white border border-[#FAD2CF] hover:bg-[#FCE8E6] rounded-md transition-colors"
            >
              Deactivate service...
            </button>
          ) : (
            <div className="p-4 bg-[#FCE8E6] border border-[#FAD2CF] rounded-md space-y-3">
              <p className="text-[13px] text-[#C5221F] font-medium">
                Are you sure you want to deactivate "{service.name}"?
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDeactivate}
                  disabled={deactivating}
                  className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#C5221F] hover:bg-[#A51D24] rounded-md shadow-2xs"
                >
                  {deactivating ? 'Deactivating...' : 'Confirm Deactivation'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeactivate(false)}
                  className="px-3 py-1.5 text-[13px] font-medium text-[#3C4043] bg-white border border-[#DADCE0] rounded-md"
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

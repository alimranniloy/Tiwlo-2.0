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
  Check
} from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';

export default function WorkspaceServiceDetailView({ serviceId, onBack, onNavigate }) {
  const [service, setService] = useState(null);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // Form fields
  const [status, setStatus] = useState('Active');
  const [plan, setPlan] = useState('Free');
  const [serverName, setServerName] = useState('');
  const [serverId, setServerId] = useState('');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [srv, serverList] = await Promise.all([
          DiscordAPI.getWorkspaceServiceById(serviceId),
          DiscordAPI.getServers()
        ]);
        if (srv) {
          setService(srv);
          setStatus(srv.status || 'Active');
          setPlan(srv.plan || 'Free');
          setServerName(srv.serverName || 'Creative Hub');
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
      const updated = await DiscordAPI.updateWorkspaceService(serviceId, {
        status,
        plan,
        serverName,
        serverId
      });
      setService(updated.service || updated);
      setMsg({ text: 'Service configuration updated successfully!', type: 'success' });
    } catch (err) {
      setMsg({ text: err.message || 'Failed to update service', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm(`Are you sure you want to deactivate ${service?.name}?`)) return;
    try {
      await DiscordAPI.deleteWorkspaceService(serviceId);
      onBack();
    } catch (err) {
      setMsg({ text: err.message || 'Failed to deactivate service', type: 'error' });
    }
  };

  const renderIcon = (iconType) => {
    switch (iconType) {
      case 'shield':
        return (
          <div className="w-14 h-14 rounded-2xl bg-[#0F2D6B] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Shield className="w-7 h-7 stroke-[2]" />
          </div>
        );
      case 'ticket':
        return (
          <div className="w-14 h-14 rounded-2xl bg-[#0D9488] text-white flex items-center justify-center shrink-0 shadow-xs">
            <MessageSquare className="w-7 h-7 stroke-[2]" />
          </div>
        );
      case 'chart':
        return (
          <div className="w-14 h-14 rounded-2xl bg-[#7C3AED] text-white flex items-center justify-center shrink-0 shadow-xs">
            <BarChart2 className="w-7 h-7 stroke-[2]" />
          </div>
        );
      case 'calendar':
        return (
          <div className="w-14 h-14 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Calendar className="w-7 h-7 stroke-[2]" />
          </div>
        );
      case 'users':
        return (
          <div className="w-14 h-14 rounded-2xl bg-[#16A34A] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Users className="w-7 h-7 stroke-[2]" />
          </div>
        );
      default:
        return (
          <div className="w-14 h-14 rounded-2xl bg-[#475569] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Settings className="w-7 h-7 stroke-[2]" />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-gray-500">
        <div className="inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm">Loading workspace service details...</p>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
        <p className="text-gray-500">Service not found.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold cursor-pointer"
        >
          Return to Workspace
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Back button */}
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Workspace</span>
        </button>
      </div>

      {/* Header Card */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          {renderIcon(service.iconType)}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-[#0F172A]">{service.name}</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 fill-[#16A34A] text-white" />
                {service.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Category: <span className="font-semibold text-gray-700">{service.category}</span> · Connected to{' '}
              <span className="font-semibold text-blue-600">{service.serverName}</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Usage: {service.usageLabel || 'Standard'} · Next Renewal: {service.renewalDate || '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/discord/workspace/billing')}
            className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-gray-700 hover:bg-gray-50 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            <span>Manage Plan</span>
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {msg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Configuration Form */}
      <form onSubmit={handleSave} className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <h2 className="text-lg font-bold text-[#0F172A] border-b border-gray-100 pb-3">
          Service Settings & Allocation
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Status Selection */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
              Operational Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option value="Active">Active (Healthy)</option>
              <option value="Paused">Paused (Temporary Standby)</option>
              <option value="Maintenance">Maintenance Mode</option>
            </select>
          </div>

          {/* Plan Selection */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
              Subscription Tier
            </label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option value="Free">Free (Standard)</option>
              <option value="Pro">Pro ($5 / mo)</option>
              <option value="Growth">Growth ($8 / mo)</option>
              <option value="Starter">Starter ($4 / mo)</option>
              <option value="Enterprise">Enterprise Custom</option>
            </select>
          </div>

          {/* Connected Server Selection */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
              Assigned Discord Server
            </label>
            <select
              value={serverName}
              onChange={(e) => {
                setServerName(e.target.value);
                const s = servers.find((item) => item.name === e.target.value);
                if (s) setServerId(s.id);
              }}
              className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option value="Creative Hub">Creative Hub</option>
              <option value="Design Collective">Design Collective</option>
              <option value="Gaming Lounge">Gaming Lounge</option>
              {servers.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1.5">
              Service bot commands and moderation hooks will listen only inside this selected guild.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-100">
          <button
            type="button"
            onClick={handleDeactivate}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-red-600 hover:text-red-700 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Deactivate Service</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs sm:text-sm font-bold shadow-xs inline-flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

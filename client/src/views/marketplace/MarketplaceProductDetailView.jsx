import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Star,
  CheckCircle2,
  Check,
  Server,
  Download,
  Shield,
  MessageSquare,
  BarChart2,
  TrendingUp,
  RotateCw,
  ExternalLink,
  Layers,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { WorkspaceAPI } from '../../api/workspaceApi';

export default function MarketplaceProductDetailView({ productId, onBack, onNavigate }) {
  const [product, setProduct] = useState(null);
  const [servers, setServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [catalog, srvList] = await Promise.all([
          WorkspaceAPI.getMarketplaceCatalog(),
          WorkspaceAPI.getConnectedServers()
        ]);
        const found = (catalog || []).find((p) => String(p.id) === String(productId));
        setProduct(found || null);
        setServers(srvList || []);
        if (srvList && srvList.length > 0) {
          setSelectedServerId(srvList[0].id);
        }
      } catch (err) {
        setMsg({ text: err.message, type: 'error' });
      } finally {
        setLoading(false);
      }
    }
    if (productId) loadData();
  }, [productId]);

  const handleInstall = async () => {
    if (!selectedServerId) {
      setMsg({ text: 'Please select an environment or server to deploy to.', type: 'error' });
      return;
    }
    setInstalling(true);
    setMsg(null);
    try {
      // Activate into workspace services
      await WorkspaceAPI.activateWorkspaceService({
        name: product?.name || 'Enterprise Service',
        type: product?.category || 'general',
        plan: product?.price === 'Free' ? 'Free Community' : 'Standard Enterprise',
        serverId: selectedServerId,
        icon: product?.icon || 'shield'
      });
      setInstallSuccess(true);
      setMsg({ text: `Successfully activated "${product?.name}" into your workspace!`, type: 'success' });
    } catch (err) {
      setMsg({ text: err.message || 'Deployment failed. Please verify credentials.', type: 'error' });
    } finally {
      setInstalling(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#DADCE0] rounded-lg p-16 text-center max-w-4xl mx-auto">
        <RotateCw className="w-6 h-6 text-[#1A73E8] animate-spin mx-auto mb-3" />
        <p className="text-[13px] text-[#5F6368]">Loading solution specifications...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-white border border-[#DADCE0] rounded-lg p-12 text-center max-w-2xl mx-auto space-y-4">
        <AlertCircle className="w-10 h-10 text-[#C5221F] mx-auto" />
        <h2 className="text-lg font-medium text-[#202124]">Solution Not Found</h2>
        <p className="text-[13px] text-[#5F6368]">The requested solution could not be located in the catalog.</p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A73E8] hover:bg-[#174EA6] text-white text-[13px] font-medium rounded-md transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 font-sans">
      {/* 1. Google Cloud Subheader with Breadcrumbs */}
      <div className="flex items-center justify-between border-b border-[#DADCE0] pb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#1A73E8] hover:text-[#174EA6] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </button>

        <div className="flex items-center gap-2 text-[12px] text-[#5F6368]">
          <span>Marketplace</span>
          <span>/</span>
          <span className="text-[#202124] font-medium">{product.name}</span>
        </div>
      </div>

      {/* 2. Google Cloud Product Hero Card */}
      <div className="bg-white border border-[#DADCE0] rounded-lg p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-lg bg-[#E8F0FE] text-[#1A73E8] border border-[#D2E3FC] flex items-center justify-center shrink-0">
              <Shield className="w-8 h-8 stroke-[1.8]" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-normal text-[#202124] tracking-tight">{product.name}</h1>
                {product.verified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1A73E8] bg-[#E8F0FE] border border-[#D2E3FC] px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 fill-[#1A73E8] text-white" />
                    Verified
                  </span>
                )}
              </div>
              <p className="text-[13px] text-[#5F6368] mt-1">
                Published by <span className="text-[#202124] font-medium">{product.developer || 'Tiwlo Ecosystem'}</span>
              </p>

              {/* Stats */}
              <div className="flex items-center gap-4 mt-3 text-[12px] text-[#5F6368]">
                <div className="flex items-center gap-1 font-medium text-[#202124]">
                  <Star className="w-3.5 h-3.5 fill-[#F29900] text-[#F29900]" />
                  <span>{product.rating ? Number(product.rating).toFixed(1) : '5.0'}</span>
                </div>
                <span>•</span>
                <span>{(product.installCount || 120).toLocaleString()} active deployments</span>
                <span>•</span>
                <span className="capitalize">{product.category || 'Extension'}</span>
              </div>
            </div>
          </div>

          {/* Pricing & Deployment Panel */}
          <div className="bg-[#F8F9FA] border border-[#DADCE0] rounded-lg p-4 sm:p-5 min-w-[280px]">
            <div className="text-xs text-[#5F6368]">Pricing Model</div>
            <div className="text-2xl font-medium text-[#202124] mt-0.5">
              {product.price || 'Free'}
            </div>
            <p className="text-[11px] text-[#5F6368] mt-1">
              Includes full updates, automated patching & 24/7 telemetry.
            </p>

            {/* Server Selector */}
            <div className="mt-4 space-y-1.5">
              <label className="block text-[11px] font-medium text-[#3C4043] uppercase tracking-wider">
                Target Server / Workspace
              </label>
              <select
                value={selectedServerId}
                onChange={(e) => setSelectedServerId(e.target.value)}
                disabled={installing || installSuccess}
                className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-1.5 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8] cursor-pointer"
              >
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.region || 'Global'})
                  </option>
                ))}
              </select>
            </div>

            {/* Action Button */}
            <button
              onClick={handleInstall}
              disabled={installing || installSuccess}
              className={`w-full mt-4 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
                installSuccess
                  ? 'bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]'
                  : 'bg-[#1A73E8] hover:bg-[#174EA6] text-white shadow-2xs disabled:opacity-50'
              }`}
            >
              {installing ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Deploying Service...</span>
                </>
              ) : installSuccess ? (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Activated in Workspace</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Deploy to Workspace</span>
                </>
              )}
            </button>

            {installSuccess && (
              <button
                onClick={() => onNavigate?.('workspace')}
                className="w-full mt-2 py-1.5 text-center text-[12px] font-medium text-[#1A73E8] hover:underline cursor-pointer"
              >
                View in Workspace →
              </button>
            )}
          </div>
        </div>
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
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* 4. Specifications & Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-[#DADCE0] rounded-lg p-6 space-y-4">
            <h2 className="text-[16px] font-medium text-[#202124] border-b border-[#F1F3F4] pb-3">
              Overview & Capabilities
            </h2>
            <p className="text-[13px] text-[#3C4043] leading-relaxed">
              {product.description || 'Enterprise solution designed for seamless automation, high security, and deep integrations with your existing infrastructure.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {[
                'Zero-downtime automated provisioning',
                'Native WebSocket & REST telemetry',
                'Role-based access & audit trail logging',
                'Compliance-ready encrypted storage'
              ].map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[13px] text-[#3C4043]">
                  <Check className="w-4 h-4 text-[#137333] shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          <div className="bg-white border border-[#DADCE0] rounded-lg p-5 space-y-3.5 text-[13px]">
            <h3 className="text-[14px] font-medium text-[#202124] border-b border-[#F1F3F4] pb-2">
              Metadata
            </h3>
            <div className="flex justify-between">
              <span className="text-[#5F6368]">Version</span>
              <span className="text-[#202124] font-medium">v2.4.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5F6368]">Category</span>
              <span className="text-[#202124] font-medium capitalize">{product.category || 'General'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5F6368]">Publisher</span>
              <span className="text-[#202124] font-medium">{product.developer || 'Tiwlo Ecosystem'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5F6368]">Service Level</span>
              <span className="text-[#137333] font-medium">99.9% SLA</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

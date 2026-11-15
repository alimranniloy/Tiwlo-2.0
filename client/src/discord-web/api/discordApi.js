import { applicationFetch as fetch } from '../../api/graphqlTransport.js';
const API_BASE = '/api/discord';

function authHeaders() {
  const token = localStorage.getItem('stockpro_session') ||
    sessionStorage.getItem('stockpro_session');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...authHeaders(),
      ...options.headers
    }
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(result.error || 'Discord request failed');
    err.status = response.status;
    err.code = result.code || null;
    err.packages = result.packages || null;
    err.metric = result.metric || null;
    err.limit = result.limit;
    err.current = result.current;
    err.requiredAmount = result.requiredAmount;
    err.availableCredits = result.availableCredits;
    err.shortfall = result.shortfall;
    throw err;
  }

  return result;
}

export const DiscordAPI = {
  // Packages, Subscription & Official Bots
  async getPackages() {
    const res = await request('/packages');
    return res.packages || [];
  },

  async getSubscription() {
    return request('/subscription');
  },

  async purchaseSubscription(planId) {
    return request('/subscription/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId })
    });
  },

  async getOfficialBots() {
    const res = await request('/official-bots');
    return res.officialBots || [];
  },

  // Overview
  async getOverview() {
    return request('/overview');
  },

  // Official Bots view helper (read-only for users)
  async getBots() {
    const res = await request('/official-bots');
    return res.officialBots || [];
  },

  async getBotById(id) {
    const res = await request(`/bots/${encodeURIComponent(id)}`);
    return res.bot;
  },

  // Servers
  async getServers() {
    const res = await request('/servers');
    return res.servers || [];
  },

  async getServerById(id) {
    const res = await request(`/servers/${encodeURIComponent(id)}`);
    return res.server;
  },

  async createServer(payload) {
    return request('/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async updateServer(id, payload) {
    return request(`/servers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async deleteServer(id) {
    return request(`/servers/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  async saveServerAiConfig(serverId, aiConfig) {
    return request(`/servers/${encodeURIComponent(serverId)}/ai-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiConfig })
    });
  },

  async simulateServerCommand(serverId, count = 1) {
    return request(`/servers/${encodeURIComponent(serverId)}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count })
    });
  },

  async assignBotToServer(serverId, botId) {
    return request(`/servers/${encodeURIComponent(serverId)}/bots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId })
    });
  },

  async removeBotFromServer(serverId, botId) {
    return request(`/servers/${encodeURIComponent(serverId)}/bots/${encodeURIComponent(botId)}`, {
      method: 'DELETE'
    });
  },

  // Activities
  async getActivities(limit = 20) {
    const res = await request(`/activities?limit=${limit}`);
    return res.activities || [];
  },

  // Automations
  async getAutomations(type = null) {
    const query = type ? `?type=${encodeURIComponent(type)}` : '';
    const res = await request(`/automations${query}`);
    return res.automations || [];
  },

  async saveAutomation(payload) {
    return request('/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  // Tickets
  async getTickets() {
    const res = await request('/tickets');
    return res.tickets || [];
  },

  async createTicket(payload) {
    return request('/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  // Marketplace
  async getMarketplace(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.category) searchParams.set('category', params.category);
    if (params.pricing) searchParams.set('pricing', params.pricing);
    if (params.search) searchParams.set('search', params.search);
    if (params.sort) searchParams.set('sort', params.sort);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request(`/marketplace${query}`);
  },

  async getMarketplaceProductById(id) {
    const res = await request(`/marketplace/${encodeURIComponent(id)}`);
    return res.product;
  },

  // Workspace
  async getWorkspace(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.set('search', params.search);
    if (params.filter) searchParams.set('filter', params.filter);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await request(`/workspace${query}`);
    return res.workspace || { services: [], operations: [], totalServices: 0, connectedServersCount: 0, allServicesHealthy: null };
  },

  async getWorkspaceServiceById(id) {
    const res = await request(`/workspace/services/${encodeURIComponent(id)}`);
    return res.service;
  },

  async updateWorkspaceService(id, payload) {
    return request(`/workspace/services/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async deleteWorkspaceService(id) {
    return request(`/workspace/services/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  async getWorkspaceOperations() {
    const res = await request('/workspace/operations');
    return res.operations || [];
  },

  async refreshWorkspace() {
    const res = await request('/workspace/refresh', { method: 'POST' });
    return res.workspace;
  }
};

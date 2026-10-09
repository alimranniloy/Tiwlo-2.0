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
    throw new Error(result.error || 'Discord request failed');
  }

  return result;
}

export const DiscordAPI = {
  // Overview
  async getOverview() {
    return request('/overview');
  },

  // Bots
  async getBots() {
    const res = await request('/bots');
    return res.bots || [];
  },

  async getBotById(id) {
    const res = await request(`/bots/${encodeURIComponent(id)}`);
    return res.bot;
  },

  async createBot(payload) {
    return request('/bots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async updateBot(id, payload) {
    return request(`/bots/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async deleteBot(id) {
    return request(`/bots/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
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

  async installMarketplaceProduct(id, serverId) {
    return request(`/marketplace/${encodeURIComponent(id)}/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId })
    });
  },

  // Workspace
  async getWorkspace(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.set('search', params.search);
    if (params.filter) searchParams.set('filter', params.filter);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await request(`/workspace${query}`);
    return res.workspace || { services: [], operations: [], totalServices: 0, connectedServersCount: 0, allServicesHealthy: true };
  },

  async getWorkspaceServiceById(id) {
    const res = await request(`/workspace/services/${encodeURIComponent(id)}`);
    return res.service;
  },

  async activateWorkspaceService(payload) {
    return request('/workspace/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
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


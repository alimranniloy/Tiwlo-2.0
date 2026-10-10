const API_BASE = '/api/discord';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('stockpro_session') || '';
  const headers = {
    'Accept': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP error! status: ${res.status}`);
  }
  return data;
}

export const WorkspaceAPI = {
  async getWorkspace(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.set('search', params.search);
    if (params.filter) searchParams.set('filter', params.filter);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await request(`/workspace${query}`);
    return res.workspace || {
      services: [],
      operations: [],
      totalServices: 0,
      connectedServersCount: 0,
      allServicesHealthy: true
    };
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
  },

  async getConnectedServers() {
    const res = await request('/servers');
    return res.servers || [];
  },

  async getMarketplaceCatalog() {
    const res = await request('/marketplace');
    return res.products || [];
  }
};

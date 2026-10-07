const API_BASE = '/api/email';

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
    throw new Error(result.error || 'The mail request could not be completed.');
  }
  return result;
}

export const EmailAPI = {
  async getMailbox() {
    return request('/mailbox');
  },

  async checkMailboxAvailability(localPart) {
    const params = new URLSearchParams({ localPart });
    return request(`/mailbox/availability?${params}`);
  },

  async createMailbox(localPart) {
    return request('/mailbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localPart })
    });
  },

  async getMessages({ folder = 'inbox', tab = 'all', q = '' } = {}) {
    const params = new URLSearchParams({ folder, tab, q });
    return request(`/messages?${params}`);
  },

  async getMessageById(id) {
    const result = await request(`/messages/${encodeURIComponent(id)}`);
    return result.email;
  },

  async saveDraft(payload) {
    return request('/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async discardDraft(id) {
    return request(`/drafts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async downloadAttachment(id, filename) {
    const response = await fetch(`${API_BASE}/attachments/${encodeURIComponent(id)}`, {
      credentials: 'include',
      headers: authHeaders()
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'Could not download this attachment.');
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  async sendEmail(payload) {
    const form = new FormData();
    for (const key of ['to', 'cc', 'bcc', 'subject', 'body', 'draftId']) {
      if (payload[key]) form.append(key, payload[key]);
    }
    for (const file of payload.attachments || []) {
      form.append('attachments', file);
    }
    return request('/send', { method: 'POST', body: form });
  },

  async toggleFlag(id) {
    return request('/toggle-flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  },

  async toggleRead(id, isUnread) {
    return request('/toggle-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isUnread })
    });
  },

  async togglePin(id) {
    return request('/toggle-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  },

  async deleteEmail(id) {
    return request('/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  },

  async archiveEmail(id) {
    return request('/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  }
};

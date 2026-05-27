import api from './api';

export const adminService = {
  getStats: async () => {
    const response = await api.get('/admin/stats');
    return response.data;
  },
  getUsers: async () => {
    const response = await api.get('/admin/users');
    return response.data;
  },
  getPendingSellers: async () => {
    const response = await api.get('/admin/sellers/pending');
    return response.data;
  },
  reviewSeller: async (userId, decision) => {
    const response = await api.post(`/admin/sellers/${userId}/review`, { decision });
    return response.data;
  },
  toggleUserActive: async (userId) => {
    const response = await api.patch(`/admin/users/${userId}/active`);
    return response.data;
  },
  getSellers: async () => {
    const response = await api.get('/admin/sellers');
    return response.data;
  },
  getSalesOrders: async (sellerId) => {
    const params = sellerId ? { seller_id: sellerId } : {};
    const response = await api.get('/admin/sales-orders', { params });
    return response.data;
  },

  // --- Support tickets ---
  listSupportTickets: async (statusFilter) => {
    const params = statusFilter ? { status_filter: statusFilter } : {};
    const response = await api.get('/support/admin/tickets', { params });
    return response.data;
  },
  getOpenTicketCount: async () => {
    const response = await api.get('/support/admin/tickets/open-count');
    return response.data;
  },
  getSupportTicket: async (ticketId) => {
    const response = await api.get(`/support/admin/tickets/${ticketId}`);
    return response.data;
  },
  patchSupportTicket: async (ticketId, { status, admin_notes }) => {
    const response = await api.patch(`/support/admin/tickets/${ticketId}`, {
      status,
      admin_notes,
    });
    return response.data;
  },
  reactivateUserFromTicket: async (ticketId) => {
    const response = await api.post(
      `/support/admin/tickets/${ticketId}/reactivate-user`
    );
    return response.data;
  },
  replyToTicket: async (ticketId, message) => {
    const response = await api.post(
      `/support/admin/tickets/${ticketId}/reply`,
      { message }
    );
    return response.data;
  },
};

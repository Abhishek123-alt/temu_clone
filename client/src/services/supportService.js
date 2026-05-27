import api from './api';

export const supportService = {
  contact: async ({ from_email, subject, message, context }) => {
    const response = await api.post('/support/contact', {
      from_email,
      subject,
      message,
      context,
    });
    return response.data;
  },
  notifyAdmin: async (fromEmail) => {
    const response = await api.post('/support/notify-admin', {
      from_email: fromEmail,
    });
    return response.data;
  },
};

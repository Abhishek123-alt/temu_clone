export const toast = {
  success: (message, duration = 3000) => {
    window.dispatchEvent(new CustomEvent('toast', { detail: { message, type: 'success', duration } }));
  },
  error: (message, duration = 4000) => {
    window.dispatchEvent(new CustomEvent('toast', { detail: { message, type: 'error', duration } }));
  },
  info: (message, duration = 3000) => {
    window.dispatchEvent(new CustomEvent('toast', { detail: { message, type: 'info', duration } }));
  }
};

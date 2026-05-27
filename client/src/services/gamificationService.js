import api from './api';

export const gamificationService = {
  listGames: async () => {
    const { data } = await api.get('/gamification/games');
    return data;
  },

  getGame: async (gameType) => {
    const { data } = await api.get(`/gamification/games/${gameType}`);
    return data;
  },

  playGame: async (gameType) => {
    const { data } = await api.post(`/gamification/games/${gameType}/action`);
    return data;
  },

  resetGame: async (gameType) => {
    const { data } = await api.post(`/gamification/games/${gameType}/reset`);
    return data;
  },
};

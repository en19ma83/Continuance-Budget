import * as SecureStore from 'expo-secure-store';

const KEYS = {
  TOKEN: 'auth_token',
  BACKEND_URL: 'backend_url',
  USERNAME: 'username',
} as const;

export const storage = {
  getToken: () => SecureStore.getItemAsync(KEYS.TOKEN),
  setToken: (token: string) => SecureStore.setItemAsync(KEYS.TOKEN, token),
  deleteToken: () => SecureStore.deleteItemAsync(KEYS.TOKEN),

  getBackendUrl: () => SecureStore.getItemAsync(KEYS.BACKEND_URL),
  setBackendUrl: (url: string) => SecureStore.setItemAsync(KEYS.BACKEND_URL, url.replace(/\/$/, '')),
  deleteBackendUrl: () => SecureStore.deleteItemAsync(KEYS.BACKEND_URL),

  getUsername: () => SecureStore.getItemAsync(KEYS.USERNAME),
  setUsername: (username: string) => SecureStore.setItemAsync(KEYS.USERNAME, username),

  clearAll: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.TOKEN),
      SecureStore.deleteItemAsync(KEYS.BACKEND_URL),
      SecureStore.deleteItemAsync(KEYS.USERNAME),
    ]);
  },
};

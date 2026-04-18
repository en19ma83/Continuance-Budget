import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { storage } from '../utils/storage';
import { authApi } from '../utils/api';
import { registerForPushNotifications, unregisterPushNotifications } from '../utils/notifications';

const BIOMETRIC_KEY = 'biometric_enabled';

interface AuthState {
  token: string | null;
  username: string | null;
  backendUrl: string | null;
  isLoading: boolean;
  isLocked: boolean;
  biometricEnabled: boolean;
  biometricSupported: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setBackendUrl: (url: string) => Promise<void>;
  unlock: () => void;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    username: null,
    backendUrl: null,
    isLoading: true,
    isLocked: false,
    biometricEnabled: false,
    biometricSupported: false,
  });

  const appState = useRef<AppStateStatus>('active');

  // Boot: load stored credentials + check biometric hardware
  useEffect(() => {
    (async () => {
      const [token, username, backendUrl, biometricFlag] = await Promise.all([
        storage.getToken(),
        storage.getUsername(),
        storage.getBackendUrl(),
        SecureStore.getItemAsync(BIOMETRIC_KEY),
      ]);

      const biometricEnabled = biometricFlag === 'true';
      const [hasHardware, isEnrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      const biometricSupported = hasHardware && isEnrolled;

      // Lock immediately on boot if biometric is enabled and user is logged in
      const isLocked = biometricEnabled && biometricSupported && !!token;

      setState({ token, username, backendUrl, isLoading: false, isLocked, biometricEnabled, biometricSupported });
    })();
  }, []);

  // Re-lock when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (
        appState.current === 'background' &&
        next === 'active' &&
        state.biometricEnabled &&
        state.biometricSupported &&
        state.token
      ) {
        setState((s) => ({ ...s, isLocked: true }));
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [state.biometricEnabled, state.biometricSupported, state.token]);

  const login = async (username: string, password: string) => {
    const { access_token } = await authApi.login(username, password);
    await Promise.all([storage.setToken(access_token), storage.setUsername(username)]);
    setState((s) => ({ ...s, token: access_token, username }));
    // Register push token after login (best-effort)
    registerForPushNotifications().catch(() => null);
  };

  const logout = async () => {
    await unregisterPushNotifications().catch(() => null);
    await storage.clearAll();
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY).catch(() => null);
    setState((s) => ({
      ...s,
      token: null,
      username: null,
      backendUrl: null,
      isLocked: false,
      biometricEnabled: false,
    }));
  };

  const setBackendUrl = async (url: string) => {
    await storage.setBackendUrl(url);
    setState((s) => ({ ...s, backendUrl: url }));
  };

  const unlock = () => setState((s) => ({ ...s, isLocked: false }));

  const enableBiometric = async (): Promise<boolean> => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirm to enable biometric unlock',
      cancelLabel: 'Cancel',
    });
    if (result.success) {
      await SecureStore.setItemAsync(BIOMETRIC_KEY, 'true');
      setState((s) => ({ ...s, biometricEnabled: true }));
    }
    return result.success;
  };

  const disableBiometric = async () => {
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
    setState((s) => ({ ...s, biometricEnabled: false }));
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, setBackendUrl, unlock, enableBiometric, disableBiometric }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

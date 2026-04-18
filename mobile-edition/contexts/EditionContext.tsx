import React, { createContext, useContext, useEffect, useState } from 'react';
import { storage } from '../utils/storage';

export type Edition = 'community' | 'pro' | 'unknown';

interface EditionState {
  edition: Edition;
  version: string;
  features: string[];
  isLoading: boolean;
}

interface EditionContextValue extends EditionState {
  refresh: (backendUrl?: string) => Promise<void>;
}

const EditionContext = createContext<EditionContextValue | null>(null);

async function fetchVersion(baseUrl: string): Promise<{ edition: Edition; version: string; features: string[] }> {
  const res = await fetch(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error('Version endpoint not available');
  return res.json();
}

export function EditionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EditionState>({
    edition: 'unknown',
    version: '',
    features: [],
    isLoading: true,
  });

  const refresh = async (urlOverride?: string) => {
    const backendUrl = urlOverride ?? (await storage.getBackendUrl());
    if (!backendUrl) {
      setState({ edition: 'unknown', version: '', features: [], isLoading: false });
      return;
    }
    try {
      const data = await fetchVersion(backendUrl);
      setState({ ...data, isLoading: false });
    } catch {
      // Backend may be an older Community instance without /api/version — treat as community
      setState({ edition: 'community', version: 'unknown', features: [], isLoading: false });
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <EditionContext.Provider value={{ ...state, refresh }}>
      {children}
    </EditionContext.Provider>
  );
}

export function useEdition() {
  const ctx = useContext(EditionContext);
  if (!ctx) throw new Error('useEdition must be used within EditionProvider');
  return ctx;
}

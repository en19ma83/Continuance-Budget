import '../global.css';
import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { EditionProvider } from '../contexts/EditionContext';
import { LockScreen } from '../components/LockScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function AuthGate() {
  const { token, backendUrl, isLoading, isLocked } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const segs = segments as string[];
    const inAuth = segs[0] === '(auth)';

    if (!backendUrl) {
      if (!inAuth || segs[1] !== 'connect') router.replace('/(auth)/connect');
    } else if (!token) {
      if (!inAuth || segs[1] !== 'login') router.replace('/(auth)/login');
    } else {
      if (inAuth) router.replace('/(tabs)');
    }
  }, [token, backendUrl, isLoading, segments]);

  if (isLocked) return <LockScreen />;
  return <Slot />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <EditionProvider>
        <AuthProvider>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <AuthGate />
        </AuthProvider>
      </EditionProvider>
    </QueryClientProvider>
  );
}

import { View, useColorScheme } from 'react-native';
import { Tabs } from 'expo-router';
import { Home, List, RefreshCw, Settings, Sparkles } from 'lucide-react-native';
import { QuickAddProvider } from '../../contexts/QuickAddContext';
import { FAB } from '../../components/FAB';
import { QuickAddSheet } from '../../components/QuickAddSheet';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';

export default function TabLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const { isPro } = useFeatureFlags();

  const colors = {
    bg: isDark ? '#0f172a' : '#ffffff',
    border: isDark ? '#1e293b' : '#e2e8f0',
    active: '#0ea5e9',
    inactive: isDark ? '#475569' : '#94a3b8',
    proActive: '#f59e0b',
  };

  return (
    <QuickAddProvider>
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: colors.bg,
              borderTopColor: colors.border,
              paddingBottom: 4,
            },
            tabBarActiveTintColor: colors.active,
            tabBarInactiveTintColor: colors.inactive,
            tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="ledger"
            options={{
              title: 'Ledger',
              tabBarIcon: ({ color, size }) => <List color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="rules"
            options={{
              title: 'Rules',
              tabBarIcon: ({ color, size }) => <RefreshCw color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="insights"
            options={{
              title: isPro ? 'AI' : 'Pro',
              tabBarActiveTintColor: isPro ? colors.proActive : colors.inactive,
              tabBarIcon: ({ focused, size }) => (
                <Sparkles
                  color={focused ? (isPro ? colors.proActive : colors.active) : colors.inactive}
                  size={size}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="setup"
            options={{
              title: 'Setup',
              tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
            }}
          />
        </Tabs>
        <FAB />
        <QuickAddSheet />
      </View>
    </QuickAddProvider>
  );
}

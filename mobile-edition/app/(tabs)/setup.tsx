import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  useColorScheme,
  Alert,
  Switch,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { accountsApi, assetsApi, Account, Asset } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { AssetDetailSheet } from '../../components/AssetDetailSheet';
import { LogOut, CreditCard, Building2, TrendingUp, Home, Car, Landmark } from 'lucide-react-native';

function AccountRow({ account }: { account: Account }) {
  const isDark = useColorScheme() === 'dark';
  const fmt = (v: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: account.currency || 'AUD',
      minimumFractionDigits: 0,
    }).format(v);

  return (
    <View className={`flex-row items-center px-4 py-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
      <View className={`w-9 h-9 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
        {account.entity === 'BUSINESS' ? (
          <Building2 size={16} color="#a78bfa" />
        ) : (
          <CreditCard size={16} color="#0ea5e9" />
        )}
      </View>
      <View className="flex-1">
        <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{account.name}</Text>
        <Text className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {account.type} · {account.entity}{account.is_on_budget ? ' · On Budget' : ''}
        </Text>
      </View>
      <Text className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {fmt(account.starting_balance)}
      </Text>
    </View>
  );
}

const ASSET_ICONS: Record<string, React.ReactNode> = {
  PROPERTY: <Home size={16} color="#34d399" />,
  STOCK: <TrendingUp size={16} color="#60a5fa" />,
  VEHICLE: <Car size={16} color="#f59e0b" />,
  LOAN: <Landmark size={16} color="#f87171" />,
  OTHER: <Building2 size={16} color="#a78bfa" />,
};

function AssetRow({ asset, onPress }: { asset: Asset; onPress: () => void }) {
  const isDark = useColorScheme() === 'dark';
  const fmt = (v: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: asset.currency || 'AUD',
      minimumFractionDigits: 0,
    }).format(v);

  return (
    <TouchableOpacity
      className={`flex-row items-center px-4 py-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className={`w-9 h-9 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
        {ASSET_ICONS[asset.type] ?? ASSET_ICONS.OTHER}
      </View>
      <View className="flex-1">
        <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{asset.name}</Text>
        <Text className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {asset.type} · {asset.entity}{asset.is_liability ? ' · Liability' : ''}
          {asset.lvr != null ? ` · LVR ${asset.lvr}%` : ''}
        </Text>
      </View>
      <View className="items-end">
        <Text className={`text-sm font-semibold ${asset.is_liability ? 'text-rose-400' : isDark ? 'text-white' : 'text-slate-900'}`}>
          {fmt(asset.current_value)}
        </Text>
        {asset.equity != null && (
          <Text className={`text-xs ${asset.equity >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {asset.equity >= 0 ? '+' : ''}{fmt(asset.equity)} equity
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function SetupScreen() {
  const isDark = useColorScheme() === 'dark';
  const { username, backendUrl, logout, biometricEnabled, biometricSupported, enableBiometric, disableBiometric } = useAuth();
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const { data: accounts = [], refetch: refetchAccounts, isFetching: accountsFetching } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.list(),
  });

  const { data: assets = [], refetch: refetchAssets, isFetching: assetsFetching } = useQuery({
    queryKey: ['assets'],
    queryFn: () => assetsApi.list(),
  });

  const isFetching = accountsFetching || assetsFetching;
  const refetch = () => { refetchAccounts(); refetchAssets(); };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Sign out and clear saved credentials?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const handleBiometricToggle = async (val: boolean) => {
    if (val) {
      const ok = await enableBiometric();
      if (!ok) Alert.alert('Authentication failed', 'Biometric unlock was not enabled.');
    } else {
      disableBiometric();
    }
  };

  const personalAccounts = accounts.filter((a) => a.entity === 'PERSONAL');
  const businessAccounts = accounts.filter((a) => a.entity === 'BUSINESS');
  const realAssets = assets.filter((a) => !a.is_liability);
  const liabilities = assets.filter((a) => a.is_liability);

  return (
    <>
      <ScrollView
        className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-white'}`}
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#0ea5e9" />}
      >
        {/* Header */}
        <View className="px-5 pt-14 pb-4 flex-row items-center justify-between">
          <View>
            <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Setup</Text>
            <Text className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{username}</Text>
          </View>
          <TouchableOpacity
            onPress={handleLogout}
            className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
          >
            <LogOut size={14} color="#ef4444" />
            <Text className="text-rose-400 text-xs font-medium">Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Backend info */}
        <View className={`mx-4 mb-4 p-4 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
          <Text className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Connected Backend</Text>
          <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`} numberOfLines={1}>
            {backendUrl}
          </Text>
        </View>

        {/* Biometric toggle */}
        {biometricSupported && (
          <View className={`mx-4 mb-6 p-4 rounded-2xl flex-row items-center justify-between ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <View className="flex-1 mr-4">
              <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Biometric Unlock</Text>
              <Text className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Use Face ID or Touch ID to unlock the app
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              trackColor={{ false: isDark ? '#334155' : '#e2e8f0', true: '#0ea5e9' }}
              thumbColor="white"
            />
          </View>
        )}

        {/* Personal Accounts */}
        {personalAccounts.length > 0 && (
          <>
            <Text className={`text-xs font-semibold uppercase tracking-wider px-5 mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Personal Accounts
            </Text>
            {personalAccounts.map((a) => <AccountRow key={a.id} account={a} />)}
            <View className="mb-5" />
          </>
        )}

        {/* Business Accounts */}
        {businessAccounts.length > 0 && (
          <>
            <Text className={`text-xs font-semibold uppercase tracking-wider px-5 mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Business Accounts
            </Text>
            {businessAccounts.map((a) => <AccountRow key={a.id} account={a} />)}
            <View className="mb-5" />
          </>
        )}

        {/* Assets */}
        {realAssets.length > 0 && (
          <>
            <Text className={`text-xs font-semibold uppercase tracking-wider px-5 mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Assets
            </Text>
            {realAssets.map((a) => <AssetRow key={a.id} asset={a} onPress={() => setSelectedAsset(a)} />)}
            <View className="mb-5" />
          </>
        )}

        {/* Liabilities */}
        {liabilities.length > 0 && (
          <>
            <Text className={`text-xs font-semibold uppercase tracking-wider px-5 mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Liabilities
            </Text>
            {liabilities.map((a) => <AssetRow key={a.id} asset={a} onPress={() => setSelectedAsset(a)} />)}
            <View className="mb-5" />
          </>
        )}

        {accounts.length === 0 && assets.length === 0 && !isFetching && (
          <View className="py-10 items-center">
            <Text className={isDark ? 'text-slate-500' : 'text-slate-400'}>No data found</Text>
          </View>
        )}
      </ScrollView>

      <AssetDetailSheet asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
    </>
  );
}

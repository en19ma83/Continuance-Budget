import { ScrollView, View, Text, TouchableOpacity, RefreshControl, useColorScheme } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { statsApi, ledgerApi } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useMemo } from 'react';

function StatCard({ label, value, currency, accent }: {
  label: string;
  value: number;
  currency: string;
  accent?: boolean;
}) {
  const isDark = useColorScheme() === 'dark';
  const formatted = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency || 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

  return (
    <View className={`rounded-2xl p-4 flex-1 mx-1 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
      <Text className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</Text>
      <Text className={`text-lg font-bold ${value < 0 ? 'text-rose-400' : accent ? 'text-sky-400' : isDark ? 'text-white' : 'text-slate-900'}`}>
        {formatted}
      </Text>
    </View>
  );
}

function HorizonCard({ label, balance, delta, currency }: {
  label: string;
  balance: number;
  delta: number;
  currency: string;
}) {
  const isDark = useColorScheme() === 'dark';
  const fmt = (v: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currency || 'AUD',
      minimumFractionDigits: 0,
    }).format(v);

  return (
    <View className={`rounded-2xl p-4 mr-3 w-40 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
      <Text className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</Text>
      <Text className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmt(balance)}</Text>
      <Text className={`text-xs mt-1 ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
        {delta >= 0 ? '+' : ''}{fmt(delta)}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const { username } = useAuth();

  const { data: stats, refetch: refetchStats, isFetching: statsFetching } = useQuery({
    queryKey: ['stats'],
    queryFn: () => statsApi.v2(),
  });

  const { data: ledger, isFetching: ledgerFetching } = useQuery({
    queryKey: ['ledger'],
    queryFn: () => ledgerApi.list(),
  });

  const today = useMemo(() => new Date(), []);

  const horizons = useMemo(() => {
    if (!ledger || !stats) return [];
    const currentBalance = stats.on_budget_balance;

    const getBalanceAt = (daysAhead: number) => {
      const target = new Date(today);
      target.setDate(target.getDate() + daysAhead);
      const entries = ledger
        .filter((e) => new Date(e.date) <= target)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return entries[0]?.running_balance ?? currentBalance;
    };

    return [
      { label: '1 Month', balance: getBalanceAt(30), delta: getBalanceAt(30) - currentBalance },
      { label: '3 Months', balance: getBalanceAt(90), delta: getBalanceAt(90) - currentBalance },
      { label: '6 Months', balance: getBalanceAt(180), delta: getBalanceAt(180) - currentBalance },
      { label: '12 Months', balance: getBalanceAt(365), delta: getBalanceAt(365) - currentBalance },
    ];
  }, [ledger, stats, today]);

  const isRefreshing = statsFetching || ledgerFetching;

  return (
    <ScrollView
      className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-white'}`}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={refetchStats} tintColor="#0ea5e9" />
      }
    >
      {/* Header */}
      <View className="px-5 pt-14 pb-4">
        <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Good {getGreeting()}, {username ?? 'there'}
        </Text>
        <Text className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {today.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>

      {/* Stat cards */}
      {stats && (
        <View className="px-4 mb-6">
          <Text className={`text-xs font-semibold uppercase tracking-wider mb-3 px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Overview
          </Text>
          <View className="flex-row mb-2">
            <StatCard label="On Budget" value={stats.on_budget_balance} currency={stats.base_currency} />
            <StatCard label="Off Budget" value={stats.off_budget_balance} currency={stats.base_currency} />
          </View>
          <View className="flex-row">
            <StatCard label="Assets" value={stats.total_assets} currency={stats.base_currency} />
            <StatCard label="Net Worth" value={stats.net_worth} currency={stats.base_currency} accent />
          </View>
        </View>
      )}

      {/* Cash flow horizons */}
      {horizons.length > 0 && (
        <View className="mb-6">
          <Text className={`text-xs font-semibold uppercase tracking-wider mb-3 px-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Cash Flow Horizons
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {horizons.map((h) => (
              <HorizonCard key={h.label} {...h} currency={stats?.base_currency ?? 'AUD'} />
            ))}
          </ScrollView>
        </View>
      )}

      {!stats && !isRefreshing && (
        <View className="px-5 py-10 items-center">
          <Text className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Loading dashboard…
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

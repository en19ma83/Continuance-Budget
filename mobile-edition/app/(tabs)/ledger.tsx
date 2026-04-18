import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  useColorScheme,
  PanResponder,
  Animated,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ledgerApi, LedgerEntry } from '../../utils/api';

type ViewMode = 'timeline' | 'calendar';

function EntryRow({ entry, currency }: { entry: LedgerEntry; currency: string }) {
  const isDark = useColorScheme() === 'dark';
  const isProjected = entry.status === 'PROJECTED';
  const fmt = (v: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency, minimumFractionDigits: 0 }).format(v);

  return (
    <View
      className={`flex-row items-center px-4 py-3 border-b ${
        isDark ? 'border-slate-800' : 'border-slate-100'
      } ${isProjected ? 'opacity-60' : ''}`}
    >
      <View className="flex-1">
        <Text
          className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}
          numberOfLines={1}
        >
          {entry.name}
        </Text>
        <Text className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {new Date(entry.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
          {isProjected ? ' · Projected' : ''}
        </Text>
      </View>
      <View className="items-end">
        <Text
          className={`text-sm font-semibold ${
            entry.amount < 0 ? 'text-rose-400' : 'text-emerald-400'
          }`}
        >
          {entry.amount < 0 ? '' : '+'}{fmt(entry.amount)}
        </Text>
        <Text className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {fmt(entry.running_balance)}
        </Text>
      </View>
    </View>
  );
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function SwipeCalendar({ entries }: { entries: LedgerEntry[] }) {
  const isDark = useColorScheme() === 'dark';
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const translateX = useRef(new Animated.Value(0)).current;

  const navigate = useCallback(
    (dir: -1 | 1) => {
      const outX = dir * -300;
      Animated.timing(translateX, { toValue: outX, duration: 180, useNativeDriver: true }).start(() => {
        setCurrentMonth((m) => {
          const next = new Date(m);
          next.setMonth(m.getMonth() + dir);
          return next;
        });
        setSelectedDay(null);
        translateX.setValue(-outX);
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
      });
    },
    [translateX],
  );

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 12 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => translateX.setValue(gs.dx * 0.4),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -60) navigate(1);
        else if (gs.dx > 60) navigate(-1);
        else Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const { year, month, firstDay, totalDays } = useMemo(() => {
    const y = currentMonth.getFullYear();
    const mo = currentMonth.getMonth();
    return {
      year: y,
      month: mo,
      firstDay: new Date(y, mo, 1).getDay(),
      totalDays: new Date(y, mo + 1, 0).getDate(),
    };
  }, [currentMonth]);

  const entriesByDay = useMemo(() => {
    const map: Record<number, LedgerEntry[]> = {};
    entries.forEach((e) => {
      const d = new Date(e.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(e);
      }
    });
    return map;
  }, [entries, year, month]);

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const selectedEntries = selectedDay ? (entriesByDay[selectedDay] ?? []) : [];

  const blanks = Array.from({ length: firstDay });
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);

  return (
    <View className="flex-1">
      {/* Month nav header */}
      <View className="flex-row items-center justify-between px-4 py-2">
        <TouchableOpacity onPress={() => navigate(-1)} className="p-2 pr-4">
          <Text className={`text-xl ${isDark ? 'text-white' : 'text-slate-900'}`}>‹</Text>
        </TouchableOpacity>
        <Text className={`font-semibold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {currentMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={() => navigate(1)} className="p-2 pl-4">
          <Text className={`text-xl ${isDark ? 'text-white' : 'text-slate-900'}`}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day labels */}
      <View className="flex-row px-3 mb-1">
        {DAY_LABELS.map((d, i) => (
          <View key={i} className="flex-1 items-center py-1">
            <Text className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Swipeable grid */}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
        className="flex-row flex-wrap px-3"
      >
        {blanks.map((_, i) => (
          <View key={`b${i}`} className="w-[14.28%] aspect-square" />
        ))}
        {days.map((day) => {
          const dayEntries = entriesByDay[day] ?? [];
          const hasIncome = dayEntries.some((e) => e.amount > 0);
          const hasExpense = dayEntries.some((e) => e.amount < 0);
          const selected = selectedDay === day;
          const todayCell = isToday(day);

          return (
            <TouchableOpacity
              key={day}
              className={`w-[14.28%] aspect-square items-center justify-center rounded-full ${
                selected ? 'bg-sky-500' : todayCell ? (isDark ? 'bg-slate-700' : 'bg-slate-200') : ''
              }`}
              onPress={() => setSelectedDay(selected ? null : day)}
              activeOpacity={0.7}
            >
              <Text
                className={`text-xs font-medium ${
                  selected
                    ? 'text-white'
                    : todayCell
                    ? 'text-sky-400'
                    : isDark
                    ? 'text-slate-300'
                    : 'text-slate-700'
                }`}
              >
                {day}
              </Text>
              <View className="flex-row gap-0.5 mt-0.5">
                {hasIncome && <View className={`w-1 h-1 rounded-full ${selected ? 'bg-white' : 'bg-emerald-400'}`} />}
                {hasExpense && <View className={`w-1 h-1 rounded-full ${selected ? 'bg-white' : 'bg-rose-400'}`} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </Animated.View>

      {/* Selected day entries */}
      {selectedDay && (
        <View className={`mt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'} flex-1`}>
          <Text className={`px-4 pt-3 pb-2 text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {new Date(year, month, selectedDay).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          {selectedEntries.length === 0 ? (
            <Text className={`px-4 py-2 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              No transactions
            </Text>
          ) : (
            selectedEntries.map((e) => (
              <EntryRow key={e.id} entry={e} currency={e.currency || 'AUD'} />
            ))
          )}
        </View>
      )}
    </View>
  );
}

export default function LedgerScreen() {
  const isDark = useColorScheme() === 'dark';
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');

  const { data: entries = [], refetch, isFetching } = useQuery({
    queryKey: ['ledger'],
    queryFn: () => ledgerApi.list(),
  });

  const renderItem = useCallback(
    ({ item }: { item: LedgerEntry }) => (
      <EntryRow entry={item} currency={item.currency || 'AUD'} />
    ),
    [],
  );

  return (
    <View className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
      {/* Header */}
      <View className="px-5 pt-14 pb-3 flex-row items-center justify-between">
        <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Ledger
        </Text>
        <View className={`flex-row rounded-lg p-0.5 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
          {(['timeline', 'calendar'] as ViewMode[]).map((m) => (
            <TouchableOpacity
              key={m}
              className={`px-3 py-1 rounded-md ${viewMode === m ? 'bg-sky-500' : ''}`}
              onPress={() => setViewMode(m)}
            >
              <Text
                className={`text-xs font-medium ${
                  viewMode === m ? 'text-white' : isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {m === 'timeline' ? 'Timeline' : 'Calendar'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {viewMode === 'timeline' ? (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#0ea5e9" />
          }
          ListEmptyComponent={
            <View className="py-16 items-center">
              <Text className={isDark ? 'text-slate-500' : 'text-slate-400'}>No entries yet</Text>
            </View>
          }
        />
      ) : (
        <SwipeCalendar entries={entries} />
      )}
    </View>
  );
}

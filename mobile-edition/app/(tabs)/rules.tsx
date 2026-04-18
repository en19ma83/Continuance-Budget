import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert, useColorScheme } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rulesApi, Rule } from '../../utils/api';
import { Trash2 } from 'lucide-react-native';

const FREQ_LABELS: Record<string, string> = {
  WEEKLY: 'Weekly',
  FORTNIGHTLY: 'Fortnightly',
  MONTHLY_DATE: 'Monthly',
  ANNUAL: 'Annual',
  ONCE: 'Once',
};

function RuleRow({ rule, onDelete }: { rule: Rule; onDelete: () => void }) {
  const isDark = useColorScheme() === 'dark';
  const fmt = (v: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 }).format(v);

  return (
    <View className={`flex-row items-center px-4 py-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
      <View className="flex-1">
        <Text className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{rule.name}</Text>
        <Text className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {FREQ_LABELS[rule.frequency_type] ?? rule.frequency_type} · {rule.entity}
        </Text>
      </View>
      <Text className={`text-sm font-semibold mr-4 ${rule.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
        {rule.amount < 0 ? '' : '+'}{fmt(rule.amount)}
      </Text>
      <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Trash2 size={16} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
}

export default function RulesScreen() {
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();

  const { data: rules = [], refetch, isFetching } = useQuery({
    queryKey: ['rules'],
    queryFn: rulesApi.list,
  });

  const { mutate: deleteRule } = useMutation({
    mutationFn: rulesApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rules'] }),
  });

  const confirmDelete = (rule: Rule) => {
    Alert.alert(
      'Delete Rule',
      `Delete "${rule.name}"? This will also remove its projected ledger entries.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteRule(rule.id) },
      ],
    );
  };

  return (
    <View className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
      <View className="px-5 pt-14 pb-3">
        <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Rules</Text>
        <Text className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {rules.length} recurring {rules.length === 1 ? 'rule' : 'rules'}
        </Text>
      </View>

      <FlatList
        data={rules}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RuleRow rule={item} onDelete={() => confirmDelete(item)} />}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor="#0ea5e9" />}
        ListEmptyComponent={
          <View className="py-16 items-center">
            <Text className={isDark ? 'text-slate-500' : 'text-slate-400'}>No rules yet</Text>
          </View>
        }
      />
    </View>
  );
}

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountsApi, categoriesApi, ledgerApi, Account } from '../utils/api';
import { useQuickAdd } from '../contexts/QuickAddContext';
import { ChevronRight, X } from 'lucide-react-native';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.75;

type PickerMode = 'account' | 'category' | null;

export function QuickAddSheet() {
  const { isOpen, close } = useQuickAdd();
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();

  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Form state
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.list() });
  const { data: categoryGroups = [] } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.groups });
  const allCategories = categoryGroups.flatMap((g) => g.categories.map((c) => ({ ...c, groupName: g.name })));

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const selectedCategory = allCategories.find((c) => c.id === selectedCategoryId);

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [isOpen]);

  const { mutate: createTransaction, isPending } = useMutation({
    mutationFn: () => {
      const parsed = parseFloat(amount.replace(',', '.'));
      if (isNaN(parsed) || !selectedAccountId) throw new Error('Amount and account are required');
      return ledgerApi.createTransaction({
        date: date.toISOString().split('T')[0],
        name: name.trim() || 'Quick Add',
        amount: parsed,
        account_id: selectedAccountId,
        ...(selectedCategoryId ? { category_id: selectedCategoryId } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      handleClose();
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  const handleClose = () => {
    Keyboard.dismiss();
    setAmount('');
    setName('');
    setDate(new Date());
    setSelectedAccountId(null);
    setSelectedCategoryId(null);
    setPickerMode(null);
    setShowDatePicker(false);
    close();
  };

  const bg = isDark ? '#1e293b' : '#ffffff';
  const cardBg = isDark ? '#0f172a' : '#f8fafc';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const mutedColor = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  if (!isOpen) return null;

  // Sub-picker overlay
  if (pickerMode) {
    const items =
      pickerMode === 'account'
        ? accounts.map((a) => ({ id: a.id, label: a.name, sub: `${a.type} · ${a.entity}` }))
        : allCategories.map((c) => ({ id: c.id, label: c.name, sub: c.groupName }));

    const onSelect = (id: string) => {
      if (pickerMode === 'account') setSelectedAccountId(id);
      else setSelectedCategoryId(id);
      setPickerMode(null);
    };

    return (
      <Modal transparent animationType="slide" visible>
        <View style={{ flex: 1, backgroundColor: bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: borderColor }}>
            <TouchableOpacity onPress={() => setPickerMode(null)} style={{ marginRight: 12 }}>
              <X size={20} color={textColor} />
            </TouchableOpacity>
            <Text style={{ color: textColor, fontSize: 17, fontWeight: '600' }}>
              {pickerMode === 'account' ? 'Select Account' : 'Select Category'}
            </Text>
          </View>
          <ScrollView>
            {pickerMode === 'category' && (
              <TouchableOpacity
                onPress={() => { setSelectedCategoryId(null); setPickerMode(null); }}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: borderColor }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: mutedColor, fontSize: 14 }}>No category</Text>
                </View>
              </TouchableOpacity>
            )}
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => onSelect(item.id)}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: borderColor }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: textColor, fontSize: 15, fontWeight: '500' }}>{item.label}</Text>
                  <Text style={{ color: mutedColor, fontSize: 12, marginTop: 2 }}>{item.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    );
  }

  return (
    <Modal transparent visible={isOpen} onRequestClose={handleClose}>
      {/* Backdrop */}
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', opacity }}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={{ flex: 1 }} />
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
      >
        <Animated.View
          style={{
            height: SHEET_HEIGHT,
            backgroundColor: bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            transform: [{ translateY }],
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: borderColor }} />
          </View>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 }}>
            <Text style={{ color: textColor, fontSize: 18, fontWeight: '700' }}>Quick Add</Text>
            <TouchableOpacity onPress={handleClose}>
              <X size={20} color={mutedColor} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
            {/* Amount */}
            <TextInput
              style={{
                color: textColor,
                fontSize: 40,
                fontWeight: '700',
                textAlign: 'center',
                backgroundColor: cardBg,
                borderRadius: 16,
                padding: 20,
                marginBottom: 12,
              }}
              placeholder="$0.00"
              placeholderTextColor={mutedColor}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              autoFocus
            />

            {/* Name */}
            <TextInput
              style={{
                color: textColor,
                fontSize: 15,
                backgroundColor: cardBg,
                borderRadius: 12,
                padding: 14,
                marginBottom: 12,
              }}
              placeholder="Description (optional)"
              placeholderTextColor={mutedColor}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
            />

            {/* Account picker */}
            <TouchableOpacity
              onPress={() => setPickerMode('account')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: cardBg,
                borderRadius: 12,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: mutedColor, fontSize: 11, marginBottom: 2 }}>ACCOUNT</Text>
                <Text style={{ color: selectedAccount ? textColor : mutedColor, fontSize: 15 }}>
                  {selectedAccount?.name ?? 'Select account…'}
                </Text>
              </View>
              <ChevronRight size={16} color={mutedColor} />
            </TouchableOpacity>

            {/* Category picker */}
            <TouchableOpacity
              onPress={() => setPickerMode('category')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: cardBg,
                borderRadius: 12,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: mutedColor, fontSize: 11, marginBottom: 2 }}>CATEGORY</Text>
                <Text style={{ color: selectedCategory ? textColor : mutedColor, fontSize: 15 }}>
                  {selectedCategory?.name ?? 'No category'}
                </Text>
              </View>
              <ChevronRight size={16} color={mutedColor} />
            </TouchableOpacity>

            {/* Date */}
            <TouchableOpacity
              onPress={() => setShowDatePicker(!showDatePicker)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: cardBg,
                borderRadius: 12,
                padding: 14,
                marginBottom: 24,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: mutedColor, fontSize: 11, marginBottom: 2 }}>DATE</Text>
                <Text style={{ color: textColor, fontSize: 15 }}>
                  {date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </View>
              <ChevronRight size={16} color={mutedColor} />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(_, selected) => {
                  if (Platform.OS === 'android') setShowDatePicker(false);
                  if (selected) setDate(selected);
                }}
                style={{ marginBottom: 16 }}
              />
            )}

            {/* Submit */}
            <TouchableOpacity
              onPress={() => createTransaction()}
              disabled={isPending || !amount || !selectedAccountId}
              style={{
                backgroundColor: !amount || !selectedAccountId ? (isDark ? '#1e3a5f' : '#bae6fd') : '#0ea5e9',
                borderRadius: 14,
                padding: 16,
                alignItems: 'center',
              }}
              activeOpacity={0.85}
            >
              {isPending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Add Transaction</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

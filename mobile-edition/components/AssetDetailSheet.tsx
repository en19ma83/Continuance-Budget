import { useRef, useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assetsApi, Asset } from '../utils/api';
import { X } from 'lucide-react-native';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.45;

interface Props {
  asset: Asset | null;
  onClose: () => void;
}

export function AssetDetailSheet({ asset, onClose }: Props) {
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [value, setValue] = useState('');

  useEffect(() => {
    if (asset) {
      setValue(asset.current_value.toString());
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [asset]);

  const { mutate: updateValue, isPending } = useMutation({
    mutationFn: () => {
      const parsed = parseFloat(value.replace(',', '.'));
      if (isNaN(parsed)) throw new Error('Enter a valid number');
      return assetsApi.updateValue(asset!.id, parsed);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      onClose();
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  });

  if (!asset) return null;

  const bg = isDark ? '#1e293b' : '#ffffff';
  const cardBg = isDark ? '#0f172a' : '#f8fafc';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const mutedColor = isDark ? '#64748b' : '#94a3b8';

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: asset.currency || 'AUD',
      minimumFractionDigits: 0,
    }).format(v);

  return (
    <Modal transparent visible={!!asset} onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', opacity }}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={{ flex: 1 }} />
        </TouchableWithoutFeedback>
      </Animated.View>

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
            padding: 24,
            transform: [{ translateY }],
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? '#334155' : '#e2e8f0' }} />
          </View>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View>
              <Text style={{ color: textColor, fontSize: 18, fontWeight: '700' }}>{asset.name}</Text>
              <Text style={{ color: mutedColor, fontSize: 12, marginTop: 2 }}>
                {asset.type} · {asset.entity} {asset.is_liability ? '· Liability' : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={mutedColor} />
            </TouchableOpacity>
          </View>

          {/* Stat row */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
            <View style={{ flex: 1, backgroundColor: cardBg, borderRadius: 12, padding: 12 }}>
              <Text style={{ color: mutedColor, fontSize: 10, marginBottom: 4 }}>CURRENT VALUE</Text>
              <Text style={{ color: textColor, fontSize: 16, fontWeight: '600' }}>{fmt(asset.current_value)}</Text>
            </View>
            {asset.equity != null && (
              <View style={{ flex: 1, backgroundColor: cardBg, borderRadius: 12, padding: 12 }}>
                <Text style={{ color: mutedColor, fontSize: 10, marginBottom: 4 }}>EQUITY</Text>
                <Text style={{ color: asset.equity >= 0 ? '#34d399' : '#f87171', fontSize: 16, fontWeight: '600' }}>
                  {fmt(asset.equity)}
                </Text>
              </View>
            )}
          </View>

          {/* Update value input */}
          <Text style={{ color: mutedColor, fontSize: 11, marginBottom: 6 }}>UPDATE CURRENT VALUE</Text>
          <TextInput
            style={{
              backgroundColor: cardBg,
              color: textColor,
              borderRadius: 12,
              padding: 14,
              fontSize: 16,
              marginBottom: 14,
            }}
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder="Enter new value"
            placeholderTextColor={mutedColor}
          />

          <TouchableOpacity
            onPress={() => updateValue()}
            disabled={isPending}
            style={{
              backgroundColor: '#0ea5e9',
              borderRadius: 12,
              padding: 14,
              alignItems: 'center',
            }}
            activeOpacity={0.85}
          >
            {isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>Save Value</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

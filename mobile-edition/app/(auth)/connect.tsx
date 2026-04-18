import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useEdition } from '../../contexts/EditionContext';
import { Sparkles } from 'lucide-react-native';

// Replace with the real Pro managed endpoint URL once Pro launches
const PRO_MANAGED_URL = 'https://api.continuancefinance.com';

export default function ConnectScreen() {
  const [url, setUrl] = useState('');
  const [checking, setChecking] = useState(false);
  const { setBackendUrl } = useAuth();
  const { refresh: refreshEdition } = useEdition();
  const router = useRouter();

  const connect = async (targetUrl: string) => {
    const trimmed = targetUrl.trim().replace(/\/$/, '');
    if (!trimmed) return;
    setChecking(true);
    try {
      const res = await fetch(`${trimmed}/health`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('Backend returned an error');
      await setBackendUrl(trimmed);
      // Fetch edition metadata so feature flags are ready before login
      await refreshEdition(trimmed);
      router.replace('/(auth)/login');
    } catch {
      Alert.alert(
        'Cannot reach backend',
        'Make sure your instance is running and the URL is correct.',
      );
    } finally {
      setChecking(false);
    }
  };

  const handleConnectPro = () => {
    Alert.alert(
      'Connect to Continuance Pro',
      'This will connect to the managed Pro backend. You will need a Pro account to sign in.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Connect', onPress: () => connect(PRO_MANAGED_URL) },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-900"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-4xl font-bold text-white mb-2">Continuance</Text>
        <Text className="text-slate-400 text-base mb-10">
          Enter the URL of your self-hosted Community Edition backend.
        </Text>

        <Text className="text-slate-300 text-sm mb-2">Backend URL</Text>
        <TextInput
          className="bg-slate-800 text-white rounded-xl px-4 py-4 text-base mb-4"
          placeholder="https://budgeter.my-domain.com"
          placeholderTextColor="#64748b"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={() => connect(url)}
        />

        <TouchableOpacity
          className="bg-sky-500 rounded-xl py-4 items-center mb-6"
          onPress={() => connect(url)}
          disabled={checking || !url.trim()}
          activeOpacity={0.8}
        >
          {checking ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-base">Connect</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View className="flex-row items-center gap-3 mb-6">
          <View className="flex-1 h-px bg-slate-700" />
          <Text className="text-slate-500 text-xs">or</Text>
          <View className="flex-1 h-px bg-slate-700" />
        </View>

        {/* Pro shortcut */}
        <TouchableOpacity
          className="border border-amber-500 rounded-xl py-4 items-center flex-row justify-center gap-2"
          onPress={handleConnectPro}
          disabled={checking}
          activeOpacity={0.8}
        >
          <Sparkles size={16} color="#f59e0b" />
          <Text className="text-amber-400 font-semibold text-base">
            I have a Continuance Pro account
          </Text>
        </TouchableOpacity>

        <Text className="text-slate-500 text-xs text-center mt-8">
          Don't have a backend? Visit the Continuance Finance GitHub to get started with the Community Edition.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

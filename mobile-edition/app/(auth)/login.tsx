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
  ScrollView,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../utils/api';

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, backendUrl, setBackendUrl } = useAuth();

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    try {
      if (mode === 'register') {
        await authApi.register(username.trim(), password);
      }
      await login(username.trim(), password);
    } catch (e: any) {
      Alert.alert(mode === 'login' ? 'Login failed' : 'Registration failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const passwordRules = [
    { label: '8–16 characters', pass: password.length >= 8 && password.length <= 16 },
    { label: 'Uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', pass: /[a-z]/.test(password) },
    { label: 'Number', pass: /\d/.test(password) },
    { label: 'Special character', pass: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-900"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} className="px-6">
        <Text className="text-4xl font-bold text-white mb-1">Continuance</Text>
        <Text className="text-slate-400 text-sm mb-1">{backendUrl}</Text>
        <TouchableOpacity onPress={() => setBackendUrl('')}>
          <Text className="text-sky-400 text-xs mb-8">Change backend</Text>
        </TouchableOpacity>

        {/* Mode toggle */}
        <View className="flex-row bg-slate-800 rounded-xl p-1 mb-6">
          {(['login', 'register'] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              className={`flex-1 py-2 rounded-lg items-center ${mode === m ? 'bg-sky-500' : ''}`}
              onPress={() => setMode(m)}
            >
              <Text className={`font-semibold ${mode === m ? 'text-white' : 'text-slate-400'}`}>
                {m === 'login' ? 'Sign In' : 'Register'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-slate-300 text-sm mb-2">Username</Text>
        <TextInput
          className="bg-slate-800 text-white rounded-xl px-4 py-4 text-base mb-4"
          placeholder="username"
          placeholderTextColor="#64748b"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />

        <Text className="text-slate-300 text-sm mb-2">Password</Text>
        <TextInput
          className="bg-slate-800 text-white rounded-xl px-4 py-4 text-base mb-4"
          placeholder="password"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        {mode === 'register' && password.length > 0 && (
          <View className="mb-4 gap-1">
            {passwordRules.map((r) => (
              <Text key={r.label} className={`text-xs ${r.pass ? 'text-emerald-400' : 'text-slate-500'}`}>
                {r.pass ? '✓' : '○'} {r.label}
              </Text>
            ))}
          </View>
        )}

        <TouchableOpacity
          className="bg-sky-500 rounded-xl py-4 items-center mt-2"
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-base">
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

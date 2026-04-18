import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  useColorScheme,
  Alert,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../contexts/AuthContext';

export function LockScreen() {
  const { unlock, logout } = useAuth();
  const isDark = useColorScheme() === 'dark';
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const pulse = () => {
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.12, duration: 160, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  };

  const authenticate = async () => {
    pulse();
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Continuance Finance',
      fallbackLabel: 'Use password',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    if (result.success) {
      unlock();
    } else if (result.error === 'user_fallback') {
      // User tapped "Use password" — sign them out so they re-enter credentials
      Alert.alert(
        'Sign in again',
        'Please sign in with your username and password.',
        [{ text: 'OK', onPress: logout }],
      );
    }
  };

  useEffect(() => {
    const timer = setTimeout(authenticate, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
      }}
    >
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 32, fontWeight: '700', color: isDark ? '#f8fafc' : '#0f172a' }}>
          Continuance
        </Text>
        <Text style={{ fontSize: 14, color: isDark ? '#64748b' : '#94a3b8' }}>
          Locked
        </Text>
      </View>

      <TouchableOpacity onPress={authenticate} activeOpacity={0.8}>
        <Animated.View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: '#0ea5e9',
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pulseAnim }],
          }}
        >
          <Text style={{ fontSize: 32 }}>🔒</Text>
        </Animated.View>
      </TouchableOpacity>

      <Text style={{ fontSize: 14, color: isDark ? '#64748b' : '#94a3b8' }}>
        Tap to authenticate
      </Text>

      <TouchableOpacity onPress={logout} style={{ marginTop: 8 }}>
        <Text style={{ color: '#ef4444', fontSize: 13 }}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { toUserMessage } from '@/core/api/errors';
import { useAuth } from '@/core/auth/AuthProvider';
import { GoogleSignInCancelledError, getGoogleIdToken } from '@/core/auth/googleSignIn';
import { decodeIdTokenClaims, describeIdTokenForSpike } from '@/core/auth/idTokenClaims';
import { getEnv } from '@/core/config/env';

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePress = async () => {
    setBusy(true);
    setError(null);
    try {
      if (__DEV__) {
        // Chỉ chạy trong bản dev, phục vụ spike R1: lấy token trước để đọc claim,
        // rồi vẫn đi tiếp luồng đăng nhập bình thường bên dưới.
        const idToken = await getGoogleIdToken();
        console.log(describeIdTokenForSpike(decodeIdTokenClaims(idToken), getEnv().googleWebClientId));
      }
      await signInWithGoogle();
    } catch (err) {
      if (!(err instanceof GoogleSignInCancelledError)) {
        setError(toUserMessage(err).description);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-bg px-6">
      <Text className="text-2xl font-bold text-text-main">SkillSwap</Text>
      <Text className="text-center text-text-muted">
        Đăng nhập bằng tài khoản Google của trường để tiếp tục.
      </Text>

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={handlePress}
        className="h-control-lg w-full items-center justify-center rounded-md bg-primary"
      >
        {busy ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="font-semibold text-white">Đăng nhập với Google</Text>
        )}
      </Pressable>

      {error ? <Text className="text-center text-danger">{error}</Text> : null}
    </View>
  );
}

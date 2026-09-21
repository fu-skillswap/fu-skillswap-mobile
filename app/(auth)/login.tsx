import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { toUserMessage } from '@/core/api/errors';
import { useAuth } from '@/core/auth/AuthProvider';
import { GoogleSignInCancelledError } from '@/core/auth/googleSignIn';

export default function LoginScreen() {
  const { status, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Đã có phiên hợp lệ (ví dụ vừa đăng nhập xong) thì rời màn hình này ngay,
  // không tự vẽ lại nút đăng nhập — nếu không người dùng sẽ kẹt ở đây mãi vì
  // không còn ai theo dõi việc status chuyển sang 'authenticated'.
  if (status === 'authenticated') {
    return <Redirect href="/(tabs)" />;
  }

  const handlePress = async () => {
    setBusy(true);
    setError(null);
    try {
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

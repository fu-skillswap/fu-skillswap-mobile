import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/core/auth/AuthProvider';
import { resolveAuthRoute } from '@/core/auth/authRoute';
import { colors } from '@/core/ui/theme';

export default function IndexScreen() {
  const { status, user } = useAuth();
  const route = resolveAuthRoute(status, user);

  if (route.kind === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (route.kind === 'tabs') {
    return <Redirect href="/(tabs)" />;
  }
  if (route.kind === 'unsupported') {
    return <Redirect href="/(auth)/unsupported-account" />;
  }
  return <Redirect href="/(auth)/login" />;
}

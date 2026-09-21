import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useAuth } from '@/core/auth/AuthProvider';
import { resolveAuthRoute } from '@/core/auth/authRoute';
import { colors } from '@/core/ui/theme';

/**
 * Màn hình cho tài khoản ADMIN/SYSTEM_ADMIN — vai trò mà mobile không phục vụ
 * (xem `core/config/tabs.ts#isMobileSupportedAccount`).
 *
 * ĐÂY LÀ TRẠNG THÁI CUỐI (terminal): không được render `<Redirect>` khi
 * `resolveAuthRoute()` trả về `unsupported`. Trước đây `login.tsx` tự ý
 * redirect sang `(tabs)` mỗi khi `status === 'authenticated'`, còn
 * `(tabs)/_layout.tsx` lại redirect ngược về `login` vì vai trò không hỗ trợ —
 * với ADMIN, hai điều kiện cùng đúng nên hai màn hình đẩy nhau vô hạn (màn
 * hình đơ, CPU chạy hết công suất, không cách nào thoát). Màn hình này chỉ
 * dừng lại và chờ người dùng bấm đăng xuất — không tự ý điều hướng đi đâu khi
 * đang ở trạng thái `unsupported`.
 *
 * Sau khi đăng xuất thành công, `status` chuyển sang `unauthenticated` —
 * lúc đó `resolveAuthRoute()` trả về `login` và màn hình MỚI được phép
 * chuyển tiếp sang `/(auth)/login`, đây là một lần chuyển trạng thái thật sự
 * (không phải vòng lặp) vì tài khoản đã đăng nhập lại thì mới có thể quay lại
 * `unsupported`.
 */
export default function UnsupportedAccountScreen() {
  const { status, user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const route = resolveAuthRoute(status, user);

  if (route.kind === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (route.kind === 'login') {
    return <Redirect href="/(auth)/login" />;
  }
  if (route.kind === 'tabs') {
    return <Redirect href="/(tabs)" />;
  }

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
    } catch {
      // signOut() ném lỗi khi authRepo.logout() thất bại (ví dụ mất mạng),
      // nhưng phiên cục bộ đã được dọn ở nhánh finally của AuthProvider trước
      // khi lỗi được ném ra ngoài — nuốt lỗi ở đây là đúng, xem profile.tsx.
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center gap-6 bg-bg px-6">
      <Text className="text-center text-2xl font-bold text-text-main">
        Tài khoản không được hỗ trợ
      </Text>
      <Text className="text-center text-text-muted">
        Ứng dụng di động SkillSwap chỉ phục vụ tài khoản mentee và mentor. Tài
        khoản quản trị viên ({user?.roles.join(', ')}) vui lòng dùng phiên bản
        web để tiếp tục.
      </Text>

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => {
          void handleSignOut();
        }}
        className="h-control-lg w-full items-center justify-center rounded-md bg-primary"
      >
        {busy ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="font-semibold text-white">Đăng xuất</Text>
        )}
      </Pressable>
    </View>
  );
}

import { Pressable, Text, View } from 'react-native';

import { useAuth } from '@/core/auth/AuthProvider';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // signOut() ném lỗi khi authRepo.logout() thất bại (ví dụ mất mạng),
      // nhưng phiên cục bộ (cookie, access token, trạng thái) đã được dọn ở
      // nhánh finally của AuthProvider trước khi lỗi được ném ra ngoài — nuốt
      // lỗi ở đây là đúng, không phải che giấu sự cố.
    }
  };

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-bg px-6">
      <Text className="text-lg font-semibold text-text-main">{user?.fullName}</Text>
      <Text className="text-text-muted">{user?.email}</Text>
      <Text className="text-text-muted">Vai trò: {user?.roles.join(', ')}</Text>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void handleSignOut();
        }}
        className="h-control-md items-center justify-center rounded-md border border-border-color px-6"
      >
        <Text className="text-danger">Đăng xuất</Text>
      </Pressable>
    </View>
  );
}

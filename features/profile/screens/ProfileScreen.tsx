/**
 * @file ProfileScreen.tsx
 * @description Tab Hồ sơ: thông tin từ phiên đăng nhập, hồ sơ sinh viên, đăng xuất.
 *
 * Hai nguồn dữ liệu độc lập nên mỗi bên tự quyết trạng thái của mình: thông tin
 * phiên (`useAuth`) luôn có sẵn nên hiện ngay; hồ sơ sinh viên là một query
 * riêng, hỏng hay chưa có thì cũng KHÔNG được xoá phần trên khỏi màn hình.
 */

import { ScrollView, Text, View } from 'react-native';

import { trangThaiTai } from '@/core/api/queryState';
import { useAuth } from '@/core/auth/AuthProvider';
import { Button } from '@/core/ui/Button';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { useStudentProfile } from '@/features/profile/hooks/useProfileQueries';

/** Một dòng "nhãn — giá trị"; bỏ hẳn dòng khi không có giá trị */
function Dong({ nhan, giaTri }: { nhan: string; giaTri: string | null | undefined }) {
  if (!giaTri) {
    return null;
  }
  return (
    <View className="flex-row justify-between gap-4 py-2">
      <Text className="text-text-muted">{nhan}</Text>
      <Text className="flex-1 text-right text-text-main">{giaTri}</Text>
    </View>
  );
}

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const hoSo = useStudentProfile();

  const trangThaiHoSo = trangThaiTai({
    isPaused: hoSo.isPaused,
    isPending: hoSo.isPending,
    isError: hoSo.isError,
    // `null` là "chưa tạo hồ sơ" — vẫn là một câu trả lời thành công, nên tính
    // là ĐÃ có dữ liệu. Dùng `!= null` ở đây thì một lần tải lại hụt sóng sau đó
    // sẽ đổi lời mời tạo hồ sơ thành ErrorView.
    coDuLieu: hoSo.data !== undefined,
  });

  const dangXuat = async () => {
    try {
      await signOut();
    } catch {
      // Phiên cục bộ (cookie, access token, trạng thái) đã được dọn ở nhánh
      // finally của AuthProvider TRƯỚC khi lỗi được ném ra — nuốt lỗi ở đây là
      // đúng, không phải che giấu sự cố.
    }
  };

  return (
    <Screen testID="man-hinh-ho-so">
      <OfflineBanner />
      <ScrollView contentContainerClassName="gap-4 p-4">
        <View className="items-center gap-1 rounded-lg bg-surface p-4">
          <Text className="text-lg font-semibold text-text-main">{user?.fullName}</Text>
          <Text className="text-text-muted">{user?.email}</Text>
          <Text className="text-xs text-text-muted">{user?.roles.join(' · ')}</Text>
        </View>

        <View className="rounded-lg bg-surface p-4">
          <Text className="pb-2 text-base font-semibold text-text-main">Hồ sơ sinh viên</Text>

          {trangThaiHoSo === 'mat-ket-noi' ? (
            <EmptyState title="Không có kết nối" description="Hồ sơ sẽ tải khi có mạng trở lại." />
          ) : trangThaiHoSo === 'loi' ? (
            <ErrorView error={hoSo.error} onAction={() => void hoSo.refetch()} />
          ) : hoSo.data === null ? (
            <EmptyState
              title="Chưa có hồ sơ sinh viên"
              description="Hoàn thành hồ sơ để mentor biết bạn đang học ngành nào."
            />
          ) : (
            <View>
              <Dong nhan="Mã sinh viên" giaTri={hoSo.data?.studentCode} />
              <Dong nhan="Cơ sở" giaTri={hoSo.data?.campus?.name} />
              <Dong nhan="Ngành" giaTri={hoSo.data?.program?.nameVi} />
              <Dong nhan="Chuyên ngành" giaTri={hoSo.data?.specialization?.nameVi} />
              {/* `semester` có thể là 0 và 0 là học kỳ HỢP LỆ (§5.2), nên phải so
                  với null thay vì dựa vào giá trị falsy. */}
              <Dong
                nhan="Kỳ"
                giaTri={hoSo.data?.semester != null ? `Kỳ ${hoSo.data.semester}` : null}
              />
              <Dong nhan="Giới thiệu" giaTri={hoSo.data?.bio} />
            </View>
          )}
        </View>

        <Button
          label="Đăng xuất"
          variant="danger"
          onPress={() => void dangXuat()}
          testID="nut-dang-xuat"
        />
      </ScrollView>
    </Screen>
  );
}

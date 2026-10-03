/**
 * @file ProfileScreen.tsx
 * @description Tab Hồ sơ: thông tin từ phiên đăng nhập, hồ sơ sinh viên, đăng xuất.
 *
 * Hai nguồn dữ liệu độc lập nên mỗi bên tự quyết trạng thái của mình: thông tin
 * phiên (`useAuth`) luôn có sẵn nên hiện ngay; hồ sơ sinh viên là một query
 * riêng, hỏng hay chưa có thì cũng KHÔNG được xoá phần trên khỏi màn hình.
 *
 * `Profile.dc.html` còn vẽ bốn khối nữa — ví S-coins, card "Trở thành Mentor",
 * menu tài khoản (Hồ sơ học thuật / Lịch hẹn / Thông báo / Ngôn ngữ) và nút bánh
 * răng Cài đặt. Lần này KHÔNG dựng khối nào trong số đó: tất cả đều là lối vào
 * những màn hình repo chưa có, và riêng ví còn vướng ràng buộc ở mục 4.1 của
 * `docs/quy-uoc-dung-giao-dien.md` (bản mobile chỉ xem và tiêu, nút "Nạp" mà
 * thiết kế vẽ là thứ bị cấm). Xem mục (c) của báo cáo.
 */

import { LogOut } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';

import { trangThaiTai } from '@/core/api/queryState';
import { useAuth } from '@/core/auth/AuthProvider';
import { Avatar } from '@/core/ui/Avatar';
import { Card } from '@/core/ui/Card';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { ListRow } from '@/core/ui/ListRow';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { ScreenHeader } from '@/core/ui/ScreenHeader';
import { colors, fonts } from '@/core/ui/theme';
import { useStudentProfile } from '@/features/profile/hooks/useProfileQueries';

/** Một dòng "nhãn — giá trị"; bỏ hẳn dòng khi không có giá trị */
function Dong({ nhan, giaTri }: { nhan: string; giaTri: string | null | undefined }) {
  if (!giaTri) {
    return null;
  }
  return (
    <View className="flex-row justify-between gap-4 py-2">
      <Text className="text-body text-ink-muted" style={{ fontFamily: fonts.medium }}>
        {nhan}
      </Text>
      <Text
        className="flex-1 text-right text-body text-ink"
        style={{ fontFamily: fonts.semibold }}
      >
        {giaTri}
      </Text>
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
      <ScrollView contentContainerClassName="gap-4 px-gutter pb-8 pt-2">
        {/* Tiêu đề màn tab: 26/700, đúng `<h1>` của thiết kế. */}
        <ScreenHeader title="Hồ sơ" size="lg" />

        {/* Card hồ sơ: avatar 64 nền accent, tên 18/700, rồi email và vai trò. */}
        <Card elevated>
          <View className="flex-row items-center gap-3.5">
            <Avatar name={user?.fullName ?? ''} size={64} tone="accent" />
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="text-section-title text-ink" style={{ fontFamily: fonts.bold }}>
                {user?.fullName}
              </Text>
              <Text
                className="text-caption-lg text-ink-body"
                style={{ fontFamily: fonts.regular }}
              >
                {user?.email}
              </Text>
              <Text
                className="text-caption text-ink-muted"
                style={{ fontFamily: fonts.medium }}
              >
                {user?.roles.join(' · ')}
              </Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text
            className="pb-1 text-section-title text-ink"
            style={{ fontFamily: fonts.bold }}
          >
            Hồ sơ sinh viên
          </Text>

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
        </Card>

        {/*
          Thiết kế để Đăng xuất làm hàng CUỐI của khối menu tài khoản, chữ đỏ
          `danger` kèm icon. Khối menu đó không dựng (lý do ở JSDoc đầu file), nên
          hàng này đứng một mình trong card của nó — vẫn đúng dáng `ListRow` cao
          56 và vẫn là hành động duy nhất ở màn này đã nối được việc thật.
        */}
        <Card flush>
          <ListRow
            label="Đăng xuất"
            destructive
            icon={<LogOut size={20} color={colors.danger} strokeWidth={2} />}
            onPress={() => void dangXuat()}
            testID="nut-dang-xuat"
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

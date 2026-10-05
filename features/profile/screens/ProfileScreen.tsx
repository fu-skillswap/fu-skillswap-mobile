/**
 * @file ProfileScreen.tsx
 * @description Tab Hồ sơ: thông tin từ phiên đăng nhập, hồ sơ sinh viên, đăng xuất.
 *
 * Hai nguồn dữ liệu độc lập nên mỗi bên tự quyết trạng thái của mình: thông tin
 * phiên (`useAuth`) luôn có sẵn nên hiện ngay; hồ sơ sinh viên là một query
 * riêng, hỏng hay chưa có thì cũng KHÔNG được xoá phần trên khỏi màn hình.
 *
 * Khối hồ sơ sinh viên dẫn sang màn Hoàn thiện hồ sơ (`/onboarding`): nút
 * "Hoàn thiện hồ sơ" khi chưa có, "Chỉnh sửa" khi đã có.
 *
 * `Profile.dc.html` còn vẽ ba khối nữa — ví S-coins, menu tài khoản (Hồ sơ học thuật / Lịch hẹn / Thông báo / Ngôn ngữ) và nút bánh
 * răng Cài đặt. Lần này KHÔNG dựng khối nào trong số đó: tất cả đều là lối vào
 * những màn hình repo chưa có, và riêng ví còn vướng ràng buộc ở mục 4.1 của
 * `docs/quy-uoc-dung-giao-dien.md` (bản mobile chỉ xem và tiêu, nút "Nạp" mà
 * thiết kế vẽ là thứ bị cấm). Xem mục (c) của báo cáo.
 *
 * ## Card "Trở thành Mentor" / "Chuyển sang chế độ Mentor"
 *
 * Người CHƯA là mentor thấy card "Trở thành Mentor" của thiết kế, dẫn sang màn
 * đăng ký 6 bước (`/mentor-registration`) — màn đó cũng là nơi xem hồ sơ đang
 * chờ duyệt.
 *
 * Với người **ĐÃ là mentor**, cùng chỗ đó là lối chuyển sang thanh tab
 * Mentor, và nó phải có ở đây vì phía Mentee không có chỗ nào khác để chuyển:
 * lối ngược lại nằm trong màn `MentorMore` của thanh Mentor. Card chỉ hiện khi
 * tài khoản THẬT SỰ có cả hai vai trò (`cheDoKhaDung.length === 2`) — với một
 * mentee thuần, nút đó sẽ đưa họ sang một thanh tab mà `quyCheDoVaiTro()` lập
 * tức lùi về, tức là một nút không làm gì cả.
 */

import { useRouter } from 'expo-router';
import { ArrowLeftRight, ChevronRight, LogOut } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { trangThaiTai } from '@/core/api/queryState';
import { useAuth } from '@/core/auth/AuthProvider';
import { useRoleMode } from '@/core/roleMode/RoleModeProvider';
import { Avatar } from '@/core/ui/Avatar';
import { KOKO, KOKO_READING } from '@/core/ui/brand';
import { BrandImage } from '@/core/ui/BrandImage';
import { Card } from '@/core/ui/Card';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { ListRow } from '@/core/ui/ListRow';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { ScreenHeader } from '@/core/ui/ScreenHeader';
import { colors, fonts, radius, spacing } from '@/core/ui/theme';
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
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { cheDoKhaDung, chuyenCheDo } = useRoleMode();
  const hoSo = useStudentProfile();
  const coHaiVaiTro = cheDoKhaDung.length === 2;
  const chuaLaMentor = !cheDoKhaDung.includes('MENTOR');

  const trangThaiHoSo = trangThaiTai({
    isPaused: hoSo.isPaused,
    isPending: hoSo.isPending,
    isError: hoSo.isError,
    // `null` là "chưa tạo hồ sơ" — vẫn là một câu trả lời thành công, nên tính
    // là ĐÃ có dữ liệu. Dùng `!= null` ở đây thì một lần tải lại hụt sóng sau đó
    // sẽ đổi lời mời tạo hồ sơ thành ErrorView.
    coDuLieu: hoSo.data !== undefined,
  });

  const sangCheDoMentor = () => {
    chuyenCheDo('MENTOR');
    /*
      PHẢI điều hướng, không chỉ đổi chế độ. Thanh tab vẽ lại theo chế độ mới và
      tab `profile` bị ẩn (`href: null`), nhưng màn hình ĐANG hiện vẫn là
      `profile` — người dùng sẽ đứng trên một màn không có tab nào sáng.

      `replace` chứ không `push`: stack cũ thuộc thanh tab vừa rời đi, giữ nó lại
      thì nút back của Android sẽ mang người dùng trở về một màn hình của chế độ
      họ vừa thoát ra.
    */
    router.replace('/(tabs)/mentor-dashboard');
  };

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
          <View className="flex-row items-center justify-between pb-1">
            <Text className="text-section-title text-ink" style={{ fontFamily: fonts.bold }}>
              Hồ sơ sinh viên
            </Text>
            {/* Chỉ khi ĐÃ có hồ sơ: chưa có thì lối vào là nút trong trạng thái rỗng bên dưới. */}
            {hoSo.data ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Chỉnh sửa hồ sơ sinh viên"
                onPress={() => router.push('/onboarding')}
                testID="nut-sua-ho-so"
                className="justify-center"
                style={{ minHeight: spacing.touch }}
              >
                <Text className="text-caption-lg text-accent" style={{ fontFamily: fonts.semibold }}>
                  Chỉnh sửa
                </Text>
              </Pressable>
            ) : null}
          </View>

          {trangThaiHoSo === 'mat-ket-noi' ? (
            <EmptyState title="Không có kết nối" description="Hồ sơ sẽ tải khi có mạng trở lại." />
          ) : trangThaiHoSo === 'loi' ? (
            <ErrorView error={hoSo.error} onAction={() => void hoSo.refetch()} />
          ) : hoSo.data === null ? (
            <EmptyState
              title="Chưa có hồ sơ sinh viên"
              description="Hoàn thành hồ sơ để mentor biết bạn đang học ngành nào."
              actionLabel="Hoàn thiện hồ sơ"
              onAction={() => router.push('/onboarding')}
              // Tư thế chuẩn: chưa có gì để đọc và cũng chưa tìm gì không thấy —
              // đây chỉ là một việc chưa làm.
              illustration={
                <BrandImage source={KOKO} size={140} testID="minh-hoa-rong-ho-so" />
              }
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

        {coHaiVaiTro ? (
          <Pressable
            accessibilityRole="button"
            onPress={sangCheDoMentor}
            testID="nut-chuyen-sang-mentor"
            className="flex-row items-center gap-3 bg-surface-tint px-4 py-3.5"
            style={{ borderRadius: radius.lg }}
          >
            <View
              className="h-10 w-10 items-center justify-center bg-surface"
              style={{ borderRadius: radius.input }}
            >
              <ArrowLeftRight size={20} color={colors.accent} strokeWidth={2} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
                Chuyển sang chế độ Mentor
              </Text>
              <Text className="text-caption text-ink-body" style={{ fontFamily: fonts.medium }}>
                Xem tổng quan, lịch đặt và ví S-coin của bạn
              </Text>
            </View>
          </Pressable>
        ) : null}

        {chuaLaMentor ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/mentor-registration')}
            testID="nut-tro-thanh-mentor"
            className="flex-row items-center gap-3 bg-surface-tint px-4 py-3.5"
            style={{ borderRadius: radius.lg }}
          >
            {/*
              `Profile.dc.html` dòng 45: blob `2fb2a1e7…` = `koko-reading.png`,
              cỡ 64×64. Trước đây chỗ này dùng tư thế chuẩn ở cỡ 56 — cả tư thế
              lẫn số đo đều lệch thiết kế.
            */}
            <BrandImage source={KOKO_READING} size={64} testID="minh-hoa-tro-thanh-mentor" />
            <View className="min-w-0 flex-1">
              <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
                Trở thành Mentor
              </Text>
              <Text className="text-caption text-ink-body" style={{ fontFamily: fonts.medium }}>
                Chia sẻ kinh nghiệm với đàn em và nhận S-coins
              </Text>
            </View>
            <ChevronRight size={20} color={colors.accent} strokeWidth={2} />
          </Pressable>
        ) : null}

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

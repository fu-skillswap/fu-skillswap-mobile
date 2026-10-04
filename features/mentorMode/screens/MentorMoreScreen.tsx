/**
 * @file MentorMoreScreen.tsx
 * @description Tab 5 của thanh Mentor ("Thêm"), theo `MentorMore.dc.html`: tiêu
 * đề 26/700, card hồ sơ, rồi các khối menu.
 *
 * ================================================================
 * PHẦN CỦA THIẾT KẾ BỊ BỎ, VÀ VÌ SAO
 * ================================================================
 *
 * Thiết kế có hai khối `<nav>` với 6 hàng. Năm trong số đó dẫn tới màn hình
 * **chưa tồn tại trong repo**, nên bị bỏ hẳn (mục 6 của quy ước: nút chưa nối
 * được việc gì thì đừng dựng):
 *
 * - **Dịch vụ của tôi** → `MentorServices.dc.html`, chưa dựng. Con số "3" bên
 *   phải hàng đó cũng không có endpoint nào được nối.
 * - **Khóa học của tôi** → `MentorCourses.dc.html`, chưa dựng.
 * - **Bài viết của tôi** → `MentorPosts.dc.html`, chưa dựng. (Diễn đàn trong repo
 *   là `features/forum`, một nhánh khác hẳn — `MeBlogController` /
 *   `MentorBlogController` của backend là blog, không phải diễn đàn.)
 * - **Tin nhắn** → tab Tin nhắn của thanh Mentee hiện vẫn là **vỏ rỗng**. Dẫn
 *   sang một vỏ rỗng là một nút chết đi đường vòng. Con số "3" (tin chưa đọc)
 *   cũng không có endpoint nào được nối.
 * - **Trợ giúp & điều khoản** → thiết kế để `href="#"`, tức chính thiết kế cũng
 *   chưa có đích.
 *
 * `MentorMoreScreen.test.tsx` có test canh cho từng mục trên. Khi dựng xong màn
 * tương ứng thì xoá dòng canh VÀ thêm hàng vào đây — đừng chỉ xoá dòng canh.
 *
 * ## Hai thứ được GIỮ, và một thứ được thêm điều kiện
 *
 * - **Card hồ sơ** dẫn sang `/mentor/{userId}` — màn hồ sơ mentor công khai CÓ
 *   THẬT trong repo. Nhưng lối đó chỉ được dựng khi `mentorStatus === 'ACTIVE'`:
 *   `MentorDiscoveryService.isDiscoverableMentor()` đòi đúng trạng thái đó, nên
 *   mọi trạng thái khác sẽ nhận **404 "Không tìm thấy mentor"** — tức là nói với
 *   mentor rằng chính họ không tồn tại. Xem `moTaTrangThaiMentor()`.
 * - **Đăng xuất** là hành động thật, giữ nguyên dáng `ListRow` chữ đỏ của thiết kế.
 * - **"Chuyển sang chế độ Mentee"** chỉ hiện khi tài khoản THẬT SỰ có cả hai vai
 *   trò (`cheDoKhaDung.length === 2`). Với một mentor thuần, nút đó sẽ đưa họ
 *   sang một thanh tab mà `quyCheDoVaiTro()` lập tức lùi về — một nút không làm
 *   gì cả.
 */

import { useRouter } from 'expo-router';
import { ArrowLeftRight, LogOut } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { trangThaiTai } from '@/core/api/queryState';
import { useAuth } from '@/core/auth/AuthProvider';
import { useRoleMode } from '@/core/roleMode/RoleModeProvider';
import { Avatar } from '@/core/ui/Avatar';
import { Card } from '@/core/ui/Card';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { ListRow } from '@/core/ui/ListRow';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { ScreenHeader } from '@/core/ui/ScreenHeader';
import { colors, fonts, radius } from '@/core/ui/theme';
import { useMyMentorProfile } from '@/features/mentorMode/hooks/useMentorModeQueries';
import type { MauTrangThaiMentor } from '@/features/mentorMode/mentorProfileDisplay';
import { moTaTrangThaiMentor } from '@/features/mentorMode/mentorProfileDisplay';

const CLASS_MAU: Record<MauTrangThaiMentor, string> = {
  success: 'text-success-ink',
  warning: 'text-warning-ink',
  neutral: 'text-ink-muted',
};

export function MentorMoreScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { cheDoKhaDung, chuyenCheDo } = useRoleMode();
  const hoSo = useMyMentorProfile();

  const trangThaiHoSo = trangThaiTai({
    isPaused: hoSo.isPaused,
    isPending: hoSo.isPending,
    isError: hoSo.isError,
    // `exists: false` là câu trả lời thành công "chưa tạo hồ sơ" — xem JSDoc của
    // `useMyMentorProfile`.
    coDuLieu: hoSo.data !== undefined,
  });

  const trangThai = moTaTrangThaiMentor(hoSo.data?.mentorStatus ?? null);
  const ten = hoSo.data?.displayName ?? user?.fullName ?? '';
  // `userId` của hồ sơ là `principal.getPublicId()` — chính tham số mà
  // `GET /api/mentors/{mentorUserId}` nhận, nên hai thứ khớp nhau.
  const mentorUserId = hoSo.data?.userId ?? user?.publicId ?? null;
  const xemHoSo = trangThai.xemDuocHoSoCongKhai && mentorUserId != null;
  const coHaiVaiTro = cheDoKhaDung.length === 2;

  const dangXuat = async () => {
    try {
      await signOut();
    } catch {
      // Phiên cục bộ đã được dọn ở nhánh `finally` của `AuthProvider` TRƯỚC khi
      // lỗi được ném ra — nuốt lỗi ở đây là đúng, không phải che giấu sự cố.
      // Cùng quyết định với `ProfileScreen`.
    }
  };

  const veCheDoMentee = () => {
    chuyenCheDo('MENTEE');
    /*
      PHẢI điều hướng, không chỉ đổi chế độ. Thanh tab vẽ lại theo chế độ mới và
      `mentor-more` bị ẩn (`href: null`), nhưng màn hình ĐANG hiện vẫn là
      `mentor-more` — người dùng sẽ đứng trên một màn không có tab nào sáng, và
      không có cách nào đoán phải bấm đâu.

      `replace` chứ không `push`: stack cũ thuộc thanh tab vừa rời đi, giữ nó lại
      thì nút back của Android sẽ mang người dùng trở về một màn hình của chế độ
      họ vừa thoát ra.
    */
    router.replace('/(tabs)');
  };

  const noiDungHoSo = (
    <View className="flex-row items-center gap-3.5">
      <Avatar name={ten} size={64} tone="accent" />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          className="text-section-title text-ink"
          numberOfLines={1}
          style={{ fontFamily: fonts.bold }}
        >
          {ten}
        </Text>
        <Text
          testID="trang-thai-ho-so-mentor"
          className={`text-caption ${CLASS_MAU[trangThai.mau]}`}
          style={{ fontFamily: fonts.bold }}
        >
          {trangThai.label}
        </Text>
        {xemHoSo ? (
          <Text className="text-caption-lg text-accent" style={{ fontFamily: fonts.semibold }}>
            Xem hồ sơ công khai
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <Screen testID="man-hinh-them-mentor">
      <OfflineBanner />
      <ScrollView contentContainerClassName="gap-4 px-gutter pb-28 pt-2">
        {/* Không truyền `onBack`: màn này là một tab, không có gì để quay lại. */}
        <ScreenHeader title="Thêm" size="lg" />

        {trangThaiHoSo === 'dang-tai' ? (
          <View className="py-10">
            <ActivityIndicator testID="dang-tai-ho-so-mentor" color={colors.accent} />
          </View>
        ) : trangThaiHoSo === 'mat-ket-noi' ? (
          <EmptyState
            title="Không có kết nối"
            description="Hồ sơ mentor sẽ tải khi có mạng trở lại."
          />
        ) : trangThaiHoSo === 'loi' ? (
          <ErrorView error={hoSo.error} onAction={() => void hoSo.refetch()} />
        ) : xemHoSo && mentorUserId ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/mentor/${mentorUserId}`)}
            testID="the-ho-so-mentor"
          >
            <Card elevated>{noiDungHoSo}</Card>
          </Pressable>
        ) : (
          // Không `Pressable`: hồ sơ chưa `ACTIVE` thì `GET /api/mentors/{id}`
          // trả 404, nên không có đích để đi.
          <Card elevated testID="the-ho-so-mentor">
            {noiDungHoSo}
          </Card>
        )}

        {coHaiVaiTro ? (
          <Pressable
            accessibilityRole="button"
            onPress={veCheDoMentee}
            testID="nut-chuyen-sang-mentee"
            className="flex-row items-center gap-3 bg-surface-tint px-4 py-3.5"
            style={{ borderRadius: 20 }}
          >
            <View
              className="h-10 w-10 items-center justify-center bg-surface"
              style={{ borderRadius: radius.input }}
            >
              <ArrowLeftRight size={20} color={colors.accent} strokeWidth={2} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-body text-ink" style={{ fontFamily: fonts.bold }}>
                Chuyển sang chế độ Mentee
              </Text>
              <Text className="text-caption text-ink-body" style={{ fontFamily: fonts.medium }}>
                Xem bảng tin, tìm và đặt lịch với mentor khác
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/*
          Khối menu tài khoản của thiết kế có hai hàng; hàng "Trợ giúp & điều
          khoản" bị bỏ (thiết kế để `href="#"`), nên Đăng xuất đứng một mình
          trong card của nó — vẫn đúng dáng `ListRow` cao 56.
        */}
        <Card flush>
          <ListRow
            label="Đăng xuất"
            destructive
            icon={<LogOut size={20} color={colors.danger} strokeWidth={2} />}
            onPress={() => void dangXuat()}
            testID="nut-dang-xuat-mentor"
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

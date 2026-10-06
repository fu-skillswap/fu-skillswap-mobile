/**
 * @file MentorDashboardScreen.tsx
 * @description Tab 1 của thanh Mentor ("Tổng quan"), theo `MentorDashboard.dc.html`.
 *
 * Ba nguồn dữ liệu ĐỘC LẬP, mỗi bên tự quyết trạng thái của mình: hồ sơ mentor
 * (`GET /api/me/mentor-profile`), ví settlement (`GET /api/me/mentor-wallet`) và
 * số yêu cầu đang chờ (`GET /api/me/bookings?role=MENTOR&status=PENDING`). Một
 * bên hỏng KHÔNG được xoá hai bên còn lại khỏi màn hình — ví là endpoint duy
 * nhất đòi đúng vai trò `MENTOR`, nên nó là bên dễ 403 nhất.
 *
 * ================================================================
 * PHẦN CỦA THIẾT KẾ BỊ BỎ, VÀ VÌ SAO
 * ================================================================
 *
 * ## 1. BIỂU ĐỒ CỘT 7 NGÀY bị BỎ — backend không có dữ liệu cho nó
 *
 * Thiết kế vẽ `Thu nhập — 7 ngày gần nhất` với bảy cột. Đã tìm hết các
 * controller của backend: **không có endpoint nào trả chuỗi thời gian thu nhập
 * của mentor.** `AdminDashboardController` là nguồn số liệu duy nhất kiểu đó và
 * nó mang `@PreAuthorize("hasAnyRole('ADMIN','SYSTEM_ADMIN'))"`.
 *
 * Thứ gần nhất là `MentorWalletResponse.recentTransactions`, nhưng nó là **15
 * giao dịch gần nhất** (`findTop15ByAccountIdOrderByCreatedAtDesc`) chứ không
 * phải "mọi giao dịch trong 7 ngày". Dựng biểu đồ từ nó sẽ:
 *
 * - đúng với mentor ít việc (dưới 15 giao dịch trong tuần), và
 * - ÂM THẦM thiếu với mentor nhiều việc — 15 giao dịch có thể chỉ phủ 2 ngày,
 *   và năm cột còn lại sẽ về 0 như thể mentor không dạy gì.
 *
 * Một biểu đồ đúng với người ít việc và sai với người nhiều việc là loại sai tệ
 * nhất: không ai phát hiện được, và nó sai với đúng nhóm quan tâm tới nó nhất.
 * `react-native-svg` đã cài sẵn và không thiếu gì về kỹ thuật — thiếu là dữ
 * liệu. Khi backend có endpoint chuỗi thời gian thì dựng, không trước đó.
 *
 * ## 2. Ô "Thu nhập 7 ngày" bị THAY bằng "Số dư khả dụng"
 *
 * Cùng lý do trên: không có cách nào biết thu nhập của 7 ngày. `availableScoin`
 * thì là con số THẬT, backend tính (`SettlementService.getMentorAvailableSettlement`),
 * và mục 4.1 của quy ước cho phép màn Tổng quan hiện số dư. Nhãn ô đổi theo đúng
 * thứ nó hiện — gắn nhãn "Thu nhập 7 ngày" lên số dư là nói sai.
 *
 * **KHÔNG có lối nạp tiền nào** ở màn này (mục 4.1), và cũng không có lối rút
 * tiền: payout là một quyết định sản phẩm chưa có câu trả lời, nên màn này không
 * tự quyết và không nói gì về nó.
 *
 * ## 3. Ô "Booking tuần này" và ô "Mentee" bị BỎ
 *
 * - **"Booking tuần này"**: không có endpoint đếm theo tuần.
 *   `GET /api/me/bookings` không nhận khoảng ngày (`BookingListRequest` chỉ có
 *   `role`, `status`, `page`, `size`, `sortBy`, `direction`), còn chế độ dashboard
 *   thì cố định 7 ngày trước → 90 ngày tới. Tự lọc "tuần này" trên một danh sách
 *   CÓ PHÂN TRANG sẽ đếm thiếu ngay khi mentor có hơn một trang.
 * - **"Mentee" (số mentee riêng biệt)**: không có endpoint nào trả con số này.
 *   `MentorProfileResponse.completedSessions` là số BUỔI, không phải số người —
 *   một mentee học 5 buổi sẽ được đếm 5 lần. Dùng nó cho ô "Mentee" là in một
 *   con số sai mà trông hoàn toàn hợp lý.
 *
 * Ô "Buổi đã hoàn thành" được thêm vào thay cho hai ô trên: nó đọc đúng
 * `completedSessions` với đúng cái tên của nó.
 *
 * ## 4. Nút chuông Thông báo
 *
 * Dẫn sang màn Thông báo (`/notifications`). Chấm cam đọc từ
 * `/api/me/notifications/unread-count` — xem `ChuongThongBao`.
 *
 * ## 5. Dòng "Đặt chỗ sắp tới" mở chi tiết booking
 *
 * Đúng thiết kế: mỗi dòng dẫn sang `MentorBookingDetail` (`/mentor-booking/<id>`).
 * Lối "Xem tất cả" dẫn sang tab Booking.
 *
 * ## 6. Dải cảnh báo bị treo quyền nhận booking được THÊM
 *
 * Không có trong thiết kế, nhưng `MentorProfileResponse.bookingSuspendedUntil`
 * là dữ liệu thật và `MentorBookingController.cancelBooking` ghi rõ backend tự
 * áp penalty/suspension khi mentor hủy sát giờ. Một mentor đang bị treo mà không
 * được nói gì sẽ thấy "không có booking mới" và kết luận là app hỏng.
 */

import { CircleAlert, ChevronRight, Coins, Star, TriangleAlert, CircleCheckBig } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { trangThaiTai } from '@/core/api/queryState';
import { useAuth } from '@/core/auth/AuthProvider';
import { phanCachNghin } from '@/core/format/soLuong';
import { dinhDangNgayGio } from '@/core/time/localDateTime';
import { dinhDangGio, docOffsetDateTime, nhanNgayNgan } from '@/core/time/offsetDateTime';
import { Avatar } from '@/core/ui/Avatar';
import { Card } from '@/core/ui/Card';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { colors, fonts, radius } from '@/core/ui/theme';
import { useMentorBookingCount, useMentorBookings } from '@/features/booking';
import type { BookingResponse } from '@/features/booking';
import { MentorStatTile } from '@/features/mentorMode/components/MentorStatTile';
import { ChuongThongBao } from '@/features/notification';
import { useMyMentorProfile, useMyMentorWallet } from '@/features/mentorMode/hooks/useMentorModeQueries';
import {
  dangBiTreoNhanBooking,
  matDongHoHcm,
  moTaDanhGiaMentor,
} from '@/features/mentorMode/mentorProfileDisplay';

/** Số dòng "Đặt chỗ sắp tới" hiện trên màn Tổng quan; phần còn lại ở tab Booking */
const SO_DONG_SAP_TOI = 3;

/**
 * Số booking xin về để còn đủ sau khi lọc bỏ buổi đã qua.
 *
 * Chế độ dashboard của `GET /api/me/bookings` cố định khoảng **7 ngày trước →
 * 90 ngày tới**, nên trang đầu CÓ buổi đã diễn ra. Xin đúng 3 rồi lọc sẽ ra một
 * danh sách ngắn hơn 3, có khi rỗng, trong khi mentor vẫn còn lịch phía sau.
 */
const SO_DONG_XIN_VE = 12;

/**
 * Trạng thái legacy (`BookingResponse.status`) đã KẾT THÚC — không bao giờ là
 * "sắp tới" dù giờ bắt đầu còn ở tương lai. Chế độ dashboard của backend trả cả
 * chúng (xếp nhóm cuối, `BookingRepository.findMyMentorBookingsOrderedByDashboardPriority`).
 */
const TRANG_THAI_KET_THUC: ReadonlySet<string> = new Set([
  'REJECTED',
  'EXPIRED',
  'CANCELLED_BY_MENTEE',
  'CANCELLED_BY_MENTOR',
  'COMPLETED',
]);

/**
 * Buổi "sắp tới": chưa bắt đầu, chưa kết thúc/huỷ, sắp theo GIỜ BẮT ĐẦU tăng
 * dần. Backend xếp theo nhóm việc-cần-làm trước rồi mới tới giờ, nên giữ thứ tự
 * đó sẽ đặt một yêu cầu tuần sau lên trên buổi học tối nay.
 *
 * So bằng `mocMs` của `docOffsetDateTime()` chứ không `new Date(chuỗi)`.
 * Booking thiếu `selectedStartTime` bị loại — buổi không có giờ thì không thể
 * là "sắp tới".
 */
export function locBuoiSapToi(
  bookings: readonly BookingResponse[],
  bayGioMs: number,
  soDong: number,
): BookingResponse[] {
  return bookings
    .flatMap((booking) => {
      const moc = docOffsetDateTime(booking.selectedStartTime);
      return moc != null && moc.mocMs >= bayGioMs && !TRANG_THAI_KET_THUC.has(booking.status)
        ? [{ booking, ms: moc.mocMs }]
        : [];
    })
    .sort((a, b) => a.ms - b.ms)
    .slice(0, soDong)
    .map((x) => x.booking);
}

/** Một dòng booking gọn, theo khối "Đặt chỗ sắp tới" của thiết kế */
function DongBookingGon({ booking, onPress }: { booking: BookingResponse; onPress: () => void }) {
  const ngay = nhanNgayNgan(booking.selectedStartTime);
  const gio = dinhDangGio(booking.selectedStartTime);
  const tenMentee = booking.menteeDisplayName ?? 'Mentee';
  const moTa = booking.serviceTitle ?? booking.learningGoalTitle;

  return (
    <Pressable
      testID={`dong-sap-toi-${booking.bookingId}`}
      accessibilityRole="button"
      accessibilityLabel={`${tenMentee}${moTa ? `, ${moTa}` : ''}${ngay ? `, ${ngay}` : ''}${gio ? ` ${gio}` : ''}`}
      onPress={onPress}
      className="flex-row items-center gap-3 border border-line bg-surface px-3.5 py-3"
      style={{ borderRadius: 20 }}
    >
      {/*
        Ô ngày/giờ nền accent. Mốc nào không đọc được thì bỏ hẳn ô đó — thiết kế
        luôn có cả hai, nhưng `selectedStartTime` là nullable thật (slot gốc đã
        bị xoá) và một ô rỗng nền xanh trông như lỗi giao diện.
      */}
      {ngay || gio ? (
        <View
          className="shrink-0 items-center bg-accent px-2 py-1.5"
          style={{ borderRadius: 14, minWidth: 56 }}
        >
          {ngay ? (
            <Text
              className="text-tab-label text-on-accent"
              style={{ fontFamily: fonts.semibold }}
            >
              {ngay}
            </Text>
          ) : null}
          {gio ? (
            <Text
              className="text-body-lg text-on-accent"
              style={{ fontFamily: fonts.extrabold }}
            >
              {gio}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View className="min-w-0 flex-1">
        <Text className="text-body text-ink" numberOfLines={1} style={{ fontFamily: fonts.bold }}>
          {tenMentee}
        </Text>
        <Text
          className="text-caption text-ink-muted"
          numberOfLines={1}
          style={{ fontFamily: fonts.medium }}
        >
          {moTa}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.inkMuted} strokeWidth={2} />
    </Pressable>
  );
}

export function MentorDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const hoSo = useMyMentorProfile();
  const vi = useMyMentorWallet();
  const dangCho = useMentorBookingCount('PENDING');
  const sapToi = useMentorBookings({ size: SO_DONG_XIN_VE });

  /**
   * Chỉ giữ buổi CHƯA diễn ra và chưa kết thúc — xem `locBuoiSapToi`. Backend
   * trả cả buổi trong 7 ngày trước (xem `SO_DONG_XIN_VE`), nên không lọc thì
   * mentor thấy buổi **hôm qua** dưới tiêu đề "sắp tới" (gặp trên máy ảo
   * 05/10/2026), và cả yêu cầu đã huỷ/bị từ chối.
   */
  const danhSachSapToi = locBuoiSapToi(sapToi.bookings, Date.now(), SO_DONG_SAP_TOI);

  const trangThaiHoSo = trangThaiTai({
    isPaused: hoSo.isPaused,
    isPending: hoSo.isPending,
    isError: hoSo.isError,
    // `exists: false` là một câu trả lời THÀNH CÔNG ("chưa tạo hồ sơ"), nên
    // `data !== undefined` mới là "đã có gì để hiện". Dùng `data?.exists` ở đây
    // thì một mentor chưa điền hồ sơ sẽ thấy spinner quay mãi.
    coDuLieu: hoSo.data !== undefined,
  });

  const trangThaiSapToi = trangThaiTai({
    isPaused: sapToi.isPaused,
    isPending: sapToi.isPending,
    isError: sapToi.isError,
    coDuLieu: sapToi.bookings.length > 0,
  });

  const danhGia = hoSo.data ? moTaDanhGiaMentor(hoSo.data) : null;
  const biTreo = dangBiTreoNhanBooking(hoSo.data?.bookingSuspendedUntil ?? null, matDongHoHcm());
  const hetTreo = dinhDangNgayGio(hoSo.data?.bookingSuspendedUntil);
  // Tên lấy từ hồ sơ mentor trước, rồi mới tới phiên đăng nhập: hai nguồn này
  // cùng là `fullName` của user nên luôn khớp, nhưng hồ sơ có thể chưa tải xong.
  const ten = hoSo.data?.displayName ?? user?.fullName ?? '';
  const soDangCho = dangCho.soLuong;

  return (
    <Screen testID="man-hinh-tong-quan-mentor">
      <OfflineBanner />
      <ScrollView contentContainerClassName="gap-4 px-gutter pb-28 pt-2">
        {/*
          Đầu trang: avatar 44 nền accent + eyebrow "CHẾ ĐỘ MENTOR" + lời chào.
          KHÔNG dùng `ScreenHeader`: component đó chỉ nhận nút back ở bên trái,
          còn ở đây bên trái là avatar — nhồi avatar vào `onBack` sẽ cho một
          avatar có `accessibilityLabel` là "Quay lại".
        */}
        <View className="flex-row items-center gap-3">
          <Avatar name={ten} size={44} tone="accent" />
          <View className="min-w-0 flex-1">
            <Text
              className="text-caption text-accent"
              style={{ fontFamily: fonts.semibold, letterSpacing: 1.4 }}
            >
              CHẾ ĐỘ MENTOR
            </Text>
            <Text
              className="text-section-title text-ink"
              numberOfLines={1}
              style={{ fontFamily: fonts.bold }}
            >
              {ten ? `Chào ${ten}` : 'Chào bạn'}
            </Text>
          </View>
          <ChuongThongBao />
        </View>

        {biTreo ? (
          <View
            testID="dai-canh-bao-treo"
            className="flex-row items-center gap-2.5 bg-warning-soft px-3.5 py-3"
            style={{ borderRadius: radius.md }}
          >
            <TriangleAlert size={20} color={colors.warningInk} strokeWidth={2} />
            <Text
              className="min-w-0 flex-1 text-caption-lg text-ink"
              style={{ fontFamily: fonts.semibold }}
            >
              {hetTreo
                ? `Bạn đang tạm bị dừng nhận booking mới tới ${hetTreo}.`
                : 'Bạn đang tạm bị dừng nhận booking mới.'}
            </Text>
          </View>
        ) : null}

        {/*
          Dải nhắc việc. Chỉ hiện khi CÓ con số và con số đó lớn hơn 0: dải nói
          "0 yêu cầu đang chờ bạn xác nhận" là một lời nhắc về việc không tồn
          tại, và `soLuong === null` (chưa tải / lỗi) thì chưa biết gì để nhắc.
        */}
        {soDangCho != null && soDangCho > 0 ? (
          <Pressable
            testID="dai-yeu-cau-dang-cho"
            accessibilityRole="button"
            onPress={() => router.push('/(tabs)/mentor-bookings')}
            className="flex-row items-center gap-2.5 bg-warning-soft px-3.5 py-3"
            style={{ borderRadius: radius.md }}
          >
            <CircleAlert size={20} color={colors.warningInk} strokeWidth={2} />
            <Text
              className="min-w-0 flex-1 text-caption-lg text-ink"
              style={{ fontFamily: fonts.semibold }}
            >
              {soDangCho} yêu cầu đặt lịch đang chờ bạn xác nhận
            </Text>
            <ChevronRight size={18} color={colors.warningInk} strokeWidth={2} />
          </Pressable>
        ) : null}

        {trangThaiHoSo === 'dang-tai' ? (
          <View className="py-10">
            <ActivityIndicator testID="dang-tai-tong-quan" color={colors.accent} />
          </View>
        ) : trangThaiHoSo === 'mat-ket-noi' ? (
          <EmptyState
            title="Không có kết nối"
            description="Số liệu sẽ tải khi có mạng trở lại."
          />
        ) : trangThaiHoSo === 'loi' ? (
          <ErrorView error={hoSo.error} onAction={() => void hoSo.refetch()} />
        ) : (
          <View className="flex-row flex-wrap gap-2.5">
            {/*
              Ô số dư chỉ hiện khi ví TẢI ĐƯỢC. Endpoint này là cái duy nhất đòi
              đúng vai trò `MENTOR` nên nó là bên dễ 403 nhất, và in "0 S-coin"
              cho một lần gọi thất bại là nói với mentor rằng họ không có tiền.
            */}
            {vi.data ? (
              <MentorStatTile
                label="Số dư khả dụng"
                giaTri={phanCachNghin(vi.data.availableScoin)}
                donVi="S-coin"
                tone="success"
                icon={<Coins size={18} color={colors.successInk} strokeWidth={2} />}
                testID="o-so-du"
              />
            ) : null}

            {danhGia ? (
              <MentorStatTile
                label="Đánh giá"
                giaTri={danhGia.diem ?? danhGia.nhan ?? '—'}
                // Đơn vị chỉ đi kèm khi CÓ điểm: "Chưa có đánh giá / 0 lượt" là
                // một câu lủng củng nói hai lần cùng một chuyện.
                donVi={danhGia.diem && danhGia.soLuot != null ? `/ ${danhGia.soLuot} lượt` : undefined}
                tone="warning"
                icon={<Star size={18} color={colors.warningInk} strokeWidth={2} />}
                testID="o-danh-gia"
              />
            ) : null}

            {/*
              `completedSessions` là `Integer` nullable (hồ sơ mới chưa có số
              nào). `null` thì BỎ hẳn ô chứ không in "0": "0 buổi đã hoàn thành"
              và "chưa biết" là hai chuyện khác nhau.
            */}
            {hoSo.data?.completedSessions != null ? (
              <MentorStatTile
                label="Buổi đã hoàn thành"
                giaTri={phanCachNghin(hoSo.data.completedSessions)}
                icon={<CircleCheckBig size={18} color={colors.accent} strokeWidth={2} />}
                testID="o-buoi-hoan-thanh"
              />
            ) : null}
          </View>
        )}

        <View className="gap-2.5">
          <View className="flex-row items-end justify-between">
            <Text className="text-section-title text-ink" style={{ fontFamily: fonts.bold }}>
              Đặt chỗ sắp tới
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/mentor-bookings')}
              testID="nut-xem-tat-ca-booking"
              // Vùng chạm 44 theo guideline, nhưng chữ phải thẳng hàng đáy với
              // tiêu đề nên padding đặt lệch về phía trên.
              className="min-h-touch justify-end pb-0.5 pl-3"
            >
              <Text className="text-caption-lg text-accent" style={{ fontFamily: fonts.semibold }}>
                Xem tất cả
              </Text>
            </Pressable>
          </View>

          {trangThaiSapToi === 'dang-tai' ? (
            <View className="py-6">
              <ActivityIndicator testID="dang-tai-sap-toi" color={colors.accent} />
            </View>
          ) : trangThaiSapToi === 'mat-ket-noi' || trangThaiSapToi === 'loi' ? (
            // Cả hai nhánh nói cùng một câu ngắn, KHÔNG dựng `ErrorView` với nút
            // thử lại: đây là một khối phụ trên màn hình, và tab Booking ngay
            // bên cạnh là chỗ xem đầy đủ danh sách này.
            <Card>
              <Text className="text-caption-lg text-ink-muted" style={{ fontFamily: fonts.medium }}>
                Chưa tải được danh sách đặt chỗ. Mở tab Booking để xem đầy đủ.
              </Text>
            </Card>
          ) : danhSachSapToi.length === 0 ? (
            <Card>
              <Text className="text-caption-lg text-ink-muted" style={{ fontFamily: fonts.medium }}>
                {/* Có booking mà không buổi nào sắp tới (đều đã qua hoặc đã huỷ):
                    nói "chưa ai đặt lịch" là sai. */}
                {sapToi.bookings.length > 0
                  ? 'Không có buổi nào sắp tới.'
                  : 'Chưa có mentee nào đặt lịch với bạn.'}
              </Text>
            </Card>
          ) : (
            <View className="gap-2.5">
              {danhSachSapToi.map((booking) => (
                <DongBookingGon
                  key={booking.bookingId}
                  booking={booking}
                  onPress={() => router.push(`/mentor-booking/${booking.bookingId}`)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * @file MyBookingsScreen.tsx
 * @description Tab 3 "Lịch hẹn", theo `MyBookings.dc.html`: tiêu đề 26/700, hàng
 * chip lọc cuộn ngang, rồi danh sách thẻ lịch hẹn.
 *
 * ## Hàng chip: vì sao chỉ còn bốn, và vì sao không có số đếm
 *
 * Thiết kế có năm chip kèm số đếm: Tất cả (5) · Đang chờ (1) · Đang diễn ra (1) ·
 * Đã hoàn thành (2) · Đã hủy (1). Đối chiếu với `BookingListRequest.java` thì
 * `GET /api/me/bookings` chỉ nhận **một** giá trị `BookingStatus` LEGACY cho
 * `status`, không nhận danh sách và không nhận `BookingLifecycleStatus`. Vì vậy
 * hàng chip ở đây giữ nguyên DÁNG nhưng mỗi chip ứng với ĐÚNG MỘT giá trị enum
 * thật — không chip nào gộp nhiều trạng thái. Hệ quả:
 *
 * - **"Đã hủy" bị BỎ**: nó là hai giá trị enum (`CANCELLED_BY_MENTEE` và
 *   `CANCELLED_BY_MENTOR`) nên không lấy được bằng một request. Dựng nó bằng cách
 *   lọc tại máy trên một danh sách CÓ PHÂN TRANG sẽ cho một tab trông rỗng trong
 *   khi dữ liệu vẫn còn ở các trang sau — tệ hơn là không có tab.
 * - **"Đang diễn ra" bị BỎ khỏi hàng chip**: `IN_SESSION` là `displayState` do
 *   backend tự suy ra, KHÔNG phải một `BookingStatus`, nên không có gì để lọc
 *   theo. Nhãn "Đang diễn ra" vẫn hiện trên thẻ (xem `bookingStatus.ts`) — chỉ
 *   không có chip lọc riêng.
 * - **Số đếm trong nhãn chip bị BỎ**: mỗi con số là `totalElements` của một
 *   truy vấn riêng, tức bốn request nữa mỗi lần mở tab chỉ để in bốn con số.
 *   Dòng "N buổi" dưới hàng chip nói đúng con số của tab đang mở, lấy từ
 *   `totalElements` thật.
 *
 * Chip "Tất cả" KHÔNG gửi `status` — và đó là một endpoint khác về ngữ nghĩa:
 * dashboard 7 ngày trước đến 90 ngày tới, xếp theo việc-cần-làm. Xem JSDoc của
 * `bookingRepo.getMyBookings`.
 *
 * ## Nút sắp xếp "Gần nhất" của thiết kế bị BỎ
 *
 * `bookingPriorityPageable()` của backend dựng `PageRequest.of(page, size)`
 * **không kèm `Sort`** khi không có `status`, nên `sortBy`/`direction` bị bỏ qua ở
 * đúng tab mặc định. Một nút sắp xếp chạy ở ba tab và im lặng không làm gì ở tab
 * thứ tư là một nút nói dối.
 *
 * ## Lối thanh toán bị BỎ
 *
 * Booking ở `WAITING_PAYMENT` có `canPay = true` và `nextAction = PAY_NOW`, nhưng
 * mục 4.1 của quy ước: bản mobile chỉ XEM và TIÊU, mọi đường dẫn tới nạp tiền bị
 * bỏ. Màn này chỉ hiện nhãn "Chờ thanh toán".
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, Text, View } from 'react-native';

import { trangThaiTai } from '@/core/api/queryState';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { FilterTabs } from '@/core/ui/FilterTabs';
import type { FilterTabItem } from '@/core/ui/FilterTabs';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { ScreenHeader } from '@/core/ui/ScreenHeader';
import { colors, fonts } from '@/core/ui/theme';
import { BookingCard } from '@/features/booking/components/BookingCard';
import { CancelBookingSheet } from '@/features/booking/components/CancelBookingSheet';
import { useCancelBooking } from '@/features/booking/hooks/useBookingMutations';
import { useMyBookings } from '@/features/booking/hooks/useBookingQueries';
import type { BookingResponse, BookingStatus } from '@/features/booking/types';

/**
 * Chip lọc. Mỗi giá trị trừ `TAT_CA` là ĐÚNG MỘT giá trị `BookingStatus` thật của
 * backend — không có chip nào gộp nhiều trạng thái, vì `status` chỉ nhận một.
 */
type TabLichHen =
  | 'TAT_CA'
  | 'PENDING'
  | 'PAID'
  | 'AWAITING_MENTEE_CONFIRMATION'
  | 'COMPLETED';

const CHIP_LOC: readonly FilterTabItem<TabLichHen>[] = [
  { value: 'TAT_CA', label: 'Tất cả' },
  { value: 'PENDING', label: 'Đang chờ' },
  // `PAID` quy về `BookingLifecycleStatus.CONFIRMED`, tức là đã chốt lịch — gồm
  // cả buổi sắp diễn ra và buổi đang diễn ra. Nhãn nói "đã xác nhận" chứ không
  // nói "sắp diễn ra" để không loại trừ nhóm sau.
  { value: 'PAID', label: 'Đã xác nhận' },
  // `AWAITING_MENTEE_CONFIRMATION` cũng quy về `CONFIRMED`, nhưng là nhóm duy
  // nhất đang chờ CHÍNH mentee xác nhận buổi học đã diễn ra. Giữ chip riêng để
  // nhóm đó không bị trộn lẫn vào "Đã xác nhận" và biến mất khỏi tầm mắt.
  { value: 'AWAITING_MENTEE_CONFIRMATION', label: 'Chờ bạn xác nhận' },
  { value: 'COMPLETED', label: 'Đã hoàn thành' },
];

/** `undefined` = không gửi `status`, tức là chế độ dashboard của backend */
const STATUS_THEO_TAB: Record<TabLichHen, BookingStatus | undefined> = {
  TAT_CA: undefined,
  PENDING: 'PENDING',
  PAID: 'PAID',
  AWAITING_MENTEE_CONFIRMATION: 'AWAITING_MENTEE_CONFIRMATION',
  COMPLETED: 'COMPLETED',
};

/** Mô tả trạng thái rỗng theo từng tab — "chưa có lịch nào" nói chung là mơ hồ */
const MO_TA_RONG: Record<TabLichHen, string> = {
  TAT_CA: 'Tìm một mentor phù hợp và đặt buổi đầu tiên nhé.',
  PENDING: 'Không có yêu cầu nào đang chờ mentor phản hồi.',
  PAID: 'Chưa có buổi học nào đã được xác nhận.',
  AWAITING_MENTEE_CONFIRMATION: 'Không có buổi nào đang chờ bạn xác nhận.',
  COMPLETED: 'Chưa có buổi học nào hoàn thành.',
};

export function MyBookingsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<TabLichHen>('TAT_CA');
  const [dangHuy, setDangHuy] = useState<BookingResponse | null>(null);
  const [loiMoPhongHoc, setLoiMoPhongHoc] = useState(false);

  const query = useMyBookings({ status: STATUS_THEO_TAB[tab] });
  const huyLich = useCancelBooking();

  // Quy cờ của TanStack thành MỘT trạng thái — luật và hai cái bẫy nằm ở JSDoc
  // của `core/api/queryState.ts`, đừng tự suy diễn lại ở đây.
  const trangThai = trangThaiTai({
    isPaused: query.isPaused,
    isPending: query.isPending,
    isError: query.isError,
    coDuLieu: query.bookings.length > 0,
  });

  const tongSo = query.data?.pages[0]?.totalElements;

  const doiTab = (gia: TabLichHen) => {
    setTab(gia);
    // Lỗi mở link thuộc về lần bấm trước ở tab trước; để nó dính lại là báo lỗi
    // về một việc người dùng không còn nhìn thấy.
    setLoiMoPhongHoc(false);
  };

  /**
   * Mở link họp bằng ứng dụng ngoài.
   *
   * `openURL` CÓ THỂ bị từ chối (máy chưa cài app Zoom/Meet, hoặc link mentor
   * dán vào không phải URL mở được). Nuốt lỗi bằng `.catch(() => {})` sẽ cho một
   * nút bấm không làm gì cả và không nói gì cả — đúng lớp lỗi tệ nhất, vì người
   * dùng đang đứng trước giờ học. Vì vậy thất bại được ghi lại và nói ra.
   */
  const vaoPhongHoc = (booking: BookingResponse) => {
    const link = booking.meetingLink?.trim() ?? '';
    if (link.length === 0) {
      return;
    }
    setLoiMoPhongHoc(false);
    void Linking.openURL(link).catch(() => setLoiMoPhongHoc(true));
  };

  const guiHuy = (cancelReason: string) => {
    if (!dangHuy) {
      return;
    }
    huyLich.mutate(
      { bookingId: dangHuy.bookingId, cancelReason },
      // Chỉ đóng hộp khi backend ĐÃ xác nhận. Đóng ngay lúc bấm sẽ làm người
      // dùng tin là đã hủy xong trong khi request có thể vừa thất bại, và khối
      // lỗi trong hộp thì không ai còn thấy.
      { onSuccess: () => setDangHuy(null) },
    );
  };

  const dongHopHuy = () => {
    setDangHuy(null);
    huyLich.reset();
  };

  return (
    <Screen testID="man-hinh-lich-hen">
      <OfflineBanner />

      <View className="gap-4 px-gutter pb-3 pt-2">
        {/* Không truyền `onBack`: màn này là một tab, không có gì để quay lại. */}
        <ScreenHeader title="Lịch hẹn" size="lg" />
        <FilterTabs
          items={CHIP_LOC}
          value={tab}
          onChange={doiTab}
          accessibilityLabel="Lọc lịch đặt"
          testID="loc-lich-hen"
        />
      </View>

      {trangThai === 'dang-tai' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-lich-hen" color={colors.accent} />
        </View>
      ) : trangThai === 'mat-ket-noi' ? (
        <EmptyState
          title="Không có kết nối"
          description="Lịch hẹn sẽ tải khi có mạng trở lại."
        />
      ) : trangThai === 'loi' ? (
        <ErrorView error={query.error} onAction={() => void query.refetch()} />
      ) : (
        <FlatList
          testID="danh-sach-lich-hen"
          data={query.bookings}
          keyExtractor={(item) => item.bookingId}
          renderItem={({ item }) => (
            <BookingCard
              booking={item}
              onVaoPhongHoc={vaoPhongHoc}
              onHuyLich={setDangHuy}
              onXemMentor={(mentorUserId) => router.push(`/mentor/${mentorUserId}`)}
              onNhanTin={(conversationId) => router.push(`/chat/${conversationId}`)}
            />
          )}
          // `grow` để EmptyState (flex-1) căn giữa được theo chiều dọc; lề và gap
          // đặt ở contentContainer chứ không ở `Screen` — lề ở khung ngoài sẽ cắt
          // luôn vùng cuộn.
          contentContainerClassName="grow gap-3.5 px-gutter pb-28 pt-1"
          ListHeaderComponent={
            <View className="gap-3 pb-2">
              {query.isError ? (
                <Pressable
                  testID="loi-tai-lai-nen"
                  accessibilityRole="button"
                  onPress={() => void query.refetch()}
                  className="rounded-md bg-neutral-soft px-3 py-2"
                >
                  <Text
                    className="text-caption-lg text-danger"
                    style={{ fontFamily: fonts.medium }}
                  >
                    Không tải được lịch hẹn mới. Chạm để thử lại.
                  </Text>
                </Pressable>
              ) : null}

              {loiMoPhongHoc ? (
                <View testID="loi-mo-phong-hoc" className="rounded-md bg-neutral-soft px-3 py-2">
                  <Text
                    className="text-caption-lg text-danger"
                    style={{ fontFamily: fonts.medium }}
                  >
                    Không mở được link phòng học. Hãy kiểm tra lại link mentor gửi, hoặc mở nó
                    bằng trình duyệt.
                  </Text>
                </View>
              ) : null}

              {tongSo != null && query.bookings.length > 0 ? (
                <Text
                  testID="dong-dem-lich-hen"
                  className="text-caption-lg text-ink-muted"
                  style={{ fontFamily: fonts.medium }}
                >
                  {tongSo} buổi
                </Text>
              ) : null}
            </View>
          }
          onEndReachedThreshold={0.5}
          /*
            `taiTrangKe()` do HOOK trả về, đã bọc chốt chặn ĐỒNG BỘ chống bắn
            trùng (`useChotChanTrangKe`). Màn hình KHÔNG dựng lại `useRef` lần
            nữa — xem mục 6 của quy ước.
          */
          onEndReached={query.taiTrangKe}
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator testID="dang-tai-trang-ke" color={colors.accent} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title="Chưa có lịch nào ở đây"
              description={MO_TA_RONG[tab]}
              // Nút này có thật trong thiết kế (`href="Mentors.dc.html"`) và màn
              // đích CÓ TỒN TẠI — tab 2 đã dựng xong.
              actionLabel="Tìm Mentor"
              onAction={() => router.push('/(tabs)/mentors')}
            />
          }
        />
      )}

      <CancelBookingSheet
        booking={dangHuy}
        onClose={dongHopHuy}
        onSubmit={guiHuy}
        busy={huyLich.isPending}
        error={huyLich.error}
      />
    </Screen>
  );
}

/**
 * @file MentorBookingsScreen.tsx
 * @description Tab 2 của thanh Mentor ("Booking"), theo `MentorBookings.dc.html`:
 * tiêu đề 26/700, hàng chip lọc cuộn ngang, rồi danh sách thẻ booking.
 *
 * Màn này nằm trong `features/booking` chứ không trong `features/mentorMode`:
 * danh sách booking phía mentor đi qua ĐÚNG endpoint `GET /api/me/bookings`
 * (với `role=MENTOR`) mà feature này đã sở hữu, và nó dùng lại `bookingStatus.ts`,
 * `bookingPrice.ts`, `offsetDateTime.ts` của chính feature này. Dựng nó ở nhánh
 * khác sẽ phải import chéo hoặc nhân bản cả tầng dữ liệu.
 *
 * ## Hàng chip: vì sao chỉ còn năm, và vì sao không có số đếm
 *
 * Thiết kế có Tất cả (4) · Đang chờ (2) · Đang diễn ra (1) · Đã hoàn thành (1) ·
 * Đã hủy (0). Đối chiếu `BookingListRequest.java`: `GET /api/me/bookings` chỉ
 * nhận **một** giá trị `BookingStatus` LEGACY cho `status`, không nhận danh sách
 * và không nhận `BookingLifecycleStatus`. Hệ quả giống hệt `MyBookingsScreen`
 * (xem JSDoc của màn đó), nên chỉ ghi lại phần KHÁC ở đây:
 *
 * - **"Đã hủy" bị BỎ**: là hai giá trị enum (`CANCELLED_BY_MENTEE` +
 *   `CANCELLED_BY_MENTOR`), không lấy được bằng một request.
 * - **"Đang diễn ra" bị BỎ khỏi hàng chip**: `IN_SESSION` là `displayState` do
 *   backend suy ra, không phải `BookingStatus`. Nhãn vẫn hiện trên thẻ.
 * - **Số đếm trong nhãn chip bị BỎ**: mỗi con số là `totalElements` của một
 *   truy vấn riêng. Dòng "N buổi" dưới hàng chip nói đúng con số của tab đang
 *   mở, lấy từ `totalElements` thật.
 * - **Chip "Chờ bạn xác nhận" ở đây là `AWAITING_MENTOR_COMPLETION`, KHÔNG phải
 *   `AWAITING_MENTEE_CONFIRMATION`** như phía mentee. Hai giá trị này đều quy về
 *   `BookingLifecycleStatus.CONFIRMED` nên nhãn trạng thái không phân biệt được,
 *   nhưng chúng là hai việc của HAI người khác nhau: cái trước chờ MENTOR đánh
 *   dấu buổi đã xong, cái sau chờ mentee xác nhận. Dùng lẫn chip của nhau là
 *   cho mỗi bên một danh sách việc của người khác.
 *
 * ## Nút sắp xếp "Gần nhất" của thiết kế bị BỎ
 *
 * Cùng lý do như `MyBookingsScreen`: `bookingPriorityPageable()` dựng
 * `PageRequest.of(page, size)` **không kèm `Sort`** khi không có `status`, nên
 * `sortBy`/`direction` bị bỏ qua ở đúng tab mặc định. Một nút sắp xếp im lặng
 * không làm gì ở một trong năm tab là một nút nói dối.
 *
 * ## Xác nhận / Từ chối: xem JSDoc của `MentorBookingCard`
 *
 * Hai thao tác đó cần dữ liệu mà màn này không có chỗ nhập, và chỗ nhập nằm ở
 * `MentorBookingDetail` — màn hình chưa thuộc đợt này.
 */

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
import { MentorBookingCard } from '@/features/booking/components/MentorBookingCard';
import { useCheckInBooking } from '@/features/booking/hooks/useBookingMutations';
import { useMentorBookings } from '@/features/booking/hooks/useBookingQueries';
import type { BookingResponse, BookingStatus } from '@/features/booking/types';

/**
 * Chip lọc. Mỗi giá trị trừ `TAT_CA` là ĐÚNG MỘT giá trị `BookingStatus` thật —
 * không chip nào gộp nhiều trạng thái, vì `status` chỉ nhận một.
 */
type TabBookingMentor =
  | 'TAT_CA'
  | 'PENDING'
  | 'PAID'
  | 'AWAITING_MENTOR_COMPLETION'
  | 'COMPLETED';

const CHIP_LOC: readonly FilterTabItem<TabBookingMentor>[] = [
  { value: 'TAT_CA', label: 'Tất cả' },
  // Nhóm việc QUAN TRỌNG NHẤT của mentor: yêu cầu đang chờ chính họ phản hồi,
  // và nó tự hết hạn theo `pendingExpireAt`. Đặt ngay sau "Tất cả".
  { value: 'PENDING', label: 'Đang chờ' },
  { value: 'PAID', label: 'Đã xác nhận' },
  { value: 'AWAITING_MENTOR_COMPLETION', label: 'Chờ bạn xác nhận' },
  { value: 'COMPLETED', label: 'Đã hoàn thành' },
];

/** `undefined` = không gửi `status`, tức là chế độ dashboard của backend */
const STATUS_THEO_TAB: Record<TabBookingMentor, BookingStatus | undefined> = {
  TAT_CA: undefined,
  PENDING: 'PENDING',
  PAID: 'PAID',
  AWAITING_MENTOR_COMPLETION: 'AWAITING_MENTOR_COMPLETION',
  COMPLETED: 'COMPLETED',
};

/** Mô tả trạng thái rỗng theo từng tab — "chưa có booking nào" nói chung là mơ hồ */
const MO_TA_RONG: Record<TabBookingMentor, string> = {
  TAT_CA: 'Chưa có mentee nào đặt lịch trong khoảng 7 ngày trước đến 90 ngày tới.',
  PENDING: 'Không có yêu cầu nào đang chờ bạn phản hồi.',
  PAID: 'Chưa có buổi học nào đã được xác nhận.',
  AWAITING_MENTOR_COMPLETION: 'Không có buổi nào đang chờ bạn xác nhận đã hoàn tất.',
  COMPLETED: 'Chưa có buổi học nào hoàn thành.',
};

export function MentorBookingsScreen() {
  const [tab, setTab] = useState<TabBookingMentor>('TAT_CA');
  const [loiMoPhongHoc, setLoiMoPhongHoc] = useState(false);

  const query = useMentorBookings({ status: STATUS_THEO_TAB[tab] });
  const checkIn = useCheckInBooking();

  // Quy cờ của TanStack thành MỘT trạng thái — luật và hai cái bẫy nằm ở JSDoc
  // của `core/api/queryState.ts`, đừng tự suy diễn lại ở đây.
  const trangThai = trangThaiTai({
    isPaused: query.isPaused,
    isPending: query.isPending,
    isError: query.isError,
    coDuLieu: query.bookings.length > 0,
  });

  const tongSo = query.data?.pages[0]?.totalElements;

  const doiTab = (gia: TabBookingMentor) => {
    setTab(gia);
    // Lỗi mở link thuộc về lần bấm trước ở tab trước; để nó dính lại là báo lỗi
    // về một việc người dùng không còn nhìn thấy.
    setLoiMoPhongHoc(false);
    // Lỗi check-in cũng vậy: khối lỗi nằm trên đầu danh sách nên nó sẽ nói về
    // một booking không còn trong tầm mắt.
    checkIn.reset();
  };

  /**
   * Mở link họp bằng ứng dụng ngoài.
   *
   * `openURL` CÓ THỂ bị từ chối (máy chưa cài app Zoom/Meet, hoặc link mentor tự
   * dán vào không phải URL mở được). Nuốt lỗi bằng `.catch(() => {})` cho một
   * nút không làm gì và không nói gì — đúng lớp lỗi tệ nhất, vì mentor đang
   * đứng trước giờ dạy.
   */
  const moPhongHoc = (booking: BookingResponse) => {
    const link = booking.meetingLink?.trim() ?? '';
    if (link.length === 0) {
      return;
    }
    setLoiMoPhongHoc(false);
    void Linking.openURL(link).catch(() => setLoiMoPhongHoc(true));
  };

  return (
    <Screen testID="man-hinh-booking-mentor">
      <OfflineBanner />

      <View className="gap-4 px-gutter pb-3 pt-2">
        {/* Không truyền `onBack`: màn này là một tab, không có gì để quay lại. */}
        <ScreenHeader title="Lịch đặt" size="lg" />
        <FilterTabs
          items={CHIP_LOC}
          value={tab}
          onChange={doiTab}
          accessibilityLabel="Lọc lịch đặt của mentor"
          testID="loc-booking-mentor"
        />
      </View>

      {trangThai === 'dang-tai' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-booking-mentor" color={colors.accent} />
        </View>
      ) : trangThai === 'mat-ket-noi' ? (
        <EmptyState
          title="Không có kết nối"
          description="Lịch đặt sẽ tải khi có mạng trở lại."
        />
      ) : trangThai === 'loi' ? (
        <ErrorView error={query.error} onAction={() => void query.refetch()} />
      ) : (
        <FlatList
          testID="danh-sach-booking-mentor"
          data={query.bookings}
          keyExtractor={(item) => item.bookingId}
          renderItem={({ item }) => (
            <MentorBookingCard
              booking={item}
              onCheckIn={(booking) => checkIn.mutate({ bookingId: booking.bookingId })}
              onMoPhongHoc={moPhongHoc}
              dangCheckIn={checkIn.isPending ? checkIn.variables?.bookingId ?? null : null}
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
                  testID="loi-tai-lai-nen-mentor"
                  accessibilityRole="button"
                  onPress={() => void query.refetch()}
                  className="rounded-md bg-neutral-soft px-3 py-2"
                >
                  <Text
                    className="text-caption-lg text-danger"
                    style={{ fontFamily: fonts.medium }}
                  >
                    Không tải được lịch đặt mới. Chạm để thử lại.
                  </Text>
                </Pressable>
              ) : null}

              {checkIn.isError ? (
                <View testID="loi-check-in" className="rounded-md bg-neutral-soft px-3 py-2">
                  <Text
                    className="text-caption-lg text-danger"
                    style={{ fontFamily: fonts.medium }}
                  >
                    {/*
                      KHÔNG kèm nút thử lại: lỗi hay gặp nhất ở đây là 409 "chưa
                      đến giờ / đã hết giờ / booking chưa có session", và bấm lại
                      ngay vẫn hỏng y như vậy. Câu dưới nói đúng việc cần làm.
                    */}
                    Không check-in được. Cửa sổ check-in do hệ thống mở theo giờ buổi học —
                    hãy kéo xuống để tải lại và thử vào lúc buổi học bắt đầu.
                  </Text>
                </View>
              ) : null}

              {loiMoPhongHoc ? (
                <View testID="loi-mo-phong-hoc-mentor" className="rounded-md bg-neutral-soft px-3 py-2">
                  <Text
                    className="text-caption-lg text-danger"
                    style={{ fontFamily: fonts.medium }}
                  >
                    Không mở được link phòng học. Hãy kiểm tra lại link, hoặc mở nó bằng
                    trình duyệt.
                  </Text>
                </View>
              ) : null}

              {tongSo != null && query.bookings.length > 0 ? (
                <Text
                  testID="dong-dem-booking-mentor"
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
                <ActivityIndicator testID="dang-tai-trang-ke-mentor" color={colors.accent} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title="Chưa có booking nào ở đây"
              description={MO_TA_RONG[tab]}
              /*
                KHÔNG có nút hành động: thiết kế không vẽ nút nào ở trạng thái
                rỗng của màn này, và mọi màn có thể nhận nút đó (MentorServices
                để mở thêm dịch vụ, MentorSchedule để mở thêm khung giờ) đều chưa
                tồn tại.
              */
            />
          }
        />
      )}
    </Screen>
  );
}

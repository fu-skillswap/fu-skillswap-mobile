/**
 * @file MentorBookingCard.tsx
 * @description Thẻ một booking nhìn từ phía MENTOR, theo `MentorBookings.dc.html`:
 * card bo 24 có bóng, hàng đầu là avatar 44 + tên MENTEE 15/700 + tên dịch vụ 13
 * + nhãn trạng thái, rồi dải ngày/giờ/giá nền `surface-page` bo 16, rồi hàng nút.
 *
 * Thuần trình bày: không gọi API, không biết tới router hay `Linking`.
 *
 * ## Vì sao là một component RIÊNG, không phải prop của `BookingCard`
 *
 * Hai thẻ đọc hai bộ trường khác nhau của cùng một DTO: thẻ mentee đọc
 * `mentorDisplayName` và cờ `canCancel`, thẻ này đọc `menteeDisplayName`,
 * `attendance.canCheckIn` và thêm cột giá mà thẻ mentee không có. Nhồi cả hai
 * vào một component với một cờ `vaiTro` sẽ cho một thân hàm mà mỗi nhánh chỉ
 * đúng một nửa — và nhánh sai sẽ in tên NGƯỜI KHÁC lên thẻ.
 *
 * ## Nút "Xác nhận" và "Từ chối" của thiết kế KHÔNG được dựng ở đây
 *
 * Cả hai có endpoint thật (`POST /api/mentor/bookings/{id}/accept` và
 * `/reject`), nhưng cả hai đều KHÔNG phải thao tác một-cú-bấm:
 *
 * - **Accept**: `BookingDecisionService.acceptBooking()` kiểm
 *   `googleCalendarConnectionPort.hasActiveConnection(mentorUserId)`; khi mentor
 *   CHƯA kết nối Google Calendar thì `meetingPlatform` là BẮT BUỘC, và kèm theo
 *   là `meetingLink` (hoặc `location` nếu chọn `OFFLINE`) — thiếu thì 400 kèm
 *   "Vui lòng chọn nền tảng phòng học". Một nút "Xác nhận" không có chỗ chọn nền
 *   tảng sẽ thất bại cho đúng nhóm mentor chưa nối Calendar, tức là nhóm đông
 *   nhất lúc mới ra mắt.
 * - **Reject**: `RejectBookingRequest.rejectReason` là `@NotBlank`, nên phải có
 *   hộp nhập lý do.
 *
 * Chỗ chọn nền tảng và hộp nhập lý do nằm ở màn `MentorBookingDetail` — chính
 * thiết kế cũng trỏ nút "Xác nhận" sang đó (`<a href="MentorBookingDetail.dc.html">`).
 * Thẻ chỉ có MỘT nút "Xem và phản hồi" dẫn sang màn đó. `MentorBookingCard.test.tsx` có test canh để
 * không ai thêm lại hai nút đó mà quên chỗ nhập dữ liệu.
 *
 * ## Hàng đầu mở chi tiết cho MỌI booking
 *
 * `MentorBookings.dc.html` dòng 33 bọc hàng đầu của MỌI thẻ trong
 * `<a href="MentorBookingDetail.dc.html">`, không chỉ thẻ đang chờ phản hồi —
 * màn chi tiết là chỗ duy nhất có "Hoàn tất buổi học", "Huỷ buổi học" và nút
 * nhắn tin cho mentee. Truyền `onMoChiTiet` thì hàng đầu bấm được.
 *
 * ## Nút được dựng, và vì sao
 *
 * - **Check-in** khi `attendance.canCheckIn` — cờ của backend là nguồn sự thật,
 *   xem JSDoc của `useCheckInBooking`. Đây là thao tác ghi duy nhất của thẻ này.
 * - **Mở phòng học** khi `canJoin` VÀ có `meetingLink`. `canJoin` có thể đúng mà
 *   link vẫn trống (`meetingPlatform = OFFLINE`, chỉ có `location`); khi đó in
 *   địa điểm ra thành chữ, không dựng nút — không có gì để mở.
 * - **"Mở Google Meet"** của thiết kế đổi nhãn thành **"Mở phòng học"**:
 *   `MeetingPlatform` có 6 giá trị (`GOOGLE_MEET`, `ZOOM`, `MICROSOFT_TEAMS`,
 *   `DISCORD`, `OFFLINE`, `OTHER`), nên nhãn cứng "Google Meet" nói sai với 5
 *   trong 6 trường hợp.
 */

import { CalendarDays, Clock, MapPin } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { dinhDangKhoangGio, nhanNgayNgan } from '@/core/time/offsetDateTime';
import { Avatar } from '@/core/ui/Avatar';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { StatusBadge } from '@/core/ui/StatusBadge';
import { colors, fonts, radius } from '@/core/ui/theme';
import { moTaGiaBooking } from '@/features/booking/bookingPrice';
import { nhanTrangThaiBooking } from '@/features/booking/bookingStatus';
import type { BookingResponse } from '@/features/booking/types';

export interface MentorBookingCardProps {
  booking: BookingResponse;
  /** Chỉ được gọi khi `attendance.canCheckIn`; đang gửi thì nút tự khoá */
  onCheckIn: (booking: BookingResponse) => void;
  /** Chỉ được truyền khi có `meetingLink` để mở */
  onMoPhongHoc: (booking: BookingResponse) => void;
  /** Booking nào đang gửi check-in; `null` khi không có */
  dangCheckIn?: string | null;
  /**
   * Mở màn chi tiết để XỬ LÝ yêu cầu (chọn phòng học rồi xác nhận, hoặc từ chối
   * kèm lý do). Nút chỉ hiện khi backend cho `canAccept` hoặc `canReject`.
   */
  onXuLy?: (booking: BookingResponse) => void;
  /** Mở màn chi tiết khi bấm hàng đầu của thẻ — cho MỌI booking */
  onMoChiTiet?: (booking: BookingResponse) => void;
}

export function MentorBookingCard({
  booking,
  onCheckIn,
  onMoPhongHoc,
  dangCheckIn = null,
  onXuLy,
  onMoChiTiet,
}: MentorBookingCardProps) {
  // Nhãn trạng thái dùng CHUNG `bookingStatus.ts` với phía mentee: nó đọc
  // `bookingStatus` + `displayState` + `completionOutcome`, cả ba đều không phụ
  // thuộc góc nhìn. Đặc biệt `NO_SHOW_MENTOR` vẫn mang `bookingStatus = COMPLETED`
  // nên nhãn "Vắng mặt" phải thắng — và nó phải thắng ở cả hai phía.
  const trangThai = nhanTrangThaiBooking(booking);
  const coTheXuLy = !!onXuLy && (booking.canAccept || booking.canReject);
  // `menteeDisplayName` là `null` khi mapper của backend không tra được user.
  const tenMentee = booking.menteeDisplayName ?? 'Mentee';
  // Thiết kế in tên dịch vụ. `serviceTitle` nullable thật (booking không gắn
  // service), và lúc đó mục tiêu học tập là câu nói đúng nhất về buổi học — đồng
  // thời là thứ mentor cần đọc nhất để quyết định.
  const moTa = booking.serviceTitle ?? booking.learningGoalTitle;

  const ngay = nhanNgayNgan(booking.selectedStartTime);
  const khoangGio = dinhDangKhoangGio(booking.selectedStartTime, booking.selectedEndTime);
  const gia = moTaGiaBooking(booking);
  const diaDiem = booking.location?.trim() ?? '';
  const coLinkHop = (booking.meetingLink?.trim() ?? '').length > 0;

  const hienCheckIn = booking.attendance.canCheckIn;
  const hienMoPhongHoc = booking.canJoin && coLinkHop;
  const hienDiaDiem = booking.canJoin && !coLinkHop && diaDiem.length > 0;

  return (
    <Card elevated testID={`the-booking-mentor-${booking.bookingId}`}>
      <View className="gap-3">
        <Pressable
          accessibilityRole={onMoChiTiet ? 'button' : undefined}
          accessibilityHint={onMoChiTiet ? 'Mở chi tiết lịch đặt' : undefined}
          disabled={!onMoChiTiet}
          onPress={() => onMoChiTiet?.(booking)}
          className="flex-row items-center gap-3"
          testID={`mo-chi-tiet-${booking.bookingId}`}
        >
          <Avatar name={tenMentee} size={44} />
          <View className="min-w-0 flex-1">
            <Text
              className="text-body-lg text-ink"
              numberOfLines={1}
              style={{ fontFamily: fonts.bold }}
            >
              {tenMentee}
            </Text>
            <Text
              className="text-caption-lg text-ink-body"
              numberOfLines={1}
              style={{ fontFamily: fonts.medium }}
            >
              {moTa}
            </Text>
          </View>
          <StatusBadge
            label={trangThai.label}
            tone={trangThai.tone}
            testID={`trang-thai-mentor-${booking.bookingId}`}
          />
        </Pressable>

        {/*
          Dải ngày / giờ / giá. Mốc nào không đọc được thì BỎ hẳn ô đó chứ không
          in chuỗi rỗng. Cả ba trống thì không dựng dải này.
        */}
        {ngay || khoangGio || gia.so || gia.nhan ? (
          <View
            testID={`thoi-gian-mentor-${booking.bookingId}`}
            className="flex-row items-center gap-4 bg-surface-page px-3"
            style={{ borderRadius: radius.md, paddingVertical: 10 }}
          >
            {ngay ? (
              <View className="flex-row items-center gap-1.5">
                <CalendarDays size={16} color={colors.accent} strokeWidth={2} />
                <Text
                  className="text-caption-lg text-ink"
                  style={{ fontFamily: fonts.semibold }}
                >
                  {ngay}
                </Text>
              </View>
            ) : null}
            {khoangGio ? (
              <View className="flex-row items-center gap-1.5">
                <Clock size={16} color={colors.accent} strokeWidth={2} />
                <Text
                  className="text-caption-lg text-ink"
                  style={{ fontFamily: fonts.semibold }}
                >
                  {khoangGio}
                </Text>
              </View>
            ) : null}
            {gia.so || gia.nhan ? (
              <Text
                testID={`gia-mentor-${booking.bookingId}`}
                className="ml-auto text-caption-lg text-ink"
                style={{ fontFamily: fonts.bold }}
              >
                {/* Đơn vị luôn đi kèm con số: "150.000" một mình ở màn mentor dễ
                    bị đọc thành tiền đồng. */}
                {gia.so ? `${gia.so} S-coin` : gia.nhan}
              </Text>
            ) : null}
          </View>
        ) : null}

        {hienDiaDiem ? (
          <View
            testID={`dia-diem-mentor-${booking.bookingId}`}
            className="flex-row items-center gap-1.5"
          >
            <MapPin size={16} color={colors.inkMuted} strokeWidth={2} />
            <Text
              className="min-w-0 flex-1 text-caption-lg text-ink-body"
              style={{ fontFamily: fonts.medium }}
            >
              {diaDiem}
            </Text>
          </View>
        ) : null}

        {coTheXuLy ? (
          <Button
            label="Xem và phản hồi"
            onPress={() => onXuLy?.(booking)}
            size="sm"
            testID={`nut-xu-ly-${booking.bookingId}`}
          />
        ) : null}

        {hienCheckIn || hienMoPhongHoc ? (
          <View className="flex-row gap-2">
            {hienCheckIn ? (
              <View className="flex-1">
                <Button
                  label="Check-in"
                  onPress={() => onCheckIn(booking)}
                  busy={dangCheckIn === booking.bookingId}
                  size="sm"
                  testID={`nut-check-in-${booking.bookingId}`}
                />
              </View>
            ) : null}
            {hienMoPhongHoc ? (
              <View className="flex-1">
                <Button
                  label="Mở phòng học"
                  onPress={() => onMoPhongHoc(booking)}
                  variant="secondary"
                  size="sm"
                  testID={`nut-mo-phong-hoc-${booking.bookingId}`}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

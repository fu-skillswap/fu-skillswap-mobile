/**
 * @file BookingCard.tsx
 * @description Thẻ một lịch hẹn trong `MyBookings.dc.html`: card bo 24 có bóng,
 * hàng đầu là avatar 44 + tên mentor 15/700 + tên dịch vụ 13 + nhãn trạng thái,
 * rồi dải thông tin ngày/giờ nền `surface-page` bo 16, rồi hàng nút.
 *
 * Thuần trình bày: không gọi API, không biết tới router hay `Linking`. Người gọi
 * truyền `onVaoPhongHoc` / `onHuyLich` / `onXemMentor` và tự quyết định hành
 * động — nhờ vậy test của component này không cần dựng HTTP.
 *
 * ## Nút nào hiện ra, và vì sao
 *
 * Cờ `can*` của backend là NGUỒN SỰ THẬT, không phải `bookingStatus`: một buổi
 * `CONFIRMED` chỉ cho vào phòng học trong cửa sổ mà
 * `BookingActionPolicy.canJoin()` cho phép (mở sớm `JOIN_EARLY_MINUTES` trước giờ
 * bắt đầu, đóng `JOIN_GRACE_MINUTES` sau giờ kết thúc), và chỉ cho hủy khi
 * `canCancelByMentee()` đồng ý. Tự suy ra từ trạng thái sẽ hiện một nút mà
 * backend chắc chắn trả 409.
 *
 * `canJoin` có thể đúng mà `meetingLink` vẫn trống — mentor chọn
 * `meetingPlatform = OFFLINE` và chỉ ghi `location`. Khi đó KHÔNG dựng nút "Vào
 * phòng học" (không có gì để mở), mà in địa điểm ra thành chữ.
 *
 * ## Nút trong thiết kế bị BỎ, và vì sao
 *
 * - **"Nhắn tin" / "Nhắn mentor"** (`href="ChatDetail.dc.html"`): màn chat chưa
 *   tồn tại trong repo, tab Tin nhắn vẫn là vỏ rỗng. `conversationId` của booking
 *   có thật nhưng không có màn hình nào nhận nó.
 * - **"Đánh giá buổi học"**: không có màn hình chấm sao nào, và nhánh này cũng
 *   chưa có endpoint gửi đánh giá trong `bookingRepo`. `canSubmitFeedback` được
 *   backend trả về nhưng cố ý không dùng tới.
 * - **"Đặt lại"** của thiết kế dẫn sang `MentorDetail` để đặt buổi mới, nhưng
 *   luồng đặt lịch (`Booking` / `BookingConfirm`) chưa dựng. Nút vẫn giữ vì màn
 *   hồ sơ mentor CÓ THẬT, nhưng nhãn đổi thành "Xem lại mentor" — gọi nó "Đặt
 *   lại" là hứa một luồng đặt lịch chưa có.
 * - **Lối thanh toán** (`canPay` / `nextAction = PAY_NOW`) KHÔNG được dựng, kể cả
 *   khi booking đang ở `WAITING_PAYMENT`: mục 4.1 của quy ước — bản mobile chỉ
 *   xem và tiêu, mọi đường dẫn tới nạp tiền bị bỏ. Nhãn "Chờ thanh toán" vẫn
 *   hiện để người dùng biết phải sang web.
 */

import { CalendarDays, Clock, MapPin, MessageSquare } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { dinhDangKhoangGio, nhanNgayNgan } from '@/core/time/offsetDateTime';
import { Avatar } from '@/core/ui/Avatar';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { IconButton } from '@/core/ui/IconButton';
import { StatusBadge } from '@/core/ui/StatusBadge';
import { colors, fonts, radius } from '@/core/ui/theme';
import { nhanTrangThaiBooking } from '@/features/booking/bookingStatus';
import type { BookingResponse } from '@/features/booking/types';

export interface BookingCardProps {
  booking: BookingResponse;
  /** Chỉ được truyền khi có `meetingLink` để mở; xem JSDoc đầu file */
  onVaoPhongHoc: (booking: BookingResponse) => void;
  onHuyLich: (booking: BookingResponse) => void;
  onXemMentor: (mentorUserId: string) => void;
  /**
   * Mở phòng chat của buổi học. Nút chỉ hiện khi booking có `conversationId` —
   * backend chỉ tạo phòng chat khi mentor đã chấp nhận.
   */
  onNhanTin?: (conversationId: string) => void;
}

export function BookingCard({
  booking,
  onVaoPhongHoc,
  onHuyLich,
  onXemMentor,
  onNhanTin,
}: BookingCardProps) {
  const trangThai = nhanTrangThaiBooking(booking);
  const coChat = !!booking.conversationId && !!onNhanTin;
  // `mentorDisplayName` là `null` khi mapper của backend không tra được user —
  // thẻ vẫn phải đọc được, nên có một tên thay thế thay vì một khoảng trống.
  const tenMentor = booking.mentorDisplayName ?? 'Mentor';
  // Thiết kế in tên dịch vụ. `serviceTitle` là `nullable` thật (booking không
  // gắn service), và lúc đó mục tiêu học tập là câu nói đúng nhất về buổi học.
  const moTa = booking.serviceTitle ?? booking.learningGoalTitle;

  const ngay = nhanNgayNgan(booking.selectedStartTime);
  const khoangGio = dinhDangKhoangGio(booking.selectedStartTime, booking.selectedEndTime);
  const diaDiem = booking.location?.trim() ?? '';
  const coLinkHop = (booking.meetingLink?.trim() ?? '').length > 0;

  const hienVaoPhongHoc = booking.canJoin && coLinkHop;
  // Hiện địa điểm khi tới lượt tham gia mà không có link để mở (mentoring
  // offline). Không phải một nút: không có gì để bấm, chỉ có thông tin để đọc.
  const hienDiaDiem = booking.canJoin && !coLinkHop && diaDiem.length > 0;
  const hienXemMentor = booking.bookingStatus === 'COMPLETED';

  return (
    <Card elevated testID={`the-lich-hen-${booking.bookingId}`}>
      <View className="gap-3">
        <View className="flex-row items-center gap-3">
          <Avatar name={tenMentor} size={44} />
          <View className="min-w-0 flex-1">
            <Text
              className="text-body-lg text-ink"
              numberOfLines={1}
              style={{ fontFamily: fonts.bold }}
            >
              {tenMentor}
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
            testID={`trang-thai-${booking.bookingId}`}
          />
        </View>

        {/*
          Dải ngày/giờ. Mốc nào không đọc được thì BỎ hẳn ô đó chứ không in chuỗi
          rỗng — một dòng ngày trống trông như lỗi giao diện, còn bỏ nó thì không
          nói gì sai. Cả hai trống thì không dựng dải này.
        */}
        {ngay || khoangGio ? (
          <View
            testID={`thoi-gian-${booking.bookingId}`}
            className="flex-row gap-4 bg-surface-page px-3"
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
          </View>
        ) : null}

        {hienDiaDiem ? (
          <View
            testID={`dia-diem-${booking.bookingId}`}
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

        {hienVaoPhongHoc || booking.canCancel || hienXemMentor || coChat ? (
          <View className="flex-row gap-2">
            {hienVaoPhongHoc ? (
              <View className="flex-1">
                <Button
                  label="Vào phòng học"
                  onPress={() => onVaoPhongHoc(booking)}
                  size="sm"
                  testID={`nut-vao-phong-hoc-${booking.bookingId}`}
                />
              </View>
            ) : null}
            {booking.canCancel ? (
              <View className="flex-1">
                <Button
                  label="Hủy lịch"
                  onPress={() => onHuyLich(booking)}
                  variant="ghost"
                  size="sm"
                  testID={`nut-huy-lich-${booking.bookingId}`}
                />
              </View>
            ) : null}
            {hienXemMentor ? (
              <View className="flex-1">
                <Button
                  label="Xem lại mentor"
                  onPress={() => onXemMentor(booking.mentorUserId)}
                  variant="ghost"
                  size="sm"
                  testID={`nut-xem-mentor-${booking.bookingId}`}
                />
              </View>
            ) : null}
            {coChat && booking.conversationId ? (
              <IconButton
                label="Nhắn tin cho mentor"
                icon={<MessageSquare size={20} color={colors.accent} strokeWidth={2} />}
                onPress={() => onNhanTin?.(booking.conversationId ?? '')}
                variant="tint"
                testID={`nut-nhan-tin-${booking.bookingId}`}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

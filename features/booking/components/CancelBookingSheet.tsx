/**
 * @file CancelBookingSheet.tsx
 * @description Hộp xác nhận hủy lịch, kèm ô nhập lý do.
 *
 * Ô lý do KHÔNG phải để cho đẹp: `CancelBookingRequest.cancelReason` là
 * `@NotBlank` (tối đa 1000 ký tự), nên một hộp "Bạn có chắc không?" chỉ có hai
 * nút Có/Không sẽ nhận 400 ở mọi lần bấm. Đó là lý do nút hủy trong thẻ mở hộp
 * này chứ không gọi thẳng mutation.
 *
 * Dùng `Modal` TỰ VẼ, không `Alert.alert`: `Alert` là hộp thoại của hệ điều hành,
 * không nằm trong cây React nên không kiểm được bằng test. Cùng khuôn với
 * `ReportSheet` của diễn đàn.
 *
 * Thuần trình bày: không gọi API, không biết tới TanStack Query. Người gọi giữ
 * mutation và truyền `busy` / `error` vào.
 *
 * Khối lỗi KHÔNG có nút thử lại: backend chặn 3 yêu cầu hủy trong 1 giờ
 * (`RateLimitScope.SECURITY` trong `MyBookingController.cancelBooking`), nên bấm
 * lại vừa hỏng tiếp vừa tiêu một lượt. Người dùng vẫn bấm được "Xác nhận hủy"
 * sau khi sửa lý do — đó là một ý định mới, không phải một lần thử lại.
 */

import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Text, View } from 'react-native';

import { toUserMessage } from '@/core/api/errors';
import { Button } from '@/core/ui/Button';
import { TextField } from '@/core/ui/TextField';
import { fonts } from '@/core/ui/theme';
import { LY_DO_HUY_TOI_DA } from '@/features/booking/types';
import type { BookingResponse } from '@/features/booking/types';

export interface CancelBookingSheetProps {
  /** Booking đang được hủy; `null` nghĩa là hộp đóng */
  booking: BookingResponse | null;
  onClose: () => void;
  onSubmit: (cancelReason: string) => void;
  /** Đang gửi: nút quay và không nhận thêm lần bấm nào */
  busy?: boolean;
  /** Lỗi của lần gửi gần nhất */
  error?: unknown;
}

export function CancelBookingSheet({
  booking,
  onClose,
  onSubmit,
  busy = false,
  error,
}: CancelBookingSheetProps) {
  const [lyDo, setLyDo] = useState('');

  // Mở hộp cho một booking KHÁC thì phải xoá lý do của lần trước: gửi lý do
  // "Em có lịch thi" của buổi A sang buổi B là ghi một câu sai vào audit log của
  // backend, và mentor của buổi B đọc được câu đó.
  useEffect(() => {
    setLyDo('');
  }, [booking?.bookingId]);

  if (!booking) {
    return null;
  }

  const loi = error === undefined || error === null ? null : toUserMessage(error);
  const lyDoDaCat = lyDo.trim();
  const chinhSach = booking.cancellationRefundPolicy;

  return (
    <Modal
      testID="hop-thoai-huy-lich"
      visible
      transparent
      animationType="slide"
      // Nút back cứng của Android cũng phải đóng được hộp này, nếu không người
      // dùng bị kẹt trong một hộp không có đường thoát.
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        testID="vung-tranh-ban-phim-huy-lich"
        className="flex-1 justify-end bg-black/40"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="gap-3 rounded-t-lg bg-surface p-4">
          <Text className="text-base text-ink" style={{ fontFamily: fonts.bold }}>
            Hủy buổi học này?
          </Text>

          {/*
            Nói thẳng tỉ lệ hoàn tiền mà backend đang áp
            (`BookingCancellationRefundPolicy.current()` đi kèm từng booking), chứ
            không nói "sẽ được hoàn tiền" chung chung: hủy sớm và hủy muộn hoàn
            khác nhau, và người dùng chỉ biết được điều đó TRƯỚC khi bấm.
          */}
          <Text className="text-caption-lg text-ink-body" style={{ fontFamily: fonts.regular }}>
            Hủy trước giờ học {chinhSach.earlyMenteeCancellationDeadlineMinutes} phút thì được hoàn{' '}
            {chinhSach.earlyMenteeRefundPercent}% S-coins; hủy muộn hơn chỉ hoàn{' '}
            {chinhSach.lateMenteeRefundPercent}%.
          </Text>

          <TextField
            label="Lý do hủy"
            value={lyDo}
            onChangeText={setLyDo}
            placeholder="Ví dụ: em có lịch thi đột xuất nên xin hủy."
            multiline
            numberOfLines={3}
            testID="o-ly-do-huy"
          />
          {lyDoDaCat.length > LY_DO_HUY_TOI_DA ? (
            <Text className="text-caption text-danger" style={{ fontFamily: fonts.medium }}>
              Lý do không được vượt quá {LY_DO_HUY_TOI_DA} ký tự.
            </Text>
          ) : null}

          {loi ? (
            // Khối đứng yên, KHÔNG nút thử lại: xem JSDoc đầu file.
            <View testID="loi-huy-lich" className="gap-1 rounded-md bg-neutral-soft p-3">
              <Text className="text-danger" style={{ fontFamily: fonts.semibold }}>
                {loi.title}
              </Text>
              <Text className="text-danger" style={{ fontFamily: fonts.regular }}>
                {loi.description}
              </Text>
              {loi.retryAfterSeconds ? (
                <Text className="text-danger" style={{ fontFamily: fonts.regular }}>
                  Vui lòng thử lại sau {loi.retryAfterSeconds} giây.
                </Text>
              ) : null}
            </View>
          ) : null}

          <Button
            label="Xác nhận hủy"
            onPress={() => onSubmit(lyDoDaCat)}
            busy={busy}
            // Luật `@NotBlank` của backend được chốt ngay ở nút: một lý do trống
            // chỉ nhận 400 mà vẫn tiêu một lượt trong hạn mức 3 lần/giờ.
            disabled={lyDoDaCat.length === 0 || lyDoDaCat.length > LY_DO_HUY_TOI_DA}
            variant="danger"
            testID="nut-xac-nhan-huy"
          />
          <Button
            label="Giữ lịch"
            onPress={onClose}
            variant="secondary"
            testID="nut-dong-huy-lich"
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

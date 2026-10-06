/**
 * @file MentorBookingDetailScreen.tsx
 * @description Chi tiết một lịch đặt nhìn từ phía mentor, theo
 * `MentorBookingDetail.dc.html`: header có nút quay lại và nhãn trạng thái, thẻ
 * mentee (kèm nút nhắn tin khi đã có phòng chat), thẻ "Thông tin buổi học", ghi
 * chú từ mentee, chọn hình thức phòng học, và hai nút Từ chối / Xác nhận lịch ở
 * đáy.
 *
 * ## Luật nhập của "Xác nhận lịch" (từ `BookingDecisionService.acceptBooking()`)
 *
 * - Mentor ĐÃ kết nối Google Calendar (prop `daNoiLich`): chọn
 *   Google Meet và để trống link — backend tự tạo phòng. Các nền tảng khác vẫn
 *   cần link.
 * - CHƯA kết nối: bắt buộc chọn nền tảng; ngoài "Trực tiếp" thì bắt buộc link;
 *   "Trực tiếp" thì bắt buộc địa điểm (hoặc link).
 *
 * Màn chốt các luật đó ngay ở nút để mentor không phải đợi một lỗi 400.
 *
 * ## Sau khi xác nhận
 *
 * - "Hoàn tất buổi học" (cờ `canCompleteByMentor`): booking ở
 *   `AWAITING_MENTOR_COMPLETION` — chip "Chờ bạn xác nhận" của tab Booking. Hỏi
 *   lại trước khi gửi vì mentee chỉ còn 24 giờ để xác nhận hoặc khiếu nại.
 * - "Huỷ buổi học" (cờ `canCancel`): bắt buộc lý do; backend phạt nếu huỷ sát giờ.
 *
 * Ô "Thu nhập" của thiết kế đổi thành "Giá dịch vụ": `BookingResponse` không có
 * số mentor thực nhận (phí nền tảng do backend tính lúc quyết toán), và in giá
 * gốc dưới nhãn "Thu nhập" là nói sai.
 */

import { useRouter } from 'expo-router';
import { MessageSquare } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { toUserMessage } from '@/core/api/errors';
import { trangThaiTai } from '@/core/api/queryState';
import { dinhDangKhoangGio, dinhDangNgayCoOffset, nhanNgayNgan } from '@/core/time/offsetDateTime';
import { Avatar } from '@/core/ui/Avatar';
import { BottomBar } from '@/core/ui/BottomBar';
import { Button } from '@/core/ui/Button';
import { Chip } from '@/core/ui/Chip';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { IconButton } from '@/core/ui/IconButton';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { ScreenHeader } from '@/core/ui/ScreenHeader';
import { StatusBadge } from '@/core/ui/StatusBadge';
import { TextField } from '@/core/ui/TextField';
import { colors, fonts, spacing } from '@/core/ui/theme';
import { moTaGiaBooking } from '@/features/booking/bookingPrice';
import { nhanTrangThaiBooking } from '@/features/booking/bookingStatus';
import {
  useAcceptBooking,
  useCancelBookingByMentor,
  useCheckInBooking,
  useCompleteBookingByMentor,
  useRejectBooking,
} from '@/features/booking/hooks/useBookingMutations';
import { useBookingDetail } from '@/features/booking/hooks/useBookingQueries';
import {
  DIA_DIEM_TOI_DA,
  LINK_PHONG_HOC_TOI_DA,
  LY_DO_HUY_TOI_DA,
  LY_DO_TU_CHOI_TOI_DA,
} from '@/features/booking/types';
import type { BookingResponse, MeetingPlatform } from '@/features/booking/types';

/** Nền tảng theo đúng thứ tự thiết kế; "Khác" thêm vì backend có `OTHER` */
const NEN_TANG: readonly { value: MeetingPlatform; label: string }[] = [
  { value: 'GOOGLE_MEET', label: 'Google Meet' },
  { value: 'ZOOM', label: 'Zoom' },
  { value: 'MICROSOFT_TEAMS', label: 'Microsoft Teams' },
  { value: 'DISCORD', label: 'Discord' },
  { value: 'OFFLINE', label: 'Trực tiếp' },
  { value: 'OTHER', label: 'Khác' },
];

export function tenNenTang(nenTang: MeetingPlatform | null): string | null {
  return NEN_TANG.find((n) => n.value === nenTang)?.label ?? null;
}

/**
 * Lỗi nhập của form xác nhận, hoặc `null` khi gửi được. Đúng các luật 400 của
 * `BookingDecisionService.acceptBooking()`.
 */
export function loiXacNhan(input: {
  daNoiLich: boolean;
  nenTang: MeetingPlatform | null;
  link: string;
  diaDiem: string;
}): string | null {
  const link = input.link.trim();
  const diaDiem = input.diaDiem.trim();
  if (link.length > LINK_PHONG_HOC_TOI_DA) {
    return `Link tối đa ${LINK_PHONG_HOC_TOI_DA} ký tự.`;
  }
  if (diaDiem.length > DIA_DIEM_TOI_DA) {
    return `Địa điểm tối đa ${DIA_DIEM_TOI_DA} ký tự.`;
  }
  if (input.daNoiLich && (input.nenTang === null || (input.nenTang === 'GOOGLE_MEET' && link === ''))) {
    return null;
  }
  if (input.nenTang === null) {
    return 'Chọn hình thức phòng học.';
  }
  if (input.nenTang === 'OFFLINE') {
    return diaDiem || link ? null : 'Nhập địa điểm gặp.';
  }
  return link ? null : 'Dán link phòng học.';
}

export interface MentorBookingDetailScreenProps {
  bookingId: string;
  /**
   * Mentor đang có kết nối Google Calendar CÒN DÙNG ĐƯỢC hay không
   * (`connected && !needsReconnect` của `GET /api/me/google-calendar/status`).
   *
   * KHÔNG lấy `UserMeResponse.googleCalendarConnected` của phiên: giá trị đó chỉ
   * làm mới lúc đăng nhập, còn `acceptBooking()` kiểm kết nối SỐNG
   * (`hasActiveConnection`). Route đọc trạng thái rồi truyền vào; giá trị có thể
   * đổi từ `false` sang `true` khi truy vấn về sau lúc màn đã vẽ.
   */
  daNoiLich: boolean;
}

export function MentorBookingDetailScreen({ bookingId, daNoiLich }: MentorBookingDetailScreenProps) {
  const router = useRouter();
  const booking = useBookingDetail(bookingId);
  const xacNhan = useAcceptBooking();
  const tuChoi = useRejectBooking();
  const checkIn = useCheckInBooking();
  const hoanTat = useCompleteBookingByMentor();
  const huy = useCancelBookingByMentor();

  const [nenTang, setNenTang] = useState<MeetingPlatform | null>(daNoiLich ? 'GOOGLE_MEET' : null);
  const [link, setLink] = useState('');
  const [diaDiem, setDiaDiem] = useState('');
  const [moTuChoi, setMoTuChoi] = useState(false);
  const [lyDo, setLyDo] = useState('');
  const [moHoanTat, setMoHoanTat] = useState(false);
  const [moHuy, setMoHuy] = useState(false);
  const [lyDoHuy, setLyDoHuy] = useState('');
  const [loiMoPhong, setLoiMoPhong] = useState(false);

  // Trạng thái Calendar về SAU lần vẽ đầu (route đọc nó bằng một truy vấn):
  // chọn sẵn Google Meet như khi biết ngay từ đầu, trừ khi mentor đã tự chọn.
  const daTuChon = useRef(false);
  useEffect(() => {
    if (daNoiLich && !daTuChon.current) {
      setNenTang((cu) => cu ?? 'GOOGLE_MEET');
    }
  }, [daNoiLich]);
  const chonNenTang = (gia: MeetingPlatform) => {
    daTuChon.current = true;
    setNenTang(gia);
  };

  const roiDi = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/mentor-bookings');
  };

  const trangThaiChiTiet = trangThaiTai({
    isPaused: booking.isPaused,
    isPending: booking.isPending,
    isError: booking.isError,
    coDuLieu: booking.data !== undefined,
  });

  if (trangThaiChiTiet === 'dang-tai') {
    return (
      <Screen testID="man-hinh-chi-tiet-lich-dat">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-chi-tiet" color={colors.accent} />
        </View>
      </Screen>
    );
  }
  if (trangThaiChiTiet === 'mat-ket-noi') {
    // Mất mạng khi chưa có bản cache: TanStack HOÃN truy vấn (`isPaused`) và
    // `isPending` bật mãi — trước đây vòng quay không bao giờ dừng.
    return (
      <Screen testID="man-hinh-chi-tiet-lich-dat">
        <OfflineBanner />
        <View className="px-gutter pt-2">
          <ScreenHeader title="Chi tiết lịch đặt" onBack={roiDi} />
        </View>
        <EmptyState
          title="Không có kết nối"
          description="Chi tiết lịch đặt sẽ tải khi có mạng trở lại."
          actionLabel="Thử lại"
          onAction={() => void booking.refetch()}
        />
      </Screen>
    );
  }
  if (booking.isError || !booking.data) {
    return (
      <Screen testID="man-hinh-chi-tiet-lich-dat">
        <View className="px-gutter pt-2">
          <ScreenHeader title="Chi tiết lịch đặt" onBack={roiDi} />
        </View>
        <ErrorView error={booking.error} onAction={() => void booking.refetch()} />
      </Screen>
    );
  }

  const b: BookingResponse = booking.data;
  const trangThai = nhanTrangThaiBooking(b);
  const gia = moTaGiaBooking(b);
  const loiNhap = loiXacNhan({ daNoiLich, nenTang, link, diaDiem });
  // Lỗi từ chối và lỗi huỷ in TRONG hộp thoại của chúng: hộp thoại phủ lên màn,
  // in ở đây thì người dùng không thấy.
  const loiGui = xacNhan.error ?? checkIn.error ?? hoanTat.error;

  const guiXacNhan = () => {
    if (loiNhap) {
      return;
    }
    xacNhan.mutate({
      bookingId: b.bookingId,
      meetingPlatform: nenTang,
      meetingLink: link.trim() || null,
      location: nenTang === 'OFFLINE' ? diaDiem.trim() || null : null,
    });
  };

  const guiTuChoi = () => {
    const gon = lyDo.trim();
    if (!gon || gon.length > LY_DO_TU_CHOI_TOI_DA) {
      return;
    }
    tuChoi.mutate({ bookingId: b.bookingId, rejectReason: gon }, { onSuccess: () => setMoTuChoi(false) });
  };

  const moHopTuChoi = (mo: boolean) => {
    tuChoi.reset();
    setMoTuChoi(mo);
  };

  const guiHoanTat = () => {
    hoanTat.mutate({ bookingId: b.bookingId }, { onSettled: () => setMoHoanTat(false) });
  };

  const moHopHuy = (mo: boolean) => {
    huy.reset();
    setMoHuy(mo);
  };

  const guiHuy = () => {
    const gon = lyDoHuy.trim();
    if (!gon || gon.length > LY_DO_HUY_TOI_DA) {
      return;
    }
    huy.mutate({ bookingId: b.bookingId, cancelReason: gon }, { onSuccess: () => setMoHuy(false) });
  };

  const moPhongHoc = (url: string) => {
    setLoiMoPhong(false);
    // `openURL` từ chối khi máy không có ứng dụng mở được link (hoặc link hỏng):
    // không bắt thì thành unhandled rejection và nút bấm im lặng.
    Linking.openURL(url).catch(() => setLoiMoPhong(true));
  };

  const coNutDuoi =
    b.canAccept || b.canReject || b.canCompleteByMentor || b.attendance.canCheckIn || b.canCancel;

  return (
    <Screen testID="man-hinh-chi-tiet-lich-dat">
      <OfflineBanner />
      <View className="px-gutter pb-3 pt-2">
        <ScreenHeader
          title="Chi tiết lịch đặt"
          onBack={roiDi}
          trailing={<StatusBadge {...trangThai} testID="nhan-trang-thai" />}
        />
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView className="flex-1" contentContainerClassName="gap-3.5 px-gutter pb-6" keyboardShouldPersistTaps="handled">
          {/* Thẻ mentee */}
          <View className="flex-row items-center gap-3 rounded-lg border border-line bg-surface" style={{ padding: spacing.card }}>
            <Avatar name={b.menteeDisplayName ?? 'Mentee'} size={52} />
            <View className="min-w-0 flex-1">
              <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
                Mentee đặt lịch
              </Text>
              <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
                {b.menteeDisplayName ?? 'Mentee'}
              </Text>
            </View>
            {b.conversationId ? (
              <IconButton
                label="Nhắn tin cho mentee"
                icon={<MessageSquare size={20} color={colors.accent} strokeWidth={2} />}
                onPress={() => router.push(`/chat/${b.conversationId}`)}
                variant="tint"
                testID="nut-nhan-tin-mentee"
              />
            ) : null}
          </View>

          {/* Thông tin buổi học */}
          <View className="gap-3 rounded-lg border border-line bg-surface" style={{ padding: spacing.card }}>
            <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
              Thông tin buổi học
            </Text>
            <View className="flex-row flex-wrap">
              <O nhan="Dịch vụ" giaTri={b.serviceTitle ?? '—'} />
              <O nhan="Ngày hẹn" giaTri={nhanNgayNgan(b.selectedStartTime) ?? dinhDangNgayCoOffset(b.selectedStartTime) ?? '—'} />
              <O nhan="Thời gian" giaTri={dinhDangKhoangGio(b.selectedStartTime, b.selectedEndTime) ?? '—'} />
              <O nhan="Giá dịch vụ" giaTri={gia.so ? `${gia.so} S-coins` : (gia.nhan ?? '—')} />
            </View>
            <View className="gap-1 rounded-md bg-surface-page" style={{ padding: 12 }}>
              <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.semibold }}>
                Mục tiêu từ mentee
              </Text>
              <Text className="text-body text-ink" style={{ fontFamily: fonts.semibold }}>
                {b.learningGoalTitle}
              </Text>
              {b.learningGoalDescription ? (
                <Text className="text-body text-ink-body" style={{ fontFamily: fonts.regular }}>
                  {b.learningGoalDescription}
                </Text>
              ) : null}
            </View>
          </View>

          {b.canAccept ? (
            <View className="gap-3 rounded-lg border border-line bg-surface" style={{ padding: spacing.card }}>
              <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
                Hình thức
              </Text>
              <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
                {NEN_TANG.map((n) => (
                  <Chip
                    key={n.value}
                    label={n.label}
                    selected={nenTang === n.value}
                    onPress={() => chonNenTang(n.value)}
                    testID={`nen-tang-${n.value}`}
                  />
                ))}
              </View>
              {nenTang === 'OFFLINE' ? (
                <TextField label="Địa điểm gặp" value={diaDiem} onChangeText={setDiaDiem} placeholder="Ví dụ: Thư viện tầng 3, toà Alpha" testID="o-dia-diem" />
              ) : nenTang ? (
                <TextField
                  label={daNoiLich && nenTang === 'GOOGLE_MEET' ? 'Link phòng học (không bắt buộc)' : 'Link phòng học'}
                  value={link}
                  onChangeText={setLink}
                  placeholder="https://…"
                  autoCapitalize="none"
                  keyboardType="url"
                  testID="o-link"
                />
              ) : null}
              <Text testID="goi-y-hinh-thuc" className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
                {daNoiLich && nenTang === 'GOOGLE_MEET' && link.trim() === ''
                  ? 'Google Meet sẽ được tạo tự động qua Google Calendar.'
                  : (loiNhap ?? 'Mentee nhận thông tin phòng học ngay khi bạn xác nhận.')}
              </Text>
            </View>
          ) : b.meetingPlatform || b.meetingLink || b.location ? (
            <View className="gap-1.5 rounded-lg border border-line bg-surface" style={{ padding: spacing.card }}>
              <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
                Phòng học
              </Text>
              <Text className="text-body text-ink-body" style={{ fontFamily: fonts.medium }}>
                {[tenNenTang(b.meetingPlatform), b.location].filter(Boolean).join(' · ') || 'Online'}
              </Text>
              {b.meetingLink ? (
                <Button label="Mở phòng học" variant="secondary" size="sm" onPress={() => moPhongHoc(b.meetingLink ?? '')} testID="nut-mo-phong-hoc" />
              ) : null}
              {loiMoPhong ? (
                <Text testID="loi-mo-phong-hoc" className="text-caption text-danger" style={{ fontFamily: fonts.medium }}>
                  Không mở được link phòng học. Hãy sao chép link và mở bằng trình duyệt.
                </Text>
              ) : null}
            </View>
          ) : null}

          {b.rejectReason ? (
            <Text className="text-body text-ink-muted" style={{ fontFamily: fonts.regular }}>
              Lý do từ chối: {b.rejectReason}
            </Text>
          ) : null}

          {loiGui ? (
            <View testID="loi-xu-ly-lich" className="gap-1 rounded-md bg-neutral-soft p-3">
              <Text className="text-body text-danger" style={{ fontFamily: fonts.semibold }}>
                {toUserMessage(loiGui).title}
              </Text>
              <Text className="text-caption-lg text-danger" style={{ fontFamily: fonts.regular }}>
                {toUserMessage(loiGui).description}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {!coNutDuoi ? null : b.canAccept || b.canReject ? (
          <BottomBar
            secondary={
              b.canReject ? (
                <Button label="Từ chối" variant="ghost" size="md" onPress={() => moHopTuChoi(true)} testID="nut-tu-choi" />
              ) : undefined
            }
            primary={
              b.canAccept ? (
                <Button
                  label="Xác nhận lịch"
                  size="md"
                  busy={xacNhan.isPending}
                  disabled={loiNhap !== null}
                  onPress={guiXacNhan}
                  testID="nut-xac-nhan-lich"
                />
              ) : (
                <View />
              )
            }
          />
        ) : (
          <BottomBar
            secondary={
              b.canCancel ? (
                <Button label="Huỷ buổi học" variant="ghost" size="md" onPress={() => moHopHuy(true)} testID="nut-huy-buoi" />
              ) : undefined
            }
            primary={
              b.canCompleteByMentor ? (
                <Button
                  label="Hoàn tất buổi học"
                  size="md"
                  busy={hoanTat.isPending}
                  onPress={() => {
                    hoanTat.reset();
                    setMoHoanTat(true);
                  }}
                  testID="nut-hoan-tat"
                />
              ) : b.attendance.canCheckIn ? (
                <Button
                  label="Check-in"
                  size="md"
                  busy={checkIn.isPending}
                  onPress={() => checkIn.mutate({ bookingId: b.bookingId })}
                  testID="nut-check-in"
                />
              ) : (
                <View />
              )
            }
          />
        )}
      </KeyboardAvoidingView>

      <Modal visible={moTuChoi} transparent animationType="slide" onRequestClose={() => moHopTuChoi(false)}>
        <KeyboardAvoidingView className="flex-1 justify-end bg-black/40" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View testID="hop-thoai-tu-choi" className="gap-3 rounded-t-lg bg-surface p-4">
            <Text className="text-base text-ink" style={{ fontFamily: fonts.bold }}>
              Từ chối yêu cầu này?
            </Text>
            <Text className="text-caption-lg text-ink-body" style={{ fontFamily: fonts.regular }}>
              Mentee sẽ đọc được lý do và S-coins (nếu có) không bị trừ.
            </Text>
            <TextField
              label="Lý do từ chối"
              value={lyDo}
              onChangeText={setLyDo}
              placeholder="Ví dụ: Khung giờ này mình có việc đột xuất."
              multiline
              numberOfLines={3}
              testID="o-ly-do-tu-choi"
            />
            <LoiHopThoai loi={tuChoi.error} testID="loi-tu-choi" />
            <Button
              label="Từ chối yêu cầu"
              variant="danger"
              busy={tuChoi.isPending}
              disabled={lyDo.trim().length === 0 || lyDo.trim().length > LY_DO_TU_CHOI_TOI_DA}
              onPress={guiTuChoi}
              testID="nut-gui-tu-choi"
            />
            <Button label="Quay lại" variant="secondary" onPress={() => moHopTuChoi(false)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={moHoanTat} transparent animationType="slide" onRequestClose={() => setMoHoanTat(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View testID="hop-thoai-hoan-tat" className="gap-3 rounded-t-lg bg-surface p-4">
            <Text className="text-base text-ink" style={{ fontFamily: fonts.bold }}>
              Xác nhận buổi học đã diễn ra?
            </Text>
            <Text className="text-caption-lg text-ink-body" style={{ fontFamily: fonts.regular }}>
              Mentee có 24 giờ để xác nhận hoặc báo vấn đề về buổi học. Sau đó thu nhập của buổi được ghi vào ví của bạn.
            </Text>
            <Button label="Hoàn tất buổi học" busy={hoanTat.isPending} onPress={guiHoanTat} testID="nut-gui-hoan-tat" />
            <Button label="Quay lại" variant="secondary" onPress={() => setMoHoanTat(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={moHuy} transparent animationType="slide" onRequestClose={() => moHopHuy(false)}>
        <KeyboardAvoidingView className="flex-1 justify-end bg-black/40" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View testID="hop-thoai-huy-buoi" className="gap-3 rounded-t-lg bg-surface p-4">
            <Text className="text-base text-ink" style={{ fontFamily: fonts.bold }}>
              Huỷ buổi học đã xác nhận?
            </Text>
            <Text className="text-caption-lg text-ink-body" style={{ fontFamily: fonts.regular }}>
              Mentee sẽ đọc được lý do. Huỷ quá sát giờ bắt đầu có thể bị phạt hoặc tạm khoá nhận lịch.
            </Text>
            <TextField
              label="Lý do huỷ"
              value={lyDoHuy}
              onChangeText={setLyDoHuy}
              placeholder="Ví dụ: Mình có việc đột xuất, xin lỗi bạn."
              multiline
              numberOfLines={3}
              testID="o-ly-do-huy"
            />
            <LoiHopThoai loi={huy.error} testID="loi-huy-buoi" />
            <Button
              label="Huỷ buổi học"
              variant="danger"
              busy={huy.isPending}
              disabled={lyDoHuy.trim().length === 0 || lyDoHuy.trim().length > LY_DO_HUY_TOI_DA}
              onPress={guiHuy}
              testID="nut-gui-huy-buoi"
            />
            <Button label="Quay lại" variant="secondary" onPress={() => moHopHuy(false)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

/** Lỗi gửi in ngay trong hộp thoại (hộp thoại phủ lên khối lỗi của màn) */
function LoiHopThoai({ loi, testID }: { loi: unknown; testID: string }) {
  if (!loi) {
    return null;
  }
  const thongDiep = toUserMessage(loi);
  return (
    <View testID={testID} className="gap-1 rounded-md bg-neutral-soft p-3">
      <Text className="text-body text-danger" style={{ fontFamily: fonts.semibold }}>
        {thongDiep.title}
      </Text>
      <Text className="text-caption-lg text-danger" style={{ fontFamily: fonts.regular }}>
        {thongDiep.description}
      </Text>
    </View>
  );
}

function O({ nhan, giaTri }: { nhan: string; giaTri: string }) {
  return (
    <View style={{ width: '50%', paddingVertical: 6, paddingRight: 8 }}>
      <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
        {nhan}
      </Text>
      <Text className="text-body text-ink" style={{ fontFamily: fonts.bold, marginTop: 2 }}>
        {giaTri}
      </Text>
    </View>
  );
}

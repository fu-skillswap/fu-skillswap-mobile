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
 * Ô "Thu nhập" của thiết kế đổi thành "Giá dịch vụ": `BookingResponse` không có
 * số mentor thực nhận (phí nền tảng do backend tính lúc quyết toán), và in giá
 * gốc dưới nhãn "Thu nhập" là nói sai.
 */

import { useRouter } from 'expo-router';
import { MessageSquare } from 'lucide-react-native';
import { useState } from 'react';
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
import { dinhDangKhoangGio, dinhDangNgayCoOffset, nhanNgayNgan } from '@/core/time/offsetDateTime';
import { Avatar } from '@/core/ui/Avatar';
import { BottomBar } from '@/core/ui/BottomBar';
import { Button } from '@/core/ui/Button';
import { Chip } from '@/core/ui/Chip';
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
  useCheckInBooking,
  useRejectBooking,
} from '@/features/booking/hooks/useBookingMutations';
import { useBookingDetail } from '@/features/booking/hooks/useBookingQueries';
import {
  DIA_DIEM_TOI_DA,
  LINK_PHONG_HOC_TOI_DA,
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
   * Mentor đã kết nối Google Calendar chưa (`UserMeResponse.googleCalendarConnected`).
   * Route đọc từ phiên rồi truyền vào, để màn này không kéo theo `AuthProvider`
   * (và module đăng nhập Google native) vào barrel của feature booking.
   */
  daNoiLich: boolean;
}

export function MentorBookingDetailScreen({ bookingId, daNoiLich }: MentorBookingDetailScreenProps) {
  const router = useRouter();
  const booking = useBookingDetail(bookingId);
  const xacNhan = useAcceptBooking();
  const tuChoi = useRejectBooking();
  const checkIn = useCheckInBooking();

  const [nenTang, setNenTang] = useState<MeetingPlatform | null>(daNoiLich ? 'GOOGLE_MEET' : null);
  const [link, setLink] = useState('');
  const [diaDiem, setDiaDiem] = useState('');
  const [moTuChoi, setMoTuChoi] = useState(false);
  const [lyDo, setLyDo] = useState('');

  const roiDi = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/mentor-bookings');
  };

  if (booking.isPending && booking.fetchStatus !== 'idle') {
    return (
      <Screen testID="man-hinh-chi-tiet-lich-dat">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-chi-tiet" color={colors.accent} />
        </View>
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
  const loiGui = xacNhan.error ?? tuChoi.error;

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
                    onPress={() => setNenTang(n.value)}
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
                <Button label="Mở phòng học" variant="secondary" size="sm" onPress={() => void Linking.openURL(b.meetingLink ?? '')} testID="nut-mo-phong-hoc" />
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

        {b.canAccept || b.canReject ? (
          <BottomBar
            secondary={
              b.canReject ? (
                <Button label="Từ chối" variant="ghost" size="md" onPress={() => setMoTuChoi(true)} testID="nut-tu-choi" />
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
        ) : b.attendance.canCheckIn ? (
          <BottomBar
            primary={
              <Button
                label="Check-in"
                size="md"
                busy={checkIn.isPending}
                onPress={() => checkIn.mutate({ bookingId: b.bookingId })}
                testID="nut-check-in"
              />
            }
          />
        ) : null}
      </KeyboardAvoidingView>

      <Modal visible={moTuChoi} transparent animationType="slide" onRequestClose={() => setMoTuChoi(false)}>
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
            <Button
              label="Từ chối yêu cầu"
              variant="danger"
              busy={tuChoi.isPending}
              disabled={lyDo.trim().length === 0 || lyDo.trim().length > LY_DO_TU_CHOI_TOI_DA}
              onPress={guiTuChoi}
              testID="nut-gui-tu-choi"
            />
            <Button label="Quay lại" variant="secondary" onPress={() => setMoTuChoi(false)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
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

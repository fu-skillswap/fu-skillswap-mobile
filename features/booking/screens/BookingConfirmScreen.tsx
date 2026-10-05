/**
 * @file BookingConfirmScreen.tsx
 * @description Bước 3/3 của đặt lịch, theo `BookingConfirm.dc.html`: thẻ tóm tắt
 * (mentor, dịch vụ, thời lượng, giờ, hình thức), ô "Mục tiêu buổi học", thẻ chi
 * phí và nút gửi ở đáy. Gửi xong thì màn đổi tại chỗ sang trạng thái "Đã gửi".
 *
 * ## Khác thiết kế ở đâu, vì sao
 *
 * Thiết kế vẽ "Thanh toán bằng S-coins: số dư 500.000 − 150.000 = 350.000" và nút
 * "Xác nhận & thanh toán". Backend KHÔNG trừ tiền lúc tạo booking
 * (`booking_1T1.md` §2): booking vào `REQUESTED`, mentor chấp nhận rồi mới tới
 * bước thanh toán, và thanh toán đi qua cổng PayOS — thứ bản Android bị cấm gọi
 * (mục 4.1 của `docs/quy-uoc-dung-giao-dien.md`). Vì vậy:
 *
 * - Thẻ chi phí hiện **báo giá** của backend (`pricing.estimatedPayableScoin`,
 *   đã gồm phụ phí/ưu đãi) và `disclaimer` nguyên văn, không tự tính số dư còn lại.
 * - Nút là **"Gửi yêu cầu đặt lịch"**, và màn nói thẳng: chưa trừ tiền, thanh toán
 *   sau khi mentor chấp nhận, trên web.
 * - Ô mục tiêu có hai trường đúng DTO: tiêu đề (bắt buộc, ≤ 200) và mô tả
 *   (không bắt buộc, ≤ 2000).
 */

import { useRouter } from 'expo-router';
import { CircleCheck, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { toUserMessage } from '@/core/api/errors';
import { phanCachNghin } from '@/core/format/soLuong';
import { dinhDangKhoangGio, dinhDangNgayCoOffset, dinhDangGio, nhanNgayNgan } from '@/core/time/offsetDateTime';
import { Avatar } from '@/core/ui/Avatar';
import { BottomBar } from '@/core/ui/BottomBar';
import { KOKO_HAPPY } from '@/core/ui/brand';
import { BrandImage } from '@/core/ui/BrandImage';
import { Button } from '@/core/ui/Button';
import { EmptyState } from '@/core/ui/EmptyState';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { ScreenHeader } from '@/core/ui/ScreenHeader';
import { TextField } from '@/core/ui/TextField';
import { colors, fonts, spacing } from '@/core/ui/theme';
import { BookingSteps } from '@/features/booking/components/BookingSteps';
import { useBookingQuote, useCreateBooking } from '@/features/booking/hooks/useDatLich';
import {
  MUC_TIEU_MO_TA_TOI_DA,
  MUC_TIEU_TIEU_DE_TOI_DA,
} from '@/features/booking/types';
import type { BookingQuoteResponse, BookingResponse } from '@/features/booking/types';
import { useMentor } from '@/features/mentor';

export interface BookingConfirmScreenProps {
  mentorUserId: string;
  slotId: string;
  serviceId: string;
  /** NGUYÊN `candidate.startAt` (Instant UTC) mà bước 2 chuyền sang */
  startAt: string;
}

export function BookingConfirmScreen({
  mentorUserId,
  slotId,
  serviceId,
  startAt,
}: BookingConfirmScreenProps) {
  const router = useRouter();
  const mentor = useMentor(mentorUserId);
  const duThamSo = slotId.length > 0 && serviceId.length > 0 && startAt.length > 0;
  const baoGia = useBookingQuote(duThamSo ? { slotId, serviceId, startAt } : null);
  const taoBooking = useCreateBooking();

  const [tieuDe, setTieuDe] = useState('');
  const [moTa, setMoTa] = useState('');
  const [daThuGui, setDaThuGui] = useState(false);

  const tieuDeGon = tieuDe.trim();
  const loiTieuDe =
    daThuGui && tieuDeGon.length === 0
      ? 'Hãy viết ngắn gọn bạn muốn mentor giúp gì.'
      : tieuDeGon.length > MUC_TIEU_TIEU_DE_TOI_DA
        ? `Tối đa ${MUC_TIEU_TIEU_DE_TOI_DA} ký tự.`
        : undefined;
  const loiMoTa =
    moTa.trim().length > MUC_TIEU_MO_TA_TOI_DA ? `Tối đa ${MUC_TIEU_MO_TA_TOI_DA} ký tự.` : undefined;

  const quayLaiChonGio = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(`/booking/${mentorUserId}`);
  };

  const gui = () => {
    setDaThuGui(true);
    if (!baoGia.data || tieuDeGon.length === 0 || loiTieuDe || loiMoTa) {
      return;
    }
    const moTaGon = moTa.trim();
    taoBooking.mutate({
      slotId,
      serviceId,
      startAt,
      learningGoalTitle: tieuDeGon,
      ...(moTaGon ? { learningGoalDescription: moTaGon } : {}),
    });
  };

  if (taoBooking.isSuccess) {
    return (
      <DaGui
        booking={taoBooking.data}
        onXemLichHen={() => router.replace('/(tabs)/bookings')}
      />
    );
  }

  const identity = mentor.data?.identity;

  return (
    <Screen testID="man-hinh-xac-nhan-dat-lich">
      <OfflineBanner />
      <View className="gap-4 px-gutter pb-3 pt-2">
        <ScreenHeader title="Xác nhận đặt lịch" subtitle="Bước 3/3" onBack={quayLaiChonGio} />
        <BookingSteps current={3} />
      </View>

      {!duThamSo ? (
        <EmptyState
          title="Thiếu thông tin khung giờ"
          description="Hãy quay lại chọn ngày và giờ học."
          actionLabel="Chọn lại giờ"
          onAction={quayLaiChonGio}
        />
      ) : baoGia.isPending && baoGia.fetchStatus !== 'idle' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-bao-gia" color={colors.accent} />
        </View>
      ) : baoGia.isPaused ? (
        <EmptyState title="Không có kết nối" description="Báo giá sẽ tải khi có mạng trở lại." />
      ) : baoGia.isError || !baoGia.data ? (
        // 404/409: khung giờ vừa bị đặt hoặc khoá. Tài liệu backend dặn KHÔNG tự
        // thử lại mà mời người dùng chọn lại.
        <EmptyState
          title="Khung giờ không còn trống"
          description={toUserMessage(baoGia.error).description}
          actionLabel="Chọn giờ khác"
          onAction={quayLaiChonGio}
        />
      ) : (
        <>
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-4 px-gutter pb-6"
            keyboardShouldPersistTaps="handled"
          >
            <TheTomTat
              baoGia={baoGia.data}
              tenMentor={identity?.displayName ?? null}
              headline={identity?.headline ?? null}
            />

            <View className="gap-1">
              <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
                Mục tiêu buổi học
              </Text>
              <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
                Giúp mentor chuẩn bị tốt hơn cho bạn
              </Text>
            </View>
            <TextField
              label="Bạn muốn mentor giúp gì?"
              value={tieuDe}
              onChangeText={setTieuDe}
              placeholder="Ví dụ: Sửa CV để ứng tuyển intern Backend"
              error={loiTieuDe}
              testID="o-muc-tieu"
            />
            <TextField
              label="Mô tả thêm (không bắt buộc)"
              value={moTa}
              onChangeText={setMoTa}
              placeholder="Bối cảnh, tài liệu bạn đã có, điều bạn còn vướng…"
              multiline
              numberOfLines={3}
              error={loiMoTa}
              testID="o-mo-ta"
            />

            <TheChiPhi baoGia={baoGia.data} />

            {taoBooking.isError ? (
              <View testID="loi-gui-dat-lich" className="gap-1 rounded-md bg-neutral-soft p-3">
                <Text className="text-body text-danger" style={{ fontFamily: fonts.semibold }}>
                  {toUserMessage(taoBooking.error).title}
                </Text>
                <Text className="text-caption-lg text-danger" style={{ fontFamily: fonts.regular }}>
                  {toUserMessage(taoBooking.error).description}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <BottomBar
            primary={
              <Button
                label="Gửi yêu cầu đặt lịch"
                size="lg"
                busy={taoBooking.isPending}
                onPress={gui}
                testID="nut-gui-dat-lich"
              />
            }
          />
        </>
      )}
    </Screen>
  );
}

/** Một ô nhãn/giá trị trong lưới tóm tắt */
function O({ nhan, giaTri, noiBat }: { nhan: string; giaTri: string; noiBat?: boolean }) {
  return (
    <View style={{ width: '50%', paddingVertical: 6, paddingRight: 8 }}>
      <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
        {nhan}
      </Text>
      <Text
        className={`text-body ${noiBat ? 'text-accent' : 'text-ink'}`}
        style={{ fontFamily: fonts.bold, marginTop: 2 }}
      >
        {giaTri}
      </Text>
    </View>
  );
}

function TheTomTat({
  baoGia,
  tenMentor,
  headline,
}: {
  baoGia: BookingQuoteResponse;
  tenMentor: string | null;
  headline: string | null;
}) {
  const ngay = nhanNgayNgan(baoGia.scheduledStartAt);
  const gio = dinhDangKhoangGio(baoGia.scheduledStartAt, baoGia.scheduledEndAt);

  return (
    <View
      testID="the-tom-tat"
      className="gap-3.5 rounded-lg border border-line bg-surface"
      style={{ padding: spacing.card }}
    >
      {tenMentor ? (
        <View className="flex-row items-center gap-3">
          <Avatar name={tenMentor} size={52} tone="accent" />
          <View className="min-w-0 flex-1">
            <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
              {tenMentor}
            </Text>
            {headline ? (
              <Text
                numberOfLines={1}
                className="text-caption text-ink-muted"
                style={{ fontFamily: fonts.regular }}
              >
                {headline}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
      <View className="flex-row flex-wrap rounded-md bg-surface-page" style={{ padding: 12 }}>
        <O nhan="Dịch vụ" giaTri={baoGia.serviceTitle} />
        <O nhan="Thời lượng" giaTri={`${baoGia.durationMinutes} phút`} />
        <O
          nhan="Thời gian"
          giaTri={ngay && gio ? `${ngay} · ${gio}` : (dinhDangGio(baoGia.scheduledStartAt) ?? '—')}
          noiBat
        />
        <O nhan="Hình thức" giaTri="Online 1:1" />
      </View>
    </View>
  );
}

function TheChiPhi({ baoGia }: { baoGia: BookingQuoteResponse }) {
  const { pricing } = baoGia;
  const phaiTra = pricing.estimatedPayableScoin;
  const mienPhi = phaiTra === 0;
  const giam = pricing.campaignDiscountScoin ?? 0;
  const hanPhanHoi = baoGia.pendingExpireAt
    ? `${dinhDangGio(baoGia.pendingExpireAt) ?? ''} ${dinhDangNgayCoOffset(baoGia.pendingExpireAt) ?? ''}`.trim()
    : null;

  return (
    <View
      testID="the-chi-phi"
      className="gap-2.5 rounded-lg border border-line bg-surface"
      style={{ padding: spacing.card }}
    >
      <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
        Chi phí dự kiến
      </Text>

      {!mienPhi && pricing.priceScoin != null ? (
        <Dong nhan="Giá dịch vụ" giaTri={phanCachNghin(pricing.priceScoin)} />
      ) : null}
      {giam > 0 ? (
        <Dong
          nhan={pricing.campaignName ? `Ưu đãi · ${pricing.campaignName}` : 'Ưu đãi'}
          giaTri={`−${phanCachNghin(giam)}`}
        />
      ) : null}

      <View
        className="flex-row justify-between border-t border-dashed border-line"
        style={{ paddingTop: 10 }}
      >
        <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
          {mienPhi ? 'Buổi học' : 'Tạm tính phải trả'}
        </Text>
        <Text testID="so-phai-tra" className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
          {mienPhi ? 'Miễn phí' : phaiTra == null ? '—' : `${phanCachNghin(phaiTra)} S-coins`}
        </Text>
      </View>

      {pricing.disclaimer ? (
        <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular, lineHeight: 18 }}>
          {pricing.disclaimer}
        </Text>
      ) : null}

      <View className="flex-row gap-2">
        <ShieldCheck size={16} color={colors.accent} strokeWidth={2} style={{ marginTop: 1 }} />
        <Text
          testID="ghi-chu-thanh-toan"
          className="flex-1 text-caption text-ink-muted"
          style={{ fontFamily: fonts.regular, lineHeight: 18 }}
        >
          {mienPhi
            ? 'Buổi miễn phí được xác nhận ngay khi mentor chấp nhận.'
            : 'Chưa trừ S-coins lúc này. Khi mentor chấp nhận, bạn thanh toán trên web SkillSwap trong thời hạn được báo.'}
          {hanPhanHoi ? ` Mentor phản hồi trước ${hanPhanHoi}.` : ''}
        </Text>
      </View>
    </View>
  );
}

function Dong({ nhan, giaTri }: { nhan: string; giaTri: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-body text-ink-body" style={{ fontFamily: fonts.regular }}>
        {nhan}
      </Text>
      <Text className="text-body text-ink" style={{ fontFamily: fonts.semibold }}>
        {giaTri}
      </Text>
    </View>
  );
}

/** Trạng thái sau khi gửi thành công — thay hẳn màn, không cho bấm gửi lần hai */
function DaGui({ booking, onXemLichHen }: { booking: BookingResponse; onXemLichHen: () => void }) {
  const ngay = nhanNgayNgan(booking.selectedStartTime);
  const gio = dinhDangKhoangGio(booking.selectedStartTime, booking.selectedEndTime);

  return (
    <Screen testID="man-hinh-da-gui-dat-lich">
      <View className="flex-1 items-center justify-center gap-3 px-10">
        <View
          className="items-center justify-center rounded-full bg-surface-tint"
          style={{ width: 200, height: 200 }}
        >
          {/*
            Đây là trạng thái THÀNH CÔNG ("Đã gửi yêu cầu"), và `core/ui/brand.ts`
            dành tư thế vui cho đúng cảnh này. Thiết kế không vẽ khối này nên 160
            trong vòng tròn 200 là số của repo, giữ nguyên.
          */}
          <BrandImage source={KOKO_HAPPY} size={160} testID="minh-hoa-dat-lich-thanh-cong" />
        </View>
        <View className="flex-row items-center gap-2 pt-2">
          <CircleCheck size={20} color={colors.successInk} strokeWidth={2.4} />
          <Text className="text-section-title text-ink" style={{ fontFamily: fonts.bold }}>
            Đã gửi yêu cầu
          </Text>
        </View>
        <Text
          className="text-center text-body text-ink-body"
          style={{ fontFamily: fonts.regular }}
        >
          {booking.mentorDisplayName} sẽ phản hồi yêu cầu {booking.serviceTitle}
          {ngay && gio ? ` vào ${ngay} · ${gio}` : ''}. Bạn theo dõi trạng thái ở tab Lịch hẹn.
        </Text>
      </View>
      <BottomBar
        primary={
          <Button label="Xem lịch hẹn" size="lg" onPress={onXemLichHen} testID="nut-xem-lich-hen" />
        }
      />
    </Screen>
  );
}

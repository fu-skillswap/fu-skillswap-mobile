/**
 * @file BookingSlotScreen.tsx
 * @description Bước 2/3 của đặt lịch — chọn ngày và khung giờ, theo
 * `Booking.dc.html`: header có nút quay lại, thanh tiến trình ba đoạn, thẻ dịch
 * vụ, dải 7 ngày, lưới khung giờ ba cột và tấm tóm tắt bo góc trên ở đáy.
 *
 * ## Khác thiết kế ở đâu, vì sao
 *
 * - **Dịch vụ chọn bằng chip ngay trên màn**, thay cho link "Đổi" quay về hồ sơ:
 *   mentor có nhiều dịch vụ thì đổi tại chỗ đỡ một vòng điều hướng. Mentor chỉ có
 *   một dịch vụ thì không hiện chip nào.
 * - **Khung giờ lấy từ backend chứ không vẽ sẵn sáu ô**: mỗi ô là một candidate
 *   (`isSelectable`). Ô bị chặn vẫn hiện và gạch ngang như thiết kế, kèm lý do
 *   cho trình đọc màn hình.
 * - **Tóm tắt hiện GIÁ DỊCH VỤ, không phải "Tổng cộng"**: số phải trả thật (đã gồm
 *   phụ phí, ưu đãi) chỉ có ở báo giá của bước 3. In ở đây một con số rồi bước sau
 *   đổi số là nói sai với người dùng.
 * - **Lùi tuần không quá tuần hiện tại, tiến tối đa 3 tuần**: backend chỉ mở lịch
 *   trong khoảng đó.
 */

import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { trangThaiTai } from '@/core/api/queryState';
import { BottomBar } from '@/core/ui/BottomBar';
import { Button } from '@/core/ui/Button';
import { Chip } from '@/core/ui/Chip';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { ScreenHeader } from '@/core/ui/ScreenHeader';
import { WeekStrip } from '@/core/ui/WeekStrip';
import { colors, fonts, spacing } from '@/core/ui/theme';
import { BookingSteps } from '@/features/booking/components/BookingSteps';
import { useAvailabilitySlots, useSlotCandidates } from '@/features/booking/hooks/useDatLich';
import {
  cacNgayTrongTuan,
  congNgay,
  dauTuan,
  homNayVN,
  isoNgay,
  nhanGio,
  nhanNgayCoThu,
  nhanThang,
  nhomSlotTheoNgay,
} from '@/features/booking/lichTuan';
import type { ServiceSlotCandidateItemResponse } from '@/features/booking/types';
import { moTaGiaDichVu, moTaThoiLuong, useMentor } from '@/features/mentor';

/** Tiến tối đa bao nhiêu tuần so với tuần hiện tại */
const SO_TUAN_TOI_DA = 3;

/** Một ô khung giờ đã gắn slot của nó */
interface OKhungGio extends ServiceSlotCandidateItemResponse {
  slotId: string;
}

export interface BookingSlotScreenProps {
  mentorUserId: string;
  /** Dịch vụ người dùng bấm từ hồ sơ mentor; thiếu thì lấy dịch vụ đầu tiên đang mở */
  serviceId?: string;
  /** Đồng hồ cho test; mặc định là giờ thật */
  bayGioMs?: number;
}

export function BookingSlotScreen({ mentorUserId, serviceId, bayGioMs }: BookingSlotScreenProps) {
  const router = useRouter();
  const mentor = useMentor(mentorUserId);

  const dichVuDangMo = useMemo(
    () => (mentor.data?.services ?? []).filter((dv) => dv.isActive),
    [mentor.data],
  );
  const [dichVuChon, setDichVuChon] = useState<string | null>(serviceId ?? null);
  const maDichVu =
    dichVuDangMo.find((dv) => dv.serviceId === dichVuChon)?.serviceId ??
    dichVuDangMo[0]?.serviceId ??
    '';
  const dichVu = dichVuDangMo.find((dv) => dv.serviceId === maDichVu);

  const homNay = homNayVN(bayGioMs);
  const [tuan, setTuan] = useState(0);
  // Người dùng đã tự bấm lùi/tiến tuần chưa — chỉ tự nhảy tuần khi CHƯA.
  const [daTuDoiTuan, setDaTuDoiTuan] = useState(false);
  const thuHai = congNgay(dauTuan(homNay), tuan * 7);
  const cacNgay = cacNgayTrongTuan(thuHai);

  const lich = useAvailabilitySlots(mentorUserId, cacNgay[0].iso, cacNgay[6].iso);
  const theoNgay = useMemo(
    () => nhomSlotTheoNgay(lich.data ?? [], maDichVu),
    [lich.data, maDichVu],
  );

  // Tuần hiện tại không còn lịch nào (ví dụ hôm nay đã là Chủ nhật) thì tự sang
  // tuần sau MỘT lần, thay vì mở màn bằng một dải ngày toàn ô xám.
  const tuanNayTrong =
    lich.isSuccess && !nhomSlotTheoNgay(lich.data, maDichVu).size && maDichVu.length > 0;
  useEffect(() => {
    if (!daTuDoiTuan && tuan === 0 && tuanNayTrong) {
      setTuan(1);
    }
  }, [daTuDoiTuan, tuan, tuanNayTrong]);

  const [ngayChon, setNgayChon] = useState<string | null>(null);
  // Ngày đang chọn phải còn slot trong tuần và dịch vụ hiện tại; không thì tự
  // nhảy sang ngày có slot đầu tiên — tránh cảnh lưới giờ trống trong khi tuần
  // vẫn còn lịch.
  const ngayCoLich = cacNgay.filter((o) => (theoNgay.get(o.iso)?.length ?? 0) > 0);
  const ngay =
    ngayChon && theoNgay.has(ngayChon) ? ngayChon : (ngayCoLich[0]?.iso ?? null);
  const slotsTrongNgay = useMemo(
    () => (ngay ? (theoNgay.get(ngay) ?? []) : []),
    [ngay, theoNgay],
  );

  const ketQuaKhung = useSlotCandidates(mentorUserId, slotsTrongNgay, maDichVu);
  const khungGio: OKhungGio[] = useMemo(
    () =>
      ketQuaKhung.flatMap((kq, i) =>
        (kq.data?.candidateServiceSlots ?? []).map((k) => ({
          ...k,
          slotId: slotsTrongNgay[i]?.slotId ?? '',
        })),
      ),
    [ketQuaKhung, slotsTrongNgay],
  );
  const dangTaiKhung = ketQuaKhung.some((kq) => kq.isPending && kq.fetchStatus !== 'idle');
  const loiKhung = ketQuaKhung.find((kq) => kq.isError)?.error;

  const [khungChon, setKhungChon] = useState<OKhungGio | null>(null);
  // Khung đã chọn chỉ còn hiệu lực khi nó vẫn nằm trong lưới hiện tại và vẫn chọn được.
  const khung =
    khungChon &&
    khungGio.some(
      (k) => k.slotId === khungChon.slotId && k.startAt === khungChon.startAt && k.isSelectable,
    )
      ? khungChon
      : null;

  const roiDi = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  const tiepTuc = () => {
    if (!khung || !maDichVu) {
      return;
    }
    router.push({
      pathname: '/booking/confirm',
      params: { mentorUserId, slotId: khung.slotId, serviceId: maDichVu, startAt: khung.startAt },
    });
  };

  const trangThaiMentor = trangThaiTai({
    isPaused: mentor.isPaused,
    isPending: mentor.isPending,
    isError: mentor.isError,
    coDuLieu: mentor.data !== undefined,
  });

  const gia = dichVu ? moTaGiaDichVu(dichVu) : null;
  const tenMentor = mentor.data?.identity.displayName;

  return (
    <Screen testID="man-hinh-chon-lich">
      <OfflineBanner />
      <View className="gap-4 px-gutter pb-3 pt-2">
        <ScreenHeader
          title="Chọn thời gian"
          subtitle={tenMentor ? `Bước 2/3 · với ${tenMentor}` : 'Bước 2/3'}
          onBack={roiDi}
        />
        <BookingSteps current={2} />
      </View>

      {trangThaiMentor === 'dang-tai' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-mentor" color={colors.accent} />
        </View>
      ) : trangThaiMentor === 'mat-ket-noi' ? (
        <EmptyState title="Không có kết nối" description="Lịch sẽ tải khi có mạng trở lại." />
      ) : trangThaiMentor === 'loi' ? (
        <ErrorView error={mentor.error} onAction={() => void mentor.refetch()} />
      ) : !dichVu ? (
        <EmptyState
          title="Mentor chưa mở dịch vụ nào"
          description="Bạn chưa thể đặt lịch với mentor này lúc này."
        />
      ) : (
        <>
          <ScrollView contentContainerClassName="gap-4 px-gutter pb-6" className="flex-1">
            {/* Thẻ dịch vụ đang đặt */}
            <View
              testID="the-dich-vu-dang-dat"
              className="flex-row items-center gap-3 rounded-lg border border-line bg-surface"
              style={{ paddingHorizontal: spacing.card, paddingVertical: 14 }}
            >
              <View className="min-w-0 flex-1">
                <Text className="text-body text-ink" style={{ fontFamily: fonts.bold }}>
                  {dichVu.title}
                </Text>
                <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
                  {moTaThoiLuong(dichVu)}
                </Text>
              </View>
              {gia ? (
                <Text className="text-body text-ink" style={{ fontFamily: fonts.extrabold }}>
                  {gia.so ? `${gia.so} S-coins` : gia.nhan}
                </Text>
              ) : null}
            </View>

            {dichVuDangMo.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                accessibilityLabel="Chọn dịch vụ"
                style={{ marginRight: -spacing.gutter }}
                contentContainerStyle={{ gap: 8, paddingRight: spacing.gutter }}
              >
                {dichVuDangMo.map((dv) => (
                  <Chip
                    key={dv.serviceId}
                    label={dv.title}
                    selected={dv.serviceId === maDichVu}
                    onPress={() => {
                      setDichVuChon(dv.serviceId);
                      setKhungChon(null);
                    }}
                    testID={`chon-dich-vu-${dv.serviceId}`}
                  />
                ))}
              </ScrollView>
            ) : null}

            {/* Tiêu đề tháng + lùi/tiến tuần */}
            <View className="flex-row items-center justify-between">
              <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
                {nhanThang(thuHai)}
              </Text>
              <View className="flex-row">
                <NutTuan
                  huong="lui"
                  disabled={tuan === 0}
                  onPress={() => {
                    setDaTuDoiTuan(true);
                    setTuan((t) => Math.max(0, t - 1));
                    setNgayChon(null);
                    setKhungChon(null);
                  }}
                />
                <NutTuan
                  huong="tien"
                  disabled={tuan >= SO_TUAN_TOI_DA}
                  onPress={() => {
                    setDaTuDoiTuan(true);
                    setTuan((t) => Math.min(SO_TUAN_TOI_DA, t + 1));
                    setNgayChon(null);
                    setKhungChon(null);
                  }}
                />
              </View>
            </View>

            {/* Dải 7 ngày */}
            <WeekStrip
              days={cacNgay}
              selected={ngay}
              onSelect={(iso) => {
                setNgayChon(iso);
                setKhungChon(null);
              }}
              isDisabled={(o) => (theoNgay.get(o.iso)?.length ?? 0) === 0 || o.iso < isoNgay(homNay)}
            />

            {/* Lưới khung giờ */}
            <View className="flex-row items-baseline justify-between">
              <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
                Khung giờ trống
              </Text>
              <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
                Giờ Việt Nam (GMT+7)
              </Text>
            </View>

            {lich.isPending && lich.fetchStatus !== 'idle' ? (
              <ActivityIndicator testID="dang-tai-lich" color={colors.accent} />
            ) : lich.isError ? (
              <ErrorView error={lich.error} onAction={() => void lich.refetch()} />
            ) : ngayCoLich.length === 0 ? (
              <Text
                testID="tuan-khong-co-lich"
                className="text-body text-ink-muted"
                style={{ fontFamily: fonts.medium }}
              >
                Mentor chưa mở lịch cho dịch vụ này trong tuần. Thử xem tuần sau.
              </Text>
            ) : dangTaiKhung ? (
              <ActivityIndicator testID="dang-tai-khung-gio" color={colors.accent} />
            ) : loiKhung ? (
              <ErrorView
                error={loiKhung}
                onAction={() => ketQuaKhung.forEach((kq) => void kq.refetch())}
              />
            ) : khungGio.length === 0 ? (
              <Text className="text-body text-ink-muted" style={{ fontFamily: fonts.medium }}>
                Ngày này không còn khung giờ nào vừa với dịch vụ.
              </Text>
            ) : (
              <View testID="luoi-khung-gio" style={{ gap: 10 }}>
                {/*
                  Lưới ba cột cố định như thiết kế. Chia hàng thủ công và độn ô
                  rỗng vào hàng cuối: `flex-wrap` + `flexGrow` làm hai ô cuối
                  phình ra chiếm cả hàng.
                */}
                {chiaHang(khungGio, 3).map((hang, i) => (
                  <View key={i} className="flex-row" style={{ gap: 10 }}>
                    {hang.map((k, j) => {
                      if (!k) {
                        return <View key={`trong-${j}`} className="flex-1" />;
                      }
                      const nhan = nhanGio(k.startTime) ?? '--:--';
                      const chon = khung?.slotId === k.slotId && khung.startAt === k.startAt;
                      return (
                        <View key={`${k.slotId}-${k.startAt}`} className="flex-1">
                          <Chip
                            variant="slot"
                            label={nhan}
                            selected={chon}
                            disabled={!k.isSelectable}
                            onPress={() => setKhungChon(k)}
                            testID={`khung-${nhan}`}
                          />
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <BottomBar
            variant="sheet"
            summary={
              <View className="flex-row justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
                    Thời gian
                  </Text>
                  <Text
                    testID="tom-tat-thoi-gian"
                    className="text-body text-accent"
                    style={{ fontFamily: fonts.bold }}
                  >
                    {khung
                      ? `${nhanNgayCoThu(khung.startTime) ?? ''} · ${nhanGio(khung.startTime) ?? ''}`
                      : 'Chọn một khung giờ'}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
                    Giá dịch vụ
                  </Text>
                  <Text className="text-body text-ink" style={{ fontFamily: fonts.extrabold }}>
                    {gia?.so ? `${gia.so} S-coins` : (gia?.nhan ?? '')}
                  </Text>
                </View>
              </View>
            }
            primary={
              <Button
                label="Tiếp tục"
                size="lg"
                disabled={!khung}
                onPress={tiepTuc}
                testID="nut-tiep-tuc"
              />
            }
          />
        </>
      )}
    </Screen>
  );
}

/** Chia mảng thành các hàng `soCot` phần tử; hàng cuối độn `null` cho đủ cột */
function chiaHang<T>(mang: readonly T[], soCot: number): (T | null)[][] {
  const hang: (T | null)[][] = [];
  for (let i = 0; i < mang.length; i += soCot) {
    const mot: (T | null)[] = mang.slice(i, i + soCot);
    while (mot.length < soCot) {
      mot.push(null);
    }
    hang.push(mot);
  }
  return hang;
}

/** Nút lùi/tiến tuần — 44×44, không nền, đúng thiết kế */
function NutTuan({
  huong,
  disabled,
  onPress,
}: {
  huong: 'lui' | 'tien';
  disabled: boolean;
  onPress: () => void;
}) {
  const Icon = huong === 'lui' ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={huong === 'lui' ? 'Tuần trước' : 'Tuần sau'}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={huong === 'lui' ? 'tuan-truoc' : 'tuan-sau'}
      className="items-center justify-center rounded-full"
      style={{ width: spacing.touch, height: spacing.touch }}
    >
      <Icon size={20} color={disabled ? colors.line : colors.ink} strokeWidth={2} />
    </Pressable>
  );
}

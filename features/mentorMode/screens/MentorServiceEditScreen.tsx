/**
 * @file MentorServiceEditScreen.tsx
 * @description Sửa (hoặc tạo) một dịch vụ, theo `MentorServiceDetail.dc.html`:
 * eyebrow "DỊCH VỤ TƯ VẤN 1:1", thẻ "Thông tin dịch vụ" (tên, thời lượng, mô tả,
 * kết quả mong đợi), thẻ "Thông tin giá" và công tắc "Duy trì chat sau buổi học",
 * nút "Lưu thay đổi" ở đáy.
 *
 * Ba con số giá đọc từ backend (`basePriceScoin`, `publicPriceScoin`,
 * `estimatedMentorPayoutScoin`) — màn KHÔNG tự tính phí. Khi mentor gõ giá mới,
 * hai số dưới hiện "Cập nhật sau khi lưu" thay vì một con số đoán.
 *
 * Thời lượng chỉ chọn được lúc TẠO (từ `allowedDurationMinutes` của
 * `/constraints`); `UpdateMentorServiceRequest` không có trường thời lượng, nên
 * khi sửa nó chỉ để xem.
 */

import { useRouter } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { toUserMessage } from '@/core/api/errors';
import { trangThaiTai } from '@/core/api/queryState';
import { phanCachNghin } from '@/core/format/soLuong';
import { BottomBar } from '@/core/ui/BottomBar';
import { Button } from '@/core/ui/Button';
import { Chip } from '@/core/ui/Chip';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { ScreenHeader } from '@/core/ui/ScreenHeader';
import { Switch } from '@/core/ui/Switch';
import { TextField } from '@/core/ui/TextField';
import { colors, fonts, spacing } from '@/core/ui/theme';
import {
  useCreateService,
  useMyService,
  useServiceConstraints,
  useUpdateService,
} from '@/features/mentorMode/hooks/useMentorStudio';
import { MO_TA_DICH_VU_TOI_DA, TIEU_DE_DICH_VU_TOI_DA } from '@/features/mentorMode/types';
import type { MentorServiceConstraintsResponse } from '@/features/mentorMode/types';

/** Đọc ô giá "150.000" / "150000" thành số; `null` khi không phải số nguyên không âm */
export function docGia(chuoi: string): number | null {
  const so = chuoi.replace(/[.\s,]/g, '');
  return /^\d+$/.test(so) ? Number(so) : null;
}

/** Kiểm form dịch vụ; `null` khi gửi được */
export function loiDichVu(input: {
  tieuDe: string;
  moTa: string;
  ketQua: string;
  mienPhi: boolean;
  gia: string;
  thoiLuong: number | null;
  rangBuoc: MentorServiceConstraintsResponse | undefined;
}): string | null {
  if (!input.tieuDe.trim() || !input.moTa.trim() || !input.ketQua.trim()) {
    return 'Điền đủ tên, mô tả và kết quả mong đợi.';
  }
  if (input.tieuDe.trim().length > TIEU_DE_DICH_VU_TOI_DA) {
    return `Tên tối đa ${TIEU_DE_DICH_VU_TOI_DA} ký tự.`;
  }
  if (input.moTa.trim().length > MO_TA_DICH_VU_TOI_DA || input.ketQua.trim().length > MO_TA_DICH_VU_TOI_DA) {
    return `Mô tả và kết quả tối đa ${MO_TA_DICH_VU_TOI_DA} ký tự.`;
  }
  if (input.thoiLuong === null) {
    return 'Chọn thời lượng.';
  }
  if (input.mienPhi) {
    return null;
  }
  const gia = docGia(input.gia);
  if (gia === null || gia === 0) {
    return 'Nhập giá bằng số S-coins, hoặc bật "Dịch vụ miễn phí".';
  }
  if (input.rangBuoc) {
    const min = input.rangBuoc.minimumPriceScoinPerMinute * input.thoiLuong;
    const max = input.rangBuoc.maximumPriceScoinPerMinute * input.thoiLuong;
    if (gia < min || gia > max) {
      return `Với ${input.thoiLuong} phút, giá phải từ ${phanCachNghin(min)} đến ${phanCachNghin(max)} S-coins.`;
    }
  }
  return null;
}

export function MentorServiceEditScreen({ serviceId }: { serviceId: string | null }) {
  const router = useRouter();
  const laTaoMoi = serviceId === null;
  const dichVu = useMyService(serviceId ?? '');
  const rangBuoc = useServiceConstraints();
  const tao = useCreateService();
  const sua = useUpdateService(serviceId ?? '');

  const [tieuDe, setTieuDe] = useState('');
  const [moTa, setMoTa] = useState('');
  const [ketQua, setKetQua] = useState('');
  const [mienPhi, setMienPhi] = useState(false);
  const [gia, setGia] = useState('');
  const [giuChat, setGiuChat] = useState(true);
  const [thoiLuong, setThoiLuong] = useState<number | null>(null);
  const [daNap, setDaNap] = useState(false);

  // Nạp dữ liệu vào form MỘT lần khi bản ghi về — tải lại nền không được xoá
  // chữ mentor đang gõ dở.
  useEffect(() => {
    if (dichVu.data && !daNap) {
      setTieuDe(dichVu.data.title);
      setMoTa(dichVu.data.description);
      setKetQua(dichVu.data.expectedOutcome);
      setMienPhi(dichVu.data.isFree);
      setGia(dichVu.data.basePriceScoin != null ? phanCachNghin(dichVu.data.basePriceScoin) : '');
      setGiuChat(dichVu.data.maintainPostSessionChat);
      setThoiLuong(dichVu.data.durationMinutes);
      setDaNap(true);
    }
  }, [dichVu.data, daNap]);

  const roiDi = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/mentor-schedule');
  };

  const trangThaiDichVu = trangThaiTai({
    isPaused: dichVu.isPaused,
    isPending: dichVu.isPending,
    isError: dichVu.isError,
    coDuLieu: dichVu.data !== undefined,
  });
  const trangThaiRangBuoc = trangThaiTai({
    isPaused: rangBuoc.isPaused,
    isPending: rangBuoc.isPending,
    isError: rangBuoc.isError,
    coDuLieu: rangBuoc.data !== undefined,
  });

  if (!laTaoMoi && trangThaiDichVu === 'dang-tai') {
    return (
      <Screen testID="man-hinh-sua-dich-vu">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-dich-vu" color={colors.accent} />
        </View>
      </Screen>
    );
  }
  if (!laTaoMoi && trangThaiDichVu === 'mat-ket-noi') {
    // Truy vấn bị HOÃN khi mất mạng: `isPending` bật mãi, vòng quay không dừng.
    return (
      <Screen testID="man-hinh-sua-dich-vu">
        <OfflineBanner />
        <View className="px-gutter pt-2">
          <ScreenHeader title="Chỉnh sửa dịch vụ" onBack={roiDi} />
        </View>
        <EmptyState
          title="Không có kết nối"
          description="Dịch vụ sẽ tải khi có mạng trở lại."
          actionLabel="Thử lại"
          onAction={() => void dichVu.refetch()}
        />
      </Screen>
    );
  }
  if (!laTaoMoi && (dichVu.isError || !dichVu.data)) {
    return (
      <Screen testID="man-hinh-sua-dich-vu">
        <View className="px-gutter pt-2">
          <ScreenHeader title="Chỉnh sửa dịch vụ" onBack={roiDi} />
        </View>
        <ErrorView error={dichVu.error} onAction={() => void dichVu.refetch()} />
      </Screen>
    );
  }

  const loi = loiDichVu({ tieuDe, moTa, ketQua, mienPhi, gia, thoiLuong, rangBuoc: rangBuoc.data });
  const giaDaDoi = !laTaoMoi && dichVu.data && (mienPhi !== dichVu.data.isFree || docGia(gia) !== dichVu.data.basePriceScoin);
  const loiGui = tao.error ?? sua.error;

  const luu = () => {
    if (loi || thoiLuong === null) {
      return;
    }
    const chung = {
      title: tieuDe.trim(),
      description: moTa.trim(),
      expectedOutcome: ketQua.trim(),
      isFree: mienPhi,
      priceScoin: mienPhi ? 0 : (docGia(gia) ?? 0),
      maintainPostSessionChat: giuChat,
    };
    if (laTaoMoi) {
      tao.mutate({ ...chung, durationMinutes: thoiLuong, deliveryMode: 'ONE_TO_ONE' }, { onSuccess: roiDi });
    } else if (dichVu.data) {
      sua.mutate({ ...chung, expectedVersion: dichVu.data.version }, { onSuccess: roiDi });
    }
  };

  return (
    <Screen testID="man-hinh-sua-dich-vu">
      <OfflineBanner />
      <View className="px-gutter pb-3 pt-2">
        <ScreenHeader
          eyebrow="DỊCH VỤ TƯ VẤN 1:1"
          title={laTaoMoi ? 'Tạo dịch vụ' : 'Chỉnh sửa dịch vụ'}
          onBack={roiDi}
        />
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView className="flex-1" contentContainerClassName="gap-3.5 px-gutter pb-6" keyboardShouldPersistTaps="handled">
          <View className="gap-3 rounded-lg border border-line bg-surface" style={{ padding: spacing.card }}>
            <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
              Thông tin dịch vụ
            </Text>
            <TextField label="Tên dịch vụ" value={tieuDe} onChangeText={setTieuDe} placeholder="Ví dụ: Review CV 1:1" testID="o-ten-dich-vu" />
            {laTaoMoi ? (
              <View className="gap-2">
                <Text className="text-caption-lg text-ink" style={{ fontFamily: fonts.semibold }}>
                  Thời lượng
                </Text>
                {trangThaiRangBuoc === 'dang-tai' ? (
                  <ActivityIndicator testID="dang-tai-thoi-luong" color={colors.accent} />
                ) : trangThaiRangBuoc === 'co-noi-dung' ? (
                  <View className="flex-row flex-wrap gap-2">
                    {(rangBuoc.data?.allowedDurationMinutes ?? []).slice().sort((a, b) => a - b).map((p) => (
                      <Chip key={p} label={`${p} phút`} selected={thoiLuong === p} onPress={() => setThoiLuong(p)} testID={`thoi-luong-${p}`} />
                    ))}
                  </View>
                ) : (
                  // Không tải được danh sách thời lượng thì form không bao giờ
                  // gửi được (chưa chọn thời lượng) — phải nói ra và cho thử lại.
                  <View testID="loi-thoi-luong" className="gap-2">
                    <Text className="text-caption text-danger" style={{ fontFamily: fonts.medium }}>
                      {trangThaiRangBuoc === 'mat-ket-noi'
                        ? 'Không có kết nối nên chưa tải được các thời lượng cho phép.'
                        : 'Chưa tải được các thời lượng cho phép.'}
                    </Text>
                    <Button label="Thử lại" variant="secondary" size="sm" onPress={() => void rangBuoc.refetch()} testID="nut-tai-lai-thoi-luong" />
                  </View>
                )}
              </View>
            ) : (
              <View className="flex-row items-center gap-2.5 rounded-md bg-surface-page p-3">
                <Clock size={18} color={colors.accent} strokeWidth={2} />
                <View className="flex-1">
                  <Text className="text-body text-ink" style={{ fontFamily: fonts.bold }}>
                    {`${thoiLuong ?? '—'} phút · Thời lượng cố định`}
                  </Text>
                  <Text className="text-ink-muted" style={{ fontFamily: fonts.regular, fontSize: 11 }}>
                    Thời lượng không đổi được theo chính sách dịch vụ
                  </Text>
                </View>
              </View>
            )}
            <TextField label="Mô tả dịch vụ" value={moTa} onChangeText={setMoTa} multiline numberOfLines={3} testID="o-mo-ta-dich-vu" />
            <TextField label="Kết quả mong đợi" value={ketQua} onChangeText={setKetQua} multiline numberOfLines={2} testID="o-ket-qua" />
          </View>

          <View className="gap-2.5 rounded-lg border border-line bg-surface" style={{ padding: spacing.card }}>
            <Text className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
              Thông tin giá
            </Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-body text-ink-body" style={{ fontFamily: fonts.medium }}>
                Dịch vụ miễn phí
              </Text>
              <Switch value={mienPhi} onValueChange={setMienPhi} accessibilityLabel="Dịch vụ miễn phí" testID="cong-tac-mien-phi" />
            </View>
            {!mienPhi ? (
              <TextField label="Giá cơ sở (S-coins)" value={gia} onChangeText={setGia} keyboardType="number-pad" placeholder="150.000" testID="o-gia" />
            ) : null}
            {!laTaoMoi && dichVu.data && !mienPhi ? (
              <>
                <Dong nhan="Giá mentee thấy" giaTri={giaDaDoi ? 'Cập nhật sau khi lưu' : dichVu.data.publicPriceScoin != null ? phanCachNghin(dichVu.data.publicPriceScoin) : '—'} />
                <View className="flex-row justify-between border-t border-dashed border-line pt-2.5">
                  <Text className="text-body text-ink" style={{ fontFamily: fonts.bold }}>
                    Thu nhập dự kiến
                  </Text>
                  <Text testID="thu-nhap-du-kien" className="text-body text-success-ink" style={{ fontFamily: fonts.bold }}>
                    {giaDaDoi
                      ? 'Cập nhật sau khi lưu'
                      : dichVu.data.estimatedMentorPayoutScoin != null
                        ? `${phanCachNghin(dichVu.data.estimatedMentorPayoutScoin)} S-coins`
                        : '—'}
                  </Text>
                </View>
              </>
            ) : null}
          </View>

          <View className="flex-row items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3.5">
            <View className="flex-1">
              <Text className="text-body text-ink" style={{ fontFamily: fonts.bold }}>
                Duy trì chat sau buổi học
              </Text>
              <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
                Cho phép tiếp tục trao đổi sau phiên
              </Text>
            </View>
            <Switch value={giuChat} onValueChange={setGiuChat} accessibilityLabel="Duy trì chat sau buổi học" testID="cong-tac-giu-chat" />
          </View>

          <Text testID="ghi-chu-form" className={`text-caption ${loiGui ? 'text-danger' : 'text-ink-muted'}`} style={{ fontFamily: fonts.medium }}>
            {loiGui ? toUserMessage(loiGui).description : (loi ?? ' ')}
          </Text>
        </ScrollView>

        <BottomBar
          primary={
            <Button
              label={laTaoMoi ? 'Tạo dịch vụ' : 'Lưu thay đổi'}
              size="lg"
              busy={tao.isPending || sua.isPending}
              disabled={loi !== null}
              onPress={luu}
              testID="nut-luu-dich-vu"
            />
          }
        />
      </KeyboardAvoidingView>
    </Screen>
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

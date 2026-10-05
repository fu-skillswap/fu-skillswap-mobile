/**
 * @file OnboardingScreen.tsx
 * @description Hoàn thiện (hoặc sửa) hồ sơ sinh viên, theo `Onboarding.dc.html`:
 * đầu trang "BƯỚC CUỐI" kèm Koko, một thẻ form, thanh dưới "Để sau" / "Hoàn tất".
 *
 * Một màn cho hai việc vì backend chỉ có MỘT endpoint (`PUT
 * /api/me/student-profile` tạo mới hoặc ghi đè):
 *
 * - **Chưa có hồ sơ** (vào ngay sau lần đăng nhập đầu, hoặc từ tab Hồ sơ): đầu
 *   trang của thiết kế, có nút "Để sau".
 * - **Đã có hồ sơ** (nút "Chỉnh sửa" ở tab Hồ sơ): thanh trên có nút quay lại,
 *   form nạp sẵn dữ liệu cũ, không có "Để sau".
 *
 * ## Khác thiết kế, và vì sao
 *
 * - **Thêm ô Chuyên ngành**: thiết kế không vẽ, nhưng `specializationId` là
 *   `@NotNull` và phải thuộc ngành đã chọn. Chọn ngành xong mới hiện, đổi ngành
 *   thì xoá lựa chọn cũ.
 * - **Học kỳ có ô "Dự bị" (kỳ 0)**: backend nhận 0–9, thiết kế chỉ vẽ 1–9.
 * - **Cơ sở và ngành là chip, không phải dropdown**: danh sách ngắn, chip bấm một
 *   chạm và thấy hết lựa chọn. Năm nhập học là ô số (khoảng hợp lệ dài 27 năm).
 * - **Cựu sinh viên ẩn học kỳ, hiện năm tốt nghiệp**: backend tự ghi kỳ 9 cho cựu
 *   sinh viên và bắt buộc năm tốt nghiệp — xem `taoYeuCauHoSo()`.
 */

import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { toUserMessage } from '@/core/api/errors';
import { useAuth } from '@/core/auth/AuthProvider';
import { BottomBar } from '@/core/ui/BottomBar';
import { KOKO_READING } from '@/core/ui/brand';
import { BrandImage } from '@/core/ui/BrandImage';
import { Button } from '@/core/ui/Button';
import { Chip } from '@/core/ui/Chip';
import { ErrorView } from '@/core/ui/ErrorView';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { ScreenHeader } from '@/core/ui/ScreenHeader';
import { Switch } from '@/core/ui/Switch';
import { TextField } from '@/core/ui/TextField';
import { colors, fonts, spacing } from '@/core/ui/theme';
import type { BanNhapHoSo } from '@/features/profile/hoSoHocThuat';
import { banNhapMoi, banNhapTuHoSo, HOC_KY, kiemHoSo, taoYeuCauHoSo } from '@/features/profile/hoSoHocThuat';
import {
  useAcademicPrograms,
  useCampuses,
  useSaveStudentProfile,
  useSpecializations,
  useStudentProfile,
} from '@/features/profile/hooks/useProfileQueries';

export interface OnboardingScreenProps {
  /** Năm hiện tại cho luật kiểm năm; test truyền cố định */
  namHienTai?: number;
}

export function OnboardingScreen({ namHienTai = new Date().getFullYear() }: OnboardingScreenProps) {
  const router = useRouter();
  const { user } = useAuth();
  const hoSo = useStudentProfile();
  const coSo = useCampuses();
  const nganh = useAcademicPrograms();
  const luu = useSaveStudentProfile();

  const [banNhap, setBanNhap] = useState<BanNhapHoSo | null>(null);
  const chuyenNganh = useSpecializations(banNhap?.programId ?? null);

  // Nạp form MỘT lần khi biết người dùng đã có hồ sơ hay chưa — lần tải lại nền
  // sau đó không được xoá chữ đang gõ dở.
  useEffect(() => {
    if (banNhap === null && hoSo.data !== undefined) {
      setBanNhap(hoSo.data ? banNhapTuHoSo(hoSo.data) : banNhapMoi(user?.fullName));
    }
  }, [banNhap, hoSo.data, user?.fullName]);

  const laSua = Boolean(hoSo.data);
  const kiem = useMemo(() => (banNhap ? kiemHoSo(banNhap, namHienTai) : null), [banNhap, namHienTai]);

  const roiMan = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const veTrangChu = () => router.replace('/(tabs)');

  const doi = <K extends keyof BanNhapHoSo>(truong: K, giaTri: BanNhapHoSo[K]) =>
    setBanNhap((cu) => (cu ? { ...cu, [truong]: giaTri } : cu));

  const chonNganh = (programId: string) =>
    setBanNhap((cu) =>
      cu && cu.programId !== programId ? { ...cu, programId, specializationId: null } : cu,
    );

  if (hoSo.isError || coSo.isError || nganh.isError) {
    const loi = hoSo.error ?? coSo.error ?? nganh.error;
    return (
      <Screen testID="man-hinh-hoan-thien-ho-so">
        <View className="px-gutter pt-2">
          <ScreenHeader title="Hoàn thiện hồ sơ" onBack={roiMan} />
        </View>
        <ErrorView
          error={loi}
          onAction={() => {
            void hoSo.refetch();
            void coSo.refetch();
            void nganh.refetch();
          }}
        />
      </Screen>
    );
  }

  if (!banNhap || !kiem || coSo.data === undefined || nganh.data === undefined) {
    return (
      <Screen testID="man-hinh-hoan-thien-ho-so">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-ho-so" color={colors.accent} />
        </View>
      </Screen>
    );
  }

  const gui = () => {
    if (kiem.conThieu !== null) {
      return;
    }
    luu.mutate(taoYeuCauHoSo(banNhap), { onSuccess: laSua ? roiMan : veTrangChu });
  };

  return (
    <Screen testID="man-hinh-hoan-thien-ho-so">
      <OfflineBanner />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-gutter pb-6 pt-2"
          keyboardShouldPersistTaps="handled"
        >
          {laSua ? (
            <ScreenHeader title="Chỉnh sửa hồ sơ" subtitle="Hồ sơ học thuật" onBack={roiMan} />
          ) : (
            <View className="flex-row items-center gap-3">
              <View className="min-w-0 flex-1 gap-1.5">
                <Text
                  className="text-caption text-accent"
                  style={{ fontFamily: fonts.semibold, letterSpacing: 2.2 }}
                >
                  BƯỚC CUỐI
                </Text>
                <Text className="text-ink" style={{ fontFamily: fonts.bold, fontSize: 24, lineHeight: 30 }}>
                  Hoàn thiện hồ sơ
                </Text>
                <Text className="text-caption-lg text-ink-body" style={{ fontFamily: fonts.regular }}>
                  Hồ sơ đầy đủ giúp bạn kết nối với mentor phù hợp hơn.
                </Text>
              </View>
              {/*
                `Onboarding.dc.html` dòng 27 dùng blob `2fb2a1e7…`, bảng asset ở
                mục 3 của HANDOFF.md ánh xạ nó sang `koko-reading.png` — tư thế
                ĐANG ĐỌC, không phải tư thế chuẩn. Cỡ 92×92 lấy đúng thiết kế.
              */}
              <BrandImage source={KOKO_READING} size={92} testID="minh-hoa-hoan-thien-ho-so" />
            </View>
          )}

          <View
            className="gap-3.5 rounded-lg border border-line bg-surface"
            style={{ paddingHorizontal: spacing.card, paddingVertical: 18 }}
          >
            <TextField
              label="Tên hiển thị"
              value={banNhap.ten}
              onChangeText={(v) => doi('ten', v)}
              error={kiem.loiTruong.ten}
              testID="o-ten-hien-thi"
            />
            <TextField
              label="Mã số sinh viên"
              value={banNhap.mssv}
              onChangeText={(v) => doi('mssv', v)}
              placeholder="SE192621"
              autoCapitalize="characters"
              error={kiem.loiTruong.mssv}
              testID="o-mssv"
            />

            <NhomChon tieuDe="Cơ sở">
              {coSo.data.map((c) => (
                <Chip
                  key={c.id}
                  label={c.city}
                  selected={banNhap.campusId === c.id}
                  onPress={() => doi('campusId', c.id)}
                  testID={`co-so-${c.id}`}
                />
              ))}
            </NhomChon>

            <TextField
              label="Năm nhập học"
              value={banNhap.namNhapHoc}
              onChangeText={(v) => doi('namNhapHoc', v)}
              placeholder={String(namHienTai - 2)}
              keyboardType="number-pad"
              error={kiem.loiTruong.namNhapHoc}
              testID="o-nam-nhap-hoc"
            />

            <NhomChon tieuDe="Ngành học">
              {nganh.data.map((p) => (
                <Chip
                  key={p.id}
                  label={p.nameVi}
                  selected={banNhap.programId === p.id}
                  onPress={() => chonNganh(p.id)}
                  testID={`nganh-${p.id}`}
                />
              ))}
            </NhomChon>

            {banNhap.programId ? (
              <NhomChon tieuDe="Chuyên ngành">
                {chuyenNganh.isPending ? (
                  <ActivityIndicator testID="dang-tai-chuyen-nganh" color={colors.accent} />
                ) : chuyenNganh.isError ? (
                  <Text className="text-caption text-danger" style={{ fontFamily: fonts.medium }}>
                    {toUserMessage(chuyenNganh.error).description}
                  </Text>
                ) : (chuyenNganh.data ?? []).length === 0 ? (
                  <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.medium }}>
                    Ngành này chưa có chuyên ngành nào để chọn.
                  </Text>
                ) : (
                  (chuyenNganh.data ?? []).map((s) => (
                    <Chip
                      key={s.id}
                      label={s.nameVi}
                      selected={banNhap.specializationId === s.id}
                      onPress={() => doi('specializationId', s.id)}
                      testID={`chuyen-nganh-${s.id}`}
                    />
                  ))
                )}
              </NhomChon>
            ) : null}

            {!banNhap.daTotNghiep ? (
              <View className="gap-2">
                <Text className="text-caption-lg text-ink" style={{ fontFamily: fonts.semibold }}>
                  Học kỳ
                </Text>
                <View accessibilityRole="radiogroup" accessibilityLabel="Học kỳ" className="flex-row flex-wrap gap-1.5">
                  {HOC_KY.map((k) => (
                    <View key={k} style={{ width: '18.4%' }}>
                      <Chip
                        label={k === 0 ? 'Dự bị' : String(k)}
                        selected={banNhap.hocKy === k}
                        onPress={() => doi('hocKy', k)}
                        testID={`hoc-ky-${k}`}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View className="flex-row items-center gap-3" style={{ minHeight: spacing.touch }}>
              <Text className="flex-1 text-body text-ink-body" style={{ fontFamily: fonts.medium }}>
                Tôi đã tốt nghiệp (alumni)
              </Text>
              <Switch
                value={banNhap.daTotNghiep}
                onValueChange={(v) => doi('daTotNghiep', v)}
                accessibilityLabel="Tôi đã tốt nghiệp"
                testID="cong-tac-tot-nghiep"
              />
            </View>

            {banNhap.daTotNghiep ? (
              <TextField
                label="Năm tốt nghiệp"
                value={banNhap.namTotNghiep}
                onChangeText={(v) => doi('namTotNghiep', v)}
                placeholder={String(namHienTai)}
                keyboardType="number-pad"
                error={kiem.loiTruong.namTotNghiep}
                testID="o-nam-tot-nghiep"
              />
            ) : null}

            <TextField
              label="Giới thiệu (không bắt buộc)"
              value={banNhap.gioiThieu}
              onChangeText={(v) => doi('gioiThieu', v)}
              placeholder="Kỹ năng và mục tiêu học tập của bạn"
              multiline
              numberOfLines={3}
              testID="o-gioi-thieu"
            />
          </View>

          <Text
            testID="ghi-chu-ho-so"
            className={`text-caption ${luu.error ? 'text-danger' : 'text-ink-muted'}`}
            style={{ fontFamily: fonts.medium }}
          >
            {luu.error ? toUserMessage(luu.error).description : (kiem.conThieu ?? ' ')}
          </Text>
        </ScrollView>

        <BottomBar
          secondary={
            laSua ? undefined : (
              <Button label="Để sau" variant="secondary" size="lg" onPress={veTrangChu} testID="nut-de-sau" />
            )
          }
          primary={
            <Button
              label={laSua ? 'Lưu thay đổi' : 'Hoàn tất'}
              size="lg"
              busy={luu.isPending}
              disabled={kiem.conThieu !== null}
              onPress={gui}
              testID="nut-luu-ho-so"
            />
          }
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

function NhomChon({ tieuDe, children }: { tieuDe: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-caption-lg text-ink" style={{ fontFamily: fonts.semibold }}>
        {tieuDe}
      </Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

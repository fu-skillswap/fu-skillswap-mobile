/**
 * @file MentorRegistrationScreen.tsx
 * @description Đăng ký làm Mentor, theo `MentorRegistration.dc.html` (6 bước) và
 * theo luồng của bản web (`views/mentee/mentor-registration`):
 *
 * 1. Thông tin cơ bản — tiêu đề, mô tả kinh nghiệm, số điện thoại, GitHub, Portfolio
 * 2. Môn học chuyên môn — mã/tên/điểm từng môn, cùng minh chứng FPTU và chuyên môn
 * 3. Thành tích — học vấn / giải thưởng (không bắt buộc)
 * 4. Dự án tiêu biểu (không bắt buộc)
 * 5. Mức độ hỗ trợ — ba mức 1–4
 * 6. Thời gian nhận booking — nhận lịch, báo trước, hạn mở lịch, điều khoản → Gửi
 *
 * Mọi thay đổi chỉ được ghi lên server khi bấm "Gửi hồ sơ" (chuỗi lời gọi ở
 * `guiHoSo.ts`), như web. Đi qua lại giữa các bước không mất dữ liệu vì cả form
 * là MỘT state.
 *
 * Ba trạng thái hồ sơ (`tinhTrangDangKy`): đang soạn → form; chờ duyệt → màn chờ
 * có nút "Rút hồ sơ" (khi backend cho rút); đã duyệt → màn chúc mừng.
 *
 * Bỏ so với web: ảnh cho dự án / thành tích (web cũng chưa có), và khối xem điều
 * khoản đầy đủ — dòng điều khoản ở bước 6 nói rõ người dùng đồng ý với gì.
 */

import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { FileText, Plus, Trash2, Upload } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { toUserMessage } from '@/core/api/errors';
import { useRoleMode } from '@/core/roleMode/RoleModeProvider';
import { dinhDangNgayGio } from '@/core/time/localDateTime';
import { BottomBar } from '@/core/ui/BottomBar';
import { KOKO } from '@/core/ui/brand';
import { Button } from '@/core/ui/Button';
import { Chip } from '@/core/ui/Chip';
import { ErrorView } from '@/core/ui/ErrorView';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { ScreenHeader } from '@/core/ui/ScreenHeader';
import { Switch } from '@/core/ui/Switch';
import { TextField } from '@/core/ui/TextField';
import { colors, controlHeight, fonts, radius, spacing } from '@/core/ui/theme';
import { useMyMentorProfile } from '@/features/mentorMode/hooks/useMentorModeQueries';
import type { BanNhapMentor, DuAn, LoiForm, MonHoc, ThanhTich } from '@/features/mentorRegistration/dangKyMentor';
import {
  banNhapTuHoSo,
  BUOC,
  buocChuaXong,
  CHUYEN_MON_TOI_DA,
  demTaiLieu,
  duAnRong,
  khoaMoi,
  kiemBuoc,
  LOAI_TEP,
  monHocRong,
  MUC_HO_TRO,
  NHOM_HO_TRO,
  TEP_TOI_DA,
  thanhTichRong,
  tinhTrangDangKy,
} from '@/features/mentorRegistration/dangKyMentor';
import { LoiMinhChung } from '@/features/mentorRegistration/guiHoSo';
import {
  useGuiHoSoMentor,
  useMyVerification,
  useRutHoSoMentor,
  useXoaMinhChung,
} from '@/features/mentorRegistration/hooks/useDangKyMentor';
import type { MentorVerificationDocumentResponse } from '@/features/mentorRegistration/types';

export function MentorRegistrationScreen() {
  const router = useRouter();
  const { cheDoKhaDung, chuyenCheDo } = useRoleMode();
  const hoSoMentor = useMyMentorProfile();
  const xacThuc = useMyVerification();
  const gui = useGuiHoSoMentor();
  const rut = useRutHoSoMentor();
  const xoaTaiLieu = useXoaMinhChung();

  const [banNhap, setBanNhap] = useState<BanNhapMentor | null>(null);
  const [buoc, setBuoc] = useState(1);
  const [daThuTiep, setDaThuTiep] = useState(false);
  const [loiTep, setLoiTep] = useState<string | null>(null);

  // Nạp form MỘT lần khi hồ sơ mentor về (kể cả `exists: false`).
  useEffect(() => {
    if (banNhap === null && hoSoMentor.data !== undefined) {
      setBanNhap(banNhapTuHoSo(hoSoMentor.data));
    }
  }, [banNhap, hoSoMentor.data]);

  const roiMan = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'));
  const daCo = useMemo(() => demTaiLieu(xacThuc.data ?? null), [xacThuc.data]);

  if (hoSoMentor.isError || xacThuc.isError) {
    return (
      <Screen testID="man-hinh-dang-ky-mentor">
        <View className="px-gutter pt-2">
          <ScreenHeader title="Đăng ký làm Mentor" onBack={roiMan} />
        </View>
        <ErrorView
          error={hoSoMentor.error ?? xacThuc.error}
          onAction={() => {
            void hoSoMentor.refetch();
            void xacThuc.refetch();
          }}
        />
      </Screen>
    );
  }
  if (!banNhap || xacThuc.data === undefined) {
    return (
      <Screen testID="man-hinh-dang-ky-mentor">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-dang-ky" color={colors.accent} />
        </View>
      </Screen>
    );
  }

  const tinhTrang = tinhTrangDangKy(xacThuc.data, hoSoMentor.data ?? null);

  if (tinhTrang !== 'soan') {
    const choDuyet = tinhTrang === 'cho-duyet';
    const duKien = dinhDangNgayGio(xacThuc.data?.estimatedReviewBy);
    const coCheDoMentor = cheDoKhaDung.includes('MENTOR');
    return (
      <Screen testID="man-hinh-dang-ky-mentor">
        <View className="px-gutter pt-2">
          <ScreenHeader title="Đăng ký làm Mentor" onBack={roiMan} />
        </View>
        <View className="flex-1 items-center justify-center gap-2 px-10">
          <Image source={KOKO} style={{ width: 140, height: 140 }} resizeMode="contain" accessibilityIgnoresInvertColors />
          <Text testID="tieu-de-tinh-trang" className="text-center text-section-title text-ink" style={{ fontFamily: fonts.bold }}>
            {choDuyet ? 'Hồ sơ đang chờ duyệt' : 'Bạn đã là Mentor'}
          </Text>
          <Text className="text-center text-body text-ink-body" style={{ fontFamily: fonts.regular }}>
            {choDuyet
              ? `Admin đang xem xét hồ sơ của bạn${duKien ? `, dự kiến xong trước ${duKien}` : ', thường trong 1–2 ngày làm việc'}.`
              : coCheDoMentor
                ? 'Hồ sơ đã được duyệt. Mở chế độ Mentor để tạo dịch vụ và mở lịch dạy.'
                : 'Hồ sơ đã được duyệt. Đăng xuất rồi đăng nhập lại để mở chế độ Mentor.'}
          </Text>
          {rut.error ? (
            <Text testID="loi-rut-ho-so" className="text-center text-caption text-danger" style={{ fontFamily: fonts.medium }}>
              {toUserMessage(rut.error).description}
            </Text>
          ) : null}
        </View>
        <BottomBar
          primary={
            choDuyet ? (
              xacThuc.data?.allowedActions?.canWithdraw ? (
                <Button label="Rút hồ sơ" variant="secondary" size="lg" busy={rut.isPending} onPress={() => rut.mutate()} testID="nut-rut-ho-so" />
              ) : (
                <Button label="Quay lại" variant="secondary" size="lg" onPress={roiMan} testID="nut-quay-lai-duoi" />
              )
            ) : coCheDoMentor ? (
              <Button
                label="Mở chế độ Mentor"
                size="lg"
                onPress={() => {
                  chuyenCheDo('MENTOR');
                  router.replace('/(tabs)/mentor-dashboard');
                }}
                testID="nut-mo-che-do-mentor"
              />
            ) : (
              <Button label="Quay lại" variant="secondary" size="lg" onPress={roiMan} testID="nut-quay-lai-duoi" />
            )
          }
        />
      </Screen>
    );
  }

  const kiem = kiemBuoc(banNhap, buoc, daCo);
  // `kiemBuoc` chỉ báo đỏ ô ĐÃ gõ mà sai; ô trống bắt buộc nằm trong `conThieu`.
  const hienLoi = kiem.loi;
  const choSua = xacThuc.data?.status === 'NEEDS_REVISION' || xacThuc.data?.status === 'REJECTED';
  const ghiChuAdmin = xacThuc.data?.rejectionReason ?? xacThuc.data?.reviewNote;
  const taiLieuCo = (xacThuc.data?.documents ?? []).filter((d) => d.isActive);

  const doi = <K extends keyof BanNhapMentor>(truong: K, giaTri: BanNhapMentor[K]) =>
    setBanNhap((cu) => (cu ? { ...cu, [truong]: giaTri } : cu));
  const capNhat = (f: (b: BanNhapMentor) => BanNhapMentor) => setBanNhap((cu) => (cu ? f(cu) : cu));

  const tiep = () => {
    if (kiem.conThieu !== null) {
      setDaThuTiep(true);
      return;
    }
    setDaThuTiep(false);
    setBuoc((s) => Math.min(BUOC.length, s + 1));
  };

  const guiHoSo = () => {
    const chuaXong = buocChuaXong(banNhap, daCo);
    if (chuaXong !== null) {
      setBuoc(chuaXong);
      setDaThuTiep(true);
      return;
    }
    gui.mutate({ banNhap, capNhat });
  };

  const chonTep = async (loai: 'fptu' | 'chuyen-mon') => {
    setLoiTep(null);
    const kq = await DocumentPicker.getDocumentAsync({ type: [...LOAI_TEP], copyToCacheDirectory: true, multiple: false });
    if (kq.canceled || !kq.assets?.[0]) {
      return;
    }
    const tep = kq.assets[0];
    const loaiTep = tep.mimeType ?? '';
    if (!(LOAI_TEP as readonly string[]).includes(loaiTep)) {
      setLoiTep('Chỉ hỗ trợ file JPG, PNG hoặc PDF.');
      return;
    }
    if (tep.size == null || tep.size > TEP_TOI_DA) {
      setLoiTep('Tệp phải nhỏ hơn 15 MB.');
      return;
    }
    const chon = { khoa: khoaMoi(), ten: tep.name, uri: tep.uri, contentType: loaiTep, kichThuoc: tep.size };
    if (loai === 'fptu') {
      doi('tepFptu', chon);
    } else {
      capNhat((b) => ({ ...b, tepChuyenMon: [...b.tepChuyenMon, chon] }));
    }
  };

  const loiGui = gui.error instanceof LoiMinhChung ? gui.error.message : gui.error ? toUserMessage(gui.error).description : null;
  const laBuocCuoi = buoc === BUOC.length;

  return (
    <Screen testID="man-hinh-dang-ky-mentor">
      <OfflineBanner />
      <View className="gap-3.5 px-gutter pb-3 pt-2">
        <ScreenHeader title="Đăng ký làm Mentor" subtitle={`Bước ${buoc}/${BUOC.length} · ${BUOC[buoc - 1]}`} onBack={roiMan} />
        <View accessibilityLabel="Các bước đăng ký" className="flex-row gap-1.5">
          {BUOC.map((ten, i) => {
            const so = i + 1;
            const hienTai = so === buoc;
            const qua = so < buoc;
            return (
              <Pressable
                key={ten}
                accessibilityRole="button"
                accessibilityLabel={`Bước ${so}: ${ten}`}
                accessibilityState={{ selected: hienTai }}
                onPress={() => {
                  setDaThuTiep(false);
                  setBuoc(so);
                }}
                testID={`buoc-${so}`}
                className={`flex-1 items-center justify-center rounded-full border ${
                  hienTai ? 'border-accent bg-accent' : qua ? 'border-surface-tint bg-surface-tint' : 'border-line bg-surface'
                }`}
                style={{ height: spacing.touch }}
              >
                <Text
                  className={hienTai ? 'text-on-accent' : qua ? 'text-accent' : 'text-ink-muted'}
                  style={{ fontFamily: fonts.bold, fontSize: 14 }}
                >
                  {so}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView className="flex-1" contentContainerClassName="gap-3.5 px-gutter pb-6" keyboardShouldPersistTaps="handled">
          {choSua && buoc === 1 ? (
            <View testID="ghi-chu-admin" className="gap-1 bg-warning-soft p-3.5" style={{ borderRadius: radius.md }}>
              <Text className="text-caption-lg text-ink" style={{ fontFamily: fonts.bold }}>
                {xacThuc.data?.status === 'REJECTED' ? 'Hồ sơ trước bị từ chối' : 'Admin yêu cầu bổ sung hồ sơ'}
              </Text>
              {ghiChuAdmin ? (
                <Text className="text-caption-lg text-ink-body" style={{ fontFamily: fonts.regular }}>
                  {ghiChuAdmin}
                </Text>
              ) : null}
            </View>
          ) : null}

          {buoc === 1 ? (
            <>
              <TieuDeBuoc tieuDe="Thông tin cơ bản" moTa="Mentee sẽ thấy tiêu đề và phần kinh nghiệm này trên hồ sơ của bạn." />
              <TextField label="Tiêu đề chuyên môn" value={banNhap.tieuDe} onChangeText={(v) => doi('tieuDe', v)} placeholder="VD: Senior Fullstack Engineer | Java & React" error={hienLoi.tieuDe} testID="o-tieu-de-mentor" />
              <TextField label="Kinh nghiệm chuyên môn" value={banNhap.moTaChuyenMon} onChangeText={(v) => doi('moTaChuyenMon', v)} placeholder="Chia sẻ kinh nghiệm, dự án thực tế và thế mạnh tư vấn của bạn…" multiline numberOfLines={5} error={hienLoi.moTaChuyenMon} testID="o-kinh-nghiem" />
              <TextField label="Số điện thoại" value={banNhap.sdt} onChangeText={(v) => doi('sdt', v)} placeholder="0912345678" keyboardType="phone-pad" error={hienLoi.sdt} testID="o-sdt" />
              <TextField label="GitHub (không bắt buộc)" value={banNhap.github} onChangeText={(v) => doi('github', v)} placeholder="https://github.com/ten-cua-ban" autoCapitalize="none" error={hienLoi.github} testID="o-github" />
              <TextField label="Portfolio (không bắt buộc)" value={banNhap.portfolio} onChangeText={(v) => doi('portfolio', v)} placeholder="https://" autoCapitalize="none" error={hienLoi.portfolio} testID="o-portfolio" />
            </>
          ) : null}

          {buoc === 2 ? (
            <>
              <TieuDeBuoc tieuDe="Môn học chuyên môn" moTa="Các môn bạn muốn hướng dẫn và điểm đã đạt. SkillSwap đối chiếu với minh chứng bên dưới." />
              {banNhap.monHoc.map((m) => (
                <TheMonHoc
                  key={m.khoa}
                  mon={m}
                  loi={hienLoi}
                  onDoi={(moi) => capNhat((b) => ({ ...b, monHoc: b.monHoc.map((x) => (x.khoa === m.khoa ? moi : x)) }))}
                  onXoa={() => capNhat((b) => ({ ...b, monHoc: b.monHoc.filter((x) => x.khoa !== m.khoa) }))}
                />
              ))}
              <NutThem label="Thêm môn học" onPress={() => capNhat((b) => ({ ...b, monHoc: [...b.monHoc, monHocRong()] }))} testID="nut-them-mon" />

              <TieuDeBuoc tieuDe="Minh chứng" moTa="JPG, PNG hoặc PDF, mỗi tệp tối đa 15 MB." />
              <KhoiMinhChung
                tieuDe="Minh chứng sinh viên / cựu sinh viên FPTU"
                moTa="Thẻ sinh viên, giấy xác nhận, bảng điểm hoặc bằng tốt nghiệp. 1 tệp."
                daCo={taiLieuCo.filter((d) => d.documentType === 'FPTU_AFFILIATION_PROOF')}
                tepMoi={banNhap.tepFptu ? [banNhap.tepFptu] : []}
                choThem={daCo.FPTU_AFFILIATION_PROOF === 0 && !banNhap.tepFptu}
                choXoaCu={xacThuc.data?.allowedActions?.canUploadDocuments ?? false}
                dangXoa={xoaTaiLieu.isPending}
                onThem={() => void chonTep('fptu')}
                onBoTepMoi={() => doi('tepFptu', null)}
                onXoaCu={(id) => xoaTaiLieu.mutate(id)}
                testID="minh-chung-fptu"
              />
              <KhoiMinhChung
                tieuDe="Minh chứng chuyên môn"
                moTa={`Chứng chỉ, giải thưởng, bảng điểm môn chuyên ngành… Tối đa ${CHUYEN_MON_TOI_DA} tệp.`}
                daCo={taiLieuCo.filter((d) => d.documentType === 'EXPERTISE_PROOF')}
                tepMoi={banNhap.tepChuyenMon}
                choThem={daCo.EXPERTISE_PROOF + banNhap.tepChuyenMon.length < CHUYEN_MON_TOI_DA}
                choXoaCu={xacThuc.data?.allowedActions?.canUploadDocuments ?? false}
                dangXoa={xoaTaiLieu.isPending}
                onThem={() => void chonTep('chuyen-mon')}
                onBoTepMoi={(khoa) => capNhat((b) => ({ ...b, tepChuyenMon: b.tepChuyenMon.filter((t) => t.khoa !== khoa) }))}
                onXoaCu={(id) => xoaTaiLieu.mutate(id)}
                testID="minh-chung-chuyen-mon"
              />
              {loiTep || hienLoi.tepChuyenMon ? (
                <Text testID="loi-tep" className="text-caption text-danger" style={{ fontFamily: fonts.medium }}>
                  {loiTep ?? hienLoi.tepChuyenMon}
                </Text>
              ) : null}
            </>
          ) : null}

          {buoc === 3 ? (
            <>
              <TieuDeBuoc tieuDe="Thành tích" moTa="Học vấn, giải thưởng, chứng chỉ nổi bật. Không bắt buộc." />
              {banNhap.thanhTich.map((t) => (
                <TheThanhTich
                  key={t.khoa}
                  thanhTich={t}
                  loi={hienLoi}
                  onDoi={(moi) => capNhat((b) => ({ ...b, thanhTich: b.thanhTich.map((x) => (x.khoa === t.khoa ? moi : x)) }))}
                  onXoa={() =>
                    capNhat((b) => ({
                      ...b,
                      thanhTich: b.thanhTich.filter((x) => x.khoa !== t.khoa),
                      xoaThanhTich: t.id ? [...b.xoaThanhTich, t.id] : b.xoaThanhTich,
                    }))
                  }
                />
              ))}
              <NutThem label="Thêm thành tích" onPress={() => capNhat((b) => ({ ...b, thanhTich: [...b.thanhTich, thanhTichRong()] }))} testID="nut-them-thanh-tich" />
            </>
          ) : null}

          {buoc === 4 ? (
            <>
              <TieuDeBuoc tieuDe="Dự án tiêu biểu" moTa="Dự án bạn đã làm, vai trò và kết quả. Không bắt buộc." />
              {banNhap.duAn.map((d) => (
                <TheDuAn
                  key={d.khoa}
                  duAn={d}
                  loi={hienLoi}
                  onDoi={(moi) => capNhat((b) => ({ ...b, duAn: b.duAn.map((x) => (x.khoa === d.khoa ? moi : x)) }))}
                  onXoa={() =>
                    capNhat((b) => ({
                      ...b,
                      duAn: b.duAn.filter((x) => x.khoa !== d.khoa),
                      xoaDuAn: d.id ? [...b.xoaDuAn, d.id] : b.xoaDuAn,
                    }))
                  }
                />
              ))}
              <NutThem label="Thêm dự án" onPress={() => capNhat((b) => ({ ...b, duAn: [...b.duAn, duAnRong()] }))} testID="nut-them-du-an" />
            </>
          ) : null}

          {buoc === 5 ? (
            <>
              <TieuDeBuoc tieuDe="Mức độ hỗ trợ" moTa="Đánh giá khả năng đồng hành cùng mentee ở từng mảng, từ 1 (cơ bản) đến 4 (chuyên sâu)." />
              {NHOM_HO_TRO.map((n) => (
                <View key={n.truong} className="gap-2.5 border border-line bg-surface" style={{ borderRadius: 20, padding: 14 }}>
                  <Text className="text-body text-ink" style={{ fontFamily: fonts.bold }}>
                    {n.nhan}
                  </Text>
                  <View accessibilityRole="radiogroup" accessibilityLabel={n.nhan} className="flex-row gap-2">
                    {MUC_HO_TRO.map((muc) => (
                      <View key={muc} className="flex-1">
                        <Chip label={`Mức ${muc}`} selected={banNhap[n.truong] === muc} onPress={() => doi(n.truong, muc)} testID={`${n.truong}-${muc}`} />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </>
          ) : null}

          {buoc === 6 ? (
            <>
              <TieuDeBuoc tieuDe="Thời gian nhận booking" moTa="Quy định nhận lịch tư vấn từ mentee." />
              <View className="flex-row items-center gap-3 border border-line bg-surface" style={{ borderRadius: 20, padding: 14 }}>
                <View className="flex-1">
                  <Text className="text-body text-ink" style={{ fontFamily: fonts.bold }}>
                    Sẵn sàng nhận lịch
                  </Text>
                  <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
                    Mentee có thể đặt lịch với bạn sau khi được duyệt
                  </Text>
                </View>
                <Switch value={banNhap.nhanLich} onValueChange={(v) => doi('nhanLich', v)} accessibilityLabel="Sẵn sàng nhận lịch" testID="cong-tac-nhan-lich" />
              </View>
              <TextField label="Báo trước tối thiểu (phút)" value={banNhap.baoTruocPhut} onChangeText={(v) => doi('baoTruocPhut', v)} placeholder="120" keyboardType="number-pad" error={hienLoi.baoTruocPhut} testID="o-bao-truoc" />
              <TextField label="Hạn mở lịch tối đa (ngày)" value={banNhap.hanMoNgay} onChangeText={(v) => doi('hanMoNgay', v)} placeholder="30" keyboardType="number-pad" error={hienLoi.hanMoNgay} testID="o-han-mo" />
              <View className="flex-row items-center gap-3" style={{ minHeight: spacing.touch }}>
                <Switch value={banNhap.dongY} onValueChange={(v) => doi('dongY', v)} accessibilityLabel="Đồng ý điều khoản vận hành của SkillSwap" testID="cong-tac-dong-y" />
                <Text className="flex-1 text-caption-lg text-ink-body" style={{ fontFamily: fonts.regular }}>
                  Tôi đồng ý với Điều khoản vận hành của SkillSwap và cam kết thông tin, minh chứng là trung thực.
                </Text>
              </View>
            </>
          ) : null}

          <Text testID="ghi-chu-dang-ky" className={`text-caption ${loiGui ? 'text-danger' : 'text-ink-muted'}`} style={{ fontFamily: fonts.medium }}>
            {loiGui ?? (daThuTiep ? (kiem.conThieu ?? ' ') : ' ')}
          </Text>
        </ScrollView>

        <BottomBar
          secondary={
            buoc > 1 ? (
              <Button label="Quay lại" variant="secondary" size="lg" onPress={() => setBuoc((s) => Math.max(1, s - 1))} testID="nut-buoc-truoc" />
            ) : undefined
          }
          primary={
            laBuocCuoi ? (
              <Button label="Gửi hồ sơ" size="lg" busy={gui.isPending} onPress={guiHoSo} testID="nut-gui-ho-so" />
            ) : (
              <Button label="Tiếp tục" size="lg" onPress={tiep} testID="nut-tiep-tuc" />
            )
          }
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

function TieuDeBuoc({ tieuDe, moTa }: { tieuDe: string; moTa: string }) {
  return (
    <View className="gap-1">
      <Text className="text-section-title text-ink" style={{ fontFamily: fonts.bold }}>
        {tieuDe}
      </Text>
      <Text className="text-caption-lg text-ink-body" style={{ fontFamily: fonts.regular }}>
        {moTa}
      </Text>
    </View>
  );
}

function NutThem({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      className="flex-row items-center justify-center gap-2 border-accent"
      style={{ height: controlHeight.lg, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed' }}
    >
      <Plus size={18} color={colors.accent} strokeWidth={2.4} />
      <Text className="text-body text-accent" style={{ fontFamily: fonts.bold }}>
        {label}
      </Text>
    </Pressable>
  );
}

function KhungMuc({ children, onXoa, nhanXoa }: { children: ReactNode; onXoa: () => void; nhanXoa: string }) {
  return (
    <View className="gap-2.5 border border-line bg-surface" style={{ borderRadius: 20, padding: 14 }}>
      {children}
      <Pressable accessibilityRole="button" accessibilityLabel={nhanXoa} onPress={onXoa} className="flex-row items-center gap-1.5 self-end px-1" style={{ minHeight: spacing.touch }}>
        <Trash2 size={16} color={colors.danger} strokeWidth={2} />
        <Text className="text-caption-lg text-danger" style={{ fontFamily: fonts.semibold }}>
          Xoá
        </Text>
      </Pressable>
    </View>
  );
}

function TheMonHoc({ mon, loi, onDoi, onXoa }: { mon: MonHoc; loi: LoiForm; onDoi: (m: MonHoc) => void; onXoa: () => void }) {
  return (
    <KhungMuc onXoa={onXoa} nhanXoa={`Xoá môn ${mon.ma || 'mới'}`}>
      <View className="flex-row gap-2.5">
        <View style={{ flex: 1 }}>
          <TextField label="Mã môn" value={mon.ma} onChangeText={(v) => onDoi({ ...mon, ma: v })} placeholder="PRO192" autoCapitalize="characters" error={loi[`mon.${mon.khoa}.ma`]} testID={`mon-${mon.khoa}-ma`} />
        </View>
        <View style={{ width: 96 }}>
          <TextField label="Điểm" value={mon.diem} onChangeText={(v) => onDoi({ ...mon, diem: v })} placeholder="9.0" keyboardType="decimal-pad" error={loi[`mon.${mon.khoa}.diem`]} testID={`mon-${mon.khoa}-diem`} />
        </View>
      </View>
      <TextField label="Tên môn" value={mon.ten} onChangeText={(v) => onDoi({ ...mon, ten: v })} placeholder="Lập trình hướng đối tượng" error={loi[`mon.${mon.khoa}.ten`]} testID={`mon-${mon.khoa}-ten`} />
    </KhungMuc>
  );
}

function TheThanhTich({ thanhTich: t, loi, onDoi, onXoa }: { thanhTich: ThanhTich; loi: LoiForm; onDoi: (t: ThanhTich) => void; onXoa: () => void }) {
  const k = (truong: string) => `thanhTich.${t.khoa}.${truong}`;
  return (
    <KhungMuc onXoa={onXoa} nhanXoa={`Xoá thành tích ${t.tieuDe || 'mới'}`}>
      <TextField label="Tên giải thưởng / thành tích" value={t.tieuDe} onChangeText={(v) => onDoi({ ...t, tieuDe: v })} error={loi[k('tieuDe')]} testID={`thanh-tich-${t.khoa}-ten`} />
      <TextField label="Ngày đạt được (dd/mm/yyyy)" value={t.ngay} onChangeText={(v) => onDoi({ ...t, ngay: v })} placeholder="01/06/2025" keyboardType="numbers-and-punctuation" error={loi[k('ngay')]} testID={`thanh-tich-${t.khoa}-ngay`} />
      <TextField label="Mô tả" value={t.moTa} onChangeText={(v) => onDoi({ ...t, moTa: v })} multiline numberOfLines={2} testID={`thanh-tich-${t.khoa}-mo-ta`} />
      <TextField label="Sản phẩm / case study" value={t.tieuDeSanPham} onChangeText={(v) => onDoi({ ...t, tieuDeSanPham: v })} testID={`thanh-tich-${t.khoa}-san-pham`} />
      <TextField label="Mô tả sản phẩm" value={t.moTaSanPham} onChangeText={(v) => onDoi({ ...t, moTaSanPham: v })} multiline numberOfLines={2} testID={`thanh-tich-${t.khoa}-mo-ta-san-pham`} />
      <TextField label="Link demo / chứng nhận" value={t.lienKet} onChangeText={(v) => onDoi({ ...t, lienKet: v })} placeholder="https://" autoCapitalize="none" error={loi[k('lienKet')]} testID={`thanh-tich-${t.khoa}-link`} />
    </KhungMuc>
  );
}

function TheDuAn({ duAn: d, loi, onDoi, onXoa }: { duAn: DuAn; loi: LoiForm; onDoi: (d: DuAn) => void; onXoa: () => void }) {
  const k = (truong: string) => `duAn.${d.khoa}.${truong}`;
  return (
    <KhungMuc onXoa={onXoa} nhanXoa={`Xoá dự án ${d.tieuDe || 'mới'}`}>
      <TextField label="Tên dự án" value={d.tieuDe} onChangeText={(v) => onDoi({ ...d, tieuDe: v })} error={loi[k('tieuDe')]} testID={`du-an-${d.khoa}-ten`} />
      <TextField label="Vai trò / điểm nổi bật" value={d.vaiTro} onChangeText={(v) => onDoi({ ...d, vaiTro: v })} multiline numberOfLines={2} error={loi[k('vaiTro')]} testID={`du-an-${d.khoa}-vai-tro`} />
      <TextField label="Mô tả dự án" value={d.moTa} onChangeText={(v) => onDoi({ ...d, moTa: v })} multiline numberOfLines={3} error={loi[k('moTa')]} testID={`du-an-${d.khoa}-mo-ta`} />
      <TextField label="Link demo / GitHub" value={d.lienKet} onChangeText={(v) => onDoi({ ...d, lienKet: v })} placeholder="https://" autoCapitalize="none" error={loi[k('lienKet')]} testID={`du-an-${d.khoa}-link`} />
    </KhungMuc>
  );
}

function KhoiMinhChung({
  tieuDe,
  moTa,
  daCo,
  tepMoi,
  choThem,
  choXoaCu,
  dangXoa,
  onThem,
  onBoTepMoi,
  onXoaCu,
  testID,
}: {
  tieuDe: string;
  moTa: string;
  daCo: MentorVerificationDocumentResponse[];
  tepMoi: { khoa: string; ten: string }[];
  choThem: boolean;
  choXoaCu: boolean;
  dangXoa: boolean;
  onThem: () => void;
  onBoTepMoi: (khoa: string) => void;
  onXoaCu: (id: string) => void;
  testID: string;
}) {
  return (
    <View testID={testID} className="gap-2.5 border border-line bg-surface" style={{ borderRadius: 20, padding: 14 }}>
      <View className="gap-0.5">
        <Text className="text-body text-ink" style={{ fontFamily: fonts.bold }}>
          {tieuDe}
        </Text>
        <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
          {moTa}
        </Text>
      </View>
      {daCo.map((d) => (
        <DongTep key={d.id} ten={d.originalFilename ?? 'Tệp đã tải'} trangThai="Đã tải lên" onXoa={choXoaCu && !dangXoa ? () => onXoaCu(d.id) : undefined} testID={`${testID}-cu-${d.id}`} />
      ))}
      {tepMoi.map((t) => (
        <DongTep key={t.khoa} ten={t.ten} trangThai="Sẽ tải lên khi gửi hồ sơ" onXoa={() => onBoTepMoi(t.khoa)} testID={`${testID}-moi-${t.khoa}`} />
      ))}
      {choThem ? (
        <Pressable accessibilityRole="button" onPress={onThem} testID={`${testID}-chon`} className="flex-row items-center justify-center gap-2 bg-surface-tint" style={{ height: 48, borderRadius: radius.input }}>
          <Upload size={18} color={colors.accent} strokeWidth={2} />
          <Text className="text-body text-accent" style={{ fontFamily: fonts.bold }}>
            Chọn tệp
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function DongTep({ ten, trangThai, onXoa, testID }: { ten: string; trangThai: string; onXoa?: () => void; testID: string }) {
  return (
    <View testID={testID} className="flex-row items-center gap-2.5 bg-surface-page px-3" style={{ minHeight: 52, borderRadius: radius.input }}>
      <FileText size={18} color={colors.accent} strokeWidth={2} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-caption-lg text-ink" style={{ fontFamily: fonts.semibold }}>
          {ten}
        </Text>
        <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular, fontSize: 11 }}>
          {trangThai}
        </Text>
      </View>
      {onXoa ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Bỏ tệp ${ten}`} onPress={onXoa} className="items-center justify-center" style={{ width: spacing.touch, height: spacing.touch }} testID={`${testID}-xoa`}>
          <Trash2 size={18} color={colors.danger} strokeWidth={2} />
        </Pressable>
      ) : null}
    </View>
  );
}

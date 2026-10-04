/**
 * @file MentorPostEditScreen.tsx
 * @description Soạn hoặc sửa một bản nháp blog, theo khung "Tạo bài đăng mới" của
 * `MentorPosts.dc.html` và form của bản web: Tiêu đề, Mô tả ngắn, Nội dung, "Ai
 * có thể xem", hai nút "Lưu bản nháp" / "Đăng bài".
 *
 * ## Thêm so với web
 *
 * - **Chọn dịch vụ khi phạm vi là "Mentee đã đặt dịch vụ"**: backend từ chối đăng
 *   bài phạm vi đó nếu không gắn dịch vụ nào ("Bài premium phải gắn ít nhất một
 *   dịch vụ"). Form web không có ô này nên trên web lựa chọn đó luôn đăng hỏng.
 * - **Kiểm trước khi gửi** đúng các luật của backend: tiêu đề bắt buộc ≤ 220 ký
 *   tự, không có `<`/`>` ngoài khối code, cần nội dung mới đăng được.
 *
 * Đăng = lưu rồi mới đăng (hai lời gọi). Bài vừa lưu được GIỮ trong state trước
 * khi đăng: bước đăng hỏng thì lần bấm lại sửa đúng bài đó chứ không tạo bài mới.
 */

import { useRouter } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { toUserMessage } from '@/core/api/errors';
import { BottomBar } from '@/core/ui/BottomBar';
import { Button } from '@/core/ui/Button';
import { Chip } from '@/core/ui/Chip';
import { ErrorView } from '@/core/ui/ErrorView';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { ScreenHeader } from '@/core/ui/ScreenHeader';
import { TextField } from '@/core/ui/TextField';
import { colors, fonts, spacing } from '@/core/ui/theme';
import type { BanNhapBaiViet } from '@/features/mentorBlog/baiViet';
import { banNhapRong, banNhapTuBai, kiemBaiViet, PHAM_VI, taoYeuCauBaiViet } from '@/features/mentorBlog/baiViet';
import { useMyBlogPost, usePublishBlogPost, useSaveBlogPost } from '@/features/mentorBlog/hooks/useMentorBlog';
import type { MentorBlogPostDetailResponse } from '@/features/mentorBlog/types';
import { useMyServices } from '@/features/mentorMode/hooks/useMentorStudio';

export interface MentorPostEditScreenProps {
  /** `null` = soạn bài mới */
  postId: string | null;
}

export function MentorPostEditScreen({ postId }: MentorPostEditScreenProps) {
  const router = useRouter();
  const baiGoc = useMyBlogPost(postId);
  const dichVu = useMyServices();
  const luu = useSaveBlogPost();
  const dang = usePublishBlogPost();

  const [banNhap, setBanNhap] = useState<BanNhapBaiViet | null>(postId === null ? banNhapRong() : null);
  /** Bài đã có trên server (bản gốc, hoặc bản vừa lưu ở lần bấm trước) */
  const [baiHienTai, setBaiHienTai] = useState<MentorBlogPostDetailResponse | null>(null);

  useEffect(() => {
    if (banNhap === null && baiGoc.data) {
      setBanNhap(banNhapTuBai(baiGoc.data));
      setBaiHienTai(baiGoc.data);
    }
  }, [banNhap, baiGoc.data]);

  const kiem = useMemo(() => (banNhap ? kiemBaiViet(banNhap) : null), [banNhap]);
  const dangGui = luu.isPending || dang.isPending;
  const loiGui = luu.error ?? dang.error;

  const roiMan = () => (router.canGoBack() ? router.back() : router.replace('/mentor-posts'));

  if (postId !== null && baiGoc.isError) {
    return (
      <Screen testID="man-hinh-soan-bai">
        <View className="px-gutter pt-2">
          <ScreenHeader title="Chỉnh sửa bản nháp" onBack={roiMan} />
        </View>
        <ErrorView error={baiGoc.error} onAction={() => void baiGoc.refetch()} />
      </Screen>
    );
  }
  if (!banNhap || !kiem) {
    return (
      <Screen testID="man-hinh-soan-bai">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-bai" color={colors.accent} />
        </View>
      </Screen>
    );
  }

  const doi = <K extends keyof BanNhapBaiViet>(truong: K, giaTri: BanNhapBaiViet[K]) =>
    setBanNhap((cu) => (cu ? { ...cu, [truong]: giaTri } : cu));

  const chonDichVu = (id: string) =>
    setBanNhap((cu) =>
      cu ? { ...cu, dichVu: cu.dichVu.includes(id) ? cu.dichVu.filter((x) => x !== id) : [...cu.dichVu, id] } : cu,
    );

  const gui = async (dangLuon: boolean) => {
    luu.reset();
    dang.reset();
    try {
      const daLuu = await luu.mutateAsync({ baiCu: baiHienTai, noiDung: taoYeuCauBaiViet(banNhap) });
      setBaiHienTai(daLuu);
      if (dangLuon) {
        await dang.mutateAsync(daLuu);
      }
      roiMan();
    } catch {
      // Lỗi đã nằm trong `luu.error` / `dang.error` và được in ở cuối form.
    }
  };

  return (
    <Screen testID="man-hinh-soan-bai">
      <OfflineBanner />
      <View className="px-gutter pb-3 pt-2">
        <ScreenHeader title={postId === null ? 'Tạo bài viết mới' : 'Chỉnh sửa bản nháp'} onBack={roiMan} />
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView className="flex-1" contentContainerClassName="gap-3.5 px-gutter pb-6" keyboardShouldPersistTaps="handled">
          <TextField
            label="Tiêu đề"
            value={banNhap.tieuDe}
            onChangeText={(v) => doi('tieuDe', v)}
            placeholder="Nhập tiêu đề bài viết"
            testID="o-tieu-de"
          />
          <TextField
            label="Mô tả ngắn"
            value={banNhap.moTa}
            onChangeText={(v) => doi('moTa', v)}
            placeholder="Tóm tắt nội dung chính của bài viết"
            multiline
            numberOfLines={3}
            testID="o-mo-ta"
          />
          <TextField
            label="Nội dung"
            value={banNhap.noiDung}
            onChangeText={(v) => doi('noiDung', v)}
            placeholder="Chia sẻ kiến thức và kinh nghiệm của bạn..."
            hint="Hỗ trợ Markdown. Không dùng thẻ HTML."
            multiline
            numberOfLines={10}
            testID="o-noi-dung"
          />

          <View className="gap-2">
            <Text className="text-caption-lg text-ink" style={{ fontFamily: fonts.semibold }}>
              Ai có thể xem?
            </Text>
            <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
              {PHAM_VI.map((p) => (
                <Chip
                  key={p.value}
                  label={p.label}
                  selected={banNhap.phamVi === p.value}
                  onPress={() => doi('phamVi', p.value)}
                  testID={`pham-vi-${p.value}`}
                />
              ))}
            </View>
          </View>

          {banNhap.phamVi === 'BOOKED_MEMBERS' ? (
            <View className="gap-2 rounded-lg border border-line bg-surface" style={{ padding: spacing.card }}>
              <Text className="text-caption-lg text-ink" style={{ fontFamily: fonts.semibold }}>
                Mentee đã đặt dịch vụ nào được xem?
              </Text>
              {dichVu.isPending ? (
                <ActivityIndicator color={colors.accent} />
              ) : (dichVu.data ?? []).length === 0 ? (
                <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.medium }}>
                  Bạn chưa có dịch vụ nào. Tạo dịch vụ ở tab Lịch dạy trước.
                </Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {(dichVu.data ?? []).map((d) => (
                    <Chip
                      key={d.serviceId}
                      label={d.title}
                      selected={banNhap.dichVu.includes(d.serviceId)}
                      onPress={() => chonDichVu(d.serviceId)}
                      testID={`dich-vu-${d.serviceId}`}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : null}

          <Text
            testID="ghi-chu-bai-viet"
            className={`text-caption ${loiGui ? 'text-danger' : 'text-ink-muted'}`}
            style={{ fontFamily: fonts.medium }}
          >
            {loiGui ? toUserMessage(loiGui).description : (kiem.loiLuu ?? kiem.loiDang ?? ' ')}
          </Text>
        </ScrollView>

        <BottomBar
          secondary={
            <Button
              label="Lưu bản nháp"
              variant="secondary"
              size="lg"
              disabled={kiem.loiLuu !== null || dangGui}
              onPress={() => void gui(false)}
              testID="nut-luu-nhap"
            />
          }
          primary={
            <Button
              label="Đăng bài"
              size="lg"
              icon={<Send size={18} color={colors.onAccent} strokeWidth={2} />}
              busy={dangGui}
              disabled={kiem.loiDang !== null}
              onPress={() => void gui(true)}
              testID="nut-dang-bai"
            />
          }
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

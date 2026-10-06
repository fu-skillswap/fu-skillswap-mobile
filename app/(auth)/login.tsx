import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toUserMessage } from '@/core/api/errors';
import { useAuth } from '@/core/auth/AuthProvider';
import { resolveAuthRoute } from '@/core/auth/authRoute';
import { GoogleSignInCancelledError, GoogleSignInConfigError } from '@/core/auth/googleSignIn';
import { KOKO, LOGO_FULL } from '@/core/ui/brand';
import { BrandImage } from '@/core/ui/BrandImage';
import { Button } from '@/core/ui/Button';
import { fonts } from '@/core/ui/theme';

export default function LoginScreen() {
  const { status, user, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  /**
   * Giữ CẢ tiêu đề lẫn mô tả. Trước đây chỉ giữ `description`, nên hai nguyên
   * nhân hoàn toàn khác nhau — lỗi 5xx của backend ("Hệ thống đang bận") và lỗi
   * không phải HTTP ("Đã có lỗi xảy ra") — hiện ra y hệt nhau là "Vui lòng thử
   * lại sau ít phút.", không phân biệt được. Đúng chuyện đã xảy ra khi chẩn
   * đoán đăng nhập trên máy ảo 2026-10-03.
   */
  const [error, setError] = useState<{ title: string; description: string } | null>(null);
  const route = resolveAuthRoute(status, user);

  // Đã có phiên hợp lệ (ví dụ vừa đăng nhập xong) thì rời màn hình này ngay,
  // không tự vẽ lại nút đăng nhập — nếu không người dùng sẽ kẹt ở đây mãi vì
  // không còn ai theo dõi việc status chuyển sang 'authenticated'.
  //
  // Tài khoản ADMIN/SYSTEM_ADMIN (route === 'unsupported') KHÔNG được redirect
  // sang (tabs) — đó chính là nửa kia của vòng lặp vô hạn đã sửa (Critical):
  // (tabs)/_layout.tsx sẽ đẩy tài khoản này quay lại login, và nếu login lại
  // đẩy nó sang (tabs) thì hai màn hình đá nhau vô hạn. Đưa nó sang màn hình
  // "không hỗ trợ" — một trạng thái cuối, không redirect tiếp.
  if (route.kind === 'tabs') {
    // Lần đăng nhập đầu (chưa có hồ sơ sinh viên) đi qua màn Hoàn thiện hồ sơ,
    // đúng luồng Welcome → Onboarding của thiết kế và của bản web. CHỈ ở đây,
    // không ở `app/index.tsx`: người đã bấm "Để sau" không bị đẩy lại vào form
    // mỗi lần mở app — lối vào lại nằm ở tab Hồ sơ.
    return <Redirect href={user?.hasStudentProfile === false ? '/onboarding' : '/(tabs)'} />;
  }
  if (route.kind === 'unsupported') {
    return <Redirect href="/(auth)/unsupported-account" />;
  }

  const handlePress = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      if (err instanceof GoogleSignInCancelledError) {
        return;
      }
      if (err instanceof GoogleSignInConfigError) {
        // Lỗi cấu hình của chính ứng dụng, người dùng không thể tự khắc phục —
        // nên KHÔNG mời họ thử lại. `toUserMessage` xếp nó vào nhánh lỗi chung
        // và trả về "Vui lòng thử lại sau ít phút", một lời khuyên không bao
        // giờ đúng với lỗi này (gặp thật trên máy ảo 2026-10-03).
        setError({
          title: 'Không đăng nhập được',
          description: 'Ứng dụng đang có lỗi cấu hình đăng nhập. Vui lòng báo cho đội phát triển.',
        });
        return;
      }
      const message = toUserMessage(err);
      setError({ title: message.title, description: message.description });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-page">
      {/*
        Logo + hero 330 + ba dòng chữ + nút cao ~730pt, hơn phần dùng được của
        máy màn ngắn (iPhone SE ~647pt): không cuộn được thì nút Google — lối vào
        DUY NHẤT của app — bị cắt mất. `flexGrow: 1` giữ khung cao ít nhất bằng
        màn hình, nên trên máy cao `mt-auto` vẫn đẩy nhóm nút xuống đáy như cũ.
      */}
      <ScrollView
        testID="cuon-dang-nhap"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
      {/* `Welcome.dc.html`: padding 56/24/40 — phần trên đã do safe area lo. */}
      <View className="flex-1 px-6 pb-10 pt-6">
        {/*
          `Welcome.dc.html` dòng 19: logo có chữ, `height: 36px; width: auto;
          align-self: flex-start`. 540×174 là cỡ file trong repo, nên bề rộng
          tương ứng chiều cao 36 là 36 × 540 / 174 ≈ 112. Phải khai cả hai số:
          `width: auto` không có trong React Native. Bề rộng tường minh cũng là
          `align-self: flex-start` của thiết kế: `alignItems: stretch` (mặc định
          của cột) chỉ giãn con nào để cỡ ngang `auto`.

          Đây là ảnh MANG thông tin — nó đứng thay cho chữ "SkillSwap" trước đây
          là tên sản phẩm duy nhất trên màn này — nên có `accessibilityLabel`.
        */}
        <BrandImage
          source={LOGO_FULL}
          width={112}
          height={36}
          label="SkillSwap"
          testID="logo-skillswap"
        />

        {/*
          Khối hero bo 32 nền `surface-tint`: ba quả cầu trang trí và mascot Koko
          ở giữa. Thiết kế dùng `align-items: flex-end; justify-content: center`
          nên Koko đứng trên đáy khối, căn giữa ngang — đó là `items-center
          justify-end` ở đây. Không hard-code chiều rộng 390 của khung thiết kế:
          khối tự co theo màn hình.
        */}
        <View
          className="mt-6 items-center justify-end overflow-hidden bg-surface-tint"
          style={{ height: 330, borderRadius: 32 }}
        >
          {/*
            Thiết kế vẽ hai quả cầu lớn bằng `radial-gradient`. React Native
            không có gradient toả tròn, nên đây là màu đặc gần nhất của dải đó
            (#56A8FF ở rìa) thay vì kéo thêm một thư viện chỉ để trang trí.
          */}
          <View
            className="absolute rounded-full"
            style={{ width: 120, height: 120, top: 28, left: 22, backgroundColor: '#8CC2FF' }}
          />
          <View
            className="absolute rounded-full"
            style={{ width: 56, height: 56, top: 64, right: 36, backgroundColor: '#56A8FF' }}
          />
          <View
            className="absolute rounded-full bg-sky-blue"
            style={{ width: 22, height: 22, bottom: 120, right: 70 }}
          />

          {/*
            `Welcome.dc.html` dòng 25: Koko tư thế chuẩn, `height: 290px; width:
            auto; object-fit: contain`. koko.png trong repo là 360×512, nên bề
            rộng của chiều cao 290 là 290 × 360 / 512 ≈ 204.

            Đứng SAU ba quả cầu trong cây: React Native vẽ theo thứ tự con, nên
            Koko nằm trên chúng — đúng `position: relative` mà thiết kế đặt lên
            thẻ `<img>` để nhấc nó khỏi nền.

            Trang trí, không có nhãn: tiêu đề và đoạn mô tả ngay dưới đã nói hết
            nội dung màn hình, đọc thêm "mascot cú Koko" chỉ làm dài thêm.
          */}
          <BrandImage source={KOKO} width={204} height={290} testID="mascot-koko" />
        </View>

        <View className="mt-8 gap-3">
          <Text
            className="text-tab-label text-accent"
            style={{ fontFamily: fonts.semibold, letterSpacing: 2.2 }}
          >
            ONE SKILL, A BRIGHTER TOMORROW
          </Text>
          <Text className="text-ink" style={{ fontFamily: fonts.bold, fontSize: 30, lineHeight: 38 }}>
            Kết nối tri thức, kiến tạo tương lai
          </Text>
          <Text
            className="text-ink-body"
            style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 24 }}
          >
            Học cùng senior và alumni FPT: làm đồ án, chuẩn bị OJT, review CV và định hướng nghề
            nghiệp.
          </Text>
        </View>

        {/* `margin-top: auto` của thiết kế — nhóm nút dính xuống đáy màn hình. */}
        <View className="mt-auto gap-3">
          {error ? (
            <View className="gap-1 rounded-md bg-neutral-soft p-3">
              <Text className="text-center text-body text-danger" style={{ fontFamily: fonts.semibold }}>
                {error.title}
              </Text>
              <Text
                className="text-center text-caption-lg text-danger"
                style={{ fontFamily: fonts.regular }}
              >
                {error.description}
              </Text>
            </View>
          ) : null}

          <Button
            label="Đăng nhập với Google"
            onPress={() => void handlePress()}
            busy={busy}
            size="lg"
          />

          {/*
            Thiết kế có thêm nút "Khám phá trước" (sang `Main`) và hai liên kết
            "Điều khoản" / "Chính sách bảo mật". Cả ba đều KHÔNG dựng lần này:
            `(tabs)` có gate đăng nhập nên "Khám phá trước" sẽ bị đẩy ngược về
            đúng màn này, còn hai liên kết kia trong thiết kế là `href="#"`, chưa
            có trang nào để trỏ tới. Xem mục (c) của báo cáo.
          */}
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

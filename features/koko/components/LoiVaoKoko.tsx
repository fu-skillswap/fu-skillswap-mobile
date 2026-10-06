/**
 * @file LoiVaoKoko.tsx
 * @description Hai lối vào màn Chat với Koko theo thiết kế:
 *
 * - `TheKoko` — card navy "TRỢ LÝ AI · Hỏi Koko bất cứ điều gì" trên Bảng tin
 *   (`Main.dc.html` dòng 38);
 * - `HangKoko` — hàng ghim "Koko · TRỢ LÝ AI" đầu hộp thư (`Messages.dc.html`
 *   dòng 32).
 *
 * Cả hai tự ẩn (trả `null`) khi bản build không có AI (`kokoKhaDung()`): một lối
 * vào dẫn tới trợ lý không trả lời được là nút chết.
 */

import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { KOKO, KOKO_LAPTOP } from '@/core/ui/brand';
import { BrandImage } from '@/core/ui/BrandImage';
import { colors, fonts } from '@/core/ui/theme';
import { kokoKhaDung } from '@/features/koko/kokoRepo';

export function TheKoko() {
  const router = useRouter();
  if (!kokoKhaDung()) {
    return null;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Hỏi Koko, trợ lý AI"
      onPress={() => router.push('/koko')}
      testID="the-koko"
      className="flex-row items-center gap-2 overflow-hidden bg-brand-deep"
      style={{ borderRadius: 24, paddingHorizontal: 20, paddingVertical: 18, minHeight: 120 }}
    >
      {/* Vòng tròn trang trí góc phải trên của thiết kế */}
      <View
        className="absolute rounded-full"
        style={{ width: 140, height: 140, right: -30, top: -20, backgroundColor: '#1E3F85' }}
      />
      <View className="min-w-0 flex-1 gap-1.5">
        <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 2, color: colors.skyBlue }}>
          TRỢ LÝ AI
        </Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, color: colors.white }}>
          Hỏi Koko bất cứ điều gì
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.inkOnDeep }}>
          Gợi ý mentor, cách đặt lịch, S-coin…
        </Text>
      </View>
      <BrandImage source={KOKO_LAPTOP} size={96} />
    </Pressable>
  );
}

export function HangKoko() {
  const router = useRouter();
  if (!kokoKhaDung()) {
    return null;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Koko, trợ lý AI. Hỏi về mentor, đặt lịch, S-coin"
      onPress={() => router.push('/koko')}
      testID="hang-koko"
      className="flex-row items-center gap-3 bg-surface-tint"
      style={{ borderRadius: 24, paddingHorizontal: 16, paddingVertical: 14 }}
    >
      <View className="items-center justify-center overflow-hidden rounded-full bg-surface" style={{ width: 52, height: 52 }}>
        <BrandImage source={KOKO} size={46} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-ink" style={{ fontFamily: fonts.bold, fontSize: 15 }}>
            Koko
          </Text>
          <View className="rounded-full bg-accent" style={{ paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text className="text-on-accent" style={{ fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.6 }}>
              TRỢ LÝ AI
            </Text>
          </View>
        </View>
        <Text numberOfLines={1} className="text-ink-body" style={{ fontFamily: fonts.regular, fontSize: 13 }}>
          Hỏi mình về mentor, đặt lịch, S-coin…
        </Text>
      </View>
      <ChevronRight size={20} color={colors.accent} strokeWidth={2} />
    </Pressable>
  );
}

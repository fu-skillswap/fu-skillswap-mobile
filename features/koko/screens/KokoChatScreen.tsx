/**
 * @file KokoChatScreen.tsx
 * @description Màn "Chat với Koko" theo `KokoChat.dc.html`: thanh trên (Koko,
 * trạng thái, nút cuộc trò chuyện mới), lời chào và bốn câu hỏi gợi ý khi chưa
 * hỏi gì, các bong bóng hội thoại, ô nhập và nút gửi.
 *
 * Nói chuyện với AI service (`fu-skillswap-ai`) qua `useKoko()`. Service không giữ
 * hội thoại, app gửi lại lịch sử mỗi lượt — xem `hoiThoaiKoko.ts`.
 *
 * ## Khác thiết kế, có chủ ý
 *
 * - **Thẻ mentor trong câu trả lời** (`Sarah Chen · Senior PM`): service chỉ trả
 *   về chữ, không trả id mentor nào, nên không có gì để dựng một thẻ bấm được.
 *   Thay vào đó, khi Koko vừa tra danh sách mentor thì bong bóng có lối "Xem
 *   danh sách mentor" dẫn sang tab Mentor — ở chế độ Mentee, nơi tab đó tồn tại.
 * - **"luôn sẵn sàng"** dưới tên: service có hạn mức theo giờ và ngân sách theo
 *   ngày, có lúc nó trả "Trợ lý AI đang tạm nghỉ". Ghi "Trợ lý AI của SkillSwap"
 *   cho khỏi hứa điều không giữ được.
 * - **Dòng nhắc dưới ô nhập** "Koko có thể nhầm…": câu trả lời do model sinh ra.
 */

import { useRouter } from 'expo-router';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  RotateCcw,
  Search,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/core/auth/AuthProvider';
import { useRoleMode } from '@/core/roleMode/RoleModeProvider';
import { useBuTruBanPhim } from '@/core/ui/banPhim';
import { KOKO, KOKO_HAPPY, KOKO_404 } from '@/core/ui/brand';
import { BrandImage } from '@/core/ui/BrandImage';
import { EmptyState } from '@/core/ui/EmptyState';
import { IconButton } from '@/core/ui/IconButton';
import { NutGui } from '@/core/ui/NutGui';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { colors, fonts } from '@/core/ui/theme';
import {
  coTheGuiLai,
  GOI_Y,
  lamSachTraLoi,
  nhanNguon,
  tenGoi,
  TOI_DA_KY_TU,
} from '@/features/koko/hoiThoaiKoko';
import { useKoko } from '@/features/koko/hooks/useKoko';
import { kokoKhaDung } from '@/features/koko/kokoRepo';
import type { TinKoko } from '@/features/koko/types';

const ICON_GOI_Y: Record<(typeof GOI_Y)[number]['khoa'], LucideIcon> = {
  mentor: Search,
  'dat-lich': CalendarDays,
  scoin: Wallet,
  'ky-nang': Lightbulb,
};

/** Một dòng của danh sách đảo ngược: tin thật, hoặc bong bóng "đang soạn" */
type Dong = { kieu: 'tin'; tin: TinKoko } | { kieu: 'dang-soan' };

export function KokoChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { cheDo } = useRoleMode();
  const { tin, dangTraLoi, gui, guiLai, batDauLai } = useKoko();
  const [noiDung, setNoiDung] = useState('');
  const buTru = useBuTruBanPhim();

  const roiDi = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  // Danh sách đảo: phần tử ĐẦU nằm ở ĐÁY — tin mới nhất (và bong bóng đang soạn)
  // luôn sát ô nhập, bàn phím mở không đẩy mất câu cuối.
  const dong = useMemo<Dong[]>(() => {
    const dao: Dong[] = [...tin].reverse().map((t) => ({ kieu: 'tin', tin: t }));
    return dangTraLoi ? [{ kieu: 'dang-soan' }, ...dao] : dao;
  }, [tin, dangTraLoi]);

  const quaDai = noiDung.trim().length > TOI_DA_KY_TU;

  const guiNoiDung = (cauHoi: string) => {
    if (gui(cauHoi)) {
      setNoiDung('');
    }
  };

  // Mở bằng deep link khi AI chưa cấu hình (bản build thiếu EXPO_PUBLIC_AI_URL):
  // lối vào ở Bảng tin và Tin nhắn đã ẩn, nhưng đường dẫn vẫn tới được.
  if (!kokoKhaDung()) {
    return (
      <Screen testID="man-hinh-koko">
        <View className="px-4 pt-1">
          <IconButton
            label="Quay lại"
            icon={<ChevronLeft size={22} color={colors.ink} strokeWidth={2} />}
            onPress={roiDi}
            testID="nut-quay-lai"
          />
        </View>
        <EmptyState
          title="Koko chưa sẵn sàng"
          description="Trợ lý AI chưa được bật cho bản ứng dụng này."
          illustration={<BrandImage source={KOKO_404} size={140} testID="minh-hoa-koko-chua-bat" />}
        />
      </Screen>
    );
  }

  return (
    <Screen testID="man-hinh-koko">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={buTru}
      >
        <OfflineBanner />
        {/* Thanh trên trắng có viền dưới — `<header>` của thiết kế */}
        <View className="flex-row items-center gap-2.5 border-b border-line bg-surface px-4 pb-3 pt-1">
          <IconButton
            label="Quay lại"
            icon={<ChevronLeft size={22} color={colors.ink} strokeWidth={2} />}
            onPress={roiDi}
            testID="nut-quay-lai"
          />
          <View className="items-center justify-center overflow-hidden rounded-full bg-surface-tint" style={{ width: 44, height: 44 }}>
            <BrandImage source={KOKO} size={40} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-ink" style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 }}>
              Koko
            </Text>
            <View className="flex-row items-center gap-1.5">
              <View className="rounded-full bg-success" style={{ width: 8, height: 8 }} />
              <Text className="text-caption text-success-ink" style={{ fontFamily: fonts.medium }}>
                Trợ lý AI của SkillSwap
              </Text>
            </View>
          </View>
          <IconButton
            label="Cuộc trò chuyện mới"
            icon={<RotateCcw size={20} color={colors.inkMuted} strokeWidth={2} />}
            onPress={() => {
              batDauLai();
              setNoiDung('');
            }}
            disabled={tin.length === 0 || dangTraLoi}
            variant="tint"
            testID="nut-tro-chuyen-moi"
          />
        </View>

        {tin.length === 0 ? (
          <ScrollView
            testID="man-chao-koko"
            className="flex-1"
            contentContainerClassName="gap-3.5 px-4 pb-4 pt-5"
            keyboardShouldPersistTaps="handled"
          >
            <View className="items-center gap-1.5 pt-1">
              <BrandImage source={KOKO_HAPPY} size={96} testID="minh-hoa-chao-koko" />
              <Text className="text-center text-ink" style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 24 }}>
                {user?.fullName ? `Chào ${tenGoi(user.fullName)}, mình là Koko!` : 'Chào bạn, mình là Koko!'}
              </Text>
              <Text className="text-center text-caption-lg text-ink-muted" style={{ fontFamily: fonts.regular }}>
                Mình có thể giúp gì cho bạn hôm nay?
              </Text>
            </View>

            <View accessibilityLabel="Câu hỏi gợi ý" className="flex-row flex-wrap" style={{ gap: 8 }}>
              {GOI_Y.map((g) => {
                const Icon = ICON_GOI_Y[g.khoa];
                return (
                  <Pressable
                    key={g.khoa}
                    accessibilityRole="button"
                    accessibilityLabel={g.cauHoi}
                    onPress={() => guiNoiDung(g.cauHoi)}
                    testID={`goi-y-${g.khoa}`}
                    className="flex-row items-start gap-2 rounded-lg border border-line bg-surface active:bg-surface-tint"
                    // Hai cột: (100% − khe 8) / 2.
                    style={{ width: '48.5%', minHeight: 64, paddingHorizontal: 12, paddingVertical: 10 }}
                  >
                    <Icon size={18} color={colors.accent} strokeWidth={2} />
                    <Text className="min-w-0 flex-1 text-ink-body" style={{ fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 }}>
                      {g.nhan}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <FlatList
            testID="danh-sach-tin-koko"
            inverted
            data={dong}
            keyExtractor={(d) => (d.kieu === 'tin' ? d.tin.id : 'dang-soan')}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 14 }}
            renderItem={({ item }) =>
              item.kieu === 'dang-soan' ? (
                <BongKoko>
                  <View testID="koko-dang-soan" className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text className="text-caption-lg text-ink-muted" style={{ fontFamily: fonts.medium }}>
                      Koko đang soạn câu trả lời…
                    </Text>
                  </View>
                </BongKoko>
              ) : item.tin.vaiTro === 'user' ? (
                <BongNguoiDung
                  tin={item.tin}
                  guiLaiDuoc={!dangTraLoi && coTheGuiLai(tin, item.tin.id)}
                  onGuiLai={() => guiLai(item.tin.id)}
                />
              ) : (
                <BongTraLoi
                  tin={item.tin}
                  // Tab Mentor / Lịch hẹn chỉ có ở chế độ Mentee.
                  onMoMentor={cheDo === 'MENTEE' ? () => router.push('/(tabs)/mentors') : undefined}
                  onMoLichHen={cheDo === 'MENTEE' ? () => router.push('/(tabs)/bookings') : undefined}
                />
              )
            }
          />
        )}

        <View className="border-t border-line bg-surface px-4 pb-3 pt-3">
          {quaDai ? (
            <Text className="pb-2 text-caption text-danger" style={{ fontFamily: fonts.medium }}>
              Mỗi câu hỏi tối đa {TOI_DA_KY_TU} ký tự.
            </Text>
          ) : null}
          <View className="flex-row items-end gap-2.5">
            <TextInput
              value={noiDung}
              onChangeText={setNoiDung}
              placeholder="Nhắn cho Koko…"
              placeholderTextColor={colors.inkMuted}
              accessibilityLabel="Tin nhắn cho Koko"
              testID="o-nhap-koko"
              multiline
              className="flex-1 rounded-lg border border-line bg-surface-page px-4 text-body text-ink"
              style={{ fontFamily: fonts.medium, minHeight: 48, maxHeight: 120, paddingTop: 13, paddingBottom: 13 }}
            />
            <NutGui
              disabled={noiDung.trim().length === 0 || quaDai}
              busy={dangTraLoi}
              onPress={() => guiNoiDung(noiDung)}
              testID="nut-gui-koko"
            />
          </View>
          <Text className="pt-2 text-center text-ink-muted" style={{ fontFamily: fonts.regular, fontSize: 11, lineHeight: 15 }}>
            Koko có thể nhầm. Hãy kiểm tra lại thông tin quan trọng.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Khung bong bóng của Koko: avatar 32 bên trái, nền trắng viền `line` */
function BongKoko({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row items-end gap-2">
      <View className="items-center justify-center overflow-hidden rounded-full bg-surface-tint" style={{ width: 32, height: 32 }}>
        <BrandImage source={KOKO} size={28} />
      </View>
      <View
        className="border border-line bg-surface"
        style={{ maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 20, borderBottomLeftRadius: 6, gap: 10 }}
      >
        {children}
      </View>
    </View>
  );
}

function BongTraLoi({
  tin,
  onMoMentor,
  onMoLichHen,
}: {
  tin: TinKoko;
  onMoMentor?: () => void;
  onMoLichHen?: () => void;
}) {
  const nguon = nhanNguon(tin.nguon);
  const loi: { nhan: string; onPress: () => void; khoa: string }[] = [];
  if (onMoMentor && tin.nguon?.includes('search_mentors')) {
    loi.push({ khoa: 'mentor', nhan: 'Xem danh sách mentor', onPress: onMoMentor });
  }
  if (onMoLichHen && tin.nguon?.includes('my_bookings')) {
    loi.push({ khoa: 'lich-hen', nhan: 'Mở lịch hẹn của bạn', onPress: onMoLichHen });
  }

  return (
    <BongKoko>
      <Text
        selectable
        testID={`tin-koko-${tin.id}`}
        className="text-ink-body"
        style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 }}
      >
        {lamSachTraLoi(tin.noiDung) || 'Koko chưa nghĩ ra câu trả lời. Bạn thử hỏi cách khác nhé.'}
      </Text>
      {loi.map((l) => (
        <Pressable
          key={l.khoa}
          accessibilityRole="link"
          onPress={l.onPress}
          testID={`loi-koko-${l.khoa}`}
          className="flex-row items-center gap-2 rounded-lg bg-surface-page px-3 py-2.5"
        >
          <Text className="flex-1 text-ink" style={{ fontFamily: fonts.semibold, fontSize: 13 }}>
            {l.nhan}
          </Text>
          <ChevronRight size={18} color={colors.accent} strokeWidth={2} />
        </Pressable>
      ))}
      {nguon.length > 0 ? (
        <Text className="text-ink-muted" style={{ fontFamily: fonts.regular, fontSize: 11, lineHeight: 15 }}>
          Đã tra: {nguon.join(' · ')}
        </Text>
      ) : null}
    </BongKoko>
  );
}

function BongNguoiDung({
  tin,
  guiLaiDuoc,
  onGuiLai,
}: {
  tin: TinKoko;
  guiLaiDuoc: boolean;
  onGuiLai: () => void;
}) {
  return (
    <View className="items-end" style={{ gap: 6 }}>
      <View
        testID={`tin-ban-${tin.id}`}
        className="bg-accent"
        style={{
          maxWidth: '78%',
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 20,
          borderBottomRightRadius: 6,
          opacity: tin.loi ? 0.6 : 1,
        }}
      >
        <Text selectable className="text-on-accent" style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 }}>
          {tin.noiDung}
        </Text>
      </View>
      {tin.loi ? (
        <View className="flex-row flex-wrap items-center justify-end gap-x-2" style={{ maxWidth: '85%' }}>
          <Text testID="loi-gui-koko" className="text-right text-caption text-danger" style={{ fontFamily: fonts.medium }}>
            {tin.loi}
          </Text>
          {guiLaiDuoc ? (
            <Pressable accessibilityRole="button" onPress={onGuiLai} testID="nut-gui-lai-koko" hitSlop={8}>
              <Text className="text-caption text-accent" style={{ fontFamily: fonts.bold }}>
                Gửi lại
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

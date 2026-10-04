/**
 * @file NotificationsScreen.tsx
 * @description Màn Thông báo, theo `Notifications.dc.html`: nút back + tiêu đề +
 * "Đọc tất cả", rồi hai nhóm "HÔM NAY" / "TRƯỚC ĐÓ", mỗi nhóm là một thẻ trắng
 * chứa các dòng (ô biểu tượng 40 theo tông, nội dung, giờ, chấm chưa đọc).
 *
 * ## Khác thiết kế, và vì sao
 *
 * - **Mỗi dòng có thêm tiêu đề**: thiết kế chỉ có một câu, backend gửi cả `title`
 *   lẫn `message`. Tiêu đề nằm trên, câu đầy đủ nằm dưới; trùng nhau thì chỉ in
 *   một — xem `noiDungThongBao()`.
 * - **Không phải dòng nào cũng bấm được**: chỉ dòng có màn tương ứng trong app
 *   (booking, chat, bài diễn đàn). Dòng chưa đọc mà không có đích vẫn bấm được
 *   để đánh dấu đã đọc — đó là một việc thật. Luật ở `dichThongBao()`.
 * - **"Đọc tất cả" chỉ hiện khi có dòng chưa đọc** trong những gì đã tải.
 */

import { useRouter } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Clock,
  FileText,
  MessageCircle,
  MessagesSquare,
  ShieldCheck,
  Star,
} from 'lucide-react-native';
import { ActivityIndicator, Pressable, SectionList, Text, View } from 'react-native';

import { trangThaiTai } from '@/core/api/queryState';
import { useRoleMode } from '@/core/roleMode/RoleModeProvider';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { ScreenHeader } from '@/core/ui/ScreenHeader';
import { colors, fonts, radius, spacing } from '@/core/ui/theme';
import type { BieuTuongThongBao, TongThongBao } from '@/features/notification/dichThongBao';
import {
  bieuTuongThongBao,
  dichThongBao,
  nhanThoiGianThongBao,
  nhomThongBao,
  noiDungThongBao,
  tongThongBao,
} from '@/features/notification/dichThongBao';
import {
  THAM_DO_THONG_BAO_MS,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/features/notification/hooks/useNotifications';
import type { NotificationResponse } from '@/features/notification/types';

export interface NotificationsScreenProps {
  /** Chu kỳ tải lại danh sách; test truyền `false` */
  thamDoMs?: number | false;
}

const ICON: Record<BieuTuongThongBao, LucideIcon> = {
  lich: CalendarDays,
  'dong-ho': Clock,
  'tin-nhan': MessageCircle,
  'binh-luan': MessagesSquare,
  'danh-gia': Star,
  'xac-minh': ShieldCheck,
  'su-co': AlertTriangle,
  'bai-viet': FileText,
  chuong: Bell,
};

const TONG: Record<TongThongBao, { nen: string; chu: string }> = {
  'thanh-cong': { nen: colors.successSoft, chu: colors.successInk },
  'chu-y': { nen: colors.warningSoft, chu: colors.warningInk },
  thuong: { nen: colors.surfaceTint, chu: colors.accent },
  'trung-tinh': { nen: colors.neutralSoft, chu: colors.inkMuted },
};

export function NotificationsScreen({ thamDoMs = THAM_DO_THONG_BAO_MS }: NotificationsScreenProps) {
  const router = useRouter();
  const { cheDo } = useRoleMode();
  const query = useNotifications(thamDoMs);
  const danhDau = useMarkNotificationRead();
  const danhDauHet = useMarkAllNotificationsRead();

  const trangThai = trangThaiTai({
    isPaused: query.isPaused,
    isPending: query.isPending,
    isError: query.isError,
    coDuLieu: query.data !== undefined,
  });

  const roiMan = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const moThongBao = (n: NotificationResponse) => {
    if (!n.read) {
      danhDau.mutate(n.notificationId);
    }
    const dich = dichThongBao(n, cheDo);
    if (dich) {
      router.push(dich);
    }
  };

  return (
    <Screen testID="man-hinh-thong-bao">
      <OfflineBanner />
      <View className="px-gutter pb-3 pt-2">
        <ScreenHeader
          title="Thông báo"
          onBack={roiMan}
          trailing={
            query.coChuaDoc ? (
              <Pressable
                testID="nut-doc-tat-ca"
                accessibilityRole="button"
                accessibilityLabel="Đánh dấu tất cả đã đọc"
                disabled={danhDauHet.isPending}
                onPress={() => danhDauHet.mutate()}
                className={`justify-center px-1 ${danhDauHet.isPending ? 'opacity-50' : ''}`}
                style={{ minHeight: spacing.touch }}
              >
                <Text className="text-caption-lg text-accent" style={{ fontFamily: fonts.semibold }}>
                  Đọc tất cả
                </Text>
              </Pressable>
            ) : null
          }
        />
      </View>

      {trangThai === 'dang-tai' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-thong-bao" color={colors.accent} />
        </View>
      ) : trangThai === 'mat-ket-noi' ? (
        <EmptyState title="Không có kết nối" description="Thông báo sẽ tải khi có mạng trở lại." />
      ) : trangThai === 'loi' ? (
        <ErrorView error={query.error} onAction={() => void query.refetch()} />
      ) : (
        <SectionList
          testID="danh-sach-thong-bao"
          sections={nhomThongBao(query.thongBao)}
          keyExtractor={(n) => n.notificationId}
          stickySectionHeadersEnabled={false}
          contentContainerClassName="grow px-gutter pb-10"
          renderSectionHeader={({ section }) => (
            <Text
              className="px-1 pb-2 pt-3 text-caption text-ink-muted"
              style={{ fontFamily: fonts.semibold, letterSpacing: 1.4 }}
            >
              {section.title}
            </Text>
          )}
          renderItem={({ item, index, section }) => (
            <DongThongBao
              thongBao={item}
              dau={index === 0}
              cuoi={index === section.data.length - 1}
              coDich={dichThongBao(item, cheDo) !== null}
              onPress={() => moThongBao(item)}
            />
          )}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              void query.fetchNextPage();
            }
          }}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title="Chưa có thông báo nào"
              description="Khi mentor xác nhận lịch, có người bình luận bài của bạn hay có tin nhắn mới, bạn sẽ thấy ở đây."
            />
          }
        />
      )}
    </Screen>
  );
}

function DongThongBao({
  thongBao,
  dau,
  cuoi,
  coDich,
  onPress,
}: {
  thongBao: NotificationResponse;
  dau: boolean;
  cuoi: boolean;
  coDich: boolean;
  onPress: () => void;
}) {
  const Icon = ICON[bieuTuongThongBao(thongBao.type)];
  const tong = TONG[tongThongBao(thongBao.type)];
  const { tieuDe, moTa } = noiDungThongBao(thongBao);
  const gio = nhanThoiGianThongBao(thongBao);
  const chuaDoc = !thongBao.read;

  const khung = {
    className: `flex-row items-start gap-3 border-x border-t border-line px-4 ${cuoi ? 'border-b' : ''} ${
      chuaDoc ? 'bg-surface-page' : 'bg-surface'
    }`,
    style: [
      { paddingVertical: 14 },
      dau ? { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg } : null,
      cuoi ? { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg } : null,
    ],
  };

  const noiDung = (
    <>
      <View
        className="items-center justify-center rounded-full"
        style={{ width: 40, height: 40, backgroundColor: tong.nen }}
      >
        <Icon size={20} color={tong.chu} strokeWidth={2} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        {tieuDe ? (
          <Text className="text-caption-lg text-ink" style={{ fontFamily: chuaDoc ? fonts.bold : fonts.semibold }}>
            {tieuDe}
          </Text>
        ) : null}
        <Text
          className={`text-caption-lg ${chuaDoc ? 'text-ink' : 'text-ink-body'}`}
          style={{ fontFamily: chuaDoc && !tieuDe ? fonts.semibold : fonts.regular, lineHeight: 20 }}
        >
          {moTa}
        </Text>
        {gio ? (
          <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
            {gio}
          </Text>
        ) : null}
      </View>
      {chuaDoc ? (
        <View
          testID={`chua-doc-${thongBao.notificationId}`}
          className="rounded-full bg-accent"
          style={{ width: 10, height: 10, marginTop: 6 }}
        />
      ) : null}
    </>
  );

  const nhan = `${tieuDe ? `${tieuDe}. ` : ''}${moTa}${chuaDoc ? ', chưa đọc' : ''}`;

  if (!coDich && !chuaDoc) {
    return (
      <View testID={`thong-bao-${thongBao.notificationId}`} accessibilityLabel={nhan} {...khung}>
        {noiDung}
      </View>
    );
  }

  return (
    <Pressable
      testID={`thong-bao-${thongBao.notificationId}`}
      accessibilityRole="button"
      accessibilityLabel={nhan}
      accessibilityHint={coDich ? 'Mở chi tiết' : 'Đánh dấu đã đọc'}
      onPress={onPress}
      {...khung}
    >
      {noiDung}
    </Pressable>
  );
}

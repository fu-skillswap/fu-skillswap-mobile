/**
 * @file MessagesScreen.tsx
 * @description Tab "Tin nhắn", theo `Messages.dc.html`: tiêu đề, ô tìm hội thoại,
 * nhãn "GẦN ĐÂY" và một thẻ trắng chứa các hàng hội thoại (avatar, tên, giờ, tin
 * cuối, số chưa đọc).
 *
 * ## Những gì thiết kế có mà màn này CỐ Ý KHÔNG dựng
 *
 * - **Nút "Tin nhắn mới"**: không có endpoint mở hội thoại tự do. Phòng chat chỉ
 *   được backend tạo khi mentor chấp nhận một booking.
 * - **Chấm xanh "đang hoạt động"**: backend không có API trạng thái trực tuyến.
 *
 * Hàng ghim "Koko · TRỢ LÝ AI" (`HangKoko`) nằm ở phần đầu cố định, không trong
 * danh sách: hộp thư rỗng, đang tải hay mất mạng thì Koko vẫn hỏi được. Nó tự ẩn
 * khi bản build không có AI.
 *
 * Ô tìm kiếm lọc TẠI CHỖ trên các hội thoại đã tải (backend không có tham số tìm
 * cho hộp thư) — đủ cho hộp thư của một sinh viên, vốn chỉ vài chục hội thoại.
 */

import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { trangThaiTai } from '@/core/api/queryState';
import { Avatar } from '@/core/ui/Avatar';
import { KOKO, KOKO_404 } from '@/core/ui/brand';
import { BrandImage } from '@/core/ui/BrandImage';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { ScreenHeader } from '@/core/ui/ScreenHeader';
import { colors, fonts, radius, shadows } from '@/core/ui/theme';
import { THAM_DO_HOP_THU_MS, useConversations } from '@/features/chat/hooks/useChat';
import { nhanThoiGianHoiThoai } from '@/features/chat/thoiGian';
import type { ConversationResponse } from '@/features/chat/types';
import { HangKoko } from '@/features/koko';

export interface MessagesScreenProps {
  /** Chu kỳ tải lại hộp thư; test truyền `false` */
  thamDoMs?: number | false;
  /**
   * Có thì hiện nút quay lại. Chỉ route `/chat` (mở từ menu "Thêm" của chế độ
   * Mentor) truyền nó — ở tab Tin nhắn của Mentee không có gì để quay lại.
   */
  onBack?: () => void;
}

/** Tên hiển thị của hội thoại — nhóm khoá học thì lấy tên khoá học */
export function tenHoiThoai(h: ConversationResponse): string {
  return h.otherUserName ?? h.courseTitle ?? h.mentorName ?? 'Cuộc trò chuyện';
}

function boDau(chuoi: string): string {
  return chuoi.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

export function MessagesScreen({ thamDoMs = THAM_DO_HOP_THU_MS, onBack }: MessagesScreenProps) {
  const router = useRouter();
  const query = useConversations(thamDoMs);
  const [tuKhoa, setTuKhoa] = useState('');

  const danhSach = useMemo(() => {
    const k = boDau(tuKhoa.trim());
    return k === '' ? query.hoiThoai : query.hoiThoai.filter((h) => boDau(tenHoiThoai(h)).includes(k));
  }, [query.hoiThoai, tuKhoa]);

  const trangThai = trangThaiTai({
    isPaused: query.isPaused,
    isPending: query.isPending,
    isError: query.isError,
    coDuLieu: query.data !== undefined,
  });

  return (
    <Screen testID="man-hinh-tin-nhan">
      <OfflineBanner />
      <View className="gap-4 px-gutter pb-3 pt-2">
        <ScreenHeader title="Tin nhắn" size="lg" onBack={onBack} />
        <View
          className="flex-row items-center gap-2.5 rounded-full border border-line bg-surface px-4"
          style={{ height: 48 }}
        >
          <Search size={18} color={colors.inkMuted} strokeWidth={2} />
          <TextInput
            value={tuKhoa}
            onChangeText={setTuKhoa}
            placeholder="Tìm cuộc trò chuyện"
            placeholderTextColor={colors.inkMuted}
            accessibilityLabel="Tìm cuộc trò chuyện"
            testID="o-tim-hoi-thoai"
            className="flex-1 text-body text-ink"
            style={{ fontFamily: fonts.medium, paddingVertical: 0 }}
          />
        </View>
        <HangKoko />
      </View>

      {trangThai === 'dang-tai' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-hop-thu" color={colors.accent} />
        </View>
      ) : trangThai === 'mat-ket-noi' ? (
        <EmptyState title="Không có kết nối" description="Tin nhắn sẽ tải khi có mạng trở lại." />
      ) : trangThai === 'loi' ? (
        <ErrorView error={query.error} onAction={() => void query.refetch()} />
      ) : (
        <FlatList
          testID="danh-sach-hoi-thoai"
          data={danhSach}
          keyExtractor={(h) => h.id}
          contentContainerClassName="grow px-gutter pb-28"
          ListHeaderComponent={
            danhSach.length > 0 ? (
              <Text
                className="pb-2 pt-1 text-caption text-ink-muted"
                style={{ fontFamily: fonts.semibold, letterSpacing: 1.4 }}
              >
                GẦN ĐÂY
              </Text>
            ) : null
          }
          renderItem={({ item, index }) => (
            <HangHoiThoai
              hoiThoai={item}
              dau={index === 0}
              cuoi={index === danhSach.length - 1}
              onPress={() => router.push(`/chat/${item.id}`)}
            />
          )}
          onEndReachedThreshold={0.5}
          // Chốt chặn bấm trùng nằm trong hook (mục 6 của quy ước).
          onEndReached={query.taiTrangKe}
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
            tuKhoa.trim() !== '' ? (
              <EmptyState
                title="Không tìm thấy"
                description="Không có cuộc trò chuyện nào khớp tên này."
                // Tìm mà không thấy — đúng ngữ cảnh của tư thế "404", khác hẳn
                // khối rỗng bên dưới (chưa có gì để tìm).
                illustration={
                  <BrandImage source={KOKO_404} size={140} testID="minh-hoa-khong-thay-hoi-thoai" />
                }
              />
            ) : (
              <EmptyState
                title="Chưa có cuộc trò chuyện nào"
                description="Phòng chat với mentor tự mở khi mentor chấp nhận lịch hẹn của bạn."
                actionLabel="Tìm Mentor"
                onAction={() => router.push('/(tabs)/mentors')}
                // Tư thế chuẩn: không có gì bị mất và cũng không có gì để đọc.
                illustration={
                  <BrandImage source={KOKO} size={140} testID="minh-hoa-rong-hoi-thoai" />
                }
              />
            )
          }
        />
      )}
    </Screen>
  );
}

function HangHoiThoai({
  hoiThoai,
  dau,
  cuoi,
  onPress,
}: {
  hoiThoai: ConversationResponse;
  dau: boolean;
  cuoi: boolean;
  onPress: () => void;
}) {
  const ten = tenHoiThoai(hoiThoai);
  const chuaDoc = hoiThoai.unreadCount > 0;
  const gio = nhanThoiGianHoiThoai(hoiThoai.lastMessageAt ?? hoiThoai.createdAt);

  return (
    <Pressable
      testID={`hoi-thoai-${hoiThoai.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${ten}${chuaDoc ? `, ${hoiThoai.unreadCount} tin chưa đọc` : ''}`}
      onPress={onPress}
      className={`flex-row items-center gap-3 border-x border-line bg-surface px-4 border-t ${cuoi ? 'border-b' : ''}`}
      style={[
        { minHeight: 76, paddingVertical: 14 },
        dau ? { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg } : null,
        cuoi ? { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg } : null,
        dau ? shadows.card : null,
      ]}
    >
      <Avatar name={ten} size={48} />
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row justify-between gap-2">
          <Text numberOfLines={1} className="flex-1 text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
            {ten}
          </Text>
          {gio ? (
            <Text className="text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
              {gio}
            </Text>
          ) : null}
        </View>
        <View className="flex-row items-center justify-between gap-2">
          <Text
            numberOfLines={1}
            className={`flex-1 text-caption-lg ${chuaDoc ? 'text-ink' : 'text-ink-muted'}`}
            style={{ fontFamily: chuaDoc ? fonts.semibold : fonts.regular }}
          >
            {hoiThoai.lastMessageContent ?? 'Chưa có tin nhắn'}
          </Text>
          {chuaDoc ? (
            <View
              testID={`chua-doc-${hoiThoai.id}`}
              className="items-center justify-center rounded-full bg-accent px-1.5"
              style={{ minWidth: 20, height: 20 }}
            >
              <Text className="text-on-accent" style={{ fontFamily: fonts.bold, fontSize: 11 }}>
                {hoiThoai.unreadCount > 99 ? '99+' : hoiThoai.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

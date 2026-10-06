/**
 * @file ChatScreen.tsx
 * @description Chat 1:1, theo `ChatDetail.dc.html`: thanh trên trắng (nút quay
 * lại, avatar, tên), thẻ ngữ cảnh buổi học nền `surface-tint`, khung tin nhắn
 * (tin của mình bên phải nền `accent`, tin người kia bên trái nền trắng viền
 * `line`), nhãn ngày, "Đã xem", và ô nhập + nút gửi tròn gradient ở đáy.
 *
 * ## Khác thiết kế ở đâu, vì sao
 *
 * - **Không có nút đính kèm**: gửi tệp cần ba bước (xin upload intent, tải tệp
 *   lên URL tạm, gửi tin kèm intent) cùng trình chọn tệp — đợt sau. Tệp người kia
 *   đã gửi vẫn hiện tên và dung lượng.
 * - **Không có dòng "Đang hoạt động"**: backend không có API trạng thái trực
 *   tuyến. Chỗ đó nói chat đang mở hay chỉ xem.
 * - **Khi chat bị khoá** (`canSendMessages = false`), ô nhập đổi thành một dải
 *   nói lý do — dùng nguyên văn `userActionMessage` của backend khi có.
 */

import { useRouter } from 'expo-router';
import { CalendarDays, ChevronLeft, FileText } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { toUserMessage } from '@/core/api/errors';
import { trangThaiTai } from '@/core/api/queryState';
import { useRoleMode } from '@/core/roleMode/RoleModeProvider';
import { dinhDangGio, nhanNgayNgan } from '@/core/time/offsetDateTime';
import { Avatar } from '@/core/ui/Avatar';
import { useBuTruBanPhim } from '@/core/ui/banPhim';
import { EmptyState } from '@/core/ui/EmptyState';
import { ErrorView } from '@/core/ui/ErrorView';
import { IconButton } from '@/core/ui/IconButton';
import { NutGui } from '@/core/ui/NutGui';
import { OfflineBanner } from '@/core/ui/OfflineBanner';
import { Screen } from '@/core/ui/Screen';
import { StatusBadge } from '@/core/ui/StatusBadge';
import { colors, fonts, spacing } from '@/core/ui/theme';
import { nhanTrangThaiBooking, useBookingDetail } from '@/features/booking';
import {
  THAM_DO_KHUNG_CHAT_MS,
  useConversation,
  useMarkRead,
  useMessages,
  useSendMessage,
} from '@/features/chat/hooks/useChat';
import { tenHoiThoai } from '@/features/chat/screens/MessagesScreen';
import { dungDongChat } from '@/features/chat/dongChat';
import { gioTinNhan } from '@/features/chat/thoiGian';
import { NOI_DUNG_TIN_TOI_DA } from '@/features/chat/types';
import type { ChatReadOnlyReason, MessageResponse } from '@/features/chat/types';

/** Câu giải thích khi backend không gửi `userActionMessage` */
const LY_DO_CHI_XEM: Record<ChatReadOnlyReason, string> = {
  ADMIN_LOCKED: 'Cuộc trò chuyện đã bị quản trị viên khoá.',
  ACCOUNT_RESTRICTED: 'Tài khoản đang bị hạn chế nhắn tin.',
  UNDER_REVIEW: 'Buổi học đang được xem xét, tạm thời chỉ xem được tin nhắn.',
  PARTICIPANT_BLOCKED: 'Cuộc trò chuyện đã bị chặn.',
  GROUP_MEMBERSHIP_REVOKED: 'Bạn không còn là thành viên của nhóm này.',
  NO_EFFECTIVE_BOOKING: 'Chưa có buổi học nào còn hiệu lực để nhắn tin.',
  CHAT_WINDOW_EXPIRED: 'Đã hết thời gian trao đổi sau buổi học.',
};

export interface ChatScreenProps {
  conversationId: string;
  /** Chu kỳ tải lại tin; test truyền `false` */
  thamDoMs?: number | false;
}

export function ChatScreen({ conversationId, thamDoMs = THAM_DO_KHUNG_CHAT_MS }: ChatScreenProps) {
  const router = useRouter();
  const { cheDo } = useRoleMode();
  // Màn nằm trong `Screen` (SafeAreaView), không có thanh tiêu đề native.
  const buTruBanPhim = useBuTruBanPhim();
  const hoiThoai = useConversation(conversationId);
  const tin = useMessages(conversationId, thamDoMs);
  const guiTin = useSendMessage(conversationId);
  const danhDauDoc = useMarkRead(conversationId);
  const booking = useBookingDetail(hoiThoai.data?.bookingId);
  const [noiDung, setNoiDung] = useState('');

  // Đánh dấu đã đọc tới tin mới nhất — mỗi `sequence` gửi đúng một lần.
  const daDanhDau = useRef(0);
  const seqMoiNhat = tin.tinNhan.reduce((m, t) => Math.max(m, t.sequence ?? 0), 0);
  const daDocToi = hoiThoai.data?.myLastReadSequence ?? 0;
  useEffect(() => {
    if (seqMoiNhat > daDocToi && seqMoiNhat > daDanhDau.current) {
      daDanhDau.current = seqMoiNhat;
      danhDauDoc.mutate(seqMoiNhat);
    }
    // `danhDauDoc` đổi danh tính mỗi lần render; chỉ cần chạy khi hai con số đổi.
  }, [seqMoiNhat, daDocToi]);

  const dong = useMemo(() => dungDongChat(tin.tinNhan), [tin.tinNhan]);
  // Danh sách đảo ngược: dòng mới nhất ở đáy, bàn phím mở không đẩy mất tin cuối.
  const dongDao = useMemo(() => [...dong].reverse(), [dong]);

  const roiDi = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    // Chế độ Mentor không có tab Tin nhắn — `/(tabs)/messages` là một tab bị ẩn,
    // không mục nào sáng. Hộp thư của mentor là route `/chat` (`app/chat/index.tsx`).
    router.replace(cheDo === 'MENTOR' ? '/chat' : '/(tabs)/messages');
  };

  const gui = () => {
    const gon = noiDung.trim();
    if (gon.length === 0 || gon.length > NOI_DUNG_TIN_TOI_DA || guiTin.isPending) {
      return;
    }
    guiTin.mutate(gon, { onSuccess: () => setNoiDung('') });
  };

  const h = hoiThoai.data;
  const ten = h ? tenHoiThoai(h) : '';
  const quaDai = noiDung.trim().length > NOI_DUNG_TIN_TOI_DA;

  // `isPending` một mình quay mãi khi mất mạng (query bị hoãn vẫn là pending) —
  // quy về một trạng thái bằng `trangThaiTai`, xem `core/api/queryState.ts`.
  const trangThaiHoiThoai = trangThaiTai({
    isPaused: hoiThoai.isPaused,
    isPending: hoiThoai.isPending,
    isError: hoiThoai.isError,
    coDuLieu: h !== undefined,
  });
  const trangThaiTin = trangThaiTai({
    isPaused: tin.isPaused,
    isPending: tin.isPending,
    isError: tin.isError,
    coDuLieu: tin.tinNhan.length > 0,
  });

  return (
    <Screen testID="man-hinh-chat">
      <OfflineBanner />
      {/* Thanh trên trắng có viền dưới */}
      <View className="flex-row items-center gap-2.5 border-b border-line bg-surface px-4 pb-2.5 pt-1">
        <IconButton
          label="Quay lại"
          icon={<ChevronLeft size={22} color={colors.ink} strokeWidth={2} />}
          onPress={roiDi}
          variant="outline"
          testID="nut-quay-lai"
        />
        {h ? (
          <>
            <Avatar name={ten} size={44} tone="accent" />
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-body-lg text-ink" style={{ fontFamily: fonts.bold }}>
                {ten}
              </Text>
              <Text
                className={`text-caption ${h.canSendMessages ? 'text-success-ink' : 'text-ink-muted'}`}
                style={{ fontFamily: fonts.medium }}
              >
                {h.canSendMessages ? 'Đang mở trao đổi' : 'Chỉ xem'}
              </Text>
            </View>
          </>
        ) : (
          <View className="flex-1" />
        )}
      </View>

      {trangThaiHoiThoai === 'dang-tai' ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="dang-tai-hoi-thoai" color={colors.accent} />
        </View>
      ) : trangThaiHoiThoai === 'mat-ket-noi' ? (
        <EmptyState
          title="Không có kết nối"
          description="Cuộc trò chuyện sẽ tải khi có mạng trở lại."
        />
      ) : trangThaiHoiThoai === 'loi' || !h ? (
        <ErrorView error={hoiThoai.error} onAction={() => void hoiThoai.refetch()} />
      ) : (
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          // Khung cha nằm dưới vùng an toàn phía trên — xem `core/ui/banPhim.ts`.
          keyboardVerticalOffset={buTruBanPhim}
        >
          {booking.data ? (
            <Pressable
              testID="the-ngu-canh-buoi-hoc"
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/bookings')}
              className="mx-4 mt-3 flex-row items-center gap-2.5 rounded-md bg-surface-tint px-3.5 py-2.5"
            >
              <CalendarDays size={18} color={colors.accent} strokeWidth={2} />
              <Text numberOfLines={1} className="flex-1 text-caption-lg text-ink" style={{ fontFamily: fonts.semibold }}>
                {[
                  booking.data.serviceTitle,
                  nhanNgayNgan(booking.data.selectedStartTime),
                  dinhDangGio(booking.data.selectedStartTime),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <StatusBadge {...nhanTrangThaiBooking(booking.data)} />
            </Pressable>
          ) : null}

          {trangThaiTin === 'dang-tai' ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator testID="dang-tai-tin-nhan" color={colors.accent} />
            </View>
          ) : trangThaiTin === 'mat-ket-noi' ? (
            <EmptyState
              title="Không có kết nối"
              description="Tin nhắn sẽ tải khi có mạng trở lại."
            />
          ) : trangThaiTin === 'loi' ? (
            <ErrorView error={tin.error} onAction={() => void tin.refetch()} />
          ) : (
            <FlatList
              testID="danh-sach-tin-nhan"
              inverted
              data={dongDao}
              keyExtractor={(d) => d.khoa}
              renderItem={({ item }) =>
                item.kieu === 'ngay' ? (
                  <Text
                    className="self-center py-1 text-caption text-ink-muted"
                    style={{ fontFamily: fonts.regular }}
                  >
                    {item.nhan}
                  </Text>
                ) : (
                  <BongTin tin={item.tin} hienGio={item.hienGio} daXem={item.daXem} />
                )
              }
              contentContainerStyle={{ paddingHorizontal: spacing.card, paddingVertical: 14, gap: 10 }}
              // Danh sách đảo: "cuối" là phía TRÊN — tải thêm tin cũ.
              onEndReachedThreshold={0.3}
              // Chốt chặn bấm trùng nằm trong `useMessages` (mục 6 của quy ước).
              onEndReached={tin.taiTrangKe}
              ListFooterComponent={
                tin.isFetchingNextPage ? <ActivityIndicator color={colors.accent} /> : null
              }
              ListEmptyComponent={
                // KHÔNG tự lật: VirtualizedList đã gắn style đảo (`inversionStyle`) lên
                // phần tử rỗng qua `cloneElement`. Tự đặt `scaleY: -1` ở đây ĐÈ lên
                // style đó — trên Android style đảo là `scale: -1` (cả hai trục), nên
                // chữ bị lật gương. Bọc một `View` trần vì `EmptyState` không nhận
                // prop `style` mà VirtualizedList gắn vào.
                <View testID="chat-rong" className="flex-1">
                  <EmptyState
                    title="Chưa có tin nhắn"
                    description={`Gửi lời chào tới ${ten} để bắt đầu trao đổi.`}
                  />
                </View>
              }
            />
          )}

          {h.canSendMessages ? (
            <View className="border-t border-line bg-surface px-4 pb-4 pt-3">
              {guiTin.isError ? (
                <Text testID="loi-gui-tin" className="pb-2 text-caption text-danger" style={{ fontFamily: fonts.medium }}>
                  {toUserMessage(guiTin.error).title}. Chạm gửi để thử lại.
                </Text>
              ) : null}
              {quaDai ? (
                <Text className="pb-2 text-caption text-danger" style={{ fontFamily: fonts.medium }}>
                  Tin nhắn tối đa {NOI_DUNG_TIN_TOI_DA} ký tự.
                </Text>
              ) : null}
              <View className="flex-row items-end gap-2.5">
                <TextInput
                  value={noiDung}
                  onChangeText={setNoiDung}
                  placeholder="Nhắn tin…"
                  placeholderTextColor={colors.inkMuted}
                  accessibilityLabel="Tin nhắn"
                  testID="o-nhap-tin"
                  multiline
                  numberOfLines={1}
                  className="flex-1 rounded-lg border border-line bg-surface-page px-4 text-body text-ink"
                  style={{ fontFamily: fonts.medium, minHeight: 48, maxHeight: 120, paddingTop: 13, paddingBottom: 13 }}
                />
                <NutGui
                  disabled={noiDung.trim().length === 0 || quaDai}
                  busy={guiTin.isPending}
                  onPress={gui}
                />
              </View>
            </View>
          ) : (
            <View testID="dai-chi-xem" className="border-t border-line bg-surface px-5 pb-5 pt-4">
              <Text className="text-center text-caption-lg text-ink-muted" style={{ fontFamily: fonts.medium }}>
                {h.userActionMessage ??
                  (h.readOnlyReason ? LY_DO_CHI_XEM[h.readOnlyReason] : 'Cuộc trò chuyện đang ở chế độ chỉ xem.')}
              </Text>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

function BongTin({ tin, hienGio, daXem }: { tin: MessageResponse; hienGio: boolean; daXem: boolean }) {
  if (tin.messageType === 'SYSTEM') {
    return (
      <Text className="self-center px-6 text-center text-caption text-ink-muted" style={{ fontFamily: fonts.regular }}>
        {tin.content}
      </Text>
    );
  }

  const cuaMinh = tin.isMine;
  const daXoa = tin.state === 'DELETED';
  const tep = tin.attachments ?? [];
  const gio = gioTinNhan(tin.createdAt);

  return (
    <View className={cuaMinh ? 'items-end' : 'items-start'} style={{ gap: 4 }}>
      {daXoa || (tin.content ?? '').length > 0 ? (
        <View
          testID={`tin-${tin.id}`}
          className={cuaMinh ? 'bg-accent' : 'border border-line bg-surface'}
          style={{
            maxWidth: '80%',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 20,
            [cuaMinh ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: 6,
          }}
        >
          <Text
            className={cuaMinh ? 'text-on-accent' : 'text-ink-body'}
            style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, fontStyle: daXoa ? 'italic' : 'normal' }}
          >
            {daXoa ? 'Tin nhắn đã bị xoá' : tin.content}
          </Text>
        </View>
      ) : null}
      {!daXoa
        ? tep.map((t) => (
            <View
              key={t.attachmentId}
              className={`flex-row items-center gap-2.5 ${cuaMinh ? 'bg-accent' : 'border border-line bg-surface'}`}
              style={{ maxWidth: '80%', padding: 10, borderRadius: 20 }}
            >
              <FileText size={20} color={cuaMinh ? colors.onAccent : colors.accent} strokeWidth={2} />
              <View className="min-w-0 shrink">
                <Text numberOfLines={1} className={cuaMinh ? 'text-on-accent' : 'text-ink'} style={{ fontFamily: fonts.bold, fontSize: 13 }}>
                  {t.filename}
                </Text>
                <Text className={cuaMinh ? 'text-on-accent' : 'text-ink-muted'} style={{ fontFamily: fonts.regular, fontSize: 11 }}>
                  {Math.max(1, Math.round(t.sizeBytes / 1024))} KB
                </Text>
              </View>
            </View>
          ))
        : null}
      {hienGio && gio ? (
        <Text className="text-ink-muted" style={{ fontFamily: fonts.regular, fontSize: 11 }}>
          {daXem ? `${gio} · Đã xem` : gio}
        </Text>
      ) : null}
    </View>
  );
}

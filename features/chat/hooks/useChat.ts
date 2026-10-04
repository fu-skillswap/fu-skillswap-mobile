/**
 * @file useChat.ts
 * @description Hook của nhánh chat: hộp thư, một hội thoại, cửa sổ tin nhắn,
 * gửi tin và đánh dấu đã đọc.
 *
 * ## Vì sao tải lại theo chu kỳ thay vì WebSocket
 *
 * Backend đẩy tin mới qua STOMP (`/user/queue/chat/messages`), nhưng app chưa có
 * thư viện STOMP và việc giữ kết nối nền trên điện thoại là cả một đợt việc
 * riêng. Trong lúc chờ, màn đang mở tự tải lại: khung chat mỗi
 * `THAM_DO_KHUNG_CHAT_MS`, hộp thư mỗi `THAM_DO_HOP_THU_MS`. TanStack Query chỉ
 * chạy chu kỳ khi màn đang được dùng, nên không tốn pin khi app ở nền.
 *
 * Tham số `thamDoMs` để test truyền `false` — một đồng hồ chạy ngầm trong test sẽ
 * bắn request sau khi test đã xong.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';

import { newIdempotencyKey } from '@/core/api/idempotency';
import { flattenPages, getNextCursor } from '@/core/api/pagination';
import { chatRepo } from '@/features/chat/chatRepo';
import { chatKeys } from '@/features/chat/queryKeys';
import type { MessageResponse } from '@/features/chat/types';

/** Chu kỳ tải lại khung chat đang mở */
export const THAM_DO_KHUNG_CHAT_MS = 5_000;

/** Chu kỳ tải lại hộp thư */
export const THAM_DO_HOP_THU_MS = 20_000;

/** Số tin mỗi lần tải — backend mặc định 30, tối đa 50 */
const SO_TIN_MOI_LAN = 30;

/** Hộp thư, cuộn tới đâu tải tới đó */
export function useConversations(thamDoMs: number | false = THAM_DO_HOP_THU_MS) {
  const query = useInfiniteQuery({
    queryKey: chatKeys.inbox(),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => chatRepo.getConversations(pageParam),
    getNextPageParam: (trang) => getNextCursor(trang) ?? null,
    refetchInterval: thamDoMs,
  });

  const hoiThoai = useMemo(() => flattenPages(query.data?.pages), [query.data]);
  const tongChuaDoc = useMemo(
    () => hoiThoai.reduce((tong, h) => tong + h.unreadCount, 0),
    [hoiThoai],
  );

  return { ...query, hoiThoai, tongChuaDoc };
}

/** Thông tin một hội thoại (tên người kia, quyền gửi, lý do bị khoá…) */
export function useConversation(conversationId: string) {
  return useQuery({
    queryKey: chatKeys.conversation(conversationId),
    queryFn: () => chatRepo.getConversation(conversationId),
    enabled: conversationId.length > 0,
  });
}

/**
 * Tin nhắn của một hội thoại, đã sắp từ cũ tới mới theo `sequence`.
 *
 * Trang đầu là các tin mới nhất; "trang kế" là các tin CŨ HƠN tin cũ nhất đang
 * có (`beforeSequence`). Hết trang khi một lần tải về ít hơn số đã xin.
 */
export function useMessages(conversationId: string, thamDoMs: number | false = THAM_DO_KHUNG_CHAT_MS) {
  const query = useInfiniteQuery({
    queryKey: chatKeys.messages(conversationId),
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) => chatRepo.getMessages(conversationId, pageParam, SO_TIN_MOI_LAN),
    getNextPageParam: (trang) => {
      if (trang.length < SO_TIN_MOI_LAN) {
        return null;
      }
      const nhoNhat = Math.min(...trang.map((t) => t.sequence ?? Number.POSITIVE_INFINITY));
      return Number.isFinite(nhoNhat) ? nhoNhat : null;
    },
    enabled: conversationId.length > 0,
    refetchInterval: thamDoMs,
  });

  const tinNhan = useMemo(() => sapTinNhan(query.data?.pages.flat() ?? []), [query.data]);

  return { ...query, tinNhan };
}

/**
 * Bỏ trùng theo `id` rồi sắp theo `sequence` tăng dần. Tin chưa có `sequence`
 * (hiếm, nhưng `Long` đóng hộp cho phép) xếp cuối theo `createdAt`.
 */
export function sapTinNhan(tin: readonly MessageResponse[]): MessageResponse[] {
  const theoId = new Map<string, MessageResponse>();
  for (const t of tin) {
    theoId.set(t.id, t);
  }
  return [...theoId.values()].sort((a, b) => {
    if (a.sequence != null && b.sequence != null) {
      return a.sequence - b.sequence;
    }
    if (a.sequence != null) {
      return -1;
    }
    if (b.sequence != null) {
      return 1;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/**
 * Gửi tin. `clientMessageId` sinh MỘT LẦN cho mỗi nội dung và giữ nguyên khi gửi
 * lại sau lỗi — backend dùng nó để không lưu hai tin giống nhau. Gửi xong (hoặc
 * đổi nội dung) thì sinh id mới.
 */
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const banNhap = useRef<{ noiDung: string; id: string } | null>(null);

  return useMutation({
    networkMode: 'always',
    mutationFn: (noiDung: string) => {
      if (!banNhap.current || banNhap.current.noiDung !== noiDung) {
        banNhap.current = { noiDung, id: newIdempotencyKey() };
      }
      return chatRepo.sendMessage(conversationId, {
        clientMessageId: banNhap.current.id,
        content: noiDung,
        replyToMessageId: null,
        attachmentIntentIds: [],
      });
    },
    onSuccess: () => {
      banNhap.current = null;
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
      void queryClient.invalidateQueries({ queryKey: chatKeys.inbox() });
    },
  });
}

/** Đánh dấu đã đọc tới một `sequence` */
export function useMarkRead(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'always',
    mutationFn: (lastReadSequence: number) => chatRepo.markRead(conversationId, lastReadSequence),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.inbox() });
    },
  });
}

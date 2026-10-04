/**
 * @file useNotifications.ts
 * @description Hook của nhánh thông báo: danh sách, số chưa đọc, đánh dấu đã đọc.
 *
 * Như nhánh chat, app chưa nghe STOMP nên tự tải lại theo chu kỳ khi màn đang
 * được dùng (TanStack chỉ chạy `refetchInterval` khi có người quan sát query).
 * Tham số `thamDoMs` để test truyền `false`.
 */

import type { InfiniteData } from '@tanstack/react-query';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { CursorPageResponse } from '@/core/api/pagination';
import { flattenPages, getNextCursor } from '@/core/api/pagination';
import { notificationRepo } from '@/features/notification/notificationRepo';
import { notificationKeys } from '@/features/notification/queryKeys';
import type { NotificationResponse } from '@/features/notification/types';

/** Chu kỳ tải lại danh sách khi màn Thông báo đang mở */
export const THAM_DO_THONG_BAO_MS = 30_000;

/** Chu kỳ tải lại số chưa đọc cho chuông */
export const THAM_DO_SO_CHUA_DOC_MS = 60_000;

type TrangThongBao = InfiniteData<CursorPageResponse<NotificationResponse>, string | null>;

export function useNotifications(thamDoMs: number | false = THAM_DO_THONG_BAO_MS) {
  const query = useInfiniteQuery({
    queryKey: notificationKeys.list(),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => notificationRepo.getNotifications(pageParam),
    getNextPageParam: (trang) => getNextCursor(trang) ?? null,
    refetchInterval: thamDoMs,
  });

  const thongBao = useMemo(() => flattenPages(query.data?.pages), [query.data]);
  const coChuaDoc = useMemo(() => thongBao.some((n) => !n.read), [thongBao]);

  return { ...query, thongBao, coChuaDoc };
}

/** Số thông báo chưa đọc — nguồn của chấm báo trên chuông */
export function useUnreadNotificationCount(thamDoMs: number | false = THAM_DO_SO_CHUA_DOC_MS) {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationRepo.getUnreadCount(),
    refetchInterval: thamDoMs,
  });
}

/** Ghi `read: true` vào bản đệm, cho một id hoặc cho tất cả (`id === null`) */
function danhDauTrongDem(du: TrangThongBao | undefined, id: string | null): TrangThongBao | undefined {
  if (!du) {
    return du;
  }
  return {
    ...du,
    pages: du.pages.map((trang) => ({
      ...trang,
      items: trang.items.map((n) => (id === null || n.notificationId === id ? { ...n, read: true } : n)),
    })),
  };
}

/**
 * Đánh dấu một thông báo đã đọc. Cập nhật bản đệm NGAY khi thành công để dòng
 * hết đậm mà không phải chờ lần tải lại, rồi mới làm mới số chưa đọc.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: (notificationId: string) => notificationRepo.markRead(notificationId),
    onSuccess: (_kq, notificationId) => {
      queryClient.setQueryData<TrangThongBao>(notificationKeys.list(), (du) => danhDauTrongDem(du, notificationId));
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: () => notificationRepo.markAllRead(),
    onSuccess: () => {
      queryClient.setQueryData<TrangThongBao>(notificationKeys.list(), (du) => danhDauTrongDem(du, null));
      queryClient.setQueryData(notificationKeys.unreadCount(), { unreadCount: 0 });
    },
  });
}

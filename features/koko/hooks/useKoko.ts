/**
 * @file useKoko.ts
 * @description Trạng thái hội thoại với Koko và thao tác gửi.
 *
 * Hội thoại sống trong bộ đệm TanStack Query (`gcTime: Infinity`) chứ không trong
 * `useState`: rời màn rồi quay lại vẫn thấy cuộc trò chuyện đang dở, và đăng xuất
 * (`queryClient.clear()`) là nó biến mất cùng mọi dữ liệu khác của tài khoản —
 * tài khoản sau dùng chung máy không đọc được.
 *
 * Câu trả lời được ghi vào hội thoại ở callback CẤP HOOK của `useMutation`, không
 * phải callback của `mutate()`: người dùng rời màn giữa lúc Koko đang nghĩ thì
 * callback của `mutate()` không bao giờ chạy và câu trả lời rơi mất.
 */

import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { coTheGuiLai, lichSuGui, taoIdTin, thongDiepLoiKoko, TOI_DA_KY_TU } from '@/features/koko/hoiThoaiKoko';
import { kokoRepo } from '@/features/koko/kokoRepo';
import { kokoKeys } from '@/features/koko/queryKeys';
import type { KokoMessage, TinKoko } from '@/features/koko/types';

interface BienGui {
  /** Tin của người dùng mà lượt này trả lời — để gắn lỗi đúng chỗ */
  idTin: string;
  lichSu: KokoMessage[];
}

export function useKoko() {
  const queryClient = useQueryClient();
  const khoa = kokoKeys.hoiThoai();

  const hoiThoai = useQuery({
    queryKey: khoa,
    // Không có gì để tải: trả lại đúng thứ đang có, để một lần invalidate lạc
    // (hay refetch khi có mạng lại) không xoá trắng cuộc trò chuyện.
    queryFn: () => queryClient.getQueryData<TinKoko[]>(khoa) ?? [],
    initialData: [] as TinKoko[],
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const tin = hoiThoai.data;

  const ghi = useCallback(
    (doi: (truoc: TinKoko[]) => TinKoko[]) => {
      queryClient.setQueryData<TinKoko[]>(khoa, (truoc) => doi(truoc ?? []));
    },
    // `khoa` là mảng hằng tạo mới mỗi lần render; nội dung không đổi.
    [queryClient],
  );

  const guiMutation = useMutation({
    mutationKey: kokoKeys.gui(),
    networkMode: 'always',
    mutationFn: ({ lichSu }: BienGui) => kokoRepo.chat(lichSu),
    onSuccess: (traLoi, { idTin }) => {
      ghi((truoc) =>
        // Hội thoại đã bị "Bắt đầu lại" trong lúc chờ: câu trả lời thuộc về một
        // cuộc trò chuyện không còn nữa — bỏ.
        truoc.some((t) => t.id === idTin)
          ? [
              ...truoc,
              { id: taoIdTin(), vaiTro: 'assistant', noiDung: traLoi.content ?? '', nguon: traLoi.sourcesUsed ?? [] },
            ]
          : truoc,
      );
    },
    onError: (loi, { idTin }) => {
      const thongDiep = thongDiepLoiKoko(loi);
      ghi((truoc) => truoc.map((t) => (t.id === idTin ? { ...t, loi: thongDiep } : t)));
    },
  });

  // Đếm theo khoá chứ không đọc `guiMutation.isPending`: mount lại màn trong lúc
  // Koko đang nghĩ thì `useMutation` mới không biết gì về lượt cũ.
  const dangTraLoi = useIsMutating({ mutationKey: kokoKeys.gui() }) > 0;

  const gui = useCallback(
    (noiDung: string): boolean => {
      const gon = noiDung.trim();
      if (gon.length === 0 || gon.length > TOI_DA_KY_TU || dangTraLoi) {
        return false;
      }
      const moi: TinKoko = { id: taoIdTin(), vaiTro: 'user', noiDung: gon };
      const sau = [...(queryClient.getQueryData<TinKoko[]>(khoa) ?? []), moi];
      queryClient.setQueryData<TinKoko[]>(khoa, sau);
      guiMutation.mutate({ idTin: moi.id, lichSu: lichSuGui(sau) });
      return true;
    },
    [dangTraLoi, guiMutation, queryClient],
  );

  const guiLai = useCallback(
    (idTin: string) => {
      const hienTai = queryClient.getQueryData<TinKoko[]>(khoa) ?? [];
      if (dangTraLoi || !coTheGuiLai(hienTai, idTin)) {
        return;
      }
      const sau = hienTai.map((t) => (t.id === idTin ? { ...t, loi: null } : t));
      queryClient.setQueryData<TinKoko[]>(khoa, sau);
      guiMutation.mutate({ idTin, lichSu: lichSuGui(sau) });
    },
    [dangTraLoi, guiMutation, queryClient],
  );

  const batDauLai = useCallback(() => {
    queryClient.setQueryData<TinKoko[]>(khoa, []);
  }, [queryClient]);

  return { tin, dangTraLoi, gui, guiLai, batDauLai };
}

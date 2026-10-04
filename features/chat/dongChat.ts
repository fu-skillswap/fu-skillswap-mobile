/**
 * @file dongChat.ts
 * @description Dựng các dòng hiển thị của khung chat từ danh sách tin đã sắp.
 * Tách khỏi `ChatScreen.tsx` để test được mà không kéo theo cả cây màn hình.
 */

import { khoaNgay, nhanNgayTinNhan } from '@/features/chat/thoiGian';
import type { MessageResponse } from '@/features/chat/types';

/** Một dòng trong danh sách: tin nhắn hoặc nhãn ngày */
export type DongChat =
  | { kieu: 'ngay'; khoa: string; nhan: string }
  | { kieu: 'tin'; khoa: string; tin: MessageResponse; hienGio: boolean; daXem: boolean };

/**
 * Dựng các dòng hiển thị từ tin đã sắp: chèn nhãn ngày khi sang ngày mới, hiện
 * giờ ở tin CUỐI của một chuỗi cùng người gửi, và "Đã xem" ở tin cuối của mình.
 */
export function dungDongChat(tin: readonly MessageResponse[], bayGioMs?: number): DongChat[] {
  const dong: DongChat[] = [];
  let ngayTruoc: string | null = null;
  const cuoiCuaMinh = [...tin].reverse().find((t) => t.isMine);

  tin.forEach((t, i) => {
    const ngay = khoaNgay(t.createdAt);
    if (ngay && ngay !== ngayTruoc) {
      dong.push({ kieu: 'ngay', khoa: `ngay-${ngay}`, nhan: nhanNgayTinNhan(t.createdAt, bayGioMs) ?? ngay });
      ngayTruoc = ngay;
    }
    const sau = tin[i + 1];
    const hienGio = !sau || sau.isMine !== t.isMine || khoaNgay(sau.createdAt) !== ngay || sau.messageType === 'SYSTEM';
    dong.push({
      kieu: 'tin',
      khoa: t.id,
      tin: t,
      hienGio,
      daXem: t.id === cuoiCuaMinh?.id && t.isReadByOther === true,
    });
  });

  return dong;
}


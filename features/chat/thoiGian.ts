/**
 * @file thoiGian.ts
 * @description Hiển thị mốc `Instant` (UTC, hậu tố `Z`) của nhánh chat theo giờ
 * Việt Nam.
 *
 * Chat không như booking: backend gửi `Instant` chứ không gửi `OffsetDateTime`
 * đã đổi sang `+07:00`. `dinhDangGio()` của `core/time/offsetDateTime.ts` in lại
 * ĐÚNG mặt đồng hồ của chuỗi, nên đưa `"…T14:04:00Z"` vào đó sẽ ra "14:04" trong
 * khi người dùng ở Việt Nam nhận tin lúc 21:04. Ở đây đổi sang UTC+7 trước rồi
 * mới in — cố định múi kinh doanh, không theo múi của máy (máy UTC hay CI vẫn ra
 * cùng một chuỗi).
 */

import { docOffsetDateTime } from '@/core/time/offsetDateTime';

const LECH_VN_MS = 7 * 3_600_000;
const MOT_NGAY_MS = 86_400_000;
const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

function hai(so: number): string {
  return String(so).padStart(2, '0');
}

/** Mặt đồng hồ giờ Việt Nam của một thời điểm; `null` khi chuỗi không đọc được */
function mocVN(wire: string | null | undefined): Date | null {
  const moc = docOffsetDateTime(wire);
  return moc ? new Date(moc.mocMs + LECH_VN_MS) : null;
}

/** Số ngày lịch (giờ Việt Nam) kể từ epoch */
function soNgay(d: Date): number {
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / MOT_NGAY_MS);
}

/** Giờ phút của một tin nhắn: `"21:04"` */
export function gioTinNhan(wire: string | null | undefined): string | null {
  const d = mocVN(wire);
  return d ? `${hai(d.getUTCHours())}:${hai(d.getUTCMinutes())}` : null;
}

/**
 * Nhãn thời gian ở danh sách hội thoại, đúng thiết kế: hôm nay thì `"21:04"`,
 * trong 6 ngày gần đây thì thứ (`"T2"`), xa hơn thì `"21/09"` (kèm năm nếu khác
 * năm hiện tại).
 */
export function nhanThoiGianHoiThoai(
  wire: string | null | undefined,
  bayGioMs: number = Date.now(),
): string | null {
  const d = mocVN(wire);
  if (!d) {
    return null;
  }
  const bayGio = new Date(bayGioMs + LECH_VN_MS);
  const lech = soNgay(bayGio) - soNgay(d);
  if (lech <= 0) {
    return `${hai(d.getUTCHours())}:${hai(d.getUTCMinutes())}`;
  }
  if (lech < 7) {
    return THU[d.getUTCDay()];
  }
  const ngayThang = `${hai(d.getUTCDate())}/${hai(d.getUTCMonth() + 1)}`;
  return d.getUTCFullYear() === bayGio.getUTCFullYear() ? ngayThang : `${ngayThang}/${d.getUTCFullYear()}`;
}

/** Nhãn ngăn cách theo ngày trong khung chat: `"Hôm nay"`, `"Hôm qua"`, `"T3, 06/10"` */
export function nhanNgayTinNhan(
  wire: string | null | undefined,
  bayGioMs: number = Date.now(),
): string | null {
  const d = mocVN(wire);
  if (!d) {
    return null;
  }
  const lech = soNgay(new Date(bayGioMs + LECH_VN_MS)) - soNgay(d);
  if (lech === 0) {
    return 'Hôm nay';
  }
  if (lech === 1) {
    return 'Hôm qua';
  }
  return `${THU[d.getUTCDay()]}, ${hai(d.getUTCDate())}/${hai(d.getUTCMonth() + 1)}`;
}

/** Khoá ngày (giờ Việt Nam) để nhóm tin nhắn: `"2026-10-04"` */
export function khoaNgay(wire: string | null | undefined): string | null {
  const d = mocVN(wire);
  return d ? `${d.getUTCFullYear()}-${hai(d.getUTCMonth() + 1)}-${hai(d.getUTCDate())}` : null;
}

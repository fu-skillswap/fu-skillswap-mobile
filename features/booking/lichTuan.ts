/**
 * @file lichTuan.ts
 * @description Hàm thuần cho màn chọn lịch (`Booking.dc.html`): dải 7 ngày của
 * một tuần, gom lịch rảnh của mentor theo ngày, và nhãn giờ.
 *
 * ## Vì sao tự tính ngày theo giờ Việt Nam thay vì dùng `Date` địa phương
 *
 * Lịch rảnh lên dây là `LocalDateTime` theo múi `Asia/Ho_Chi_Minh` (UTC+7, không
 * có giờ mùa hè). "Hôm nay" và "thứ Hai tuần này" phải tính trong CHÍNH múi đó,
 * không trong múi của máy: điện thoại để UTC (hoặc CI) sẽ thấy 06:00 sáng thứ
 * Hai giờ Việt Nam là 23:00 Chủ nhật, và cả dải ngày lệch đi một tuần. Cùng lý
 * do với `nhanNgayNgan()` của `core/time/offsetDateTime.ts`.
 */

import { docLocalDateTime } from '@/core/time/localDateTime';
import type { MentorAvailabilitySlotResponse } from '@/features/booking/types';

/** Lệch của múi giờ kinh doanh so với UTC, tính bằng phút (UTC+7) */
const LECH_VN_PHUT = 7 * 60;

const MOT_NGAY_MS = 24 * 60 * 60_000;

/** Nhãn thứ ngắn đúng thiết kế, bắt đầu từ thứ Hai */
const NHAN_THU = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

/** Tên thứ đầy đủ, cho trình đọc màn hình và tiêu đề ngày */
const TEN_THU = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'] as const;

/** Một ngày lịch (không giờ), số tháng tính từ 1 */
export interface NgayLich {
  nam: number;
  thang: number;
  ngay: number;
}

/** Một ô trong dải 7 ngày */
export interface OTrongTuan extends NgayLich {
  /** `"2026-10-05"` — khoá so khớp, cũng là khuôn `LocalDate` backend nhận */
  iso: string;
  /** `"T2"` … `"CN"` */
  nhanThu: string;
  /** `"Thứ Hai"` … `"Chủ Nhật"` */
  tenThu: string;
}

function hai(so: number): string {
  return String(so).padStart(2, '0');
}

/** `{2026, 10, 5}` → `"2026-10-05"` */
export function isoNgay({ nam, thang, ngay }: NgayLich): string {
  return `${nam}-${hai(thang)}-${hai(ngay)}`;
}

/** Số ngày kể từ epoch của một ngày lịch — để cộng trừ ngày không vướng múi giờ */
function soNgayEpoch({ nam, thang, ngay }: NgayLich): number {
  return Math.round(Date.UTC(nam, thang - 1, ngay) / MOT_NGAY_MS);
}

function tuSoNgayEpoch(so: number): NgayLich {
  const d = new Date(so * MOT_NGAY_MS);
  return { nam: d.getUTCFullYear(), thang: d.getUTCMonth() + 1, ngay: d.getUTCDate() };
}

/** Cộng (hoặc trừ, nếu âm) một số ngày */
export function congNgay(ngay: NgayLich, soNgay: number): NgayLich {
  return tuSoNgayEpoch(soNgayEpoch(ngay) + soNgay);
}

/** Ngày hôm nay theo giờ Việt Nam. `bayGioMs` là tham số để test không phụ thuộc đồng hồ thật. */
export function homNayVN(bayGioMs: number = Date.now()): NgayLich {
  const d = new Date(bayGioMs + LECH_VN_PHUT * 60_000);
  return { nam: d.getUTCFullYear(), thang: d.getUTCMonth() + 1, ngay: d.getUTCDate() };
}

/** Chỉ số thứ trong tuần: 0 = thứ Hai … 6 = Chủ nhật */
function chiSoThu(ngay: NgayLich): number {
  // 1970-01-01 là thứ Năm (chỉ số 3 nếu thứ Hai là 0).
  return (((soNgayEpoch(ngay) + 3) % 7) + 7) % 7;
}

/** Thứ Hai của tuần chứa `ngay` */
export function dauTuan(ngay: NgayLich): NgayLich {
  return congNgay(ngay, -chiSoThu(ngay));
}

/** Bảy ô từ thứ Hai tới Chủ nhật, bắt đầu từ `thuHai` */
export function cacNgayTrongTuan(thuHai: NgayLich): OTrongTuan[] {
  return NHAN_THU.map((nhanThu, i) => {
    const ngay = congNgay(thuHai, i);
    return { ...ngay, iso: isoNgay(ngay), nhanThu, tenThu: TEN_THU[i] };
  });
}

/** `"Tháng 10, 2026"` — tiêu đề tháng của tuần, theo ngày thứ Hai */
export function nhanThang(ngay: NgayLich): string {
  return `Tháng ${ngay.thang}, ${ngay.nam}`;
}

/**
 * Gom parent slot theo ngày bắt đầu, CHỈ giữ slot có gắn `serviceId`.
 *
 * Slot có chuỗi giờ không đọc được bị bỏ qua: đặt nó vào một ngày đoán mò còn
 * tệ hơn là không hiện. Slot trong mỗi ngày được sắp theo giờ bắt đầu.
 */
export function nhomSlotTheoNgay(
  slots: readonly MentorAvailabilitySlotResponse[],
  serviceId: string,
): Map<string, MentorAvailabilitySlotResponse[]> {
  const theoNgay = new Map<string, MentorAvailabilitySlotResponse[]>();

  for (const slot of slots) {
    if (!slot.services.some((dv) => dv.serviceId === serviceId)) {
      continue;
    }
    const moc = docLocalDateTime(slot.startTime);
    if (!moc) {
      continue;
    }
    const khoa = isoNgay(moc);
    const danhSach = theoNgay.get(khoa) ?? [];
    danhSach.push(slot);
    theoNgay.set(khoa, danhSach);
  }

  for (const danhSach of theoNgay.values()) {
    danhSach.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return theoNgay;
}

/** `"2026-10-06T19:00:00"` → `"19:00"`; `null` khi không đọc được */
export function nhanGio(localDateTime: string | null | undefined): string | null {
  const moc = docLocalDateTime(localDateTime);
  return moc ? `${hai(moc.gio)}:${hai(moc.phut)}` : null;
}

/** `"2026-10-06T19:00:00"` → `"T3, 06/10"`; `null` khi không đọc được */
export function nhanNgayCoThu(localDateTime: string | null | undefined): string | null {
  const moc = docLocalDateTime(localDateTime);
  if (!moc) {
    return null;
  }
  return `${NHAN_THU[chiSoThu(moc)]}, ${hai(moc.ngay)}/${hai(moc.thang)}`;
}

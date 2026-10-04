/**
 * @file lichTuan.ts
 * @description Hàm thuần riêng của màn chọn lịch (`Booking.dc.html`): gom lịch
 * rảnh của mentor theo ngày và nhãn giờ. Phần lịch tuần chung nằm ở
 * `core/time/lichTuan.ts` và được xuất lại ở đây cho tiện.
 */

import { docLocalDateTime } from '@/core/time/localDateTime';
import { chiSoThu, isoNgay } from '@/core/time/lichTuan';
import type { MentorAvailabilitySlotResponse } from '@/features/booking/types';

export {
  cacNgayTrongTuan,
  congNgay,
  dauTuan,
  homNayVN,
  isoNgay,
  nhanThang,
} from '@/core/time/lichTuan';
export type { NgayLich, OTrongTuan } from '@/core/time/lichTuan';

const NHAN_THU = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

function hai(so: number): string {
  return String(so).padStart(2, '0');
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

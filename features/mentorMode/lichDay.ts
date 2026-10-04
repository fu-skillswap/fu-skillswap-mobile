/**
 * @file lichDay.ts
 * @description Đổi qua lại giữa `Instant` (UTC) của slot phía mentor và giờ Việt
 * Nam để hiển thị/nhập.
 *
 * Slot phía mentor (`MentorManagedAvailabilitySlotResponse`) lên dây là
 * `Instant` có `Z`, và tạo slot cũng gửi `Instant`. Mentor thì nghĩ và nhập theo
 * giờ Việt Nam. Mọi phép đổi ở đây cố định UTC+7 (Việt Nam không có giờ mùa hè),
 * không dựa vào múi giờ của máy.
 */

import { docOffsetDateTime } from '@/core/time/offsetDateTime';
import type { NgayLich } from '@/core/time/lichTuan';
import type { MentorManagedSlotResponse } from '@/features/mentorMode/types';

const LECH_VN_MS = 7 * 3_600_000;

function hai(so: number): string {
  return String(so).padStart(2, '0');
}

/** Mặt đồng hồ giờ Việt Nam của một `Instant`; `null` khi chuỗi hỏng */
function vn(wire: string | null | undefined): Date | null {
  const moc = docOffsetDateTime(wire);
  return moc ? new Date(moc.mocMs + LECH_VN_MS) : null;
}

/** `"2026-10-06T12:00:00Z"` → `"2026-10-06"` (ngày giờ Việt Nam) */
export function ngayVN(wire: string | null | undefined): string | null {
  const d = vn(wire);
  return d ? `${d.getUTCFullYear()}-${hai(d.getUTCMonth() + 1)}-${hai(d.getUTCDate())}` : null;
}

/** `"2026-10-06T12:00:00Z"` → `"19:00"` */
export function gioVN(wire: string | null | undefined): string | null {
  const d = vn(wire);
  return d ? `${hai(d.getUTCHours())}:${hai(d.getUTCMinutes())}` : null;
}

/** Khuôn `"HH:mm"` 24 giờ */
const KHUON_GIO = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `{2026,10,6}` + `"19:00"` (giờ Việt Nam) → `"2026-10-06T12:00:00Z"`; `null` khi giờ sai khuôn */
export function instantTuGioVN(ngay: NgayLich, gio: string): string | null {
  const khop = KHUON_GIO.exec(gio.trim());
  if (!khop) {
    return null;
  }
  const ms = Date.UTC(ngay.nam, ngay.thang - 1, ngay.ngay, Number(khop[1]), Number(khop[2])) - LECH_VN_MS;
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Gom slot theo ngày giờ Việt Nam, mỗi ngày sắp theo giờ bắt đầu */
export function nhomSlotMentorTheoNgay(
  slots: readonly MentorManagedSlotResponse[],
): Map<string, MentorManagedSlotResponse[]> {
  const theoNgay = new Map<string, MentorManagedSlotResponse[]>();
  for (const slot of slots) {
    const khoa = ngayVN(slot.startAt);
    if (!khoa) {
      continue;
    }
    theoNgay.set(khoa, [...(theoNgay.get(khoa) ?? []), slot]);
  }
  for (const ds of theoNgay.values()) {
    ds.sort((a, b) => a.startAt.localeCompare(b.startAt));
  }
  return theoNgay;
}

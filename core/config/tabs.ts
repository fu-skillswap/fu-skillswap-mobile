/**
 * @file tabs.ts
 * @description Bảng tab của app. Thêm feature mới ở các giai đoạn sau chỉ cần
 * thêm một dòng vào mảng TABS — đây là lý do file này nằm ở `core/config`
 * và không biết gì về nội dung từng feature.
 *
 * Thiết kế có HAI thanh tab tuỳ vai trò (mục 3 của `docs/quy-uoc-dung-giao-dien.md`):
 * Mentee là Bảng tin · Mentor · Lịch hẹn · Tin nhắn · Hồ sơ, còn Mentor là Tổng
 * quan · Booking · Lịch dạy · Ví · Thêm. Giai đoạn này CHỈ dựng thanh Mentee, nên
 * `resolveTabs()` vẫn trả về một bảng duy nhất; `resolveRoleModes()` đã có sẵn để
 * khi dựng thanh Mentor thì chỗ rẽ nhánh nằm đúng ở đây.
 */

import type { BackendRole } from '@/core/auth/types';

/**
 * Tên icon Lucide của một tab, viết kebab-case đúng như `Main.dc.html` dòng
 * 105–109. Là một union chứ không phải `string`: bảng ánh xạ sang component ở
 * `app/(tabs)/_layout.tsx` khai `Record<TabIconName, …>`, nên thêm một tab mà
 * quên nối icon là lỗi đỏ của `tsc` chứ không phải một tab trống trên máy thật.
 */
export type TabIconName = 'home' | 'search' | 'calendar-days' | 'message-square' | 'user';

/** Một tab trên thanh điều hướng dưới cùng */
export interface TabConfig {
  /** Tên route trong thư mục app/(tabs) */
  name: string;
  /** Nhãn hiển thị */
  title: string;
  /** Tên icon Lucide */
  icon: TabIconName;
}

/** Vai trò mà giao diện mobile phục vụ */
export type AppRoleMode = 'MENTEE' | 'MENTOR';

/**
 * Thanh tab của Mentee, đúng thứ tự và đúng icon trong `Main.dc.html`.
 *
 * Koko (trợ lý AI) KHÔNG còn là tab: thiết kế chuyển nó thành một card trên Bảng
 * tin dẫn sang màn `KokoChat` — một màn hình repo chưa có.
 */
const TABS: TabConfig[] = [
  { name: 'index', title: 'Bảng tin', icon: 'home' },
  { name: 'mentors', title: 'Mentor', icon: 'search' },
  { name: 'bookings', title: 'Lịch hẹn', icon: 'calendar-days' },
  { name: 'messages', title: 'Tin nhắn', icon: 'message-square' },
  { name: 'profile', title: 'Hồ sơ', icon: 'user' },
];

/** Tài khoản chỉ có quyền quản trị thì không dùng được app mobile */
export function isMobileSupportedAccount(roles: BackendRole[]): boolean {
  return roles.some((role) => role === 'MENTEE' || role === 'MENTOR');
}

/** Danh sách tab cho một bộ vai trò */
export function resolveTabs(roles: BackendRole[]): TabConfig[] {
  return isMobileSupportedAccount(roles) ? TABS : [];
}

/**
 * Các chế độ vai trò mà người dùng này có.
 * Có hai phần tử nghĩa là tab Đặt lịch và tab Lịch phải hiện segmented control.
 */
export function resolveRoleModes(roles: BackendRole[]): AppRoleMode[] {
  const modes: AppRoleMode[] = [];
  if (roles.includes('MENTEE')) {
    modes.push('MENTEE');
  }
  if (roles.includes('MENTOR')) {
    modes.push('MENTOR');
  }
  return modes;
}

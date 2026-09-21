/**
 * @file tabs.ts
 * @description Bảng tab của app. Thêm feature mới ở các giai đoạn sau chỉ cần
 * thêm một dòng vào mảng TABS — đây là lý do file này nằm ở `core/config`
 * và không biết gì về nội dung từng feature.
 */

import type { BackendRole } from '@/core/auth/types';

/** Một tab trên thanh điều hướng dưới cùng */
export interface TabConfig {
  /** Tên route trong thư mục app/(tabs) */
  name: string;
  /** Nhãn hiển thị */
  title: string;
  /** Tên icon Ionicons */
  icon: string;
}

/** Vai trò mà giao diện mobile phục vụ */
export type AppRoleMode = 'MENTEE' | 'MENTOR';

const TABS: TabConfig[] = [
  { name: 'index', title: 'Diễn đàn', icon: 'chatbubbles-outline' },
  { name: 'booking', title: 'Đặt lịch', icon: 'calendar-outline' },
  { name: 'schedule', title: 'Lịch', icon: 'time-outline' },
  { name: 'assistant', title: 'Trợ lý', icon: 'sparkles-outline' },
  { name: 'profile', title: 'Hồ sơ', icon: 'person-outline' },
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

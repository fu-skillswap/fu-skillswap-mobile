/**
 * @file tabs.ts
 * @description Bảng tab của app. Thêm feature mới ở các giai đoạn sau chỉ cần
 * thêm một dòng vào mảng tab tương ứng — đây là lý do file này nằm ở
 * `core/config` và không biết gì về nội dung từng feature.
 *
 * Thiết kế có HAI thanh tab tuỳ vai trò (mục 3 của `docs/quy-uoc-dung-giao-dien.md`):
 * Mentee là Bảng tin · Mentor · Lịch hẹn · Tin nhắn · Hồ sơ, còn Mentor là Tổng
 * quan · Booking · Lịch dạy · Ví · Thêm.
 *
 * ## Vì sao `resolveTabs()` nhận THÊM một chế độ
 *
 * Trước đây hàm này trả về đúng MỘT bảng (của Mentee) cho mọi vai trò, nên một
 * tài khoản chỉ có vai trò MENTOR vẫn thấy thanh tab của Mentee và không có
 * đường nào vào phần mentor — chính lỗi người dùng báo ("không xem được các tab
 * của mentor"). Vai trò KHÔNG đủ để quyết định thanh tab: một người vừa là
 * mentee vừa là mentor có cả hai thanh và tự chọn đang xem thanh nào, lựa chọn
 * đó sống trong `core/roleMode/`.
 *
 * Hàm vẫn tự phòng vệ: `cheDo` không thuộc bộ vai trò của tài khoản thì bị bỏ
 * qua và dùng chế độ đầu tiên mà tài khoản thật sự có. Nhờ vậy "thanh tab rỗng"
 * là một trạng thái KHÔNG tới được, kể cả khi chỗ gọi truyền sai.
 */

import type { BackendRole } from '@/core/auth/types';

/**
 * Tên icon Lucide của một tab, viết kebab-case đúng như `Main.dc.html` dòng
 * 105–109 (Mentee) và `<nav aria-label="Điều hướng mentor">` của
 * `MentorDashboard.dc.html` (Mentor). Là một union chứ không phải `string`:
 * bảng ánh xạ sang component ở `app/(tabs)/_layout.tsx` khai
 * `Record<TabIconName, …>`, nên thêm một tab mà quên nối icon là lỗi đỏ của
 * `tsc` chứ không phải một tab trống trên máy thật.
 */
export type TabIconName =
  | 'home'
  | 'search'
  | 'calendar-days'
  | 'message-square'
  | 'user'
  | 'layout-dashboard'
  | 'clipboard-list'
  | 'wallet'
  | 'menu';

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
const TABS_MENTEE: TabConfig[] = [
  { name: 'index', title: 'Bảng tin', icon: 'home' },
  { name: 'mentors', title: 'Mentor', icon: 'search' },
  { name: 'bookings', title: 'Lịch hẹn', icon: 'calendar-days' },
  { name: 'messages', title: 'Tin nhắn', icon: 'message-square' },
  { name: 'profile', title: 'Hồ sơ', icon: 'user' },
];

/**
 * Thanh tab của Mentor, đúng thứ tự và đúng icon trong
 * `<nav aria-label="Điều hướng mentor">` (có ở cả 5 màn mentor của thiết kế).
 *
 * Icon lấy từ hình SVG trong thiết kế, không từ tên nhãn: ô "Tổng quan" là bốn
 * khối chữ nhật (`layout-dashboard`), "Booking" là bảng kẹp có dòng kẻ
 * (`clipboard-list`), "Lịch dạy" dùng ĐÚNG icon lịch của thanh Mentee
 * (`calendar-days`), "Ví" là `wallet`, "Thêm" là ba vạch ngang (`menu`).
 *
 * `mentor-schedule` và `mentor-wallet` là vỏ rỗng trong đợt này — xem JSDoc của
 * hai file route đó. Chúng vẫn có mặt ở đây vì thanh tab thiếu mục sẽ làm người
 * dùng tưởng app mất chức năng, còn một tab nói thẳng "đang hoàn thiện" thì
 * không nói sai điều gì.
 */
const TABS_MENTOR: TabConfig[] = [
  { name: 'mentor-dashboard', title: 'Tổng quan', icon: 'layout-dashboard' },
  { name: 'mentor-bookings', title: 'Booking', icon: 'clipboard-list' },
  { name: 'mentor-schedule', title: 'Lịch dạy', icon: 'calendar-days' },
  { name: 'mentor-wallet', title: 'Ví', icon: 'wallet' },
  { name: 'mentor-more', title: 'Thêm', icon: 'menu' },
];

const TABS_THEO_CHE_DO: Record<AppRoleMode, TabConfig[]> = {
  MENTEE: TABS_MENTEE,
  MENTOR: TABS_MENTOR,
};

/** Tài khoản chỉ có quyền quản trị thì không dùng được app mobile */
export function isMobileSupportedAccount(roles: BackendRole[]): boolean {
  return roles.some((role) => role === 'MENTEE' || role === 'MENTOR');
}

/**
 * Các chế độ vai trò mà người dùng này có.
 *
 * Thứ tự có Ý NGHĨA: MENTEE luôn đứng trước MENTOR, nên phần tử đầu tiên chính
 * là chế độ MẶC ĐỊNH của một tài khoản vừa là mentee vừa là mentor (yêu cầu của
 * thiết kế). Đừng sắp lại theo vai trò nhận được từ backend.
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

/**
 * Danh sách tab cho một bộ vai trò, ở một chế độ đang xem.
 *
 * Trả mảng RỖNG chỉ khi tài khoản không dùng được app mobile (ADMIN thuần) —
 * trường hợp đó `app/(tabs)/_layout.tsx` đã điều hướng sang màn "không hỗ trợ"
 * trước khi tới đây.
 *
 * `cheDo` sai (ví dụ máy còn lưu `'MENTOR'` sau khi tài khoản bị gỡ quyền
 * mentor) KHÔNG cho ra thanh tab rỗng: hàm lùi về `resolveRoleModes(roles)[0]`.
 * Chốt chặn chính nằm ở `core/roleMode/roleMode.ts`; đây là lớp thứ hai, vì một
 * thanh tab rỗng là trạng thái người dùng không thoát ra được.
 */
export function resolveTabs(roles: BackendRole[], cheDo?: AppRoleMode): TabConfig[] {
  const cheDoKhaDung = resolveRoleModes(roles);
  const dauTien = cheDoKhaDung[0];
  if (!dauTien) {
    return [];
  }
  const chon = cheDo && cheDoKhaDung.includes(cheDo) ? cheDo : dauTien;
  return TABS_THEO_CHE_DO[chon];
}

/**
 * MỌI tên route tab của cả hai thanh, không trùng lặp.
 *
 * `app/(tabs)/_layout.tsx` phải khai `<Tabs.Screen>` cho tất cả: expo-router
 * đăng ký mọi file trong thư mục `(tabs)/` thành route dù có khai hay không, và
 * route không khai sẽ hiện trong thanh tab với tuỳ chọn mặc định — tức là thanh
 * Mentee sẽ mọc thêm 5 mục mentor không tên. Những mục không thuộc thanh đang
 * xem bị ẩn bằng `options={{ href: null }}`.
 */
export function allTabRouteNames(): string[] {
  return [...TABS_MENTEE, ...TABS_MENTOR].map((tab) => tab.name);
}

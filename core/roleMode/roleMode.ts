/**
 * @file roleMode.ts
 * @description Quy "vai trò backend cấp" + "lựa chọn người dùng đã lưu trên máy"
 * thành MỘT chế độ đang xem. Thuần hàm, không chạm I/O, không chạm React — nhờ
 * vậy luật rơi-về-Mentee có test riêng không cần dựng cây component.
 *
 * ## Vì sao lựa chọn đã lưu KHÔNG được tin
 *
 * Giá trị trong keystore sống lâu hơn vai trò: người dùng từng là mentor, chọn
 * chế độ Mentor, rồi bị admin gỡ quyền (`MentorStatus` về `SUSPENDED`/`REJECTED`
 * hoặc vai trò MENTOR bị thu hồi). Lần mở app sau, `GET /api/auth/me` trả
 * `roles: ['MENTEE']` nhưng máy vẫn nói `'MENTOR'`. Nếu tin lời máy thì:
 *
 * - `resolveTabs()` trả thanh Mentor, người dùng bấm vào tab Tổng quan;
 * - mọi API mentor trả 403 (`@PreAuthorize("hasRole('MENTOR')")` ở
 *   `MentorBookingController`, `WalletController.getMyMentorWallet`);
 * - và không có lối nào quay về thanh Mentee, vì lối đó nằm trong màn
 *   `MentorMore` của chính thanh đang hỏng.
 *
 * Nên lựa chọn đã lưu chỉ được dùng khi nó CÒN nằm trong
 * `resolveRoleModes(roles)`. Ngoài ra thì rơi về phần tử đầu tiên — mà
 * `resolveRoleModes` luôn đặt MENTEE trước, nên "rơi về Mentee" và "mặc định
 * Mentee cho tài khoản hai vai" là cùng một dòng code.
 */

import type { AppRoleMode } from '@/core/config/tabs';
import { resolveRoleModes } from '@/core/config/tabs';
import type { BackendRole } from '@/core/auth/types';

/** Kết quả quy chế độ, kèm lý do để chỗ gọi biết có phải dọn keystore không */
export interface KetQuaQuyCheDo {
  /**
   * Chế độ được phép xem. `null` nghĩa là tài khoản không có vai trò nào mobile
   * phục vụ (ADMIN thuần) — `app/(tabs)/_layout.tsx` xử lý trước khi tới đây.
   */
  cheDo: AppRoleMode | null;
  /** Các chế độ tài khoản này có; hai phần tử nghĩa là phải có lối chuyển qua lại */
  cheDoKhaDung: AppRoleMode[];
  /**
   * `true` khi giá trị đã lưu bị BỎ vì không còn hợp lệ.
   *
   * Chỗ gọi dùng cờ này để xoá giá trị cũ khỏi keystore. Không xoá thì mỗi lần
   * mở app lại tính lại đúng phép lùi này — vô hại về hiển thị, nhưng nếu người
   * dùng được cấp lại quyền mentor thì một lựa chọn họ đã quên từ lâu bỗng sống
   * lại và app mở thẳng vào thanh Mentor.
   */
  daLuuKhongHopLe: boolean;
}

/** Chuỗi đọc từ keystore có phải một `AppRoleMode` hay không */
export function laCheDoHopLe(gia: string | null | undefined): gia is AppRoleMode {
  return gia === 'MENTEE' || gia === 'MENTOR';
}

/**
 * Chế độ đang xem cho một bộ vai trò và một lựa chọn đã lưu.
 *
 * @param roles Vai trò từ `GET /api/auth/me`
 * @param daLuu Chuỗi thô đọc từ keystore; `null` khi máy chưa lưu gì
 */
export function quyCheDoVaiTro(
  roles: BackendRole[],
  daLuu: string | null | undefined,
): KetQuaQuyCheDo {
  const cheDoKhaDung = resolveRoleModes(roles);
  const dauTien = cheDoKhaDung[0] ?? null;

  if (!dauTien) {
    // Tài khoản không dùng được app mobile. Giá trị đã lưu (nếu có) cũng vô
    // nghĩa với tài khoản này, nhưng KHÔNG báo "không hợp lệ" để xoá: màn
    // "không hỗ trợ" là một trạng thái cuối, và xoá ở đây chỉ làm phức tạp thêm
    // một nhánh mà người dùng không đi tiếp được.
    return { cheDo: null, cheDoKhaDung, daLuuKhongHopLe: false };
  }

  // `daLuu == null` là "máy chưa lưu gì", KHÔNG phải "giá trị sai" — lần đầu mở
  // app của mọi người đi qua nhánh này, báo không-hợp-lệ sẽ sinh một lượt ghi
  // keystore vô ích ở mỗi lần khởi động.
  if (daLuu == null || daLuu === '') {
    return { cheDo: dauTien, cheDoKhaDung, daLuuKhongHopLe: false };
  }

  if (laCheDoHopLe(daLuu) && cheDoKhaDung.includes(daLuu)) {
    return { cheDo: daLuu, cheDoKhaDung, daLuuKhongHopLe: false };
  }

  return { cheDo: dauTien, cheDoKhaDung, daLuuKhongHopLe: true };
}

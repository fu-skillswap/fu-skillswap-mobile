/**
 * @file mentorModeRepo.ts
 * @description Hai lời gọi mà chế độ Mentor cần. Không React, không state.
 *
 * ## Phân quyền — hai endpoint này KHÔNG giống nhau
 *
 * - `GET /api/me/mentor-profile` (`MentorProfileController`) mang
 *   `@PreAuthorize("hasAnyRole('MENTEE', 'MENTOR')")`: **mentee cũng gọi được**.
 *   Đó là quyết định có chủ ý của backend (ghi rõ trong comment của controller):
 *   hồ sơ mentor là điều kiện tiên quyết của luồng xác minh nên phải điền được
 *   TRƯỚC khi có vai trò MENTOR. Hồ sơ chưa tồn tại thì trả 200 kèm
 *   `data.exists = false`, KHÔNG phải 404 — đừng xử lý nó như lỗi.
 * - `GET /api/me/mentor-wallet` (`WalletController`) mang
 *   `@PreAuthorize("hasRole('MENTOR')")`: mentee gọi sẽ nhận **403**. Màn hình
 *   chỉ được gọi nó khi đang ở chế độ Mentor.
 *
 * Cả hai đều `ensureAuthenticated(principal)` nên bắt buộc đăng nhập. Các tab
 * mentor nằm sau gate của `(tabs)` nên luôn có token, nhưng đừng dựa vào điều đó
 * ở tầng này.
 *
 * ## Vì sao KHÔNG có lời gọi danh sách booking ở đây
 *
 * `MentorBookingController` (`/api/mentor/bookings`) **không có endpoint GET nào**
 * — chỉ accept/reject/cancel/complete/meeting-link. Danh sách booking phía mentor
 * đi qua ĐÚNG endpoint của mentee, `GET /api/me/bookings`, với `role=MENTOR`
 * (`BookingListRequest.role`, `BookingQueryService.getMyBookings` nhánh
 * `case MENTOR`). Vì vậy nó thuộc `features/booking` và chế độ Mentor dùng lại
 * qua barrel của feature đó, không dựng bản thứ hai ở đây.
 */

import { apiClient } from '@/core/api/client';
import type { MentorProfileResponse, MentorWalletResponse } from '@/features/mentorMode/types';

export const mentorModeRepo = {
  /**
   * Hồ sơ mentor của chính mình.
   *
   * Trả 200 kèm `exists: false` khi chưa có hồ sơ — xem JSDoc đầu file.
   */
  getMyMentorProfile() {
    return apiClient<MentorProfileResponse>('/api/me/mentor-profile');
  },

  /**
   * Ví settlement của mentor: số dư khả dụng + 15 giao dịch gần nhất.
   *
   * KHÔNG có endpoint nạp tiền nào ở nhánh này, và mục 4.1 của quy ước cấm dựng
   * lối nạp trên mobile — repo này chỉ đọc.
   */
  getMyMentorWallet() {
    return apiClient<MentorWalletResponse>('/api/me/mentor-wallet');
  },
};

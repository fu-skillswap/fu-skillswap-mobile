/**
 * @file queryKeys.ts
 * @description Khoá query nhánh booking, gom một chỗ để invalidate không bị lệch.
 */

import type { BoLocLichHen } from '@/features/booking/bookingRepo';

export const bookingKeys = {
  all: ['booking'] as const,
  /**
   * Tiền tố chung của MỌI danh sách lịch hẹn.
   *
   * Mỗi tab là một entry cache riêng (khoá mang `status` khác nhau), và sau khi
   * hủy một booking thì tab "Tất cả" lẫn tab trạng thái cũ đều không còn đúng —
   * nên việc invalidate phải khớp theo TIỀN TỐ này, không theo một khoá cụ thể.
   */
  listsAll: () => [...bookingKeys.all, 'list'] as const,
  /**
   * Khoá một danh sách lịch hẹn.
   *
   * KHÔNG nhận `page` — xem JSDoc của `BoLocLichHen` ở `bookingRepo.ts`.
   */
  list: (filters: BoLocLichHen) => [...bookingKeys.listsAll(), filters] as const,
  detail: (bookingId: string) => [...bookingKeys.all, 'detail', bookingId] as const,
  /**
   * Tiền tố chung của mọi phép ĐẾM booking.
   *
   * Tách khỏi `listsAll()` có chủ ý: một phép đếm xin `size=1` và chỉ đọc
   * `totalElements`, nên nếu nó nằm dưới cùng tiền tố với danh sách thì
   * `flattenOffsetPages` của màn hình danh sách sẽ có cơ hội đọc một entry cache
   * chỉ có 1 phần tử và hiện đúng một thẻ. Việc invalidate sau khi ghi vẫn phải
   * chạm CẢ HAI tiền tố — xem `useCheckInBooking`.
   */
  countsAll: () => [...bookingKeys.all, 'count'] as const,
  /** Số lượng booking khớp một bộ lọc (đọc `totalElements`, không đọc `content`) */
  count: (filters: BoLocLichHen) => [...bookingKeys.countsAll(), filters] as const,
};

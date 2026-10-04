/**
 * @file bookingStatus.ts
 * @description Quy một booking về MỘT nhãn trạng thái và một tone màu.
 *
 * ## Vì sao không map thẳng từ một enum duy nhất
 *
 * `HANDOFF.md` mục 4 liệt kê 8 nhãn: Đang chờ · Đang diễn ra · Đã hoàn thành ·
 * Vắng mặt · Bị từ chối · Quá hạn · Mentee hủy · Mentor hủy. Đối chiếu với source
 * Java thì **không enum nào chứa cả 8** — chúng đến từ BA trường khác nhau của
 * `BookingResponse`:
 *
 * - 6 nhãn nằm trong `bookingStatus` (`BookingLifecycleStatus`).
 * - **"Đang diễn ra"** KHÔNG có trong `BookingLifecycleStatus` lẫn `BookingStatus`.
 *   Nó là `displayState === 'IN_SESSION'`, do
 *   `BookingResponseMapper.deriveDisplayGuidance()` tính từ
 *   `selectedStartTime`/`selectedEndTime` so với giờ server. Tự tính lại bằng
 *   `Date.now()` của máy sẽ lệch với backend ở mọi máy lệch giờ.
 * - **"Vắng mặt"** cũng không có trong enum trạng thái. Nó là
 *   `completionOutcome === 'NO_SHOW_MENTEE' | 'NO_SHOW_MENTOR'`.
 *
 * Và `BookingLifecycleStatus` có 4 giá trị mà HANDOFF **không liệt kê**, nên theo
 * luật "enum Java thắng" chúng được đặt nhãn mới ở đây:
 * `WAITING_PAYMENT` → "Chờ thanh toán", `CONFIRMED` → "Sắp diễn ra" /
 * "Chờ xác nhận", `PAYMENT_EXPIRED` → "Quá hạn thanh toán", `UNDER_REVIEW` →
 * "Đang xử lý khiếu nại". Bỏ chúng đi thì 4 nhóm booking thật sẽ hiện ra màn hình
 * mà không có nhãn nào.
 *
 * `BANG_NHAN` là `Record<BookingLifecycleStatus, …>` chứ không phải `switch` có
 * `default`: backend thêm một giá trị enum mới là lỗi BIÊN DỊCH ở đây, không phải
 * một thẻ trống trên máy người dùng.
 */

import type { StatusTone } from '@/core/ui/StatusBadge';
import type {
  BookingCompletionOutcome,
  BookingDisplayState,
  BookingLifecycleStatus,
} from '@/features/booking/types';

/** Nhãn hiển thị kèm tone của `StatusBadge` */
export interface NhanTrangThai {
  label: string;
  tone: StatusTone;
}

/**
 * Nhãn theo `bookingStatus`, dùng khi không có trường nào khác nói rõ hơn.
 *
 * Tone theo thiết kế (`renderVals()` của `MyBookings.dc.html`): việc-đang-chờ là
 * `warning`, việc-đang-diễn-ra là `accent`, hoàn tất là `success`, còn mọi kết
 * cục đóng (hủy, từ chối, quá hạn) là `neutral`.
 */
const BANG_NHAN: Record<BookingLifecycleStatus, NhanTrangThai> = {
  REQUESTED: { label: 'Đang chờ', tone: 'warning' },
  WAITING_PAYMENT: { label: 'Chờ thanh toán', tone: 'warning' },
  CONFIRMED: { label: 'Sắp diễn ra', tone: 'accent' },
  REJECTED_BY_MENTOR: { label: 'Bị từ chối', tone: 'neutral' },
  CANCELED_BY_MENTEE: { label: 'Mentee hủy', tone: 'neutral' },
  CANCELED_BY_MENTOR: { label: 'Mentor hủy', tone: 'neutral' },
  REQUEST_EXPIRED: { label: 'Quá hạn', tone: 'neutral' },
  PAYMENT_EXPIRED: { label: 'Quá hạn thanh toán', tone: 'neutral' },
  UNDER_REVIEW: { label: 'Đang xử lý khiếu nại', tone: 'warning' },
  COMPLETED: { label: 'Đã hoàn thành', tone: 'success' },
};

/** Phần của một booking đủ để chọn nhãn — nhận hẹp để test không phải dựng cả DTO */
export interface NguonNhanTrangThai {
  bookingStatus: BookingLifecycleStatus;
  displayState: BookingDisplayState;
  completionOutcome: BookingCompletionOutcome | null;
}

/**
 * Nhãn trạng thái của một booking.
 *
 * Thứ tự ưu tiên có chủ ý:
 *
 * 1. **Vắng mặt** thắng tất. Một buổi đóng với `NO_SHOW_MENTOR` vẫn có
 *    `bookingStatus = COMPLETED`; gắn nhãn "Đã hoàn thành" cho nó là nói với
 *    người dùng rằng buổi học đã diễn ra, trong khi thực tế mentor không tới và
 *    tiền đã được hoàn.
 * 2. **Đang diễn ra** thắng "Sắp diễn ra". Cả hai cùng là `CONFIRMED`; chỉ
 *    `displayState` phân biệt được, và đây là nhãn duy nhất có nền `accent` trong
 *    thiết kế nên nó phải nổi lên đúng lúc.
 * 3. **Chờ xác nhận** cho `CONFIRMED` đã qua giờ học mà chưa ai xác nhận
 *    (`displayState = WAITING_CONFIRMATION`). Vẫn là `CONFIRMED` nhưng gọi nó
 *    "Sắp diễn ra" thì sai hẳn về thời gian.
 * 4. Còn lại thì theo `bookingStatus`.
 */
export function nhanTrangThaiBooking(booking: NguonNhanTrangThai): NhanTrangThai {
  if (
    booking.completionOutcome === 'NO_SHOW_MENTEE' ||
    booking.completionOutcome === 'NO_SHOW_MENTOR'
  ) {
    // HANDOFF chỉ có MỘT nhãn "Vắng mặt" cho cả hai phía, nên không phân biệt ai
    // vắng ở đây. `completionOutcome` vẫn giữ nguyên thông tin đó cho màn chi
    // tiết về sau.
    return { label: 'Vắng mặt', tone: 'neutral' };
  }

  if (booking.bookingStatus === 'CONFIRMED') {
    if (booking.displayState === 'IN_SESSION') {
      return { label: 'Đang diễn ra', tone: 'accent' };
    }
    if (booking.displayState === 'WAITING_CONFIRMATION') {
      return { label: 'Chờ xác nhận', tone: 'warning' };
    }
  }

  return BANG_NHAN[booking.bookingStatus];
}

/**
 * @file bookingPrice.ts
 * @description Nơi DUY NHẤT quyết định một booking hiện giá thế nào.
 *
 * ## Vì sao đọc `servicePriceScoinSnapshot` chứ không `servicePriceWithSurchargeScoin`
 *
 * `BookingResponse` có hai trường tiền:
 *
 * - `servicePriceScoinSnapshot` — giá dịch vụ đúng như mentor đặt, chụp lại lúc
 *   tạo booking.
 * - `servicePriceWithSurchargeScoin` — giá đó cộng phụ phí nền tảng, tức số
 *   MENTEE phải trả (`calculateMenteeVisiblePrice()` của backend).
 *
 * Thẻ phía mentor hiện con số thứ NHẤT: đó là giá dịch vụ của chính họ, con số
 * họ tự đặt và nhận ra ngay. Hiện con số thứ hai ở màn mentor là nói với mentor
 * rằng dịch vụ của họ đắt hơn thực tế.
 *
 * Và KHÔNG con số nào ở đây là "thu nhập của mentor": phần mentor thực nhận phụ
 * thuộc `settlementStatus` cùng tỉ lệ chia của backend, mà `BookingResponse`
 * không khai. Vì vậy giao diện chỉ được gọi nó là giá dịch vụ, không được gắn
 * nhãn "bạn nhận được".
 *
 * ## Ba trạng thái, giống `moTaGiaDichVu()` của nhánh mentor
 *
 * 1. **Miễn phí** — `serviceIsFreeSnapshot === true`.
 * 2. **Có giá** — `servicePriceScoinSnapshot` là số.
 * 3. **Không có giá nào để hiện** — booking không gắn service, cả hai trường là
 *    `null`. Lúc đó trả `null` cho CẢ hai vế để thẻ bỏ hẳn ô giá, chứ không in
 *    "0" hay "null".
 *
 * `serviceIsFreeSnapshot` là `Boolean` ĐÓNG HỘP trong Java (`@Schema(nullable)`)
 * nên phải so `=== true`: `if (isFree)` cũng chạy đúng với `null`, nhưng nó gộp
 * "chưa biết" vào "miễn phí" và sẽ in "Miễn phí" cho một buổi có thu tiền ngay
 * khi backend đổi mapper.
 */

import { phanCachNghin } from '@/core/format/soLuong';
import type { BookingResponse } from '@/features/booking/types';

export interface MoTaGiaBooking {
  /** Số tiền đã định dạng ("150.000"); `null` khi không có số nào được phép hiện */
  so: string | null;
  /** Chữ thay cho số ("Miễn phí"); `null` khi đã có số hoặc không có gì để nói */
  nhan: string | null;
}

/** Quy giá của một booking thành thứ màn hình được phép hiện */
export function moTaGiaBooking(
  booking: Pick<BookingResponse, 'serviceIsFreeSnapshot' | 'servicePriceScoinSnapshot'>,
): MoTaGiaBooking {
  if (booking.serviceIsFreeSnapshot === true) {
    return { so: null, nhan: 'Miễn phí' };
  }
  // Kiểm `== null` chứ không theo tính truthy: `0` trên một booking KHÔNG
  // `isFree` là dữ liệu lạ, nhưng "0" vẫn là con số backend trả về và mentor
  // cần thấy đúng nó.
  if (booking.servicePriceScoinSnapshot == null) {
    return { so: null, nhan: null };
  }
  return { so: phanCachNghin(booking.servicePriceScoinSnapshot), nhan: null };
}

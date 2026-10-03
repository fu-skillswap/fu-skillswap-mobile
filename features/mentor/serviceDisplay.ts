/**
 * @file serviceDisplay.ts
 * @description Nơi DUY NHẤT quyết định một dịch vụ mentor hiện giá thế nào.
 *
 * Ba trạng thái khác nhau mà rất dễ bị gộp thành một:
 *
 * 1. **Miễn phí** (`isFree: true`) — mentor cố ý mở một buổi không thu phí.
 * 2. **Có giá** (`priceScoin` là số) — hiện số.
 * 3. **Chưa có giá** (`isFree: false` mà `priceScoin` là `null`) —
 *    `MentorServiceResponse.java` khai `@Schema(nullable = true)` lên
 *    `priceScoin`, nên đây là trạng thái THẬT, không phải dữ liệu rác.
 *
 * Viết `${dichVu.priceScoin} S-coins` thẳng vào JSX gộp cả ba lại và cho ra
 * `"0 S-coins"` cho buổi miễn phí hoặc `"null S-coins"` cho dịch vụ chưa báo giá
 * — hai câu nói sai về tiền, thứ người dùng tin nhất trên màn hình này.
 */

import type { MentorServiceResponse } from '@/features/mentor/types';

export interface MoTaGiaDichVu {
  /** Số tiền đã định dạng ("150.000"); `null` khi không có số nào được phép hiện */
  so: string | null;
  /** Chữ thay cho số ("Miễn phí" / "Chưa có giá"); `null` khi đã có số */
  nhan: string | null;
}

/**
 * Chèn dấu chấm phân cách hàng nghìn, đúng kiểu thiết kế viết ("150.000").
 *
 * Tự chèn chứ không dùng `Intl.NumberFormat`: Hermes chỉ có Intl đầy đủ khi bản
 * build bật `jsEngine` kèm ICU, và khi thiếu nó thì `Intl` âm thầm rơi về một bản
 * tối giản định dạng theo `en-US` ("150,000"). Một dấu phẩy ở chỗ dấu chấm làm
 * người Việt đọc 150.000 thành 150 — sai 1000 lần, và chỉ sai trên máy thật.
 */
function phanCachNghin(so: number): string {
  const nguyen = Math.trunc(Math.abs(so));
  const chuoi = String(nguyen).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return so < 0 ? `-${chuoi}` : chuoi;
}

/** Quy giá của một dịch vụ thành thứ màn hình được phép hiện */
export function moTaGiaDichVu(
  dichVu: Pick<MentorServiceResponse, 'isFree' | 'priceScoin'>,
): MoTaGiaDichVu {
  if (dichVu.isFree) {
    return { so: null, nhan: 'Miễn phí' };
  }
  // Kiểm `== null` chứ không theo tính truthy: `priceScoin: 0` trên một dịch vụ
  // KHÔNG `isFree` là dữ liệu lạ của backend, nhưng "0" vẫn là một con số có
  // nghĩa và người dùng cần thấy đúng thứ backend trả về.
  if (dichVu.priceScoin == null) {
    return { so: null, nhan: 'Chưa có giá' };
  }
  return { so: phanCachNghin(dichVu.priceScoin), nhan: null };
}

/**
 * Thời lượng và hình thức, đúng dòng phụ của `MentorDetail.dc.html`
 * ("45 phút · Online").
 *
 * `deliveryMode` là enum chỉ có `ONE_TO_ONE`, nên chữ "1:1" là dịch đúng chứ
 * không phải bịa. Thiết kế viết "Online"; dùng "1:1" vì đó là điều backend thật
 * sự nói — hình thức trực tuyến hay không thì DTO này không khai.
 */
export function moTaThoiLuong(
  dichVu: Pick<MentorServiceResponse, 'durationMinutes' | 'deliveryMode'>,
): string {
  const hinhThuc = dichVu.deliveryMode === 'ONE_TO_ONE' ? '1:1' : dichVu.deliveryMode;
  return `${dichVu.durationMinutes} phút · ${hinhThuc}`;
}

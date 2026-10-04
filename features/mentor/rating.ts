/**
 * @file rating.ts
 * @description Nơi DUY NHẤT quyết định có hiện điểm đánh giá của mentor hay không.
 *
 * Tách riêng vì đây là chỗ dễ nói dối người dùng nhất. `mentor-discovery.md` §2
 * nói thẳng: khi `ratingState === 'NO_REVIEWS'` thì `ratingAverage` luôn `null`
 * và "Frontend **không tự ý hiển thị mặc định 5.0**". Một mentor mới hiện 5 sao
 * là bịa ra uy tín, và người xem không có cách nào biết đó là số bịa.
 */

import type { MentorReputation } from '@/features/mentor/types';

export interface MoTaDanhGia {
  /** Có được hiện điểm hay không */
  coDiem: boolean;
  /** Điểm đã định dạng một chữ số thập phân; `null` khi không được hiện */
  diem: string | null;
  soLuot: number;
}

/** Quy uy tín của mentor thành thứ màn hình được phép hiện */
export function moTaDiemDanhGia(reputation: MentorReputation): MoTaDanhGia {
  // Kiểm `!= null` chứ không theo tính truthy: điểm 0 là một điểm hợp lệ và là
  // thứ người dùng cần thấy nhất. Kiểm cả `ratingState` lẫn giá trị vì payload
  // dị dạng (RATED nhưng điểm null) sẽ cho ra "NaN" trên màn hình.
  const diemSo = reputation.ratingAverage;
  const coDiem = reputation.ratingState === 'RATED' && diemSo != null;

  return {
    coDiem,
    diem: coDiem && diemSo != null ? diemSo.toFixed(1) : null,
    soLuot: reputation.reviewCount,
  };
}

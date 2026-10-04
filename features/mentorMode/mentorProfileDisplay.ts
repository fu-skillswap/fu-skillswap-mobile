/**
 * @file mentorProfileDisplay.ts
 * @description Nơi DUY NHẤT quy `MentorProfileResponse` thành chữ hiện lên màn
 * hình. Hai màn mentor (Tổng quan, Thêm) đều đọc qua đây để không nói hai câu
 * khác nhau về cùng một hồ sơ.
 *
 * ## Vì sao không dùng được `moTaDiemDanhGia()` của `features/mentor`
 *
 * Hàm đó nhận `MentorReputation` và quyết định dựa vào `ratingState`
 * (`RATED` / `NO_REVIEWS`) — một trường của `MentorDiscoveryCardResponse`.
 * `MentorProfileResponse` **không có** `ratingState`: nó chỉ có `ratingAverage`
 * (`BigDecimal`, nullable) và `reviewCount` (`Integer`, nullable). Hai DTO khác
 * nhau nên phép quyết định cũng khác, và `features/` không được import chéo
 * nhau. Luật thì giữ nguyên: **không tự ý hiện 5.0 cho mentor chưa có đánh giá**
 * — hiện một điểm bịa là bịa ra uy tín.
 */

import { docLocalDateTime } from '@/core/time/localDateTime';
import type { MentorProfileResponse, MentorStatus } from '@/features/mentorMode/types';

export interface MoTaDanhGiaMentor {
  /** Điểm đã định dạng một chữ số thập phân; `null` khi không được hiện */
  diem: string | null;
  /** Số lượt đánh giá; `null` khi backend không trả */
  soLuot: number | null;
  /** Chữ thay cho điểm ("Chưa có đánh giá"); `null` khi đã có điểm */
  nhan: string | null;
}

/**
 * Quy điểm đánh giá của mentor thành thứ màn hình được phép hiện.
 *
 * Kiểm `!= null` chứ không theo tính truthy: điểm `0` là điểm HỢP LỆ (và là thứ
 * mentor cần thấy nhất), còn `reviewCount === 0` đi cùng `ratingAverage === null`
 * là một mentor mới — hai chuyện khác nhau.
 */
export function moTaDanhGiaMentor(
  profile: Pick<MentorProfileResponse, 'ratingAverage' | 'reviewCount'>,
): MoTaDanhGiaMentor {
  const diem = profile.ratingAverage;
  if (diem == null) {
    return { diem: null, soLuot: profile.reviewCount, nhan: 'Chưa có đánh giá' };
  }
  return { diem: diem.toFixed(1), soLuot: profile.reviewCount, nhan: null };
}

/** Màu chữ cho một dòng trạng thái; ánh xạ sang class ở màn hình */
export type MauTrangThaiMentor = 'success' | 'warning' | 'neutral';

export interface MoTaTrangThaiMentor {
  label: string;
  mau: MauTrangThaiMentor;
  /**
   * Hồ sơ có hiện được trên discovery hay không.
   *
   * CHỈ `ACTIVE` mới hiện được: `MentorDiscoveryService.isDiscoverableMentor()`
   * đòi `status == MentorStatus.ACTIVE`, nên `GET /api/mentors/{userId}` trả
   * **404** cho mọi trạng thái khác. Màn `MentorMore` dùng cờ này để quyết định
   * có dựng lối "Xem hồ sơ công khai" hay không — dựng nó cho một hồ sơ chưa
   * ACTIVE là dẫn người dùng tới một màn hình báo "không tìm thấy mentor",
   * nghĩa là nói với họ rằng chính họ không tồn tại.
   */
  xemDuocHoSoCongKhai: boolean;
}

const BANG_TRANG_THAI: Record<MentorStatus, MoTaTrangThaiMentor> = {
  DRAFT: { label: 'Hồ sơ mentor đang là bản nháp', mau: 'neutral', xemDuocHoSoCongKhai: false },
  PENDING_VERIFICATION: {
    label: 'Hồ sơ mentor đang chờ xác minh',
    mau: 'warning',
    xemDuocHoSoCongKhai: false,
  },
  ACTIVE: {
    label: 'Hồ sơ mentor đã xác minh',
    mau: 'success',
    xemDuocHoSoCongKhai: true,
  },
  PAUSED: {
    label: 'Hồ sơ mentor đang tạm dừng',
    mau: 'warning',
    xemDuocHoSoCongKhai: false,
  },
  REJECTED: { label: 'Hồ sơ mentor bị từ chối', mau: 'neutral', xemDuocHoSoCongKhai: false },
  SUSPENDED: { label: 'Hồ sơ mentor đang bị tạm khoá', mau: 'neutral', xemDuocHoSoCongKhai: false },
};

/**
 * Dòng trạng thái hồ sơ mentor.
 *
 * `Record<MentorStatus, …>` chứ không `switch` có `default`: backend thêm một
 * giá trị enum mới là lỗi BIÊN DỊCH ở đây, không phải một dòng trống trên máy
 * người dùng.
 *
 * `mentorStatus` là `null` khi `exists === false`
 * (`MentorProfileResponse.empty()` không điền trường này) — đó là một trạng thái
 * THẬT của tài khoản vừa được cấp vai trò MENTOR nhưng chưa điền hồ sơ.
 */
export function moTaTrangThaiMentor(status: MentorStatus | null): MoTaTrangThaiMentor {
  if (status == null) {
    return { label: 'Chưa tạo hồ sơ mentor', mau: 'neutral', xemDuocHoSoCongKhai: false };
  }
  return BANG_TRANG_THAI[status];
}

/**
 * Mentor có đang bị treo quyền nhận booking hay không, và tới khi nào.
 *
 * `bookingSuspendedUntil` là `LocalDateTime` — **không có offset**
 * (`"2026-06-27T10:00:00"`), nên phải đọc bằng `core/time/localDateTime.ts`.
 * Đưa nó vào `docOffsetDateTime()` của nhánh booking sẽ trả `null` và dải cảnh
 * báo sẽ im lặng biến mất đúng lúc nó cần nói.
 *
 * So sánh được thực hiện trên MẶT ĐỒNG HỒ Việt Nam: backend ghi mốc này theo
 * `Asia/Ho_Chi_Minh` (`BUSINESS_ZONE`) nhưng không viết múi giờ ra dây, nên
 * `bayGioHcm` phải là mặt đồng hồ Việt Nam, không phải `Date.now()` thô. Màn
 * hình truyền nó vào để test không phải chạy đua với đồng hồ thật.
 */
export function dangBiTreoNhanBooking(
  bookingSuspendedUntil: string | null,
  bayGioHcm: { nam: number; thang: number; ngay: number; gio: number; phut: number },
): boolean {
  const moc = docLocalDateTime(bookingSuspendedUntil);
  if (!moc) {
    return false;
  }
  // So bằng một số nguyên gộp (YYYYMMDDHHMM) thay vì `new Date(...)`: cả hai vế
  // đã là mặt đồng hồ cùng một múi, nên không cần — và không được — đi qua
  // `Date`, thứ sẽ gán cho chúng múi giờ của thiết bị.
  const gop = (m: { nam: number; thang: number; ngay: number; gio: number; phut: number }) =>
    m.nam * 1e8 + m.thang * 1e6 + m.ngay * 1e4 + m.gio * 1e2 + m.phut;

  return gop(moc) > gop(bayGioHcm);
}

/** Mặt đồng hồ Việt Nam ngay lúc này, không phụ thuộc múi giờ của thiết bị */
export function matDongHoHcm(bayGioMs: number = Date.now()) {
  // `+07:00` là `BUSINESS_ZONE` của backend và nó KHÔNG có quy ước giờ mùa hè,
  // nên cộng cố định 7 giờ rồi đọc bằng các getter UTC là đúng — cùng cách
  // `nhanNgayNgan()` của `core/time/offsetDateTime.ts` làm, và không cần Intl
  // (Hermes bản rút gọn không chắc có đủ dữ liệu múi giờ).
  const d = new Date(bayGioMs + 7 * 60 * 60_000);
  return {
    nam: d.getUTCFullYear(),
    thang: d.getUTCMonth() + 1,
    ngay: d.getUTCDate(),
    gio: d.getUTCHours(),
    phut: d.getUTCMinutes(),
  };
}

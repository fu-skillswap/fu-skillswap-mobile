/**
 * @file localDateTime.ts
 * @description Đọc và hiển thị mốc thời gian kiểu `LocalDateTime` của backend.
 *
 * Gần như mọi trường thời gian của BE là `LocalDateTime` phía Java, nên lên dây
 * **không có offset**: `"2026-06-22T21:20:25"`. Đó KHÔNG phải một thời điểm — nó
 * là một mặt đồng hồ, không mang múi giờ nào.
 *
 * `new Date("2026-06-22T21:20:25")` của JS đọc chuỗi đó thành **giờ địa phương
 * của máy** (ES2015 trở đi: chuỗi date-time không có offset là local time). Trên
 * điện thoại UTC+7 nó ra đúng một cách tình cờ; trong CI chạy UTC thì lệch 7
 * tiếng, và mọi phép `toLocaleDateString()` sau đó có thể nhảy sang ngày khác.
 * Đó là lý do file này KHÔNG dùng `Date` ở đường hiển thị: nó bóc số trực tiếp từ
 * chuỗi và in lại đúng những số backend đã viết.
 *
 * Dùng cho mốc thời gian của BACKEND. Giờ của chính người đang cầm máy (lời chào
 * theo buổi, đồng hồ đếm ngược) thì cứ dùng `new Date()` — xem `loiChao()` trong
 * `features/forum/screens/ForumFeedScreen.tsx`.
 */

/** Mặt đồng hồ mà backend đã viết, tách thành từng số */
export interface MocLocalDateTime {
  nam: number;
  thang: number;
  ngay: number;
  gio: number;
  phut: number;
  giay: number;
}

/**
 * Khuôn `LocalDateTime` của Jackson: giây và phần thập phân là TUỲ CHỌN
 * (`"2026-06-22T21:20"`, `"...:25"`, `"...:25.123"` đều có thể gặp), còn hậu tố
 * `Z` hay `+07:00` thì KHÔNG được chấp nhận — một chuỗi có offset nghĩa là trường
 * đó thực ra là `Instant`/`OffsetDateTime`, và gọi nhầm hàm này vào đó sẽ âm thầm
 * bỏ mất múi giờ. Trả `null` để chỗ gọi phải xử lý, thay vì in ra một ngày sai.
 */
const KHUON = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;

/** Bóc một chuỗi `LocalDateTime` thành từng số; `null` nếu không đúng khuôn */
export function docLocalDateTime(wire: string | null | undefined): MocLocalDateTime | null {
  const khop = KHUON.exec((wire ?? '').trim());
  if (!khop) {
    return null;
  }

  const moc: MocLocalDateTime = {
    nam: Number(khop[1]),
    thang: Number(khop[2]),
    ngay: Number(khop[3]),
    gio: Number(khop[4]),
    phut: Number(khop[5]),
    giay: Number(khop[6] ?? '0'),
  };

  // Khuôn đúng mà giá trị vô nghĩa ("2026-13-45T25:61") vẫn phải bị loại: in ra
  // "45/13/2026" còn tệ hơn là không in gì.
  if (
    moc.thang < 1 ||
    moc.thang > 12 ||
    moc.ngay < 1 ||
    moc.ngay > 31 ||
    moc.gio > 23 ||
    moc.phut > 59 ||
    moc.giay > 59
  ) {
    return null;
  }

  return moc;
}

function hai(so: number): string {
  return String(so).padStart(2, '0');
}

/**
 * Ngày theo cách người Việt đọc: `"28/09/2026"`. `null` khi chuỗi không đọc được.
 *
 * Chỗ gọi phải xử lý `null` chứ không được `?? ''`: một dòng ngày trống trông như
 * lỗi giao diện, còn bỏ hẳn dòng đó thì không nói gì sai.
 */
export function dinhDangNgay(wire: string | null | undefined): string | null {
  const moc = docLocalDateTime(wire);
  return moc ? `${hai(moc.ngay)}/${hai(moc.thang)}/${moc.nam}` : null;
}

/** Ngày kèm giờ phút: `"28/09/2026 14:05"`. `null` khi chuỗi không đọc được. */
export function dinhDangNgayGio(wire: string | null | undefined): string | null {
  const moc = docLocalDateTime(wire);
  return moc
    ? `${hai(moc.ngay)}/${hai(moc.thang)}/${moc.nam} ${hai(moc.gio)}:${hai(moc.phut)}`
    : null;
}

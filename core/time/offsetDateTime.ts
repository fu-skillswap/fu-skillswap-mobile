/**
 * @file offsetDateTime.ts
 * @description Đọc và hiển thị mốc thời gian kiểu `OffsetDateTime` của backend.
 *
 * ## Vì sao cần file này bên cạnh `localDateTime.ts`
 *
 * Nhánh booking là ngoại lệ của câu "gần như mọi trường thời gian của BE là
 * `LocalDateTime`". **Mọi** trường thời gian của `BookingResponse.java` khai là
 * `java.time.OffsetDateTime`, và `BookingTime.toOffsetDateTime()` dựng chúng
 * bằng `value.atZone(BUSINESS_ZONE).toOffsetDateTime()` với
 * `BUSINESS_ZONE = Asia/Ho_Chi_Minh`. Lên dây chúng CÓ offset:
 * `"2026-10-04T20:30:00+07:00"`.
 *
 * Hệ quả: gọi `docLocalDateTime()` vào một trường booking sẽ trả `null` (khuôn
 * của file đó cố ý từ chối hậu tố offset), và màn hình sẽ không in được ngày nào.
 * Hai file tồn tại song song có chủ ý — đừng gộp, và đừng nới khuôn của file kia.
 *
 * ## Vì sao không chỉ dùng `new Date(wire)`
 *
 * Với chuỗi CÓ offset thì `new Date()` đọc đúng thời điểm, nên nó không sai như
 * ở `LocalDateTime`. Nhưng `toLocaleTimeString()` sau đó in theo múi giờ của
 * THIẾT BỊ: một máy đặt múi UTC sẽ hiện buổi học 20:30 (giờ Việt Nam) thành
 * 13:30, trong khi mentor và mentee đều đang hẹn nhau theo giờ Việt Nam và
 * backend chốt lịch theo đúng múi đó. Vì vậy các hàm dưới đây in lại đúng mặt
 * đồng hồ mà backend đã viết — không phụ thuộc cấu hình máy, và tất định trong
 * CI (chạy UTC) y như trên điện thoại.
 *
 * `mocMs` vẫn được tính ra để so sánh thứ tự / khoảng cách ngày, vì chuỗi có
 * offset là một thời điểm tuyệt đối thật sự.
 */

/** Mốc thời gian có offset mà backend đã viết, tách thành từng số */
export interface MocOffsetDateTime {
  nam: number;
  thang: number;
  ngay: number;
  gio: number;
  phut: number;
  giay: number;
  /** Độ lệch so với UTC tính bằng phút (`+07:00` → 420, `Z` → 0) */
  lechPhut: number;
  /** Thời điểm tuyệt đối, mili giây từ epoch */
  mocMs: number;
}

/**
 * Khuôn `OffsetDateTime` của Jackson. Giây và phần thập phân là TUỲ CHỌN, còn
 * hậu tố offset (`Z` hoặc `±HH:MM`) là BẮT BUỘC: một chuỗi không offset nghĩa là
 * trường đó thực ra là `LocalDateTime`, và đọc nó ở đây sẽ âm thầm gán cho nó
 * một múi giờ nó không có. Trả `null` để chỗ gọi phải xử lý.
 */
const KHUON =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** Thứ trong tuần theo cách người Việt viết tắt; chỉ số khớp `Date.getUTCDay()` */
const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

const MOT_NGAY_MS = 86_400_000;

function hai(so: number): string {
  return String(so).padStart(2, '0');
}

/** Bóc `Z` hoặc `±HH:MM` thành số phút lệch so với UTC */
function docLech(hauTo: string): number {
  if (hauTo === 'Z') {
    return 0;
  }
  const dau = hauTo[0] === '-' ? -1 : 1;
  return dau * (Number(hauTo.slice(1, 3)) * 60 + Number(hauTo.slice(4, 6)));
}

/** Bóc một chuỗi `OffsetDateTime` thành từng số; `null` nếu không đúng khuôn */
export function docOffsetDateTime(wire: string | null | undefined): MocOffsetDateTime | null {
  const khop = KHUON.exec((wire ?? '').trim());
  if (!khop) {
    return null;
  }

  const nam = Number(khop[1]);
  const thang = Number(khop[2]);
  const ngay = Number(khop[3]);
  const gio = Number(khop[4]);
  const phut = Number(khop[5]);
  const giay = Number(khop[6] ?? '0');

  // Khuôn đúng mà giá trị vô nghĩa ("2026-13-45T25:61+07:00") vẫn phải bị loại:
  // in ra "45/13/2026" còn tệ hơn là không in gì. Cùng mức kiểm với
  // `docLocalDateTime()` — không kiểm số ngày thật của từng tháng.
  if (thang < 1 || thang > 12 || ngay < 1 || ngay > 31 || gio > 23 || phut > 59 || giay > 59) {
    return null;
  }

  const lechPhut = docLech(khop[7]);

  return {
    nam,
    thang,
    ngay,
    gio,
    phut,
    giay,
    lechPhut,
    // Tự tính thay vì `Date.parse(wire)`: `Date.UTC` không phụ thuộc phần phân
    // tích chuỗi của từng engine (Hermes và Node không giống nhau ở các khuôn
    // biên), và các số ở đây đã được khuôn ở trên kiểm.
    mocMs: Date.UTC(nam, thang - 1, ngay, gio, phut, giay) - lechPhut * 60_000,
  };
}

/** Giờ phút đúng như backend viết: `"20:30"`. `null` khi chuỗi không đọc được. */
export function dinhDangGio(wire: string | null | undefined): string | null {
  const moc = docOffsetDateTime(wire);
  return moc ? `${hai(moc.gio)}:${hai(moc.phut)}` : null;
}

/** Ngày theo cách người Việt đọc: `"04/10/2026"`. `null` khi chuỗi không đọc được. */
export function dinhDangNgayCoOffset(wire: string | null | undefined): string | null {
  const moc = docOffsetDateTime(wire);
  return moc ? `${hai(moc.ngay)}/${hai(moc.thang)}/${moc.nam}` : null;
}

/**
 * Khoảng giờ của một buổi học: `"20:30 – 21:30"` (gạch ngang dài, đúng thiết kế).
 *
 * Thiếu một trong hai đầu thì trả `null` chứ KHÔNG in nửa khoảng: `"20:30 – "`
 * trông như lỗi giao diện, còn `"20:30"` thì nói sai rằng buổi học không có giờ
 * kết thúc.
 */
export function dinhDangKhoangGio(
  batDau: string | null | undefined,
  ketThuc: string | null | undefined,
): string | null {
  const a = dinhDangGio(batDau);
  const b = dinhDangGio(ketThuc);
  return a && b ? `${a} – ${b}` : null;
}

/**
 * Nhãn ngày ngắn như thiết kế: `"Hôm nay"`, `"Mai"`, `"Hôm qua"`, hoặc
 * `"T3, 06/10"` (kèm năm khi khác năm hiện tại).
 *
 * "Hôm nay" được so trong CHÍNH múi giờ của mốc, không trong múi của thiết bị:
 * một buổi học 23:00 giờ Việt Nam vẫn phải là "Hôm nay" với người đang ở Việt
 * Nam, kể cả khi lúc đó ở UTC đã sang ngày khác. `bayGioMs` là tham số để test
 * không phải chạy đua với đồng hồ thật.
 */
export function nhanNgayNgan(
  wire: string | null | undefined,
  bayGioMs: number = Date.now(),
): string | null {
  const moc = docOffsetDateTime(wire);
  if (!moc) {
    return null;
  }

  // Dịch "bây giờ" sang múi của mốc rồi đọc bằng các getter UTC: đó là cách lấy
  // mặt đồng hồ trong một múi giờ bất kỳ mà không cần Intl (Hermes bản rút gọn
  // không chắc có đủ dữ liệu múi giờ).
  const bayGioTrongMui = new Date(bayGioMs + moc.lechPhut * 60_000);
  const ngayHienTai = Date.UTC(
    bayGioTrongMui.getUTCFullYear(),
    bayGioTrongMui.getUTCMonth(),
    bayGioTrongMui.getUTCDate(),
  );
  const ngayCuaMoc = Date.UTC(moc.nam, moc.thang - 1, moc.ngay);
  const soNgayLech = Math.round((ngayCuaMoc - ngayHienTai) / MOT_NGAY_MS);

  if (soNgayLech === 0) {
    return 'Hôm nay';
  }
  if (soNgayLech === 1) {
    return 'Mai';
  }
  if (soNgayLech === -1) {
    return 'Hôm qua';
  }

  const thu = THU[new Date(ngayCuaMoc).getUTCDay()];
  const ngayThang = `${hai(moc.ngay)}/${hai(moc.thang)}`;
  // Năm chỉ xuất hiện khi khác năm hiện tại: "T3, 06/10" cho lịch trong năm
  // (đúng thiết kế), nhưng một buổi đã qua từ năm trước thì thiếu năm là mơ hồ.
  return moc.nam === bayGioTrongMui.getUTCFullYear()
    ? `${thu}, ${ngayThang}`
    : `${thu}, ${ngayThang}/${moc.nam}`;
}

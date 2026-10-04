/**
 * @file offsetDateTime.test.ts
 * @description Kiểm bộ đọc `OffsetDateTime` của backend.
 *
 * Trọng tâm là hai điều mà một bản viết "cho nhanh" bằng `new Date()` sẽ sai:
 * giờ in ra KHÔNG được chạy theo múi giờ của máy chạy test, và một chuỗi KHÔNG
 * có offset (tức là một trường `LocalDateTime` bị gọi nhầm vào đây) phải bị từ
 * chối thay vì được đoán múi giờ hộ.
 */

import {
  dinhDangGio,
  dinhDangKhoangGio,
  dinhDangNgayCoOffset,
  docOffsetDateTime,
  nhanNgayNgan,
} from '@/core/time/offsetDateTime';

/** 04/10/2026 là Chủ nhật; 06/10/2026 là thứ Ba. */
const BUOI_HOC = '2026-10-04T20:30:00+07:00';
/** 12:00 trưa 04/10/2026 giờ Việt Nam, dùng làm "bây giờ" cố định */
const BAY_GIO = Date.UTC(2026, 9, 4, 5, 0, 0);

describe('docOffsetDateTime', () => {
  it('bóc đúng từng số và tính ra thời điểm tuyệt đối', () => {
    const moc = docOffsetDateTime(BUOI_HOC);

    expect(moc).toEqual({
      nam: 2026,
      thang: 10,
      ngay: 4,
      gio: 20,
      phut: 30,
      giay: 0,
      lechPhut: 420,
      mocMs: Date.UTC(2026, 9, 4, 13, 30, 0),
    });
  });

  it('nhận hậu tố Z và offset âm', () => {
    expect(docOffsetDateTime('2026-10-04T13:30:00Z')?.lechPhut).toBe(0);
    expect(docOffsetDateTime('2026-10-04T08:30:00-05:00')?.lechPhut).toBe(-300);
    // Cùng một thời điểm viết bằng ba offset khác nhau phải ra cùng `mocMs`.
    expect(docOffsetDateTime('2026-10-04T13:30:00Z')?.mocMs).toBe(
      docOffsetDateTime(BUOI_HOC)?.mocMs,
    );
    expect(docOffsetDateTime('2026-10-04T08:30:00-05:00')?.mocMs).toBe(
      docOffsetDateTime(BUOI_HOC)?.mocMs,
    );
  });

  it('giây và phần thập phân là tuỳ chọn', () => {
    expect(docOffsetDateTime('2026-10-04T20:30+07:00')?.giay).toBe(0);
    expect(docOffsetDateTime('2026-10-04T20:30:25.123+07:00')?.giay).toBe(25);
  });

  it('TỪ CHỐI chuỗi không có offset — đó là một trường LocalDateTime gọi nhầm chỗ', () => {
    // Đoán múi giờ hộ là cách im lặng nhất để lệch 7 tiếng.
    expect(docOffsetDateTime('2026-10-04T20:30:00')).toBeNull();
    expect(dinhDangGio('2026-10-04T20:30:00')).toBeNull();
    expect(nhanNgayNgan('2026-10-04T20:30:00', BAY_GIO)).toBeNull();
  });

  it('từ chối chuỗi rỗng, null, undefined và giá trị vô nghĩa', () => {
    expect(docOffsetDateTime('')).toBeNull();
    expect(docOffsetDateTime(null)).toBeNull();
    expect(docOffsetDateTime(undefined)).toBeNull();
    expect(docOffsetDateTime('2026-13-45T25:61:00+07:00')).toBeNull();
    expect(docOffsetDateTime('hôm nào đó')).toBeNull();
  });
});

describe('định dạng để hiển thị', () => {
  it('in lại ĐÚNG mặt đồng hồ backend viết, không đổi theo múi giờ máy chạy test', () => {
    // Cùng một thời điểm, viết ở hai offset khác nhau, phải in ra hai giờ khác
    // nhau — vì mỗi chuỗi mang mặt đồng hồ của chính nó.
    expect(dinhDangGio(BUOI_HOC)).toBe('20:30');
    expect(dinhDangGio('2026-10-04T13:30:00Z')).toBe('13:30');
    expect(dinhDangNgayCoOffset(BUOI_HOC)).toBe('04/10/2026');
  });

  it('khoảng giờ dùng gạch ngang dài của thiết kế', () => {
    expect(dinhDangKhoangGio(BUOI_HOC, '2026-10-04T21:30:00+07:00')).toBe('20:30 – 21:30');
  });

  it('thiếu một đầu của khoảng giờ thì KHÔNG in nửa khoảng', () => {
    expect(dinhDangKhoangGio(BUOI_HOC, null)).toBeNull();
    expect(dinhDangKhoangGio(null, BUOI_HOC)).toBeNull();
  });
});

describe('nhanNgayNgan', () => {
  it('so ngày trong CHÍNH múi giờ của mốc, không trong múi của thiết bị', () => {
    // 23:00 ngày 04/10 giờ Việt Nam là vẫn còn "hôm nay" với người ở Việt Nam,
    // dù lúc đó ở UTC đã là 16:00 cùng ngày — và với một mốc 00:30 ngày 05/10
    // giờ Việt Nam thì phải là "Mai", không phải "Hôm nay".
    expect(nhanNgayNgan('2026-10-04T23:00:00+07:00', BAY_GIO)).toBe('Hôm nay');
    expect(nhanNgayNgan('2026-10-05T00:30:00+07:00', BAY_GIO)).toBe('Mai');
    expect(nhanNgayNgan('2026-10-03T23:00:00+07:00', BAY_GIO)).toBe('Hôm qua');
  });

  it('ngày xa hơn thì kèm thứ, đúng khuôn "T3, 06/10" của thiết kế', () => {
    expect(nhanNgayNgan('2026-10-06T19:00:00+07:00', BAY_GIO)).toBe('T3, 06/10');
    expect(nhanNgayNgan('2026-09-27T09:30:00+07:00', BAY_GIO)).toBe('CN, 27/09');
  });

  it('khác năm thì in thêm năm — "T3, 06/10" của năm ngoái là mơ hồ', () => {
    expect(nhanNgayNgan('2025-10-06T19:00:00+07:00', BAY_GIO)).toBe('T2, 06/10/2025');
  });
});

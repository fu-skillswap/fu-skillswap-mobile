/**
 * @file localDateTime.test.ts
 * @description Kiểm việc đọc mốc `LocalDateTime` của backend.
 *
 * Test quan trọng nhất ở đây là test múi giờ: nó chạy lại cùng một phép định dạng
 * dưới `TZ` khác nhau và đòi kết quả GIỐNG NHAU. Một bản cài đặt dùng
 * `new Date(chuoi).toLocaleDateString()` sẽ xanh trên máy UTC+7 và đỏ ở đây.
 */

import { dinhDangNgay, dinhDangNgayGio, docLocalDateTime } from '@/core/time/localDateTime';

describe('docLocalDateTime', () => {
  it('bóc đúng từng số của mốc có giây', () => {
    expect(docLocalDateTime('2026-06-22T21:20:25')).toEqual({
      nam: 2026,
      thang: 6,
      ngay: 22,
      gio: 21,
      phut: 20,
      giay: 25,
    });
  });

  it('nhận mốc THIẾU giây và mốc có phần thập phân — Jackson phát ra cả hai', () => {
    expect(docLocalDateTime('2026-06-22T21:20')?.giay).toBe(0);
    expect(docLocalDateTime('2026-06-22T21:20:25.123456')?.giay).toBe(25);
  });

  it('TỪ CHỐI chuỗi có offset: đó là Instant, không phải LocalDateTime', () => {
    // Gọi hàm này vào một trường `Instant` sẽ âm thầm bỏ mất múi giờ và in ra giờ
    // UTC như thể là giờ địa phương. Trả `null` buộc chỗ gọi phải nhìn thấy.
    expect(docLocalDateTime('2026-06-22T21:20:25Z')).toBeNull();
    expect(docLocalDateTime('2026-06-22T21:20:25+07:00')).toBeNull();
  });

  it('từ chối chuỗi rỗng, null, undefined và rác', () => {
    expect(docLocalDateTime('')).toBeNull();
    expect(docLocalDateTime(null)).toBeNull();
    expect(docLocalDateTime(undefined)).toBeNull();
    expect(docLocalDateTime('hôm qua')).toBeNull();
    // `LocalDate` chỉ có ngày (ví dụ `MentorAchievement.achievedAt`) KHÔNG phải
    // `LocalDateTime` — đưa vào đây là một lỗi gọi, không phải dữ liệu hợp lệ.
    expect(docLocalDateTime('2026-06-22')).toBeNull();
  });

  it('từ chối mốc đúng khuôn nhưng vô nghĩa', () => {
    expect(docLocalDateTime('2026-13-01T10:00:00')).toBeNull();
    expect(docLocalDateTime('2026-01-45T10:00:00')).toBeNull();
    expect(docLocalDateTime('2026-01-01T25:00:00')).toBeNull();
    expect(docLocalDateTime('2026-01-01T10:61:00')).toBeNull();
  });
});

describe('dinhDangNgay', () => {
  it('in ngày theo cách người Việt đọc, có đệm số 0', () => {
    expect(dinhDangNgay('2026-09-28T14:05:00')).toBe('28/09/2026');
    expect(dinhDangNgay('2026-01-02T00:00:00')).toBe('02/01/2026');
  });

  it('trả null thay vì chuỗi rỗng khi không đọc được', () => {
    expect(dinhDangNgay('rác')).toBeNull();
    expect(dinhDangNgay(null)).toBeNull();
  });

  it('KHÔNG đổi theo múi giờ của máy — kể cả mốc sát nửa đêm', () => {
    // Đây là lý do file này tồn tại. `new Date('2026-09-28T23:30:00')` đọc thành
    // giờ địa phương, nên trên máy UTC-5 nó ra 29/09 còn trên UTC+7 ra 28/09:
    // cùng một dữ liệu backend, hai ngày khác nhau trên hai điện thoại.
    const goc = process.env.TZ;
    const ketQua: string[] = [];
    try {
      for (const tz of ['UTC', 'Asia/Ho_Chi_Minh', 'America/New_York', 'Pacific/Kiritimati']) {
        process.env.TZ = tz;
        ketQua.push(dinhDangNgay('2026-09-28T23:30:00') ?? '');
      }
    } finally {
      process.env.TZ = goc;
    }

    expect(ketQua).toEqual(['28/09/2026', '28/09/2026', '28/09/2026', '28/09/2026']);
  });
});

describe('dinhDangNgayGio', () => {
  it('in cả ngày và giờ phút, bỏ giây', () => {
    expect(dinhDangNgayGio('2026-09-28T14:05:25')).toBe('28/09/2026 14:05');
    expect(dinhDangNgayGio('2026-09-28T09:00')).toBe('28/09/2026 09:00');
  });

  it('trả null khi không đọc được', () => {
    expect(dinhDangNgayGio('2026-09-28T14:05:25Z')).toBeNull();
  });
});

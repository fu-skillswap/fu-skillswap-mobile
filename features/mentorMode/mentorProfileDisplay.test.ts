import {
  dangBiTreoNhanBooking,
  matDongHoHcm,
  moTaDanhGiaMentor,
  moTaTrangThaiMentor,
} from '@/features/mentorMode/mentorProfileDisplay';

describe('moTaDanhGiaMentor', () => {
  it('có điểm thì hiện một chữ số thập phân', () => {
    expect(moTaDanhGiaMentor({ ratingAverage: 4.8, reviewCount: 87 })).toEqual({
      diem: '4.8',
      soLuot: 87,
      nhan: null,
    });
  });

  it('BigDecimal 4.80 vẫn ra "4.8" chứ không ra "4.80"', () => {
    // `BigDecimal` của Java lên dây thành số JSON, nên 4.80 tới đây là `4.8`.
    expect(moTaDanhGiaMentor({ ratingAverage: 4.8, reviewCount: 2 }).diem).toBe('4.8');
  });

  it('chưa có đánh giá thì nói thẳng, KHÔNG tự hiện 5.0', () => {
    // Hiện một điểm bịa là bịa ra uy tín, và mentor không có cách nào biết đó
    // là số bịa.
    const moTa = moTaDanhGiaMentor({ ratingAverage: null, reviewCount: 0 });

    expect(moTa.diem).toBeNull();
    expect(moTa.nhan).toBe('Chưa có đánh giá');
  });

  it('reviewCount null (hồ sơ mới) không làm vỡ gì', () => {
    expect(moTaDanhGiaMentor({ ratingAverage: null, reviewCount: null })).toEqual({
      diem: null,
      soLuot: null,
      nhan: 'Chưa có đánh giá',
    });
  });

  it('điểm 0 là điểm HỢP LỆ và phải được hiện', () => {
    // Kiểm theo tính truthy sẽ gộp 0 vào "chưa có đánh giá" — che đi đúng con
    // số mentor cần thấy nhất.
    expect(moTaDanhGiaMentor({ ratingAverage: 0, reviewCount: 3 }).diem).toBe('0.0');
  });
});

describe('moTaTrangThaiMentor', () => {
  it('ACTIVE thì xem được hồ sơ công khai', () => {
    const moTa = moTaTrangThaiMentor('ACTIVE');

    expect(moTa.label).toBe('Hồ sơ mentor đã xác minh');
    expect(moTa.mau).toBe('success');
    expect(moTa.xemDuocHoSoCongKhai).toBe(true);
  });

  it('CHỈ ACTIVE mới xem được hồ sơ công khai', () => {
    // `MentorDiscoveryService.isDiscoverableMentor()` đòi `status == ACTIVE`, nên
    // `GET /api/mentors/{userId}` trả 404 cho mọi trạng thái khác. Dựng lối xem
    // hồ sơ cho chúng là dẫn mentor tới màn hình báo chính họ không tồn tại.
    for (const status of [
      'DRAFT',
      'PENDING_VERIFICATION',
      'PAUSED',
      'REJECTED',
      'SUSPENDED',
    ] as const) {
      expect(moTaTrangThaiMentor(status).xemDuocHoSoCongKhai).toBe(false);
    }
  });

  it('mentorStatus null (exists=false) có câu nói riêng, không phải khoảng trống', () => {
    // `MentorProfileResponse.empty()` không điền `mentorStatus`. Đây là trạng
    // thái thật của tài khoản vừa được cấp vai trò MENTOR nhưng chưa điền hồ sơ.
    const moTa = moTaTrangThaiMentor(null);

    expect(moTa.label).toBe('Chưa tạo hồ sơ mentor');
    expect(moTa.xemDuocHoSoCongKhai).toBe(false);
  });

  it('mọi giá trị MentorStatus đều có nhãn riêng, không trùng nhau', () => {
    const nhan = (
      ['DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'PAUSED', 'REJECTED', 'SUSPENDED'] as const
    ).map((s) => moTaTrangThaiMentor(s).label);

    expect(new Set(nhan).size).toBe(6);
    expect(nhan.every((l) => l.length > 0)).toBe(true);
  });
});

describe('dangBiTreoNhanBooking', () => {
  const bayGio = { nam: 2026, thang: 10, ngay: 4, gio: 12, phut: 0 };

  it('mốc treo ở tương lai thì đang bị treo', () => {
    expect(dangBiTreoNhanBooking('2026-10-05T09:00:00', bayGio)).toBe(true);
  });

  it('mốc treo đã qua thì KHÔNG còn bị treo', () => {
    expect(dangBiTreoNhanBooking('2026-10-04T11:59:00', bayGio)).toBe(false);
  });

  it('null nghĩa là không bị treo', () => {
    expect(dangBiTreoNhanBooking(null, bayGio)).toBe(false);
  });

  it('chuỗi CÓ offset bị từ chối — trường này là LocalDateTime', () => {
    // Nếu một ngày backend đổi `bookingSuspendedUntil` sang `OffsetDateTime`, dải
    // cảnh báo phải IM LẶNG biến mất chứ không được so sai: `docLocalDateTime()`
    // cố ý trả `null` cho chuỗi có offset. Test này khoá hành vi đó lại để lần
    // sau ai sửa cũng thấy ngay nó phải đổi helper.
    expect(dangBiTreoNhanBooking('2026-10-05T09:00:00+07:00', bayGio)).toBe(false);
  });

  it('chuỗi rác không làm vỡ gì', () => {
    expect(dangBiTreoNhanBooking('hôm qua', bayGio)).toBe(false);
    expect(dangBiTreoNhanBooking('2026-13-45T25:61', bayGio)).toBe(false);
  });

  it('so sánh qua mốc năm vẫn đúng', () => {
    expect(dangBiTreoNhanBooking('2027-01-01T00:00:00', bayGio)).toBe(true);
    expect(dangBiTreoNhanBooking('2025-12-31T23:59:00', bayGio)).toBe(false);
  });
});

describe('matDongHoHcm', () => {
  it('đọc ra mặt đồng hồ Việt Nam, không phụ thuộc múi giờ của máy', () => {
    // 2026-10-04T13:30:00Z là 20:30 giờ Việt Nam. CI chạy UTC, điện thoại chạy
    // UTC+7 — cả hai phải ra cùng một kết quả.
    const moc = matDongHoHcm(Date.UTC(2026, 9, 4, 13, 30, 0));

    expect(moc).toEqual({ nam: 2026, thang: 10, ngay: 4, gio: 20, phut: 30 });
  });

  it('qua nửa đêm giờ Việt Nam thì sang ngày mới', () => {
    // 2026-10-04T17:30:00Z = 00:30 ngày 05/10 giờ Việt Nam.
    expect(matDongHoHcm(Date.UTC(2026, 9, 4, 17, 30, 0))).toEqual({
      nam: 2026,
      thang: 10,
      ngay: 5,
      gio: 0,
      phut: 30,
    });
  });
});

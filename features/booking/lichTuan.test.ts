import {
  cacNgayTrongTuan,
  congNgay,
  dauTuan,
  homNayVN,
  isoNgay,
  nhanGio,
  nhanNgayCoThu,
  nhanThang,
  nhomSlotTheoNgay,
} from '@/features/booking/lichTuan';
import type { MentorAvailabilitySlotResponse } from '@/features/booking/types';

function slot(slotId: string, startTime: string, serviceIds: string[]): MentorAvailabilitySlotResponse {
  return {
    slotId,
    startTime,
    endTime: startTime,
    timezone: 'Asia/Ho_Chi_Minh',
    pendingRequestCount: 0,
    acceptedSlotCount: 0,
    services: serviceIds.map((serviceId) => ({
      serviceId,
      title: serviceId,
      durationMinutes: 45,
      isFree: false,
      priceScoin: 150_000,
      bindingRemoval: null,
    })),
  };
}

describe('homNayVN', () => {
  it('tính "hôm nay" theo giờ Việt Nam, không theo múi của máy', () => {
    // 2026-10-04 18:30 UTC = 2026-10-05 01:30 giờ Việt Nam: đã sang thứ Hai.
    expect(homNayVN(Date.UTC(2026, 9, 4, 18, 30))).toEqual({ nam: 2026, thang: 10, ngay: 5 });
    // 2026-10-04 16:59 UTC = 23:59 giờ Việt Nam: vẫn Chủ nhật.
    expect(homNayVN(Date.UTC(2026, 9, 4, 16, 59))).toEqual({ nam: 2026, thang: 10, ngay: 4 });
  });
});

describe('dauTuan và cacNgayTrongTuan', () => {
  it('Chủ nhật thuộc tuần bắt đầu từ thứ Hai TRƯỚC đó', () => {
    expect(dauTuan({ nam: 2026, thang: 10, ngay: 4 })).toEqual({ nam: 2026, thang: 9, ngay: 28 });
    expect(dauTuan({ nam: 2026, thang: 10, ngay: 5 })).toEqual({ nam: 2026, thang: 10, ngay: 5 });
  });

  it('bảy ô từ T2 tới CN, qua được ranh giới tháng', () => {
    const tuan = cacNgayTrongTuan({ nam: 2026, thang: 9, ngay: 28 });

    expect(tuan.map((o) => o.nhanThu)).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']);
    expect(tuan.map((o) => o.iso)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(tuan[6].tenThu).toBe('Chủ Nhật');
  });

  it('cộng ngày qua năm mới', () => {
    expect(isoNgay(congNgay({ nam: 2026, thang: 12, ngay: 30 }, 3))).toBe('2027-01-02');
  });

  it('tiêu đề tháng đọc theo ngày được truyền vào', () => {
    expect(nhanThang({ nam: 2026, thang: 10, ngay: 5 })).toBe('Tháng 10, 2026');
  });
});

describe('nhomSlotTheoNgay', () => {
  it('chỉ giữ slot có gắn dịch vụ đang chọn, gom theo ngày và sắp theo giờ', () => {
    const nhom = nhomSlotTheoNgay(
      [
        slot('toi', '2026-10-05T19:00:00', ['sv1']),
        slot('sang', '2026-10-05T08:00:00', ['sv1', 'sv2']),
        slot('chi-sv2', '2026-10-06T08:00:00', ['sv2']),
      ],
      'sv1',
    );

    expect([...nhom.keys()]).toEqual(['2026-10-05']);
    expect(nhom.get('2026-10-05')?.map((s) => s.slotId)).toEqual(['sang', 'toi']);
  });

  it('bỏ qua slot có giờ không đọc được thay vì đặt nó vào một ngày đoán mò', () => {
    const nhom = nhomSlotTheoNgay(
      // Chuỗi CÓ offset nghĩa là đọc nhầm kiểu — `LocalDateTime` không có offset.
      [slot('lech', '2026-10-05T19:00:00+07:00', ['sv1'])],
      'sv1',
    );

    expect(nhom.size).toBe(0);
  });
});

describe('nhãn giờ và ngày', () => {
  it('in giờ phút và thứ ngày từ LocalDateTime', () => {
    expect(nhanGio('2026-10-06T19:00:00')).toBe('19:00');
    expect(nhanNgayCoThu('2026-10-06T19:00:00')).toBe('T3, 06/10');
  });

  it('trả null với chuỗi hỏng để chỗ gọi tự xử lý', () => {
    expect(nhanGio('không phải giờ')).toBeNull();
    expect(nhanNgayCoThu(null)).toBeNull();
  });
});

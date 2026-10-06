/**
 * @file loiLichDay.test.ts
 * @description Câu lỗi của tab Lịch dạy, kiểm trên lỗi THẬT mà repo nhận được từ
 * mock studio (mock giữ đúng mã/thông điệp của `MentorAvailabilityService` và
 * `MentorServiceRetirementPortImpl`), không trên lỗi dựng tay.
 */

import { setupServer } from 'msw/node';

import { __resetApiClientForTests } from '@/core/api/client';
import { congNgay, dauTuan, homNayVN, isoNgay } from '@/core/time/lichTuan';
import { laLoiDichVuConYeuCauCho, moTaLoiNgungSlot, moTaLoiTaoSlot } from '@/features/mentorMode/loiLichDay';
import { mentorModeRepo } from '@/features/mentorMode/mentorModeRepo';
import { __resetStudioMockForTests, studioMockHandlers } from '@/features/mentorMode/mocks/studioMock';

let dem = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `khoa-${(dem += 1)}` }));

const server = setupServer(...studioMockHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  __resetApiClientForTests();
  __resetStudioMockForTests();
});
afterAll(() => server.close());

/** Thứ Hai tuần sau, giờ VN → Instant UTC */
function luc(gio: number, soNgay = 7): string {
  const n = congNgay(dauTuan(homNayVN()), soNgay);
  return new Date(Date.UTC(n.nam, n.thang - 1, n.ngay, gio - 7, 0)).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

async function loiCua(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => {
      throw new Error('lẽ ra phải lỗi');
    },
    (e: unknown) => e,
  );
}

describe('moTaLoiTaoSlot', () => {
  it('trùng giờ rảnh khác: nói "trùng", KHÔNG nói "dữ liệu đã được cập nhật"', async () => {
    const loi = await loiCua(mentorModeRepo.createSlot({ startAt: luc(8), endAt: luc(10), serviceIds: ['msv1'] }));

    expect(moTaLoiTaoSlot(loi)).toMatch(/trùng/);
  });

  it('khung dài quá 12 tiếng: câu tiếng Việt, KHÔNG lộ mã AVAILABILITY_RANGE_TOO_LARGE', async () => {
    // Thứ Tư không có slot mẫu nên không vướng luật trùng giờ.
    const loi = await loiCua(
      mentorModeRepo.createSlot({ startAt: luc(6, 9), endAt: luc(20, 9), serviceIds: ['msv1'] }),
    );

    expect(moTaLoiTaoSlot(loi)).toMatch(/tối đa 12 tiếng/);
    expect(moTaLoiTaoSlot(loi)).not.toMatch(/AVAILABILITY/);
  });
});

describe('moTaLoiNgungSlot', () => {
  it('slot sinh từ lịch lặp: nói phải chỉnh lịch lặp trên web', async () => {
    const id = `ms-${isoNgay(congNgay(dauTuan(homNayVN()), 8))}-sang`;
    const loi = await loiCua(mentorModeRepo.deactivateSlot(id, { expectedVersion: 0 }, 'khoa-ngung-1'));

    expect(moTaLoiNgungSlot(loi)).toMatch(/lịch lặp hàng tuần/);
  });
});

describe('laLoiDichVuConYeuCauCho', () => {
  it('tắt dịch vụ còn yêu cầu chờ → nhận ra; gửi kèm rejectPendingBookings thì tắt được', async () => {
    const loi = await loiCua(mentorModeRepo.setServiceActive('msv2', { isActive: false, expectedVersion: 1 }));
    expect(laLoiDichVuConYeuCauCho(loi)).toBe(true);

    const daTat = await mentorModeRepo.setServiceActive('msv2', {
      isActive: false,
      expectedVersion: 1,
      rejectPendingBookings: true,
    });
    expect(daTat.isActive).toBe(false);
  });
});

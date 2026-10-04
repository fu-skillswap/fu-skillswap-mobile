/**
 * @file datLich.test.ts
 * @description Kiểm mock của luồng đặt lịch bằng REPO THẬT (đi qua `apiClient` và
 * envelope), và kiểm các hàm sinh fixture với một đồng hồ cố định.
 */

import { setupServer } from 'msw/node';

import { __resetApiClientForTests } from '@/core/api/client';
import { ApiClientError } from '@/core/api/errors';
import { docLocalDateTime } from '@/core/time/localDateTime';
import { docOffsetDateTime } from '@/core/time/offsetDateTime';
import { bookingRepo } from '@/features/booking/bookingRepo';
import { taoBaoGia, taoKhungGio, taoLichRanh } from '@/features/booking/mocks/datLichFixture';
import { bookingMockHandlers } from '@/features/booking/mocks/handlers';

const server = setupServer(...bookingMockHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => __resetApiClientForTests());
afterAll(() => server.close());

/** Thứ Hai 05/10/2026, 07:00 giờ Việt Nam */
const BAY_GIO = Date.UTC(2026, 9, 5, 0, 0);

describe('fixture lịch rảnh', () => {
  it('chỉ sinh khung CHƯA bắt đầu, bỏ ngày nghỉ, giờ không offset', () => {
    const lich = taoLichRanh('m1', '2026-10-05', '2026-10-11', BAY_GIO);

    // Mentor nghỉ thứ Tư (07/10) và Chủ nhật (11/10).
    const ngay = new Set(lich.map((s) => s.startTime.slice(0, 10)));
    expect(ngay.has('2026-10-07')).toBe(false);
    expect(ngay.has('2026-10-11')).toBe(false);
    expect(ngay.has('2026-10-05')).toBe(true);
    for (const s of lich) {
      expect(docLocalDateTime(s.startTime)).not.toBeNull();
      expect(s.services.length).toBeGreaterThan(0);
    }
  });

  it('khung giờ dài đúng thời lượng dịch vụ, có cả ô bị chặn, startAt là Instant UTC', () => {
    const toi = taoLichRanh('m1', '2026-10-05', '2026-10-05', BAY_GIO).find((s) =>
      s.startTime.endsWith('19:00:00'),
    );
    const dichVu = toi?.services[0];
    const khung = toi && dichVu ? taoKhungGio(toi.slotId, dichVu.serviceId, BAY_GIO) : null;

    expect(khung?.serviceDurationMinutes).toBe(dichVu?.durationMinutes);
    expect(khung?.candidateServiceSlots.some((k) => !k.isSelectable)).toBe(true);
    expect(khung?.candidateServiceSlots[0].startAt).toBe('2026-10-05T12:00:00Z');
    expect(khung?.candidateServiceSlots[0].startTime).toBe('2026-10-05T19:00:00');
  });

  it('báo giá từ chối khung bị chặn, chấp nhận khung trống và có offset', () => {
    const toi = taoLichRanh('m1', '2026-10-05', '2026-10-05', BAY_GIO).find((s) =>
      s.startTime.endsWith('19:00:00'),
    );
    const serviceId = toi?.services[0].serviceId ?? '';
    const khung = toi ? taoKhungGio(toi.slotId, serviceId, BAY_GIO) : null;
    const trong = khung?.candidateServiceSlots.find((k) => k.isSelectable);
    const chan = khung?.candidateServiceSlots.find((k) => !k.isSelectable);

    expect(taoBaoGia(toi?.slotId ?? '', serviceId, chan?.startAt ?? '', BAY_GIO)).toBeNull();
    const baoGia = taoBaoGia(toi?.slotId ?? '', serviceId, trong?.startAt ?? '', BAY_GIO);
    expect(docOffsetDateTime(baoGia?.scheduledStartAt)).not.toBeNull();
  });
});

describe('handler mock của luồng đặt lịch, đọc bằng repo thật', () => {
  it('đi trọn luồng: lịch rảnh → khung giờ → báo giá → tạo booking', async () => {
    const lich = await bookingRepo.getAvailabilitySlots('m1', '', '');
    expect(lich.length).toBeGreaterThan(0);

    const slot = lich[0];
    const serviceId = slot.services[0].serviceId;
    const khung = await bookingRepo.getSlotCandidates('m1', slot.slotId, serviceId);
    const chon = khung.candidateServiceSlots.find((k) => k.isSelectable);
    expect(chon).toBeDefined();

    const baoGia = await bookingRepo.quoteBooking({
      slotId: slot.slotId,
      serviceId,
      startAt: chon?.startAt ?? '',
    });
    expect(baoGia.serviceId).toBe(serviceId);

    const booking = await bookingRepo.createBooking(
      {
        slotId: slot.slotId,
        serviceId,
        startAt: chon?.startAt ?? '',
        learningGoalTitle: 'Sửa CV',
      },
      'khoa-thu-1',
    );
    expect(booking.bookingStatus).toBe('REQUESTED');
    expect(booking.learningGoalTitle).toBe('Sửa CV');

    // Booking mới phải xuất hiện ở đầu danh sách của mentee.
    const trang = await bookingRepo.getMyBookings({});
    expect(trang.content[0].bookingId).toBe(booking.bookingId);
  });

  it('tạo booking thiếu Idempotency-Key bị từ chối như backend', async () => {
    const lich = await bookingRepo.getAvailabilitySlots('m1', '', '');
    const slot = lich[0];

    await expect(
      bookingRepo.createBooking(
        {
          slotId: slot.slotId,
          serviceId: slot.services[0].serviceId,
          startAt: '2026-10-05T01:00:00Z',
          learningGoalTitle: 'x',
        },
        // Khuôn key không hợp lệ với `IdempotencyAspect.SAFE_KEY_PATTERN`.
        'có dấu cách',
      ),
    ).rejects.toBeInstanceOf(ApiClientError);
  });

  it('báo giá một khung không tồn tại trả 409', async () => {
    await expect(
      bookingRepo.quoteBooking({ slotId: 'khong-co', serviceId: 'x', startAt: '2026-10-05T01:00:00Z' }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

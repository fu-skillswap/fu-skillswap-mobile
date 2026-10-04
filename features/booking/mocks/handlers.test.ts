/**
 * @file handlers.test.ts
 * @description Kiểm handler mock của nhánh booking bằng cách cho REPO THẬT đọc nó.
 *
 * Không có một assertion nào nhìn trực tiếp vào fixture rồi so với chính nó:
 * fixture bịa sai hình dạng DTO là lớp lỗi repo này đã dính nhiều lần, và chỉ
 * đường đi `bookingRepo → apiClient → envelope` mới bắt được. Nhãn trạng thái
 * cũng được kiểm qua chính `nhanTrangThaiBooking()` — hàm mà giao diện dùng —
 * thay vì so chuỗi bằng tay.
 */

import { setupServer } from 'msw/node';

import { __resetApiClientForTests, apiClient } from '@/core/api/client';
import { ApiClientError } from '@/core/api/errors';
import { getNextPageNumber } from '@/core/api/pagination';
import { docOffsetDateTime } from '@/core/time/offsetDateTime';
import { bookingRepo } from '@/features/booking/bookingRepo';
import { nhanTrangThaiBooking } from '@/features/booking/bookingStatus';
import { bookingMockHandlers } from '@/features/booking/mocks/handlers';

const server = setupServer(...bookingMockHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => __resetApiClientForTests());
afterAll(() => server.close());

/** Lấy toàn bộ danh sách trong một lần, bỏ qua phân trang */
function layTatCa() {
  return bookingRepo.getMyBookings({ size: 100 });
}

describe('handler mock của nhánh booking', () => {
  it('danh sách trả về ĐÚNG hình dạng PageResponse mà repo thật mong đợi', async () => {
    const trang = await bookingRepo.getMyBookings({});

    expect(trang.content.length).toBeGreaterThan(0);
    expect(trang.page).toBe(0);
    expect(typeof trang.totalElements).toBe('number');
    expect(typeof trang.last).toBe('boolean');
  });

  it('mỗi booking có ĐỦ các trường không-null mà giao diện đọc', async () => {
    const trang = await layTatCa();

    for (const booking of trang.content) {
      expect(booking.bookingId).toBeTruthy();
      expect(booking.mentorUserId).toBeTruthy();
      expect(booking.learningGoalTitle).toBeTruthy();
      expect(booking.bookingStatus).toBeTruthy();
      expect(booking.displayState).toBeTruthy();
      // Cờ `can*` là `boolean` NGUYÊN THUỶ trong Java nên không bao giờ null;
      // một fixture để `undefined` sẽ làm `BookingCard` đọc ra falsy một cách
      // tình cờ và không nút nào hiện ra.
      expect(typeof booking.canCancel).toBe('boolean');
      expect(typeof booking.canJoin).toBe('boolean');
      expect(typeof booking.canPay).toBe('boolean');
      expect(typeof booking.canSubmitFeedback).toBe('boolean');
      // `attendance` và `cancellationRefundPolicy` là object không-null trong
      // mapper của backend; `CancelBookingSheet` đọc thẳng vào trường thứ hai.
      expect(typeof booking.attendance.currentUserCheckedIn).toBe('boolean');
      expect(typeof booking.cancellationRefundPolicy.earlyMenteeRefundPercent).toBe('number');
    }
  });

  it('mốc thời gian CÓ offset, đọc được bằng core/time/offsetDateTime', async () => {
    const trang = await layTatCa();
    const coMoc = trang.content.filter((booking) => booking.selectedStartTime !== null);

    expect(coMoc.length).toBeGreaterThan(0);
    for (const booking of coMoc) {
      // Đi qua chính hàm mà giao diện dùng: một fixture viết không-offset sẽ làm
      // `docOffsetDateTime` trả `null` và thẻ không in được ngày nào.
      expect(docOffsetDateTime(booking.selectedStartTime)).not.toBeNull();
      expect(docOffsetDateTime(booking.selectedEndTime)).not.toBeNull();
      expect(booking.selectedStartTime).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/,
      );
    }
    expect(docOffsetDateTime(trang.content[0].createdAt)).not.toBeNull();
  });

  it('có booking KHÔNG có mốc thời gian — nhánh bỏ dải ngày/giờ phải xem được', async () => {
    // `selectedStartTime` là nullable thật: mapper gán `null` khi slot gốc đã bị
    // xoá. Thiếu fixture này thì nhánh đó chỉ tồn tại trong code.
    const trang = await layTatCa();

    expect(trang.content.some((booking) => booking.selectedStartTime === null)).toBe(true);
  });

  it('phủ ĐỦ mọi nhãn trạng thái mà giao diện biết nói', async () => {
    // Thiếu một nhãn thì nhãn đó không bao giờ xem được trên máy, và một tone
    // màu sai sẽ không ai phát hiện.
    const trang = await layTatCa();
    const nhan = new Set(trang.content.map((booking) => nhanTrangThaiBooking(booking).label));

    for (const canCo of [
      'Đang chờ',
      'Chờ thanh toán',
      'Sắp diễn ra',
      'Đang diễn ra',
      'Chờ xác nhận',
      'Đã hoàn thành',
      'Vắng mặt',
      'Bị từ chối',
      'Quá hạn',
      'Quá hạn thanh toán',
      'Mentee hủy',
      'Mentor hủy',
      'Đang xử lý khiếu nại',
    ]) {
      expect([...nhan]).toContain(canCo);
    }
  });

  it('có booking cho mỗi BookingStatus legacy mà hàng chip lọc theo', async () => {
    const trang = await layTatCa();
    const trangThai = new Set(trang.content.map((booking) => booking.status));

    expect([...trangThai]).toContain('PENDING');
    expect([...trangThai]).toContain('PAID');
    expect([...trangThai]).toContain('COMPLETED');
    // Và CỐ Ý không có `AWAITING_MENTEE_CONFIRMATION`: chip "Chờ bạn xác nhận"
    // phải là một nhóm rỗng để `EmptyState` xem được trên máy.
    expect([...trangThai]).not.toContain('AWAITING_MENTEE_CONFIRMATION');
  });

  it('lọc theo status LÀM THẬT, và lọc theo enum LEGACY chứ không theo lifecycle', async () => {
    const tatCa = await layTatCa();
    const dangCho = await bookingRepo.getMyBookings({ status: 'PENDING', size: 100 });

    expect(dangCho.content.length).toBeGreaterThan(0);
    // Không có vế này thì một handler trả nguyên danh sách vẫn xanh.
    expect(dangCho.content.length).toBeLessThan(tatCa.content.length);
    expect(dangCho.content.every((booking) => booking.status === 'PENDING')).toBe(true);

    // `AWAITING_MENTOR_COMPLETION` quy về `CONFIRMED` giống `PAID`, nên lọc theo
    // `PAID` KHÔNG được kéo nó về — đó là đúng hành vi của backend, và cũng là
    // lý do chip "Đã xác nhận" không nhìn thấy nhóm chờ xác nhận.
    const daXacNhan = await bookingRepo.getMyBookings({ status: 'PAID', size: 100 });
    expect(daXacNhan.content.every((booking) => booking.status === 'PAID')).toBe(true);
    expect(daXacNhan.content.some((booking) => booking.bookingStatus === 'CONFIRMED')).toBe(true);
    expect(
      daXacNhan.content.some((booking) => booking.displayState === 'WAITING_CONFIRMATION'),
    ).toBe(false);
  });

  it('nhóm rỗng trả về trang RỖNG, không phải lỗi', async () => {
    const trang = await bookingRepo.getMyBookings({ status: 'AWAITING_MENTEE_CONFIRMATION' });

    expect(trang.content).toHaveLength(0);
    expect(trang.totalElements).toBe(0);
    expect(trang.last).toBe(true);
    expect(getNextPageNumber(trang)).toBeUndefined();
  });

  it('phân trang THẬT: trang đầu chưa phải trang cuối khi fixture nhiều hơn size', async () => {
    const trangDau = await bookingRepo.getMyBookings({ page: 0, size: 2 });

    expect(trangDau.content).toHaveLength(2);
    expect(trangDau.last).toBe(false);
    // Đi qua chính hàm mà `useInfiniteQuery` dùng: `last` sai thì danh sách hoặc
    // dừng sớm, hoặc xin mãi một trang không tồn tại.
    expect(getNextPageNumber(trangDau)).toBe(1);

    const trangKe = await bookingRepo.getMyBookings({ page: 1, size: 2 });
    expect(trangKe.content[0].bookingId).not.toBe(trangDau.content[0].bookingId);

    const trangCuoi = await bookingRepo.getMyBookings({ size: 100 });
    expect(trangCuoi.last).toBe(true);
  });

  it('danh sách mặc định nhiều hơn một trang — việc cuộn tải thêm xem được thật', async () => {
    const trang = await bookingRepo.getMyBookings({});

    expect(trang.content).toHaveLength(10);
    expect(trang.last).toBe(false);
  });

  it('có booking mentoring OFFLINE: canJoin đúng mà KHÔNG có link, chỉ có địa điểm', async () => {
    const trang = await layTatCa();

    const offline = trang.content.filter(
      (booking) => booking.canJoin && (booking.meetingLink ?? '') === '',
    );
    expect(offline.length).toBeGreaterThan(0);
    expect(offline.every((booking) => (booking.location ?? '').length > 0)).toBe(true);

    // Và có booking online để nút "Vào phòng học" hiện ra được.
    const online = trang.content.filter(
      (booking) => booking.canJoin && (booking.meetingLink ?? '') !== '',
    );
    expect(online.length).toBeGreaterThan(0);
  });

  it('có booking mentorDisplayName null và booking serviceTitle null', async () => {
    const trang = await layTatCa();

    expect(trang.content.some((booking) => booking.mentorDisplayName === null)).toBe(true);
    expect(trang.content.some((booking) => booking.serviceTitle === null)).toBe(true);
    // Nhưng `learningGoalTitle` thì KHÔNG được null ở đâu cả — nó là chỗ dự
    // phòng cuối cùng của thẻ.
    expect(trang.content.every((booking) => booking.learningGoalTitle.length > 0)).toBe(true);
  });

  it('giữ nguyên canPay/canSubmitFeedback của backend, dù giao diện cố ý không dùng', async () => {
    // Fixture phải nói đúng những gì backend nói. Nếu ta sửa chúng về `false`
    // cho tiện thì test canh "KHÔNG có lối thanh toán" sẽ xanh vì một lý do sai.
    const trang = await layTatCa();

    expect(trang.content.some((booking) => booking.canPay)).toBe(true);
    expect(trang.content.some((booking) => booking.canSubmitFeedback)).toBe(true);
  });

  it('hỏi một booking không tồn tại thì lỗi 404 đúng mã của backend', async () => {
    // `ErrorView` đọc `status`/`code` để chọn thông điệp; trả 200 với `data: null`
    // ở đây sẽ làm màn hình trắng trơn thay vì hiện lỗi.
    const err = await apiClient('/api/me/bookings/khong-ton-tai').then(
      () => null,
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(404);
    expect((err as ApiClientError).code).toBe('SYS_0003');
  });

  it('hủy lịch THIẾU Idempotency-Key bị từ chối 400, đúng như IdempotencyAspect', async () => {
    // Đây là cái bẫy đắt nhất của endpoint này: header thiếu thì backend trả 400
    // mà câu lỗi không hề nhắc tới lý do hủy, nên rất dễ bị đọc sai. Handler mock
    // phải từ chối y như vậy, nếu không chế độ mock sẽ "hủy thành công" trong khi
    // backend thật từ chối mọi lần.
    const err = await huyVoiKhoa('b2', 'Em xin hủy', '');

    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(400);
    expect((err as ApiClientError).message).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('hủy lịch THIẾU lý do bị từ chối 400 — cancelReason là @NotBlank', async () => {
    const err = await huyVoiKhoa('b2', '   ', 'khoa-hop-le-1');

    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(400);
  });

  it('hủy một booking KHÔNG cho hủy thì 409, không phải thành công im lặng', async () => {
    // `b6` đã hoàn thành nên `canCancel = false`.
    const err = await huyVoiKhoa('b6', 'Em xin hủy', 'khoa-hop-le-2');

    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(409);
  });

  it('hủy thành công thì danh sách tải lại THẬT SỰ đổi trạng thái', async () => {
    // Test này đứng CUỐI vì nó đổi dữ liệu dùng chung của handler. Một mock trả
    // về nguyên trạng sau khi hủy làm nút "Hủy lịch" trông như không có tác dụng
    // khi xem trên máy.
    const truoc = await layTatCa();
    const sapHuy = truoc.content.find((booking) => booking.bookingId === 'b14');
    expect(sapHuy?.canCancel).toBe(true);

    const daHuy = await bookingRepo.cancelBooking(
      'b14',
      { cancelReason: 'Em có lịch thi đột xuất nên xin hủy.' },
      'khoa-hop-le-3',
    );

    expect(daHuy.bookingStatus).toBe('CANCELED_BY_MENTEE');
    expect(daHuy.canCancel).toBe(false);
    expect(nhanTrangThaiBooking(daHuy).label).toBe('Mentee hủy');

    const sau = await layTatCa();
    expect(sau.content.find((booking) => booking.bookingId === 'b14')?.bookingStatus).toBe(
      'CANCELED_BY_MENTEE',
    );
  });
});

/** Gọi hủy lịch với một key cho trước và trả về lỗi (hoặc `null` nếu thành công) */
async function huyVoiKhoa(
  bookingId: string,
  cancelReason: string,
  khoa: string,
): Promise<unknown> {
  return bookingRepo.cancelBooking(bookingId, { cancelReason }, khoa).then(
    () => null,
    (e: unknown) => e,
  );
}

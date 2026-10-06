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
import { MOCK_USER } from '@/core/auth/mocks/handlers';
import { bookingRepo } from '@/features/booking/bookingRepo';
import { mentorBookingRepo } from '@/features/booking/mentorBookingRepo';
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

describe('handler mock của nhánh booking — góc nhìn MENTOR', () => {
  /** Lấy toàn bộ danh sách phía mentor trong một lần */
  function layTatCaMentor() {
    return bookingRepo.getMyBookings({ role: 'MENTOR', size: 100 });
  }

  it('role=MENTOR trả về một danh sách KHÁC HẲN role=MENTEE', async () => {
    // Backend thật hỏi hai cột khác nhau (`menteeUserId` so `mentorUserId`), và
    // người dùng mock có cả hai vai trò. Một handler bỏ qua `role` sẽ cho tab
    // Booking của mentor hiện đúng các buổi người đó đã ĐẶT với mentor khác —
    // trông hoàn toàn bình thường và sai hoàn toàn.
    const mentee = await layTatCa();
    const mentor = await layTatCaMentor();

    const idMentee = new Set(mentee.content.map((b) => b.bookingId));
    const idMentor = mentor.content.map((b) => b.bookingId);

    expect(idMentor.length).toBeGreaterThan(0);
    expect(idMentor.some((id) => idMentee.has(id))).toBe(false);
  });

  it('KHÔNG truyền role thì mặc định MENTEE, đúng như BookingListRequest', async () => {
    // `BookingListRequest.role` khởi tạo bằng `BookingViewRole.MENTEE`. Mock mặc
    // định sang MENTOR sẽ che đi đúng lỗi "quên gửi role".
    const khongRole = await apiClient<{ content: { bookingId: string }[] }>('/api/me/bookings', {
      params: { size: 100 },
    });
    const mentee = await layTatCa();

    expect(khongRole.content.map((b) => b.bookingId)).toEqual(
      mentee.content.map((b) => b.bookingId),
    );
  });

  it('mọi booking phía mentor có mentorUserId là chính người dùng mock', async () => {
    const mentor = await layTatCaMentor();

    expect(mentor.content.every((b) => b.mentorUserId === MOCK_USER.publicId)).toBe(true);
    // `menteeDisplayName` là trường mà thẻ phía mentor đọc — phải có người thật ở
    // ít nhất một số booking, kèm một trường hợp `null` để kiểm chỗ dự phòng.
    expect(mentor.content.some((b) => (b.menteeDisplayName ?? '') !== '')).toBe(true);
    expect(mentor.content.some((b) => b.menteeDisplayName === null)).toBe(true);
  });

  it('có booking cho mỗi BookingStatus mà hàng chip của mentor lọc theo', async () => {
    const mentor = await layTatCaMentor();
    const trangThai = new Set(mentor.content.map((b) => b.status));

    for (const canCo of ['PENDING', 'PAID', 'AWAITING_MENTOR_COMPLETION', 'COMPLETED']) {
      expect([...trangThai]).toContain(canCo);
    }
  });

  it('lọc theo status LÀM THẬT ở góc nhìn mentor', async () => {
    const tatCa = await layTatCaMentor();
    const dangCho = await bookingRepo.getMyBookings({
      role: 'MENTOR',
      status: 'PENDING',
      size: 100,
    });

    expect(dangCho.content.length).toBeGreaterThan(0);
    expect(dangCho.content.length).toBeLessThan(tatCa.content.length);
    expect(dangCho.content.every((b) => b.status === 'PENDING')).toBe(true);
  });

  it('size=1 vẫn trả totalElements ĐÚNG — dải nhắc việc dựa vào đúng con số này', async () => {
    // `useMentorBookingCount` xin `size: 1` và đọc `totalElements`. Nếu mock trả
    // `totalElements` bằng số phần tử của TRANG thì dải nhắc việc luôn nói
    // "1 yêu cầu" bất kể thực tế.
    const day = await bookingRepo.getMyBookings({ role: 'MENTOR', status: 'PENDING', size: 100 });
    const mot = await bookingRepo.getMyBookings({ role: 'MENTOR', status: 'PENDING', size: 1 });

    expect(mot.content).toHaveLength(1);
    expect(mot.totalElements).toBe(day.content.length);
    expect(mot.totalElements).toBeGreaterThan(1);
  });

  it('danh sách mentor nhiều hơn một trang — việc cuộn tải thêm xem được thật', async () => {
    const trang = await bookingRepo.getMyBookings({ role: 'MENTOR' });

    expect(trang.content).toHaveLength(10);
    expect(trang.last).toBe(false);
    expect(getNextPageNumber(trang)).toBe(1);
  });

  it('phủ các nhãn trạng thái mà thẻ phía mentor sẽ hiện, kể cả "Vắng mặt"', async () => {
    const mentor = await layTatCaMentor();
    const nhan = new Set(mentor.content.map((b) => nhanTrangThaiBooking(b).label));

    for (const canCo of [
      'Đang chờ',
      'Sắp diễn ra',
      'Đang diễn ra',
      'Chờ xác nhận',
      'Đã hoàn thành',
      'Vắng mặt',
      'Mentee hủy',
    ]) {
      expect([...nhan]).toContain(canCo);
    }
  });

  it('giữ nguyên canAccept/canReject của backend dù giao diện cố ý không dùng', async () => {
    // Nếu ta sửa chúng về `false` cho tiện thì test canh "KHÔNG có nút Xác nhận"
    // sẽ xanh vì một lý do sai.
    const mentor = await layTatCaMentor();

    expect(mentor.content.some((b) => b.canAccept && b.canReject)).toBe(true);
  });

  it('có buổi miễn phí, buổi có giá, và buổi không gắn service', async () => {
    const mentor = await layTatCaMentor();

    expect(mentor.content.some((b) => b.serviceIsFreeSnapshot === true)).toBe(true);
    expect(mentor.content.some((b) => (b.servicePriceScoinSnapshot ?? 0) > 0)).toBe(true);
    expect(
      mentor.content.some(
        (b) => b.serviceIsFreeSnapshot === null && b.servicePriceScoinSnapshot === null,
      ),
    ).toBe(true);
  });

  it('có buổi mentor check-in được, và có buổi OFFLINE chỉ có địa điểm', async () => {
    const mentor = await layTatCaMentor();

    expect(mentor.content.some((b) => b.attendance.canCheckIn)).toBe(true);
    expect(
      mentor.content.some(
        (b) => b.canJoin && (b.meetingLink ?? '') === '' && (b.location ?? '') !== '',
      ),
    ).toBe(true);
    expect(mentor.content.some((b) => b.canJoin && (b.meetingLink ?? '') !== '')).toBe(true);
  });

  it('check-in THIẾU Idempotency-Key bị từ chối 400', async () => {
    const err = await bookingRepo.checkIn('mb1', '').then(
      () => null,
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(400);
    expect((err as ApiClientError).message).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('check-in ngoài cửa sổ cho phép thì 409, KHÔNG phải 400', async () => {
    // `SessionAttendanceService.checkIn()` ném `RESOURCE_CONFLICT` khi
    // `SessionAttendancePolicy.canCheckIn()` không đồng ý. Mock trả 400 ở đây sẽ
    // làm khối lỗi của màn hình hiện một câu khác hẳn câu người dùng thật thấy.
    const err = await bookingRepo.checkIn('mb4', 'khoa-checkin-1').then(
      () => null,
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).status).toBe(409);
  });

  it('check-in thành công thì cờ canCheckIn tắt VÀ danh sách tải lại đổi thật', async () => {
    // Test này đứng gần cuối vì nó đổi dữ liệu dùng chung của handler.
    const daCheckIn = await bookingRepo.checkIn('mb1', 'khoa-checkin-2');

    expect(daCheckIn.attendance.currentUserCheckedIn).toBe(true);
    expect(daCheckIn.attendance.canCheckIn).toBe(false);
    // Backend chuyển `session.status` sang `IN_PROGRESS`, thứ làm `displayState`
    // thành `IN_SESSION` — tức là đổi cả NHÃN trên thẻ.
    expect(nhanTrangThaiBooking(daCheckIn).label).toBe('Đang diễn ra');

    const sau = await layTatCaMentor();
    expect(sau.content.find((b) => b.bookingId === 'mb1')?.attendance.canCheckIn).toBe(false);
  });

  it('check-in LẦN HAI vẫn thành công, không báo lỗi', async () => {
    // `SessionAttendanceService.checkIn()` trả booking nguyên trạng khi đã có bản
    // ghi điểm danh cho vai trò đó. Mock trả 409 cho lần thứ hai sẽ làm nút
    // "Check-in" trông như hỏng ở đúng tình huống nó phải êm (bấm lại sau lỗi
    // mạng).
    const lai = await bookingRepo.checkIn('mb1', 'khoa-checkin-2');

    expect(lai.attendance.currentUserCheckedIn).toBe(true);
  });
});

describe('handler mock — việc của MENTEE sau buổi học', () => {
  it('có booking để xem được nút "Điểm danh" và "Xác nhận đã học" trên máy', async () => {
    const trang = await bookingRepo.getMyBookings({ page: 0, size: 50 });

    expect(trang.content.some((b) => b.attendance.canCheckIn)).toBe(true);
    expect(trang.content.some((b) => b.canConfirmByMentee)).toBe(true);
  });

  it('mentee check-in b1: tắt canCheckIn, ghi giờ của MENTEE, gửi lại vẫn êm', async () => {
    const daCheckIn = await bookingRepo.checkIn('b1', 'khoa-mentee-checkin');

    expect(daCheckIn.attendance.canCheckIn).toBe(false);
    expect(daCheckIn.attendance.menteeCheckedInAt).not.toBeNull();
    const lai = await bookingRepo.checkIn('b1', 'khoa-mentee-checkin');
    expect(lai.attendance.currentUserCheckedIn).toBe(true);
  });

  it('xác nhận đã học: thiếu key thì 400, đủ key thì COMPLETED và danh sách đổi thật', async () => {
    const thieuKhoa = await bookingRepo.confirmByMentee('b5', {}, '').then(
      () => null,
      (e: unknown) => e,
    );
    expect((thieuKhoa as ApiClientError).status).toBe(400);

    const daXacNhan = await bookingRepo.confirmByMentee('b5', {}, 'khoa-xac-nhan');
    expect(daXacNhan.bookingStatus).toBe('COMPLETED');
    expect(daXacNhan.canConfirmByMentee).toBe(false);

    const sau = await bookingRepo.getMyBookings({ page: 0, size: 50 });
    expect(sau.content.find((b) => b.bookingId === 'b5')?.status).toBe('COMPLETED');
  });

  it('xác nhận một booking không ở trạng thái chờ thì 409', async () => {
    const loi = await bookingRepo.confirmByMentee('b2', {}, 'khoa-xac-nhan-b2').then(
      () => null,
      (e: unknown) => e,
    );
    expect((loi as ApiClientError).status).toBe(409);
  });
});

describe('handler mock: mentor hoàn tất / huỷ', () => {
  it('hoàn tất buổi "Chờ bạn xác nhận" chuyển sang chờ mentee, gửi lại vẫn thành công', async () => {
    const xong = await mentorBookingRepo.completeBooking('mb5', {}, 'khoa-hoan-tat-1');
    expect(xong.status).toBe('AWAITING_MENTEE_CONFIRMATION');
    expect(xong.canCompleteByMentor).toBe(false);

    const lai = await mentorBookingRepo.completeBooking('mb5', {}, 'khoa-hoan-tat-2');
    expect(lai.status).toBe('AWAITING_MENTEE_CONFIRMATION');
  });

  it('hoàn tất booking không ở AWAITING_MENTOR_COMPLETION thì 409', async () => {
    await expect(mentorBookingRepo.completeBooking('mb2', {}, 'khoa-hoan-tat-3')).rejects.toMatchObject({ status: 409 });
  });

  it('huỷ thiếu lý do thì 400; có lý do thì booking sang mentor huỷ', async () => {
    await expect(mentorBookingRepo.cancelBooking('mb4', { cancelReason: ' ' }, 'khoa-huy-1')).rejects.toBeInstanceOf(
      ApiClientError,
    );
    const daHuy = await mentorBookingRepo.cancelBooking('mb4', { cancelReason: 'Ốm' }, 'khoa-huy-2');
    expect(daHuy.bookingStatus).toBe('CANCELED_BY_MENTOR');
    expect(daHuy.canCancel).toBe(false);
  });
});

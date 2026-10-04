/**
 * @file handlers.ts
 * @description Handler MSW cho `/api/me/bookings/*` dùng trong CHẾ ĐỘ MOCK của app.
 *
 * Đây KHÔNG phải handler của test — lý do tách hai thứ ghi đầy đủ ở
 * `core/auth/mocks/handlers.ts`. Handler ở đây mô tả "một thế giới hợp lý để xem
 * giao diện"; handler trong từng file test mô tả "đúng một tình huống đang kiểm".
 * Hình dạng DTO thì dùng chung một xưởng (`bookingFixture.ts`) — xem JSDoc của
 * file đó.
 *
 * ## Dữ liệu cố ý phủ đủ MỌI nhãn trạng thái
 *
 * Mười bốn booking dưới đây cho ra đủ 13 nhãn mà `bookingStatus.ts` biết nói:
 * Đang chờ · Chờ thanh toán · Sắp diễn ra · Đang diễn ra · Chờ xác nhận ·
 * Đã hoàn thành · Vắng mặt · Bị từ chối · Quá hạn · Quá hạn thanh toán ·
 * Mentee hủy · Mentor hủy · Đang xử lý khiếu nại. Thiếu một nhãn thì nhãn đó
 * không bao giờ xem được trên máy, và một tone màu sai sẽ không ai phát hiện.
 *
 * Ngoài ra có chủ ý:
 *
 * - **`b1`** đang diễn ra, `canJoin = true` và CÓ `meetingLink` → nút "Vào phòng
 *   học" hiện ra thật.
 * - **`b4`** `meetingPlatform = OFFLINE`, không có link mà có `location` →
 *   nhánh "hiện địa điểm, không dựng nút" của `BookingCard` có cái để hiện.
 * - **`b9`** có `selectedStartTime`/`selectedEndTime` là `null` (slot gốc đã bị
 *   xoá — mapper của backend thật gán `null` trong trường hợp đó) → nhánh "bỏ hẳn
 *   dải ngày/giờ" được kiểm.
 * - **`b12`** có `mentorDisplayName = null`, **`b13`** có `serviceTitle = null` →
 *   hai chỗ dự phòng của thẻ có cái để dự phòng.
 * - **14 booking > `size` mặc định 10** → việc cuộn tải thêm xem được thật.
 * - **KHÔNG có booking nào ở `AWAITING_MENTEE_CONFIRMATION`** → chip "Chờ bạn
 *   xác nhận" là một nhóm RỖNG, nên `EmptyState` xem được trên máy. Nhãn
 *   "Chờ xác nhận" vẫn hiện, do `b5` mang `AWAITING_MENTOR_COMPLETION` (cùng quy
 *   về `BookingLifecycleStatus.CONFIRMED` + `displayState = WAITING_CONFIRMATION`).
 *
 * ## Mốc thời gian CÓ OFFSET
 *
 * Khác nhánh mentor: mọi trường thời gian của `BookingResponse.java` là
 * `OffsetDateTime` và `BookingTime.toOffsetDateTime()` gắn múi
 * `Asia/Ho_Chi_Minh`, nên lên dây chúng là `"2026-10-04T20:30:00+07:00"`. Viết
 * chuỗi KHÔNG offset ở đây là dựng một backend khác backend thật, và
 * `core/time/offsetDateTime.ts` sẽ trả `null` cho mọi mốc.
 *
 * ## Lọc và phân trang làm THẬT
 *
 * `status` lọc theo `BookingStatus` LEGACY đúng như `BookingListRequest`, và
 * không truyền `status` thì trả danh sách dashboard. Handler trả nguyên danh sách
 * bất kể tham số thì khi xem trên máy, hàng chip trông y như đang hỏng.
 */

import { http } from 'msw';

import type { PageResponse } from '@/core/api/pagination';
import { getEnv } from '@/core/config/env';
import { jsonMock } from '@/core/dev/jsonMock';
import { taoBooking } from '@/features/booking/mocks/bookingFixture';
import type { BookingResponse } from '@/features/booking/types';

const base = getEnv().apiUrl;

/** Bọc dữ liệu vào envelope `ApiResponse<T>` đúng như backend trả về */
function envelope(data: unknown) {
  return {
    timestamp: new Date().toISOString(),
    status: 200,
    code: 'SUCCESS_0200',
    message: 'Thành công',
    data,
  };
}

/** Phản hồi lỗi theo đúng khuôn envelope của backend */
function loi(status: number, code: string, message: string) {
  return jsonMock(
    { timestamp: new Date().toISOString(), status, code, message, data: null },
    { status },
  );
}

/**
 * Cắt một mảng thành đúng trang mà backend sẽ trả về.
 *
 * `last` là NGUỒN SỰ THẬT mà `getNextPageNumber` dựa vào; tính sai ở đây thì hoặc
 * danh sách dừng sớm, hoặc nó xin mãi một trang không tồn tại.
 */
function layTrang<T>(tatCa: T[], page: number, size: number): PageResponse<T> {
  const batDau = page * size;
  return {
    content: tatCa.slice(batDau, batDau + size),
    page,
    size,
    totalElements: tatCa.length,
    totalPages: Math.max(1, Math.ceil(tatCa.length / size)),
    last: batDau + size >= tatCa.length,
  };
}

/**
 * Danh sách booking của mentee.
 *
 * `let` chứ không `const`: handler hủy lịch ghi đè đúng phần tử tương ứng, để sau
 * khi hủy trên máy thì danh sách tải lại thật sự đổi trạng thái. Một mock trả về
 * nguyên trạng sau khi hủy làm nút "Hủy lịch" trông như không có tác dụng.
 */
let MOCK_BOOKINGS: BookingResponse[] = [
  taoBooking({
    bookingId: 'b1',
    mentorUserId: 'm1',
    mentorDisplayName: 'Trần Minh Quân',
    serviceTitle: 'Mock interview System Design',
    learningGoalTitle: 'Luyện phỏng vấn System Design',
    status: 'PAID',
    sessionStatus: 'PAID',
    bookingStatus: 'CONFIRMED',
    paymentStatus: 'PAID',
    displayState: 'IN_SESSION',
    selectedStartTime: '2026-10-04T20:30:00+07:00',
    selectedEndTime: '2026-10-04T21:30:00+07:00',
    meetingPlatform: 'GOOGLE_MEET',
    meetingLink: 'https://meet.google.com/abc-defg-hij',
    canJoin: true,
    canCancel: false,
  }),
  taoBooking({
    bookingId: 'b2',
    mentorUserId: 'm2',
    mentorDisplayName: 'Lê Thu Hà',
    serviceTitle: 'Review CV 1:1',
    learningGoalTitle: 'Sửa CV để apply intern',
    status: 'PENDING',
    sessionStatus: 'PENDING',
    bookingStatus: 'REQUESTED',
    paymentStatus: 'PENDING',
    displayState: 'PENDING_MENTOR_RESPONSE',
    selectedStartTime: '2026-10-06T19:00:00+07:00',
    selectedEndTime: '2026-10-06T19:45:00+07:00',
    canCancel: true,
  }),
  taoBooking({
    bookingId: 'b3',
    mentorUserId: 'm3',
    mentorDisplayName: 'Phạm Gia Bảo',
    serviceTitle: 'Định hướng nghề Data',
    learningGoalTitle: 'Chọn hướng đi sau khi tốt nghiệp',
    status: 'ACCEPTED_AWAITING_PAYMENT',
    sessionStatus: 'ACCEPTED_AWAITING_PAYMENT',
    bookingStatus: 'WAITING_PAYMENT',
    paymentStatus: 'PENDING',
    displayState: 'PAYMENT_REQUIRED',
    selectedStartTime: '2026-10-08T14:00:00+07:00',
    selectedEndTime: '2026-10-08T14:45:00+07:00',
    // `canPay` của backend là `true` ở đây; màn hình cố ý KHÔNG dựng lối thanh
    // toán nào (mục 4.1 của quy ước). Fixture giữ đúng `true` để test canh được
    // việc đó.
    canPay: true,
    canCancel: true,
    nextAction: 'PAY_NOW',
  }),
  taoBooking({
    bookingId: 'b4',
    mentorUserId: 'm4',
    mentorDisplayName: 'Vũ Khánh Linh',
    serviceTitle: 'Review portfolio UX',
    learningGoalTitle: 'Sửa portfolio UX',
    status: 'PAID',
    sessionStatus: 'PAID',
    bookingStatus: 'CONFIRMED',
    paymentStatus: 'PAID',
    displayState: 'UPCOMING',
    selectedStartTime: '2026-10-11T09:30:00+07:00',
    selectedEndTime: '2026-10-11T10:30:00+07:00',
    meetingPlatform: 'OFFLINE',
    location: 'Phòng thảo luận 302, Alpha, FPT University Hà Nội',
    canJoin: true,
    canCancel: true,
  }),
  taoBooking({
    bookingId: 'b5',
    mentorUserId: 'm1',
    mentorDisplayName: 'Trần Minh Quân',
    serviceTitle: 'Mock interview Backend',
    learningGoalTitle: 'Luyện phỏng vấn backend',
    status: 'AWAITING_MENTOR_COMPLETION',
    sessionStatus: 'AWAITING_MENTOR_COMPLETION',
    bookingStatus: 'CONFIRMED',
    paymentStatus: 'PAID',
    displayState: 'WAITING_CONFIRMATION',
    selectedStartTime: '2026-10-03T19:00:00+07:00',
    selectedEndTime: '2026-10-03T20:00:00+07:00',
    canCancel: false,
  }),
  taoBooking({
    bookingId: 'b6',
    mentorUserId: 'm5',
    mentorDisplayName: 'Đỗ Hoàng Tuấn',
    serviceTitle: 'Leadership cho team lead',
    learningGoalTitle: 'Dẫn dắt nhóm capstone',
    status: 'COMPLETED',
    sessionStatus: 'COMPLETED',
    bookingStatus: 'COMPLETED',
    paymentStatus: 'PAID',
    displayState: 'COMPLETED',
    selectedStartTime: '2026-09-27T09:30:00+07:00',
    selectedEndTime: '2026-09-27T10:30:00+07:00',
    completionOutcome: 'USER_CONFIRMED',
    completedAt: '2026-09-27T10:35:00+07:00',
    // Backend cho phép mentee viết đánh giá; màn hình cố ý KHÔNG dựng nút "Đánh
    // giá buổi học" vì chưa có màn hình chấm sao nào.
    canSubmitFeedback: true,
    canCancel: false,
  }),
  taoBooking({
    bookingId: 'b7',
    mentorUserId: 'm6',
    mentorDisplayName: 'Ngô Thanh Mai',
    serviceTitle: 'Tư vấn du học',
    learningGoalTitle: 'Chuẩn bị hồ sơ du học',
    status: 'COMPLETED',
    sessionStatus: 'COMPLETED',
    bookingStatus: 'COMPLETED',
    paymentStatus: 'REFUNDED',
    displayState: 'COMPLETED',
    selectedStartTime: '2026-09-25T15:00:00+07:00',
    selectedEndTime: '2026-09-25T16:00:00+07:00',
    completionOutcome: 'NO_SHOW_MENTOR',
    refundedScoin: 110,
    refundReason: 'Mentor không tham gia buổi học',
    canCancel: false,
  }),
  taoBooking({
    bookingId: 'b8',
    mentorUserId: 'm2',
    mentorDisplayName: 'Lê Thu Hà',
    serviceTitle: 'Review CV 1:1',
    learningGoalTitle: 'Sửa CV lần hai',
    status: 'REJECTED',
    sessionStatus: 'REJECTED',
    bookingStatus: 'REJECTED_BY_MENTOR',
    paymentStatus: 'EXPIRED',
    displayState: 'CANCELED_OR_EXPIRED',
    selectedStartTime: '2026-09-24T18:00:00+07:00',
    selectedEndTime: '2026-09-24T18:45:00+07:00',
    rejectReason: 'Mình trùng lịch bảo vệ đồ án hôm đó, em đặt giúp mình slot khác nhé.',
    canCancel: false,
  }),
  taoBooking({
    bookingId: 'b9',
    mentorUserId: 'm7',
    mentorDisplayName: 'Bùi Anh Khoa',
    serviceTitle: 'Giới thiệu Machine Learning',
    learningGoalTitle: 'Bắt đầu học Machine Learning',
    status: 'EXPIRED',
    sessionStatus: 'EXPIRED',
    bookingStatus: 'REQUEST_EXPIRED',
    paymentStatus: 'EXPIRED',
    displayState: 'CANCELED_OR_EXPIRED',
    // Slot gốc đã bị xoá nên mapper của backend không giải được mốc thời gian.
    selectedStartTime: null,
    selectedEndTime: null,
    availabilitySlotId: null,
    canCancel: false,
  }),
  taoBooking({
    bookingId: 'b10',
    mentorUserId: 'm3',
    mentorDisplayName: 'Phạm Gia Bảo',
    serviceTitle: 'Định hướng nghề Data',
    learningGoalTitle: 'Chọn hướng đi sau tốt nghiệp',
    status: 'EXPIRED',
    sessionStatus: 'EXPIRED',
    bookingStatus: 'PAYMENT_EXPIRED',
    paymentStatus: 'EXPIRED',
    displayState: 'CANCELED_OR_EXPIRED',
    selectedStartTime: '2026-09-23T20:00:00+07:00',
    selectedEndTime: '2026-09-23T21:00:00+07:00',
    canCancel: false,
  }),
  taoBooking({
    bookingId: 'b11',
    mentorUserId: 'm5',
    mentorDisplayName: 'Đỗ Hoàng Tuấn',
    serviceTitle: 'Leadership cho team lead',
    learningGoalTitle: 'Họp 1:1 với team',
    status: 'CANCELLED_BY_MENTEE',
    sessionStatus: 'CANCELLED_BY_MENTEE',
    bookingStatus: 'CANCELED_BY_MENTEE',
    paymentStatus: 'REFUNDED',
    displayState: 'CANCELED_OR_EXPIRED',
    selectedStartTime: '2026-09-22T19:00:00+07:00',
    selectedEndTime: '2026-09-22T20:00:00+07:00',
    cancelReason: 'Em có lịch thi đột xuất nên xin hủy.',
    cancelledAt: '2026-09-21T08:00:00+07:00',
    canCancel: false,
  }),
  taoBooking({
    bookingId: 'b12',
    mentorUserId: 'm8',
    // Backend trả `null` khi không tra được user của mentor — thẻ phải vẫn đọc
    // được.
    mentorDisplayName: null,
    serviceTitle: 'Tư vấn chuyển ngành',
    learningGoalTitle: 'Chuyển từ QA sang Dev',
    status: 'CANCELLED_BY_MENTOR',
    sessionStatus: 'CANCELLED_BY_MENTOR',
    bookingStatus: 'CANCELED_BY_MENTOR',
    paymentStatus: 'REFUNDED',
    displayState: 'CANCELED_OR_EXPIRED',
    selectedStartTime: '2026-09-21T14:00:00+07:00',
    selectedEndTime: '2026-09-21T14:45:00+07:00',
    cancelReason: 'Mentor có việc đột xuất.',
    canCancel: false,
  }),
  taoBooking({
    bookingId: 'b13',
    mentorUserId: 'm6',
    mentorDisplayName: 'Ngô Thanh Mai',
    // Booking không gắn service: thẻ phải lùi về mục tiêu học tập.
    serviceId: null,
    serviceTitle: null,
    learningGoalTitle: 'Nhờ xem lại bài test đầu vào',
    status: 'UNDER_REVIEW',
    sessionStatus: 'UNDER_REVIEW',
    bookingStatus: 'UNDER_REVIEW',
    paymentStatus: 'PAID',
    displayState: 'UNDER_REVIEW',
    selectedStartTime: '2026-10-02T10:00:00+07:00',
    selectedEndTime: '2026-10-02T11:00:00+07:00',
    issueType: 'QUALITY_ISSUE',
    issueDescription: 'Buổi học lệch hẳn so với mô tả dịch vụ.',
    issueSubmittedAt: '2026-10-02T12:00:00+07:00',
    disputeSlaStatus: 'WAITING_ADMIN',
    nextAction: 'VIEW_ISSUE',
    canCancel: false,
  }),
  taoBooking({
    bookingId: 'b14',
    mentorUserId: 'm4',
    mentorDisplayName: 'Vũ Khánh Linh',
    serviceTitle: 'Review portfolio UX',
    learningGoalTitle: 'Xem lại portfolio lần hai',
    status: 'PAID',
    sessionStatus: 'PAID',
    bookingStatus: 'CONFIRMED',
    paymentStatus: 'PAID',
    displayState: 'UPCOMING',
    selectedStartTime: '2026-10-20T20:00:00+07:00',
    selectedEndTime: '2026-10-20T21:00:00+07:00',
    canCancel: true,
  }),
];

/** Khuôn `Idempotency-Key` mà `IdempotencyAspect.SAFE_KEY_PATTERN` chấp nhận */
const KHUON_KHOA = /^[A-Za-z0-9._~-]{1,100}$/;

export const bookingMockHandlers = [
  /**
   * Danh sách booking của tôi.
   *
   * Không truyền `status` thì trả dashboard (ở đây là toàn bộ danh sách, vì mọi
   * fixture đều nằm trong cửa sổ 7 ngày trước → 90 ngày tới của backend). Có
   * `status` thì lọc theo `BookingStatus` LEGACY — đúng thứ `BookingListRequest`
   * nhận, chứ không phải `BookingLifecycleStatus`.
   */
  http.get(`${base}/api/me/bookings`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const status = params.get('status');
    const page = Number(params.get('page') ?? '0');
    const size = Number(params.get('size') ?? '10');

    const khop =
      status === null || status === ''
        ? MOCK_BOOKINGS
        : MOCK_BOOKINGS.filter((booking) => booking.status === status);

    return jsonMock(envelope(layTrang(khop, page, size)));
  }),

  http.get(`${base}/api/me/bookings/:bookingId`, ({ params }) => {
    const booking = MOCK_BOOKINGS.find((item) => item.bookingId === String(params.bookingId));
    if (!booking) {
      return loi(404, 'SYS_0003', 'Không tìm thấy booking');
    }
    return jsonMock(envelope(booking));
  }),

  /**
   * Mentee hủy một booking.
   *
   * Handler cố ý KIỂM `Idempotency-Key` y như backend: endpoint thật mang
   * `@Idempotent`, và `IdempotencyAspect.normalizeKey()` trả
   * `400 / SYS_0002 / "IDEMPOTENCY_KEY_REQUIRED"` khi header thiếu hoặc sai
   * khuôn. Bỏ bước kiểm này thì chế độ mock sẽ "hủy thành công" trong khi
   * backend thật từ chối mọi lần — đúng lớp lỗi "xác minh trên một thứ không
   * phải thứ đang chạy".
   *
   * Lý do hủy cũng bị kiểm: `cancelReason` là `@NotBlank`.
   */
  http.post(`${base}/api/me/bookings/:bookingId/cancel`, async ({ params, request }) => {
    const khoa = request.headers.get('Idempotency-Key');
    if (khoa === null || !KHUON_KHOA.test(khoa)) {
      return loi(400, 'SYS_0002', 'IDEMPOTENCY_KEY_REQUIRED');
    }

    const than = (await request.json().catch(() => null)) as { cancelReason?: unknown } | null;
    const lyDo = typeof than?.cancelReason === 'string' ? than.cancelReason.trim() : '';
    if (lyDo.length === 0) {
      return loi(400, 'SYS_0002', 'cancelReason không được để trống');
    }

    const bookingId = String(params.bookingId);
    const hienTai = MOCK_BOOKINGS.find((item) => item.bookingId === bookingId);
    if (!hienTai) {
      return loi(404, 'SYS_0003', 'Không tìm thấy booking');
    }
    if (!hienTai.canCancel) {
      return loi(409, 'BOOKING_4090', 'Booking không ở trạng thái có thể hủy');
    }

    const daHuy: BookingResponse = {
      ...hienTai,
      status: 'CANCELLED_BY_MENTEE',
      sessionStatus: 'CANCELLED_BY_MENTEE',
      bookingStatus: 'CANCELED_BY_MENTEE',
      paymentStatus: 'REFUNDED',
      displayState: 'CANCELED_OR_EXPIRED',
      cancelReason: lyDo,
      cancelledAt: '2026-10-04T12:00:00+07:00',
      canCancel: false,
      canJoin: false,
      canPay: false,
    };
    MOCK_BOOKINGS = MOCK_BOOKINGS.map((item) => (item.bookingId === bookingId ? daHuy : item));

    return jsonMock(envelope(daHuy));
  }),
];

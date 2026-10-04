import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { BookingSlotScreen } from '@/features/booking';

const BASE = 'https://api.skillswap.asia';

jest.mock('expo-router', () => {
  const back = jest.fn();
  const replace = jest.fn();
  const push = jest.fn();
  const canGoBack = jest.fn(() => true);
  return {
    useRouter: () => ({ back, replace, push, canGoBack }),
    __mockRouter: { back, replace, push, canGoBack },
  };
});
jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));

const { __mockRouter: mockRouter } = jest.requireMock<{
  __mockRouter: { back: jest.Mock; replace: jest.Mock; push: jest.Mock; canGoBack: jest.Mock };
}>('expo-router');

/** Thứ Hai 05/10/2026, 07:00 giờ Việt Nam */
const BAY_GIO = Date.UTC(2026, 9, 5, 0, 0);

function envelope(data: unknown) {
  return { timestamp: '2026-10-05T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

function dichVu(serviceId: string, title: string, isActive = true) {
  return {
    serviceId,
    mentorUserId: 'm1',
    title,
    description: 'Mô tả.',
    expectedOutcome: 'Kết quả.',
    durationMinutes: 45,
    isFree: false,
    priceScoin: 150_000,
    isActive,
    maintainPostSessionChat: false,
    deliveryMode: 'ONE_TO_ONE',
    coverImageUrl: null,
    version: 1,
    createdAt: '2026-04-01T09:00:00',
    updatedAt: '2026-08-11T15:20:00',
  };
}

function hoSo(services: unknown[]) {
  return {
    identity: {
      mentorUserId: 'm1',
      displayName: 'Trần Minh Quân',
      avatarUrl: null,
      headline: 'Backend',
      isVerified: true,
      verifiedAt: null,
    },
    mentoring: { bio: null, expertiseDescription: null, supportLevels: { foundation: null, outputReview: null, direction: null } },
    services,
    evidence: {
      education: { campusId: null, campusName: null, programId: null, programName: null, specializationId: null, specializationName: null, semester: null, alumni: null },
      subjectResults: [],
      featuredProjects: [],
      achievements: [],
      portfolioUrl: null,
      githubUrl: null,
      authorityContent: { publishedArticleCount: 0, latestPublishedAt: null, recentPublicArticles: [] },
    },
    reputation: { ratingState: 'NO_REVIEWS', ratingAverage: null, reviewCount: 0, completedSessions: 0 },
    availability: { isAvailable: true, suspendedUntil: null, canRequestBooking: true },
  };
}

/** Parent slot đúng hình dạng `MentorAvailabilitySlotResponse`, giờ KHÔNG offset */
function slot(slotId: string, startTime: string, endTime: string, serviceIds = ['sv1']) {
  return {
    slotId,
    startTime,
    endTime,
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

function khung(startTime: string, startAt: string, isSelectable = true) {
  return {
    startTime,
    endTime: startTime,
    startAt,
    endAt: startAt,
    pendingCount: 0,
    remainingPendingQuota: isSelectable ? 3 : 0,
    isSelectable,
    reasonIfBlocked: isSelectable ? null : 'Đã có người đặt',
    blockedByAcceptedBooking: !isSelectable,
    blockingBookingId: null,
    blockingServiceId: null,
    blockingServiceTitle: null,
    blockedBySameService: !isSelectable,
    blockedByDifferentService: false,
    bookingConflictNote: null,
  };
}

const server = setupServer();
let queryClient: QueryClient;
/** Các cặp (fromDate, toDate) màn hình đã hỏi */
let khoangDaHoi: string[] = [];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
  khoangDaHoi = [];
  mockRouter.push.mockClear();
  mockRouter.back.mockClear();
});
afterEach(() => {
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

function hoSoOk(services = [dichVu('sv1', 'Review CV 1:1')]) {
  return http.get(`${BASE}/api/mentors/m1`, () => HttpResponse.json(envelope(hoSo(services))));
}

function lichOk(theoTuan: Record<string, unknown[]>) {
  return http.get(`${BASE}/api/mentors/m1/availability-slots`, ({ request }) => {
    const sp = new URL(request.url).searchParams;
    const khoa = `${sp.get('fromDate')}..${sp.get('toDate')}`;
    khoangDaHoi.push(khoa);
    return HttpResponse.json(envelope(theoTuan[khoa] ?? []));
  });
}

function khungOk(theoSlot: Record<string, unknown[]>) {
  return http.get(`${BASE}/api/mentors/m1/availability-slots/:slotId/candidates`, ({ params, request }) => {
    const slotId = String(params.slotId);
    return HttpResponse.json(
      envelope({
        slotId,
        serviceId: new URL(request.url).searchParams.get('serviceId'),
        serviceDurationMinutes: 45,
        candidateServiceSlots: theoSlot[slotId] ?? [],
      }),
    );
  });
}

async function renderScreen(serviceId?: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <BookingSlotScreen mentorUserId="m1" serviceId={serviceId} bayGioMs={BAY_GIO} />
    </QueryClientProvider>,
  );
}

describe('BookingSlotScreen', () => {
  it('chọn ngày + khung giờ rồi Tiếp tục chuyền NGUYÊN startAt của backend sang bước 3', async () => {
    server.use(
      hoSoOk(),
      lichOk({ '2026-10-05..2026-10-11': [slot('s-toi', '2026-10-06T19:00:00', '2026-10-06T20:30:00')] }),
      khungOk({
        's-toi': [
          khung('2026-10-06T19:00:00', '2026-10-06T12:00:00Z'),
          khung('2026-10-06T19:45:00', '2026-10-06T12:45:00Z', false),
        ],
      }),
    );

    await renderScreen();

    // Ngày có lịch đầu tiên (T3 06/10) được chọn sẵn và lưới giờ hiện ngay.
    //
    // Nới timeout cho RIÊNG lần chờ này, không phải cho cả file: đây là test đầu
    // tiên của một file test component, nên nó gánh toàn bộ chi phí nạp module
    // React Native, VÀ màn hình phải đi ba lượt gọi mạng nối tiếp trước khi lưới
    // giờ xuất hiện (hồ sơ mentor → lịch tuần hiện tại, rỗng nên tự sang tuần
    // sau → lưới giờ của slot). Mặc định của `waitFor` là 1 giây: chạy riêng file
    // thì đủ (4s cả file), nhưng dưới tải song song của `npm test` thì không —
    // đỏ 3/3 lần với "Unable to find an element with testID: khung-19:00" trong
    // khi chạy riêng xanh. Không phải flake ngẫu nhiên, mà là hạn chờ quá chặt.
    await waitFor(() => expect(screen.getByTestId('khung-19:00')).toBeTruthy(), {
      timeout: 10_000,
    });
    expect(screen.getByText('Tháng 10, 2026')).toBeTruthy();
    expect(screen.getByTestId('nut-tiep-tuc')).toBeDisabled();

    await fireEvent.press(screen.getByTestId('khung-19:00'));
    expect(screen.getByTestId('tom-tat-thoi-gian')).toHaveTextContent('T3, 06/10 · 19:00');

    await fireEvent.press(screen.getByTestId('nut-tiep-tuc'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/booking/confirm',
      params: { mentorUserId: 'm1', slotId: 's-toi', serviceId: 'sv1', startAt: '2026-10-06T12:00:00Z' },
    });
  });

  it('khung giờ bị chặn hiện ra nhưng KHÔNG chọn được', async () => {
    server.use(
      hoSoOk(),
      lichOk({ '2026-10-05..2026-10-11': [slot('s-toi', '2026-10-06T19:00:00', '2026-10-06T20:30:00')] }),
      khungOk({ 's-toi': [khung('2026-10-06T19:45:00', '2026-10-06T12:45:00Z', false)] }),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByTestId('khung-19:45')).toBeTruthy());
    expect(screen.getByTestId('khung-19:45')).toBeDisabled();
  });

  it('tuần hiện tại không còn lịch thì tự sang tuần sau một lần', async () => {
    server.use(
      hoSoOk(),
      lichOk({ '2026-10-12..2026-10-18': [slot('s-sau', '2026-10-13T08:00:00', '2026-10-13T10:00:00')] }),
      khungOk({ 's-sau': [khung('2026-10-13T08:00:00', '2026-10-13T01:00:00Z')] }),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByTestId('khung-08:00')).toBeTruthy());
    expect(khoangDaHoi).toEqual(['2026-10-05..2026-10-11', '2026-10-12..2026-10-18']);
  });

  it('không lùi được về trước tuần hiện tại', async () => {
    server.use(hoSoOk(), lichOk({}), khungOk({}));

    await renderScreen();

    await waitFor(() => expect(screen.getByTestId('tuan-truoc')).toBeTruthy());
    // Tuần này trống → đã tự sang tuần sau, nên lúc này lùi được đúng một lần.
    await waitFor(() => expect(khoangDaHoi).toContain('2026-10-12..2026-10-18'));
    await fireEvent.press(screen.getByTestId('tuan-truoc'));
    await waitFor(() => expect(screen.getByTestId('tuan-truoc')).toBeDisabled());
  });

  it('đổi dịch vụ bằng chip thì lọc lại slot theo dịch vụ mới', async () => {
    server.use(
      hoSoOk([dichVu('sv1', 'Review CV 1:1'), dichVu('sv2', 'Mock interview')]),
      lichOk({
        '2026-10-05..2026-10-11': [
          slot('s-sv1', '2026-10-06T08:00:00', '2026-10-06T10:00:00', ['sv1']),
          slot('s-sv2', '2026-10-08T19:00:00', '2026-10-08T21:00:00', ['sv2']),
        ],
      }),
      khungOk({
        's-sv1': [khung('2026-10-06T08:00:00', '2026-10-06T01:00:00Z')],
        's-sv2': [khung('2026-10-08T19:00:00', '2026-10-08T12:00:00Z')],
      }),
    );

    await renderScreen('sv1');
    await waitFor(() => expect(screen.getByTestId('khung-08:00')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('chon-dich-vu-sv2'));

    await waitFor(() => expect(screen.getByTestId('khung-19:00')).toBeTruthy());
    expect(screen.queryByTestId('khung-08:00')).toBeNull();
  });

  it('mentor không còn dịch vụ đang mở thì nói rõ, không có nút Tiếp tục', async () => {
    server.use(hoSoOk([dichVu('sv1', 'Đã đóng', false)]), lichOk({}), khungOk({}));

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Mentor chưa mở dịch vụ nào')).toBeTruthy());
    expect(screen.queryByTestId('nut-tiep-tuc')).toBeNull();
  });
});

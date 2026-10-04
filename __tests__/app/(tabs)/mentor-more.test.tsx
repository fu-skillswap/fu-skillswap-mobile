import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { MentorMoreScreen } from '@/features/mentorMode';
import {
  taoHoSoMentor,
  taoHoSoMentorRong,
} from '@/features/mentorMode/mocks/mentorModeFixture';

const BASE = 'https://api.skillswap.asia';

jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));

const mockSignOut = jest.fn();
jest.mock('@/core/auth/AuthProvider', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: {
      publicId: 'mentor-0001',
      email: 'mentor@fpt.edu.vn',
      fullName: 'Trần Minh Quân',
      avatarUrl: null,
      status: 'ACTIVE',
      roles: ['MENTEE', 'MENTOR'],
      profileCompleted: true,
      hasStudentProfile: true,
      googleCalendarConnected: false,
      googleCalendarSyncEnabled: false,
      googleCalendarNeedsReconnect: false,
    },
    signInWithGoogle: jest.fn(),
    signOut: mockSignOut,
  }),
}));

jest.mock('expo-router', () => {
  const push = jest.fn();
  const replace = jest.fn();
  return {
    useRouter: () => ({ push, replace }),
    __mockPush: push,
    __mockReplace: replace,
  };
});

const { __mockPush: mockPush, __mockReplace: mockReplace } = jest.requireMock<{
  __mockPush: jest.Mock;
  __mockReplace: jest.Mock;
}>('expo-router');

/**
 * Chế độ vai trò: mock ở biên CONTEXT chứ không mock `expo-secure-store`.
 *
 * Màn này chỉ đọc `cheDoKhaDung` và gọi `chuyenCheDo`; việc lựa chọn được lưu
 * thế nào là trách nhiệm của `RoleModeProvider`, đã có test riêng ở
 * `core/roleMode/RoleModeProvider.test.tsx`.
 */
let mockCheDoKhaDung: ('MENTEE' | 'MENTOR')[] = ['MENTEE', 'MENTOR'];
const mockChuyenCheDo = jest.fn();
jest.mock('@/core/roleMode/RoleModeProvider', () => ({
  useRoleMode: () => ({
    cheDo: 'MENTOR',
    cheDoKhaDung: mockCheDoKhaDung,
    dangTai: false,
    chuyenCheDo: mockChuyenCheDo,
  }),
}));

function envelope(data: unknown) {
  return { timestamp: '2026-10-04T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

function hoSoOk(data: unknown = taoHoSoMentor({ userId: 'mentor-0001' })) {
  return http.get(`${BASE}/api/me/mentor-profile`, () => HttpResponse.json(envelope(data)));
}

const server = setupServer();

/** Một QueryClient cho mỗi test — xem mục 6 của quy ước. */
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
  mockCheDoKhaDung = ['MENTEE', 'MENTOR'];
  mockChuyenCheDo.mockClear();
  mockPush.mockClear();
  mockReplace.mockClear();
  mockSignOut.mockClear();
  mockSignOut.mockResolvedValue(undefined);
});
afterEach(() => {
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

/** `render` của RNTL 14 là HÀM ASYNC — phải await, nếu không act scope rò ra. */
async function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MentorMoreScreen />
    </QueryClientProvider>,
  );
}

/** Đợi query hồ sơ ngã ngũ, gọi ở CUỐI mỗi test */
async function doiXong() {
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('MentorMoreScreen', () => {
  it('hiện tiêu đề và card hồ sơ mentor', async () => {
    server.use(hoSoOk());

    await renderScreen();

    expect(screen.getByText('Thêm')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy());
    expect(screen.getByTestId('trang-thai-ho-so-mentor')).toHaveTextContent(
      'Hồ sơ mentor đã xác minh',
    );
    await doiXong();
  });

  it('hồ sơ ACTIVE: card dẫn sang hồ sơ công khai của CHÍNH mình', async () => {
    server.use(hoSoOk());

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Xem hồ sơ công khai')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('the-ho-so-mentor'));

    // `userId` của hồ sơ là `principal.getPublicId()` — chính tham số mà
    // `GET /api/mentors/{mentorUserId}` nhận.
    expect(mockPush).toHaveBeenCalledWith('/mentor/mentor-0001');
    await doiXong();
  });

  it('hồ sơ CHƯA ACTIVE: KHÔNG dựng lối xem hồ sơ công khai', async () => {
    // `MentorDiscoveryService.isDiscoverableMentor()` đòi `status == ACTIVE`, nên
    // `GET /api/mentors/{id}` trả 404 cho mọi trạng thái khác — dẫn mentor tới
    // một màn hình báo chính họ không tồn tại.
    server.use(hoSoOk(taoHoSoMentor({ mentorStatus: 'PENDING_VERIFICATION' })));

    await renderScreen();
    await waitFor(() =>
      expect(screen.getByTestId('trang-thai-ho-so-mentor')).toHaveTextContent(
        'Hồ sơ mentor đang chờ xác minh',
      ),
    );

    expect(screen.queryByText('Xem hồ sơ công khai')).toBeNull();
    await fireEvent.press(screen.getByTestId('the-ho-so-mentor'));
    expect(mockPush).not.toHaveBeenCalled();
    await doiXong();
  });

  it('hồ sơ chưa tạo (exists=false): nói thẳng, không để dòng trạng thái trống', async () => {
    // `MentorProfileResponse.empty()` không điền `mentorStatus`. Đây là trạng
    // thái thật của tài khoản vừa được cấp vai trò MENTOR nhưng chưa điền hồ sơ.
    server.use(hoSoOk(taoHoSoMentorRong('mentor-0001')));

    await renderScreen();

    await waitFor(() =>
      expect(screen.getByTestId('trang-thai-ho-so-mentor')).toHaveTextContent(
        'Chưa tạo hồ sơ mentor',
      ),
    );
    // `displayName` là `null` khi chưa có hồ sơ — lùi về tên từ phiên đăng nhập.
    expect(screen.getByText('Trần Minh Quân')).toBeTruthy();
    expect(screen.queryByText('Xem hồ sơ công khai')).toBeNull();
    await doiXong();
  });

  it('tài khoản hai vai: bấm chuyển sang Mentee thì ĐỔI chế độ VÀ điều hướng', async () => {
    // Hai vế đều cần. Chỉ đổi chế độ mà không điều hướng sẽ để mentor đứng trên
    // màn `mentor-more` — một màn vừa bị ẩn khỏi thanh tab (`href: null`) nên
    // không tab nào sáng và không có cách nào đoán phải bấm đâu.
    server.use(hoSoOk());

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-chuyen-sang-mentee')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-chuyen-sang-mentee'));

    expect(mockChuyenCheDo).toHaveBeenCalledWith('MENTEE');
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    await doiXong();
  });

  it('điều hướng bằng replace, KHÔNG phải push', async () => {
    // `push` giữ lại stack của thanh tab vừa rời đi, nên nút back của Android sẽ
    // mang người dùng trở về một màn hình của chế độ họ vừa thoát ra.
    server.use(hoSoOk());

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-chuyen-sang-mentee')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-chuyen-sang-mentee'));

    expect(mockPush).not.toHaveBeenCalled();
    await doiXong();
  });

  it('mentor THUẦN: KHÔNG hiện lối chuyển sang Mentee', async () => {
    // Với một mentor thuần, nút đó sẽ đưa họ sang một thanh tab mà
    // `quyCheDoVaiTro()` lập tức lùi về — một nút không làm gì cả.
    mockCheDoKhaDung = ['MENTOR'];
    server.use(hoSoOk());

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy());

    expect(screen.queryByTestId('nut-chuyen-sang-mentee')).toBeNull();
    await doiXong();
  });

  it('bấm Đăng xuất thì gọi signOut đúng một lần', async () => {
    server.use(hoSoOk());

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-dang-xuat-mentor')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-dang-xuat-mentor'));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    await doiXong();
  });

  it('signOut ném lỗi thì màn hình KHÔNG sập', async () => {
    // Phiên cục bộ đã được AuthProvider dọn ở nhánh finally trước khi lỗi ném
    // ra, nên nuốt lỗi ở đây là đúng — nhưng phải chắc là nó được nuốt thật.
    server.use(hoSoOk());
    mockSignOut.mockRejectedValue(new Error('mất mạng'));

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-dang-xuat-mentor')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-dang-xuat-mentor'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByText('Trần Minh Quân')).toBeTruthy();
    await doiXong();
  });

  it('mất mạng thì nói mất kết nối, không hiện card hồ sơ rỗng', async () => {
    onlineManager.setOnline(false);
    try {
      server.use(hoSoOk());

      await renderScreen();

      await waitFor(() => expect(screen.getByText('Không có kết nối')).toBeTruthy());
      expect(screen.queryByTestId('the-ho-so-mentor')).toBeNull();
    } finally {
      // Bật mạng lại làm query đang hoãn chạy tiếp và setState trên màn hình vẫn
      // còn gắn — phải nằm trong act đã await.
      await act(async () => {
        onlineManager.setOnline(true);
      });
    }
    await doiXong();
  });

  it('lỗi 500 thì hiện ErrorView kèm nút thử lại', async () => {
    server.use(
      http.get(`${BASE}/api/me/mentor-profile`, () =>
        HttpResponse.json(
          { timestamp: 'x', status: 500, code: 'SYS_0001', message: 'Lỗi', data: null },
          { status: 500 },
        ),
      ),
    );

    await renderScreen();

    // `shouldRetryQuery` thử lại 2 lần với 5xx nên chỗ này phải chờ lâu hơn mặc
    // định của `waitFor`.
    await waitFor(() => expect(screen.getByText('Hệ thống đang bận')).toBeTruthy(), {
      timeout: 10_000,
    });
    expect(screen.getByText('Thử lại')).toBeTruthy();
    // Nút Đăng xuất vẫn phải còn: nó không phụ thuộc hồ sơ mentor, và một màn
    // hình lỗi không có lối đăng xuất là một cái bẫy.
    expect(screen.getByTestId('nut-dang-xuat-mentor')).toBeTruthy();
    await doiXong();
  }, 15_000);
});

describe('MentorMoreScreen — các hàng menu dẫn tới màn có thật', () => {
  beforeEach(() => {
    server.use(hoSoOk());
  });

  it('"Dịch vụ của tôi" mở tab Lịch dạy ở phần Dịch vụ', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('hang-dich-vu'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/mentor-schedule', params: { phan: 'dich-vu' } });
    await doiXong();
  });

  it('"Tin nhắn" mở hộp thư ngoài thanh tab, không mở tab ẩn của Mentee', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('hang-tin-nhan'));

    expect(mockPush).toHaveBeenCalledWith('/chat');
    await doiXong();
  });
});

describe('MentorMoreScreen — các hàng menu CỐ Ý bỏ', () => {
  /*
    TEST CANH cho từng hàng. Các hàng này của thiết kế dẫn tới màn hình chưa
    tồn tại, nên chúng là nút chết. Khi dựng xong màn tương ứng thì xoá dòng canh VÀ
    thêm hàng vào màn hình — đừng chỉ xoá dòng canh.
  */
  beforeEach(() => {
    server.use(hoSoOk());
  });

  it('KHÔNG có "Khóa học của tôi" — MentorCourses chưa dựng', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy());

    expect(screen.queryByText('Khóa học của tôi')).toBeNull();
    await doiXong();
  });

  it('KHÔNG có "Bài viết của tôi" — MentorPosts chưa dựng', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy());

    expect(screen.queryByText('Bài viết của tôi')).toBeNull();
    await doiXong();
  });

  it('KHÔNG có "Trợ giúp & điều khoản" — chính thiết kế để href="#"', async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy());

    expect(screen.queryByText('Trợ giúp & điều khoản')).toBeNull();
    await doiXong();
  });

  it('KHÔNG có con số đếm nào cạnh các hàng — không endpoint nào được nối', async () => {
    // Thiết kế in "3" cạnh "Dịch vụ của tôi" và "3" cạnh "Tin nhắn". Dịch vụ
    // không có endpoint đếm; số tin chưa đọc đã hiện ngay trong hộp thư.
    await renderScreen();
    await waitFor(() => expect(screen.getByText('Trần Minh Quân')).toBeTruthy());

    expect(screen.queryByText('3')).toBeNull();
    await doiXong();
  });
});

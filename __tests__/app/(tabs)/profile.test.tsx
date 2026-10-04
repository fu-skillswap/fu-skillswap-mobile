import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { createQueryClient } from '@/core/api/queryClient';
import { ProfileScreen } from '@/features/profile';

const BASE = 'https://api.skillswap.asia';

/**
 * Phiên đăng nhập giả. Hình dạng giữ đúng `AuthContextValue`; `user` theo
 * `UserMeResponse` của `core/auth/types.ts` — không bịa thêm field nào.
 *
 * Phải mock vì `AuthProvider` import `@react-native-google-signin`, package gọi
 * `TurboModuleRegistry.getEnforcing` ngay lúc nạp module: trong Jest không có
 * native module nên test nổ ngay ở bước import.
 */
const mockSignOut = jest.fn();
jest.mock('@/core/auth/AuthProvider', () => ({
  useAuth: () => ({
    status: 'authenticated',
    user: {
      publicId: 'u1',
      email: 'sinhvien@fpt.edu.vn',
      fullName: 'Nguyễn Văn A',
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

/**
 * `useIsOffline` đọc được từ test qua biến này — tên bắt buộc bắt đầu bằng `mock`
 * vì babel-plugin-jest-hoist chặn factory tham chiếu biến ngoài phạm vi.
 *
 * Test mất mạng bật cả cờ này VÀ `onlineManager` để khớp máy thật: banner do
 * `useIsOffline` quyết định, còn việc query bị hoãn do `onlineManager`.
 */
let mockMatMang = false;
jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => mockMatMang }));

/**
 * Spy điều hướng phải dựng BÊN TRONG factory rồi lấy ra qua `requireMock`.
 *
 * `useRouter: () => ({ replace: jest.fn() })` tạo một hàm giả MỚI mỗi lần
 * component gọi `useRouter()`, nên không có spy nào giữ lại được để assert. Và
 * không thể tham chiếu một `const` ngoài factory: Jest hoist `jest.mock` lên trên
 * mọi khai báo.
 *
 * Phải mock cả package vì `expo-router` kéo theo `standard-navigation`, một
 * module ESM nằm ngoài `transformIgnorePatterns` của repo.
 */
jest.mock('expo-router', () => {
  const replace = jest.fn();
  const push = jest.fn();
  return { useRouter: () => ({ replace, push }), __mockReplace: replace, __mockPush: push };
});

const { __mockReplace: mockReplace, __mockPush: mockPush } = jest.requireMock<{
  __mockReplace: jest.Mock;
  __mockPush: jest.Mock;
}>('expo-router');

/**
 * Chế độ vai trò: mock ở biên CONTEXT chứ không mock `expo-secure-store`.
 *
 * Màn này chỉ đọc `cheDoKhaDung` và gọi `chuyenCheDo` — việc lựa chọn được lưu
 * thế nào là trách nhiệm của `RoleModeProvider`, và nó đã có test riêng ở
 * `core/roleMode/RoleModeProvider.test.tsx`. Mock ở đây để test màn hình không
 * phải dựng keystore giả.
 */
let mockCheDoKhaDung: ('MENTEE' | 'MENTOR')[] = ['MENTEE', 'MENTOR'];
const mockChuyenCheDo = jest.fn();
jest.mock('@/core/roleMode/RoleModeProvider', () => ({
  useRoleMode: () => ({
    cheDo: 'MENTEE',
    cheDoKhaDung: mockCheDoKhaDung,
    dangTai: false,
    chuyenCheDo: mockChuyenCheDo,
  }),
}));

function envelope(data: unknown) {
  return { timestamp: '2026-09-30T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

/** Hồ sơ đầy đủ theo `identity.md` §5.1 */
const HO_SO = {
  userId: 'u1',
  email: 'sinhvien@fpt.edu.vn',
  studentCode: 'HE180001',
  displayName: 'Nguyễn Văn A',
  avatarUrl: null,
  campus: { id: 'c1', code: 'HL', name: 'FPT University Hà Nội', city: 'Hà Nội' },
  program: {
    id: 'p1',
    code: 'CNTT',
    nameVi: 'Công nghệ thông tin',
    nameEn: 'Information Technology',
  },
  specialization: null,
  semester: 5,
  intakeYear: 2022,
  isAlumni: false,
  graduationYear: null,
  bio: 'Thích backend',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
};

const hoSoOk = (hoSo: unknown = HO_SO) =>
  http.get(`${BASE}/api/me/student-profile`, () => HttpResponse.json(envelope(hoSo)));

/** §7 không liệt kê mã nghiệp vụ cho 404 hồ sơ; giá trị dưới đây chỉ giữ chỗ. */
const chuaCoHoSo = () =>
  http.get(`${BASE}/api/me/student-profile`, () =>
    HttpResponse.json(
      { timestamp: '', status: 404, code: 'PROFILE_4041', message: 'Chưa có', data: null },
      { status: 404 },
    ),
  );

const hoSoLoi500 = () =>
  http.get(`${BASE}/api/me/student-profile`, () =>
    HttpResponse.json(
      { timestamp: '', status: 500, code: 'SYS_0010', message: 'Lỗi', data: null },
      { status: 500 },
    ),
  );

const server = setupServer();

/** Một QueryClient cho mỗi test — xem Global Constraints. */
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
  mockMatMang = false;
  mockSignOut.mockClear();
  mockSignOut.mockResolvedValue(undefined);
  mockCheDoKhaDung = ['MENTEE', 'MENTOR'];
  mockChuyenCheDo.mockClear();
  mockReplace.mockClear();
  mockPush.mockClear();
});
afterEach(() => {
  queryClient.clear();
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

/**
 * Đợi query hồ sơ ngã ngũ, gọi ở CUỐI mỗi test.
 *
 * Không đợi thì lần `setState` lúc request về rơi vào khoảng giữa lúc thân test
 * kết thúc và lúc RNTL gỡ cây — React in "An update to ProfileScreen inside a
 * test was not wrapped in act(...)", và cảnh báo hiện ở một test KHÁC vì nó nổ
 * sau. Phải gọi trong thân test chứ không đặt được vào `afterEach`: auto-cleanup
 * của RNTL đăng ký `afterEach` ngay lúc import nên luôn gỡ cây trước hook viết ở
 * đây.
 */
async function doiHoSoXong() {
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  // `isFetching()` về 0 NGAY khi request xong, nhưng TanStack còn gom việc thông
  // báo cho subscriber vào một `setTimeout(0)` (`notifyManager`). Nếu điều kiện
  // trên đúng ngay lần kiểm đầu thì `waitFor` trả về trước khi hẹn giờ đó nổ, và
  // cú re-render rơi ra ngoài act. Nhường thêm một nhịp macrotask trong act.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** `render` của @testing-library/react-native@14 là hàm ASYNC — phải await. */
async function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileScreen />
    </QueryClientProvider>,
  );
}

describe('ProfileScreen', () => {
  // Test ĐẦU TIÊN của file trả toàn bộ chi phí nạp module React Native; khi cả
  // suite chạy song song nó vượt mốc 5s mặc định của Jest. Chỉ nới cho đúng test
  // này, không nới `testTimeout` toàn cục.
  it('hiện tên, email và vai trò lấy từ phiên đăng nhập', async () => {
    server.use(hoSoOk());

    await renderScreen();

    expect(screen.getByText('Nguyễn Văn A')).toBeTruthy();
    expect(screen.getByText('sinhvien@fpt.edu.vn')).toBeTruthy();
    expect(screen.getByText('MENTEE · MENTOR')).toBeTruthy();
    await doiHoSoXong();
  }, 20_000);

  it('hiện mã sinh viên, cơ sở và ngành từ hồ sơ', async () => {
    server.use(hoSoOk());

    await renderScreen();

    await waitFor(() => expect(screen.getByText('HE180001')).toBeTruthy());
    expect(screen.getByText('FPT University Hà Nội')).toBeTruthy();
    // `nameVi`, KHÔNG phải `name` — ngành và chuyên ngành không có field `name`.
    expect(screen.getByText('Công nghệ thông tin')).toBeTruthy();
    expect(screen.getByText('Kỳ 5')).toBeTruthy();
    expect(screen.getByText('Thích backend')).toBeTruthy();
    await doiHoSoXong();
  });

  it('kỳ 0 vẫn được hiện — 0 là học kỳ hợp lệ, không phải "chưa có"', async () => {
    // `identity.md` §5.2 cho phép `semester` từ 0 đến 9. Lọc dòng bằng giá trị
    // falsy (`semester ? ... : null`) thì sinh viên kỳ 0 mất hẳn dòng "Kỳ".
    server.use(hoSoOk({ ...HO_SO, semester: 0 }));

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Kỳ 0')).toBeTruthy());
    await doiHoSoXong();
  });

  it('CHƯA có hồ sơ thì mời tạo, KHÔNG báo lỗi', async () => {
    // 404 ở đây là trạng thái bình thường của người vừa đăng nhập lần đầu
    // (`identity.md` §5.1). Hiện ErrorView "Hệ thống đang bận" cho họ là nói dối.
    server.use(chuaCoHoSo());

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Chưa có hồ sơ sinh viên')).toBeTruthy());
    expect(screen.queryByText('Hệ thống đang bận')).toBeNull();
    await doiHoSoXong();
  });

  it('hồ sơ lỗi 500 thì báo lỗi, KHÔNG nói là chưa có hồ sơ', async () => {
    server.use(hoSoLoi500());

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Hệ thống đang bận')).toBeTruthy(), {
      timeout: 10_000,
    });
    expect(screen.queryByText('Chưa có hồ sơ sinh viên')).toBeNull();
    // Phần thông tin từ phiên vẫn phải còn: hồ sơ hỏng không được xoá cả màn hình.
    expect(screen.getByText('Nguyễn Văn A')).toBeTruthy();
    await doiHoSoXong();
  }, 20_000);

  it('MẤT MẠNG thì nói mất kết nối, KHÔNG nói chưa có hồ sơ', async () => {
    // `isLoading` KHÔNG bật khi mất mạng: query nằm ở `status: 'pending'` +
    // `fetchStatus: 'paused'`. Màn hình nào chỉ hỏi `isLoading` sẽ rơi thẳng
    // xuống nhánh "chưa có hồ sơ" và mời một người đã có hồ sơ đi tạo lại.
    mockMatMang = true;
    onlineManager.setOnline(false);
    try {
      server.use(hoSoOk());

      await renderScreen();

      await waitFor(() =>
        expect(screen.getByText('Hồ sơ sẽ tải khi có mạng trở lại.')).toBeTruthy(),
      );
      expect(screen.queryByText('Chưa có hồ sơ sinh viên')).toBeNull();
      expect(screen.queryByText('Hệ thống đang bận')).toBeNull();
      // Thông tin từ phiên vẫn còn đó dù không gọi được API.
      expect(screen.getByText('Nguyễn Văn A')).toBeTruthy();
    } finally {
      // Bật mạng lại làm query đang hoãn chạy tiếp và setState trên cây vẫn còn
      // gắn — phải nằm trong act đã await.
      await act(async () => {
        onlineManager.setOnline(true);
      });
    }
    await doiHoSoXong();
  });

  it('đã biết là CHƯA có hồ sơ thì một lần tải lại hỏng KHÔNG biến thành lỗi', async () => {
    // TanStack v5 bật `isError` cả khi query đã có câu trả lời và chỉ lần refetch
    // sau đó thất bại. Nếu `coDuLieu` tính bằng `data != null` thì câu trả lời
    // "chưa có hồ sơ" (data === null) không được tính là đã có dữ liệu, và một
    // lần tải lại hụt sóng sẽ đổi lời mời tạo hồ sơ thành "Hệ thống đang bận".
    let lanGoi = 0;
    server.use(
      http.get(`${BASE}/api/me/student-profile`, () => {
        lanGoi += 1;
        if (lanGoi === 1) {
          return HttpResponse.json(
            { timestamp: '', status: 404, code: 'PROFILE_4041', message: 'Chưa có', data: null },
            { status: 404 },
          );
        }
        return HttpResponse.json(
          { timestamp: '', status: 500, code: 'SYS_0010', message: 'Lỗi', data: null },
          { status: 500 },
        );
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Chưa có hồ sơ sinh viên')).toBeTruthy());

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile', 'student'] });
    });

    await waitFor(
      () => expect(queryClient.getQueryState(['profile', 'student'])?.status).toBe('error'),
      { timeout: 10_000 },
    );
    // Cache đã sang 'error' nhưng React CHƯA render lại: TanStack gom việc thông
    // báo cho subscriber vào một `setTimeout(0)`. Khẳng định ngay ở đây là khẳng
    // định trên cây của lần render TRƯỚC — test sẽ xanh kể cả khi màn hình đã
    // nhảy sang ErrorView. Phải nhường nhịp cho nó render lại trước đã.
    await doiHoSoXong();

    expect(screen.getByText('Chưa có hồ sơ sinh viên')).toBeTruthy();
    expect(screen.queryByText('Hệ thống đang bận')).toBeNull();
  }, 20_000);

  it('bấm Đăng xuất thì gọi signOut đúng một lần', async () => {
    server.use(hoSoOk());

    await renderScreen();
    await doiHoSoXong();

    await fireEvent.press(screen.getByTestId('nut-dang-xuat'));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('signOut ném lỗi thì màn hình KHÔNG sập', async () => {
    // Phiên cục bộ đã được AuthProvider dọn ở nhánh finally trước khi lỗi ném
    // ra, nên nuốt lỗi ở đây là đúng — nhưng phải chắc là nó được nuốt thật.
    server.use(hoSoOk());
    mockSignOut.mockRejectedValue(new Error('mất mạng'));

    await renderScreen();
    await doiHoSoXong();

    await fireEvent.press(screen.getByTestId('nut-dang-xuat'));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByText('Nguyễn Văn A')).toBeTruthy();
  });
});

describe('ProfileScreen — lối chuyển sang chế độ Mentor', () => {
  it('tài khoản hai vai thấy card chuyển sang chế độ Mentor', async () => {
    mockCheDoKhaDung = ['MENTEE', 'MENTOR'];
    server.use(hoSoOk());

    await renderScreen();
    await doiHoSoXong();

    expect(screen.getByTestId('nut-chuyen-sang-mentor')).toBeTruthy();
    expect(screen.getByText('Chuyển sang chế độ Mentor')).toBeTruthy();
  });

  it('bấm card thì ĐỔI chế độ VÀ điều hướng sang tab đầu của thanh Mentor', async () => {
    // Hai vế đều cần. Chỉ đổi chế độ mà không điều hướng sẽ để người dùng đứng
    // trên màn Hồ sơ — một màn vừa bị ẩn khỏi thanh tab (`href: null`) nên không
    // tab nào sáng và không có cách nào đoán phải bấm đâu.
    mockCheDoKhaDung = ['MENTEE', 'MENTOR'];
    server.use(hoSoOk());

    await renderScreen();
    await doiHoSoXong();

    await fireEvent.press(screen.getByTestId('nut-chuyen-sang-mentor'));

    expect(mockChuyenCheDo).toHaveBeenCalledWith('MENTOR');
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/mentor-dashboard');
  });

  it('điều hướng bằng replace, KHÔNG phải push', async () => {
    // `push` giữ lại stack của thanh tab vừa rời đi, nên nút back của Android sẽ
    // mang người dùng trở về một màn hình của chế độ họ vừa thoát ra.
    mockCheDoKhaDung = ['MENTEE', 'MENTOR'];
    server.use(hoSoOk());

    await renderScreen();
    await doiHoSoXong();

    await fireEvent.press(screen.getByTestId('nut-chuyen-sang-mentor'));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('mentee THUẦN KHÔNG thấy card đó', async () => {
    // Với người chưa là mentor, nút đó sẽ đưa họ sang một thanh tab mà
    // `quyCheDoVaiTro()` lập tức lùi về — một nút không làm gì cả.
    mockCheDoKhaDung = ['MENTEE'];
    server.use(hoSoOk());

    await renderScreen();
    await doiHoSoXong();

    expect(screen.queryByTestId('nut-chuyen-sang-mentor')).toBeNull();
  });

  it('KHÔNG dựng lối "Trở thành Mentor" — màn đăng ký mentor chưa có', async () => {
    // TEST CANH — đừng xoá. `MentorRegistration.dc.html` là màn 6 bước mà repo
    // chưa có; một card dẫn tới đó là nút chết. Khi dựng xong thì xoá dòng canh
    // VÀ thêm card, đừng chỉ xoá dòng canh.
    mockCheDoKhaDung = ['MENTEE'];
    server.use(hoSoOk());

    await renderScreen();
    await doiHoSoXong();

    expect(screen.queryByText('Trở thành Mentor')).toBeNull();
  });

  it('KHÔNG dựng lối nạp S-coins nào', async () => {
    // TEST CANH — mục 4.1 của quy ước: bản mobile là consumption-only, và chính
    // lối nạp là thứ làm app bị gỡ khỏi Play.
    mockCheDoKhaDung = ['MENTEE', 'MENTOR'];
    server.use(hoSoOk());

    await renderScreen();
    await doiHoSoXong();

    expect(screen.queryByText('Nạp')).toBeNull();
    expect(screen.queryByText('Thêm S-coins')).toBeNull();
    expect(screen.queryByText('VÍ S-COINS')).toBeNull();
  });
});

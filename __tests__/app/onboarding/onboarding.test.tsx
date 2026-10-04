import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { OnboardingScreen } from '@/features/profile';
import { __resetProfileMockForTests, profileMockHandlers } from '@/features/profile/mocks/handlers';

const BASE = 'https://api.skillswap.asia';

jest.mock('expo-router', () => {
  const back = jest.fn();
  const replace = jest.fn();
  const push = jest.fn();
  return {
    useRouter: () => ({ back, replace, push, canGoBack: () => true }),
    __mockRouter: { back, replace, push },
  };
});
jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));
jest.mock('@/core/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { fullName: 'Nguyễn Thu Hà' } }),
}));

const { __mockRouter: mockRouter } = jest.requireMock<{
  __mockRouter: { back: jest.Mock; replace: jest.Mock; push: jest.Mock };
}>('expo-router');

/** Chạy trên handler mock THẬT của hồ sơ: danh mục, PUT kiểm luật như backend */
const server = setupServer(...profileMockHandlers);
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
  mockRouter.back.mockClear();
  mockRouter.replace.mockClear();
});
afterEach(() => {
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
  __resetProfileMockForTests();
});
afterAll(() => server.close());

async function moMan() {
  return render(
    <QueryClientProvider client={queryClient}>
      <OnboardingScreen namHienTai={2026} />
    </QueryClientProvider>,
  );
}

async function doiXong() {
  await waitFor(() => expect(queryClient.isFetching() + queryClient.isMutating()).toBe(0));
}

/** Điền đủ form của người chưa có hồ sơ (cơ sở Hà Nội, CNTT → KTPM, kỳ 5) */
async function dienDu() {
  await fireEvent.changeText(screen.getByTestId('o-mssv'), 'se192621');
  await fireEvent.press(screen.getByTestId('co-so-c1'));
  await fireEvent.changeText(screen.getByTestId('o-nam-nhap-hoc'), '2024');
  await fireEvent.press(screen.getByTestId('nganh-p1'));
  await waitFor(() => expect(screen.getByTestId('chuyen-nganh-s1')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('chuyen-nganh-s1'));
  await fireEvent.press(screen.getByTestId('hoc-ky-5'));
}

describe('OnboardingScreen — người chưa có hồ sơ', () => {
  beforeEach(() => __resetProfileMockForTests(null));

  it('đầu trang "BƯỚC CUỐI", tên lấy sẵn từ tài khoản, nút khoá và nói rõ còn thiếu gì', async () => {
    await moMan();

    await waitFor(() => expect(screen.getByText('BƯỚC CUỐI')).toBeTruthy());
    expect(screen.getByTestId('o-ten-hien-thi').props.value).toBe('Nguyễn Thu Hà');
    expect(screen.getByTestId('nut-luu-ho-so')).toBeDisabled();
    expect(screen.getByTestId('ghi-chu-ho-so')).toHaveTextContent(/Còn thiếu mã số sinh viên/);
    await doiXong();
  });

  it('điền đủ rồi Hoàn tất: gửi đúng body và về thanh tab', async () => {
    let body: Record<string, unknown> | null = null;
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'PUT') {
        body = (await request.clone().json()) as Record<string, unknown>;
      }
    });

    await moMan();
    await waitFor(() => expect(screen.getByTestId('o-mssv')).toBeTruthy());
    await dienDu();

    expect(screen.getByTestId('nut-luu-ho-so')).toBeEnabled();
    await fireEvent.press(screen.getByTestId('nut-luu-ho-so'));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)'));
    expect(body).toEqual({
      studentCode: 'SE192621',
      displayName: 'Nguyễn Thu Hà',
      campusId: 'c1',
      programId: 'p1',
      specializationId: 's1',
      semester: 5,
      intakeYear: 2024,
      isAlumni: false,
      graduationYear: null,
      bio: null,
    });
    server.events.removeAllListeners();
    await doiXong();
  });

  it('đổi ngành thì xoá chuyên ngành đã chọn — chuyên ngành phải thuộc ngành', async () => {
    await moMan();
    await waitFor(() => expect(screen.getByTestId('o-mssv')).toBeTruthy());
    await dienDu();

    await fireEvent.press(screen.getByTestId('nganh-p2'));

    await waitFor(() => expect(screen.getByTestId('chuyen-nganh-s4')).toBeTruthy());
    expect(screen.queryByTestId('chuyen-nganh-s1')).toBeNull();
    expect(screen.getByTestId('ghi-chu-ho-so')).toHaveTextContent('Còn thiếu chuyên ngành.');
    expect(screen.getByTestId('nut-luu-ho-so')).toBeDisabled();
    await doiXong();
  });

  it('cựu sinh viên: ẩn học kỳ, bắt buộc năm tốt nghiệp', async () => {
    await moMan();
    await waitFor(() => expect(screen.getByTestId('o-mssv')).toBeTruthy());
    await dienDu();

    await fireEvent(screen.getByTestId('cong-tac-tot-nghiep'), 'valueChange', true);

    expect(screen.queryByTestId('hoc-ky-5')).toBeNull();
    expect(screen.getByTestId('ghi-chu-ho-so')).toHaveTextContent('Còn thiếu năm tốt nghiệp.');
    await fireEvent.changeText(screen.getByTestId('o-nam-tot-nghiep'), '2025');
    // 2025 < 2024 + 2 → backend sẽ từ chối, form chặn trước.
    expect(screen.getByText('Năm tốt nghiệp phải sau năm nhập học ít nhất 2 năm.')).toBeTruthy();
    await doiXong();
  });

  it('MSSV sai định dạng báo đỏ ngay tại ô', async () => {
    await moMan();
    await waitFor(() => expect(screen.getByTestId('o-mssv')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('o-mssv'), 'ABC123');

    expect(screen.getByText('Mã số sinh viên chưa đúng định dạng (ví dụ: SE192621).')).toBeTruthy();
    await doiXong();
  });

  it('"Để sau" về thanh tab mà KHÔNG gửi gì', async () => {
    let soLanPut = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'PUT') {
        soLanPut += 1;
      }
    });

    await moMan();
    await waitFor(() => expect(screen.getByTestId('nut-de-sau')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('nut-de-sau'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
    expect(soLanPut).toBe(0);
    server.events.removeAllListeners();
    await doiXong();
  });

  it('backend từ chối thì hiện nguyên văn lý do, không rời màn', async () => {
    server.use(
      http.put(`${BASE}/api/me/student-profile`, () =>
        HttpResponse.json(
          { timestamp: 't', status: 400, code: 'BAD_REQUEST', message: 'Mã số sinh viên đã được dùng', data: null },
          { status: 400 },
        ),
      ),
    );

    await moMan();
    await waitFor(() => expect(screen.getByTestId('o-mssv')).toBeTruthy());
    await dienDu();
    await fireEvent.press(screen.getByTestId('nut-luu-ho-so'));

    await waitFor(() => expect(screen.getByTestId('ghi-chu-ho-so')).toHaveTextContent('Mã số sinh viên đã được dùng'));
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await doiXong();
  });
});

describe('OnboardingScreen — người đã có hồ sơ (sửa)', () => {
  it('nạp sẵn dữ liệu cũ, có nút quay lại, không có "Để sau"; lưu xong thì quay lại', async () => {
    await moMan();

    await waitFor(() => expect(screen.getByText('Chỉnh sửa hồ sơ')).toBeTruthy());
    expect(screen.getByTestId('o-mssv').props.value).toBe('HE180001');
    expect(screen.queryByTestId('nut-de-sau')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('chuyen-nganh-s1')).toBeTruthy());
    expect(screen.getByTestId('nut-luu-ho-so')).toBeEnabled();

    await fireEvent.changeText(screen.getByTestId('o-gioi-thieu'), 'Muốn ôn phỏng vấn backend.');
    await fireEvent.press(screen.getByTestId('nut-luu-ho-so'));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await doiXong();
  });

  it('danh mục lỗi thì báo lỗi kèm nút thử lại, không vẽ form thiếu lựa chọn', async () => {
    server.use(
      http.get(`${BASE}/api/campuses`, () =>
        HttpResponse.json({ timestamp: 't', status: 500, code: 'SYS', message: 'Lỗi', data: null }, { status: 500 }),
      ),
    );

    await moMan();

    await waitFor(() => expect(screen.getByText('Thử lại')).toBeTruthy(), { timeout: 10_000 });
    expect(screen.queryByTestId('o-mssv')).toBeNull();
    await doiXong();
  }, 15_000);
});

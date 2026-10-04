import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import type { MentorProfileResponse } from '@/features/mentorMode/types';
import { taoHoSoMentor, taoHoSoMentorRong } from '@/features/mentorMode/mocks/mentorModeFixture';
import { MentorRegistrationScreen } from '@/features/mentorRegistration';
import {
  __resetMentorRegistrationMockForTests,
  mentorRegistrationMockHandlers,
  taoHoSoXacThuc,
} from '@/features/mentorRegistration/mocks/handlers';
import { donHangDoiDanhSach } from '@/test-utils/nhuongNhip';

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
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('@/features/mentorRegistration/taiTep', () => ({ taiTepLenUrl: jest.fn(async () => undefined) }));

let mockCheDoKhaDung: ('MENTEE' | 'MENTOR')[] = ['MENTEE'];
const mockChuyenCheDo = jest.fn();
jest.mock('@/core/roleMode/RoleModeProvider', () => ({
  useRoleMode: () => ({ cheDo: 'MENTEE', cheDoKhaDung: mockCheDoKhaDung, chuyenCheDo: mockChuyenCheDo }),
}));

const { __mockRouter: mockRouter } = jest.requireMock<{
  __mockRouter: { back: jest.Mock; replace: jest.Mock; push: jest.Mock };
}>('expo-router');
const mockChonTep = jest.mocked(DocumentPicker.getDocumentAsync);

let hoSoMentor: MentorProfileResponse = taoHoSoMentorRong();
const server = setupServer(
  ...mentorRegistrationMockHandlers,
  http.get(`${BASE}/api/me/mentor-profile`, () =>
    HttpResponse.json({ timestamp: 't', status: 200, code: 'SUCCESS', message: 'OK', data: hoSoMentor }),
  ),
);
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
  hoSoMentor = taoHoSoMentorRong();
  mockCheDoKhaDung = ['MENTEE'];
  mockChuyenCheDo.mockClear();
  mockRouter.replace.mockClear();
  mockChonTep.mockReset();
});
afterEach(() => {
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
  __resetMentorRegistrationMockForTests();
});
afterAll(() => server.close());

async function moMan() {
  await render(
    <QueryClientProvider client={queryClient}>
      <MentorRegistrationScreen />
    </QueryClientProvider>,
  );
}

/**
 * Đợi mọi query/mutation ngã ngũ RỒI nhường một nhịp trong act: TanStack còn gom
 * việc báo cho subscriber vào một `setTimeout(0)` sau khi `isFetching()` về 0 —
 * xem `doiHoSoXong()` ở `profile.test.tsx`.
 */
async function doiXong() {
  await waitFor(() => expect(queryClient.isFetching() + queryClient.isMutating()).toBe(0));
  await donHangDoiDanhSach();
}

function chonPdf(ten: string) {
  mockChonTep.mockResolvedValueOnce({
    canceled: false,
    assets: [{ name: ten, uri: `file://${ten}`, mimeType: 'application/pdf', size: 2048, lastModified: 0 }],
  } as never);
}

async function dienBuoc1() {
  await fireEvent.changeText(screen.getByTestId('o-tieu-de-mentor'), 'Senior Backend Engineer');
  await fireEvent.changeText(screen.getByTestId('o-kinh-nghiem'), 'Năm năm làm Spring Boot và thanh toán.');
  await fireEvent.changeText(screen.getByTestId('o-sdt'), '0912345678');
}

describe('MentorRegistrationScreen — đang soạn', () => {
  it('"Tiếp tục" khi còn thiếu thì đứng lại và nói thiếu gì', async () => {
    await moMan();
    await waitFor(() => expect(screen.getByTestId('o-tieu-de-mentor')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-tiep-tuc'));

    expect(screen.getByText('Bước 1/6 · Thông tin cơ bản')).toBeTruthy();
    expect(screen.getByTestId('ghi-chu-dang-ky')).toHaveTextContent(/Còn thiếu tiêu đề chuyên môn, mô tả kinh nghiệm, số điện thoại/);
    await doiXong();
  });

  it('đi hết 6 bước, chọn minh chứng, gửi → màn chờ duyệt', async () => {
    await moMan();
    await waitFor(() => expect(screen.getByTestId('o-tieu-de-mentor')).toBeTruthy());

    await dienBuoc1();
    await fireEvent.press(screen.getByTestId('nut-tiep-tuc'));

    await fireEvent.press(screen.getByTestId('nut-them-mon'));
    const ma = screen.getAllByPlaceholderText('PRO192')[0];
    await fireEvent.changeText(ma, 'prj301');
    await fireEvent.changeText(screen.getAllByPlaceholderText('Lập trình hướng đối tượng')[0], 'Java Web');
    await fireEvent.changeText(screen.getAllByPlaceholderText('9.0')[0], '9');
    chonPdf('the-sinh-vien.pdf');
    await fireEvent.press(screen.getByTestId('minh-chung-fptu-chon'));
    await waitFor(() => expect(screen.getByText('the-sinh-vien.pdf')).toBeTruthy());
    chonPdf('aws.pdf');
    await fireEvent.press(screen.getByTestId('minh-chung-chuyen-mon-chon'));
    await waitFor(() => expect(screen.getByText('aws.pdf')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('nut-tiep-tuc'));

    expect(screen.getByText('Bước 3/6 · Thành tích')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('nut-tiep-tuc'));
    await fireEvent.press(screen.getByTestId('nut-tiep-tuc'));

    await fireEvent.press(screen.getByTestId('mucNenTang-3'));
    await fireEvent.press(screen.getByTestId('mucReview-4'));
    await fireEvent.press(screen.getByTestId('mucDinhHuong-2'));
    await fireEvent.press(screen.getByTestId('nut-tiep-tuc'));

    await fireEvent(screen.getByTestId('cong-tac-dong-y'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('nut-gui-ho-so'));

    await waitFor(() => expect(screen.getByTestId('tieu-de-tinh-trang')).toHaveTextContent('Hồ sơ đang chờ duyệt'));
    expect(screen.getByTestId('nut-rut-ho-so')).toBeTruthy();
    await doiXong();
  });

  it('"Gửi hồ sơ" khi còn thiếu thì nhảy về đúng bước chưa xong', async () => {
    await moMan();
    await waitFor(() => expect(screen.getByTestId('o-tieu-de-mentor')).toBeTruthy());
    await dienBuoc1();

    await fireEvent.press(screen.getByTestId('buoc-6'));
    await fireEvent.press(screen.getByTestId('nut-gui-ho-so'));

    expect(screen.getByText('Bước 2/6 · Môn học chuyên môn')).toBeTruthy();
    expect(screen.getByTestId('ghi-chu-dang-ky')).toHaveTextContent(/ít nhất một môn học/);
    await doiXong();
  });

  it('chỉ nhận JPG/PNG/PDF', async () => {
    await moMan();
    await waitFor(() => expect(screen.getByTestId('buoc-2')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('buoc-2'));
    mockChonTep.mockResolvedValueOnce({
      canceled: false,
      assets: [{ name: 'cv.docx', uri: 'file://cv.docx', mimeType: 'application/msword', size: 10, lastModified: 0 }],
    } as never);

    await fireEvent.press(screen.getByTestId('minh-chung-fptu-chon'));

    await waitFor(() => expect(screen.getByTestId('loi-tep')).toHaveTextContent('Chỉ hỗ trợ file JPG, PNG hoặc PDF.'));
    expect(screen.queryByText('cv.docx')).toBeNull();
    await doiXong();
  });

  it('hồ sơ cần bổ sung: hiện ghi chú của admin ở đầu form', async () => {
    __resetMentorRegistrationMockForTests(taoHoSoXacThuc({ status: 'NEEDS_REVISION', reviewNote: 'Bảng điểm bị mờ, chụp lại giúp mình.' }));

    await moMan();

    await waitFor(() => expect(screen.getByTestId('ghi-chu-admin')).toBeTruthy());
    expect(screen.getByText('Bảng điểm bị mờ, chụp lại giúp mình.')).toBeTruthy();
    await doiXong();
  });
});

describe('MentorRegistrationScreen — đã nộp', () => {
  it('đang chờ duyệt: "Rút hồ sơ" đưa về form để sửa', async () => {
    __resetMentorRegistrationMockForTests(taoHoSoXacThuc({ status: 'PENDING_REVIEW' }));

    await moMan();
    await waitFor(() => expect(screen.getByTestId('nut-rut-ho-so')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('nut-rut-ho-so'));

    await waitFor(() => expect(screen.getByTestId('o-tieu-de-mentor')).toBeTruthy());
    await doiXong();
  });

  it('đã duyệt và tài khoản có vai trò Mentor: mở thẳng chế độ Mentor', async () => {
    hoSoMentor = taoHoSoMentor({ mentorStatus: 'ACTIVE' });
    mockCheDoKhaDung = ['MENTEE', 'MENTOR'];

    await moMan();
    await waitFor(() => expect(screen.getByTestId('tieu-de-tinh-trang')).toHaveTextContent('Bạn đã là Mentor'));
    await fireEvent.press(screen.getByTestId('nut-mo-che-do-mentor'));

    expect(mockChuyenCheDo).toHaveBeenCalledWith('MENTOR');
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/mentor-dashboard');
    await doiXong();
  });

  it('vừa được duyệt nhưng phiên chưa có vai trò Mentor: bảo đăng nhập lại, không có nút chết', async () => {
    __resetMentorRegistrationMockForTests(taoHoSoXacThuc({ status: 'APPROVED' }));

    await moMan();

    await waitFor(() => expect(screen.getByText(/Đăng xuất rồi đăng nhập lại/)).toBeTruthy());
    expect(screen.queryByTestId('nut-mo-che-do-mentor')).toBeNull();
    await doiXong();
  });
});

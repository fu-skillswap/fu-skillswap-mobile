import { render, screen } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import React from 'react';

import { useAuth } from '@/core/auth/AuthProvider';
import type { UserMeResponse } from '@/core/auth/types';

import MentorLayout from '@/app/mentor/_layout';

/**
 * Nhánh `/mentor/*` KHÔNG nằm dưới `(tabs)`, nên gate của `(tabs)/_layout.tsx`
 * không che nó. `app.json` khai `"scheme": "skillswap"`, nên
 * `skillswap://mentor/<id>` là điểm vào trực tiếp: một thông báo đẩy hoặc một
 * link dán tay đưa người chưa đăng nhập vào thẳng đây.
 *
 * Và `GET /api/mentors/{id}` cùng `/reviews` là endpoint CÔNG KHAI
 * (`SecurityConfig.java:112-114`), nên không có gate thì màn hồ sơ render đầy đủ
 * cho khách vãng lai — mọi thao tác sau đó nhận 401 ở một chỗ không có đường nào
 * để đăng nhập lại.
 */
jest.mock('@/core/auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('expo-router', () => ({
  Redirect: jest.fn(() => null),
  Stack: Object.assign(() => null, { Screen: () => null }),
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedRedirect = jest.mocked(Redirect);

function nguoiDung(roles: UserMeResponse['roles']): UserMeResponse {
  return {
    publicId: 'u-1',
    email: 'a@fpt.edu.vn',
    fullName: 'Nguyen Van A',
    status: 'ACTIVE',
    roles,
    profileCompleted: true,
    hasStudentProfile: true,
    googleCalendarConnected: false,
    googleCalendarSyncEnabled: false,
    googleCalendarNeedsReconnect: false,
  };
}

function datPhien(value: Partial<ReturnType<typeof useAuth>>) {
  mockedUseAuth.mockReturnValue({
    status: 'unauthenticated',
    user: null,
    signInWithGoogle: jest.fn(),
    signOut: jest.fn(),
    taiLaiNguoiDung: jest.fn(),
    ...value,
  });
}

beforeEach(() => {
  mockedRedirect.mockClear();
});

describe('MentorLayout — gate đăng nhập', () => {
  it('CHƯA đăng nhập thì đẩy về màn hình đăng nhập', async () => {
    datPhien({ status: 'unauthenticated', user: null });

    await render(<MentorLayout />);

    expect(mockedRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: '/(auth)/login' }),
      undefined,
    );
  });

  it('đang tải phiên thì CHỜ, không đẩy đi đâu', async () => {
    // 'loading' không phải là chưa đăng nhập. Đẩy về login ở trạng thái này thì
    // một deep link lúc khởi động bị bật ra ngoài rồi kẹt lại đó, vì màn login
    // không tự điều hướng tiếp khi status resolve.
    datPhien({ status: 'loading', user: null });

    await render(<MentorLayout />);

    expect(screen.getByTestId('mentor-loading-indicator')).toBeTruthy();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('tài khoản ADMIN đi tới trạng thái cuối, KHÔNG về login', async () => {
    // Về login sẽ khiến login đẩy ngược sang (tabs) vì status đã
    // 'authenticated', hai màn hình đẩy nhau vô hạn — xem core/auth/authRoute.ts.
    datPhien({ status: 'authenticated', user: nguoiDung(['ADMIN']) });

    await render(<MentorLayout />);

    expect(mockedRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: '/(auth)/unsupported-account' }),
      undefined,
    );
  });

  it('đã đăng nhập bằng tài khoản được hỗ trợ thì vào được nhánh mentor', async () => {
    datPhien({ status: 'authenticated', user: nguoiDung(['MENTEE']) });

    await render(<MentorLayout />);

    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('phiên chết giữa lúc đang đọc hồ sơ thì lần render kế đẩy về đăng nhập', async () => {
    // Đây là nửa thứ hai của lý do gate phải nằm ở `_layout`: `_layout` của nhánh
    // luôn focus khi một route con đang mở, nên nó bắt được cả trường hợp này —
    // gate đặt trong màn hình thì `Redirect` chạy trong `useFocusEffect` và có
    // thể không bao giờ nổ.
    datPhien({ status: 'authenticated', user: nguoiDung(['MENTEE']) });
    const { rerender } = await render(<MentorLayout />);
    expect(mockedRedirect).not.toHaveBeenCalled();

    datPhien({ status: 'unauthenticated', user: null });
    await rerender(<MentorLayout />);

    expect(mockedRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: '/(auth)/login' }),
      undefined,
    );
  });
});

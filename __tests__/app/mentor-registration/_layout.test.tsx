import { render, screen } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import React from 'react';

import { useAuth } from '@/core/auth/AuthProvider';
import type { UserMeResponse } from '@/core/auth/types';

import MentorRegistrationLayout from '@/app/mentor-registration/_layout';

/**
 * Nhánh `/mentor-registration` KHÔNG nằm dưới `(tabs)`, nên gate của `(tabs)/_layout.tsx`
 * không che nó: card "Trở thành Mentor" ở tab Hồ sơ mở thẳng vào đây. Mọi API của
 * hồ sơ và xác thực mentor đều cần phiên, nên người chưa đăng nhập phải bị đẩy về login
 * ngay ở layout, không phải gặp 401 giữa chừng.
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
    ...value,
  });
}

beforeEach(() => {
  mockedRedirect.mockClear();
});

describe('MentorRegistrationLayout — gate đăng nhập', () => {
  it('CHƯA đăng nhập thì đẩy về màn hình đăng nhập', async () => {
    datPhien({ status: 'unauthenticated', user: null });

    await render(<MentorRegistrationLayout />);

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

    await render(<MentorRegistrationLayout />);

    expect(screen.getByTestId('mentor-registration-loading-indicator')).toBeTruthy();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('tài khoản ADMIN đi tới trạng thái cuối, KHÔNG về login', async () => {
    // Về login sẽ khiến login đẩy ngược sang (tabs) vì status đã
    // 'authenticated', hai màn hình đẩy nhau vô hạn — xem core/auth/authRoute.ts.
    datPhien({ status: 'authenticated', user: nguoiDung(['ADMIN']) });

    await render(<MentorRegistrationLayout />);

    expect(mockedRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: '/(auth)/unsupported-account' }),
      undefined,
    );
  });

  it('đã đăng nhập bằng tài khoản được hỗ trợ thì vào được màn Đăng ký Mentor', async () => {
    datPhien({ status: 'authenticated', user: nguoiDung(['MENTEE']) });

    await render(<MentorRegistrationLayout />);

    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('phiên chết giữa lúc đang điền hồ sơ mentor thì lần render kế đẩy về đăng nhập', async () => {
    // Đây là nửa thứ hai của lý do gate phải nằm ở `_layout`: `_layout` của nhánh
    // luôn focus khi một route con đang mở, nên nó bắt được cả trường hợp này —
    // gate đặt trong màn hình thì `Redirect` chạy trong `useFocusEffect` và có
    // thể không bao giờ nổ.
    datPhien({ status: 'authenticated', user: nguoiDung(['MENTEE']) });
    const { rerender } = await render(<MentorRegistrationLayout />);
    expect(mockedRedirect).not.toHaveBeenCalled();

    datPhien({ status: 'unauthenticated', user: null });
    await rerender(<MentorRegistrationLayout />);

    expect(mockedRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: '/(auth)/login' }),
      undefined,
    );
  });
});

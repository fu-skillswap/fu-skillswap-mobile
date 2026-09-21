import { render, screen } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import React from 'react';

import type { AuthContextValue } from '@/core/auth/AuthProvider';
import { useAuth } from '@/core/auth/AuthProvider';
import type { UserMeResponse } from '@/core/auth/types';

import TabsLayout from './_layout';

// Bug gốc (Critical, mặt còn lại): _layout coi 'loading' như chưa đăng nhập
// nên deep link vào /(tabs) lúc khởi động bị bật thẳng về login rồi kẹt lại
// đó khi status resolve thành 'authenticated' (login không tự điều hướng tiếp).
//
// Bug gốc (Critical, đợt review cuối): trước khi có resolveAuthRoute(), file
// này KHÔNG có case `status: 'authenticated'` nào cả — nên khi login.tsx được
// sửa để redirect sang (tabs) mỗi khi authenticated, không có test nào ở đây
// phát hiện ra rằng (tabs)/_layout.tsx lại redirect NGƯỢC về login cho tài
// khoản ADMIN, tạo thành vòng lặp vô hạn giữa hai màn hình. Hai case
// "authenticated" bên dưới bù lại lỗ hổng đó.
jest.mock('@/core/auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('expo-router', () => ({
  Redirect: jest.fn(() => null),
  Tabs: Object.assign(
    () => null,
    { Screen: () => null },
  ),
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedRedirect = jest.mocked(Redirect);

function meWithRoles(roles: UserMeResponse['roles']): UserMeResponse {
  return {
    publicId: 'u-1',
    email: 'a@b.com',
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

function authValue(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    status: 'unauthenticated',
    user: null,
    signInWithGoogle: jest.fn(),
    signOut: jest.fn(),
    ...overrides,
  };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('TabsLayout', () => {
  it('status loading: hiện chỉ báo tải, không điều hướng về login', async () => {
    mockedUseAuth.mockReturnValue(authValue({ status: 'loading', user: null }));

    await render(<TabsLayout />);

    expect(screen.getByTestId('tabs-loading-indicator')).toBeTruthy();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('status chưa đăng nhập: điều hướng về (auth)/login', async () => {
    mockedUseAuth.mockReturnValue(authValue({ status: 'unauthenticated', user: null }));

    await render(<TabsLayout />);

    expect(mockedRedirect).toHaveBeenCalledWith({ href: '/(auth)/login' }, undefined);
  });

  it('status đã đăng nhập, vai trò mobile hỗ trợ: vẽ Tabs, không điều hướng đi đâu', async () => {
    mockedUseAuth.mockReturnValue(
      authValue({ status: 'authenticated', user: meWithRoles(['MENTEE']) }),
    );

    await render(<TabsLayout />);

    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('status đã đăng nhập, vai trò ADMIN: điều hướng sang màn hình không hỗ trợ, không quay lại login', async () => {
    // Đây là case then chốt của Critical: trước khi sửa, nhánh này redirect về
    // '/(auth)/login' — nhưng login.tsx (đã sửa ở đợt trước) lại redirect ngược
    // sang '/(tabs)' vì status đã 'authenticated', tạo vòng lặp vô hạn giữa hai
    // màn hình. Giờ phải đi sang một trạng thái CUỐI (unsupported-account), không
    // phải quay lại login (thứ mà login lại đẩy ngược sang tabs).
    mockedUseAuth.mockReturnValue(
      authValue({ status: 'authenticated', user: meWithRoles(['ADMIN']) }),
    );

    await render(<TabsLayout />);

    expect(mockedRedirect).toHaveBeenCalledWith({ href: '/(auth)/unsupported-account' }, undefined);
    expect(mockedRedirect).not.toHaveBeenCalledWith({ href: '/(auth)/login' }, undefined);
  });
});

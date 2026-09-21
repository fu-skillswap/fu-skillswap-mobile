import { render, screen } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import React from 'react';

import type { AuthContextValue } from '@/core/auth/AuthProvider';
import { useAuth } from '@/core/auth/AuthProvider';
import type { UserMeResponse } from '@/core/auth/types';

import LoginScreen from '@/app/(auth)/login';

// Bug gốc (Critical): trước khi sửa, màn hình này không đọc `status` và không
// tự điều hướng — sau khi đăng nhập thành công, status chuyển 'authenticated'
// nhưng LoginScreen chỉ re-render chính nó, người dùng kẹt ở màn login mãi.
//
// Bug gốc (Critical, đợt review cuối): bản sửa ở trên lại redirect thẳng sang
// (tabs) bất cứ khi nào status === 'authenticated', kể cả với tài khoản
// ADMIN/SYSTEM_ADMIN — (tabs)/_layout.tsx từ chối các tài khoản đó và redirect
// ngược lại login, hai màn hình đẩy nhau vô hạn. Test "vai trò không hỗ trợ"
// bên dưới khoá lại hành vi đúng: route sang unsupported-account, KHÔNG sang (tabs).
jest.mock('@/core/auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

// login.tsx chỉ dùng GoogleSignInCancelledError (để phân biệt lỗi huỷ) —
// mock để tránh nạp module native '@react-native-google-signin/google-signin'
// thật, thứ không tồn tại trong môi trường Jest.
jest.mock('@/core/auth/googleSignIn', () => ({
  GoogleSignInCancelledError: class extends Error {},
}));

jest.mock('expo-router', () => ({
  Redirect: jest.fn(() => null),
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

describe('LoginScreen', () => {
  it('status đã đăng nhập, vai trò mobile hỗ trợ: điều hướng sang (tabs), không vẽ nút đăng nhập', async () => {
    mockedUseAuth.mockReturnValue(
      authValue({ status: 'authenticated', user: meWithRoles(['MENTEE']) }),
    );

    await render(<LoginScreen />);

    expect(mockedRedirect).toHaveBeenCalledWith({ href: '/(tabs)' }, undefined);
    expect(screen.queryByText('Đăng nhập với Google')).toBeNull();
  });

  it('status đã đăng nhập, vai trò ADMIN: điều hướng sang màn hình không hỗ trợ, không sang (tabs)', async () => {
    mockedUseAuth.mockReturnValue(
      authValue({ status: 'authenticated', user: meWithRoles(['ADMIN']) }),
    );

    await render(<LoginScreen />);

    expect(mockedRedirect).toHaveBeenCalledWith({ href: '/(auth)/unsupported-account' }, undefined);
    expect(mockedRedirect).not.toHaveBeenCalledWith({ href: '/(tabs)' }, undefined);
    expect(screen.queryByText('Đăng nhập với Google')).toBeNull();
  });

  it('status chưa đăng nhập: vẽ nút đăng nhập, không điều hướng đi đâu', async () => {
    mockedUseAuth.mockReturnValue(authValue({ status: 'unauthenticated' }));

    await render(<LoginScreen />);

    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(screen.getByText('Đăng nhập với Google')).toBeTruthy();
  });
});

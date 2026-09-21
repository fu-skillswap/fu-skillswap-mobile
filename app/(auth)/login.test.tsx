import { render, screen } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import React from 'react';

import type { AuthContextValue } from '@/core/auth/AuthProvider';
import { useAuth } from '@/core/auth/AuthProvider';

import LoginScreen from './login';

// Bug gốc (Critical): trước khi sửa, màn hình này không đọc `status` và không
// tự điều hướng — sau khi đăng nhập thành công, status chuyển 'authenticated'
// nhưng LoginScreen chỉ re-render chính nó, người dùng kẹt ở màn login mãi.
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
  it('status đã đăng nhập: điều hướng sang (tabs), không vẽ nút đăng nhập', async () => {
    mockedUseAuth.mockReturnValue(authValue({ status: 'authenticated' }));

    await render(<LoginScreen />);

    expect(mockedRedirect).toHaveBeenCalledWith({ href: '/(tabs)' }, undefined);
    expect(screen.queryByText('Đăng nhập với Google')).toBeNull();
  });

  it('status chưa đăng nhập: vẽ nút đăng nhập, không điều hướng đi đâu', async () => {
    mockedUseAuth.mockReturnValue(authValue({ status: 'unauthenticated' }));

    await render(<LoginScreen />);

    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(screen.getByText('Đăng nhập với Google')).toBeTruthy();
  });
});

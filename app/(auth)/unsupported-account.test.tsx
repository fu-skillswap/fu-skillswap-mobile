import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import React from 'react';

import type { AuthContextValue } from '@/core/auth/AuthProvider';
import { useAuth } from '@/core/auth/AuthProvider';
import type { UserMeResponse } from '@/core/auth/types';

import UnsupportedAccountScreen from './unsupported-account';

// Đây là màn hình đóng vòng lặp redirect vô hạn (Critical, đợt review cuối):
// PHẢI là trạng thái cuối khi route === 'unsupported' — không được render
// <Redirect> trong nhánh đó, nếu không sẽ mở lại vòng lặp với login.tsx /
// (tabs)/_layout.tsx (cả hai đều đẩy tài khoản ADMIN quay về nhau).
jest.mock('@/core/auth/AuthProvider', () => ({
  useAuth: jest.fn(),
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

describe('UnsupportedAccountScreen', () => {
  it('vai trò ADMIN: hiện thông báo và nút đăng xuất, KHÔNG điều hướng đi đâu', async () => {
    mockedUseAuth.mockReturnValue(
      authValue({ status: 'authenticated', user: meWithRoles(['ADMIN']) }),
    );

    await render(<UnsupportedAccountScreen />);

    expect(screen.getByText('Tài khoản không được hỗ trợ')).toBeTruthy();
    expect(screen.getByText('Đăng xuất')).toBeTruthy();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('bấm đăng xuất thì gọi signOut()', async () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(
      authValue({ status: 'authenticated', user: meWithRoles(['SYSTEM_ADMIN']), signOut }),
    );

    await render(<UnsupportedAccountScreen />);
    await fireEvent.press(screen.getByText('Đăng xuất'));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  it('sau khi đăng xuất xong (status chuyển unauthenticated) thì điều hướng sang login', async () => {
    // Đây KHÔNG phải vòng lặp: chỉ chuyển tiếp một lần khi rời hẳn trạng thái
    // unsupported (đăng xuất thật sự xảy ra), không phải hai màn hình tự đẩy
    // nhau ở cùng một trạng thái.
    mockedUseAuth.mockReturnValue(authValue({ status: 'unauthenticated', user: null }));

    await render(<UnsupportedAccountScreen />);

    expect(mockedRedirect).toHaveBeenCalledWith({ href: '/(auth)/login' }, undefined);
  });

  it('status loading: hiện chỉ báo tải, không điều hướng', async () => {
    mockedUseAuth.mockReturnValue(authValue({ status: 'loading', user: null }));

    await render(<UnsupportedAccountScreen />);

    expect(mockedRedirect).not.toHaveBeenCalled();
  });
});

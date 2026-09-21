import { render, screen } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import React from 'react';

import type { AuthContextValue } from '@/core/auth/AuthProvider';
import { useAuth } from '@/core/auth/AuthProvider';

import TabsLayout from './_layout';

// Bug gốc (Critical, mặt còn lại): _layout coi 'loading' như chưa đăng nhập
// nên deep link vào /(tabs) lúc khởi động bị bật thẳng về login rồi kẹt lại
// đó khi status resolve thành 'authenticated' (login không tự điều hướng tiếp).
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
});

import { render, screen } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import React from 'react';

import type { RoleModeContextValue } from '@/core/roleMode/RoleModeProvider';
import { useRoleMode } from '@/core/roleMode/RoleModeProvider';

/**
 * @file index-route.test.tsx
 * @description Canh route gốc `app/(tabs)/index.tsx`: mentor không được đứng trên
 * Bảng tin của mentee (mục bị ẩn khỏi thanh tab Mentor) khi mở app hay sau khi
 * đăng nhập — mọi lối vào đều `Redirect` về `/(tabs)`.
 */
jest.mock('expo-router', () => ({ Redirect: jest.fn(() => null) }));
jest.mock('@/core/roleMode/RoleModeProvider', () => ({ useRoleMode: jest.fn() }));
jest.mock('@/features/forum', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { ForumFeedScreen: () => <Text>MÀN BẢNG TIN</Text> };
});

import ForumTab from '@/app/(tabs)/index';

const mockedRedirect = jest.mocked(Redirect);
const mockedUseRoleMode = jest.mocked(useRoleMode);

function cheDo(gia: RoleModeContextValue['cheDo']): RoleModeContextValue {
  return { cheDo: gia, cheDoKhaDung: ['MENTEE', 'MENTOR'], dangTai: false, chuyenCheDo: jest.fn() };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('route app/(tabs)/index.tsx', () => {
  it('chế độ Mentor: chuyển sang Tổng quan, KHÔNG vẽ Bảng tin', async () => {
    mockedUseRoleMode.mockReturnValue(cheDo('MENTOR'));

    await render(<ForumTab />);

    expect(mockedRedirect).toHaveBeenCalledWith({ href: '/(tabs)/mentor-dashboard' }, undefined);
    expect(screen.queryByText('MÀN BẢNG TIN')).toBeNull();
  });

  it('chế độ Mentee: vẽ Bảng tin, không chuyển hướng', async () => {
    mockedUseRoleMode.mockReturnValue(cheDo('MENTEE'));

    await render(<ForumTab />);

    expect(screen.getByText('MÀN BẢNG TIN')).toBeTruthy();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });
});

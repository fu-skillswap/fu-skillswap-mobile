import { render, screen } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import React from 'react';

import { useAuth } from '@/core/auth/AuthProvider';
import type { UserMeResponse } from '@/core/auth/types';

import ForumLayout from '@/app/forum/_layout';

/**
 * Nhánh `/forum/*` KHÔNG nằm dưới `(tabs)`, nên gate của `(tabs)/_layout.tsx`
 * không che nó. `app.json` khai `"scheme": "skillswap"`, nên
 * `skillswap://forum/<id>` và `/forum/compose` là điểm vào trực tiếp: một thông
 * báo đẩy hoặc một link dán tay đưa người chưa đăng nhập vào thẳng đây.
 *
 * Trước khi có gate này, toàn bộ 27 test của `post-detail.test.tsx` chạy ở
 * `status: 'unauthenticated'` và vẫn gửi được bình luận lẫn báo cáo — nghĩa là
 * đường đi giao diện hoàn toàn sống cho khách vãng lai, chỉ backend thật mới
 * chặn bằng 401 mà màn hình không có nút nào để đăng nhập lại.
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

describe('ForumLayout — gate đăng nhập', () => {
  it('CHƯA đăng nhập thì đẩy về màn hình đăng nhập', async () => {
    datPhien({ status: 'unauthenticated', user: null });

    await render(<ForumLayout />);

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

    await render(<ForumLayout />);

    expect(screen.getByTestId('forum-loading-indicator')).toBeTruthy();
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('tài khoản ADMIN đi tới trạng thái cuối, KHÔNG về login', async () => {
    // Về login sẽ khiến login đẩy ngược sang (tabs) vì status đã
    // 'authenticated', hai màn hình đẩy nhau vô hạn — xem core/auth/authRoute.ts.
    datPhien({ status: 'authenticated', user: nguoiDung(['ADMIN']) });

    await render(<ForumLayout />);

    expect(mockedRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: '/(auth)/unsupported-account' }),
      undefined,
    );
  });

  it('đã đăng nhập bằng tài khoản được hỗ trợ thì vào được nhánh diễn đàn', async () => {
    datPhien({ status: 'authenticated', user: nguoiDung(['MENTEE']) });

    await render(<ForumLayout />);

    expect(mockedRedirect).not.toHaveBeenCalled();
  });
});

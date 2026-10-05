import { fireEvent, render, screen } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import React from 'react';

import type { AuthContextValue } from '@/core/auth/AuthProvider';
import { useAuth } from '@/core/auth/AuthProvider';
import type { UserMeResponse } from '@/core/auth/types';

import { GoogleSignInCancelledError, GoogleSignInConfigError } from '@/core/auth/googleSignIn';

import { KOKO, LOGO_FULL } from '@/core/ui/brand';

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

// login.tsx dùng hai lớp lỗi của googleSignIn để phân biệt ba cách nói với
// người dùng (huỷ / lỗi cấu hình / lỗi khác) — mock để tránh nạp module native
// '@react-native-google-signin/google-signin' thật, thứ không tồn tại trong
// môi trường Jest. Hai lớp phải TÁCH BIỆT nhau thì `instanceof` mới phân biệt
// đúng; dùng chung một lớp sẽ làm cả hai nhánh cùng khớp.
jest.mock('@/core/auth/googleSignIn', () => ({
  GoogleSignInCancelledError: class GoogleSignInCancelledError extends Error {},
  GoogleSignInConfigError: class GoogleSignInConfigError extends Error {},
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

  it('đăng nhập lần đầu (chưa có hồ sơ sinh viên): sang màn Hoàn thiện hồ sơ, không sang (tabs)', async () => {
    mockedUseAuth.mockReturnValue(
      authValue({ status: 'authenticated', user: { ...meWithRoles(['MENTEE']), hasStudentProfile: false } }),
    );

    await render(<LoginScreen />);

    expect(mockedRedirect).toHaveBeenCalledWith({ href: '/onboarding' }, undefined);
    expect(mockedRedirect).not.toHaveBeenCalledWith({ href: '/(tabs)' }, undefined);
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

  it('khối hero có mascot Koko và logo có chữ, cả hai lấy từ ảnh nhận diện', async () => {
    // `Welcome.dc.html` dòng 19 (logo có chữ, cao 36) và dòng 25 (Koko, cao 290).
    // Trước khi nối ảnh, khối hero chỉ có ba quả cầu và màn hình không có mascot.
    mockedUseAuth.mockReturnValue(authValue({ status: 'unauthenticated' }));

    await render(<LoginScreen />);

    // Logo MANG thông tin (nó đứng thay cho tên sản phẩm) nên trình đọc màn hình
    // phải đọc được nhãn; tìm bằng nhãn chứ bằng testID là tìm hụt mất điều đó.
    expect(screen.getByLabelText('SkillSwap').props.source).toBe(LOGO_FULL);

    // Mascot là ảnh trang trí nên bị ẩn khỏi trình đọc màn hình — RNTL chỉ thấy
    // nó khi được yêu cầu kể cả phần tử ẩn.
    const mascot = screen.getByTestId('mascot-koko', { includeHiddenElements: true });
    // Tư thế CHUẨN, và cỡ 204×290 = chiều cao 290 của thiết kế nhân tỉ lệ 360/512
    // của koko.png. Khẳng định bằng đồng nhất với hằng, không bằng giá trị
    // `require()` (xem ghi chú đầu file).
    expect(mascot.props.source).toBe(KOKO);
    expect(mascot.props.style).toMatchObject({ width: 204, height: 290 });
  });

  it('người dùng huỷ: KHÔNG hiện lỗi nào', async () => {
    const signInWithGoogle = jest.fn().mockRejectedValue(new GoogleSignInCancelledError());
    mockedUseAuth.mockReturnValue(authValue({ status: 'unauthenticated', signInWithGoogle }));

    await render(<LoginScreen />);
    await fireEvent.press(screen.getByText('Đăng nhập với Google'));

    expect(screen.queryByText(/lỗi/i)).toBeNull();
    expect(screen.queryByText(/thử lại/i)).toBeNull();
  });

  it('lỗi CẤU HÌNH: nói đúng bản chất và KHÔNG mời thử lại sau', async () => {
    // Gặp thật trên máy ảo 2026-10-03: Google trả DEVELOPER_ERROR vì Android
    // OAuth client chưa đăng ký đúng package + SHA-1. Trước khi sửa, màn hình
    // hiện "Vui lòng thử lại sau ít phút." — chờ bao lâu cũng không hết, nên
    // đó là một lời khuyên sai. Test này khoá lại điều KHÔNG được nói.
    const signInWithGoogle = jest.fn().mockRejectedValue(new GoogleSignInConfigError());
    mockedUseAuth.mockReturnValue(authValue({ status: 'unauthenticated', signInWithGoogle }));

    await render(<LoginScreen />);
    await fireEvent.press(screen.getByText('Đăng nhập với Google'));

    expect(screen.getByText('Không đăng nhập được')).toBeTruthy();
    expect(screen.getByText(/lỗi cấu hình đăng nhập/)).toBeTruthy();
    expect(screen.queryByText(/thử lại sau ít phút/)).toBeNull();
  });

  it('lỗi khác: hiện CẢ tiêu đề lẫn mô tả', async () => {
    // Chỉ hiện mô tả thì "Hệ thống đang bận" (5xx) và "Đã có lỗi xảy ra"
    // (không phải lỗi HTTP) ra chữ y hệt nhau, không ai phân biệt được.
    const signInWithGoogle = jest.fn().mockRejectedValue(new Error('hong'));
    mockedUseAuth.mockReturnValue(authValue({ status: 'unauthenticated', signInWithGoogle }));

    await render(<LoginScreen />);
    await fireEvent.press(screen.getByText('Đăng nhập với Google'));

    expect(screen.getByText('Đã có lỗi xảy ra')).toBeTruthy();
    expect(screen.getByText('Vui lòng thử lại sau ít phút.')).toBeTruthy();
  });
});

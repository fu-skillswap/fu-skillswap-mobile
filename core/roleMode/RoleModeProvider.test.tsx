import { act, renderHook } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';

import type { AuthContextValue } from '@/core/auth/AuthProvider';
import { useAuth } from '@/core/auth/AuthProvider';
import type { BackendRole, UserMeResponse } from '@/core/auth/types';
import { RoleModeProvider, useRoleMode } from '@/core/roleMode/RoleModeProvider';
import { KHOA_CHE_DO_VAI_TRO } from '@/core/roleMode/roleModeStorage';

/**
 * Mock ở biên NATIVE (`expo-secure-store`), KHÔNG mock `@/core/roleMode/roleModeStorage`:
 * nhờ vậy module lưu trữ thật luôn nằm trong đường chạy và test không kiểm trên
 * một seam do chính nó dựng ra. Cùng luật với `core/auth/session.test.ts`.
 */
jest.mock('expo-secure-store', () => ({
  __esModule: true,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@/core/auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

const kho = jest.mocked(SecureStore);
const mockedUseAuth = jest.mocked(useAuth);

function nguoiDung(roles: BackendRole[]): UserMeResponse {
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

function phien(roles: BackendRole[] | null): AuthContextValue {
  return {
    status: roles ? 'authenticated' : 'unauthenticated',
    user: roles ? nguoiDung(roles) : null,
    signInWithGoogle: jest.fn(),
    signOut: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  kho.getItemAsync.mockResolvedValue(null);
  kho.setItemAsync.mockResolvedValue(undefined);
  kho.deleteItemAsync.mockResolvedValue(undefined);
});

/** `renderHook` của RNTL 14 là ASYNC — phải await, nếu không act scope rò ra. */
async function dungHook() {
  return renderHook(() => useRoleMode(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <RoleModeProvider>{children}</RoleModeProvider>
    ),
  });
}

describe('RoleModeProvider', () => {
  it('ném lỗi rõ ràng khi dùng ngoài provider', async () => {
    // Một context `null` lọt vào màn hình sẽ thành `Cannot read property
    // 'cheDo' of null` ở một chỗ cách đây rất xa.
    mockedUseAuth.mockReturnValue(phien(['MENTEE']));

    await expect(renderHook(() => useRoleMode())).rejects.toThrow(
      'useRoleMode phải được dùng bên trong <RoleModeProvider>',
    );
  });

  it('mentor thuần: chế độ Mentor, chỉ một chế độ khả dụng', async () => {
    mockedUseAuth.mockReturnValue(phien(['MENTOR']));

    const { result } = await dungHook();

    expect(result.current.dangTai).toBe(false);
    expect(result.current.cheDo).toBe('MENTOR');
    expect(result.current.cheDoKhaDung).toEqual(['MENTOR']);
  });

  it('tài khoản hai vai: mặc định Mentee khi máy chưa lưu gì', async () => {
    mockedUseAuth.mockReturnValue(phien(['MENTEE', 'MENTOR']));

    const { result } = await dungHook();

    expect(result.current.cheDo).toBe('MENTEE');
    expect(result.current.cheDoKhaDung).toEqual(['MENTEE', 'MENTOR']);
  });

  it('đọc lại lựa chọn đã lưu từ lần mở app trước', async () => {
    // Đây là yêu cầu "lựa chọn phải sống qua lần tắt app": không có lần đọc này
    // thì mỗi lần mở app đều về Mentee và lựa chọn chỉ là trang trí.
    kho.getItemAsync.mockResolvedValue('MENTOR');
    mockedUseAuth.mockReturnValue(phien(['MENTEE', 'MENTOR']));

    const { result } = await dungHook();

    expect(kho.getItemAsync).toHaveBeenCalledWith(KHOA_CHE_DO_VAI_TRO);
    expect(result.current.cheDo).toBe('MENTOR');
  });

  it('chuyenCheDo đổi chế độ VÀ ghi xuống keystore', async () => {
    mockedUseAuth.mockReturnValue(phien(['MENTEE', 'MENTOR']));

    const { result } = await dungHook();
    await act(async () => {
      result.current.chuyenCheDo('MENTOR');
    });

    expect(result.current.cheDo).toBe('MENTOR');
    expect(kho.setItemAsync).toHaveBeenCalledWith(KHOA_CHE_DO_VAI_TRO, 'MENTOR');
  });

  it('chuyenCheDo sang chế độ tài khoản KHÔNG có thì bị bỏ qua, không ghi gì', async () => {
    mockedUseAuth.mockReturnValue(phien(['MENTEE']));

    const { result } = await dungHook();
    await act(async () => {
      result.current.chuyenCheDo('MENTOR');
    });

    expect(result.current.cheDo).toBe('MENTEE');
    expect(kho.setItemAsync).not.toHaveBeenCalled();
  });

  it('bị gỡ quyền MENTOR: rơi về Mentee VÀ dọn giá trị chết trong keystore', async () => {
    // Trường hợp then chốt của phần hạ tầng này. Hai vế đều cần: rơi về Mentee
    // để người dùng không kẹt ở một thanh tab mà mọi API trả 403, và dọn
    // keystore để lựa chọn đã quên không sống lại nếu sau này được cấp lại
    // quyền mentor.
    kho.getItemAsync.mockResolvedValue('MENTOR');
    mockedUseAuth.mockReturnValue(phien(['MENTEE']));

    const { result } = await dungHook();

    expect(result.current.cheDo).toBe('MENTEE');
    expect(result.current.cheDoKhaDung).toEqual(['MENTEE']);
    expect(kho.deleteItemAsync).toHaveBeenCalledWith(KHOA_CHE_DO_VAI_TRO);
  });

  it('lựa chọn hợp lệ thì KHÔNG bị dọn', async () => {
    kho.getItemAsync.mockResolvedValue('MENTOR');
    mockedUseAuth.mockReturnValue(phien(['MENTEE', 'MENTOR']));

    await dungHook();

    expect(kho.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('keystore chết thì vẫn vào được app ở chế độ mặc định', async () => {
    kho.getItemAsync.mockRejectedValue(new Error('keystore chết'));
    mockedUseAuth.mockReturnValue(phien(['MENTEE', 'MENTOR']));

    const { result } = await dungHook();

    expect(result.current.dangTai).toBe(false);
    expect(result.current.cheDo).toBe('MENTEE');
  });

  it('chưa đăng nhập: không có chế độ nào và không ném', async () => {
    mockedUseAuth.mockReturnValue(phien(null));

    const { result } = await dungHook();

    expect(result.current.cheDo).toBeNull();
    expect(result.current.cheDoKhaDung).toEqual([]);
  });

  it('tài khoản ADMIN thuần: không có chế độ nào', async () => {
    mockedUseAuth.mockReturnValue(phien(['ADMIN']));

    const { result } = await dungHook();

    expect(result.current.cheDo).toBeNull();
    expect(result.current.cheDoKhaDung).toEqual([]);
  });

  it('cheDoKhaDung giữ nguyên DANH TÍNH giữa các lần render', async () => {
    // `quyCheDoVaiTro()` trả mảng mới mỗi lần gọi. Đưa thẳng mảng đó vào context
    // sẽ làm mọi consumer (thanh tab, hai màn mentor) render lại ở mỗi lần
    // `AuthProvider` render — và `useEffect` nào nhận nó làm dependency sẽ chạy
    // vô hạn.
    mockedUseAuth.mockReturnValue(phien(['MENTEE', 'MENTOR']));

    const { result, rerender } = await dungHook();
    const truoc = result.current.cheDoKhaDung;
    await rerender({});

    expect(result.current.cheDoKhaDung).toBe(truoc);
  });
});

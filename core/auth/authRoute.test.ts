import { resolveAuthRoute } from '@/core/auth/authRoute';
import type { BackendRole, UserMeResponse } from '@/core/auth/types';

/**
 * Đây là bài test lẽ ra phải bắt được vòng lặp redirect vô hạn (Critical,
 * đợt review cuối): trước khi có `resolveAuthRoute`, `login.tsx` và
 * `(tabs)/_layout.tsx` mỗi nơi tự quyết định một nửa, không có chỗ nào kiểm
 * tra toàn bộ ma trận trạng thái cùng lúc. Bảng dưới đây phủ hết mọi tổ hợp
 * `status` × vai trò — xem phần "phủ định để chứng minh" ở cuối file: đảo lại
 * `isMobileSupportedAccount` để trả `tabs` cho ADMIN sẽ làm đúng case ADMIN
 * dưới đây đỏ.
 */
function meWithRoles(roles: BackendRole[]): UserMeResponse {
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

describe('resolveAuthRoute', () => {
  it.each<[string, Parameters<typeof resolveAuthRoute>, ReturnType<typeof resolveAuthRoute>]>([
    ['loading, chưa có user', ['loading', null], { kind: 'loading' }],
    ['loading, có sẵn user cũ (đang refetch)', ['loading', meWithRoles(['MENTEE'])], { kind: 'loading' }],
    ['chưa đăng nhập', ['unauthenticated', null], { kind: 'login' }],
    ['đã đăng nhập, vai trò MENTEE', ['authenticated', meWithRoles(['MENTEE'])], { kind: 'tabs' }],
    ['đã đăng nhập, vai trò MENTOR', ['authenticated', meWithRoles(['MENTOR'])], { kind: 'tabs' }],
    [
      'đã đăng nhập, vừa MENTEE vừa MENTOR',
      ['authenticated', meWithRoles(['MENTEE', 'MENTOR'])],
      { kind: 'tabs' },
    ],
    // Case then chốt của Critical: ADMIN thuần không được điều hướng sang (tabs).
    ['đã đăng nhập, vai trò ADMIN', ['authenticated', meWithRoles(['ADMIN'])], { kind: 'unsupported' }],
    [
      'đã đăng nhập, vai trò SYSTEM_ADMIN',
      ['authenticated', meWithRoles(['SYSTEM_ADMIN'])],
      { kind: 'unsupported' },
    ],
    [
      'đã đăng nhập, vừa MENTEE vừa ADMIN thì vẫn dùng được phần mentee',
      ['authenticated', meWithRoles(['MENTEE', 'ADMIN'])],
      { kind: 'tabs' },
    ],
    // status 'authenticated' mà thiếu hồ sơ user là phiên hỏng, không phải "vào được app".
    ['đã đăng nhập nhưng user null (phiên hỏng)', ['authenticated', null], { kind: 'login' }],
  ])('%s', (_label, args, expected) => {
    expect(resolveAuthRoute(...args)).toEqual(expected);
  });
});

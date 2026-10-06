import { render, screen } from '@testing-library/react-native';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';

import type { AuthContextValue } from '@/core/auth/AuthProvider';
import { useAuth } from '@/core/auth/AuthProvider';
import type { UserMeResponse } from '@/core/auth/types';
import type { AppRoleMode } from '@/core/config/tabs';
import { allTabRouteNames } from '@/core/config/tabs';
import { useRoleMode } from '@/core/roleMode/RoleModeProvider';

import TabsLayout from '@/app/(tabs)/_layout';

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

jest.mock('@/core/roleMode/RoleModeProvider', () => ({
  useRoleMode: jest.fn(),
}));

/**
 * `Tabs` là một `jest.fn` trả `null`, KHÔNG phải một component render children.
 *
 * Vì sao không render children: `Tabs.Screen` của expo-router là một component
 * chỉ-khai-báo (`() => null`) — nó không vẽ gì, mọi tuỳ chọn được navigator đọc
 * từ cây children. Nên cách duy nhất kiểm được "layout khai những màn nào, với
 * tuỳ chọn gì" là đọc THẲNG `children` mà `Tabs` nhận. Dựng một `Tabs` render
 * children rồi đếm `Screen` được gọi mấy lần cũng được, nhưng nó không đọc được
 * `options` — mà `options.href === null` chính là cơ chế ẩn tab.
 */
jest.mock('expo-router', () => ({
  Redirect: jest.fn(() => null),
  Tabs: Object.assign(jest.fn(() => null), { Screen: () => null }),
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedUseRoleMode = jest.mocked(useRoleMode);
const mockedRedirect = jest.mocked(Redirect);
const mockedTabs = jest.mocked(Tabs);

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
    taiLaiNguoiDung: jest.fn(),
    ...overrides,
  };
}

/** Chế độ vai trò đã đọc xong, mặc định Mentee */
function roleMode(
  cheDo: AppRoleMode | null,
  cheDoKhaDung: AppRoleMode[],
  dangTai = false,
) {
  return { cheDo, cheDoKhaDung, dangTai, chuyenCheDo: jest.fn() };
}

/** Một mục `<Tabs.Screen>` đã được layout khai */
interface MucDaKhai {
  name: string;
  /** `href: null` nghĩa là mục bị ẩn khỏi thanh tab */
  href: unknown;
  title: unknown;
}

/**
 * Đọc danh sách `<Tabs.Screen>` mà layout vừa khai, từ chính `children` của `Tabs`.
 *
 * Không đi qua `screen.getBy*`: mock `Tabs` không vẽ gì, và thanh tab thật thì
 * do navigator của react-navigation dựng — không có trong môi trường test.
 */
function docMucDaKhai(): MucDaKhai[] {
  const props = mockedTabs.mock.calls[0]?.[0] as
    | { children?: React.ReactNode }
    | undefined;
  const children = React.Children.toArray(props?.children ?? []);

  return children.flatMap((child) => {
    if (!React.isValidElement(child)) {
      return [];
    }
    const p = child.props as { name?: string; options?: { href?: unknown; title?: unknown } };
    return [
      {
        name: p.name ?? '',
        href: p.options && 'href' in p.options ? p.options.href : undefined,
        title: p.options?.title,
      },
    ];
  });
}

/** Tên các mục HIỆN trên thanh tab (không bị `href: null` ẩn đi) */
function tabHienRa(): string[] {
  return docMucDaKhai()
    .filter((muc) => muc.href !== null)
    .map((muc) => muc.name);
}

beforeEach(() => {
  mockedUseRoleMode.mockReturnValue(roleMode('MENTEE', ['MENTEE']));
});

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

  it('chưa đọc xong chế độ vai trò: CHỜ, không vẽ thanh tab nào', async () => {
    // Lựa chọn vai trò nằm trong keystore nên việc đọc nó là bất đồng bộ. Vẽ
    // thanh tab trước khi đọc xong sẽ làm một mentor thuần thấy thanh Mentee
    // nhấp một nhịp rồi mới đổi, và với tài khoản hai vai thì cú nhấp đó còn
    // mang người dùng về tab Bảng tin thay vì tab họ đang làm việc.
    mockedUseAuth.mockReturnValue(
      authValue({ status: 'authenticated', user: meWithRoles(['MENTOR']) }),
    );
    mockedUseRoleMode.mockReturnValue(roleMode(null, ['MENTOR'], true));

    await render(<TabsLayout />);

    expect(screen.getByTestId('tabs-loading-indicator')).toBeTruthy();
    expect(mockedTabs).not.toHaveBeenCalled();
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
    expect(mockedTabs).toHaveBeenCalled();
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

describe('TabsLayout — hai thanh tab theo vai trò', () => {
  it('khai `Tabs.Screen` cho MỌI route tab của cả hai thanh', async () => {
    // expo-router đăng ký mọi file trong `(tabs)/` thành route dù có khai hay
    // không, và route KHÔNG khai sẽ hiện trong thanh tab với tuỳ chọn mặc định —
    // tức là thanh Mentee mọc thêm 5 mục mentor không tên. Thiếu vế này thì lỗi
    // đó chỉ lộ ra trên máy thật.
    mockedUseAuth.mockReturnValue(
      authValue({ status: 'authenticated', user: meWithRoles(['MENTEE']) }),
    );

    await render(<TabsLayout />);

    expect(docMucDaKhai().map((m) => m.name).sort()).toEqual([...allTabRouteNames()].sort());
  });

  it('mentee thuần: thanh tab Mentee, 5 mục mentor bị ẩn', async () => {
    mockedUseAuth.mockReturnValue(
      authValue({ status: 'authenticated', user: meWithRoles(['MENTEE']) }),
    );
    mockedUseRoleMode.mockReturnValue(roleMode('MENTEE', ['MENTEE']));

    await render(<TabsLayout />);

    expect(tabHienRa()).toEqual(['index', 'mentors', 'bookings', 'messages', 'profile']);
  });

  it('mentor thuần: thanh tab MENTOR — đây là lỗi người dùng báo', async () => {
    // "không xem được các tab của mentor": trước đợt này `resolveTabs()` trả về
    // một bảng duy nhất, nên một mentor thuần vẫn nhận thanh tab của Mentee.
    mockedUseAuth.mockReturnValue(
      authValue({ status: 'authenticated', user: meWithRoles(['MENTOR']) }),
    );
    mockedUseRoleMode.mockReturnValue(roleMode('MENTOR', ['MENTOR']));

    await render(<TabsLayout />);

    expect(tabHienRa()).toEqual([
      'mentor-dashboard',
      'mentor-bookings',
      'mentor-schedule',
      'mentor-wallet',
      'mentor-more',
    ]);
  });

  it('tài khoản hai vai ở chế độ Mentee: thanh Mentee', async () => {
    mockedUseAuth.mockReturnValue(
      authValue({ status: 'authenticated', user: meWithRoles(['MENTEE', 'MENTOR']) }),
    );
    mockedUseRoleMode.mockReturnValue(roleMode('MENTEE', ['MENTEE', 'MENTOR']));

    await render(<TabsLayout />);

    expect(tabHienRa()).toContain('index');
    expect(tabHienRa()).not.toContain('mentor-dashboard');
  });

  it('tài khoản hai vai ở chế độ Mentor: thanh Mentor', async () => {
    mockedUseAuth.mockReturnValue(
      authValue({ status: 'authenticated', user: meWithRoles(['MENTEE', 'MENTOR']) }),
    );
    mockedUseRoleMode.mockReturnValue(roleMode('MENTOR', ['MENTEE', 'MENTOR']));

    await render(<TabsLayout />);

    expect(tabHienRa()).toContain('mentor-dashboard');
    expect(tabHienRa()).not.toContain('index');
  });

  it('chế độ MENTOR mà tài khoản không còn quyền MENTOR: KHÔNG ra thanh tab rỗng', async () => {
    // Máy còn lưu `'MENTOR'` sau khi bị gỡ quyền. `quyCheDoVaiTro()` đã lùi về
    // Mentee ở tầng provider, nhưng layout cũng không được tin lời `cheDo`: một
    // thanh tab rỗng là trạng thái người dùng không thoát ra được.
    mockedUseAuth.mockReturnValue(
      authValue({ status: 'authenticated', user: meWithRoles(['MENTEE']) }),
    );
    mockedUseRoleMode.mockReturnValue(roleMode('MENTOR', ['MENTEE']));

    await render(<TabsLayout />);

    expect(tabHienRa()).toEqual(['index', 'mentors', 'bookings', 'messages', 'profile']);
  });

  it('`cheDo` null (chưa quy xong) vẫn ra một thanh tab hợp lệ, không rỗng', async () => {
    mockedUseAuth.mockReturnValue(
      authValue({ status: 'authenticated', user: meWithRoles(['MENTOR']) }),
    );
    mockedUseRoleMode.mockReturnValue(roleMode(null, ['MENTOR']));

    await render(<TabsLayout />);

    expect(tabHienRa()).toHaveLength(5);
    expect(tabHienRa()[0]).toBe('mentor-dashboard');
  });

  it('nhãn tab lấy từ bảng tab, không phải tên route', async () => {
    // Đổi `mentor-dashboard` thành nhãn "Booking" thì test chỉ kiểm tên route vẫn
    // xanh, và một thanh tab sai nhãn là thứ không ai thấy trong CI.
    mockedUseAuth.mockReturnValue(
      authValue({ status: 'authenticated', user: meWithRoles(['MENTOR']) }),
    );
    mockedUseRoleMode.mockReturnValue(roleMode('MENTOR', ['MENTOR']));

    await render(<TabsLayout />);

    const nhan = docMucDaKhai()
      .filter((m) => m.href !== null)
      .map((m) => m.title);
    expect(nhan).toEqual(['Tổng quan', 'Booking', 'Lịch dạy', 'Ví', 'Thêm']);
  });

  it('mục bị ẩn dùng ĐÚNG `href: null` — cơ chế ẩn tab của expo-router', async () => {
    // `TabsClient` chỉ ẩn mục khi `options.href == null` (nó đặt
    // `tabBarItemStyle: { display: 'none' }` và thay `tabBarButton`). Một cách ẩn
    // khác (ví dụ `tabBarButton: () => null`) sẽ còn chừa khoảng trống trên thanh,
    // và `href` cùng `tabBarButton` dùng chung thì expo-router NÉM.
    mockedUseAuth.mockReturnValue(
      authValue({ status: 'authenticated', user: meWithRoles(['MENTOR']) }),
    );
    mockedUseRoleMode.mockReturnValue(roleMode('MENTOR', ['MENTOR']));

    await render(<TabsLayout />);

    const bijAn = docMucDaKhai().filter((m) => !m.name.startsWith('mentor-'));
    expect(bijAn).toHaveLength(5);
    expect(bijAn.every((m) => m.href === null)).toBe(true);
  });
});

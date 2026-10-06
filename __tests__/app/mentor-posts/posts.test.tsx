import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { KOKO_READING } from '@/core/ui/brand';
import { MentorPostEditScreen, MentorPostsScreen } from '@/features/mentorBlog';
import { __resetMentorBlogMockForTests, mentorBlogMockHandlers } from '@/features/mentorBlog/mocks/handlers';
import { studioMockHandlers } from '@/features/mentorMode/mocks/studioMock';
import { donHangDoiDanhSach } from '@/test-utils/nhuongNhip';

const BASE = 'https://api.skillswap.asia';

jest.mock('expo-router', () => {
  const back = jest.fn();
  const replace = jest.fn();
  const push = jest.fn();
  return {
    useRouter: () => ({ back, replace, push, canGoBack: () => true }),
    __mockRouter: { back, replace, push },
  };
});
jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));
let dem = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `khoa-${(dem += 1)}` }));

const { __mockRouter: mockRouter } = jest.requireMock<{
  __mockRouter: { back: jest.Mock; replace: jest.Mock; push: jest.Mock };
}>('expo-router');

/** Mock THẬT của blog (luật phiên bản, luật đăng) và của dịch vụ mentor */
const server = setupServer(...mentorBlogMockHandlers, ...studioMockHandlers);
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
  mockRouter.back.mockClear();
  mockRouter.push.mockClear();
});
afterEach(() => {
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  server.events.removeAllListeners();
  __resetApiClientForTests();
  __resetMentorBlogMockForTests();
});
afterAll(() => server.close());

function boc(ui: React.ReactElement) {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

/**
 * Đợi mọi query/mutation ngã ngũ RỒI nhường một nhịp trong act: TanStack còn gom
 * việc báo cho subscriber vào một `setTimeout(0)` sau khi `isFetching()` về 0 —
 * xem `doiHoSoXong()` ở `profile.test.tsx`.
 */
async function doiXong() {
  await waitFor(() => expect(queryClient.isFetching() + queryClient.isMutating()).toBe(0));
  await donHangDoiDanhSach();
}

/** Ghi lại thứ tự request ghi (POST/PUT) để kiểm luồng lưu → đăng */
function ghiLaiRequest() {
  const ds: string[] = [];
  server.events.on('request:start', ({ request }) => {
    if (request.method !== 'GET') {
      ds.push(`${request.method} ${new URL(request.url).pathname}`);
    }
  });
  return ds;
}

describe('MentorPostsScreen', () => {
  it('đếm "đã đăng · bản nháp", ẩn bài lưu trữ, chỉ bản nháp mới sửa được', async () => {
    await boc(<MentorPostsScreen />);

    await waitFor(() => expect(screen.getByText('1 đã đăng · 2 bản nháp')).toBeTruthy());
    expect(screen.queryByText('Bài cũ đã lưu trữ')).toBeNull();
    expect(screen.queryByTestId('sua-bai-bp1')).toBeNull();
    expect(screen.getByTestId('sua-bai-bp2')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('sua-bai-bp2'));
    expect(mockRouter.push).toHaveBeenCalledWith('/mentor-posts/bp2');
    await donHangDoiDanhSach();
  });

  it('"Xóa khỏi danh sách" hỏi lại rồi lưu trữ, bài biến khỏi danh sách', async () => {
    await boc(<MentorPostsScreen />);
    await waitFor(() => expect(screen.getByTestId('xoa-bai-bp1')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('xoa-bai-bp1'));
    expect(screen.getByText('Xóa bài viết khỏi danh sách?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('nut-xac-nhan-xoa-bai'));

    await waitFor(() => expect(screen.queryByTestId('bai-viet-bp1')).toBeNull());
    expect(screen.getByText('0 đã đăng · 2 bản nháp')).toBeTruthy();
    await donHangDoiDanhSach();
  });

  it('chưa có bài nào thì mời tạo bài đầu tiên', async () => {
    server.use(
      http.get(`${BASE}/api/me/blog/posts`, () =>
        HttpResponse.json({ timestamp: 't', status: 200, code: 'SUCCESS', message: 'OK', data: [] }),
      ),
    );

    await boc(<MentorPostsScreen />);
    await waitFor(() => expect(screen.getByText('Bạn chưa có bài viết nào.')).toBeTruthy());

    // Khối rỗng của một danh sách BÀI VIẾT → Koko đang đọc. Ảnh trang trí nên bị
    // ẩn khỏi trình đọc màn hình.
    expect(
      screen.getByTestId('minh-hoa-rong-bai-viet-mentor', { includeHiddenElements: true }).props
        .source,
    ).toBe(KOKO_READING);

    await fireEvent.press(screen.getByText('Tạo bài viết đầu tiên'));
    expect(mockRouter.push).toHaveBeenCalledWith('/mentor-posts/new');
    await donHangDoiDanhSach();
  });
});

describe('MentorPostEditScreen', () => {
  it('bài mới: "Đăng bài" tạo bản nháp RỒI đăng bằng version mới', async () => {
    const goi = ghiLaiRequest();
    await boc(<MentorPostEditScreen postId={null} />);

    await fireEvent.changeText(screen.getByTestId('o-tieu-de'), 'Kinh nghiệm phỏng vấn');
    await fireEvent.changeText(screen.getByTestId('o-noi-dung'), 'Chuẩn bị kỹ phần case study.');
    await fireEvent.press(screen.getByTestId('nut-dang-bai'));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(goi).toEqual(['POST /api/me/blog/posts', 'POST /api/me/blog/posts/bp-moi-1/publish']);
    await doiXong();
  });

  it('chưa có nội dung: lưu nháp được, "Đăng bài" bị khoá', async () => {
    await boc(<MentorPostEditScreen postId={null} />);

    await fireEvent.changeText(screen.getByTestId('o-tieu-de'), 'Bản nháp');

    expect(screen.getByTestId('nut-luu-nhap')).toBeEnabled();
    expect(screen.getByTestId('nut-dang-bai')).toBeDisabled();
    expect(screen.getByTestId('ghi-chu-bai-viet')).toHaveTextContent('Cần có nội dung trước khi đăng.');
    await doiXong();
  });

  it('bước ĐĂNG hỏng thì bấm lại SỬA đúng bài vừa tạo, không tạo bài thứ hai', async () => {
    let lanDang = 0;
    server.use(
      http.post(`${BASE}/api/me/blog/posts/:postId/publish`, () => {
        lanDang += 1;
        if (lanDang === 1) {
          return HttpResponse.json({ timestamp: 't', status: 500, code: 'SYS', message: 'Lỗi', data: null }, { status: 500 });
        }
        return HttpResponse.json({ timestamp: 't', status: 200, code: 'SUCCESS', message: 'OK', data: null });
      }),
    );
    const goi = ghiLaiRequest();
    await boc(<MentorPostEditScreen postId={null} />);

    await fireEvent.changeText(screen.getByTestId('o-tieu-de'), 'Bài A');
    await fireEvent.changeText(screen.getByTestId('o-noi-dung'), 'Nội dung');
    await fireEvent.press(screen.getByTestId('nut-dang-bai'));
    await waitFor(() => expect(lanDang).toBeGreaterThanOrEqual(1), { timeout: 10_000 });
    await waitFor(() => expect(queryClient.isMutating()).toBe(0), { timeout: 10_000 });
    expect(mockRouter.back).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('nut-dang-bai'));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled(), { timeout: 10_000 });

    expect(goi.filter((g) => g === 'POST /api/me/blog/posts')).toHaveLength(1);
    expect(goi).toContain('PUT /api/me/blog/posts/bp-moi-1');
    await doiXong();
  }, 20_000);

  it('"Mentee đã đặt dịch vụ" hiện danh sách dịch vụ và đòi chọn ít nhất một', async () => {
    await boc(<MentorPostEditScreen postId={null} />);
    await fireEvent.changeText(screen.getByTestId('o-tieu-de'), 'Bài riêng');
    await fireEvent.changeText(screen.getByTestId('o-noi-dung'), 'Nội dung');

    await fireEvent.press(screen.getByTestId('pham-vi-BOOKED_MEMBERS'));

    await waitFor(() => expect(screen.getByTestId('dich-vu-msv1')).toBeTruthy());
    expect(screen.getByTestId('nut-dang-bai')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('dich-vu-msv1'));
    expect(screen.getByTestId('nut-dang-bai')).toBeEnabled();
    await doiXong();
  });

  it('sửa bản nháp có sẵn: nạp dữ liệu cũ, lưu bằng PUT kèm version', async () => {
    let body: Record<string, unknown> | null = null;
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'PUT') {
        body = (await request.clone().json()) as Record<string, unknown>;
      }
    });
    await boc(<MentorPostEditScreen postId="bp2" />);

    await waitFor(() => expect(screen.getByTestId('o-tieu-de').props.value).toBe('Template PRD mình dùng khi làm ở Google'));
    expect(within(screen.getByTestId('dich-vu-msv1')).getByText(/./)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('nut-luu-nhap'));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(body).toMatchObject({ expectedVersion: 1, visibility: 'BOOKED_MEMBERS', entitledServiceIds: ['msv1'] });
    await doiXong();
  });

  it('lưu bản nháp GIỮ danh mục và thẻ: gửi lại đúng id đang có', async () => {
    // `MentorBlogService.apply()` coi thiếu `categoryIds`/`tagIds` là xoá hết.
    let body: Record<string, unknown> | null = null;
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'PUT') {
        body = (await request.clone().json()) as Record<string, unknown>;
      }
    });
    await boc(<MentorPostEditScreen postId="bp2" />);
    await waitFor(() => expect(screen.getByTestId('o-tieu-de').props.value).toBe('Template PRD mình dùng khi làm ở Google'));

    await fireEvent.press(screen.getByTestId('nut-luu-nhap'));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(body).toMatchObject({ categoryIds: ['cat1'], tagIds: ['tag1'] });
    await doiXong();
  });

  it('bản nháp có ảnh bìa: không hiện form, giải thích phải sửa trên web', async () => {
    await boc(<MentorPostEditScreen postId="bp4" />);

    await waitFor(() => expect(screen.getByText('Không chỉnh sửa được trên ứng dụng')).toBeTruthy());
    expect(screen.getByText(/có ảnh bìa/)).toBeTruthy();
    expect(screen.queryByTestId('o-tieu-de')).toBeNull();
    expect(screen.queryByTestId('nut-luu-nhap')).toBeNull();

    await fireEvent.press(screen.getByText('Quay lại'));
    expect(mockRouter.back).toHaveBeenCalled();
    await doiXong();
  });

  it('bài ĐÃ ĐĂNG mở qua deep link: không hiện form sửa', async () => {
    await boc(<MentorPostEditScreen postId="bp1" />);

    await waitFor(() => expect(screen.getByText(/Bài này đã đăng/)).toBeTruthy());
    expect(screen.queryByTestId('o-tieu-de')).toBeNull();
    expect(screen.queryByTestId('nut-dang-bai')).toBeNull();
    await doiXong();
  });
});

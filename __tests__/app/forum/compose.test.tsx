import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { ComposeScreen } from '@/features/forum';

const BASE = 'https://api.skillswap.asia';

/**
 * Spy điều hướng phải dựng BÊN TRONG factory rồi lấy ra qua `requireMock` — Jest
 * hoist `jest.mock` lên trên mọi khai báo, và `useRouter: () => ({ back: jest.fn() })`
 * đẻ một hàm giả mới mỗi lần gọi nên không assert được gì (xem forum-feed.test.tsx).
 */
jest.mock('expo-router', () => {
  const back = jest.fn();
  const push = jest.fn();
  return { useRouter: () => ({ back, push }), __mockBack: back, __mockPush: push };
});
jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));
/**
 * Màn hình này KHÔNG dùng phiên đăng nhập, nhưng nó được lấy qua barrel
 * `@/features/forum` — barrel kéo theo `PostDetailScreen`, file đó import
 * `@/core/auth/AuthProvider`, và AuthProvider import `@react-native-google-signin`
 * vốn gọi `TurboModuleRegistry.getEnforcing` ngay lúc nạp module: không có
 * native module trong Jest nên test nổ ngay ở bước import.
 *
 * Mock giữ đúng hình dạng thật của `AuthContextValue`; `user: null` là khách
 * vãng lai, đủ cho mọi test trong file này.
 */
jest.mock('@/core/auth/AuthProvider', () => ({
  useAuth: () => ({
    status: 'unauthenticated',
    user: null,
    signInWithGoogle: jest.fn(),
    signOut: jest.fn(),
  }),
}));


const { __mockBack: mockBack } = jest.requireMock<{ __mockBack: jest.Mock }>('expo-router');

function envelope(data: unknown) {
  return { timestamp: '2026-09-22T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

const TOPIC_HOI_DAP = {
  id: 't1',
  code: 'QUESTION',
  nameVi: 'Hỏi đáp',
  nameEn: 'Q&A',
  displayOrder: 1,
};
const TOPIC_CHIA_SE = {
  id: 't2',
  code: 'SHARING',
  nameVi: 'Chia sẻ',
  nameEn: 'Sharing',
  displayOrder: 2,
};

const POST_CUA_TOI = {
  postId: 'p1',
  authorUserId: 'u1',
  authorFullName: 'Nguyen Van A',
  authorAvatarUrl: '',
  authorProgram: null,
  forumTopic: TOPIC_CHIA_SE,
  title: 'Tiêu đề đã lưu trước đó',
  content: 'Nội dung đã lưu trước đó',
  status: 'PUBLISHED',
  commentCount: 3,
  reactionCount: 7,
  reportCount: 0,
  lastActivityAt: '2026-09-22T00:00:00Z',
  reactedByCurrentUser: false,
  myReactionType: null,
  createdAt: '2026-09-22T00:00:00Z',
  updatedAt: '2026-09-22T00:00:00Z',
  imageUrls: [],
};

const topicsOk = () =>
  http.get(`${BASE}/api/forum/topics`, () =>
    HttpResponse.json(envelope([TOPIC_HOI_DAP, TOPIC_CHIA_SE])),
  );

const server = setupServer();

/** Một QueryClient cho mỗi test, KHÔNG phải mỗi lần render — xem Global Constraints. */
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
  mockBack.mockClear();
});
afterEach(() => {
  // `clear()` một mình bỏ sót bộ hẹn giờ gcTime của mutation và Jest treo sau
  // khi test xong — xem JSDoc của `__resetQueryClientForTests`.
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

/**
 * Nhường một nhịp macrotask BÊN TRONG act: `notifyManager` của TanStack đẩy
 * thông báo re-render qua `setTimeout(0)`, nổ SAU khi act scope đóng nếu không
 * chờ. Cảnh báo act() sinh ra từ đó chập chờn, chỉ bẩn ở vài lần chạy.
 */
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
});

/** `render` của RNTL 14 là hàm ASYNC — phải await, nếu không lần render đầu nằm ngoài act(). */
async function renderScreen(postId?: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ComposeScreen postId={postId} />
    </QueryClientProvider>,
  );
}

/** Gõ tiêu đề + nội dung rồi chọn chủ đề — bước mở đầu của phần lớn test dưới đây */
async function dienForm({ chonChuDe = true }: { chonChuDe?: boolean } = {}) {
  await waitFor(() => expect(screen.getByText('Hỏi đáp')).toBeTruthy());
  await fireEvent.changeText(screen.getByLabelText('Tiêu đề bài viết'), '  Học Spring Boot  ');
  await fireEvent.changeText(screen.getByLabelText('Nội dung bài viết'), '  Bắt đầu từ đâu?  ');
  if (chonChuDe) {
    await fireEvent.press(screen.getByRole('button', { name: 'Hỏi đáp' }));
  }
}

describe('ComposeScreen — đăng bài mới', () => {
  it('chưa chọn chủ đề thì nút bị khoá và KHÔNG gửi bài nào đi', async () => {
    let soPost = 0;
    server.use(
      topicsOk(),
      http.post(`${BASE}/api/forum/posts`, () => {
        soPost += 1;
        return HttpResponse.json(envelope(POST_CUA_TOI));
      }),
    );

    await renderScreen();
    await dienForm({ chonChuDe: false });

    expect(screen.getByTestId('nut-dang-bai')).toBeDisabled();

    await fireEvent.press(screen.getByTestId('nut-dang-bai'));

    // Chặn TRƯỚC khi gửi: một lần gửi hỏng vẫn tiêu một lượt trong hạn mức
    // 5 bài/10 phút của backend.
    expect(soPost).toBe(0);
  });

  it('mở form ĐĂNG MỚI thì không đi hỏi chi tiết bài nào cả', async () => {
    // Màn hình này dùng chung `useForumPost` với chế độ sửa. Ở chế độ tạo mới
    // không có postId nào, và nếu thiếu chốt `enabled` thì mỗi lần mở form sẽ có
    // một `GET /api/forum/posts/` (đường dẫn cụt) rời máy — lặng lẽ hỏng, không
    // ai thấy, và test đếm POST ở trên không bắt được vì nó là GET.
    let soGet = 0;
    server.use(
      topicsOk(),
      http.get(`${BASE}/api/forum/posts/:postId`, () => {
        soGet += 1;
        return HttpResponse.json(envelope(POST_CUA_TOI));
      }),
      http.get(`${BASE}/api/forum/posts`, () => {
        soGet += 1;
        return HttpResponse.json(envelope(POST_CUA_TOI));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Hỏi đáp')).toBeTruthy());

    expect(soGet).toBe(0);
  });

  it('đăng thành công thì gửi nội dung ĐÃ cắt khoảng trắng và quay lại màn trước', async () => {
    let body: unknown = null;
    server.use(
      topicsOk(),
      http.post(`${BASE}/api/forum/posts`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope(POST_CUA_TOI));
      }),
    );

    await renderScreen();
    await dienForm();
    await fireEvent.press(screen.getByTestId('nut-dang-bai'));

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(body).toEqual({
      title: 'Học Spring Boot',
      content: 'Bắt đầu từ đâu?',
      forumTopicId: 't1',
    });
  });

  it('lỗi kiểm duyệt FORUM_4201 hiện đúng thông điệp của BACKEND, không có nút Thử lại', async () => {
    server.use(
      topicsOk(),
      http.post(`${BASE}/api/forum/posts`, () =>
        HttpResponse.json(
          {
            timestamp: '',
            status: 400,
            code: 'FORUM_4201',
            // Câu này chỉ có ở phía backend — app không thể tự suy ra nó, nên
            // test phân biệt được "hiện thông điệp của BE" với "hiện câu chung chung".
            message: 'Nội dung chứa từ ngữ vi phạm tiêu chuẩn cộng đồng',
            data: null,
          },
          { status: 400 },
        ),
      ),
    );

    await renderScreen();
    await dienForm();
    await fireEvent.press(screen.getByTestId('nut-dang-bai'));

    await waitFor(() =>
      expect(screen.getByText('Nội dung chứa từ ngữ vi phạm tiêu chuẩn cộng đồng')).toBeTruthy(),
    );
    // Lỗi kiểm duyệt gửi lại y nguyên vẫn hỏng: một nút "Thử lại" ở đây chỉ dẫn
    // người dùng vào vòng lặp và đốt hạn mức — xem luật ACTION_LABEL của ErrorView.
    expect(screen.queryByText('Thử lại')).toBeNull();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('vượt hạn mức 5 bài/10 phút thì hiện SỐ GIÂY chờ của backend, vẫn không mời thử lại', async () => {
    server.use(
      topicsOk(),
      http.post(`${BASE}/api/forum/posts`, () =>
        HttpResponse.json(
          {
            timestamp: '',
            status: 429,
            code: 'TOO_MANY_REQUESTS',
            message: 'Ban dang dang bai qua nhanh',
            data: null,
            // 537 không phải con số app tự tính ra được từ bất cứ đâu.
            retryAfterSeconds: 537,
          },
          { status: 429 },
        ),
      ),
    );

    await renderScreen();
    await dienForm();
    await fireEvent.press(screen.getByTestId('nut-dang-bai'));

    await waitFor(() => expect(screen.getByText(/537 giây/)).toBeTruthy());
    expect(screen.queryByText('Thử lại')).toBeNull();
  });
});

describe('ComposeScreen — sửa bài có sẵn', () => {
  it('mở ở chế độ sửa thì nạp sẵn tiêu đề, nội dung và CHỦ ĐỀ của bài', async () => {
    server.use(
      topicsOk(),
      http.get(`${BASE}/api/forum/posts/p1`, () => HttpResponse.json(envelope(POST_CUA_TOI))),
    );

    await renderScreen('p1');

    await waitFor(() =>
      expect(screen.getByLabelText('Tiêu đề bài viết')).toHaveDisplayValue(
        'Tiêu đề đã lưu trước đó',
      ),
    );
    expect(screen.getByLabelText('Nội dung bài viết')).toHaveDisplayValue(
      'Nội dung đã lưu trước đó',
    );
    // Chủ đề của bài là "Chia sẻ" (t2), KHÔNG phải chip đầu tiên trong danh sách.
    expect(screen.getByRole('button', { name: 'Chia sẻ' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Hỏi đáp' })).not.toBeSelected();
  });

  it('lưu thay đổi thì gửi PUT tới đúng bài rồi quay lại', async () => {
    let body: unknown = null;
    server.use(
      topicsOk(),
      http.get(`${BASE}/api/forum/posts/p1`, () => HttpResponse.json(envelope(POST_CUA_TOI))),
      http.put(`${BASE}/api/forum/posts/p1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope(POST_CUA_TOI));
      }),
    );

    await renderScreen('p1');
    await waitFor(() =>
      expect(screen.getByLabelText('Tiêu đề bài viết')).toHaveDisplayValue(
        'Tiêu đề đã lưu trước đó',
      ),
    );

    await fireEvent.changeText(screen.getByLabelText('Tiêu đề bài viết'), 'Tiêu đề đã sửa');
    await fireEvent.press(screen.getByTestId('nut-dang-bai'));

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(body).toEqual({
      title: 'Tiêu đề đã sửa',
      content: 'Nội dung đã lưu trước đó',
      forumTopicId: 't2',
    });
  });
});

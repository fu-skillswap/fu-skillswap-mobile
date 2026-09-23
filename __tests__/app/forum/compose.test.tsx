import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { ComposeScreen } from '@/features/forum';
import { forumKeys } from '@/features/forum/queryKeys';

const BASE = 'https://api.skillswap.asia';

/**
 * Spy điều hướng phải dựng BÊN TRONG factory rồi lấy ra qua `requireMock` — Jest
 * hoist `jest.mock` lên trên mọi khai báo, và `useRouter: () => ({ back: jest.fn() })`
 * đẻ một hàm giả mới mỗi lần gọi nên không assert được gì (xem forum-feed.test.tsx).
 */
/**
 * Mock giữ đúng hình dạng thật của `useRouter()`: `canGoBack` là hàm, không phải
 * giá trị. Màn hình gọi nó trước khi `back()` vì vào thẳng bằng deep link thì
 * stack rỗng và `back()` là no-op. `__mockCanGoBack` cho phép từng test dựng
 * lại tình huống đó.
 */
jest.mock('expo-router', () => {
  const back = jest.fn();
  const push = jest.fn();
  const replace = jest.fn();
  const canGoBack = jest.fn(() => true);
  return {
    useRouter: () => ({ back, push, replace, canGoBack }),
    __mockBack: back,
    __mockPush: push,
    __mockReplace: replace,
    __mockCanGoBack: canGoBack,
  };
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


const {
  __mockBack: mockBack,
  __mockReplace: mockReplace,
  __mockCanGoBack: mockCanGoBack,
} = jest.requireMock<{
  __mockBack: jest.Mock;
  __mockReplace: jest.Mock;
  __mockCanGoBack: jest.Mock;
}>('expo-router');

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
  mockReplace.mockClear();
  mockCanGoBack.mockReturnValue(true);
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
/**
 * Nhường một nhịp cho `VirtualizedList` dọn hàng đợi của nó, gọi ở CUỐI mỗi test
 * có render danh sách.
 *
 * FlatList gom việc render ô vào `_updateCellsToRenderBatcher` — một bộ hẹn giờ
 * ~50ms. Nếu nó nổ trong khoảng giữa lúc thân test kết thúc và lúc RNTL gỡ cây,
 * React cập nhật ngoài phạm vi act và in cảnh báo; chạy 6 lần mới bẩn 1 lần nên
 * rất dễ bị kết luận nhầm là đã hết.
 *
 * Phải gọi trong THÂN test chứ không đặt được vào `afterEach`: auto-cleanup của
 * RNTL đăng ký `afterEach` ngay lúc import và jest-circus chạy hook theo đúng
 * thứ tự khai báo, nên nó luôn gỡ cây trước mọi `afterEach` viết ở đây (kiểm
 * chứng: gọi `screen.unmount()` trong afterEach ném "`render` function has not
 * been called").
 */
async function donHangDoiDanhSach() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
}

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
    await donHangDoiDanhSach();
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
    await donHangDoiDanhSach();
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
    await donHangDoiDanhSach();
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
    await donHangDoiDanhSach();
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
    await donHangDoiDanhSach();
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
    await donHangDoiDanhSach();
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
    await donHangDoiDanhSach();
  });

  it('tải chủ đề HỎNG thì báo lỗi kèm nút thử lại, không để form thành ngõ cụt', async () => {
    // `topics.data ?? []` nuốt lỗi: form vẫn vẽ đầy đủ, nhưng vì chủ đề là bắt
    // buộc nên nút Đăng bài khoá vĩnh viễn và không một dòng nào nói vì sao,
    // cũng không có cách nào thử lại.
    server.use(
      http.get(`${BASE}/api/forum/topics`, () =>
        HttpResponse.json(
          { timestamp: '', status: 500, code: 'SYS_0010', message: 'Loi', data: null },
          { status: 500 },
        ),
      ),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Hệ thống đang bận')).toBeTruthy(), {
      timeout: 10_000,
    });
    expect(screen.getByText('Thử lại')).toBeTruthy();
    expect(screen.queryByLabelText('Tiêu đề bài viết')).toBeNull();
    await donHangDoiDanhSach();
  }, 15_000);

  it('form soạn bài KHÔNG có chip "Tất cả" — đó là khái niệm của màn lọc', async () => {
    // "Tất cả" nghĩa là bỏ lọc. Trên form ghi nó đọc thành "bỏ chủ đề": bấm vào
    // là nút Đăng bài khoá lại mà không giải thích gì.
    server.use(topicsOk());

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Hỏi đáp')).toBeTruthy());

    expect(screen.queryByText('Tất cả')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('đang gõ dở mà bấm Quay lại thì HỎI trước, chưa rời đi', async () => {
    // Ô nội dung chứa tới 5000 ký tự. Rời đi im lặng là mất trắng.
    server.use(topicsOk());

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Hỏi đáp')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Tiêu đề bài viết'), 'Đang gõ dở');

    await fireEvent.press(screen.getByTestId('nut-quay-lai'));

    expect(screen.getByTestId('hop-xac-nhan-roi-di')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    await donHangDoiDanhSach();
  });

  it('chưa gõ gì thì bấm Quay lại là đi luôn, không hỏi vô cớ', async () => {
    server.use(topicsOk());

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Hỏi đáp')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-quay-lai'));

    expect(screen.queryByTestId('hop-xac-nhan-roi-di')).toBeNull();
    expect(mockBack).toHaveBeenCalledTimes(1);
    await donHangDoiDanhSach();
  });

  it('chọn "Soạn tiếp" thì đóng hộp và giữ nguyên thứ đang gõ', async () => {
    server.use(topicsOk());

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Hỏi đáp')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Tiêu đề bài viết'), 'Đang gõ dở');
    await fireEvent.press(screen.getByTestId('nut-quay-lai'));

    await fireEvent.press(screen.getByTestId('nut-soan-tiep'));

    expect(screen.queryByTestId('hop-xac-nhan-roi-di')).toBeNull();
    expect(screen.getByLabelText('Tiêu đề bài viết')).toHaveDisplayValue('Đang gõ dở');
    expect(mockBack).not.toHaveBeenCalled();
    await donHangDoiDanhSach();
  });

  it('chọn "Bỏ luôn" thì mới thật sự rời đi', async () => {
    server.use(topicsOk());

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Hỏi đáp')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText('Tiêu đề bài viết'), 'Đang gõ dở');
    await fireEvent.press(screen.getByTestId('nut-quay-lai'));

    await fireEvent.press(screen.getByTestId('nut-bo-ban-nhap'));

    expect(mockBack).toHaveBeenCalledTimes(1);
    await donHangDoiDanhSach();
  });

  it('stack rỗng (vào thẳng bằng deep link) thì rời đi bằng replace, không phải back', async () => {
    // `back()` khi stack rỗng là no-op: người dùng đứng yên tại chỗ mà không
    // hiểu vì sao nút không ăn.
    mockCanGoBack.mockReturnValue(false);
    server.use(topicsOk());

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Hỏi đáp')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-quay-lai'));

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    await donHangDoiDanhSach();
  });

  it('tải lại nền KHÔNG nuốt mất bản nháp đang gõ đè lên bài cũ', async () => {
    // Chốt `daNapBaiCu` tồn tại vì lý do này; trước đây bỏ chốt đi mà suite vẫn
    // xanh, tức là lập luận trong JSDoc không được gì bảo vệ.
    // Lần tải lại phải trả về dữ liệu KHÁC, nếu không object `data` giữ nguyên
    // tham chiếu và `useEffect` chẳng buồn chạy lại — test sẽ xanh kể cả khi bỏ
    // hẳn chốt, tức là không chứng minh được gì.
    let lanGoi = 0;
    server.use(
      topicsOk(),
      http.get(`${BASE}/api/forum/posts/p1`, () => {
        lanGoi += 1;
        return HttpResponse.json(
          envelope(
            lanGoi === 1
              ? POST_CUA_TOI
              : { ...POST_CUA_TOI, title: 'Tiêu đề máy chủ vừa đổi', reactionCount: 99 },
          ),
        );
      }),
    );

    await renderScreen('p1');
    await waitFor(() =>
      expect(screen.getByLabelText('Tiêu đề bài viết')).toHaveDisplayValue(
        'Tiêu đề đã lưu trước đó',
      ),
    );

    await fireEvent.changeText(screen.getByLabelText('Tiêu đề bài viết'), 'Tôi đang sửa dở');
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: forumKeys.post('p1') });
    });

    // Dữ liệu mới đã vào cache...
    await waitFor(() =>
      expect(queryClient.getQueryData<{ title: string }>(forumKeys.post('p1'))?.title).toBe(
        'Tiêu đề máy chủ vừa đổi',
      ),
    );
    // ...và React đã render lại với nó. Thiếu nhịp này thì khẳng định bên dưới
    // đọc lần render CŨ và sẽ xanh kể cả khi bản nháp sắp bị nuốt — xem chú
    // thích cùng loại ở `useForumMutations.test.tsx`.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByLabelText('Tiêu đề bài viết')).toHaveDisplayValue('Tôi đang sửa dở');
    await donHangDoiDanhSach();
  });
});

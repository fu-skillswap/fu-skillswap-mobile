import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { PostDetailScreen } from '@/features/forum';
import { donHangDoiDanhSach } from '@/test-utils/nhuongNhip';

const BASE = 'https://api.skillswap.asia';

/**
 * `PostDetailScreen` tự nó không dùng expo-router, nhưng nó được lấy qua barrel
 * `@/features/forum` — barrel kéo theo `ForumFeedScreen`, file này import
 * `expo-router`, mà `expo-router` lại require `standard-navigation`: một package
 * ship ESM thô, không nằm trong `transformIgnorePatterns`, nên Jest nổ
 * "Cannot use import statement outside a module" ngay ở bước import.
 *
 * Mock giữ đúng hình dạng thật (`useRouter()` trả về object có `push`) để nếu
 * sau này màn hình chi tiết cần điều hướng thì mock không phải viết lại.
 */
/**
 * Mock giữ đúng hình dạng thật của `useRouter()`: `canGoBack` là hàm, không phải
 * giá trị. Màn hình gọi nó trước khi `back()` vì vào thẳng bằng deep link thì
 * stack rỗng và `back()` là no-op. `__mockCanGoBack` cho phép từng test dựng
 * lại tình huống đó.
 */
jest.mock('expo-router', () => {
  const push = jest.fn();
  const back = jest.fn();
  const replace = jest.fn();
  const canGoBack = jest.fn(() => true);
  return {
    useRouter: () => ({ push, back, replace, canGoBack }),
    __mockPush: push,
    __mockBack: back,
    __mockReplace: replace,
    __mockCanGoBack: canGoBack,
  };
});
jest.mock('@/core/net/onlineStatus', () => ({ useIsOffline: () => false }));

/**
 * Màn hình chi tiết chỉ bày nút sửa/xoá cho CHÍNH tác giả, nên nó cần biết ai
 * đang đăng nhập. Mock giữ đúng hình dạng thật của `AuthContextValue`
 * (`status`, `user`, `signInWithGoogle`, `signOut`) — trả về mỗi `user` thì
 * chỗ nào đọc `status` sau này sẽ chỉ vỡ trong test chứ không vỡ trên máy thật.
 *
 * Biến phải mở đầu bằng `mock` mới được tham chiếu từ trong factory (Jest hoist
 * `jest.mock` lên trên mọi khai báo); nó chỉ được ĐỌC lúc render nên TDZ không
 * chạm tới.
 */
let mockNguoiDungHienTai: { publicId: string } | null = null;
jest.mock('@/core/auth/AuthProvider', () => ({
  useAuth: () => ({
    status: mockNguoiDungHienTai ? 'authenticated' : 'unauthenticated',
    user: mockNguoiDungHienTai,
    signInWithGoogle: jest.fn(),
    signOut: jest.fn(),
  }),
}));

const {
  __mockPush: mockPush,
  __mockBack: mockBack,
  __mockReplace: mockReplace,
  __mockCanGoBack: mockCanGoBack,
} = jest.requireMock<{
  __mockPush: jest.Mock;
  __mockBack: jest.Mock;
  __mockReplace: jest.Mock;
  __mockCanGoBack: jest.Mock;
}>('expo-router');

function envelope(data: unknown) {
  return { timestamp: '2026-09-22T00:00:00Z', status: 200, code: 'SUCCESS', message: 'OK', data };
}

function loi500() {
  return HttpResponse.json(
    { timestamp: '', status: 500, code: 'SYS_0010', message: 'Loi', data: null },
    { status: 500 },
  );
}

function cursorPage(items: unknown[], nextCursor: string | null = null) {
  return {
    items,
    nextCursor,
    prevCursor: null,
    hasNext: nextCursor !== null,
    hasPrev: false,
    limit: 20,
  };
}

function baseComment(commentId: string, overrides: Record<string, unknown> = {}) {
  return {
    commentId,
    postId: 'p1',
    authorUserId: 'u1',
    authorFullName: 'Nguyen Van A',
    authorAvatarUrl: '',
    authorRole: 'MENTEE',
    content: `noi dung ${commentId}`,
    status: 'VISIBLE',
    reportCount: 0,
    reactionCount: 0,
    reactedByCurrentUser: false,
    replyToCommentId: null,
    createdAt: '2026-09-22T00:00:00Z',
    updatedAt: '2026-09-22T00:00:00Z',
    imageUrls: [],
    ...overrides,
  };
}

const POST = {
  postId: 'p1',
  authorUserId: 'u1',
  authorFullName: 'Nguyen Van A',
  authorAvatarUrl: '',
  authorProgram: null,
  forumTopic: { id: 't1', code: 'QUESTION', nameVi: 'Hỏi đáp', nameEn: 'Q&A', displayOrder: 1 },
  title: 'Học Spring Boot từ đâu?',
  content: 'Nội dung bài viết',
  status: 'PUBLISHED',
  commentCount: 2,
  reactionCount: 0,
  reportCount: 0,
  lastActivityAt: '2026-09-22T00:00:00Z',
  reactedByCurrentUser: false,
  myReactionType: null,
  createdAt: '2026-09-22T00:00:00Z',
  updatedAt: '2026-09-22T00:00:00Z',
  imageUrls: [],
};

/** Handler bài viết dùng lại ở mọi test — màn hình luôn gọi nó khi mở. */
const postOk = () => http.get(`${BASE}/api/forum/posts/p1`, () => HttpResponse.json(envelope(POST)));
const commentsOk = (items: unknown[] = []) =>
  http.get(`${BASE}/api/forum/posts/p1/comments`, () =>
    HttpResponse.json(envelope(cursorPage(items))),
  );

const server = setupServer();

/** Một QueryClient cho mỗi test, KHÔNG phải mỗi lần render — xem Global Constraints. */
let queryClient: QueryClient;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient = createQueryClient();
  mockPush.mockClear();
  mockBack.mockClear();
  mockReplace.mockClear();
  mockCanGoBack.mockReturnValue(true);
  mockBack.mockClear();
  // Mặc định: ĐÃ đăng nhập nhưng KHÔNG phải tác giả bài viết.
  //
  // Trước đây mặc định là `null` ("khách vãng lai"), nhưng kể từ khi
  // `app/forum/_layout.tsx` có gate đăng nhập thì khách không thể tới được màn
  // hình này — 27 test mô tả một trạng thái không tồn tại, và chính điều đó che
  // mất việc nhánh /forum/* đang hở. Giữ mặc định khớp với thực tế.
  mockNguoiDungHienTai = { publicId: 'u-khac' };
});
afterEach(() => {
  // `clear()` một mình bỏ sót bộ hẹn giờ gcTime của mutation và Jest treo sau
  // khi test xong — xem JSDoc của `__resetQueryClientForTests`.
  __resetQueryClientForTests(queryClient);
  server.resetHandlers();
  __resetApiClientForTests();
});
afterAll(() => server.close());

/** `render` của RNTL 14 là hàm ASYNC — phải await, nếu không lần render đầu nằm ngoài act(). */
async function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <PostDetailScreen postId="p1" />
    </QueryClientProvider>,
  );
}

describe('PostDetailScreen', () => {
  it('hiện bài viết, dòng Trả lời ai của reply, và badge AI của bot', async () => {
    server.use(
      postOk(),
      commentsOk([
        baseComment('c1'),
        baseComment('r1', {
          replyToCommentId: 'c1',
          replyToUserName: 'Nguyen Van A',
          authorUserId: 'bot-user-id',
          authorFullName: 'SkillSwap AI',
        }),
      ]),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy());
    expect(screen.getByText('AI')).toBeTruthy();
    expect(screen.getByText(/Trả lời Nguyen Van A/)).toBeTruthy();
    await donHangDoiDanhSach();
  });

  it('bài chưa có bình luận thì hiện trạng thái rỗng, không phải lỗi', async () => {
    server.use(postOk(), commentsOk([]));

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Chưa có bình luận')).toBeTruthy());
    await donHangDoiDanhSach();
  });

  it('bình luận lỗi 500 thì báo lỗi, KHÔNG nói dối là chưa ai bình luận', async () => {
    // Gộp lỗi vào trạng thái rỗng là nói với người dùng rằng bài này không ai
    // trả lời, trong khi thật ra chỉ là không tải được.
    server.use(
      postOk(),
      http.get(`${BASE}/api/forum/posts/p1/comments`, () => loi500()),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Hệ thống đang bận')).toBeTruthy(), {
      timeout: 10_000,
    });
    expect(screen.queryByText('Chưa có bình luận')).toBeNull();
    // Bài viết vẫn đọc được: hai query độc lập nhau.
    expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy();
    // 15s: `shouldRetryQuery` retry hai lần trước khi báo lỗi nên waitFor chờ
    // 10s. Không nới timeout của `it` thì Jest cắt ở mốc mặc định 5s và báo
    // "Exceeded timeout", che mất assertion thật sự hỏng.
    await donHangDoiDanhSach();
  }, 15_000);

  it('bài viết lỗi 500 ngay từ đầu thì hiện ErrorView kèm nút thử lại', async () => {
    server.use(
      http.get(`${BASE}/api/forum/posts/p1`, () => loi500()),
      commentsOk([]),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Hệ thống đang bận')).toBeTruthy(), {
      timeout: 10_000,
    });
    expect(screen.getByText('Thử lại')).toBeTruthy();
    await donHangDoiDanhSach();
  }, 15_000);

  it('tải lại HỎNG khi đã có bài thì GIỮ NGUYÊN nội dung, chỉ báo nhẹ', async () => {
    // `isError` của TanStack v5 bật cả khi query đã có data và chỉ lần refetch
    // nền thất bại; dựa vào mình nó thì một lần kéo-để-tải-lại hụt sóng sẽ xoá
    // mất bài người dùng đang đọc dở, dù nó còn nguyên trong cache.
    let lanGoi = 0;
    server.use(
      http.get(`${BASE}/api/forum/posts/p1`, () => {
        lanGoi += 1;
        return lanGoi === 1 ? HttpResponse.json(envelope(POST)) : loi500();
      }),
      commentsOk([baseComment('c1')]),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy());

    await fireEvent(screen.getByTestId('danh-sach-binh-luan'), 'refresh');

    await waitFor(() => expect(screen.getByTestId('loi-tai-lai-nen')).toBeTruthy(), {
      timeout: 10_000,
    });
    expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy();
    expect(screen.queryByText('Hệ thống đang bận')).toBeNull();
    await donHangDoiDanhSach();
  }, 15_000);

  it('cuộn tới cuối thì tải trang bình luận kế, và không gọi trùng khi đang tải', async () => {
    const cursorDaGui: (string | null)[] = [];
    server.use(
      postOk(),
      http.get(`${BASE}/api/forum/posts/p1/comments`, async ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursorDaGui.push(cursor);
        if (cursor === null) {
          return HttpResponse.json(envelope(cursorPage([baseComment('c1')], 'c2')));
        }
        // Chậm có chủ ý: giữ isFetchingNextPage bật đủ lâu để lần onEndReached
        // thứ hai rơi vào đúng lúc chốt chặn phải chặn.
        await new Promise((resolve) => setTimeout(resolve, 80));
        return HttpResponse.json(envelope(cursorPage([baseComment('c2')])));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('noi dung c1')).toBeTruthy());

    // Hai lần bắn phải nằm trong CÙNG một tick — đó mới là điều FlatList làm khi
    // người dùng quăng nhanh tới cuối, và là tình huống duy nhất mà guard theo
    // state render không chặn nổi. Dùng hai `await fireEvent` thì React kịp render
    // lại ở giữa; bắn song song thì hai act lồng nhau làm hỏng test kế tiếp.
    const onEndReached = screen.getByTestId('danh-sach-binh-luan').props.onEndReached as () => void;
    await act(async () => {
      onEndReached();
      onEndReached();
    });

    await waitFor(() => expect(screen.getByText('noi dung c2')).toBeTruthy());
    expect(cursorDaGui).toEqual([null, 'c2']);
    await donHangDoiDanhSach();
  });

  it('MẤT MẠNG lúc mở màn hình thì nói mất kết nối, KHÔNG nói chưa có bình luận', async () => {
    // `isLoading` KHÔNG bật khi mất mạng: với networkMode 'online' (mặc định),
    // query nằm ở status 'pending' + fetchStatus 'paused', mà
    // `isLoading = isPending && isFetching` nên nó là false. Màn hình chỉ hỏi
    // `isLoading` sẽ rơi thẳng xuống nhánh rỗng và báo "Chưa có bình luận" trong
    // khi thực ra chưa hề gọi được API — nói dối người dùng, đúng kiểu mà test
    // "bình luận lỗi 500" ở trên sinh ra để chặn, chỉ khác nguyên nhân.
    onlineManager.setOnline(false);
    try {
      server.use(postOk(), commentsOk([]));

      await renderScreen();

      await waitFor(() => expect(screen.getByText('Không có kết nối')).toBeTruthy());
      expect(screen.queryByText('Chưa có bình luận')).toBeNull();
    } finally {
      // Bật mạng lại làm các query đang hoãn chạy tiếp và setState trên màn hình
      // vẫn còn gắn — phải nằm trong act đã await, nếu không React kêu
      // "not wrapped in act(...)" và act scope hỏng sẽ lan sang test kế tiếp.
      await act(async () => {
        onlineManager.setOnline(true);
      });
    }
    await donHangDoiDanhSach();
  });

  it('reply mồ côi vẫn giữ dòng Trả lời ai dù bị nâng lên làm bình luận gốc', async () => {
    // Phân trang theo cursor: bình luận gốc có thể nằm ở trang trước, nên
    // `buildCommentTree` nâng reply mồ côi lên làm gốc để nó không biến mất.
    // Nhưng nó vẫn LÀ một reply. Nếu màn hình chỉ truyền `isReply` cho phần tử
    // nằm trong `replies`, reply mồ côi mất sạch ngữ cảnh và người đọc thấy một
    // câu cụt lủn không hiểu đang trả lời ai.
    server.use(
      postOk(),
      commentsOk([
        baseComment('r9', {
          replyToCommentId: 'khong-co-trong-trang-nay',
          replyToUserName: 'Tran Thi B',
          content: 'Dung roi ban oi',
        }),
      ]),
    );

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Dung roi ban oi')).toBeTruthy());
    expect(screen.getByText(/Trả lời Tran Thi B/)).toBeTruthy();
    await donHangDoiDanhSach();
  });

  it('bấm Trả lời thì nói rõ đang trả lời AI, và huỷ được', async () => {
    // Trước Task 11 màn hình truyền `onReply` trỏ vào một state không ai đọc:
    // người dùng bấm "Trả lời", cả màn hình render lại, và không có gì xảy ra.
    // Nút chỉ được phép tồn tại khi đã có ô nhập thật VÀ có chỉ báo cho biết
    // mình đang trả lời ai — thiếu chỉ báo thì bình luận rơi vào chỗ khác với
    // chỗ người dùng tưởng.
    server.use(postOk(), commentsOk([baseComment('c1')]));

    await renderScreen();
    await waitFor(() => expect(screen.getByText('noi dung c1')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Trả lời' }));

    expect(screen.getByTestId('dang-tra-loi')).toBeTruthy();
    expect(screen.getByText(/Đang trả lời Nguyen Van A/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('nut-huy-tra-loi'));

    expect(screen.queryByTestId('dang-tra-loi')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('ô nhập rỗng thì nút Gửi bị khoá, không gửi bình luận trắng', async () => {
    // Bình luận rỗng chỉ nhận về 400 mà vẫn tiêu một lượt trong hạn mức 20 bình
    // luận/10 phút. Nút phải TỰ KHOÁ chứ không im lặng khi bấm.
    server.use(postOk(), commentsOk([]));

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Chưa có bình luận')).toBeTruthy());

    expect(screen.getByTestId('nut-gui-binh-luan').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );

    // Chỉ có khoảng trắng cũng là rỗng.
    await fireEvent.changeText(screen.getByLabelText('Nội dung bình luận'), '   ');
    expect(screen.getByTestId('nut-gui-binh-luan').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
    await donHangDoiDanhSach();
  });

  it('bình luận mới (không trả lời ai) gửi replyToCommentId là null và dọn ô nhập', async () => {
    // Ô nhập không được dọn là cái bẫy im lặng nhất: người dùng thấy chữ mình
    // còn nguyên, tưởng chưa gửi được, bấm Gửi lần nữa và ăn chặn trùng nội
    // dung cùng bài trong 5 phút của backend.
    let body = null as Record<string, unknown> | null;
    let lanLayBinhLuan = 0;
    server.use(
      postOk(),
      http.get(`${BASE}/api/forum/posts/p1/comments`, () => {
        lanLayBinhLuan += 1;
        return HttpResponse.json(
          envelope(cursorPage(lanLayBinhLuan === 1 ? [] : [baseComment('c9')])),
        );
      }),
      http.post(`${BASE}/api/forum/posts/p1/comments`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(envelope(baseComment('c9')));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Chưa có bình luận')).toBeTruthy());

    await fireEvent.changeText(screen.getByLabelText('Nội dung bình luận'), 'Minh cung dang hoc');
    await fireEvent.press(screen.getByTestId('nut-gui-binh-luan'));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toEqual({ content: 'Minh cung dang hoc', replyToCommentId: null });
    await waitFor(() => expect(screen.getByLabelText('Nội dung bình luận').props.value).toBe(''));
    await donHangDoiDanhSach();
  });

  it('trả lời một REPLY vẫn gửi replyToCommentId là id của bình luận GỐC', async () => {
    // Test đáng giá nhất của task: gửi id của reply thì backend trả 400 "Chỉ hỗ
    // trợ trả lời bình luận 1 cấp", và không test nào khác bắt được.
    // `as` thay vì chú thích kiểu — xem giải thích ở Task 4 (narrowing qua closure).
    let body = null as Record<string, unknown> | null;
    server.use(
      postOk(),
      commentsOk([
        baseComment('c1'),
        baseComment('r1', {
          replyToCommentId: 'c1',
          replyToUserName: 'Nguyen Van A',
          authorFullName: 'Tran Thi B',
        }),
      ]),
      http.post(`${BASE}/api/forum/posts/p1/comments`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(envelope(baseComment('c9')));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Tran Thi B')).toBeTruthy());

    // Bấm "Trả lời" trên REPLY (phần tử thứ hai), không phải trên bình luận gốc.
    await fireEvent.press(screen.getAllByRole('button', { name: 'Trả lời' })[1]!);
    // Chỉ báo vẫn nói tên người viết reply — đó là người mình đang trả lời.
    expect(screen.getByText(/Đang trả lời Tran Thi B/)).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Nội dung bình luận'), 'Toi cung thac mac');
    await fireEvent.press(screen.getByTestId('nut-gui-binh-luan'));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body?.replyToCommentId).toBe('c1');
    await donHangDoiDanhSach();
  });

  it('bình luận bị 429 thì hiện nguyên văn câu của backend, không nút Thử lại và GIỮ nội dung', async () => {
    // Hạn mức 20 bình luận/10 phút và chặn trùng nội dung trong 5 phút. Bày nút
    // "Thử lại" là mời vào vòng lặp chắc chắn hỏng tiếp, còn xoá nội dung vừa gõ
    // thì người dùng mất luôn thứ họ định sửa lại.
    server.use(
      postOk(),
      commentsOk([]),
      http.post(`${BASE}/api/forum/posts/p1/comments`, () =>
        HttpResponse.json(
          {
            timestamp: '',
            status: 429,
            code: 'TOO_MANY_REQUESTS',
            message: 'Ban binh luan qua nhanh, thu lai sau',
            data: null,
            retryAfterSeconds: 90,
          },
          { status: 429 },
        ),
      ),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Chưa có bình luận')).toBeTruthy());

    await fireEvent.changeText(screen.getByLabelText('Nội dung bình luận'), 'Spam spam');
    await fireEvent.press(screen.getByTestId('nut-gui-binh-luan'));

    await waitFor(() => expect(screen.getByTestId('loi-gui-binh-luan')).toBeTruthy());
    expect(screen.getByText('Ban binh luan qua nhanh, thu lai sau')).toBeTruthy();
    expect(screen.queryByText('Thử lại')).toBeNull();
    expect(screen.getByLabelText('Nội dung bình luận').props.value).toBe('Spam spam');
    await donHangDoiDanhSach();
  });

  it('báo cáo một BÌNH LUẬN gửi đúng targetType COMMENT và id của bình luận đó', async () => {
    let body = null as Record<string, unknown> | null;
    server.use(
      postOk(),
      commentsOk([baseComment('c1'), baseComment('c2')]),
      http.post(`${BASE}/api/forum/reports`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(envelope({ reportId: 'r1' }));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('noi dung c2')).toBeTruthy());

    // Hai bình luận, nên phải báo cáo đúng cái thứ hai.
    await fireEvent.press(screen.getAllByRole('button', { name: 'Báo cáo' })[1]!);
    await fireEvent.press(screen.getByText('Quấy rối, công kích cá nhân'));
    await fireEvent.press(screen.getByTestId('nut-gui-bao-cao'));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toEqual({ targetType: 'COMMENT', targetId: 'c2', reasonType: 'HARASSMENT' });
    // Gửi xong phải nói là đã gửi, không đóng im lặng.
    await waitFor(() => expect(screen.getByTestId('da-gui-bao-cao')).toBeTruthy());
    await donHangDoiDanhSach();
  });

  it('báo cáo BÀI VIẾT gửi targetType POST kèm postId', async () => {
    let body = null as Record<string, unknown> | null;
    server.use(
      postOk(),
      commentsOk([]),
      http.post(`${BASE}/api/forum/reports`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(envelope({ reportId: 'r1' }));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-bao-cao-bai')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-bao-cao-bai'));
    await fireEvent.press(screen.getByText('Spam, quảng cáo rác'));
    await fireEvent.press(screen.getByTestId('nut-gui-bao-cao'));

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toEqual({ targetType: 'POST', targetId: 'p1', reasonType: 'SPAM' });
    await donHangDoiDanhSach();
  });

  it('đóng hộp báo cáo rồi mở lại thì không còn mang lỗi của lần trước', async () => {
    // `useMutation` giữ lỗi cho tới khi `reset()`. Quên reset thì người dùng mở
    // hộp báo cáo cho một đối tượng KHÁC và thấy ngay câu lỗi của lần trước.
    server.use(
      postOk(),
      commentsOk([baseComment('c1')]),
      http.post(`${BASE}/api/forum/reports`, () =>
        HttpResponse.json(
          {
            timestamp: '',
            status: 429,
            code: 'TOO_MANY_REQUESTS',
            message: 'Ban da bao cao qua nhieu lan',
            data: null,
          },
          { status: 429 },
        ),
      ),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('noi dung c1')).toBeTruthy());

    await fireEvent.press(screen.getByRole('button', { name: 'Báo cáo' }));
    await fireEvent.press(screen.getByText('Spam, quảng cáo rác'));
    await fireEvent.press(screen.getByTestId('nut-gui-bao-cao'));
    await waitFor(() => expect(screen.getByTestId('loi-gui-bao-cao')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-dong-bao-cao'));
    await fireEvent.press(screen.getByRole('button', { name: 'Báo cáo' }));

    expect(screen.queryByTestId('loi-gui-bao-cao')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('bấm tim một bình luận thì đổi ngay và gửi PUT tới đúng bình luận đó', async () => {
    const duongDan: string[] = [];
    server.use(
      postOk(),
      commentsOk([baseComment('c1'), baseComment('c2')]),
      http.put(`${BASE}/api/forum/comments/:commentId/reaction`, ({ params }) => {
        duongDan.push(String(params.commentId));
        return HttpResponse.json(
          envelope(baseComment('c2', { reactedByCurrentUser: true, reactionCount: 1 })),
        );
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('noi dung c2')).toBeTruthy());

    // Hai bình luận nên phải bấm đúng cái thứ hai, không lấy nhãn chung.
    await fireEvent.press(
      within(screen.getByTestId('so-thich-binh-luan-c2')).getByText('0'),
    );

    await waitFor(() =>
      expect(within(screen.getByTestId('so-thich-binh-luan-c2')).getByText('1')).toBeTruthy(),
    );
    expect(duongDan).toEqual(['c2']);
    // Bình luận bên cạnh giữ nguyên.
    expect(within(screen.getByTestId('so-thich-binh-luan-c1')).getByText('0')).toBeTruthy();

    // FlatList gom việc tính lại ô hiển thị vào một hẹn giờ ~50ms
    // (`_updateCellsToRenderBatcher`). Test kết thúc trước khi nó nổ thì cú
    // setState đó rơi ra ngoài mọi act() và React kêu "not wrapped in act(...)"
    // — cảnh báo lại hiện ở một test khác vì nó nổ sau. Đợi cho nó nổ trong act.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    await donHangDoiDanhSach();
  });

  it('cả bình luận gốc LẪN reply đều có nút thả tim thật', async () => {
    // Reply được render ở một nhánh khác trong `renderItem`; quên truyền handler
    // ở nhánh đó thì reply có ô lượt thích nhìn y hệt mà bấm không ăn.
    server.use(
      postOk(),
      commentsOk([
        baseComment('c1'),
        baseComment('r1', { replyToCommentId: 'c1', replyToUserName: 'Nguyen Van A' }),
      ]),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByText('noi dung r1')).toBeTruthy());

    expect(screen.getAllByRole('button', { name: 'Thích bình luận' })).toHaveLength(2);
    await donHangDoiDanhSach();
  });
});

describe('PostDetailScreen — tác giả sửa và xoá bài của mình', () => {
  it('bài của NGƯỜI KHÁC thì không bày nút sửa hay nút xoá', async () => {
    // Backend trả 403 cho việc sửa/xoá bài người khác; bày nút ra chỉ để nhận
    // 403 là mời người dùng bấm vào một cái chắc chắn hỏng.
    mockNguoiDungHienTai = { publicId: 'u-khac' };
    server.use(postOk(), commentsOk([]));

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Học Spring Boot từ đâu?')).toBeTruthy());

    expect(screen.queryByTestId('nut-sua-bai')).toBeNull();
    expect(screen.queryByTestId('nut-xoa-bai')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('bài của MÌNH thì không bày nút báo cáo bài viết', async () => {
    // Báo cáo bài của chính mình là vô nghĩa, và nút đó nằm đúng chỗ của nút
    // Sửa/Xoá nên rất dễ bấm nhầm.
    mockNguoiDungHienTai = { publicId: 'u1' };
    server.use(postOk(), commentsOk([]));

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-xoa-bai')).toBeTruthy());

    expect(screen.queryByTestId('nut-bao-cao-bai')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('bài của MÌNH thì bấm Sửa bài mở form soạn kèm đúng postId', async () => {
    mockNguoiDungHienTai = { publicId: 'u1' };
    server.use(postOk(), commentsOk([]));

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-sua-bai')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-sua-bai'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/forum/compose',
      params: { postId: 'p1' },
    });
    await donHangDoiDanhSach();
  });

  it('bấm Xoá bài thì HỎI LẠI trước, chưa gửi DELETE nào', async () => {
    // Xoá không hoàn tác được. Một cú chạm nhầm mà gửi thẳng DELETE là mất bài.
    let soDelete = 0;
    mockNguoiDungHienTai = { publicId: 'u1' };
    server.use(
      postOk(),
      commentsOk([]),
      http.delete(`${BASE}/api/forum/posts/p1`, () => {
        soDelete += 1;
        return HttpResponse.json(envelope(POST));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-xoa-bai')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-xoa-bai'));

    expect(screen.getByTestId('hop-xac-nhan-xoa')).toBeTruthy();
    expect(soDelete).toBe(0);
    expect(mockBack).not.toHaveBeenCalled();
    await donHangDoiDanhSach();
  });

  it('huỷ trong hộp xác nhận thì đóng hộp và không xoá gì', async () => {
    let soDelete = 0;
    mockNguoiDungHienTai = { publicId: 'u1' };
    server.use(
      postOk(),
      commentsOk([]),
      http.delete(`${BASE}/api/forum/posts/p1`, () => {
        soDelete += 1;
        return HttpResponse.json(envelope(POST));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-xoa-bai')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('nut-xoa-bai'));

    await fireEvent.press(screen.getByTestId('nut-huy-xoa'));

    await waitFor(() => expect(screen.queryByTestId('hop-xac-nhan-xoa')).toBeNull());
    expect(soDelete).toBe(0);
    await donHangDoiDanhSach();
  });

  it('xác nhận xoá thì gửi DELETE tới đúng bài rồi quay lại màn trước', async () => {
    let duongDan = '';
    mockNguoiDungHienTai = { publicId: 'u1' };
    server.use(
      postOk(),
      commentsOk([]),
      http.delete(`${BASE}/api/forum/posts/:postId`, ({ params }) => {
        duongDan = String(params.postId);
        return HttpResponse.json(envelope({ ...POST, status: 'DELETED' }));
      }),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-xoa-bai')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('nut-xoa-bai'));

    await fireEvent.press(screen.getByTestId('nut-xac-nhan-xoa'));

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(duongDan).toBe('p1');
    await donHangDoiDanhSach();
  });

  it('xoá HỎNG thì nói rõ vì sao, không đóng hộp và im lặng', async () => {
    // Nếu DELETE hỏng mà giao diện không nói gì, hộp vẫn mở và nút hết quay:
    // người dùng không biết bài đã xoá được hay chưa và sẽ bấm lại.
    mockNguoiDungHienTai = { publicId: 'u1' };
    server.use(
      postOk(),
      commentsOk([]),
      http.delete(`${BASE}/api/forum/posts/p1`, () =>
        HttpResponse.json(
          {
            timestamp: '',
            status: 403,
            code: 'FORUM_4303',
            message: 'Ban khong phai tac gia bai viet nay',
            data: null,
          },
          { status: 403 },
        ),
      ),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-xoa-bai')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('nut-xoa-bai'));
    await fireEvent.press(screen.getByTestId('nut-xac-nhan-xoa'));

    await waitFor(() => expect(screen.getByTestId('loi-xoa-bai')).toBeTruthy());
    expect(screen.getByText('Ban khong phai tac gia bai viet nay')).toBeTruthy();
    // Hộp vẫn mở để người dùng đọc được lý do.
    expect(screen.getByTestId('hop-xac-nhan-xoa')).toBeTruthy();
    await donHangDoiDanhSach();
  });

  it('nút back cứng của Android đóng được hộp xác nhận xoá', async () => {
    // Comment trong code khẳng định điều này; trước đây gỡ hẳn `onRequestClose`
    // đi mà cả suite vẫn xanh, tức là lời khẳng định không được gì bảo vệ. Kẹt
    // trong một câu hỏi không có đường thoát là lỗi thật trên Android.
    mockNguoiDungHienTai = { publicId: 'u1' };
    server.use(postOk(), commentsOk([]));

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-xoa-bai')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('nut-xoa-bai'));
    expect(screen.getByTestId('hop-xac-nhan-xoa')).toBeTruthy();

    // RNTL 14 đã bỏ `UNSAFE_getByType`, nên lấy `Modal` bằng testID của chính nó
    // rồi gọi thẳng handler mà Android nối vào nút back cứng.
    const hop = screen.getByTestId('hop-thoai-xoa');
    await act(async () => {
      (hop.props.onRequestClose as () => void)();
    });

    expect(screen.queryByTestId('hop-xac-nhan-xoa')).toBeNull();
    await donHangDoiDanhSach();
  });

  it('stack rỗng thì xoá xong rời đi bằng replace, không phải back', async () => {
    // Vào thẳng `/forum/{id}` bằng deep link hay thông báo đẩy thì stack rỗng và
    // `back()` là no-op: người dùng ngồi nhìn chính bài vừa xoá, hộp đã đóng,
    // không hiểu chuyện gì vừa xảy ra.
    mockCanGoBack.mockReturnValue(false);
    mockNguoiDungHienTai = { publicId: 'u1' };
    server.use(
      postOk(),
      commentsOk([]),
      http.delete(`${BASE}/api/forum/posts/p1`, () =>
        HttpResponse.json(envelope({ ...POST, status: 'DELETED' })),
      ),
    );

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('nut-xoa-bai')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('nut-xoa-bai'));
    await fireEvent.press(screen.getByTestId('nut-xac-nhan-xoa'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'));
    expect(mockBack).not.toHaveBeenCalled();
    await donHangDoiDanhSach();
  });

  it('nội dung dài quá 2000 ký tự thì nút Gửi bị khoá', async () => {
    // `TextInput maxLength` chặn được ở máy thật, nhưng `fireEvent.changeText`
    // KHÔNG tôn trọng maxLength — nên đây là cách duy nhất chạm tới nửa sau của
    // guard `draft.length <= COMMENT_MAX`. Trước đây bỏ hẳn nửa đó mà toàn bộ
    // 300 test vẫn xanh, tức là giới hạn của backend (forum.md §4.3) không được
    // gì canh.
    mockNguoiDungHienTai = { publicId: 'u-khac' };
    server.use(postOk(), commentsOk([]));

    await renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Nội dung bình luận')).toBeTruthy());

    await fireEvent.changeText(screen.getByLabelText('Nội dung bình luận'), 'a'.repeat(2001));

    expect(screen.getByTestId('nut-gui-binh-luan')).toBeDisabled();
    await donHangDoiDanhSach();
  });

  it('ô nhập được bọc trong lớp tránh bàn phím', async () => {
    // Đây là một chốt CẤU TRÚC rất hẹp: nó chỉ chứng minh lớp tránh bàn phím
    // CÒN Ở ĐÓ, không chứng minh được nó hoạt động. Hai giới hạn, đều đã kiểm:
    // jest không có layout engine nên không cách nào biết bàn phím có che ô nhập
    // hay không; và `KeyboardAvoidingView` tiêu thụ prop `behavior` nên phần tử
    // render ra không mang nó (`props.behavior` là `undefined`), vì vậy cả giá
    // trị 'padding' cho iOS cũng không assert được. Đúng đắn của nó chỉ xác minh
    // được trên thiết bị thật.
    //
    // Vì sao cần: bàn phím iOS là một cửa sổ PHỦ LÊN app, hệ điều hành không co
    // view lại. Không có lớp này thì thanh nhập dính đáy cùng nút "Gửi" nằm
    // dưới bàn phím. Android thì `adjustResize` mặc định của Expo đã tự co, nên
    // `behavior` để `undefined` ở đó.
    server.use(postOk(), commentsOk([]));

    await renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Nội dung bình luận')).toBeTruthy());

    expect(screen.getByTestId('vung-tranh-ban-phim')).toBeTruthy();
    await donHangDoiDanhSach();
  });
});

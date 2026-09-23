import { onlineManager, QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

import { __resetApiClientForTests } from '@/core/api/client';
import { __resetQueryClientForTests, createQueryClient } from '@/core/api/queryClient';
import { PostDetailScreen } from '@/features/forum';

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
jest.mock('expo-router', () => {
  const push = jest.fn();
  const back = jest.fn();
  return { useRouter: () => ({ push, back }), __mockPush: push, __mockBack: back };
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

const { __mockPush: mockPush, __mockBack: mockBack } = jest.requireMock<{
  __mockPush: jest.Mock;
  __mockBack: jest.Mock;
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
  // Mặc định: khách vãng lai, không phải tác giả — mọi test cũ giữ nguyên hành vi.
  mockNguoiDungHienTai = null;
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
 * Để FlatList dọn xong hàng đợi của nó TRƯỚC khi test kết thúc.
 *
 * `VirtualizedList` gom việc render ô vào `_updateCellsToRenderBatcher`, một bộ
 * hẹn giờ ~50ms. Nếu test kết thúc trước khi nó nổ, React cập nhật ngoài phạm vi
 * act và in "An update to VirtualizedList inside a test was not wrapped in
 * act(...)". Cảnh báo này CHẬP CHỜN — chạy 6 lần chỉ bẩn 1–2 lần — nên rất dễ
 * bị kết luận nhầm là đã hết chỉ vì lần chạy gần nhất sạch.
 */
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
});


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
  });

  it('bài chưa có bình luận thì hiện trạng thái rỗng, không phải lỗi', async () => {
    server.use(postOk(), commentsOk([]));

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Chưa có bình luận')).toBeTruthy());
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
  });

  it('chưa có ô nhập thì màn hình KHÔNG được hiện nút Trả lời chết', async () => {
    // Trước đây màn hình truyền `onReply={setReplyTo}` với state không ai đọc:
    // người dùng bấm "Trả lời", cả màn hình render lại, và không có gì xảy ra.
    // `CommentItem` đã tự bảo vệ bằng cách chỉ vẽ nút khi có handler — rồi màn
    // hình đưa vào một handler rỗng và dựng lại đúng cái bẫy đó. Task 11 thêm ô
    // nhập thì mới được truyền `onReply` trở lại.
    server.use(postOk(), commentsOk([baseComment('c1')]));

    await renderScreen();
    await waitFor(() => expect(screen.getByText('noi dung c1')).toBeTruthy());

    expect(screen.queryByRole('button', { name: 'Trả lời' })).toBeNull();
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
  });
});

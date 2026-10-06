/**
 * @file handlers.ts
 * @description Handler MSW cho `/api/forum/*` dùng trong CHẾ ĐỘ MOCK của app.
 *
 * Đây KHÔNG phải handler của test — lý do tách hai thứ ghi đầy đủ ở
 * `core/auth/mocks/handlers.ts`. Handler ở đây mô tả "một thế giới hợp lý để xem
 * giao diện"; handler trong từng file test mô tả "đúng một tình huống đang được
 * kiểm".
 *
 * Dữ liệu cố tình đủ đa dạng để MỌI nhánh giao diện có cái để hiện: bài có ảnh
 * và bài không ảnh, bài đã thả tim và chưa, bài có ngành học của tác giả và bài
 * không, bình luận gốc lẫn reply, và một bình luận của bot để thấy badge "AI".
 * Mỗi chủ đề đều có bài, nên chip lọc nào bấm vào cũng ra kết quả.
 *
 * Hai điều KHÔNG mock ở đây, và là chủ ý:
 *
 * 1. **Không có trạng thái.** Thả tim, đăng bài, gửi bình luận đều trả về phản
 *    hồi hợp lệ nhưng không ghi vào `MOCK_POSTS`: kéo xuống làm mới là mọi thứ
 *    về như cũ. Đủ để xem giao diện phản hồi một mutation, không phải một
 *    backend thu nhỏ. Giữ handler không trạng thái cũng là điều giữ cho test
 *    không phụ thuộc thứ tự chạy.
 * 2. **Không có bài nào của chính người dùng mock trong danh sách.** Nút sửa và
 *    xoá ở màn chi tiết chỉ hiện với bài của mình (`PostDetailScreen`), và
 *    `PUT`/`DELETE /api/forum/posts/{id}` chưa được mock — dựng sẵn một bài của
 *    mình sẽ tạo đúng thứ "nút chết" mà repo này đã phải phá bỏ hai lần.
 */

import { http } from 'msw';

import { jsonMock } from '@/core/dev/jsonMock';

import type { CursorPageResponse } from '@/core/api/pagination';
import { MOCK_USER } from '@/core/auth/mocks/handlers';
import { getEnv } from '@/core/config/env';
import type {
  ForumCommentResponse,
  ForumPostResponse,
  ForumTopicResponse,
} from '@/features/forum/types';

/** Bọc dữ liệu vào envelope `ApiResponse<T>` đúng như backend trả về */
function envelope(data: unknown) {
  return {
    timestamp: new Date().toISOString(),
    status: 200,
    code: 'SUCCESS',
    message: 'OK',
    data,
  };
}

/** Phản hồi lỗi theo đúng khuôn envelope của backend */
function loi(status: number, code: string, message: string) {
  return jsonMock(
    { timestamp: new Date().toISOString(), status, code, message, data: null },
    { status },
  );
}

/**
 * Một trang duy nhất, không phân trang — đủ để xem giao diện.
 *
 * `hasNext: false` là điều giữ cho `FlatList` không gọi `fetchNextPage` vô tận:
 * `getNextCursor` lấy `hasNext` làm nguồn sự thật.
 */
function motTrang<T>(items: T[]): CursorPageResponse<T> {
  return { items, nextCursor: null, prevCursor: null, hasNext: false, hasPrev: false, limit: 20 };
}

/**
 * Bốn chủ đề, đúng bốn mã mà backend có (`forum.md` §2.1).
 *
 * `code` là union đóng `'QUESTION' | 'SHARING' | 'SEARCH' | 'REVIEW'` — thêm một
 * mã ngoài danh sách đó là bịa ra một backend khác.
 */
export const MOCK_TOPICS: ForumTopicResponse[] = [
  { id: 't1', code: 'QUESTION', nameVi: 'Hỏi đáp kiến thức', nameEn: 'Q&A', displayOrder: 1 },
  { id: 't2', code: 'SHARING', nameVi: 'Chia sẻ kinh nghiệm', nameEn: 'Sharing', displayOrder: 2 },
  { id: 't3', code: 'SEARCH', nameVi: 'Tìm mentor', nameEn: 'Finding mentor', displayOrder: 3 },
  { id: 't4', code: 'REVIEW', nameVi: 'Đánh giá môn học', nameEn: 'Course review', displayOrder: 4 },
];

/** Ngành học dùng chung cho vài tác giả giả */
const NGANH_CNTT = {
  id: 'p1',
  code: 'CNTT',
  nameVi: 'Công nghệ thông tin',
  nameEn: 'Information Technology',
};

function baiViet(overrides: Partial<ForumPostResponse>): ForumPostResponse {
  return {
    postId: 'mp1',
    authorUserId: 'u-khac-01',
    authorFullName: 'Trần Thị Bình',
    authorAvatarUrl: '',
    // `ForumAuthorProgram`, KHÔNG phải chuỗi tên ngành — xem `features/forum/types.ts`.
    authorProgram: NGANH_CNTT,
    forumTopic: MOCK_TOPICS[0],
    title: 'Học Spring Boot bắt đầu từ đâu?',
    content:
      'Mình đang ở kỳ 5, đã học qua Java cơ bản và OOP. Muốn làm được một REST API hoàn chỉnh thì nên đi theo thứ tự nào?',
    status: 'PUBLISHED',
    commentCount: 3,
    reactionCount: 12,
    reportCount: 0,
    lastActivityAt: '2026-09-29T08:30:00Z',
    reactedByCurrentUser: false,
    myReactionType: null,
    createdAt: '2026-09-28T02:10:00Z',
    updatedAt: '2026-09-28T02:10:00Z',
    imageUrls: [],
    ...overrides,
  };
}

export const MOCK_POSTS: ForumPostResponse[] = [
  baiViet({}),
  baiViet({
    postId: 'mp2',
    forumTopic: MOCK_TOPICS[1],
    authorUserId: 'u-khac-02',
    authorFullName: 'Lê Minh Cường',
    title: 'Kinh nghiệm thi chứng chỉ AWS khi còn là sinh viên',
    content:
      'Mình vừa qua Cloud Practitioner. Chia sẻ lộ trình ôn trong 6 tuần và mấy chỗ mình học sai cách để các bạn khỏi mất thời gian.',
    commentCount: 1,
    reactionCount: 34,
    // Cặp `reactedByCurrentUser` + `myReactionType` phải đi cùng nhau: backend
    // không bao giờ trả `true` kèm `null`, và `PostCard` đọc cả hai.
    reactedByCurrentUser: true,
    myReactionType: 'LIKE',
    imageUrls: ['https://picsum.photos/seed/aws/600/320'],
    lastActivityAt: '2026-09-29T10:05:00Z',
  }),
  baiViet({
    postId: 'mp3',
    forumTopic: MOCK_TOPICS[2],
    authorUserId: 'u-khac-03',
    authorFullName: 'Phạm Thu Hà',
    // Backend có thể không trả ngành học; nhánh thiếu ngành cũng phải xem được.
    authorProgram: null,
    title: 'Tìm mentor ôn phỏng vấn thực tập backend',
    content:
      'Mình cần người review CV và tập phỏng vấn kỹ thuật. Ưu tiên anh chị đã đi thực tập rồi.',
    commentCount: 0,
    reactionCount: 5,
    imageUrls: [],
    lastActivityAt: '2026-09-27T14:00:00Z',
  }),
  baiViet({
    postId: 'mp4',
    forumTopic: MOCK_TOPICS[3],
    authorUserId: 'u-khac-04',
    authorFullName: 'Vũ Thanh Hằng',
    title: 'Đánh giá môn MAD101 sau một kỳ học',
    content:
      'Môn này nặng phần tổ hợp và logic. Mình ghi lại mấy dạng bài hay ra trong đề thi cuối kỳ kèm ảnh sơ đồ ôn tập.',
    commentCount: 2,
    reactionCount: 21,
    // Hai ảnh để thấy thẻ bài chỉ vẽ ảnh đầu tiên, đúng như `PostCard` được viết.
    imageUrls: [
      'https://picsum.photos/seed/mad101a/600/320',
      'https://picsum.photos/seed/mad101b/600/320',
    ],
    lastActivityAt: '2026-09-29T11:40:00Z',
  }),
  baiViet({
    postId: 'mp5',
    // Cùng chủ đề với `mp1`: một bộ lọc chủ đề trả về NHIỀU hơn một bài mới phân
    // biệt được "lọc thật" với "trả bài đầu danh sách".
    forumTopic: MOCK_TOPICS[0],
    authorUserId: 'u-khac-05',
    authorFullName: 'Hoàng Gia Bảo',
    title: 'Ôn thi PRF192 thế nào cho hiệu quả?',
    content:
      'Mình yếu phần con trỏ và mảng hai chiều. Các bạn ôn theo tài liệu nào và luyện bài tập ở đâu?',
    commentCount: 1,
    reactionCount: 7,
    imageUrls: [],
    lastActivityAt: '2026-09-26T09:15:00Z',
  }),
];

function binhLuan(overrides: Partial<ForumCommentResponse>): ForumCommentResponse {
  return {
    commentId: 'mc1',
    postId: 'mp1',
    authorUserId: 'u-khac-02',
    authorFullName: 'Đỗ Quang Dũng',
    authorAvatarUrl: '',
    authorRole: 'MENTOR',
    content:
      'Bắt đầu từ Spring Web + Spring Data JPA, làm một CRUD nhỏ trước khi chạm tới Security.',
    status: 'VISIBLE',
    reportCount: 0,
    reactionCount: 4,
    reactedByCurrentUser: false,
    replyToCommentId: null,
    replyToUserId: null,
    replyToUserName: null,
    createdAt: '2026-09-28T03:00:00Z',
    updatedAt: '2026-09-28T03:00:00Z',
    imageUrls: [],
    // Bản gốc trong `MOCK_COMMENTS` để 0; handler tính lại khi trả về — xem
    // `voiSoPhanHoi`.
    replyCount: 0,
    ...overrides,
  };
}

/**
 * Bình luận theo từng bài, gốc lẫn reply chung một mảng phẳng — đây là KHO dữ
 * liệu, KHÔNG phải hình dạng trả về: handler tách gốc và reply đúng như backend.
 *
 * Số lượng ở đây phải khớp `commentCount` của bài tương ứng (backend đếm cả gốc
 * lẫn reply): thẻ bài hiện con số, màn chi tiết hiện bình luận, hai bên lệch
 * nhau trông y như lỗi của backend.
 */
const MOCK_COMMENTS: Record<string, ForumCommentResponse[]> = {
  mp1: [
    binhLuan({}),
    binhLuan({
      commentId: 'mc2',
      // Reply trỏ vào `mc1` — một bình luận GỐC có thật. Nó chỉ hiện ra qua
      // `GET /api/forum/comments/mc1/replies`, đúng như backend.
      replyToCommentId: 'mc1',
      replyToUserId: 'u-khac-02',
      replyToUserName: 'Đỗ Quang Dũng',
      authorUserId: MOCK_USER.publicId,
      authorFullName: MOCK_USER.fullName,
      authorRole: 'MENTEE',
      content: 'Cảm ơn anh, em làm CRUD trước đúng như anh nói.',
      reactionCount: 1,
      reactedByCurrentUser: true,
      createdAt: '2026-09-28T03:20:00Z',
      updatedAt: '2026-09-28T03:20:00Z',
    }),
    binhLuan({
      commentId: 'mc3',
      // Trùng `EXPO_PUBLIC_FORUM_BOT_USER_ID` để `isBotComment` trả `true` và
      // `CommentItem` gắn badge "AI" — xem `features/forum/commentTree.ts`.
      //
      // Đọc từ `getEnv()` chứ không ghi cứng một id: `isBotComment` so với biến
      // môi trường, nên một id ghi cứng sẽ không bao giờ khớp. Hệ quả: biến đó
      // ĐỂ TRỐNG thì bình luận này hiện như bình luận người thật, không có badge
      // — muốn xem badge trên máy thì `.env` phải có `EXPO_PUBLIC_FORUM_BOT_USER_ID`
      // với một giá trị bất kỳ khác rỗng.
      authorUserId: getEnv().forumBotUserId,
      authorFullName: 'SkillSwap AI',
      authorRole: 'MENTEE',
      content:
        'Gợi ý lộ trình: Spring Web → Spring Data JPA → Validation → Security. Mỗi bước làm một ví dụ chạy được rồi mới đi tiếp.',
      reactionCount: 0,
      createdAt: '2026-09-28T03:40:00Z',
      updatedAt: '2026-09-28T03:40:00Z',
    }),
  ],
  mp2: [
    binhLuan({
      commentId: 'mc4',
      postId: 'mp2',
      authorUserId: 'u-khac-06',
      authorFullName: 'Ngô Bảo Châu',
      authorRole: 'MENTEE',
      content: 'Bài viết hữu ích, cảm ơn bạn đã chia sẻ chi tiết.',
      reactionCount: 2,
    }),
  ],
  mp3: [],
  mp4: [
    binhLuan({
      commentId: 'mc5',
      postId: 'mp4',
      authorUserId: 'u-khac-07',
      authorFullName: 'Đinh Khánh Linh',
      authorRole: 'MENTEE',
      content: 'Phần tổ hợp mình học theo bài giảng trên LMS là qua được.',
      reactionCount: 3,
    }),
    binhLuan({
      commentId: 'mc6',
      postId: 'mp4',
      replyToCommentId: 'mc5',
      replyToUserId: 'u-khac-07',
      replyToUserName: 'Đinh Khánh Linh',
      authorUserId: 'u-khac-04',
      authorFullName: 'Vũ Thanh Hằng',
      authorRole: 'MENTOR',
      content: 'Đúng rồi, thêm phần bài tập cuối chương nữa là đủ cho đề thi.',
      reactionCount: 0,
    }),
  ],
  mp5: [
    binhLuan({
      commentId: 'mc7',
      postId: 'mp5',
      authorUserId: 'u-khac-01',
      authorFullName: 'Trần Thị Bình',
      authorRole: 'MENTOR',
      content: 'Con trỏ thì vẽ sơ đồ bộ nhớ ra giấy, hiểu nhanh hơn đọc lý thuyết.',
      reactionCount: 5,
      // Bình luận có ảnh: tối đa 1 URL theo `forum.md` §4.1.
      imageUrls: ['https://picsum.photos/seed/prf192/400/240'],
    }),
  ],
};

/** Tìm một bình luận theo id trên toàn bộ dữ liệu giả */
function timBinhLuan(commentId: string): ForumCommentResponse | undefined {
  return Object.values(MOCK_COMMENTS)
    .flat()
    .find((c) => c.commentId === commentId);
}

/**
 * Gắn `replyCount` như backend: gốc mang số reply hiển thị của nó, reply luôn 0
 * (`ForumPostService.toCommentResponse`).
 */
function voiSoPhanHoi(comment: ForumCommentResponse): ForumCommentResponse {
  if (comment.replyToCommentId) {
    return { ...comment, replyCount: 0 };
  }
  const soPhanHoi = Object.values(MOCK_COMMENTS)
    .flat()
    .filter((c) => c.replyToCommentId === comment.commentId).length;
  return { ...comment, replyCount: soPhanHoi };
}

const base = getEnv().apiUrl;

export const forumMockHandlers = [
  http.get(`${base}/api/forum/topics`, () => jsonMock(envelope(MOCK_TOPICS))),

  http.get(`${base}/api/forum/feed`, () => jsonMock(envelope(motTrang(MOCK_POSTS)))),

  http.get(`${base}/api/forum/posts`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    const keyword = (params.get('keyword') ?? '').toLowerCase();
    const topicId = params.get('forumTopicId');

    // Lọc THẬT, không trả nguyên danh sách: handler bỏ qua bộ lọc thì chip chủ đề
    // và ô tìm kiếm trông như không hoạt động khi xem trên máy — đúng thứ chế độ
    // mock sinh ra để kiểm.
    //
    // Tham số `mine` cố ý KHÔNG được lọc: chưa màn hình nào bật nó (xem JSDoc của
    // `ForumListFilters`), và không có bài nào của người dùng mock nên lọc theo nó
    // chỉ trả về danh sách rỗng.
    const items = MOCK_POSTS.filter((post) => {
      const khopChuDe = !topicId || post.forumTopic.id === topicId;
      const khopTuKhoa =
        !keyword ||
        post.title.toLowerCase().includes(keyword) ||
        post.content.toLowerCase().includes(keyword);
      return khopChuDe && khopTuKhoa;
    });

    return jsonMock(envelope(motTrang(items)));
  }),

  http.post(`${base}/api/forum/posts`, async ({ request }) => {
    const body = (await request.json()) as {
      title: string;
      content: string;
      forumTopicId: string;
    };
    return jsonMock(
      envelope(
        baiViet({
          postId: `mp-moi-${Date.now()}`,
          title: body.title,
          content: body.content,
          authorUserId: MOCK_USER.publicId,
          authorFullName: MOCK_USER.fullName,
          forumTopic: MOCK_TOPICS.find((t) => t.id === body.forumTopicId) ?? MOCK_TOPICS[0],
          commentCount: 0,
          reactionCount: 0,
          imageUrls: [],
        }),
      ),
    );
  }),

  http.get(`${base}/api/forum/posts/:postId`, ({ params }) => {
    const post = MOCK_POSTS.find((p) => p.postId === params.postId);
    if (!post) {
      // Mã 404 của backend là `SYS_0003` (forum.md §7), không phải một mã riêng
      // của diễn đàn: `ErrorView` đọc `status`/`code` để chọn thông điệp.
      return loi(404, 'SYS_0003', 'Không tìm thấy bài viết');
    }
    return jsonMock(envelope(post));
  }),

  /**
   * CHỈ bình luận gốc, kèm `replyCount` — backend lọc `replyToCommentId is null`
   * (`ForumCommentRepositoryImpl.findVisibleRootCommentsWindow`). Trả cả reply
   * ở đây là dựng một backend khác và che mất việc app phải tải reply riêng.
   */
  http.get(`${base}/api/forum/posts/:postId/comments`, ({ params }) => {
    const goc = (MOCK_COMMENTS[String(params.postId)] ?? []).filter((c) => !c.replyToCommentId);
    return jsonMock(envelope(motTrang(goc.map(voiSoPhanHoi))));
  }),

  /**
   * Reply của một bình luận gốc (`ForumPostService.getCommentReplies`): 404 khi
   * không có bình luận, 400 khi id là của một reply.
   */
  http.get(`${base}/api/forum/comments/:commentId/replies`, ({ params }) => {
    const goc = timBinhLuan(String(params.commentId));
    if (!goc) {
      return loi(404, 'SYS_0003', 'Không tìm thấy bình luận forum');
    }
    if (goc.replyToCommentId) {
      return loi(400, 'SYS_0002', 'Bình luận này là phản hồi, không có danh sách phản hồi con');
    }
    const phanHoi = Object.values(MOCK_COMMENTS)
      .flat()
      .filter((c) => c.replyToCommentId === goc.commentId);
    return jsonMock(envelope(motTrang(phanHoi.map(voiSoPhanHoi))));
  }),

  http.post(`${base}/api/forum/posts/:postId/comments`, async ({ params, request }) => {
    const body = (await request.json()) as {
      content: string;
      replyToCommentId?: string | null;
    };
    const goc = body.replyToCommentId ? timBinhLuan(body.replyToCommentId) : undefined;

    return jsonMock(
      envelope(
        binhLuan({
          commentId: `mc-moi-${Date.now()}`,
          postId: String(params.postId),
          authorUserId: MOCK_USER.publicId,
          authorFullName: MOCK_USER.fullName,
          authorRole: 'MENTEE',
          content: body.content,
          reactionCount: 0,
          replyToCommentId: body.replyToCommentId ?? null,
          replyToUserId: goc?.authorUserId ?? null,
          // Backend tự tính tên người được trả lời; tính lại ở đây cho giống, để
          // dòng "Trả lời <tên>" hiện đúng ngay sau khi gửi.
          replyToUserName: goc?.authorFullName ?? null,
          imageUrls: [],
        }),
      ),
    );
  }),

  http.put(`${base}/api/forum/posts/:postId/reaction`, ({ params }) => {
    const post = MOCK_POSTS.find((p) => p.postId === params.postId);
    if (!post) {
      return loi(404, 'SYS_0003', 'Không tìm thấy bài viết');
    }
    return jsonMock(
      envelope({
        ...post,
        reactedByCurrentUser: true,
        myReactionType: 'LIKE',
        reactionCount: post.reactedByCurrentUser ? post.reactionCount : post.reactionCount + 1,
      }),
    );
  }),

  http.delete(`${base}/api/forum/posts/:postId/reaction`, ({ params }) => {
    const post = MOCK_POSTS.find((p) => p.postId === params.postId);
    if (!post) {
      return loi(404, 'SYS_0003', 'Không tìm thấy bài viết');
    }
    return jsonMock(
      envelope({
        ...post,
        reactedByCurrentUser: false,
        myReactionType: null,
        reactionCount: post.reactedByCurrentUser ? post.reactionCount - 1 : post.reactionCount,
      }),
    );
  }),

  http.put(`${base}/api/forum/comments/:commentId/reaction`, ({ params }) => {
    const comment = timBinhLuan(String(params.commentId));
    if (!comment) {
      return loi(404, 'SYS_0003', 'Không tìm thấy bình luận');
    }
    // `replyCount: 0` như backend thật: phản hồi của API thích bình luận không
    // tính trường này (`ForumReactionService.toCommentResponse`).
    return jsonMock(
      envelope({
        ...comment,
        replyCount: 0,
        reactedByCurrentUser: true,
        reactionCount: comment.reactedByCurrentUser
          ? comment.reactionCount
          : comment.reactionCount + 1,
      }),
    );
  }),

  http.delete(`${base}/api/forum/comments/:commentId/reaction`, ({ params }) => {
    const comment = timBinhLuan(String(params.commentId));
    if (!comment) {
      return loi(404, 'SYS_0003', 'Không tìm thấy bình luận');
    }
    return jsonMock(
      envelope({
        ...comment,
        replyCount: 0,
        reactedByCurrentUser: false,
        reactionCount: comment.reactedByCurrentUser
          ? comment.reactionCount - 1
          : comment.reactionCount,
      }),
    );
  }),

  /**
   * Báo cáo vi phạm.
   *
   * Trả `data: null`: `forum.md` §6.1 nói phản hồi là `ForumReportResponse` mà
   * không mô tả một trường nào, và `forumRepo.createReport` khai kiểu trả về là
   * `unknown` vì không chỗ nào trên mobile đọc nó. Bịa ra vài trường cho đẹp ở
   * đây là dựng một DTO không ai kiểm được với backend thật.
   */
  http.post(`${base}/api/forum/reports`, () => jsonMock(envelope(null))),
];

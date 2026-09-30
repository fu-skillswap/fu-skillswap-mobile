/**
 * @file handlers.test.ts
 * @description Kiểm handler mock của diễn đàn bằng cách cho REPO THẬT đọc nó.
 *
 * Không có một assertion nào nhìn trực tiếp vào fixture rồi so với chính nó:
 * fixture bịa sai hình dạng DTO là lớp lỗi repo này đã dính nhiều lần, và chỉ
 * đường đi `forumRepo → apiClient → envelope` mới bắt được. Các helper thật của
 * feature (`buildCommentTree`, `isBotComment`) cũng được gọi vào, vì chúng chính
 * là thứ quyết định giao diện có hiện reply và badge "AI" hay không.
 */

import { setupServer } from 'msw/node';

import { __resetApiClientForTests } from '@/core/api/client';
import { ApiClientError } from '@/core/api/errors';
import { MOCK_USER } from '@/core/auth/mocks/handlers';
import { buildCommentTree, isBotComment } from '@/features/forum/commentTree';
import { forumRepo } from '@/features/forum/forumRepo';
import { forumMockHandlers, MOCK_POSTS, MOCK_TOPICS } from '@/features/forum/mocks/handlers';

const server = setupServer(...forumMockHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => __resetApiClientForTests());
afterAll(() => server.close());

describe('handler mock của diễn đàn', () => {
  it('feed trả dữ liệu ĐÚNG hình dạng mà repo thật mong đợi', async () => {
    const page = await forumRepo.getFeed({});

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.hasNext).toBe(false);
    expect(page.limit).toBe(20);

    const bai = page.items[0];
    expect(bai.forumTopic.nameVi).toBeTruthy();
    expect(typeof bai.reactionCount).toBe('number');
    expect(typeof bai.lastActivityAt).toBe('string');
    expect(Array.isArray(bai.imageUrls)).toBe(true);
    // `authorProgram` là OBJECT `ForumAuthorProgram`, không phải chuỗi tên ngành.
    // Một chuỗi ở đây vẫn typecheck xanh nếu ai đó nới kiểu, nên phải kiểm ở runtime.
    expect(typeof bai.authorProgram).toBe('object');
    expect(bai.authorProgram?.nameVi).toBeTruthy();
    expect(bai.authorProgram?.code).toBeTruthy();
  });

  it('mọi chủ đề đều có bài, và mọi bài đều thuộc một chủ đề có trong danh sách', async () => {
    // Một chip chủ đề không bao giờ ra bài nào, hoặc một bài thuộc chủ đề không
    // có chip nào, đều là lỗi chỉ thấy khi bấm thử trên máy.
    const topics = await forumRepo.getTopics();
    const feed = await forumRepo.getFeed({});

    const idChuDeCoBai = new Set(feed.items.map((bai) => bai.forumTopic.id));
    const idChuDeCoChip = new Set(topics.map((chuDe) => chuDe.id));

    expect(topics.length).toBeGreaterThan(1);
    expect(topics.every((chuDe) => idChuDeCoBai.has(chuDe.id))).toBe(true);
    expect(feed.items.every((bai) => idChuDeCoChip.has(bai.forumTopic.id))).toBe(true);
  });

  it('chi tiết bài lấy đúng bài được hỏi, không phải bài đầu danh sách', async () => {
    const baiThuHai = MOCK_POSTS[1];

    const post = await forumRepo.getPost(baiThuHai.postId);

    expect(post.postId).toBe(baiThuHai.postId);
    expect(post.title).toBe(baiThuHai.title);
    expect(post.postId).not.toBe(MOCK_POSTS[0].postId);
  });

  it('hỏi một bài không tồn tại thì lỗi 404 đúng mã của backend', async () => {
    // `ErrorView` đọc `status`/`code` để chọn thông điệp; trả 200 với `data: null`
    // ở đây sẽ làm màn hình chi tiết trắng trơn thay vì hiện lỗi.
    const loi = await forumRepo.getPost('mp-khong-ton-tai').catch((e: unknown) => e);

    expect(loi).toBeInstanceOf(ApiClientError);
    expect((loi as ApiClientError).status).toBe(404);
    expect((loi as ApiClientError).code).toBe('SYS_0003');
  });

  it('bình luận của một bài có cả bình luận gốc và reply, dựng được thành cây 1 cấp', async () => {
    const page = await forumRepo.getComments(MOCK_POSTS[0].postId, {});

    expect(page.items.some((c) => c.replyToCommentId === null)).toBe(true);
    expect(page.items.some((c) => c.replyToCommentId !== null)).toBe(true);

    // Reply phải trỏ vào một bình luận gốc CÓ THẬT trong cùng trang: trỏ sai thì
    // `buildCommentTree` nâng nó lên thành bình luận gốc và giao diện mất hẳn
    // phần thụt lề — nhánh reply không bao giờ xem được.
    const cay = buildCommentTree(page.items);
    expect(cay.some((goc) => goc.replies.length > 0)).toBe(true);
    expect(cay.every((goc) => goc.replyToCommentId === null)).toBe(true);
  });

  it('có ít nhất một bình luận của bot để thấy badge AI', async () => {
    // Gọi thẳng `isBotComment` — đúng hàm mà `CommentItem` dùng để quyết định
    // badge, thay vì so chuỗi 'bot-user-id' bằng tay ở test.
    const page = await forumRepo.getComments(MOCK_POSTS[0].postId, {});

    expect(page.items.some((c) => isBotComment(c))).toBe(true);
    expect(page.items.some((c) => !isBotComment(c))).toBe(true);
  });

  it('commentCount của mỗi bài khớp số bình luận handler trả về', async () => {
    // Thẻ bài hiện `commentCount`, màn chi tiết hiện danh sách. Hai số lệch nhau
    // trông y như một lỗi đồng bộ của backend.
    const feed = await forumRepo.getFeed({});

    for (const bai of feed.items) {
      const page = await forumRepo.getComments(bai.postId, {});
      expect(page.items).toHaveLength(bai.commentCount);
    }
  });

  it('lọc theo chủ đề trả đúng bài của chủ đề đó và BỎ các bài khác', async () => {
    const chuDe = MOCK_POSTS[0].forumTopic.id;

    const page = await forumRepo.getPosts({ forumTopicId: chuDe });

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((p) => p.forumTopic.id === chuDe)).toBe(true);
    // Không có vế này thì một handler trả nguyên danh sách vẫn xanh miễn là mọi
    // bài tình cờ cùng chủ đề.
    expect(page.items.length).toBeLessThan(MOCK_POSTS.length);
  });

  it('tìm theo từ khoá chỉ trả bài có chứa từ đó và BỎ các bài khác', async () => {
    const tuKhoa = 'Spring';

    const page = await forumRepo.getPosts({ keyword: tuKhoa });

    expect(page.items.length).toBeGreaterThan(0);
    expect(
      page.items.every(
        (p) =>
          p.title.toLowerCase().includes(tuKhoa.toLowerCase()) ||
          p.content.toLowerCase().includes(tuKhoa.toLowerCase()),
      ),
    ).toBe(true);
    expect(page.items.length).toBeLessThan(MOCK_POSTS.length);
  });

  it('không có bộ lọc nào thì tra cứu trả về đủ mọi bài', async () => {
    // `keyword` rỗng phải hiểu là "không lọc", không phải "tìm chuỗi rỗng".
    const page = await forumRepo.getPosts({});

    expect(page.items).toHaveLength(MOCK_POSTS.length);
  });

  it('dữ liệu đủ đa dạng để mọi nhánh của thẻ bài có cái để hiện', async () => {
    const page = await forumRepo.getFeed({});

    expect(page.items.some((p) => p.imageUrls.length > 0)).toBe(true);
    expect(page.items.some((p) => p.imageUrls.length === 0)).toBe(true);
    expect(page.items.some((p) => p.reactedByCurrentUser)).toBe(true);
    expect(page.items.some((p) => !p.reactedByCurrentUser)).toBe(true);
    // Ngành học backend có thể không trả; cả hai nhánh phải xem được.
    expect(page.items.some((p) => p.authorProgram === null)).toBe(true);
    expect(page.items.some((p) => p.authorProgram !== null)).toBe(true);
    // `myReactionType` phải đi cùng `reactedByCurrentUser`, không lệch nhau.
    expect(page.items.every((p) => (p.myReactionType === 'LIKE') === p.reactedByCurrentUser)).toBe(
      true,
    );
  });

  it('thả tim và bỏ tim trả về bài đã cập nhật', async () => {
    const goc = MOCK_POSTS[0];

    const daThich = await forumRepo.likePost(goc.postId);
    const boThich = await forumRepo.unlikePost(goc.postId);

    expect(daThich.postId).toBe(goc.postId);
    expect(daThich.reactedByCurrentUser).toBe(true);
    expect(daThich.myReactionType).toBe('LIKE');
    expect(boThich.reactedByCurrentUser).toBe(false);
    expect(boThich.myReactionType).toBe(null);
    expect(daThich.reactionCount - boThich.reactionCount).toBe(1);
  });

  it('đăng bài mới trả về bài mang đúng tiêu đề và chủ đề vừa gửi', async () => {
    const chuDe = MOCK_TOPICS[1];

    const bai = await forumRepo.createPost({
      title: 'Bài kiểm thử soạn trong chế độ mock',
      content: 'Nội dung do người dùng vừa gõ.',
      forumTopicId: chuDe.id,
    });

    expect(bai.title).toBe('Bài kiểm thử soạn trong chế độ mock');
    expect(bai.content).toBe('Nội dung do người dùng vừa gõ.');
    expect(bai.forumTopic.id).toBe(chuDe.id);
    // Bài vừa đăng phải thuộc về chính người dùng mock, nếu không màn chi tiết
    // sẽ không hiện nút sửa/xoá cho bài mình vừa viết.
    expect(bai.authorUserId).toBe(MOCK_USER.publicId);
    expect(bai.postId).not.toBe(MOCK_POSTS[0].postId);
  });

  it('gửi bình luận trả về bình luận mang đúng nội dung và đích trả lời', async () => {
    const bai = MOCK_POSTS[0];

    const binhLuan = await forumRepo.createComment(bai.postId, {
      content: 'Bình luận vừa gõ trong chế độ mock.',
      replyToCommentId: 'mc1',
    });

    expect(binhLuan.postId).toBe(bai.postId);
    expect(binhLuan.content).toBe('Bình luận vừa gõ trong chế độ mock.');
    expect(binhLuan.replyToCommentId).toBe('mc1');
    expect(binhLuan.authorUserId).toBe(MOCK_USER.publicId);
  });

  it('thích bình luận và báo cáo vi phạm đều có handler, không rơi ra ngoài mock', async () => {
    // Hai nút này đang hiện sẵn trên màn chi tiết. Thiếu handler thì MSW cho
    // request đi thật và người dùng nhận một lỗi mạng khi bấm thử.
    const daThich = await forumRepo.likeComment('mc1');

    expect(daThich.commentId).toBe('mc1');
    expect(daThich.reactedByCurrentUser).toBe(true);

    const boThich = await forumRepo.unlikeComment('mc1');
    expect(boThich.reactedByCurrentUser).toBe(false);

    await expect(
      forumRepo.createReport({ targetType: 'POST', targetId: MOCK_POSTS[0].postId, reasonType: 'SPAM' }),
    ).resolves.not.toThrow();
  });
});

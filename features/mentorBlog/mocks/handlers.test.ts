/**
 * @file handlers.test.ts
 * @description Cho REPO THẬT đọc/ghi mock blog, để hình dạng DTO và luật phiên
 * bản sai lộ ra ở đây chứ không trên máy.
 */

import { setupServer } from 'msw/node';

import { __resetApiClientForTests } from '@/core/api/client';
import { ApiClientError } from '@/core/api/errors';
import { dinhDangNgay } from '@/core/time/localDateTime';
import { __resetMentorBlogMockForTests, mentorBlogMockHandlers } from '@/features/mentorBlog/mocks/handlers';
import { mentorBlogRepo } from '@/features/mentorBlog/mentorBlogRepo';

const server = setupServer(...mentorBlogMockHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  __resetApiClientForTests();
  __resetMentorBlogMockForTests();
});
afterAll(() => server.close());

describe('handler mock blog của mentor', () => {
  it('danh sách có đủ ba trạng thái, mốc LocalDateTime đọc được', async () => {
    const ds = await mentorBlogRepo.list();

    expect(new Set(ds.map((b) => b.status))).toEqual(new Set(['DRAFT', 'PUBLISHED', 'ARCHIVED']));
    for (const b of ds) {
      expect(dinhDangNgay(b.updatedAt)).not.toBeNull();
      expect(typeof b.version).toBe('number');
    }
  });

  it('tạo → đăng bằng version MỚI của lần tạo', async () => {
    const nhap = await mentorBlogRepo.create({
      title: 'Bài mới',
      excerpt: null,
      contentMarkdown: 'Nội dung',
      visibility: 'PUBLIC',
      entitledServiceIds: [],
    });
    expect(nhap.status).toBe('DRAFT');

    const daDang = await mentorBlogRepo.publish(nhap.id, { expectedVersion: nhap.version });
    expect(daDang.status).toBe('PUBLISHED');
  });

  it('version cũ bị từ chối 409', async () => {
    const [dau] = await mentorBlogRepo.list();

    await expect(mentorBlogRepo.archive(dau.id, { expectedVersion: dau.version + 5 })).rejects.toMatchObject({ status: 409 });
  });

  it('đăng bài chưa có nội dung bị từ chối 400', async () => {
    const nhap = await mentorBlogRepo.create({
      title: 'Rỗng',
      excerpt: null,
      contentMarkdown: null,
      visibility: 'PUBLIC',
      entitledServiceIds: [],
    });

    await expect(mentorBlogRepo.publish(nhap.id, { expectedVersion: nhap.version })).rejects.toBeInstanceOf(ApiClientError);
  });
});

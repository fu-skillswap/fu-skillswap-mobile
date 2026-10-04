/**
 * @file useMentorBlog.ts
 * @description Hook blog của mentor: danh sách, một bài, lưu (nháp hoặc đăng),
 * lưu trữ.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { baiDangHoatDong, demBaiViet } from '@/features/mentorBlog/baiViet';
import { mentorBlogRepo } from '@/features/mentorBlog/mentorBlogRepo';
import { mentorBlogKeys } from '@/features/mentorBlog/queryKeys';
import type { MentorBlogPostCreateRequest, MentorBlogPostDetailResponse } from '@/features/mentorBlog/types';

export function useMyBlogPosts() {
  const query = useQuery({ queryKey: mentorBlogKeys.list(), queryFn: () => mentorBlogRepo.list() });
  const baiViet = useMemo(() => baiDangHoatDong(query.data ?? []), [query.data]);
  const dem = useMemo(() => demBaiViet(baiViet), [baiViet]);
  return { ...query, baiViet, dem };
}

export function useMyBlogPost(postId: string | null) {
  return useQuery({
    queryKey: mentorBlogKeys.post(postId ?? ''),
    queryFn: () => mentorBlogRepo.get(postId ?? ''),
    enabled: postId !== null && postId.length > 0,
  });
}

export interface LuuBaiVietInput {
  /** `null` = tạo mới */
  baiCu: MentorBlogPostDetailResponse | null;
  noiDung: MentorBlogPostCreateRequest;
}

/**
 * Lưu bản nháp (tạo hoặc sửa). Tách khỏi bước đăng có chủ ý: nếu gộp, một lần
 * "Đăng bài" tạo nháp xong mà bước đăng hỏng thì màn hình không biết bài đã tồn
 * tại, và lần bấm lại sẽ tạo bài THỨ HAI. Màn hình giữ bài vừa lưu rồi mới đăng.
 */
export function useSaveBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: ({ baiCu, noiDung }: LuuBaiVietInput) =>
      baiCu
        ? mentorBlogRepo.update(baiCu.id, { ...noiDung, expectedVersion: baiCu.version })
        : mentorBlogRepo.create(noiDung),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mentorBlogKeys.all });
    },
  });
}

/** Đăng một bài — phải truyền bài với `version` MỚI NHẤT (vừa lưu xong) */
export function usePublishBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: (bai: MentorBlogPostDetailResponse) => mentorBlogRepo.publish(bai.id, { expectedVersion: bai.version }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mentorBlogKeys.all });
    },
  });
}

export function useArchiveBlogPost() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: (bai: MentorBlogPostDetailResponse) => mentorBlogRepo.archive(bai.id, { expectedVersion: bai.version }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mentorBlogKeys.all });
    },
  });
}

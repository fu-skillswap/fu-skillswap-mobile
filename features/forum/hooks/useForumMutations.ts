/**
 * @file useForumMutations.ts
 * @description Các thao tác ghi của diễn đàn.
 *
 * Like dùng cập nhật lạc quan: đổi giao diện trước, gọi API sau, lỗi thì hoàn
 * tác. Hoàn tác phải đúng — backend giới hạn 60 lượt like/bỏ like trong 10
 * phút, nên một số đếm sai sẽ khiến người dùng bấm lại và đốt thêm hạn mức.
 *
 * Ba luật mà mọi sửa đổi sau này phải giữ:
 *
 * 1. `cancelQueries` TRƯỚC khi ghi đè cache. Một lần tải lại đang bay sẽ trả về
 *    số đếm CŨ sau cú bấm và xoá sạch kết quả lạc quan nếu không huỷ nó.
 * 2. Hoàn tác trả về đúng bản ghi trước khi bấm, không phải "trừ đi 1". Nếu
 *    backend trả 429 sau khi người khác cũng vừa like, phép trừ cho ra một con
 *    số chưa từng tồn tại.
 * 3. Một bài viết đang bay thì cú chạm thứ hai vào chính nó bị bỏ qua. Guard
 *    theo state render không chặn được hai lần chạm trong cùng một frame — cùng
 *    lý do đã ghi ở `ForumFeedScreen.taiTrangKe`, nên chốt chặn phải là `useRef`.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { CursorPageResponse } from '@/core/api/pagination';
import { forumRepo } from '@/features/forum/forumRepo';
import { forumKeys } from '@/features/forum/queryKeys';
import type { ForumCommentResponse, ForumPostResponse } from '@/features/forum/types';

type PostPages = InfiniteData<CursorPageResponse<ForumPostResponse>>;
type CommentPages = InfiniteData<CursorPageResponse<ForumCommentResponse>>;

/**
 * Hai nhánh cache chứa bài viết dưới dạng danh sách vô hạn: newsfeed và mọi
 * danh sách có lọc (mỗi bộ lọc một entry riêng, khớp theo tiền tố).
 *
 * KHÔNG dùng `forumKeys.all` để quét tất: nhánh `comments` cũng là
 * `InfiniteData`, và `ForumCommentResponse` cũng có `postId` lẫn `reactionCount`
 * — quét cả nhánh rồi so `postId` sẽ lật tim của mọi bình luận thuộc bài đó.
 */
const NHANH_DANH_SACH_BAI = [forumKeys.feed(), forumKeys.postsAll()];

/** Áp một phép biến đổi lên mọi bản sao của `postId` trong cache bài viết */
function patchPostInCache(
  queryClient: QueryClient,
  postId: string,
  patch: (post: ForumPostResponse) => ForumPostResponse,
) {
  for (const queryKey of NHANH_DANH_SACH_BAI) {
    queryClient.setQueriesData<PostPages>({ queryKey }, (data) => {
      if (!data?.pages) {
        return data;
      }
      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((item) => (item.postId === postId ? patch(item) : item)),
        })),
      };
    });
  }

  // Màn hình chi tiết giữ bài viết ở một khoá riêng; quên nó thì người dùng bấm
  // tim ở feed, mở chi tiết và thấy tim rỗng trở lại.
  queryClient.setQueryData<ForumPostResponse>(forumKeys.post(postId), (current) =>
    current ? patch(current) : current,
  );
}

/** Áp một phép biến đổi lên một bình luận trong cache bình luận của bài */
function patchCommentInCache(
  queryClient: QueryClient,
  postId: string,
  commentId: string,
  patch: (comment: ForumCommentResponse) => ForumCommentResponse,
) {
  queryClient.setQueryData<CommentPages>(forumKeys.comments(postId), (data) => {
    if (!data?.pages) {
      return data;
    }
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => (item.commentId === commentId ? patch(item) : item)),
      })),
    };
  });
}

/** Đảo trạng thái like của một bài viết, cập nhật lạc quan */
export function useTogglePostLike() {
  const queryClient = useQueryClient();
  /** postId đang có request bay dở — chặn cú chạm thứ hai trong cùng một frame */
  const dangGui = useRef(new Set<string>());

  const mutation = useMutation({
    mutationFn: (post: ForumPostResponse) =>
      post.reactedByCurrentUser
        ? forumRepo.unlikePost(post.postId)
        : forumRepo.likePost(post.postId),
    onMutate: async (post) => {
      await Promise.all([
        ...NHANH_DANH_SACH_BAI.map((queryKey) => queryClient.cancelQueries({ queryKey })),
        queryClient.cancelQueries({ queryKey: forumKeys.post(post.postId) }),
      ]);

      const daThich = post.reactedByCurrentUser;
      patchPostInCache(queryClient, post.postId, (current) => ({
        ...current,
        reactedByCurrentUser: !daThich,
        myReactionType: daThich ? null : 'LIKE',
        reactionCount: current.reactionCount + (daThich ? -1 : 1),
      }));

      // Giữ nguyên bản ghi trước khi bấm để hoàn tác cho đúng.
      return { truoc: post };
    },
    // Backend trả về bài đã cập nhật (forum.md §5.1–5.2). Số đếm của nó mới là
    // sự thật: giữa hai lần tải, người khác cũng có thể vừa like bài này.
    onSuccess: (baiMoi) => {
      patchPostInCache(queryClient, baiMoi.postId, () => baiMoi);
    },
    onError: (_loi, _bien, context) => {
      if (context) {
        patchPostInCache(queryClient, context.truoc.postId, () => context.truoc);
      }
    },
    onSettled: (_data, _loi, post) => {
      dangGui.current.delete(post.postId);
    },
  });

  return {
    toggle: (post: ForumPostResponse) => {
      if (dangGui.current.has(post.postId)) {
        return;
      }
      dangGui.current.add(post.postId);
      mutation.mutate(post);
    },
    isPending: mutation.isPending,
  };
}

/** Đảo trạng thái like của một bình luận, cập nhật lạc quan */
export function useToggleCommentLike(postId: string) {
  const queryClient = useQueryClient();
  const dangGui = useRef(new Set<string>());

  const mutation = useMutation({
    mutationFn: (comment: ForumCommentResponse) =>
      comment.reactedByCurrentUser
        ? forumRepo.unlikeComment(comment.commentId)
        : forumRepo.likeComment(comment.commentId),
    onMutate: async (comment) => {
      await queryClient.cancelQueries({ queryKey: forumKeys.comments(postId) });

      const daThich = comment.reactedByCurrentUser;
      patchCommentInCache(queryClient, postId, comment.commentId, (current) => ({
        ...current,
        reactedByCurrentUser: !daThich,
        reactionCount: current.reactionCount + (daThich ? -1 : 1),
      }));

      // Chỉ giữ MỘT bình luận, không cả trang: chụp cả trang rồi đắp lại sẽ xoá
      // luôn kết quả lạc quan của những bình luận khác đang bay cùng lúc.
      return { truoc: comment };
    },
    onSuccess: (binhLuanMoi) => {
      patchCommentInCache(queryClient, postId, binhLuanMoi.commentId, () => binhLuanMoi);
    },
    onError: (_loi, _bien, context) => {
      if (context) {
        patchCommentInCache(
          queryClient,
          postId,
          context.truoc.commentId,
          () => context.truoc,
        );
      }
    },
    onSettled: (_data, _loi, comment) => {
      dangGui.current.delete(comment.commentId);
    },
  });

  return {
    toggle: (comment: ForumCommentResponse) => {
      if (dangGui.current.has(comment.commentId)) {
        return;
      }
      dangGui.current.add(comment.commentId);
      mutation.mutate(comment);
    },
  };
}

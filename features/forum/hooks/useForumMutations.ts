/**
 * @file useForumMutations.ts
 * @description Các thao tác ghi của diễn đàn.
 *
 * Like dùng cập nhật lạc quan: đổi giao diện trước, gọi API sau, lỗi thì hoàn
 * tác. Hoàn tác phải đúng — backend giới hạn 60 lượt like/bỏ like trong 10
 * phút, nên một số đếm sai sẽ khiến người dùng bấm lại và đốt thêm hạn mức.
 *
 * Bốn luật mà mọi sửa đổi sau này phải giữ:
 *
 * 1. `cancelQueries` TRƯỚC khi ghi đè cache. Một lần tải lại đang bay sẽ trả về
 *    số đếm CŨ sau cú bấm và xoá sạch kết quả lạc quan nếu không huỷ nó.
 * 2. Hoàn tác trả về đúng GIÁ TRỊ REACTION trước khi bấm, không phải "trừ đi 1"
 *    và cũng không phải đắp lại nguyên object cũ. Trừ đi 1 cho ra con số chưa
 *    từng tồn tại nếu người khác vừa like xen vào. Còn đắp nguyên object thì tệ
 *    hơn: bản chụp lấy từ danh sách người dùng đang bấm, đem đè lên cache chi
 *    tiết vốn có thể mới hơn, làm tiêu đề và số bình luận ở màn chi tiết tụt về
 *    bản cũ — một cú like hỏng kéo theo cả nội dung không liên quan.
 * 3. Một bài viết đang bay thì cú chạm thứ hai vào chính nó bị bỏ qua. Guard
 *    theo state render không chặn được hai lần chạm trong cùng một frame — cùng
 *    lý do đã ghi ở `ForumFeedScreen.taiTrangKe`, nên chốt chặn phải là `useRef`.
 *
 *    Giới hạn đã biết: chốt này thuộc về TỪNG instance hook. Nếu sau này có hai
 *    nơi cùng gọi `useTogglePostLike()` và cùng sống trong một cây (ví dụ thêm
 *    nút tim cho bài viết ở màn chi tiết, trong khi feed vẫn còn mounted), hai
 *    chốt độc lập nhau và hai cú chạm vào cùng một bài vẫn gửi được hai request.
 *    Khi đó phải chuyển chốt lên `scope: { id: postId }` của TanStack.
 *
 * 4. `networkMode: 'always'`. Mặc định `'online'` chạy `onMutate` rồi HOÃN
 *    request: giao diện hiện tim đầy trong khi chưa gửi gì cả, `onSettled` không
 *    bao giờ chạy nên chốt ở luật 3 khoá cứng bài đó — người dùng không bỏ tim
 *    lại được cho tới khi có mạng. Với `'always'`, cú bấm lúc mất mạng thất bại
 *    ngay và hoàn tác ngay; `OfflineBanner` đã nói vì sao.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { CursorPageResponse } from '@/core/api/pagination';
import { forumRepo } from '@/features/forum/forumRepo';
import { forumKeys } from '@/features/forum/queryKeys';
import type {
  ForumCommentResponse,
  ForumCommentUpsertRequest,
  ForumPostResponse,
  ForumPostUpsertRequest,
  ForumReportCreateRequest,
} from '@/features/forum/types';

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

/**
 * Đánh dấu mọi danh sách bài viết là cũ sau khi nội dung diễn đàn thay đổi.
 *
 * Quét đúng HAI nhánh, không quét `forumKeys.all`: nhánh `comments` cũng nằm
 * dưới `['forum']`, và bắt toàn bộ bình luận của mọi bài tải lại chỉ vì người
 * dùng vừa đăng một bài khác là tốn băng thông vô ích.
 *
 * `postsAll()` là TIỀN TỐ của mọi danh sách có lọc — mỗi bộ lọc là một entry
 * cache riêng và ở đây không biết trước bộ lọc nào đang sống, nên phải khớp
 * theo nhánh chứ không theo một khoá cụ thể.
 */
function lamMoiDanhSachBai(queryClient: QueryClient) {
  for (const queryKey of NHANH_DANH_SACH_BAI) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

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
    // Xem luật 4 ở đầu file: mặc định 'online' sẽ hoãn request và khoá cứng nút.
    networkMode: 'always',
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
        // Chỉ ba trường reaction — xem luật 2 ở đầu file.
        patchPostInCache(queryClient, context.truoc.postId, (current) => ({
          ...current,
          reactedByCurrentUser: context.truoc.reactedByCurrentUser,
          myReactionType: context.truoc.myReactionType,
          reactionCount: context.truoc.reactionCount,
        }));
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
    networkMode: 'always',
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
        // Chỉ hai trường reaction — xem luật 2 ở đầu file.
        patchCommentInCache(queryClient, postId, context.truoc.commentId, (current) => ({
          ...current,
          reactedByCurrentUser: context.truoc.reactedByCurrentUser,
          reactionCount: context.truoc.reactionCount,
        }));
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

/**
 * Tạo bài viết mới.
 *
 * KHÔNG cập nhật lạc quan: backend kiểm duyệt từ cấm và chặn trùng bài trong 15
 * phút, nên bài chỉ thực sự tồn tại sau khi máy chủ trả lời. Vẽ trước rồi rút
 * lại là cách chắc chắn nhất để người dùng tưởng đã đăng xong và đóng app.
 */
export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    // Xem luật 4 ở đầu file: mặc định 'online' hoãn request, màn hình đóng lại
    // như thể đã đăng xong trong khi chưa gửi gì cả.
    networkMode: 'always',
    mutationFn: (input: ForumPostUpsertRequest) => forumRepo.createPost(input),
    onSuccess: () => {
      lamMoiDanhSachBai(queryClient);
    },
  });
}

/**
 * Sửa bài viết của chính mình.
 *
 * Sau khi sửa phải lấy lại bài TỪ MÁY CHỦ chứ không đắp payload vừa gõ vào
 * cache: những trường mà form không đụng tới (số bình luận, số lượt thích,
 * `lastActivityAt`) vẫn đang đổi ở phía người khác.
 */
export function useUpdatePost(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'always',
    mutationFn: (input: ForumPostUpsertRequest) => forumRepo.updatePost(postId, input),
    onSuccess: () => {
      lamMoiDanhSachBai(queryClient);
      void queryClient.invalidateQueries({ queryKey: forumKeys.post(postId) });
    },
  });
}

/**
 * Xoá mềm bài viết của chính mình.
 *
 * KHÔNG `removeQueries` cache chi tiết: màn hình chi tiết vẫn còn mounted ngay
 * lúc này (nó mới là nơi bấm nút xoá), nên vứt cache đi chỉ khiến observer đang
 * sống gọi lại `GET /api/forum/posts/{id}` và nhận 404 — một màn hình lỗi loé
 * lên ngay trước khi điều hướng quay lại.
 *
 * Nhưng cũng KHÔNG để nguyên bản cũ: backend trả về chính bài đó với
 * `status: 'DELETED'`, nên ghi đè bằng nó. Vừa không kích hoạt refetch, vừa
 * không để lại một bản cache nói bài vẫn 'PUBLISHED' suốt `gcTime`.
 */
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'always',
    mutationFn: (postId: string) => forumRepo.deletePost(postId),
    onSuccess: (baiDaXoa) => {
      queryClient.setQueryData(forumKeys.post(baiDaXoa.postId), baiDaXoa);
      lamMoiDanhSachBai(queryClient);
    },
  });
}

/**
 * Đánh dấu cả bình luận, bài viết và mọi danh sách bài là cũ.
 *
 * Gửi hay xoá một bình luận đổi ba thứ cùng lúc: danh sách bình luận, dòng
 * "N bình luận" của bài đang mở, và `commentCount` của chính bài đó trong mọi
 * danh sách (`PostCard` có testID `so-binh-luan`). Bỏ nhánh nào thì nhánh đó
 * hiện số cũ suốt `staleTime` và người dùng gửi lại vì tưởng chưa gửi được.
 */
function lamMoiBinhLuanCuaBai(queryClient: QueryClient, postId: string) {
  void queryClient.invalidateQueries({ queryKey: forumKeys.comments(postId) });
  void queryClient.invalidateQueries({ queryKey: forumKeys.post(postId) });
  lamMoiDanhSachBai(queryClient);
}

/**
 * Gửi bình luận mới, hoặc trả lời một bình luận gốc.
 *
 * KHÔNG cập nhật lạc quan, cùng lý do với `useCreatePost`: backend kiểm duyệt từ
 * cấm (`FORUM_4201`), chặn nội dung trùng trong cùng bài trong 5 phút và giới
 * hạn 20 bình luận/10 phút. Vẽ trước bình luận rồi rút lại là cách chắc chắn
 * nhất để người dùng tưởng đã gửi xong.
 *
 * `replyToCommentId` trong `input` phải do `resolveReplyTarget` quy về bình luận
 * GỐC; hook không tự đoán để chỉ có MỘT nơi biết luật 1 cấp.
 */
export function useCreateComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // Xem luật 4 ở đầu file: mặc định 'online' hoãn request, nút Gửi quay mãi.
    networkMode: 'always',
    mutationFn: (input: ForumCommentUpsertRequest) => forumRepo.createComment(postId, input),
    onSuccess: () => {
      lamMoiBinhLuanCuaBai(queryClient, postId);
    },
  });
}

/**
 * Xoá bình luận của chính mình.
 *
 * Số bình luận mới phải LẤY LẠI TỪ MÁY CHỦ chứ không trừ đi 1 tại chỗ: xoá một
 * bình luận gốc kéo theo mọi reply của nó (forum.md §4.5), nên con số tự tính ở
 * đây gần như luôn sai.
 *
 * Chưa có màn hình nào gọi hook này — xem báo cáo Task 11.
 */
export function useDeleteComment(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'always',
    mutationFn: (commentId: string) => forumRepo.deleteComment(commentId),
    onSuccess: () => {
      lamMoiBinhLuanCuaBai(queryClient, postId);
    },
  });
}

/**
 * Gửi báo cáo vi phạm cho một bài viết hoặc bình luận.
 *
 * Không đụng tới cache: `reportCount` là con số của người kiểm duyệt, giao diện
 * người dùng thường không hiện nó, nên tải lại cả bài chỉ để tăng một số không
 * ai thấy là tốn băng thông vô ích.
 */
export function useReport() {
  return useMutation({
    // Hạn mức 10 báo cáo/30 phút. Hoãn request thì hộp báo cáo đứng im với nút
    // đang quay và người dùng đóng đi, tưởng đã gửi xong.
    networkMode: 'always',
    mutationFn: (input: ForumReportCreateRequest) => forumRepo.createReport(input),
  });
}

/**
 * @file useMentorModeQueries.ts
 * @description Hook đọc dữ liệu của chế độ Mentor.
 *
 * Hai query RIÊNG chứ không một query gộp: hồ sơ mentor và ví settlement đi qua
 * hai endpoint khác nhau với hai mức phân quyền khác nhau (xem JSDoc của
 * `mentorModeRepo`), và màn Tổng quan phải hiện được phần nó có khi phần kia
 * hỏng. Gộp lại thì một cái 403 sẽ xoá sạch màn hình.
 */

import { useQuery } from '@tanstack/react-query';

import { mentorModeRepo } from '@/features/mentorMode/mentorModeRepo';
import { mentorModeKeys } from '@/features/mentorMode/queryKeys';

/**
 * Hồ sơ mentor của chính mình.
 *
 * `data.exists === false` là một câu trả lời THÀNH CÔNG ("chưa tạo hồ sơ"), không
 * phải lỗi — backend trả 200 kèm `MentorProfileResponse.empty()`. Màn hình phải
 * phân biệt nó với `data === undefined` (chưa tải xong), nếu không một mentor
 * vừa được cấp quyền sẽ thấy spinner quay mãi.
 *
 * `staleTime` dài: hồ sơ mentor gần như không đổi trong một phiên dùng app, và
 * cả hai màn mentor (Tổng quan, Thêm) đều đọc nó nên cache dùng chung tiết kiệm
 * đúng một request mỗi lần đổi tab.
 */
export function useMyMentorProfile() {
  return useQuery({
    queryKey: mentorModeKeys.profile(),
    queryFn: () => mentorModeRepo.getMyMentorProfile(),
    staleTime: 5 * 60_000,
  });
}

/**
 * Ví settlement của mentor.
 *
 * `enabled` để màn hình TẮT query này khi không ở chế độ Mentor: endpoint mang
 * `@PreAuthorize("hasRole('MENTOR')")` nên một tài khoản mentee gọi vào sẽ nhận
 * 403, và `shouldRetryQuery` không retry 4xx nên cái 403 đó sẽ nằm lại trong
 * cache như một lỗi thật.
 *
 * `staleTime` NGẮN hơn hồ sơ: số dư đổi theo việc backend giải ngân các buổi đã
 * hoàn thành, tức theo đồng hồ chứ không theo thao tác của người dùng. Giữ cache
 * lâu là hiện một con số tiền đã sai.
 */
export function useMyMentorWallet({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: mentorModeKeys.wallet(),
    queryFn: () => mentorModeRepo.getMyMentorWallet(),
    enabled,
    staleTime: 30_000,
  });
}

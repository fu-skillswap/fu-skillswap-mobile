/**
 * @file useProfileQueries.ts
 * @description Hook đọc dữ liệu hồ sơ.
 */

import { useQuery } from '@tanstack/react-query';

import { profileRepo } from '@/features/profile/profileRepo';
import { profileKeys } from '@/features/profile/queryKeys';

/**
 * Hồ sơ sinh viên của chính mình.
 *
 * `data === null` nghĩa là CHƯA tạo hồ sơ (backend đáp 404) — khác hẳn
 * `data === undefined` là chưa tải xong. Màn hình phải phân biệt hai cái đó,
 * nếu không người vừa đăng nhập lần đầu sẽ thấy spinner quay mãi.
 */
export function useStudentProfile() {
  return useQuery({
    queryKey: profileKeys.studentProfile(),
    queryFn: () => profileRepo.getStudentProfile(),
    // Hồ sơ gần như không đổi trong một phiên dùng app.
    staleTime: 5 * 60_000,
  });
}

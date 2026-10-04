/**
 * @file useProfileQueries.ts
 * @description Hook đọc dữ liệu hồ sơ.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { profileRepo } from '@/features/profile/profileRepo';
import { profileKeys } from '@/features/profile/queryKeys';
import type { StudentProfileRequest } from '@/features/profile/types';

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

/** Danh mục gần như không bao giờ đổi — giữ lâu, không tải lại khi quay về màn */
const DANH_MUC_STALE_MS = 60 * 60_000;

export function useCampuses() {
  return useQuery({
    queryKey: profileKeys.campuses(),
    queryFn: () => profileRepo.getCampuses(),
    staleTime: DANH_MUC_STALE_MS,
  });
}

export function useAcademicPrograms() {
  return useQuery({
    queryKey: profileKeys.programs(),
    queryFn: () => profileRepo.getAcademicPrograms(),
    staleTime: DANH_MUC_STALE_MS,
  });
}

/** Chưa chọn ngành (`null`) thì không gọi — không có "chuyên ngành của mọi ngành" */
export function useSpecializations(programId: string | null) {
  return useQuery({
    queryKey: profileKeys.specializations(programId ?? ''),
    queryFn: () => profileRepo.getSpecializations(programId ?? ''),
    enabled: programId !== null,
    staleTime: DANH_MUC_STALE_MS,
  });
}

/**
 * Lưu hồ sơ. Thành công thì GHI bản backend trả về vào bộ đệm (không chỉ
 * invalidate): tab Hồ sơ thấy ngay hồ sơ mới khi quay lại, kể cả lúc mất mạng.
 */
export function useSaveStudentProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: (input: StudentProfileRequest) => profileRepo.saveStudentProfile(input),
    onSuccess: (hoSo) => {
      queryClient.setQueryData(profileKeys.studentProfile(), hoSo);
    },
  });
}

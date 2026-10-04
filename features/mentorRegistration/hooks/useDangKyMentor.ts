/**
 * @file useDangKyMentor.ts
 * @description Hook của màn Đăng ký làm Mentor: hồ sơ xác thực, gửi hồ sơ, rút
 * hồ sơ, xoá một minh chứng đã tải.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { mentorModeKeys } from '@/features/mentorMode/queryKeys';
import type { BanNhapMentor } from '@/features/mentorRegistration/dangKyMentor';
import { dangKyRepo } from '@/features/mentorRegistration/dangKyRepo';
import type { CapNhatBanNhap } from '@/features/mentorRegistration/guiHoSo';
import { guiHoSoMentor } from '@/features/mentorRegistration/guiHoSo';
import { dangKyKeys } from '@/features/mentorRegistration/queryKeys';

export function useMyVerification() {
  return useQuery({ queryKey: dangKyKeys.verification(), queryFn: () => dangKyRepo.getVerification() });
}

function useLamMoi() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: dangKyKeys.all });
    void queryClient.invalidateQueries({ queryKey: mentorModeKeys.profile() });
  };
}

export function useGuiHoSoMentor() {
  const lamMoi = useLamMoi();
  return useMutation({
    networkMode: 'always',
    mutationFn: ({ banNhap, capNhat }: { banNhap: BanNhapMentor; capNhat: CapNhatBanNhap }) =>
      guiHoSoMentor(banNhap, capNhat),
    // Làm mới cả khi hỏng giữa chừng: nhiều bước có thể đã ghi xong.
    onSettled: lamMoi,
  });
}

export function useRutHoSoMentor() {
  const lamMoi = useLamMoi();
  return useMutation({ networkMode: 'always', mutationFn: () => dangKyRepo.withdraw(), onSuccess: lamMoi });
}

export function useXoaMinhChung() {
  const lamMoi = useLamMoi();
  return useMutation({
    networkMode: 'always',
    mutationFn: (documentId: string) => dangKyRepo.deleteDocument(documentId),
    onSuccess: lamMoi,
  });
}

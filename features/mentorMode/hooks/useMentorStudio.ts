/**
 * @file useMentorStudio.ts
 * @description Hook cho các màn làm việc của mentor: lịch dạy (slot), Google
 * Calendar, và quản lý dịch vụ.
 *
 * Mọi mutation đặt `networkMode: 'always'` (mục 6 của quy ước) và làm mới đúng
 * các khoá bị ảnh hưởng. Các thao tác cần `expectedVersion` lấy nó từ bản ghi
 * đang hiện — backend trả 409 khi bản ghi đã đổi ở nơi khác, và màn hình hiện
 * lỗi đó thay vì tự gửi lại.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { createIdempotencyStore } from '@/core/api/idempotency';
import { mentorModeRepo } from '@/features/mentorMode/mentorModeRepo';
import { mentorModeKeys } from '@/features/mentorMode/queryKeys';
import type {
  CreateMentorServiceRequest,
  CreateSlotRequest,
  UpdateMentorServiceRequest,
} from '@/features/mentorMode/types';

export function useMySlots(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: mentorModeKeys.slots(fromDate, toDate),
    queryFn: () => mentorModeRepo.getMySlots(fromDate, toDate),
    staleTime: 15_000,
  });
}

export function useCreateSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: (input: CreateSlotRequest) => mentorModeRepo.createSlot(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...mentorModeKeys.all, 'slots'] });
    },
  });
}

export function useDeactivateSlot() {
  const queryClient = useQueryClient();
  const khoKhoa = useMemo(() => createIdempotencyStore(), []);
  return useMutation({
    networkMode: 'always',
    mutationFn: ({ slotId, expectedVersion }: { slotId: string; expectedVersion: number }) =>
      mentorModeRepo.deactivateSlot(
        slotId,
        { expectedVersion },
        khoKhoa.keyFor(slotId, { expectedVersion }),
      ),
    onSuccess: (_d, { slotId }) => {
      khoKhoa.release(slotId);
      void queryClient.invalidateQueries({ queryKey: [...mentorModeKeys.all, 'slots'] });
    },
  });
}

export function useGoogleCalendarStatus() {
  return useQuery({
    queryKey: mentorModeKeys.calendar(),
    queryFn: () => mentorModeRepo.getGoogleCalendarStatus(),
    staleTime: 5 * 60_000,
  });
}

export function useMyServices() {
  return useQuery({
    queryKey: mentorModeKeys.services(),
    queryFn: () => mentorModeRepo.getMyServices(),
    staleTime: 30_000,
  });
}

export function useMyService(serviceId: string) {
  return useQuery({
    queryKey: mentorModeKeys.service(serviceId),
    queryFn: () => mentorModeRepo.getMyService(serviceId),
    enabled: serviceId.length > 0,
  });
}

export function useServiceConstraints() {
  return useQuery({
    queryKey: mentorModeKeys.serviceConstraints(),
    queryFn: () => mentorModeRepo.getServiceConstraints(),
    staleTime: 30 * 60_000,
  });
}

function useLamMoiDichVu() {
  const queryClient = useQueryClient();
  return (serviceId?: string) => {
    void queryClient.invalidateQueries({ queryKey: mentorModeKeys.services() });
    if (serviceId) {
      void queryClient.invalidateQueries({ queryKey: mentorModeKeys.service(serviceId) });
    }
  };
}

export function useCreateService() {
  const lamMoi = useLamMoiDichVu();
  return useMutation({
    networkMode: 'always',
    mutationFn: (input: CreateMentorServiceRequest) => mentorModeRepo.createService(input),
    onSuccess: (dv) => lamMoi(dv.serviceId),
  });
}

export function useUpdateService(serviceId: string) {
  const lamMoi = useLamMoiDichVu();
  return useMutation({
    networkMode: 'always',
    mutationFn: (input: UpdateMentorServiceRequest) => mentorModeRepo.updateService(serviceId, input),
    onSuccess: () => lamMoi(serviceId),
  });
}

export function useSetServiceActive() {
  const lamMoi = useLamMoiDichVu();
  return useMutation({
    networkMode: 'always',
    mutationFn: ({ serviceId, isActive, expectedVersion }: { serviceId: string; isActive: boolean; expectedVersion: number }) =>
      mentorModeRepo.setServiceActive(serviceId, { isActive, expectedVersion }),
    onSuccess: (_d, { serviceId }) => lamMoi(serviceId),
  });
}

/**
 * @file queryKeys.ts
 * @description Khoá TanStack Query của Koko.
 */

export const kokoKeys = {
  all: ['koko'] as const,
  /** Hội thoại đang mở — chỉ sống trong bộ đệm, đăng xuất là mất (`queryClient.clear()`) */
  hoiThoai: () => [...kokoKeys.all, 'hoiThoai'] as const,
  /** Khoá mutation gửi tin, để màn đếm được lượt đang chờ kể cả sau khi mount lại */
  gui: () => [...kokoKeys.all, 'gui'] as const,
};

/**
 * @file queryKeys.ts
 * @description Khoá query của hồ sơ, gom một chỗ để invalidate không bị lệch.
 * Mọi khoá bắt đầu bằng 'profile' nên invalidate cả nhánh chỉ cần `profileKeys.all`.
 */

export const profileKeys = {
  all: ['profile'] as const,
  studentProfile: () => [...profileKeys.all, 'student'] as const,
  campuses: () => [...profileKeys.all, 'campuses'] as const,
  programs: () => [...profileKeys.all, 'programs'] as const,
  specializations: (programId: string) => [...profileKeys.all, 'specializations', programId] as const,
};

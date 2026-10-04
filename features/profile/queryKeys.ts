/**
 * @file queryKeys.ts
 * @description Khoá query của hồ sơ, gom một chỗ để invalidate không bị lệch.
 * Mọi khoá bắt đầu bằng 'profile' nên invalidate cả nhánh chỉ cần `profileKeys.all`.
 */

export const profileKeys = {
  all: ['profile'] as const,
  studentProfile: () => [...profileKeys.all, 'student'] as const,
};

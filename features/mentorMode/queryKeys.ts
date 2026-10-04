/**
 * @file queryKeys.ts
 * @description Khoá query của chế độ Mentor, gom một chỗ để invalidate không bị lệch.
 */

export const mentorModeKeys = {
  all: ['mentorMode'] as const,
  /** Hồ sơ mentor của chính mình (`GET /api/me/mentor-profile`) */
  profile: () => [...mentorModeKeys.all, 'profile'] as const,
  /** Ví settlement của mentor (`GET /api/me/mentor-wallet`) */
  wallet: () => [...mentorModeKeys.all, 'wallet'] as const,
};

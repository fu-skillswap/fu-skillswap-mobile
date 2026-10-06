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
  /** Slot của mentor trong một khoảng ngày */
  slots: (fromDate: string, toDate: string) => [...mentorModeKeys.all, 'slots', fromDate, toDate] as const,
  /** Tiền tố của MỌI khoảng ngày slot — dùng để invalidate sau khi booking đổi */
  slotsAll: () => [...mentorModeKeys.all, 'slots'] as const,
  /** Trạng thái kết nối Google Calendar */
  calendar: () => [...mentorModeKeys.all, 'calendar'] as const,
  services: () => [...mentorModeKeys.all, 'services'] as const,
  service: (serviceId: string) => [...mentorModeKeys.all, 'service', serviceId] as const,
  serviceConstraints: () => [...mentorModeKeys.all, 'service-constraints'] as const,
};

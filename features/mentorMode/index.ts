/**
 * @file index.ts
 * @description API công khai của feature "chế độ Mentor". Feature khác và tầng
 * `app/` chỉ được import từ đây, không với tay vào file nội bộ.
 *
 * Màn `MentorBookings` KHÔNG ở đây mà ở `features/booking`: danh sách booking
 * phía mentor đi qua đúng endpoint `GET /api/me/bookings?role=MENTOR` mà feature
 * đó đã sở hữu — xem JSDoc của `mentorModeRepo.ts`.
 */

export { MentorDashboardScreen } from '@/features/mentorMode/screens/MentorDashboardScreen';
export { MentorMoreScreen } from '@/features/mentorMode/screens/MentorMoreScreen';
export { mentorModeRepo } from '@/features/mentorMode/mentorModeRepo';
export { mentorModeKeys } from '@/features/mentorMode/queryKeys';
export {
  useMyMentorProfile,
  useMyMentorWallet,
} from '@/features/mentorMode/hooks/useMentorModeQueries';
export type { MentorProfileResponse, MentorStatus, MentorWalletResponse } from '@/features/mentorMode/types';

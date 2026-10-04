/**
 * @file index.ts
 * @description API công khai của feature hồ sơ. Feature khác và tầng `app/` chỉ
 * được import từ đây, không với tay vào file nội bộ.
 */

export { OnboardingScreen } from '@/features/profile/screens/OnboardingScreen';
export { ProfileScreen } from '@/features/profile/screens/ProfileScreen';
export { profileRepo } from '@/features/profile/profileRepo';
export { profileKeys } from '@/features/profile/queryKeys';
export { useStudentProfile } from '@/features/profile/hooks/useProfileQueries';
export type {
  AcademicProgramResponse,
  CampusResponse,
  SpecializationResponse,
  StudentProfileResponse,
} from '@/features/profile/types';

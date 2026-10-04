/**
 * @file index.ts
 * @description API công khai của feature mentor. Feature khác và tầng `app/` chỉ
 * được import từ đây, không với tay vào file nội bộ.
 *
 * `DO_TRE_TIM_KIEM_MS` KHÔNG được re-export: barrel là API công khai cho feature
 * khác, còn hằng debounce chỉ là chi tiết mà test của màn hình cần biết — test
 * import thẳng từ file màn hình, giống `ForumFeedScreen`.
 */

export { MentorDetailScreen } from '@/features/mentor/screens/MentorDetailScreen';
export { MentorDiscoveryScreen } from '@/features/mentor/screens/MentorDiscoveryScreen';

// Luồng đặt lịch (`features/booking`) cần hồ sơ mentor để biết tên và dịch vụ,
// và phải in giá đúng một cách với màn hồ sơ — nên đọc qua barrel, không dựng
// bản thứ hai.
export { useMentor } from '@/features/mentor/hooks/useMentorQueries';
export { moTaGiaDichVu, moTaThoiLuong } from '@/features/mentor/serviceDisplay';
export type { MentorDiscoveryDetailResponse, MentorServiceResponse } from '@/features/mentor/types';

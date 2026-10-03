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

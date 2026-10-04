/**
 * @file index.ts
 * @description API công khai của feature booking. Feature khác và tầng `app/` chỉ
 * được import từ đây, không với tay vào file nội bộ.
 *
 * `useMentorBookingCount` được re-export vì `features/mentorMode` cần nó cho dải
 * nhắc việc ở màn Tổng quan: danh sách booking phía mentor thuộc feature NÀY
 * (endpoint `GET /api/me/bookings?role=MENTOR`), nên nhánh mentor-mode đọc qua
 * barrel chứ không dựng bản thứ hai của cả tầng dữ liệu.
 */

export { BookingConfirmScreen } from '@/features/booking/screens/BookingConfirmScreen';
export { BookingSlotScreen } from '@/features/booking/screens/BookingSlotScreen';
export { MentorBookingsScreen } from '@/features/booking/screens/MentorBookingsScreen';
export { MyBookingsScreen } from '@/features/booking/screens/MyBookingsScreen';
export {
  useBookingDetail,
  useMentorBookingCount,
  useMentorBookings,
} from '@/features/booking/hooks/useBookingQueries';
export { nhanTrangThaiBooking } from '@/features/booking/bookingStatus';
export type { BookingResponse, BookingStatus } from '@/features/booking/types';

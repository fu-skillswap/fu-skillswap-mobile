/**
 * @file useBookingQueries.ts
 * @description Các hook đọc dữ liệu nhánh booking.
 *
 * Phân trang là OFFSET (`page`/`size`) như nhánh mentor, không phải cursor như
 * diễn đàn — dùng `getNextPageNumber`/`flattenOffsetPages`.
 */

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';

import { flattenOffsetPages, getNextPageNumber } from '@/core/api/pagination';
import { bookingRepo } from '@/features/booking/bookingRepo';
import type { BoLocLichHen } from '@/features/booking/bookingRepo';
import { bookingKeys } from '@/features/booking/queryKeys';
import type { BookingStatus } from '@/features/booking/types';

/**
 * Chốt chặn ĐỒNG BỘ cho việc tải trang kế.
 *
 * Cùng lý do và cùng cách làm như `useChotChanTrangKe` của
 * `features/mentor/hooks/useMentorQueries.ts`: FlatList bắn `onEndReached` nhiều
 * lần trong cùng một frame, và một guard dựa vào `isFetchingNextPage` đọc cùng
 * một giá trị `false` của lần render cũ ở cả hai lần gọi — trang đó bị nối vào
 * danh sách hai lượt. Ref đổi ngay lập tức nên lần gọi thứ hai bị chặn.
 *
 * Chốt chặn nằm TRONG hook chứ không ở màn hình (mục 6 của quy ước). Bản của
 * nhánh booking là một bản RIÊNG chứ không import từ `features/mentor`: hai
 * feature không được import chéo nhau, và việc nâng nó lên `core/` là một thay
 * đổi kiến trúc nằm ngoài phạm vi màn này.
 */
function useChotChanTrangKe(query: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
}) {
  const dangTaiTrangKe = useRef(false);

  return () => {
    if (dangTaiTrangKe.current || !query.hasNextPage || query.isFetchingNextPage) return;
    dangTaiTrangKe.current = true;
    void query.fetchNextPage().finally(() => {
      dangTaiTrangKe.current = false;
    });
  };
}

/**
 * Danh sách lịch hẹn của chính mình, cuộn tới đâu tải tới đó.
 *
 * `filters` không nhận `page` — xem JSDoc của `BoLocLichHen`. Thứ tự spread
 * trong `queryFn` cố ý đặt `page: pageParam` SAU `...filters`.
 *
 * `staleTime` ngắn hơn mặc định 30s của app: trạng thái một booking đổi theo
 * ĐỒNG HỒ chứ không chỉ theo thao tác của người dùng (một buổi "Sắp diễn ra"
 * thành "Đang diễn ra" khi tới giờ, một yêu cầu "Đang chờ" thành "Quá hạn" khi
 * hết hạn phản hồi), và chính backend tính các mốc đó. Giữ cache lâu là hiện một
 * nhãn đã sai mà không có cách nào biết.
 *
 * Trả thêm `taiTrangKe()` đã bọc chốt chặn — màn hình nối thẳng vào
 * `onEndReached`, KHÔNG tự dựng `useRef` lần nữa.
 */
export function useMyBookings(filters: BoLocLichHen) {
  const query = useInfiniteQuery({
    queryKey: bookingKeys.list(filters),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => bookingRepo.getMyBookings({ ...filters, page: pageParam }),
    getNextPageParam: getNextPageNumber,
    staleTime: 15_000,
  });

  const bookings = useMemo(() => flattenOffsetPages(query.data?.pages), [query.data]);
  const taiTrangKe = useChotChanTrangKe(query);

  return { ...query, bookings, taiTrangKe };
}

/**
 * Danh sách booking nhìn từ phía MENTOR.
 *
 * Chỉ là `useMyBookings` với `role` bị ghim thành `'MENTOR'`, nhưng tồn tại
 * thành một hook riêng vì `role` là thứ dễ quên nhất ở đây: bỏ nó đi thì backend
 * mặc định `BookingViewRole.MENTEE` (`BookingListRequest.role` khởi tạo bằng
 * `MENTEE`) và màn hình mentor sẽ hiện **các buổi người đó đã đặt với mentor
 * khác** — một danh sách hợp lệ, có dữ liệu, trông hoàn toàn bình thường, và
 * sai hoàn toàn. Không có lỗi nào chặn được chuyện đó ngoài một hook đặt tên
 * đúng.
 *
 * `role` bị loại khỏi kiểu tham số để chỗ gọi KHÔNG ghi đè được.
 */
export function useMentorBookings(filters: Omit<BoLocLichHen, 'role'>) {
  return useMyBookings({ ...filters, role: 'MENTOR' });
}

/**
 * Đếm booking của mentor ở một trạng thái, dùng cho dải nhắc việc ở màn Tổng quan.
 *
 * Đọc `totalElements` của backend, KHÔNG đếm trên mảng đã tải: `size: 1` nên
 * request chỉ mang về một phần tử, còn con số thì là tổng thật của cả tập. Đếm
 * bằng `bookings.length` sẽ cho "10 yêu cầu" mãi mãi (đúng `size` mặc định) khi
 * mentor có nhiều hơn một trang — và con số đó là lý do người dùng bấm vào.
 *
 * `staleTime` ngắn: một yêu cầu `PENDING` tự hết hạn theo `pendingExpireAt` do
 * backend tính, nên con số này đổi theo đồng hồ.
 */
export function useMentorBookingCount(status: BookingStatus) {
  const filters: BoLocLichHen = { role: 'MENTOR', status, size: 1 };

  const query = useQuery({
    queryKey: bookingKeys.count(filters),
    queryFn: () => bookingRepo.getMyBookings(filters),
    staleTime: 15_000,
  });

  return { ...query, soLuong: query.data?.totalElements ?? null };
}

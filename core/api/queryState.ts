/**
 * @file queryState.ts
 * @description Quy đổi cờ của TanStack Query thành MỘT trạng thái màn hình.
 *
 * Mỗi màn hình danh sách đều phải trả lời cùng một câu hỏi: lúc này nên hiện
 * spinner, thông báo mất kết nối, ErrorView, hay nội dung? Ba lần liên tiếp câu
 * trả lời bị viết sai theo ba kiểu khác nhau, nên luật được gom về đây và có
 * test riêng.
 *
 * Hai cái bẫy mà hàm này tồn tại để chặn:
 *
 * 1. `isError` KHÔNG có nghĩa là "không có gì để hiện". TanStack v5 bật `isError`
 *    cả khi query đã có data và chỉ lần refetch nền thất bại. Nếu màn hình dựa
 *    vào mình nó, một lần kéo-để-tải-lại hụt sóng sẽ xoá sạch nội dung người
 *    dùng đang đọc.
 * 2. `isLoading` KHÔNG bật khi mất mạng. Với `networkMode: 'online'` (mặc định),
 *    query mất mạng ở trạng thái `status: 'pending'` + `fetchStatus: 'paused'`,
 *    mà `isLoading = isPending && isFetching` nên nó là **false**. Màn hình nào
 *    chỉ hỏi `isLoading` sẽ rơi thẳng xuống nhánh rỗng và nói "Chưa có bình luận"
 *    trong khi thực ra chưa hề gọi được API — tức là nói dối người dùng.
 */

/** Trạng thái duy nhất mà màn hình cần biết để chọn thứ hiển thị */
export type TrangThaiTai = 'co-noi-dung' | 'mat-ket-noi' | 'dang-tai' | 'loi';

export interface CoQuery {
  /** Query đang bị hoãn vì không có mạng */
  isPaused: boolean;
  /** Chưa từng có dữ liệu thành công */
  isPending: boolean;
  isError: boolean;
  /** Đã có gì đó để hiện hay chưa (data khác undefined, hoặc mảng không rỗng) */
  coDuLieu: boolean;
}

/**
 * Thứ tự ưu tiên có chủ ý:
 *
 * - Đã có dữ liệu thì LUÔN hiện dữ liệu, kể cả khi đang lỗi hoặc mất mạng. Lỗi
 *   lúc đó là chuyện của một banner, không phải cớ để xoá nội dung.
 * - `mat-ket-noi` đứng trước `dang-tai`: query bị hoãn cũng là `isPending`, và
 *   hiện spinner quay mãi trong khi máy bay bật chế độ máy bay thì vô nghĩa.
 * - `loi` đứng trước `dang-tai` vì một query đang retry vẫn có `isPending`.
 */
export function trangThaiTai({ isPaused, isPending, isError, coDuLieu }: CoQuery): TrangThaiTai {
  if (coDuLieu) return 'co-noi-dung';
  if (isPaused) return 'mat-ket-noi';
  if (isError) return 'loi';
  if (isPending) return 'dang-tai';
  return 'co-noi-dung';
}

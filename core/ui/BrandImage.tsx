/**
 * @file BrandImage.tsx
 * @description Một ảnh nhận diện (mascot Koko hoặc logo) từ `core/ui/brand.ts`.
 *
 * Tồn tại để ba thứ dễ làm sai không thể làm sai ở từng màn hình:
 *
 * 1. **Kích thước tường minh.** `<Image>` của React Native KHÔNG tự suy ra cỡ
 *    cho ảnh `require()` trong mọi bố cục: trong khối `flex` nó có thể nở ra
 *    chiếm cả màn, trong khối `absolute` nó có thể co về 0 và biến mất. Props
 *    của component buộc người gọi khai `size` (vuông) hoặc `width` + `height`.
 * 2. **`resizeMode="contain"` dựng cứng.** `cover` cắt mất đầu Koko và cắt chữ
 *    của logo; không có đường nào truyền `cover` vào đây.
 * 3. **Trình đọc màn hình.** Không truyền `label` thì ảnh là ảnh trang trí và bị
 *    ẩn hẳn; truyền `label` thì ảnh MANG thông tin (logo ở màn Welcome) và được
 *    đọc ra. Không có trạng thái thứ ba "ảnh không nhãn mà vẫn đọc".
 *
 * ## Lưu ý cho test
 *
 * Ảnh trang trí mang `accessibilityElementsHidden`, và RNTL 14 mặc định
 * `defaultIncludeHiddenElements: false`, nên `getByTestId` thường KHÔNG thấy nó.
 * Tìm bằng `getByTestId('…', { includeHiddenElements: true })`. Đừng gỡ hai prop
 * a11y để test xanh — đó là gỡ đúng thứ component này tồn tại để bảo đảm.
 */

import { Image } from 'react-native';

/** Cỡ ảnh: vuông (`size`) hoặc chữ nhật (`width` + `height`) — luôn phải khai */
type CoAnh = { size: number; width?: never; height?: never } | { size?: never; width: number; height: number };

export type BrandImageProps = CoAnh & {
  /** Hằng từ `core/ui/brand.ts` (`require()` trả về số do bundler sinh) */
  source: number;
  /**
   * Nhãn cho trình đọc màn hình. CHỈ truyền khi ảnh mang thông tin không có ở
   * chỗ khác trên màn — ví dụ logo đứng thay cho tên sản phẩm. Ảnh minh hoạ
   * cạnh một tiêu đề chữ thì để trống: đọc ra là đọc lặp.
   */
  label?: string;
  testID?: string;
};

export function BrandImage({ source, label, testID, ...co }: BrandImageProps) {
  // Ternary chứ không phải `??`: so sánh với `undefined` làm TS thu hẹp đúng một
  // nhánh của union, nên `width`/`height` ra kiểu `number` chứ không phải
  // `number | undefined` — ảnh không cỡ không lọt qua được typecheck.
  const width = co.size !== undefined ? co.size : co.width;
  const height = co.size !== undefined ? co.size : co.height;

  return (
    <Image
      source={source}
      testID={testID}
      style={{ width, height }}
      resizeMode="contain"
      // Ảnh thương hiệu đã đúng màu; chế độ đảo màu của hệ thống làm Koko tím.
      accessibilityIgnoresInvertColors
      {...(label === undefined
        ? // Cả hai prop: `accessibilityElementsHidden` là của iOS,
          // `importantForAccessibility` là của Android. Thiếu một bên thì ảnh
          // vẫn bị đọc ra trên nền tảng còn lại.
          { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const }
        : { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label })}
    />
  );
}

/**
 * @file Avatar.tsx
 * @description Avatar chữ cái đầu. Thiết kế không dùng ảnh người dùng ở đâu cả —
 * mọi chỗ đều là hai chữ cái trên nền `surface-tint` (hoặc nền `accent` cho
 * avatar lớn ở đầu trang hồ sơ).
 *
 * Năm cỡ và năm cỡ chữ tương ứng lấy đúng từ các màn hình, không nội suy:
 * 40/14 (bài viết) · 44/15 (card lịch hẹn) · 52/17 (card mentor nổi bật) ·
 * 56/18 (danh sách mentor) · 64/22 (đầu trang hồ sơ).
 */

import { Text, View } from 'react-native';

import { fonts, radius } from '@/core/ui/theme';

/** Cỡ avatar hợp lệ, tính bằng px — đúng năm cỡ thiết kế dùng */
export type AvatarSize = 40 | 44 | 52 | 56 | 64;

export interface AvatarProps {
  /** Tên đầy đủ; component tự rút chữ cái đầu */
  name: string;
  size?: AvatarSize;
  /** `tint` nền xanh nhạt chữ accent (mặc định) · `accent` nền accent chữ trắng */
  tone?: 'tint' | 'accent';
  /** `circle` bo tròn hoàn toàn · `rounded` bo 16 (card mentor dùng dáng này) */
  shape?: 'circle' | 'rounded';
  testID?: string;
}

const CO_CHU: Record<AvatarSize, number> = { 40: 14, 44: 15, 52: 17, 56: 18, 64: 22 };

/**
 * Rút tối đa hai chữ cái đầu từ tên.
 *
 * Dùng `toLocaleUpperCase('vi')` chứ không phải `toUpperCase()` rỗng: tên tiếng
 * Việt có dấu ("Đức", "Ánh") phải lên hoa thành "Đ", "Á" — giữ nguyên dấu.
 * Tên một chữ thì chỉ ra một chữ cái; tên trống thì ra "?" để khối avatar không
 * bị rỗng ruột.
 */
export function chuCaiDau(name: string): string {
  const tu = name.trim().split(/\s+/).filter(Boolean);
  if (tu.length === 0) {
    return '?';
  }
  const dau = tu.length === 1 ? [tu[0]] : [tu[0], tu[tu.length - 1]];
  return dau.map((t) => [...t][0] ?? '').join('').toLocaleUpperCase('vi');
}

export function Avatar({
  name,
  size = 44,
  tone = 'tint',
  shape = 'circle',
  testID,
}: AvatarProps) {
  const chu = chuCaiDau(name);

  return (
    <View
      // `accessibilityLabel` mang tên đầy đủ: trình đọc màn hình đọc "TH" thành
      // "tê hát", vô nghĩa với người dùng.
      accessible
      accessibilityLabel={name}
      testID={testID}
      className={`shrink-0 items-center justify-center ${tone === 'accent' ? 'bg-accent' : 'bg-surface-tint'}`}
      style={{
        width: size,
        height: size,
        borderRadius: shape === 'circle' ? radius.full : radius.md,
      }}
    >
      <Text
        className={tone === 'accent' ? 'text-on-accent' : 'text-accent'}
        style={{ fontFamily: fonts.bold, fontSize: CO_CHU[size], lineHeight: size }}
      >
        {chu}
      </Text>
    </View>
  );
}

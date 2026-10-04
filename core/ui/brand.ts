/**
 * @file brand.ts
 * @description Ảnh nhận diện SkillSwap, gom một chỗ để màn hình không phải viết
 * `require('../../assets/brand/...')` rải rác.
 *
 * ## Nguồn và vì sao phải thu nhỏ
 *
 * Lấy từ `fu-skillswap-fe-2/public/images` (04/10/2026) và **thu nhỏ trước khi
 * đưa vào repo**, không chép nguyên bản. Bản web được dựng cho màn hình lớn:
 * `SkillSwapLogo.png` là **7292×7292**. React Native giải nén PNG ra bitmap đầy
 * đủ trong RAM, nên một ảnh như vậy chiếm ~212 MB (7292² × 4 byte) chỉ để vẽ ra
 * một ô 40px — đủ làm app chết vì hết bộ nhớ trên máy yếu.
 *
 * Kích thước đích lấy bằng cỡ lớn nhất thiết kế dùng, nhân 3 cho màn hình @3x.
 * Tổng bộ ảnh: 3,76 MB → 337 KB.
 *
 * ## Ba biến thể Koko trong thiết kế KHÔNG tồn tại
 *
 * `HANDOFF.md` mục 3 nhắc `koko-happy.png`, `koko-laptop.png`,
 * `koko-reading.png` và nói "lấy từ design system SkillSwap". Repo web chỉ có
 * `Koko.png` (tư thế chuẩn) và `Koko_404.png`. Mọi chỗ cần Koko dùng `koko`;
 * khi nào có file thật thì thêm vào đây, màn hình không phải sửa.
 */

/**
 * Mascot Koko, tư thế chuẩn. Dùng cho khối hero màn Welcome, card trợ lý AI ở
 * Bảng tin, và minh hoạ của `EmptyState`.
 */
export const KOKO = require('../../assets/brand/koko.png') as number;

/** Koko dáng "không tìm thấy" — dành cho trạng thái rỗng/lỗi nặng */
export const KOKO_404 = require('../../assets/brand/koko-404.png') as number;

/** Dấu hiệu (logo không chữ), dùng ở ô 40px đầu màn Bảng tin */
export const LOGO_MARK = require('../../assets/brand/skillswap-mark.png') as number;

/** Logo đầy đủ có chữ, dùng ở màn Welcome */
export const LOGO_FULL = require('../../assets/brand/skillswap-logo-full.png') as number;

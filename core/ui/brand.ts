/**
 * @file brand.ts
 * @description Ảnh nhận diện SkillSwap, gom một chỗ để màn hình không phải viết
 * `require('../../assets/brand/...')` rải rác.
 *
 * ## Nguồn
 *
 * Lấy từ **design system SkillSwap** (artifact `JdRibYbgqWBM1rbimeRXeR`, nhóm
 * `Mascot` và `Logos`, bản 05/10/2026) — đây là nguồn chính thức. Trước đó bộ
 * ảnh lấy tạm từ `fu-skillswap-fe-2/public/images`, nơi **không có** ba tư thế
 * Koko mà thiết kế dùng; chúng có đủ trong design system.
 *
 * ## Vì sao phải thu nhỏ trước khi đưa vào repo
 *
 * React Native giải nén PNG ra bitmap đầy đủ trong RAM, không theo kích thước
 * ô hiển thị. Bản gốc của design system cao 1252px; bản trong repo web còn tệ
 * hơn (`SkillSwapLogo.png` là 7292×7292 — ~212 MB bitmap cho một ô 40px). Mọi
 * file ở đây đã thu về cạnh dài tối đa **512** cho mascot và **256/540** cho
 * logo, bằng cỡ lớn nhất thiết kế dùng nhân 3 cho màn hình @3x.
 *
 * Tổng bộ ảnh: 1423 KB → 521 KB.
 *
 * **Khi thêm ảnh mới, thu nhỏ trước.** Chép thẳng file gốc vào đây là một quả
 * bom hẹn giờ trên máy yếu, và nó sẽ không lộ ra trong bất kỳ test nào.
 */

/** Koko tư thế chuẩn — dùng khi không có tư thế nào hợp hơn */
export const KOKO = require('../../assets/brand/koko.png') as number;

/** Koko ngồi máy tính — card trợ lý AI ở Bảng tin, màn KokoChat */
export const KOKO_LAPTOP = require('../../assets/brand/koko-laptop.png') as number;

/** Koko đang đọc — khối rỗng của danh sách bài viết, hồ sơ */
export const KOKO_READING = require('../../assets/brand/koko-reading.png') as number;

/** Koko vui — màn chào mừng, trạng thái thành công */
export const KOKO_HAPPY = require('../../assets/brand/koko-happy.png') as number;

/** Koko dáng "không tìm thấy" — khối rỗng nặng, màn lỗi */
export const KOKO_404 = require('../../assets/brand/koko-404.png') as number;

/** Dấu hiệu (logo không chữ) trên nền SÁNG — ô 40px đầu màn Bảng tin */
export const LOGO_MARK = require('../../assets/brand/skillswap-mark.png') as number;

/**
 * Dấu hiệu trên nền TỐI — chỉ dùng trên `brand-deep`/`navy`.
 *
 * Bản thường có nét màu navy, đặt lên nền navy sẽ biến mất. Đây là lý do design
 * system giữ hai bản riêng chứ không đổi màu bằng `tintColor`.
 */
export const LOGO_MARK_NEGATIVE =
  require('../../assets/brand/skillswap-mark-negative.png') as number;

/** Logo đầy đủ có chữ, nền sáng — màn Welcome */
export const LOGO_FULL = require('../../assets/brand/skillswap-logo-full.png') as number;

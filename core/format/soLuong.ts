/**
 * @file soLuong.ts
 * @description Định dạng số cho giao diện. Hiện có một hàm: phân cách hàng nghìn
 * theo cách người Việt viết ("150.000").
 *
 * ## Vì sao KHÔNG dùng `Intl.NumberFormat`
 *
 * Hermes chỉ có Intl đầy đủ khi bản build bật `jsEngine` kèm ICU. Khi thiếu, nó
 * âm thầm rơi về một bản tối giản định dạng theo `en-US` ("150,000"). Một dấu
 * phẩy ở chỗ dấu chấm làm người Việt đọc 150.000 thành 150 — sai 1000 lần, và
 * chỉ sai trên máy thật (Node trong CI có ICU đầy đủ nên test sẽ xanh).
 *
 * ## Vì sao ở `core/` chứ không ở feature
 *
 * Bản gốc của hàm này là một hàm riêng tư trong
 * `features/mentor/serviceDisplay.ts`. Nhánh mentor-mode cũng phải in S-coin, mà
 * `features/` không được import chéo nhau, nên lựa chọn chỉ có hai: chép hàm
 * sang nhánh thứ hai, hoặc đưa lên `core/`. Chép thì hai bản sẽ lệch nhau và
 * bản lệch chính là bản in sai tiền. Đây là định dạng thuần, không mang luật
 * nghiệp vụ nào của feature nào, nên nó thuộc `core/`.
 *
 * Lưu ý: hàm này KHÔNG quyết định có được hiện số hay không. Việc đó tuỳ nghiệp
 * vụ (buổi miễn phí, dịch vụ chưa báo giá, ví chưa có số dư) và nằm ở từng
 * feature — xem `moTaGiaDichVu()` của `features/mentor/serviceDisplay.ts`.
 */

/**
 * Chèn dấu chấm phân cách hàng nghìn: `150000` → `"150.000"`.
 *
 * Phần thập phân bị CẮT (`Math.trunc`) chứ không làm tròn: mọi số tiền trong hệ
 * này là S-coin nguyên (`Integer` trong Java), nên một số thập phân lọt vào đây
 * là dữ liệu lạ, và làm tròn nó lên sẽ in ra một con số lớn hơn thực tế.
 */
export function phanCachNghin(so: number): string {
  if (!Number.isFinite(so)) {
    // `NaN`/`Infinity` đến từ một phép tính hỏng ở chỗ gọi. In "NaN" ra màn hình
    // thì người dùng không hiểu gì; trả chuỗi rỗng để chỗ gọi (đã phải kiểm
    // `null`) cũng bỏ luôn ô đó.
    return '';
  }
  const nguyen = Math.trunc(Math.abs(so));
  const chuoi = String(nguyen).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return so < 0 ? `-${chuoi}` : chuoi;
}

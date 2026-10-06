/**
 * @file roleMode Storage
 * @description Lưu chế độ vai trò người dùng đang chọn (Mentee hay Mentor) để nó
 * sống qua lần tắt app.
 *
 * ## Vì sao KHÔNG nhét vào `core/auth/session.ts`
 *
 * File đó chỉ lo MỘT thứ: refresh token của phiên đăng nhập, và nó là nơi duy
 * nhất trong app chạm vào bộ nhớ bền của phiên. Chế độ vai trò là một lựa chọn
 * GIAO DIỆN, không phải phần của phiên, và trộn hai thứ vào một file làm cả hai
 * vòng đời dính nhau. Lựa chọn vẫn bị xoá khi đăng xuất — nhưng việc đó do
 * `RoleModeProvider` lo (nó theo dõi người dùng đổi), vì lựa chọn lưu theo MÁY:
 * không xoá thì tài khoản hai vai đăng nhập kế tiếp trên cùng máy sẽ mở thẳng
 * vào thanh Mentor.
 *
 * ## Vì sao vẫn là `expo-secure-store` chứ không phải AsyncStorage
 *
 * Không phải vì giá trị này cần bảo mật — nó không. Mà vì `expo-secure-store` là
 * bộ nhớ bền DUY NHẤT repo này đã có (`package.json` không có
 * `@react-native-async-storage/async-storage`), và app chưa từng chạy trên thiết
 * bị thật lần nào: thêm một native module nữa là thêm một ẩn số vào bản build
 * đầu tiên để đổi lấy đúng một chuỗi 6 ký tự. Khi nào repo có AsyncStorage cho
 * việc khác thì đổi file này sang, màn hình không phải sửa.
 *
 * Hai giới hạn của `expo-secure-store` đã ghi đầy đủ ở `core/auth/session.ts`;
 * cả hai đều vô hại ở đây (giá trị dài 6 ký tự, và một giá trị sót lại sau khi
 * cài lại app vẫn bị `quyCheDoVaiTro()` kiểm lại theo vai trò thật).
 *
 * MỌI lời gọi đều bọc `try/catch` và KHÔNG ném: máy không có keystore khả dụng
 * chỉ được phép làm app quên lựa chọn vai trò, không được phép làm app chết lúc
 * khởi động.
 */

import * as SecureStore from 'expo-secure-store';

import type { AppRoleMode } from '@/core/config/tabs';

/**
 * Khoá lưu chế độ vai trò.
 *
 * Phải khớp `/^[\w.-]+$/`: `ensureValidKey()` của expo-secure-store NÉM với khoá
 * chứa ký tự khác, và lỗi đó chỉ lộ ra trên thiết bị thật.
 */
export const KHOA_CHE_DO_VAI_TRO = 'skillswap_che_do_vai_tro';

/**
 * Đọc chế độ đã lưu, ở dạng CHUỖI THÔ.
 *
 * Cố ý không tự quy về `AppRoleMode` ở đây: việc một chuỗi có hợp lệ hay không
 * còn phụ thuộc vai trò hiện tại của tài khoản, và chỗ biết điều đó là
 * `quyCheDoVaiTro()`. Trả `'MENTOR'` thành `null` tại đây sẽ xoá mất thông tin
 * "máy có lưu một giá trị cần dọn".
 */
export async function docCheDoVaiTro(): Promise<string | null> {
  try {
    const gia = await SecureStore.getItemAsync(KHOA_CHE_DO_VAI_TRO);
    // Chuẩn hoá `undefined` về `null`: dưới jest-expo native module bị auto-mock
    // và trả `undefined` (đã đo ở `core/auth/session.ts`), để nó chảy tiếp thì
    // `quyCheDoVaiTro` vẫn đúng nhưng chỗ gọi khác lại phải kiểm hai giá trị.
    return gia ? gia : null;
  } catch {
    return null;
  }
}

/**
 * Lưu chế độ vai trò.
 * @returns `true` nếu đã ghi được; `false` khi keystore không khả dụng.
 *
 * KHÔNG ném. Ghi thất bại nghĩa là lựa chọn chỉ sống trong phiên này — người
 * dùng vẫn chuyển vai trò được ngay bây giờ, nên không có gì để báo lỗi.
 */
export async function luuCheDoVaiTro(cheDo: AppRoleMode): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(KHOA_CHE_DO_VAI_TRO, cheDo);
    return true;
  } catch {
    return false;
  }
}

/** Xoá lựa chọn đã lưu — gọi khi giá trị cũ không còn hợp lệ với vai trò hiện tại */
export async function xoaCheDoVaiTro(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KHOA_CHE_DO_VAI_TRO);
  } catch {
    // Không xoá được thì cũng không sao: `quyCheDoVaiTro()` vẫn lùi về Mentee ở
    // mỗi lần khởi động, nên giá trị mồ côi không bao giờ được dùng.
  }
}

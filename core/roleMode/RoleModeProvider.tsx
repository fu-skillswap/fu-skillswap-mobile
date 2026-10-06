/**
 * @file RoleModeProvider.tsx
 * @description Context giữ chế độ vai trò đang xem (Mentee hay Mentor) và lối
 * chuyển qua lại cho tài khoản có cả hai vai trò.
 *
 * Nằm BÊN TRONG `AuthProvider` trong cây component: vai trò do
 * `GET /api/auth/me` cấp, nên provider này phải đọc được `useAuth()`.
 *
 * ## Ba điều phải giữ khi sửa file này
 *
 * 1. **Lựa chọn đã lưu không phải nguồn sự thật.** Nguồn sự thật là
 *    `quyCheDoVaiTro(user.roles, daLuu)` — xem JSDoc của `core/roleMode/roleMode.ts`
 *    để biết vì sao, và vì sao "rơi về Mentee" phải được tính lại ở MỖI lần khởi
 *    động chứ không chỉ một lần lúc bị gỡ quyền.
 *
 * 2. **`dangTai` phải được tôn trọng.** Đọc keystore là bất đồng bộ. Nếu thanh
 *    tab vẽ ngay khi chưa đọc xong thì một mentor thuần sẽ thấy thanh Mentee
 *    nhấp một nhịp rồi mới đổi — và với tài khoản hai vai, cú nhấp đó còn mang
 *    người dùng về tab Bảng tin thay vì tab họ đang làm việc.
 *
 * 3. **KHÔNG tự điều hướng ở đây.** `core/` không được biết tới router (cùng luật
 *    với `core/ui`). Màn hình gọi `chuyenCheDo()` rồi tự `router.replace()` sang
 *    tab đầu của thanh mới — xem `MentorMoreScreen` và `ProfileScreen`.
 */

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/core/auth/AuthProvider';
import type { AppRoleMode } from '@/core/config/tabs';
import { quyCheDoVaiTro } from '@/core/roleMode/roleMode';
import { docCheDoVaiTro, luuCheDoVaiTro, xoaCheDoVaiTro } from '@/core/roleMode/roleModeStorage';

export interface RoleModeContextValue {
  /**
   * Chế độ đang xem. `null` khi chưa đọc xong keystore, hoặc khi tài khoản không
   * có vai trò nào mobile phục vụ.
   */
  cheDo: AppRoleMode | null;
  /** Các chế độ tài khoản này có; `length === 2` nghĩa là phải hiện lối chuyển */
  cheDoKhaDung: AppRoleMode[];
  /** Chưa đọc xong lựa chọn đã lưu — chỗ gọi phải chờ, xem điểm 2 ở đầu file */
  dangTai: boolean;
  /**
   * Đổi chế độ đang xem và ghi lựa chọn xuống keystore.
   *
   * Yêu cầu một chế độ tài khoản THẬT SỰ có; truyền chế độ không có thì lời gọi
   * bị bỏ qua (và không ghi gì), để không tạo ra trạng thái mà
   * `quyCheDoVaiTro()` sẽ phải lùi lại ngay ở lần khởi động sau.
   */
  chuyenCheDo: (cheDo: AppRoleMode) => void;
}

const RoleModeContext = createContext<RoleModeContextValue | null>(null);

/**
 * Hai chế độ, dùng để dựng LẠI mảng `cheDoKhaDung` với danh tính ổn định.
 *
 * `quyCheDoVaiTro()` trả một mảng MỚI mỗi lần gọi, nên đưa thẳng mảng đó vào
 * context sẽ làm mọi consumer render lại ở mỗi lần `AuthProvider` render. Lọc
 * lại từ hằng này cho ra mảng có cùng kiểu `AppRoleMode[]` mà không cần `as`.
 */
const MOI_CHE_DO: readonly AppRoleMode[] = ['MENTEE', 'MENTOR'];

export function RoleModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // `undefined` = chưa đọc keystore; `null` = đã đọc và máy chưa lưu gì. Hai
  // trạng thái này KHÔNG được gộp: gộp lại thì `dangTai` không bao giờ tắt được
  // trên máy chưa lưu lựa chọn nào.
  const [daLuu, setDaLuu] = useState<string | null | undefined>(undefined);
  const conSong = useRef(true);

  useEffect(() => {
    conSong.current = true;
    void (async () => {
      const gia = await docCheDoVaiTro();
      if (conSong.current) {
        setDaLuu(gia);
      }
    })();
    return () => {
      conSong.current = false;
    };
  }, []);

  // Không `useMemo`: hàm chỉ chạy vài phép trên mảng tối đa 4 phần tử, còn việc
  // giữ danh tính ổn định đã do `khoaKhaDung` + `cheDoKhaDung` bên dưới lo.
  const ketQua = quyCheDoVaiTro(user?.roles ?? [], daLuu);
  const khoaKhaDung = ketQua.cheDoKhaDung.join(',');
  const cheDoKhaDung = useMemo(
    () => MOI_CHE_DO.filter((cheDo) => khoaKhaDung.split(',').includes(cheDo)),
    [khoaKhaDung],
  );

  /*
    Đăng xuất (hoặc đổi sang một tài khoản khác) thì QUÊN lựa chọn của người
    trước. Lựa chọn lưu theo MÁY chứ không theo tài khoản, nên không dọn ở đây
    thì tài khoản hai vai đăng nhập kế tiếp trên cùng máy sẽ mở thẳng vào thanh
    Mentor mà chính họ chưa từng chọn.

    Chỉ phản ứng với lần CHUYỂN từ một người dùng đã biết sang người khác/không
    ai: lần khởi động nguội đi từ `null` lên người dùng thật, và lúc đó lựa chọn
    đã lưu chính là của người này (đăng xuất trước đó đã dọn của người cũ).
    Đặt ở đây chứ không ở `AuthProvider` để vòng đời của lựa chọn vai trò nằm
    trọn trong `core/roleMode/`.
  */
  const maNguoiDung = user?.publicId ?? null;
  const maNguoiDungTruoc = useRef<string | null>(maNguoiDung);
  useEffect(() => {
    const truoc = maNguoiDungTruoc.current;
    maNguoiDungTruoc.current = maNguoiDung;
    if (truoc !== null && truoc !== maNguoiDung) {
      setDaLuu(null);
      void xoaCheDoVaiTro();
    }
  }, [maNguoiDung]);

  useEffect(() => {
    if (ketQua.daLuuKhongHopLe) {
      // Dọn giá trị chết. KHÔNG gọi kèm `setDaLuu(null)`: `ketQua.cheDo` đã là
      // chế độ đúng rồi, một `setState` nữa chỉ thêm một lượt render mà không
      // đổi gì người dùng thấy.
      void xoaCheDoVaiTro();
    }
  }, [ketQua.daLuuKhongHopLe]);

  const chuyenCheDo = useCallback(
    (cheDo: AppRoleMode) => {
      if (!khoaKhaDung.split(',').includes(cheDo)) {
        return;
      }
      setDaLuu(cheDo);
      void luuCheDoVaiTro(cheDo);
    },
    [khoaKhaDung],
  );

  const cheDo = daLuu === undefined ? null : ketQua.cheDo;
  const value = useMemo<RoleModeContextValue>(
    () => ({
      cheDo,
      cheDoKhaDung,
      dangTai: daLuu === undefined,
      chuyenCheDo,
    }),
    [cheDo, cheDoKhaDung, daLuu, chuyenCheDo],
  );

  return <RoleModeContext.Provider value={value}>{children}</RoleModeContext.Provider>;
}

/** Lấy chế độ vai trò hiện tại; phải nằm trong `<RoleModeProvider>` */
export function useRoleMode(): RoleModeContextValue {
  const context = useContext(RoleModeContext);
  if (!context) {
    throw new Error('useRoleMode phải được dùng bên trong <RoleModeProvider>');
  }
  return context;
}

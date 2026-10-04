import * as SecureStore from 'expo-secure-store';

import {
  KHOA_CHE_DO_VAI_TRO,
  docCheDoVaiTro,
  luuCheDoVaiTro,
  xoaCheDoVaiTro,
} from '@/core/roleMode/roleModeStorage';
import { KHOA_REFRESH_TOKEN } from '@/core/auth/session';

/**
 * Mock dựng hoàn toàn trong factory (Jest hoist nó lên trên mọi `import`), và
 * giữ ĐÚNG hình dạng export thật của `expo-secure-store@57.0.4`: chỉ có named
 * export, KHÔNG có default. Lý do đầy đủ ở `core/auth/session.test.ts`.
 */
jest.mock('expo-secure-store', () => ({
  __esModule: true,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const kho = jest.mocked(SecureStore);

beforeEach(() => {
  jest.clearAllMocks();
  kho.getItemAsync.mockResolvedValue(null);
  kho.setItemAsync.mockResolvedValue(undefined);
  kho.deleteItemAsync.mockResolvedValue(undefined);
});

describe('khoá lưu chế độ vai trò', () => {
  it('khớp luật đặt tên khoá của expo-secure-store', () => {
    // `ensureValidKey()` trong node_modules/expo-secure-store/build/SecureStore.js
    // NÉM nếu khoá không khớp `/^[\w.-]+$/`. Lỗi chỉ nổ trên thiết bị thật.
    expect(KHOA_CHE_DO_VAI_TRO).toMatch(/^[\w.-]+$/);
  });

  it('KHÁC khoá của refresh token', () => {
    // Hai thứ có hai vòng đời khác nhau (đăng xuất xoá token, không xoá lựa
    // chọn vai trò). Dùng chung một khoá sẽ làm lần đăng nhập sau đọc chế độ
    // vai trò ra thành refresh token.
    expect(KHOA_CHE_DO_VAI_TRO).not.toBe(KHOA_REFRESH_TOKEN);
  });
});

describe('docCheDoVaiTro', () => {
  it('trả đúng giá trị keystore đang giữ', async () => {
    kho.getItemAsync.mockResolvedValue('MENTOR');

    await expect(docCheDoVaiTro()).resolves.toBe('MENTOR');
    expect(kho.getItemAsync).toHaveBeenCalledWith(KHOA_CHE_DO_VAI_TRO);
  });

  it('trả CHUỖI THÔ chứ không tự lọc giá trị lạ', async () => {
    // Việc một chuỗi có hợp lệ hay không còn phụ thuộc vai trò hiện tại, và chỗ
    // biết điều đó là `quyCheDoVaiTro()`. Lọc ở đây sẽ xoá mất thông tin "máy
    // có một giá trị cần dọn".
    kho.getItemAsync.mockResolvedValue('ADMIN');

    await expect(docCheDoVaiTro()).resolves.toBe('ADMIN');
  });

  it('chưa lưu gì thì trả null', async () => {
    kho.getItemAsync.mockResolvedValue(null);

    await expect(docCheDoVaiTro()).resolves.toBeNull();
  });

  it('keystore trả undefined (jest-expo auto-mock) vẫn ra null', async () => {
    kho.getItemAsync.mockResolvedValue(undefined as unknown as string);

    await expect(docCheDoVaiTro()).resolves.toBeNull();
  });

  it('chuỗi rỗng ra null — một lựa chọn rỗng vô dụng y như không có', async () => {
    kho.getItemAsync.mockResolvedValue('');

    await expect(docCheDoVaiTro()).resolves.toBeNull();
  });

  it('keystore NÉM thì trả null, KHÔNG ném ra ngoài', async () => {
    // Máy không có keystore khả dụng (hoặc khoá đã bị vô hiệu vì người dùng đổi
    // sinh trắc học) chỉ được phép làm app quên lựa chọn vai trò, không được
    // phép làm app chết lúc khởi động.
    kho.getItemAsync.mockRejectedValue(new Error('keystore chết'));

    await expect(docCheDoVaiTro()).resolves.toBeNull();
  });
});

describe('luuCheDoVaiTro', () => {
  it('ghi đúng khoá và đúng giá trị', async () => {
    await expect(luuCheDoVaiTro('MENTOR')).resolves.toBe(true);

    expect(kho.setItemAsync).toHaveBeenCalledWith(KHOA_CHE_DO_VAI_TRO, 'MENTOR');
  });

  it('keystore NÉM thì trả false, KHÔNG ném ra ngoài', async () => {
    // Ghi thất bại nghĩa là lựa chọn chỉ sống trong phiên này — người dùng vẫn
    // chuyển vai trò được ngay bây giờ, nên không có gì để báo lỗi.
    kho.setItemAsync.mockRejectedValue(new Error('hết chỗ'));

    await expect(luuCheDoVaiTro('MENTEE')).resolves.toBe(false);
  });
});

describe('xoaCheDoVaiTro', () => {
  it('xoá đúng khoá', async () => {
    await xoaCheDoVaiTro();

    expect(kho.deleteItemAsync).toHaveBeenCalledWith(KHOA_CHE_DO_VAI_TRO);
  });

  it('keystore NÉM thì không ném ra ngoài', async () => {
    kho.deleteItemAsync.mockRejectedValue(new Error('không xoá được'));

    await expect(xoaCheDoVaiTro()).resolves.toBeUndefined();
  });
});

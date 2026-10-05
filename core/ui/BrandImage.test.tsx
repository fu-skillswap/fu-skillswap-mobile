import { render, screen } from '@testing-library/react-native';

import { KOKO, LOGO_FULL } from '@/core/ui/brand';
import { BrandImage } from '@/core/ui/BrandImage';

/**
 * KHÔNG test giá trị của `KOKO`/`LOGO_FULL`: `require()` trả về một số do
 * bundler sinh, khác nhau giữa các lần build, nên assert vào nó chỉ khoá lại
 * một chi tiết nội bộ của Metro. Những gì test ở đây là bốn điều có hậu quả
 * thật trên thiết bị: ảnh có cỡ, cỡ đúng, không bị `cover` cắt, và trình đọc
 * màn hình đối xử với nó đúng cách.
 */
describe('BrandImage', () => {
  it('`size` dựng ảnh vuông với cả width lẫn height — không để React Native tự đoán', async () => {
    await render(<BrandImage source={KOKO} size={140} testID="anh" />);

    const anh = screen.getByTestId('anh', { includeHiddenElements: true });
    expect(anh.props.style).toMatchObject({ width: 140, height: 140 });
  });

  it('`width`/`height` dựng ảnh chữ nhật đúng tỉ lệ thiết kế', async () => {
    await render(<BrandImage source={LOGO_FULL} width={112} height={36} testID="anh" />);

    const anh = screen.getByTestId('anh', { includeHiddenElements: true });
    expect(anh.props.style).toMatchObject({ width: 112, height: 36 });
  });

  it('luôn là `contain`, không có đường nào truyền `cover` vào', async () => {
    // `cover` cắt mất đầu Koko và cắt chữ của logo. Component không nhận prop
    // resizeMode, nên test này khoá lại giá trị dựng cứng.
    await render(<BrandImage source={KOKO} size={64} testID="anh" />);

    expect(screen.getByTestId('anh', { includeHiddenElements: true }).props.resizeMode).toBe(
      'contain',
    );
  });

  it('không có nhãn: ảnh trang trí, bị ẩn khỏi trình đọc màn hình trên CẢ hai nền tảng', async () => {
    await render(<BrandImage source={KOKO} size={140} testID="anh" />);

    // RNTL mặc định `defaultIncludeHiddenElements: false`, nên một truy vấn
    // thường KHÔNG thấy phần tử bị ẩn khỏi trình đọc màn hình. Đây chính là
    // bằng chứng ảnh đã bị ẩn.
    expect(screen.queryByTestId('anh')).toBeNull();

    const anh = screen.getByTestId('anh', { includeHiddenElements: true });
    // iOS
    expect(anh.props.accessibilityElementsHidden).toBe(true);
    // Android
    expect(anh.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(anh.props.accessibilityLabel).toBeUndefined();
  });

  it('có nhãn: ảnh mang thông tin, trình đọc màn hình đọc được nhãn đó', async () => {
    await render(<BrandImage source={LOGO_FULL} width={112} height={36} label="SkillSwap" />);

    const anh = screen.getByLabelText('SkillSwap');
    expect(anh.props.accessible).toBe(true);
    expect(anh.props.accessibilityElementsHidden).toBeUndefined();
    expect(anh.props.importantForAccessibility).toBeUndefined();
  });
});

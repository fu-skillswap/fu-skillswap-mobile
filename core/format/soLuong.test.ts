import { phanCachNghin } from '@/core/format/soLuong';

describe('phanCachNghin', () => {
  it('dùng DẤU CHẤM, không phải dấu phẩy', () => {
    // Vế quan trọng nhất của file: `Intl` tối giản của Hermes in "150,000", và
    // người Việt đọc con số đó thành 150.
    expect(phanCachNghin(150000)).toBe('150.000');
    expect(phanCachNghin(150000)).not.toContain(',');
  });

  it('số dưới một nghìn giữ nguyên', () => {
    expect(phanCachNghin(0)).toBe('0');
    expect(phanCachNghin(7)).toBe('7');
    expect(phanCachNghin(999)).toBe('999');
  });

  it('chèn dấu ở đúng mọi mốc nghìn', () => {
    expect(phanCachNghin(1000)).toBe('1.000');
    expect(phanCachNghin(1215000)).toBe('1.215.000');
    expect(phanCachNghin(1000000000)).toBe('1.000.000.000');
  });

  it('số âm giữ dấu trừ ở ngoài', () => {
    // Ví của mentor có giao dịch trừ (`balanceEffectScoin` âm trong
    // `WalletTransactionResponse`), nên nhánh này không phải giả thuyết.
    expect(phanCachNghin(-150000)).toBe('-150.000');
  });

  it('phần thập phân bị CẮT, không làm tròn lên', () => {
    // Mọi số tiền của hệ này là S-coin nguyên; làm tròn lên sẽ in một con số
    // lớn hơn thực tế.
    expect(phanCachNghin(1999.9)).toBe('1.999');
    expect(phanCachNghin(-1999.9)).toBe('-1.999');
  });

  it('NaN và Infinity ra chuỗi rỗng chứ không in "NaN" lên màn hình', () => {
    expect(phanCachNghin(Number.NaN)).toBe('');
    expect(phanCachNghin(Number.POSITIVE_INFINITY)).toBe('');
    expect(phanCachNghin(Number.NEGATIVE_INFINITY)).toBe('');
  });
});

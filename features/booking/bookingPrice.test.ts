import { moTaGiaBooking } from '@/features/booking/bookingPrice';
import { taoBooking } from '@/features/booking/mocks/bookingFixture';

describe('moTaGiaBooking', () => {
  it('có giá thì hiện số đã phân cách hàng nghìn', () => {
    const moTa = moTaGiaBooking(
      taoBooking({ serviceIsFreeSnapshot: false, servicePriceScoinSnapshot: 150000 }),
    );

    expect(moTa).toEqual({ so: '150.000', nhan: null });
  });

  it('đọc giá GỐC của dịch vụ, KHÔNG đọc giá đã cộng phụ phí', () => {
    // Giá cộng phụ phí là số MENTEE phải trả. Hiện nó ở màn mentor là nói với
    // mentor rằng dịch vụ của họ đắt hơn thực tế.
    const moTa = moTaGiaBooking(
      taoBooking({
        serviceIsFreeSnapshot: false,
        servicePriceScoinSnapshot: 100,
        servicePriceWithSurchargeScoin: 110,
      }),
    );

    expect(moTa.so).toBe('100');
    expect(moTa.so).not.toBe('110');
  });

  it('buổi miễn phí ra CHỮ, không ra số 0', () => {
    const moTa = moTaGiaBooking(
      taoBooking({ serviceIsFreeSnapshot: true, servicePriceScoinSnapshot: 0 }),
    );

    expect(moTa).toEqual({ so: null, nhan: 'Miễn phí' });
  });

  it('booking không gắn service thì KHÔNG có gì để hiện', () => {
    // Cả hai vế `null` để thẻ bỏ hẳn ô giá. In "0" ở đây là nói buổi học miễn
    // phí, còn in "null" thì là một lỗi giao diện lộ ra ngoài.
    const moTa = moTaGiaBooking(
      taoBooking({
        serviceId: null,
        serviceTitle: null,
        serviceIsFreeSnapshot: null,
        servicePriceScoinSnapshot: null,
      }),
    );

    expect(moTa).toEqual({ so: null, nhan: null });
  });

  it('`serviceIsFreeSnapshot` null KHÔNG bị coi là miễn phí', () => {
    // `Boolean` đóng hộp: `if (isFree)` cũng chạy đúng với `null`, nhưng nó gộp
    // "chưa biết" vào "miễn phí" và sẽ in "Miễn phí" cho một buổi có thu tiền.
    const moTa = moTaGiaBooking(
      taoBooking({ serviceIsFreeSnapshot: null, servicePriceScoinSnapshot: 200 }),
    );

    expect(moTa.nhan).toBeNull();
    expect(moTa.so).toBe('200');
  });

  it('giá 0 trên booking KHÔNG miễn phí vẫn hiện đúng "0"', () => {
    const moTa = moTaGiaBooking(
      taoBooking({ serviceIsFreeSnapshot: false, servicePriceScoinSnapshot: 0 }),
    );

    expect(moTa).toEqual({ so: '0', nhan: null });
  });
});

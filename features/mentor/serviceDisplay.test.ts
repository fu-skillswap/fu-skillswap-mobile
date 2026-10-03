import { moTaGiaDichVu, moTaThoiLuong } from '@/features/mentor/serviceDisplay';

describe('moTaGiaDichVu', () => {
  it('dịch vụ miễn phí hiện chữ "Miễn phí", KHÔNG hiện con số nào', () => {
    // "0 S-coins" và "Miễn phí" là hai câu khác nhau. Câu đầu khiến người dùng
    // tưởng giá đang bị tính sai.
    expect(moTaGiaDichVu({ isFree: true, priceScoin: null })).toEqual({
      so: null,
      nhan: 'Miễn phí',
    });
  });

  it('miễn phí thì THẮNG cả khi backend vẫn trả kèm một con số', () => {
    // Dữ liệu lạ nhưng có thể gặp: mentor đổi dịch vụ sang miễn phí mà giá cũ còn
    // sót lại. Hiện "150.000" cho một buổi miễn phí là đòi tiền người dùng.
    expect(moTaGiaDichVu({ isFree: true, priceScoin: 150_000 })).toEqual({
      so: null,
      nhan: 'Miễn phí',
    });
  });

  it('chưa báo giá thì nói thẳng là chưa có giá, không in ra "null"', () => {
    // `priceScoin` khai `nullable = true` trong `MentorServiceResponse.java`.
    expect(moTaGiaDichVu({ isFree: false, priceScoin: null })).toEqual({
      so: null,
      nhan: 'Chưa có giá',
    });
  });

  it('có giá thì phân cách hàng nghìn bằng DẤU CHẤM, đúng kiểu người Việt đọc', () => {
    // Dấu phẩy ở chỗ dấu chấm làm người đọc hiểu 150.000 thành 150.
    expect(moTaGiaDichVu({ isFree: false, priceScoin: 150_000 }).so).toBe('150.000');
    expect(moTaGiaDichVu({ isFree: false, priceScoin: 1_250_000 }).so).toBe('1.250.000');
    expect(moTaGiaDichVu({ isFree: false, priceScoin: 999 }).so).toBe('999');
    expect(moTaGiaDichVu({ isFree: false, priceScoin: 1_000 }).so).toBe('1.000');
  });

  it('giá 0 trên dịch vụ KHÔNG miễn phí vẫn hiện số 0, không rơi vào nhánh chưa-có-giá', () => {
    // Kiểm `!priceScoin` thay vì `priceScoin == null` sẽ đẩy 0 sang "Chưa có giá"
    // — che mất một dữ liệu lạ của backend thay vì hiện đúng thứ nó trả về.
    expect(moTaGiaDichVu({ isFree: false, priceScoin: 0 })).toEqual({ so: '0', nhan: null });
  });
});

describe('moTaThoiLuong', () => {
  it('ghép thời lượng với hình thức 1:1', () => {
    expect(moTaThoiLuong({ durationMinutes: 45, deliveryMode: 'ONE_TO_ONE' })).toBe('45 phút · 1:1');
    expect(moTaThoiLuong({ durationMinutes: 90, deliveryMode: 'ONE_TO_ONE' })).toBe('90 phút · 1:1');
  });
});

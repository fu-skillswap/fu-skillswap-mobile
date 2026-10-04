import { laCheDoHopLe, quyCheDoVaiTro } from '@/core/roleMode/roleMode';

describe('quy chế độ vai trò', () => {
  it('tài khoản chỉ MENTEE thì ở chế độ Mentee và không có lối chuyển', () => {
    const ketQua = quyCheDoVaiTro(['MENTEE'], null);

    expect(ketQua.cheDo).toBe('MENTEE');
    expect(ketQua.cheDoKhaDung).toEqual(['MENTEE']);
  });

  it('tài khoản chỉ MENTOR thì ở chế độ Mentor NGAY cả khi máy chưa lưu gì', () => {
    // Đây là chính lỗi người dùng báo: trước khi có file này, một mentor thuần
    // vẫn nhận thanh tab của Mentee vì `resolveTabs()` chỉ có một bảng.
    const ketQua = quyCheDoVaiTro(['MENTOR'], null);

    expect(ketQua.cheDo).toBe('MENTOR');
    expect(ketQua.cheDoKhaDung).toEqual(['MENTOR']);
  });

  it('tài khoản hai vai mặc định Mentee, và báo có đủ hai chế độ', () => {
    const ketQua = quyCheDoVaiTro(['MENTOR', 'MENTEE'], null);

    // Mặc định Mentee là yêu cầu của thiết kế, và nó KHÔNG phụ thuộc thứ tự
    // backend trả vai trò — ở đây MENTOR đứng trước mà kết quả vẫn là MENTEE.
    expect(ketQua.cheDo).toBe('MENTEE');
    expect(ketQua.cheDoKhaDung).toEqual(['MENTEE', 'MENTOR']);
  });

  it('tài khoản hai vai đã chọn Mentor thì giữ Mentor', () => {
    expect(quyCheDoVaiTro(['MENTEE', 'MENTOR'], 'MENTOR').cheDo).toBe('MENTOR');
  });

  it('tài khoản hai vai đã chọn Mentee thì giữ Mentee', () => {
    expect(quyCheDoVaiTro(['MENTEE', 'MENTOR'], 'MENTEE').cheDo).toBe('MENTEE');
  });

  it('bị gỡ quyền MENTOR mà máy còn lưu MENTOR thì RƠI VỀ Mentee và báo phải dọn', () => {
    // Trường hợp then chốt. Tin lời keystore ở đây sẽ cho ra thanh tab Mentor
    // mà mọi API phía sau trả 403, và lối quay về Mentee thì nằm trong màn
    // `MentorMore` của chính thanh đang hỏng — người dùng không thoát ra được.
    const ketQua = quyCheDoVaiTro(['MENTEE'], 'MENTOR');

    expect(ketQua.cheDo).toBe('MENTEE');
    expect(ketQua.daLuuKhongHopLe).toBe(true);
  });

  it('bị gỡ quyền MENTEE mà máy còn lưu MENTEE thì rơi về Mentor', () => {
    // Mặt đối xứng: phép lùi là "về chế độ đầu tiên tài khoản CÓ", không phải
    // "về Mentee bằng mọi giá".
    const ketQua = quyCheDoVaiTro(['MENTOR'], 'MENTEE');

    expect(ketQua.cheDo).toBe('MENTOR');
    expect(ketQua.daLuuKhongHopLe).toBe(true);
  });

  it('giá trị rác trong keystore bị bỏ, không làm vỡ gì', () => {
    // SecureStore trả về chuỗi tuỳ ý: một phiên bản cũ của app, hoặc dữ liệu
    // sống sót qua lần cài lại trên iOS.
    for (const rac of ['ADMIN', 'mentor', '{}', ' ']) {
      const ketQua = quyCheDoVaiTro(['MENTEE', 'MENTOR'], rac);

      expect(ketQua.cheDo).toBe('MENTEE');
      expect(ketQua.daLuuKhongHopLe).toBe(true);
    }
  });

  it('máy chưa lưu gì KHÔNG bị coi là giá trị sai', () => {
    // Phân biệt này quan trọng: lần đầu mở app của mọi người đi qua đây, báo
    // không-hợp-lệ sẽ sinh một lượt ghi keystore vô ích ở mỗi lần khởi động.
    expect(quyCheDoVaiTro(['MENTEE'], null).daLuuKhongHopLe).toBe(false);
    expect(quyCheDoVaiTro(['MENTEE'], undefined).daLuuKhongHopLe).toBe(false);
    expect(quyCheDoVaiTro(['MENTEE'], '').daLuuKhongHopLe).toBe(false);
  });

  it('tài khoản ADMIN thuần không có chế độ nào', () => {
    const ketQua = quyCheDoVaiTro(['ADMIN'], 'MENTOR');

    expect(ketQua.cheDo).toBeNull();
    expect(ketQua.cheDoKhaDung).toEqual([]);
    // Không báo phải dọn: màn "không hỗ trợ" là trạng thái cuối, thêm một nhánh
    // xoá ở đó chỉ làm phức tạp một đường người dùng không đi tiếp được.
    expect(ketQua.daLuuKhongHopLe).toBe(false);
  });

  it('vừa là MENTEE vừa là ADMIN thì vẫn dùng được phần mentee', () => {
    expect(quyCheDoVaiTro(['MENTEE', 'ADMIN'], null).cheDo).toBe('MENTEE');
  });

  it('laCheDoHopLe chỉ nhận đúng hai giá trị', () => {
    expect(laCheDoHopLe('MENTEE')).toBe(true);
    expect(laCheDoHopLe('MENTOR')).toBe(true);
    expect(laCheDoHopLe('ADMIN')).toBe(false);
    expect(laCheDoHopLe(null)).toBe(false);
    expect(laCheDoHopLe(undefined)).toBe(false);
  });
});

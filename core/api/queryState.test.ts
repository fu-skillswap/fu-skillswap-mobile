import { trangThaiTai } from '@/core/api/queryState';
import type { CoQuery } from '@/core/api/queryState';

function co(overrides: Partial<CoQuery> = {}): CoQuery {
  return { isPaused: false, isPending: false, isError: false, coDuLieu: false, ...overrides };
}

describe('trangThaiTai', () => {
  it('chưa có gì và đang tải thì là "dang-tai"', () => {
    expect(trangThaiTai(co({ isPending: true }))).toBe('dang-tai');
  });

  it('chưa có gì và lỗi thì là "loi"', () => {
    expect(trangThaiTai(co({ isError: true }))).toBe('loi');
  });

  it('gọi API thành công nhưng không có dữ liệu thì vẫn là "co-noi-dung"', () => {
    // Trạng thái rỗng thật là việc của màn hình (EmptyState), không phải của hàm
    // này. Gộp "rỗng" vào "lỗi" chính là cách người dùng bị nói dối.
    expect(trangThaiTai(co())).toBe('co-noi-dung');
  });

  it('mất mạng lúc chưa có gì thì là "mat-ket-noi", KHÔNG phải "dang-tai"', () => {
    // Query bị hoãn vì mất mạng cũng mang isPending = true. Nếu thứ tự đảo lại,
    // người dùng thấy spinner quay vô tận trong chế độ máy bay.
    expect(trangThaiTai(co({ isPaused: true, isPending: true }))).toBe('mat-ket-noi');
  });

  it('mất mạng nhưng ĐÃ có dữ liệu thì vẫn hiện nội dung', () => {
    expect(trangThaiTai(co({ isPaused: true, isPending: true, coDuLieu: true }))).toBe(
      'co-noi-dung',
    );
  });

  it('lỗi nhưng ĐÃ có dữ liệu thì vẫn hiện nội dung', () => {
    // Đây là luật quan trọng nhất của hàm này: `isError` bật cả khi chỉ có lần
    // refetch nền hỏng. Trả về 'loi' ở đây nghĩa là một lần kéo-để-tải-lại hụt
    // sóng sẽ xoá sạch thứ người dùng đang đọc.
    expect(trangThaiTai(co({ isError: true, coDuLieu: true }))).toBe('co-noi-dung');
  });

  it('đang tải lại nền khi đã có dữ liệu thì vẫn hiện nội dung', () => {
    expect(trangThaiTai(co({ isPending: false, coDuLieu: true }))).toBe('co-noi-dung');
  });
});

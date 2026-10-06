import { ApiClientError } from '@/core/api/errors';
import {
  coTheGuiLai,
  lamSachTraLoi,
  LICH_SU_TOI_DA,
  lichSuGui,
  nhanNguon,
  tenGoi,
  thongDiepLoiKoko,
} from '@/features/koko/hoiThoaiKoko';
import type { TinKoko } from '@/features/koko/types';

const ban = (id: string, noiDung: string, loi?: string): TinKoko => ({ id, vaiTro: 'user', noiDung, loi });
const koko = (id: string, noiDung: string): TinKoko => ({ id, vaiTro: 'assistant', noiDung });

describe('lichSuGui', () => {
  it('bỏ tin gửi hỏng — chúng chưa từng có câu trả lời', () => {
    expect(lichSuGui([ban('1', 'A', 'lỗi'), ban('2', 'B'), koko('3', 'C'), ban('4', 'D')])).toEqual([
      { role: 'user', content: 'B' },
      { role: 'assistant', content: 'C' },
      { role: 'user', content: 'D' },
    ]);
  });

  it(`chỉ giữ ${LICH_SU_TOI_DA} tin cuối, như service`, () => {
    const dai = Array.from({ length: 30 }, (_, i) => ban(String(i), `câu ${i}`));
    const ketQua = lichSuGui(dai);
    expect(ketQua).toHaveLength(LICH_SU_TOI_DA);
    expect(ketQua[ketQua.length - 1].content).toBe('câu 29');
  });
});

describe('lamSachTraLoi', () => {
  it('bỏ cú pháp markdown mà Text in nguyên ra', () => {
    expect(lamSachTraLoi('## Gợi ý\n- **Quân**: review CV\n* `Trang`\n\n\n\nHết')).toBe('Gợi ý\n• Quân: review CV\n• Trang\n\nHết');
  });
});

describe('nhanNguon', () => {
  it('dịch nguồn quen, bỏ nguồn lạ và nguồn trùng', () => {
    expect(nhanNguon(['search_mentors', 'la', 'search_mentors', 'my_bookings'])).toEqual([
      'Danh sách mentor',
      'Lịch hẹn của bạn',
    ]);
    expect(nhanNguon(undefined)).toEqual([]);
  });
});

describe('thongDiepLoiKoko', () => {
  it('429/503 dùng nguyên câu service viết sẵn', () => {
    expect(thongDiepLoiKoko(new ApiClientError(429, 'ERR', 'Bạn đã hỏi khá nhiều trong một giờ qua, thử lại sau nhé.'))).toBe(
      'Bạn đã hỏi khá nhiều trong một giờ qua, thử lại sau nhé.',
    );
  });

  it('không để lộ câu tiếng Anh của axios', () => {
    expect(thongDiepLoiKoko(new ApiClientError(503, 'ERR', 'Request failed with status code 503'))).not.toMatch(/status code/);
  });

  it('mất mạng và quá thời gian chờ là hai câu khác nhau', () => {
    expect(thongDiepLoiKoko(new ApiClientError(0, 'ERR_NETWORK', 'Network Error'))).toMatch(/kết nối/);
    expect(thongDiepLoiKoko(new ApiClientError(0, 'ECONNABORTED', 'timeout'))).toMatch(/quá lâu/);
  });
});

describe('coTheGuiLai', () => {
  it('chỉ tin cuối, của người dùng, đang lỗi', () => {
    const tin = [ban('1', 'A', 'lỗi'), koko('2', 'B'), ban('3', 'C', 'lỗi')];
    expect(coTheGuiLai(tin, '3')).toBe(true);
    expect(coTheGuiLai(tin, '1')).toBe(false);
    expect(coTheGuiLai([ban('1', 'A')], '1')).toBe(false);
  });
});

describe('tenGoi', () => {
  it('bỏ họ, giữ tên đệm và tên', () => {
    expect(tenGoi('Nguyễn Thu Hà')).toBe('Thu Hà');
    expect(tenGoi('  Hà ')).toBe('Hà');
    expect(tenGoi(null)).toBe('');
  });
});

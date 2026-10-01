import { moTaDiemDanhGia } from '@/features/mentor/rating';
import type { MentorReputation } from '@/features/mentor/types';

function uyTin(overrides: Partial<MentorReputation> = {}): MentorReputation {
  return {
    ratingState: 'RATED',
    ratingAverage: 4.6,
    reviewCount: 12,
    completedSessions: 30,
    ...overrides,
  };
}

describe('moTaDiemDanhGia', () => {
  it('mentor đã có đánh giá thì hiện điểm, một chữ số thập phân', () => {
    const ketQua = moTaDiemDanhGia(uyTin({ ratingAverage: 4.6333 }));

    expect(ketQua.coDiem).toBe(true);
    expect(ketQua.diem).toBe('4.6');
    expect(ketQua.soLuot).toBe(12);
  });

  it('CHƯA có đánh giá thì KHÔNG hiện điểm nào', () => {
    // `mentor-discovery.md` §2 nói thẳng: "Frontend không tự ý hiển thị mặc định
    // 5.0". Mentor mới mà hiện 5 sao là nói dối người dùng về chất lượng, và
    // người dùng không có cách nào biết đó là số bịa.
    const ketQua = moTaDiemDanhGia(uyTin({ ratingState: 'NO_REVIEWS', ratingAverage: null }));

    expect(ketQua.coDiem).toBe(false);
    expect(ketQua.diem).toBeNull();
    expect(ketQua.soLuot).toBe(12);
  });

  it('state là NO_REVIEWS nhưng backend vẫn gửi điểm thì VẪN không hiện', () => {
    // Phép kiểm của riêng người thực hiện: test ở trên đặt cả `ratingState` lẫn
    // `ratingAverage` về trạng thái "chưa có", nên một bản cài đặt chỉ xem
    // `ratingAverage != null` vẫn làm nó xanh. Payload dị dạng theo hướng ngược
    // lại mới phân biệt được: `ratingState` là nguồn sự thật, 4.9 ở đây là rác.
    const ketQua = moTaDiemDanhGia(uyTin({ ratingState: 'NO_REVIEWS', ratingAverage: 4.9 }));

    expect(ketQua.coDiem).toBe(false);
    expect(ketQua.diem).toBeNull();
  });

  it('state là RATED nhưng điểm lại null thì vẫn KHÔNG hiện', () => {
    // Payload dị dạng: backend nói có đánh giá nhưng không gửi điểm. Hiện
    // "NaN" hay "null" lên màn hình còn tệ hơn không hiện gì.
    const ketQua = moTaDiemDanhGia(uyTin({ ratingState: 'RATED', ratingAverage: null }));

    expect(ketQua.coDiem).toBe(false);
    expect(ketQua.diem).toBeNull();
  });

  it('điểm 0 vẫn là một điểm hợp lệ, không phải "chưa có"', () => {
    // 0 là falsy. Kiểm theo tính truthy sẽ ẩn mất điểm của một mentor bị đánh
    // giá rất thấp — đúng thứ người dùng cần thấy nhất.
    const ketQua = moTaDiemDanhGia(uyTin({ ratingState: 'RATED', ratingAverage: 0 }));

    expect(ketQua.coDiem).toBe(true);
    expect(ketQua.diem).toBe('0.0');
  });

  it('điểm nguyên vẫn có phần thập phân để các thẻ không nhảy chiều rộng', () => {
    // Phép kiểm của riêng người thực hiện: "5" và "5.0" đều "đúng" với
    // `toFixed(1)`, nhưng một bản cài đặt dùng `String(ratingAverage)` sẽ ra "5"
    // và chỉ test này bắt được.
    expect(moTaDiemDanhGia(uyTin({ ratingAverage: 5 })).diem).toBe('5.0');
  });
});

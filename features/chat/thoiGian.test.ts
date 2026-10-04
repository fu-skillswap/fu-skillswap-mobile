import { sapTinNhan } from '@/features/chat/hooks/useChat';
import { dungDongChat } from '@/features/chat/dongChat';
import { gioTinNhan, khoaNgay, nhanNgayTinNhan, nhanThoiGianHoiThoai } from '@/features/chat/thoiGian';
import type { MessageResponse } from '@/features/chat/types';

/** Chủ nhật 04/10/2026, 22:00 giờ Việt Nam */
const BAY_GIO = Date.UTC(2026, 9, 4, 15, 0);

function tin(id: string, sequence: number | null, isMine: boolean, createdAt: string): MessageResponse {
  return {
    id,
    sequence,
    conversationId: 'c1',
    senderId: isMine ? 'toi' : 'ban',
    senderName: null,
    messageType: 'TEXT',
    content: id,
    state: 'ACTIVE',
    version: 1,
    editedAt: null,
    deletedAt: null,
    isReadByOther: isMine ? true : null,
    attachments: [],
    createdAt,
    isMine,
  };
}

describe('giờ tin nhắn theo giờ Việt Nam', () => {
  it('đổi Instant UTC sang UTC+7 trước khi in', () => {
    // 14:04 UTC là 21:04 ở Việt Nam — in thẳng mặt đồng hồ sẽ sai 7 tiếng.
    expect(gioTinNhan('2026-10-04T14:04:00Z')).toBe('21:04');
  });

  it('qua nửa đêm UTC+7 thì sang ngày hôm sau', () => {
    expect(khoaNgay('2026-10-04T17:30:00Z')).toBe('2026-10-05');
  });

  it('nhãn hộp thư: hôm nay là giờ, trong tuần là thứ, xa hơn là ngày', () => {
    expect(nhanThoiGianHoiThoai('2026-10-04T14:04:00Z', BAY_GIO)).toBe('21:04');
    expect(nhanThoiGianHoiThoai('2026-10-02T03:00:00Z', BAY_GIO)).toBe('T6');
    expect(nhanThoiGianHoiThoai('2026-09-21T03:00:00Z', BAY_GIO)).toBe('21/09');
    expect(nhanThoiGianHoiThoai('2025-09-21T03:00:00Z', BAY_GIO)).toBe('21/09/2025');
  });

  it('nhãn ngăn ngày trong khung chat', () => {
    expect(nhanNgayTinNhan('2026-10-04T01:00:00Z', BAY_GIO)).toBe('Hôm nay');
    expect(nhanNgayTinNhan('2026-10-03T01:00:00Z', BAY_GIO)).toBe('Hôm qua');
    expect(nhanNgayTinNhan('2026-10-01T01:00:00Z', BAY_GIO)).toBe('T5, 01/10');
  });

  it('chuỗi không đọc được thì trả null', () => {
    expect(gioTinNhan('2026-10-04T14:04:00')).toBeNull();
    expect(nhanThoiGianHoiThoai(null, BAY_GIO)).toBeNull();
  });
});

describe('sapTinNhan', () => {
  it('bỏ trùng theo id và sắp theo sequence tăng dần', () => {
    const ketQua = sapTinNhan([
      tin('c', 3, false, '2026-10-04T03:00:00Z'),
      tin('a', 1, true, '2026-10-04T01:00:00Z'),
      tin('c', 3, false, '2026-10-04T03:00:00Z'),
      tin('b', 2, false, '2026-10-04T02:00:00Z'),
    ]);

    expect(ketQua.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('tin chưa có sequence xếp cuối', () => {
    const ketQua = sapTinNhan([tin('moi', null, true, '2026-10-04T05:00:00Z'), tin('cu', 9, false, '2026-10-04T01:00:00Z')]);

    expect(ketQua.map((t) => t.id)).toEqual(['cu', 'moi']);
  });
});

describe('dungDongChat', () => {
  it('chèn nhãn ngày, chỉ hiện giờ ở tin cuối mỗi chuỗi, "Đã xem" ở tin cuối của mình', () => {
    const dong = dungDongChat(
      [
        tin('a', 1, true, '2026-10-03T01:00:00Z'),
        tin('b', 2, true, '2026-10-03T01:01:00Z'),
        tin('c', 3, false, '2026-10-04T01:00:00Z'),
      ],
      BAY_GIO,
    );

    expect(dong.map((d) => (d.kieu === 'ngay' ? d.nhan : d.tin.id))).toEqual(['Hôm qua', 'a', 'b', 'Hôm nay', 'c']);
    const theoId = Object.fromEntries(dong.filter((d) => d.kieu === 'tin').map((d) => [d.khoa, d]));
    expect(theoId.a).toMatchObject({ hienGio: false, daXem: false });
    expect(theoId.b).toMatchObject({ hienGio: true, daXem: true });
    expect(theoId.c).toMatchObject({ hienGio: true, daXem: false });
  });
});

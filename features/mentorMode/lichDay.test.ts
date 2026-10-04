import { gioVN, instantTuGioVN, ngayVN, nhomSlotMentorTheoNgay } from '@/features/mentorMode/lichDay';
import type { MentorManagedSlotResponse } from '@/features/mentorMode/types';

describe('lichDay — Instant UTC ↔ giờ Việt Nam', () => {
  it('đọc Instant ra ngày và giờ Việt Nam, kể cả khi qua nửa đêm UTC', () => {
    expect(ngayVN('2026-10-06T12:00:00Z')).toBe('2026-10-06');
    expect(gioVN('2026-10-06T12:00:00Z')).toBe('19:00');
    // 18:30 UTC ngày 5 là 01:30 sáng ngày 6 ở Việt Nam
    expect(ngayVN('2026-10-05T18:30:00Z')).toBe('2026-10-06');
    expect(gioVN('2026-10-05T18:30:00Z')).toBe('01:30');
    expect(ngayVN('hỏng')).toBeNull();
  });

  it('đổi giờ mentor nhập về Instant có Z, từ chối giờ sai khuôn', () => {
    expect(instantTuGioVN({ nam: 2026, thang: 10, ngay: 6 }, '19:00')).toBe('2026-10-06T12:00:00Z');
    expect(instantTuGioVN({ nam: 2026, thang: 10, ngay: 6 }, ' 07:15 ')).toBe('2026-10-06T00:15:00Z');
    expect(instantTuGioVN({ nam: 2026, thang: 10, ngay: 6 }, '24:00')).toBeNull();
    expect(instantTuGioVN({ nam: 2026, thang: 10, ngay: 6 }, '7:00')).toBeNull();
  });

  it('gom slot theo ngày Việt Nam và sắp theo giờ', () => {
    const s = (slotId: string, startAt: string) => ({ slotId, startAt }) as MentorManagedSlotResponse;
    const nhom = nhomSlotMentorTheoNgay([
      s('toi', '2026-10-06T12:00:00Z'),
      s('sang', '2026-10-06T01:00:00Z'),
      s('khuya', '2026-10-05T18:00:00Z'),
    ]);
    expect(nhom.get('2026-10-06')?.map((x) => x.slotId)).toEqual(['khuya', 'sang', 'toi']);
  });
});

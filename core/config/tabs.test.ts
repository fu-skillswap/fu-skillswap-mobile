import { isMobileSupportedAccount, resolveRoleModes, resolveTabs } from '@/core/config/tabs';

describe('cấu hình tab', () => {
  it('mentee thấy đủ 5 tab theo đúng thứ tự', () => {
    expect(resolveTabs(['MENTEE']).map((t) => t.name)).toEqual([
      'index',
      'mentors',
      'bookings',
      'messages',
      'profile',
    ]);
  });

  it('nhãn và icon đúng thanh tab Mentee của thiết kế', () => {
    // Nhãn lấy từ mục 3 của `docs/quy-uoc-dung-giao-dien.md`, icon lấy từ
    // `Main.dc.html` dòng 105–109. Khoá cả hai ở đây vì tên route KHÔNG nói được
    // gì về chúng: đổi `index` thành icon `message-square` thì test chỉ kiểm tên
    // route vẫn xanh, và thanh tab sai icon là thứ không ai thấy trong CI.
    expect(resolveTabs(['MENTEE'])).toEqual([
      { name: 'index', title: 'Bảng tin', icon: 'home' },
      { name: 'mentors', title: 'Mentor', icon: 'search' },
      { name: 'bookings', title: 'Lịch hẹn', icon: 'calendar-days' },
      { name: 'messages', title: 'Tin nhắn', icon: 'message-square' },
      { name: 'profile', title: 'Hồ sơ', icon: 'user' },
    ]);
  });

  it('Koko KHÔNG còn là một tab', () => {
    // Thiết kế chuyển trợ lý AI thành một card trên Bảng tin dẫn sang màn
    // `KokoChat`, không còn là mục thứ tư của thanh tab như bản trước.
    const ten = resolveTabs(['MENTEE']).map((t) => t.name);

    expect(ten).not.toContain('assistant');
    expect(resolveTabs(['MENTEE']).map((t) => t.title)).not.toContain('Trợ lý');
  });

  it('mentor thấy đúng bộ tab như mentee', () => {
    expect(resolveTabs(['MENTOR']).map((t) => t.name)).toEqual(resolveTabs(['MENTEE']).map((t) => t.name));
  });

  it('người vừa là mentee vừa là mentor không bị nhân đôi tab', () => {
    expect(resolveTabs(['MENTEE', 'MENTOR'])).toHaveLength(5);
  });

  it('trả về cả hai chế độ vai trò để màn hình hiện segmented control', () => {
    expect(resolveRoleModes(['MENTEE', 'MENTOR'])).toEqual(['MENTEE', 'MENTOR']);
    expect(resolveRoleModes(['MENTEE'])).toEqual(['MENTEE']);
    expect(resolveRoleModes(['MENTOR'])).toEqual(['MENTOR']);
  });

  it('tài khoản admin không được hỗ trợ trên mobile', () => {
    expect(isMobileSupportedAccount(['ADMIN'])).toBe(false);
    expect(isMobileSupportedAccount(['SYSTEM_ADMIN'])).toBe(false);
    expect(resolveTabs(['ADMIN'])).toEqual([]);
  });

  it('tài khoản vừa là mentee vừa là admin vẫn dùng được phần mentee', () => {
    expect(isMobileSupportedAccount(['MENTEE', 'ADMIN'])).toBe(true);
    expect(resolveTabs(['MENTEE', 'ADMIN'])).toHaveLength(5);
  });
});

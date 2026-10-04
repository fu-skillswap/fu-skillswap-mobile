import {
  allTabRouteNames,
  isMobileSupportedAccount,
  resolveRoleModes,
  resolveTabs,
} from '@/core/config/tabs';

describe('cấu hình tab', () => {
  it('mentee thấy đủ 5 tab theo đúng thứ tự', () => {
    expect(resolveTabs(['MENTEE'], 'MENTEE').map((t) => t.name)).toEqual([
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
    expect(resolveTabs(['MENTEE'], 'MENTEE')).toEqual([
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
    const ten = resolveTabs(['MENTEE'], 'MENTEE').map((t) => t.name);

    expect(ten).not.toContain('assistant');
    expect(resolveTabs(['MENTEE'], 'MENTEE').map((t) => t.title)).not.toContain('Trợ lý');
  });

  it('nhãn và icon đúng thanh tab Mentor của thiết kế', () => {
    // Nhãn lấy từ mục 4 của `HANDOFF.md`, icon đọc từ hình SVG trong
    // `<nav aria-label="Điều hướng mentor">` chứ không suy từ tên nhãn.
    expect(resolveTabs(['MENTOR'], 'MENTOR')).toEqual([
      { name: 'mentor-dashboard', title: 'Tổng quan', icon: 'layout-dashboard' },
      { name: 'mentor-bookings', title: 'Booking', icon: 'clipboard-list' },
      { name: 'mentor-schedule', title: 'Lịch dạy', icon: 'calendar-days' },
      { name: 'mentor-wallet', title: 'Ví', icon: 'wallet' },
      { name: 'mentor-more', title: 'Thêm', icon: 'menu' },
    ]);
  });

  it('hai thanh tab KHÁC nhau — đây chính là lỗi người dùng báo', () => {
    // Trước đợt này `resolveTabs()` trả về MỘT bảng duy nhất cho mọi vai trò,
    // nên một mentor thuần vẫn nhận thanh tab của Mentee và không có đường nào
    // vào phần mentor ("không xem được các tab của mentor"). Test cũ ở đây còn
    // KHOÁ CHẶT lỗi đó lại bằng cách khẳng định hai thanh giống nhau.
    const mentee = resolveTabs(['MENTEE'], 'MENTEE').map((t) => t.name);
    const mentor = resolveTabs(['MENTOR'], 'MENTOR').map((t) => t.name);

    expect(mentor).not.toEqual(mentee);
    expect(mentor.some((name) => mentee.includes(name))).toBe(false);
  });

  it('mentor thuần KHÔNG cần truyền chế độ vẫn ra thanh Mentor', () => {
    // Chế độ đến từ keystore nên có thể là `undefined` ở lần render đầu.
    expect(resolveTabs(['MENTOR']).map((t) => t.title)).toEqual([
      'Tổng quan',
      'Booking',
      'Lịch dạy',
      'Ví',
      'Thêm',
    ]);
  });

  it('tài khoản hai vai không truyền chế độ thì mặc định thanh Mentee', () => {
    expect(resolveTabs(['MENTEE', 'MENTOR'])[0]?.name).toBe('index');
  });

  it('tài khoản hai vai đổi được sang thanh Mentor', () => {
    expect(resolveTabs(['MENTEE', 'MENTOR'], 'MENTOR')[0]?.name).toBe('mentor-dashboard');
  });

  it('người vừa là mentee vừa là mentor không bị nhân đôi tab', () => {
    expect(resolveTabs(['MENTEE', 'MENTOR'], 'MENTEE')).toHaveLength(5);
    expect(resolveTabs(['MENTEE', 'MENTOR'], 'MENTOR')).toHaveLength(5);
  });

  it('chế độ MENTOR mà tài khoản không có quyền MENTOR thì KHÔNG ra thanh rỗng', () => {
    // Lớp phòng vệ thứ hai sau `quyCheDoVaiTro()`: một thanh tab rỗng là trạng
    // thái người dùng không thoát ra được, nên nó phải không tới được từ cả hai
    // phía. Đây là trường hợp máy còn lưu `'MENTOR'` sau khi bị gỡ quyền.
    const tab = resolveTabs(['MENTEE'], 'MENTOR');

    expect(tab).not.toHaveLength(0);
    expect(tab[0]?.name).toBe('index');
  });

  it('chế độ MENTEE mà tài khoản chỉ có MENTOR thì lùi về thanh Mentor', () => {
    expect(resolveTabs(['MENTOR'], 'MENTEE')[0]?.name).toBe('mentor-dashboard');
  });

  it('trả về cả hai chế độ vai trò để màn hình hiện lối chuyển', () => {
    expect(resolveRoleModes(['MENTEE', 'MENTOR'])).toEqual(['MENTEE', 'MENTOR']);
    expect(resolveRoleModes(['MENTEE'])).toEqual(['MENTEE']);
    expect(resolveRoleModes(['MENTOR'])).toEqual(['MENTOR']);
  });

  it('resolveRoleModes luôn đặt MENTEE trước, bất kể thứ tự backend trả', () => {
    // Phần tử đầu tiên là chế độ MẶC ĐỊNH (`quyCheDoVaiTro` dựa vào đúng điều
    // này), nên thứ tự ở đây là hợp đồng chứ không phải chi tiết.
    expect(resolveRoleModes(['MENTOR', 'MENTEE'])).toEqual(['MENTEE', 'MENTOR']);
  });

  it('tài khoản admin không được hỗ trợ trên mobile', () => {
    expect(isMobileSupportedAccount(['ADMIN'])).toBe(false);
    expect(isMobileSupportedAccount(['SYSTEM_ADMIN'])).toBe(false);
    expect(resolveTabs(['ADMIN'], 'MENTEE')).toEqual([]);
    expect(resolveTabs(['ADMIN'], 'MENTOR')).toEqual([]);
  });

  it('tài khoản vừa là mentee vừa là admin vẫn dùng được phần mentee', () => {
    expect(isMobileSupportedAccount(['MENTEE', 'ADMIN'])).toBe(true);
    expect(resolveTabs(['MENTEE', 'ADMIN'], 'MENTEE')).toHaveLength(5);
  });
});

describe('allTabRouteNames', () => {
  it('gồm đủ route của CẢ HAI thanh, không trùng', () => {
    // `app/(tabs)/_layout.tsx` phải khai `<Tabs.Screen>` cho tất cả: expo-router
    // đăng ký mọi file trong `(tabs)/` thành route dù có khai hay không, và
    // route không khai sẽ mọc thêm vào thanh tab với tuỳ chọn mặc định.
    const ten = allTabRouteNames();

    expect(ten).toHaveLength(10);
    expect(new Set(ten).size).toBe(10);
    expect(ten).toEqual(expect.arrayContaining(['index', 'mentor-dashboard', 'mentor-more']));
  });
});

import { isMobileSupportedAccount, resolveRoleModes, resolveTabs } from '@/core/config/tabs';

describe('cấu hình tab', () => {
  it('mentee thấy đủ 5 tab theo đúng thứ tự', () => {
    expect(resolveTabs(['MENTEE']).map((t) => t.name)).toEqual([
      'index',
      'booking',
      'schedule',
      'assistant',
      'profile',
    ]);
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

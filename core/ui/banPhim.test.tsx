import { renderHook } from '@testing-library/react-native';
import { HeaderHeightContext } from 'expo-router/react-navigation';
import React from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { useBuTruBanPhim, useBuTruBanPhimDuoiHeader } from '@/core/ui/banPhim';

const INSETS = { top: 59, bottom: 34, left: 0, right: 0 };

function voiInsets({ children }: { children: React.ReactNode }) {
  return <SafeAreaInsetsContext.Provider value={INSETS}>{children}</SafeAreaInsetsContext.Provider>;
}

describe('bù trừ bàn phím', () => {
  it('màn trong Screen (không header native) bù đúng vùng an toàn phía trên', async () => {
    const { result } = await renderHook(() => useBuTruBanPhim(), { wrapper: voiInsets });
    expect(result.current).toBe(59);
  });

  it('màn dưới header native bù đúng chiều cao header, KHÔNG cộng thêm vùng an toàn', async () => {
    function voiHeader({ children }: { children: React.ReactNode }) {
      return (
        <SafeAreaInsetsContext.Provider value={INSETS}>
          <HeaderHeightContext.Provider value={103}>{children}</HeaderHeightContext.Provider>
        </SafeAreaInsetsContext.Provider>
      );
    }
    const { result } = await renderHook(() => useBuTruBanPhimDuoiHeader(), { wrapper: voiHeader });
    expect(result.current).toBe(103);
  });

  it('không có header (test, màn dựng rời) thì lùi về vùng an toàn, không ném lỗi', async () => {
    const { result } = await renderHook(() => useBuTruBanPhimDuoiHeader(), { wrapper: voiInsets });
    expect(result.current).toBe(59);
  });
});

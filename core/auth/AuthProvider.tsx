/**
 * @file AuthProvider.tsx
 * @description Context phiên đăng nhập. Khi mở app sẽ gọi thẳng
 * `POST /api/auth/refresh`: thành công thì vào app, thất bại thì ra màn hình
 * đăng nhập. Cũng là nơi nối HTTP client với tầng cookie native.
 */

import { useQueryClient } from '@tanstack/react-query';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  refreshSession,
  setAccessToken,
  setTokenRefreshedHandler,
  setUnauthenticatedHandler,
} from '@/core/api/client';
import { authRepo } from '@/core/auth/authRepo';
import { getGoogleIdToken, signOutGoogle } from '@/core/auth/googleSignIn';
import { decodeIdTokenClaims, describeIdTokenForSpike } from '@/core/auth/idTokenClaims';
import { clearSessionCookies, persistSessionCookies } from '@/core/auth/session';
import type { UserMeResponse } from '@/core/auth/types';
import { getEnv } from '@/core/config/env';

/** Trạng thái phiên đăng nhập */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: UserMeResponse | null;
  /** Mở hộp thoại Google, đổi ID Token lấy phiên và nạp hồ sơ */
  signInWithGoogle: () => Promise<void>;
  /** Thu hồi phiên ở backend và xoá cookie trên máy */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserMeResponse | null>(null);
  const mounted = useRef(true);
  // AuthProvider được render bên trong QueryClientProvider (xem app/_layout.tsx),
  // nên hook này luôn có client thật để dùng.
  const queryClient = useQueryClient();

  useEffect(() => {
    mounted.current = true;
    // KHÔNG cấu hình Google Sign-In ở đây (nhiệt tình/eager): trước đây gọi
    // configureGoogleSignIn() làm câu lệnh đầu tiên, ngoài mọi khối `try`, nên
    // build thiếu EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (như .env.example mặc định)
    // ném lỗi đồng bộ ra khỏi effect này → màn hình trắng ngay lúc khởi động.
    // Cấu hình giờ diễn ra lười trong getGoogleIdToken()/signOutGoogle() (xem
    // core/auth/googleSignIn.ts) — app luôn vào được màn login, lỗi chỉ lộ ra
    // khi người dùng thật sự bấm đăng nhập, đúng chỗ có UI để hiển thị nó.

    setUnauthenticatedHandler(() => {
      // Dọn state phiên TRƯỚC, xoá cache SAU (Fix 4 — cùng lý do như trong
      // signOut() bên dưới): nếu queryClient.clear() chạy trong khi context
      // vẫn còn báo 'authenticated', các observer đang mount có thể refetch
      // ngay lập tức trong lúc phiên coi như đã chết, dẫm lên cơ chế
      // sessionEpoch mà setAccessToken(null) vừa bật.
      setAccessToken(null);
      if (mounted.current) {
        setUser(null);
        setStatus('unauthenticated');
      }
      // Xoá sạch cache TanStack Query khi phiên kết thúc (dù là do người dùng
      // đăng xuất hay do 401 không refresh được nữa): gcTime mặc định là 5 phút,
      // nếu không xoá thì tài khoản B dùng chung máy sẽ thấy thoáng qua dữ liệu
      // cache của tài khoản A trước khi các query refetch xong.
      queryClient.clear();
    });
    // Sau mỗi lần refresh, ghi cookie vừa rotate xuống đĩa (quan trọng trên Android).
    setTokenRefreshedHandler(persistSessionCookies);

    void (async () => {
      try {
        await refreshSession();
        const me = await authRepo.getMe();
        if (mounted.current) {
          setUser(me);
          setStatus('authenticated');
        }
      } catch {
        setAccessToken(null);
        if (mounted.current) {
          setUser(null);
          setStatus('unauthenticated');
        }
      }
    })();

    return () => {
      mounted.current = false;
      setUnauthenticatedHandler(undefined);
      setTokenRefreshedHandler(undefined);
    };
  }, [queryClient]);

  const signInWithGoogle = useCallback(async () => {
    const { nonce } = await authRepo.getGoogleNonce();
    // Thư viện Google Sign-In miễn phí không nhận nonce (không đưa được claim
    // `nonce` vào ID Token) — chỉ authRepo.loginWithGoogle mới gửi nonce lên backend.
    const credential = await getGoogleIdToken();
    if (__DEV__) {
      // Chỉ chạy trong bản dev, phục vụ spike R1: đọc claim đúng trên `credential` —
      // token thực sự sẽ gửi lên backend ngay dưới đây — thay vì gọi getGoogleIdToken()
      // lần hai (vừa hiện hộp thoại Google hai lần, vừa soi nhầm token đã bị bỏ đi).
      console.log(describeIdTokenForSpike(decodeIdTokenClaims(credential), getEnv().googleWebClientId));
    }
    await authRepo.loginWithGoogle({ credential, nonce });
    await persistSessionCookies();
    const me = await authRepo.getMe();
    if (mounted.current) {
      setUser(me);
      setStatus('authenticated');
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authRepo.logout();
    } finally {
      // Fix 4 (đợt review cuối): dọn state phiên TRƯỚC, dọn dẹp chậm SAU —
      // ngược lại thứ tự cũ (setAccessToken → queryClient.clear() → 2 await →
      // setState). Thứ tự cũ có hai vấn đề:
      // 1) Màn hình vẫn coi phiên là 'authenticated' xuyên suốt hai lần await
      //    (clearSessionCookies, signOutGoogle) — queryClient.clear() lúc đó
      //    có thể kích observer đang mount refetch ngay, mà refresh cookie
      //    chưa kịp xoá xong: request đó 401 → tự refresh (SAU epoch bump vì
      //    setAccessToken(null) đã chạy) → ghi token mới sống vào bộ nhớ cho
      //    một phiên đang đăng xuất, vô hiệu hoá cơ chế sessionEpoch.
      // 2) Nếu clearSessionCookies() reject, khối dọn state (setUser/setStatus)
      //    không bao giờ chạy — phiên bị bỏ dở nửa chừng, và vì profile.tsx
      //    nuốt lỗi của signOut() nên nút "Đăng xuất" trông như không làm gì.
      // Đặt setAccessToken/setUser/setStatus lên đầu khối finally khiến hai vấn
      // đề trên không còn: state luôn được dọn xong trước khi có await nào có
      // thể fail hoặc kích refetch.
      setAccessToken(null);
      if (mounted.current) {
        setUser(null);
        setStatus('unauthenticated');
      }
      // Xoá cache TanStack Query của tài khoản vừa đăng xuất — xem giải thích ở
      // setUnauthenticatedHandler phía trên.
      queryClient.clear();
      await clearSessionCookies();
      await signOutGoogle().catch(() => undefined);
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signInWithGoogle, signOut }),
    [status, user, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Lấy phiên đăng nhập hiện tại; phải nằm trong <AuthProvider> */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được dùng bên trong <AuthProvider>');
  }
  return context;
}

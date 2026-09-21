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
import { configureGoogleSignIn, getGoogleIdToken, signOutGoogle } from '@/core/auth/googleSignIn';
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
    configureGoogleSignIn();

    setUnauthenticatedHandler(() => {
      setAccessToken(null);
      // Xoá sạch cache TanStack Query khi phiên kết thúc (dù là do người dùng
      // đăng xuất hay do 401 không refresh được nữa): gcTime mặc định là 5 phút,
      // nếu không xoá thì tài khoản B dùng chung máy sẽ thấy thoáng qua dữ liệu
      // cache của tài khoản A trước khi các query refetch xong.
      queryClient.clear();
      if (mounted.current) {
        setUser(null);
        setStatus('unauthenticated');
      }
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
      setAccessToken(null);
      // Xoá cache TanStack Query của tài khoản vừa đăng xuất — xem giải thích ở
      // setUnauthenticatedHandler phía trên.
      queryClient.clear();
      await clearSessionCookies();
      await signOutGoogle().catch(() => undefined);
      if (mounted.current) {
        setUser(null);
        setStatus('unauthenticated');
      }
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

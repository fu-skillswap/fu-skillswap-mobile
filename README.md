# SkillSwap Mobile

App React Native (Expo) cho SkillSwap — dùng chung backend với [`fu-skillswap-fe-2`](../fu-skillswap-fe-2).

Thiết kế: [`docs/superpowers/specs/2026-09-18-skillswap-mobile-design.md`](../docs/superpowers/specs/2026-09-18-skillswap-mobile-design.md).
Kế hoạch giai đoạn nền tảng: [`docs/superpowers/plans/2026-09-20-skillswap-mobile-foundation.md`](../docs/superpowers/plans/2026-09-20-skillswap-mobile-foundation.md).

## Bắt đầu

```bash
npm install
cp .env.example .env    # rồi điền EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
npx expo start
```

App dùng **development build**, không chạy trên Expo Go: nó cần các native module
(`@preeternal/react-native-cookie-manager`, `@react-native-google-signin/google-signin`)
mà Expo Go không có sẵn.

## Lệnh thường dùng

| Lệnh | Việc |
|---|---|
| `npm test` | Chạy toàn bộ test (Jest + React Native Testing Library + MSW) |
| `npm run typecheck` | `tsc --noEmit` |
| `npx expo start` | Metro dev server |
| `npx expo run:android` | Build và cài development build lên máy Android |

### Lần typecheck đầu tiên sau khi clone sẽ chậm hơn

`experiments.typedRoutes` đang bật, nên các route literal (`<Redirect href="/(tabs)" />`)
được kiểm kiểu theo `.expo/types/router.d.ts` — một file **sinh tự động** và bị
gitignore. Trên bản clone sạch, file đó chưa tồn tại và `tsc` sẽ báo `TS2322` ở
mọi route literal dù code hoàn toàn đúng.

`npm run typecheck` tự xử lý việc này: `scripts/ensure-router-types.js` phát hiện
file thiếu, bật Metro vừa đủ lâu để Expo sinh file rồi tắt ngay (~10 giây, chỉ một
lần). Các lần sau chạy tức thì. Expo SDK 57 không có lệnh typegen độc lập và
`expo export` không sinh file này — chỉ dev server mới sinh.

## Trạng thái hiện tại

Giai đoạn 1 (nền tảng) — xem plan để biết chi tiết từng task:

- `core/api` — HTTP client bóc envelope `ApiResponse<T>`, tự refresh khi `401`
  (promise singleton, retry đúng một lần), `ApiClientError` + `toUserMessage`,
  `Idempotency-Key` gắn theo payload.
- `core/auth` — phiên đăng nhập trên cookie store native, Google Sign-In, `authRepo`,
  `AuthProvider`.
- `core/config` — biến môi trường, bảng tab theo vai trò.
- `core/ui` — design token port từ `styles/globals.css` của FE web.
- `app/` — khung điều hướng expo-router: màn hình đăng nhập và 5 tab placeholder.

### Chưa chạy được đầu–cuối

Luồng đăng nhập cần backend bổ sung endpoint `/api/auth/google/mobile`. Lý do và
nội dung đề nghị: [`docs/be-change-requests/2026-09-21-mobile-google-login-nonce.md`](../docs/be-change-requests/2026-09-21-mobile-google-login-nonce.md).

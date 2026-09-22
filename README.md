# SkillSwap Mobile

App React Native (Expo) cho SkillSwap — dùng chung backend với
[`fu-skillswap-be`](https://github.com/fu-skillswap/fu-skillswap-be) và đối chiếu quy ước với
web frontend [`fu-skillswap-fe-2`](https://github.com/fu-skillswap/fu-skillswap-fe-2).

Spec thiết kế và các implementation plan **không nằm trong repo này** — chúng ở thư mục
`docs/superpowers/` của workspace, cạnh các repo anh em:

| Tài liệu | Đường dẫn trong workspace |
|---|---|
| Spec thiết kế mobile | `docs/superpowers/specs/2026-09-18-skillswap-mobile-design.md` |
| Plan giai đoạn 1 (nền tảng) | `docs/superpowers/plans/2026-09-20-skillswap-mobile-foundation.md` |
| Plan giai đoạn 2 (diễn đàn) | `docs/superpowers/plans/2026-09-22-skillswap-mobile-forum.md` |

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

Luồng đăng nhập cần backend bổ sung endpoint `/api/auth/google/mobile`: thư viện Google
Sign-In miễn phí không đưa được claim `nonce` vào ID token, nên backend phải bỏ bước so
khớp claim đó cho riêng đường mobile. Nội dung đề nghị chi tiết nằm ở
`docs/be-change-requests/2026-09-21-mobile-google-login-nonce.md` trong workspace (không
commit vào repo này).

Cho tới khi endpoint đó lên, spike R1/R2 trong `docs/spike/` chưa kết luận được — xem mục
"Bị chặn" trong chính runbook đó.

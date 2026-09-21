# Runbook — Spike R1/R2 (đăng nhập Google + độ bền refresh cookie)

- **Ngày viết**: 2026-09-21
- **Áp dụng cho**: `fu-skillswap-mobile`, nhánh `feat/gd1-nen-tang`
- **Đọc trước**: [BE change request — mobile Google login bỏ nonce](../be-change-requests/2026-09-21-mobile-google-login-nonce.md) (đường dẫn tương đối trong repo BE; bản đầy đủ nằm ở `docs/be-change-requests/2026-09-21-mobile-google-login-nonce.md` tại gốc workspace)

Tài liệu này để người chạy spike làm theo từng bước, không cần đọc lại toàn bộ lịch sử quyết định. Nếu cần bối cảnh "vì sao", xem BE change request ở trên và `core/auth/googleSignIn.ts`.

---

## 0. Việc nào chạy được ngay, việc nào phải chờ backend

| Mục | Trạng thái | Ghi chú |
|---|---|---|
| **R1 — nửa mobile**: `aud` của ID token đúng bằng web client id? Có claim `nonce` không? | **Chạy được ngay**, kể cả khi chưa có backend | Nhờ log chẩn đoán `__DEV__` gắn sẵn ở `app/(auth)/login.tsx` (Task 11a). Chỉ cần app mở được màn hình đăng nhập và bấm nút — không cần gọi API nào thành công. |
| **R1 — nửa backend**: `POST /api/auth/google/mobile` trả `200`? | **Bị chặn** | Endpoint này chưa tồn tại (404) cho tới khi BE làm xong [change request](../be-change-requests/2026-09-21-mobile-google-login-nonce.md). |
| **R2**: kill app rồi mở lại — có tự vào thẳng tab bar không? `hasRefreshCookie()` trả gì? `POST /api/auth/refresh` trả gì? | **Bị chặn** | Cần đăng nhập thành công qua đường mobile trước (phụ thuộc R1 — nửa backend). |
| **Refresh sau 15 phút**: đúng một lần refresh, request gốc chạy lại thành công? | **Bị chặn** | Cùng lý do R2. |

→ Việc duy nhất làm được trong runbook này **trước khi** backend xong là mục R1 — nửa mobile. Ba mục còn lại thuộc **Task 11b**, chạy khi backend đã triển khai xong endpoint mobile.

---

## 1. Ba đường để có chỗ chạy app

Chọn **một** đường tuỳ thiết bị/máy đang có. Máy dùng để viết runbook này **không có Android SDK, không có Android Studio, không có `adb`, không có giả lập** — nên đường (A) là đường khuyến nghị cho máy đó.

### (A) Điện thoại Android thật + EAS cloud build — khuyến nghị, không cần cài SDK

Cái cần cài trên máy dev: không gì ngoài Node/npm đã có (build chạy trên cloud của Expo).

Cái cần trên điện thoại: bật **Cài đặt từ nguồn không xác định** (Unknown sources) để cài file `.apk`/`.aab` tải về, hoặc cài app **Expo Orbit**/**Expo Go**-tương đương cho development build.

Các bước:
1. Đăng nhập tài khoản Expo: `npx eas login` (cần tài khoản expo.dev; tạo mới nếu chưa có).
2. Nếu repo chưa có `eas.json`: `npx eas build:configure` — chọn platform Android, để EAS tự sinh cấu hình build cho profile `development`.
3. Build: `npx eas build --profile development --platform android`.
4. Khi build xong, EAS in ra một link QR/URL tải file cài đặt — mở link đó trên điện thoại (hoặc quét QR) để tải và cài.
5. Trên điện thoại: mở app development build vừa cài, mở màn hình đăng nhập.

Build cloud mất khoảng 10–20 phút mỗi lần; không cần build lại nếu chỉ đổi code JS (development build hỗ trợ tải lại qua Metro như bình thường), chỉ cần build lại khi đổi `app.json` (plugin, scheme, package name) hoặc thêm native module.

### (B) Giả lập Android (AVD) có Google Play

**Cảnh báo bắt buộc đọc trước khi dùng đường này**: Google Sign-In (kể cả bản dev build) **cần Google Play Services** trên thiết bị. Rất nhiều system image giả lập mặc định (ví dụ "Google APIs" thường, hoặc bất kỳ image không ghi rõ "Google Play") **không có** Google Play Services cài sẵn, và **không cài thêm được sau đó**. Nếu chạy nhầm image loại này, `GoogleSignin.hasPlayServices()` sẽ ném lỗi hoặc hộp thoại đăng nhập không mở được — trông giống R1 thất bại nhưng **thực chất chỉ là thiếu system image đúng loại, không phải R1 thật sự thất bại**. Đây là false negative, không phải kết luận.

Cách tránh: khi tạo AVD trong Android Studio, ở bước chọn system image, chỉ chọn dòng có biểu tượng **Play Store** (cột "Target" ghi kèm "Google Play", không phải chỉ "Google APIs"). Sau khi tạo xong, mở app Play Store trong AVD một lần và xác nhận đăng nhập được ít nhất giao diện Play Store (không cần đăng nhập tài khoản thật) trước khi chạy spike.

Cái cần cài: Android Studio + Android SDK + một AVD dùng system image có Google Play (ví dụ "Google Play" trên API 34+). Máy hiện tại không có cái nào trong số này — nếu cần dùng đường (B), phải cài Android Studio trước.

Các bước sau khi có AVD đúng loại:
1. Mở AVD.
2. `npx expo run:android` (build và cài trực tiếp lên AVD đang chạy), hoặc cài file build từ đường (A)/( C) lên AVD bằng kéo-thả file `.apk`.

### (C) `expo run:android` chạy local (build ngay trên máy)

Cái cần cài: Android Studio, Android SDK (qua SDK Manager), biến môi trường `ANDROID_HOME`, JDK tương thích với Expo SDK 57. Nặng nhất về cài đặt trong ba đường, và **không khả dụng trên máy đang dùng để chạy spike này** (không có Android SDK/Studio/`adb`).

Dùng đường này khi cần lặp code native nhanh và đã có sẵn máy cài đủ Android SDK — không áp dụng cho máy hiện tại.

---

## 2. Lấy SHA-1 và tạo OAuth client Android trên Google Cloud

Backend/Google chỉ chấp nhận request Google Sign-In từ app có khai báo đúng `package name` + chữ ký (SHA-1) trên Google Cloud Console. Thiếu bước này, `GoogleSignin.signIn()` có thể báo lỗi cấu hình (`DEVELOPER_ERROR`) dù mọi thứ trong app đúng.

### 2.1 Lấy SHA-1

- **Nếu build bằng EAS (đường A)**: EAS tự quản lý keystore ký app. Lấy SHA-1 bằng:
  ```bash
  npx eas credentials
  ```
  Chọn platform Android → chọn profile build tương ứng (`development`) → xem mục "Keystore" → SHA-1 hiển thị trực tiếp trong output, không cần tải file keystore về máy.

- **Nếu build local bằng `keytool`** (chỉ áp dụng nếu có Android SDK/JDK cài sẵn — đường B/C):
  ```bash
  keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
  ```
  Dòng `SHA1:` trong output là giá trị cần.

### 2.2 Tạo OAuth client Android trên Google Cloud Console

1. Vào [Google Cloud Console](https://console.cloud.google.com/) → chọn đúng project mà backend đang dùng cho `GOOGLE_CLIENT_ID` (web client) — **phải cùng project**, không tạo project mới.
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
3. Application type: **Android**.
4. Package name: `asia.skillswap.mobile` (đúng giá trị trong `app.json` → `expo.android.package`, đã cấu hình ở Task 11a).
5. SHA-1 certificate fingerprint: dán giá trị lấy được ở mục 2.1.
6. Lưu lại.

Lưu ý: client Android này **không** phải là `GOOGLE_CLIENT_ID` mà app dùng trong `webClientId`/`.env` (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`) — đó vẫn là web client id, không đổi. Client Android chỉ để Google xác nhận app được phép mở luồng đăng nhập; nó không xuất hiện trực tiếp trong code, và **không nằm trong `aud` của ID token** (đây chính là lý do `aud` phải khớp web client id, xem BE change request mục 2).

Nếu build lại bằng EAS với keystore mới (ví dụ xoá và tạo lại credentials), SHA-1 đổi → phải cập nhật lại OAuth client Android ở bước 2.2, nếu không đăng nhập sẽ báo lỗi cấu hình.

---

## 3. Chạy mục R1 — nửa mobile (chạy được ngay)

1. Đảm bảo `.env` có `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` đúng giá trị web client id mà backend production dùng.
2. Mở app development build (đường A/B/C ở mục 1) trên thiết bị/giả lập đã đăng ký SHA-1 (mục 2).
3. Mở màn hình đăng nhập, bấm **"Đăng nhập với Google"**.
4. Xem log Metro (terminal chạy `npx expo start`, hoặc `npx eas build` không cần — log chạy qua Metro dev server bình thường khi mở app development build và kết nối tới `npx expo start`). Log có dạng:
   ```
   [spike R1] aud KHỚP web client id (aud=xxxx.apps.googleusercontent.com)
   [spike R1] iss=https://accounts.google.com
   [spike R1] sub có, exp=1790000000
   [spike R1] KHÔNG có claim nonce (đúng như dự kiến)
   ```
5. Sau khi thấy log, luồng đăng nhập thật sẽ tiếp tục chạy và gọi API thật — API này sẽ fail (404, vì endpoint mobile chưa tồn tại). **Đó là kết quả mong đợi ở giai đoạn 11a**, không phải lỗi cần sửa. Ghi nhận riêng mục R1 — nửa mobile ở bảng mục 4, không lẫn với lỗi 404 của R1 — nửa backend.

**Không** copy dòng log này ra ngoài terminal / công cụ khác — nó không chứa token thô hay nonce, nhưng vẫn không cần thiết phải phát tán rộng hơn phạm vi chẩn đoán.

---

## 4. Bảng kết quả (điền khi chạy spike)

### R1 — nửa mobile (làm được ngay, Task 11a)

| Thiết bị/giả lập dùng | aud khớp web client id? | Có claim nonce? | Ghi log lỗi/warning nào khác? | Ngày chạy | Người chạy |
|---|---|---|---|---|---|
| | | | | | |

### R1 — nửa backend (chờ Task 11b)

| `POST /api/auth/google/mobile` trả gì | Ngày chạy | Người chạy |
|---|---|---|
| | | |

### R2 (chờ Task 11b)

| Kill app rồi mở lại → vào thẳng tab bar? | `hasRefreshCookie()` trả gì | `POST /api/auth/refresh` trả gì | Ngày chạy | Người chạy |
|---|---|---|---|---|
| | | | | |

### Refresh sau 15 phút (chờ Task 11b)

| Đúng 1 lần refresh? | Request gốc chạy lại thành công sau refresh? | Ngày chạy | Người chạy |
|---|---|---|---|
| | | | |

### Kết luận cuối cùng (điền sau khi đủ dữ liệu)

- R1: ĐẠT / KHÔNG ĐẠT — lý do:
- R2: ĐẠT / KHÔNG ĐẠT — lý do:
- Refresh: ĐẠT / KHÔNG ĐẠT — lý do:

---

## 5. Nếu R2 không đạt (tham khảo, chờ Task 11b)

Kiểm theo thứ tự sau (theo brief Task 11b), vì "cookie mất" và "cookie còn nhưng BE từ chối" nhìn từ ngoài giống hệt nhau:

1. `hasRefreshCookie()` có trả `true` không, ngay sau khi vừa đăng nhập xong (trước khi kill app)?
2. `persistSessionCookies()` có thực sự chạy sau khi đăng nhập thành công, và sau mỗi lần refresh, hay không?
3. Nếu đã xác nhận cả hai điều trên đúng mà cookie vẫn mất sau khi khởi động lại app, đó là dấu hiệu cần một thay đổi backend thứ hai: `AuthController.resolveRefreshToken` hiện chỉ đọc cookie, có thể cần nhận thêm refresh token qua header cho client mobile.

---

## 6. Dọn dẹp sau khi spike có kết luận

Theo Task 11b: sau khi spike kết luận xong, gỡ khối `__DEV__` trong `app/(auth)/login.tsx` (và `core/auth/idTokenClaims.ts` nếu không còn dùng), hoặc giữ lại có chủ đích nếu thấy hữu ích cho chẩn đoán về sau — nhưng phải là quyết định có ý thức, ghi lại trong report của Task 11b, không phải quên dọn.

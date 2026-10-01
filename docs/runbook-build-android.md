# Runbook: build SkillSwap Mobile lên máy Android thật

Mục tiêu của tài liệu này: đưa một bản build chạy được lên điện thoại Android, và
từ đó đi tiếp tới Google Play.

**Đọc mục "Cái gì chạy, cái gì chưa" trước khi build** — có một phần đang bị chặn
bởi backend, biết trước để không mất thời gian nghi ngờ bản build.

---

## 0. Vì sao phải build EAS chứ không build cục bộ

| | |
|---|---|
| **Expo Go không dùng được** | App cần hai native module Expo Go không có sẵn: `@preeternal/react-native-cookie-manager` (phiên đăng nhập nằm trên cookie store native) và `@react-native-google-signin/google-signin`. |
| **Build cục bộ chưa được** | Máy hiện tại chưa có Android SDK, và đang chạy Java 8 — Gradle 9.3 của bản này cần JDK 17. Cài đủ bộ đó mất nhiều thời gian hơn là để EAS lo. |

Kiểm rồi: cả hai module đều ship code Android kèm `codegenConfig`
(`CookieManagerSpec`, `RNGoogleSignInCGen`), đúng chuẩn New Architecture mà app
đang bật (`newArchEnabled=true`, `hermesEnabled=true`).

**Nhưng chúng chưa từng được biên dịch lần nào.** `npx expo prebuild` sinh cấu
hình native sạch, còn việc autolinking + Gradle compile hai module đó chỉ xảy ra
lúc build thật. Bản EAS build đầu tiên là lần đầu ta biết chúng có compile được
hay không — nếu nó hỏng, hỏng ở đây, không phải ở code TypeScript.

---

## 1. Chuẩn bị một lần

```bash
npm install -g eas-cli
eas login            # tài khoản Expo; tạo miễn phí tại expo.dev
```

Trong thư mục `fu-skillswap-mobile`:

```bash
eas init             # gắn repo vào một project Expo, ghi extra.eas.projectId vào app.json
```

Lệnh `eas init` **có sửa `app.json`** (thêm `extra.eas.projectId` và `owner`).
Commit thay đổi đó.

---

## 2. Biến môi trường

`eas.json` đã cắm sẵn `EXPO_PUBLIC_API_URL=https://api.skillswap.asia` cho cả ba
profile. Còn **một biến bắt buộc chưa có giá trị**:

```bash
eas env:create --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "<...>.apps.googleusercontent.com" --visibility plaintext
```

Lấy giá trị ở đâu: đúng bằng `GOOGLE_CLIENT_ID` mà backend đang chạy (xem env của
service đã deploy, hoặc Google Cloud Console → Credentials → OAuth client loại
**Web application**). **Lệch một ký tự là backend trả `OAUTH_VERIFICATION_FAILED`**,
vì nó so `aud` của ID token với client ID của chính nó.

Biến này là `EXPO_PUBLIC_*` nên nó được nhúng vào bundle — nó *là* thông tin công
khai, không phải secret. Sở dĩ không commit vào `eas.json` chỉ vì mỗi môi trường
một giá trị.

Hai biến còn lại tuỳ chọn:

| Biến | Bỏ trống thì sao |
|---|---|
| `EXPO_PUBLIC_AI_URL` | Các màn phụ thuộc AI tự tắt (rủi ro R3 trong spec) |
| `EXPO_PUBLIC_FORUM_BOT_USER_ID` | Bình luận của bot không được gắn badge "AI" — chấp nhận được; gắn nhầm badge cho sinh viên thật mới là lỗi nặng |

---

## 3. Đăng ký OAuth client cho Android

Google Sign-In trên Android cần **hai** thứ tồn tại trong Google Cloud Console:

1. **Web client** — client ID ở bước 2, dùng để lấy ID token cho backend kiểm.
2. **Android client** — để Google chịu trả token cho chính app này. Cần:
   - Package name: `com.fptu.exe.skillswap`
   - SHA-1 của keystore ký bản build

Lấy SHA-1 từ keystore mà EAS quản lý:

```bash
eas credentials            # chọn Android → keystore → xem SHA-1 fingerprint
```

Lần đầu chạy, EAS sẽ đề nghị **tự tạo keystore**. Đồng ý. Quan trọng: **keystore
này là thứ duy nhất cho phép cập nhật app trên Play về sau** — mất nó là không
bao giờ update được app đã publish, phải đăng lại dưới package name khác. EAS giữ
bản chính trên server; nên tải bản lưu về và cất chỗ an toàn:

```bash
eas credentials    # → Android → keystore → Download
```

(`.gitignore` đã chặn `*.jks`, `*.p12`, `*.key` nên không lo commit nhầm.)

---

## 4. Build

Ba profile trong `eas.json`:

| Profile | Lệnh | Ra cái gì | `__DEV__` | Chế độ mock chạy được? |
|---|---|---|---|---|
| `development` | `npm run build:dev` | APK debug + development client | `true` | **Có** |
| `preview` | `npm run build:preview` | APK release độc lập | `false` | Không |
| `production` | `npm run build:prod` | AAB (Play chỉ nhận AAB) | `false` | Không |

### Lần đầu dùng profile nào — tuỳ ông muốn thấy gì

**Muốn XEM GIAO DIỆN (diễn đàn, hồ sơ...) khi backend chưa xong → `development`.**

```bash
npm run build:dev     # build một lần, ~10-20 phút
npx expo start        # rồi mở Metro mỗi khi muốn chạy
```

Chỉ `development` mới bật được chế độ mock. Lý do: `developmentClient: true` làm
EAS build bằng `:app:assembleDebug` (xem
https://docs.expo.dev/eas/json/), nên `__DEV__` là `true` — và `isMockMode()` yêu
cầu `__DEV__` để bản phát hành không thể đi đường vòng qua đăng nhập. `eas.json`
đã cắm sẵn `EXPO_PUBLIC_MOCK_MODE=1` cho riêng profile này.

Đánh đổi: bản `development` cần Metro đang chạy trên máy tính cùng mạng Wi-Fi mới
mở được app.

**Muốn biết app có compile và chạy độc lập được không → `preview`.**

```bash
npm run build:preview
```

Một file APK, cài là chạy, không cần Metro. Nhưng nó là bản **release** nên
`__DEV__` là `false`: chế độ mock tắt, app đi vào backend thật, và **sẽ dừng ở màn
hình đăng nhập** cho tới khi backend có `/api/auth/google/mobile` (mục 5).

Giá trị riêng của `preview`: nó vẫn trả lời được câu hỏi lớn nhất hiện nay — hai
native module (`@preeternal/react-native-cookie-manager`, google-signin) có compile
được trên New Architecture hay không.

Build chạy trên máy của EAS, khoảng 10–20 phút. Xong thì nó in một link; mở link
đó trên điện thoại rồi tải APK, hoặc quét QR. Android sẽ hỏi cho phép cài từ
nguồn ngoài — đồng ý.

`production` có `autoIncrement: true` và `eas.json` đặt `cli.appVersionSource:
"remote"`, nên `versionCode` do EAS tự tăng mỗi lần build. **Không** tự sửa
`versionCode` trong `app.json`.

---

## 5. Cái gì chạy, cái gì chưa

Đây là phần cần đọc kỹ để không nghi oan cho bản build.

### Đăng nhập: ĐANG BỊ CHẶN bởi backend

Thư viện Google Sign-In miễn phí (`@react-native-google-signin/google-signin@16.1.5`)
**không đưa được claim `nonce` vào ID token** — đã kiểm: kiểu `SignInParams` chỉ có
`loginHint`, không có `nonce` ở bất kỳ đâu trong package.

Backend hiện chỉ có `POST /api/auth/google`, và nó **so khớp claim `nonce`**. Nghĩa
là mobile gọi vào sẽ bị từ chối ở bước xác minh, không phải lỗi app.

Bản đề nghị đổi backend nằm ở
`docs/be-change-requests/2026-09-21-mobile-google-login-nonce.md` (thư mục
workspace, không commit vào repo này): thêm `POST /api/auth/google/mobile` bỏ
**đúng** bước so khớp claim nonce, giữ nguyên kiểm chữ ký / `aud` / `iss` /
`email_verified`, và **bắt buộc** thêm chốt chống replay theo `(sub, iat)` — vì
một khi đường mobile tồn tại thì kẻ tấn công nào cũng chọn được nó.

**Cho tới khi endpoint đó lên: bản build sẽ dừng ở màn đăng nhập.** Không phải app
hỏng.

### Chạy được (một khi đăng nhập thông)

- Tab **Diễn đàn**: newsfeed theo ngành, lọc theo chủ đề, tìm kiếm, cuộn tải thêm
  trang, xem chi tiết bài, cây bình luận 1 cấp với badge "AI" cho bot, thả tim
  (đổi giao diện tức thì, hoàn tác đúng khi backend từ chối), đăng bài mới,
  sửa/xoá bài của mình.
- Mất mạng: banner "Không có kết nối", dữ liệu đã tải vẫn xem được.

### Chưa làm

- **4/5 tab vẫn là placeholder**: Đặt lịch, Lịch, Trợ lý AI, Cá nhân.
- Bình luận / trả lời / báo cáo vi phạm (Task 11 của giai đoạn 2).
- Đính kèm ảnh vào bài và bình luận — chờ backend công bố luồng upload cho forum.

### Toàn bộ bằng chứng hiện có là test, không phải thiết bị

274 test xanh, typecheck sạch, không một dòng cảnh báo. Nhưng app **chưa từng chạy
trên máy thật hay giả lập lần nào**. Bản build này là lần đầu.

---

---

## 5b. Chế độ mock — xem giao diện khi backend chưa sẵn sàng

Đăng nhập thật đang bị chặn (mục 5). Chế độ mock bỏ qua chỗ đó để xem mọi màn
hình đã dựng, với dữ liệu giả.

### Bật thế nào

**Với bản `development` build từ EAS: đã bật sẵn.** `eas.json` cắm
`EXPO_PUBLIC_MOCK_MODE=1` cho riêng profile đó, không cần làm gì thêm.

**Với Metro chạy từ máy tính**, thêm vào `.env`:

```
EXPO_PUBLIC_MOCK_MODE=1
EXPO_PUBLIC_FORUM_BOT_USER_ID=bot-user-id
```

Biến thứ hai không phải tuỳ chọn cho vui: `isBotComment` **cố ý** trả `false` khi
nó rỗng (gắn nhầm badge "AI" cho một sinh viên thật là quy sai tác giả, tệ hơn
thiếu badge). Không có nó thì bình luận của bot không có badge và không có gì báo
cho ông biết vì sao.

### Khi bật, chuyện gì xảy ra

- MSW chạy **ngay trong app**, trả lời mọi `/api/*` bằng dữ liệu giả.
- Bấm "Đăng nhập với Google" **không** mở hộp thoại Google — app nhận token giả và
  vào thẳng các tab. Màn hình đăng nhập **vẫn xem được** trước đó, vì lần refresh
  đầu cố ý trả 401 như một máy chưa có phiên.
- Dòng `[mock] MSW đã bật` xuất hiện trong Metro để biết chắc nó đang chạy.
- Xem được: tab **Diễn đàn** (lướt, lọc chủ đề, tìm kiếm, mở bài, cây bình luận,
  badge "AI") và tab **Hồ sơ** (mã sinh viên, cơ sở, ngành, chuyên ngành, đăng xuất).

### Ba giới hạn, đều là chủ ý

1. **Chỉ chạy trên bản dev.** `isMockMode()` yêu cầu cả `__DEV__`, nên bản
   `preview` và `production` luôn tắt bất kể biến môi trường có giá trị gì. Đây là
   thứ duy nhất ngăn một bản lên Play Store đi kèm đường vòng qua đăng nhập, và có
   test khoá đúng điều đó (`core/config/env.test.ts`).

   Ngoài ra, MSW và toàn bộ fixture còn bị loại khỏi **bundle** của bản không bật
   mock: `metro.config.js` đổi hướng `core/dev/mockHandlers` sang bản rỗng khi
   `EXPO_PUBLIC_MOCK_MODE !== '1'`. Đo được bằng
   `npx expo export --platform android`: **4.1MB** khi tắt so với **5.0MB** khi
   bật. Mặc định là loại bỏ, nên quên đặt biến thì mất chế độ mock chứ không lỡ
   ship MSW.
2. **Mock không có trạng thái.** Thả tim, đăng bài, gửi bình luận đều phản hồi hợp
   lệ nhưng không ghi lại: kéo xuống làm mới là mọi thứ về như cũ. Đủ để xem giao
   diện phản ứng, không phải một backend thu nhỏ.
3. **Endpoint chưa mock được cho đi thật** (`onUnhandledRequest: 'bypass'`), nên
   màn hình chưa mock hiện lỗi mạng chứ không làm app chết. Ba tab Đặt lịch, Lịch,
   Trợ lý AI vẫn là placeholder nên chưa gọi gì.

Ảnh trong bài viết trỏ `picsum.photos` nên cần mạng mới hiện; không có mạng thì ô
ảnh trống, phần còn lại vẫn chạy.

## 6. Còn lại gì để lên Google Play

Chưa có gì trong danh sách này.

**Kỹ thuật**
- [ ] `eas init` (chưa có `extra.eas.projectId`)
- [ ] Keystore phát hành + bản lưu cất an toàn
- [ ] Android OAuth client (package + SHA-1)
- [ ] Một bản `production` build ra AAB thành công
- [ ] Đã chạy thử trên máy thật, đăng nhập được đầu–cuối

**Hồ sơ Play Console**
- [ ] Tài khoản Google Play Developer (phí một lần 25 USD)
- [ ] **Privacy policy URL** — bắt buộc, phải là URL sống. App đăng nhập Google và
      thu thập email/tên nên không được bỏ qua.
- [ ] **Data safety form** — khai app thu gì, gửi đi đâu, có mã hoá khi truyền
      không. Khai sai là lý do bị từ chối phổ biến nhất.
- [ ] **Content rating** (bộ câu hỏi IARC). Có diễn đàn người dùng tự đăng nội
      dung → phải khai có nội dung do người dùng tạo, và nêu cơ chế báo cáo/kiểm
      duyệt. Backend đã có kiểm duyệt từ ngữ (`FORUM_4201`) và luồng báo cáo —
      nêu đúng hai thứ đó.
- [ ] Store listing: tên, mô tả ngắn + dài, ít nhất 2 ảnh chụp màn hình điện
      thoại, icon 512×512, feature graphic 1024×500
- [ ] Nhãn target audience (app cho sinh viên FPT → không phải app cho trẻ em)

**Đánh giá thẳng:** với 4/5 tab còn trống, tôi không nghĩ nên nộp bản public ngay.
Đường hợp lý là dùng **internal testing track** của Play (`eas.json` đã đặt
`submit.production.android.track: "internal"` và `releaseStatus: "draft"`) để
người thật cài thử, rồi mở rộng dần khi các tab kia xong.

---

## 7. Khi build hỏng

Thứ tự việc cần làm:

1. `npx expo-doctor` — phải ra `21/21 checks passed`. Lệch phiên bản package là
   nguyên nhân hàng đầu làm build hỏng một cách khó hiểu; `npx expo install --fix`
   chỉnh lại.
2. `npx expo prebuild --platform android --no-install` — nếu lỗi ở đây thì vấn đề
   ở config plugin / `app.json`, chưa tới Gradle. Xong thì **xoá thư mục `android/`**
   (`rm -rf android`): để nó lại thì mọi thay đổi `app.json` sau này âm thầm không
   có tác dụng, đây là cái bẫy kinh điển của Continuous Native Generation.
3. Đọc log Gradle trên trang build của EAS. Lỗi ở hai native module sẽ hiện ra ở
   bước `:app:compileReleaseKotlin` hoặc bước codegen.

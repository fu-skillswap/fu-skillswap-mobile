# Runbook: dựng giả lập Android để chạy thử app

Dành cho máy **Windows không có thiết bị Android thật**. Mục tiêu: cài được bản
`development` build lên giả lập, đăng nhập Google **thật**, và kiểm phiên sống qua
lần tắt app.

Máy đã kiểm (2026-10-02): RAM 15.8 GB, hypervisor đang chạy → giả lập sẽ được tăng
tốc bằng WHPX. App cần tối thiểu **API 24**; `targetSdk` là 36.

---

## 0. Đọc trước: một chi tiết quyết định thành bại

**Phải chọn system image có "Google Play" (hoặc tối thiểu "Google APIs").**

Ảnh AOSP trơn **không có Google Play Services**, và Google Sign-In cần nó. Chọn
nhầm thì app cài được, mở được, nhưng bấm đăng nhập sẽ hỏng — và thông báo lỗi
không nói gì về nguyên nhân thật. Đây là chỗ dễ mất nửa buổi nhất.

Trong Device Manager, cột **Services** của mỗi ảnh ghi rõ: `Google Play`,
`Google APIs`, hay `Android Open Source`. Chọn một trong hai cái đầu.

---

## 1. Cài Android Studio

Tải tại https://developer.android.com/studio

Trong trình cài đặt, chọn **"Android Studio and Android Virtual Device"**, rồi
kiểu cài **Standard**.

**Không cần động tới Java 8 đang có trên máy.** Android Studio mang theo JDK riêng
và dùng nó, nên `java -version` của ông vẫn là 8 mà mọi thứ vẫn chạy.

## 2. Cài đúng thành phần SDK

Android Studio → **Settings → Languages & Frameworks → Android SDK**

- Tab **SDK Platforms**: tick **Android SDK Platform 36**.
- Tab **SDK Tools**: đảm bảo có **Android SDK Build-Tools**, **Android Emulator**,
  và **Android SDK Platform-Tools** (cái cuối chứa `adb`).

## 3. Đặt biến môi trường

Control Panel → User Accounts → **Change my environment variables**:

| Biến | Giá trị |
|---|---|
| `ANDROID_HOME` | `%LOCALAPPDATA%\Android\Sdk` |
| `PATH` | thêm `%LOCALAPPDATA%\Android\Sdk\platform-tools` |

Mở **terminal mới** rồi kiểm:

```
adb --version
```

Bước này cũng chữa luôn lỗi `adb executable doesn't seem to work` mà `eas build`
báo ở cuối lần build trước — lần sau nó sẽ tự cài APK lên giả lập đang mở.

## 4. Tạo máy ảo

1. Màn hình chính Android Studio → **More Actions → Virtual Device Manager**
2. **Create virtual device**
3. Phần cứng: một máy **Pixel** bất kỳ (Pixel 7 / Pixel 8 đều ổn)
4. System image: chọn bản có **Google Play** ở cột Services (xem mục 0). API 36 cho
   khớp `targetSdk`; API 34/35 cũng chạy được vì app chỉ cần ≥ 24.
5. Tải ảnh nếu chưa có, rồi **Finish**
6. Bấm **▶** để khởi động

Cấp cho máy ảo khoảng **2–4 GB RAM** trong phần Advanced Settings. Máy ông có 15.8
GB nên thoải mái, nhưng đừng cấp quá nửa.

---

## 5. Cài app lên giả lập

Giả lập phải đang chạy. Có hai cách, cách nào cũng được:

**Kéo thả:** kéo file `.apk` thả vào cửa sổ giả lập.

**Dòng lệnh:**
```
adb install duong-dan-toi-file.apk
```

Lấy file APK ở đâu: chạy `eas build:list --platform android --limit 1` để có link
trang build, vào đó tải về. (Lần build trước eas-cli đã tải rồi nhưng dọn đi sau
khi `adb` hỏng.)

## 6. Nối Metro

Đây là bản **development**, nó cần Metro đang chạy:

```
npx expo start
```

Rồi bấm phím **`a`** trong terminal — Expo tự mở app trên giả lập đang chạy. Nếu
không được, mở app bằng tay rồi nhập `exp://10.0.2.2:8081` (từ bên trong giả lập,
`10.0.2.2` chính là máy tính của ông).

Backend là `https://api.skillswap.asia` — địa chỉ công khai, nên không cần ánh xạ
cổng gì thêm.

---

## 7. Thử theo đúng thứ tự này

Mỗi bước cho một thông tin khác nhau, và bước sau chỉ có nghĩa khi bước trước đạt.

| | Thử gì | Hỏng thì nghĩa là |
|---|---|---|
| 1 | Mở app, **thấy màn hình đăng nhập** | Màn trắng hoặc crash: `getEnv()` ném — biến môi trường không tới được runtime |
| 2 | Bấm "Đăng nhập với Google", hộp thoại Google mở ra | `DEVELOPER_ERROR`: Android OAuth client chưa đăng ký đúng package + SHA-1 (xem mục 8) |
| 3 | Chọn tài khoản → vào được tab bar | `OAUTH_VERIFICATION_FAILED`: client ID của app lệch `GOOGLE_CLIENT_ID` của backend |
| 4 | Mở tab Diễn đàn và Hồ sơ, có dữ liệu thật | Trống hoặc lỗi: backend chưa chạy migration V137–V140, hoặc chưa có dữ liệu |
| 5 | **Tắt hẳn app rồi mở lại** | Vào thẳng tab bar = SecureStore ghi được, R2 đạt. Quay về màn đăng nhập = SecureStore **không** ghi được |

**Bước 5 là bước quan trọng nhất.** Toàn bộ tầng phiên mới (tự lưu refresh token)
mới chỉ chạy trên một keystore giả trong RAM; EncryptedSharedPreferences thật chưa
bao giờ được chạm tới. Và nếu `luuRefreshToken()` thất bại, nó **thất bại trong im
lặng** theo đúng thiết kế — chỉ bước này mới lộ ra.

## 8. Một cái bẫy về chữ ký

APK từ EAS được ký bằng **keystore do EAS giữ**. Android OAuth client phải đăng ký
đúng SHA-1 của keystore đó — lấy bằng `eas credentials`.

Nếu sau này ông chạy `npx expo run:android` để build cục bộ, nó dùng **debug
keystore** của máy, có SHA-1 **khác**, và Google Sign-In sẽ trả `DEVELOPER_ERROR`
dù mọi thứ khác đúng. Khi đó phải đăng ký thêm SHA-1 thứ hai vào cùng OAuth client.

## 9. Nếu chỉ muốn xem giao diện, không cần đăng nhập

Không cần giả lập:

```
npx expo start --web
```

Chế độ mock bỏ qua đăng nhập, dữ liệu giả. Nhưng react-native-web dựng lại bố cục
bằng CSS nên **không giống điện thoại**: bàn phím che ô nhập, SafeArea,
`KeyboardAvoidingView` đều không kiểm được ở đó. Và `expo-secure-store` không có
bản web nên phiên không sống qua lần tải lại trang.

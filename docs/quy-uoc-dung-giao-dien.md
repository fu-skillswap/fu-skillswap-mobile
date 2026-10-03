# Quy ước dựng giao diện theo `mobile-design-handoff/`

Tài liệu này dành cho **mọi người (và mọi agent) dựng một màn hình**. Đọc hết
trước khi viết dòng code đầu tiên của màn đó.

Nguồn sự thật, theo thứ tự ưu tiên khi mâu thuẫn:

1. **Ràng buộc sản phẩm ở mục 4 dưới đây** — thiết kế vẽ từ bản web, có chỗ
   mobile không được phép làm.
2. **Source Java của backend** (`D:\Skillswap\fu-skillswap-be`) — hình dạng DTO,
   mã lỗi, phân quyền.
3. **File `mobile-design-handoff/screens/<Màn>.dc.html`** — bố cục, số đo, màu,
   chữ hiển thị.
4. `mobile-design-handoff/HANDOFF.md` — cách đọc file thiết kế, bảng asset,
   bảng màn hình.

---

## 1. Việc đã làm sẵn, đừng làm lại

- **Design token**: `tailwind.config.js` + `core/ui/theme.ts`, tên class giữ
  đúng tên token trong thiết kế (`ink`, `ink-body`, `ink-muted`, `line`,
  `surface-page`, `surface-tint`, `accent`, `brand-deep`…).
  `core/ui/theme.test.ts` canh bất biến: **mọi token trong `theme.ts` phải được
  nối sang `tailwind.config.js`**, thêm token mà quên nối là test đỏ.
- **Font Montserrat**: đã nạp đủ 5 nét trong `app/_layout.tsx`.
  **Dùng `fonts.bold`/`fonts.semibold` của `core/ui/theme.ts`, hoặc class
  `font-bold`/`font-semibold`. KHÔNG dùng `fontWeight`** — trên Android với font
  tuỳ biến, `fontWeight` không có tác dụng và chữ lặng lẽ rơi về nét thường.
- **Bóng đổ**: `shadows.card` / `shadows.button` trong `theme.ts` đã dịch chuỗi
  CSS sang prop React Native. Đừng tự viết lại.
- **Component dùng chung**: `core/ui/`. Xem mục 5 của `HANDOFF.md`. Thiếu cái gì
  thì **bổ sung vào `core/ui/` kèm test**, đừng dựng bản riêng trong feature.

## 2. Đọc file `.dc.html` thế nào

Xem mục 1 của `HANDOFF.md`. Tóm tắt phần hay nhầm:

- `style="..."` inline là **giá trị chuẩn** — lấy đúng px, màu, radius từ đó.
- Bỏ qua `<x-dc>`, `<helmet>`, `<script src="./support.js">`.
- Tên người, giá tiền, số dư, mã môn trong thiết kế là **dữ liệu mẫu**. Trong
  app lấy từ API. Chữ trong `[NGOẶC VUÔNG]` là chỗ trống chờ dữ liệu thật.
- `href="Xyz.dc.html"` là điều hướng sang màn `Xyz`.
- `onClick` + `this.setState` là tương tác mẫu — chuyển thành state thật.

Khung thiết kế là 390×844. **Đừng hard-code chiều rộng 390.** Dùng layout co
giãn; các số đo trong thiết kế là padding/gap/chiều cao, không phải toạ độ.

## 3. Cấu trúc điều hướng

Thiết kế có **hai thanh tab khác nhau** tuỳ vai trò. `core/config/tabs.ts` là
chỗ duy nhất khai bảng tab, và đã có sẵn `resolveRoleModes()` cho tài khoản vừa
là MENTEE vừa là MENTOR.

**Mentee** — Bảng tin · Mentor · Lịch hẹn · Tin nhắn · Hồ sơ
**Mentor** — Tổng quan · Booking · Lịch dạy · Ví · Thêm

Màn **không** nằm trên thanh tab (KokoChat, MentorDetail, Booking,
BookingConfirm, ChatDetail, Notifications, Onboarding, MentorRegistration,
MentorServiceDetail, MentorBookingDetail) là route riêng ngoài `(tabs)`.

**Mọi nhánh route mới ngoài `(tabs)` phải có gate đăng nhập ở `_layout` của
nhánh đó.** Gate ở từng màn KHÔNG đủ: `Redirect` của expo-router gọi
`router.replace()` bên trong `useFocusEffect`, nên chỉ chạy khi màn đang focus.
Xem `app/forum/_layout.tsx` làm mẫu.

**Rời màn hình phải qua `router.canGoBack() ? back() : replace('/(tabs)')`** —
deep link làm stack rỗng và `back()` thành no-op.

## 4. Ràng buộc sản phẩm — thiết kế vẽ từ web, mobile không làm hết được

### 4.1 Ví S-coins: chỉ xem và tiêu, KHÔNG nạp

Quyết định của chủ sản phẩm (04/10/2026) và cũng là ràng buộc của Google Play:
bản mobile là **consumption-only**.

- **Bỏ** mọi nút nạp tiền / "Thêm S-coins" / lối vào PayOS trong mọi màn, kể cả
  `MentorWallet.dc.html` và `BookingConfirm.dc.html`.
- **Giữ** số dư, lịch sử giao dịch, và việc **tiêu** số dư sẵn có để đặt lịch.
- Nạp tiền diễn ra trên web. Khi màn hình cần nói điều đó, nói thẳng và ngắn.
- Backend đã cưỡng chế: `GET /api/public/app-config?platform=android` trả
  `topupEnabled: false`, `directPaymentEnabled: false`; `PaymentController` ném
  403 `PAY_4031` khi thấy header `X-Client-Platform: android`.
- **TUYỆT ĐỐI không gỡ header `X-Client-Platform`** để đi vòng. Đó chính là thứ
  làm app bị gỡ khỏi Play.
- Rút tiền của mentor (payout) là luồng **khác** nạp tiền, không nằm trong lệnh
  cấm này — nhưng hỏi chủ sản phẩm trước khi cho rút ngay trong app.

### 4.2 Dữ liệu phải thật

Thiết kế có tên người, giá, điểm đánh giá bịa. **Không hard-code chúng vào màn
hình.** Màn nào chưa có API thì nói ra, đừng bịa dữ liệu rồi để đó.

## 5. Luật về DTO — chỗ repo này sai nhiều nhất

Plan giai đoạn 3 có **13 lỗi DTO** vì viết theo trí nhớ. Trước khi khai một
kiểu, **mở file Java tương ứng** trong `fu-skillswap-be` và đọc.

Hai cái bẫy đã gặp thật:

- **`@JsonIgnore`**: `MentorDiscoveryCardResponse.java` đánh `@JsonIgnore` lên
  `mentorUserId`, `displayName`, `ratingState`, `ratingAverage`,
  `completedSessions`, `matchScore` — chúng **không có trong JSON**. Chỉ đọc
  được qua section lồng (`identity.mentorUserId`, `reputation.ratingState`,
  `match.score`). Đọc trượt sẽ ra `undefined` mà **không có lỗi kiểu nào chặn**.
- **Nguyên thuỷ vs đóng hộp**: `boolean` trong Java là không-null, `Boolean` là
  có thể null. Card và detail của mentor khác nhau đúng ở chỗ này.

**Mốc thời gian**: gần như mọi trường thời gian của BE là `LocalDateTime`, lên
dây **không có offset** (`"2026-06-22T21:20:25"`). `new Date()` của JS đọc chuỗi
đó là **giờ địa phương của máy** — đúng trên điện thoại UTC+7 một cách tình cờ,
sai ở mọi múi khác. DTO nào có cả trường `Instant` song song (ví dụ
`ServiceSlotCandidateItemResponse.startAt`) thì dùng trường `Instant`.

## 6. Luật kỹ thuật của repo

- TypeScript `strict`. `any` chỉ được phép ở hai chỗ đã có
  (`core/api/client.ts`, `app/(tabs)/_layout.tsx`). **Không thêm chỗ thứ ba.**
- JSDoc, chú thích, chuỗi hiển thị, tên test: **tiếng Việt có dấu**.
- Commit message: Conventional Commits, tiếng Việt **không dấu**.
- `core/` **không** import từ `features/` hay `app/`. Ngoại lệ duy nhất:
  `core/dev/mockHandlers.ts`.
- **Không đặt file test trong `app/`** — `__tests__/app-route-tree.test.ts` bắt.
- **`render`, `renderHook`, `fireEvent`, `unmount` của RNTL 14 đều ASYNC — phải
  `await` từng lời gọi.** Không await thì act scope rò ra và test **KẾ TIẾP**
  không bao giờ render xong.
- **Một `QueryClient` mỗi test**, dựng trong `beforeEach`.
- **Mọi mutation đặt `networkMode: 'always'`.**
- Dùng **`trangThaiTai()`** của `core/api/queryState.ts` để quy cờ TanStack
  thành một trạng thái. `isError` KHÔNG nghĩa là "không có gì để hiện";
  `isLoading` KHÔNG bật khi mất mạng.
- Chốt chặn `fetchNextPage` nằm **trong hook**, không ở màn hình — xem
  `useChotChanTrangKe` trong `features/mentor/hooks/useMentorQueries.ts`.
- Test màn hình có `FlatList` gọi `await donHangDoiDanhSach()` ở **cuối** thân
  test; test có ô tìm kiếm debounce gọi `await nhuongChoDebounce(delay)` sau lần
  gõ cuối. Cả hai ở `@/test-utils/nhuongNhip` — **đừng chép lại**.
- **Đừng truyền handler rỗng chỉ để nút hiện ra.** Nút chưa nối được việc gì thì
  đừng dựng. Repo này đã phải phá bỏ hai nút chết.

## 7. Chế độ mock

Mỗi màn mới cần handler MSW để xem được khi chưa có backend.

- Dùng **`jsonMock()`** của `core/dev/jsonMock.ts`, **không** dùng
  `HttpResponse.json()` — MSW đọc thân phản hồi qua `response.body.getReader()`,
  mà `Response` của React Native không có `.body`, nên thân sẽ **rỗng mà không
  báo lỗi gì**.
- Fixture phải giữ **đúng hình dạng DTO thật**, kể cả định dạng thời gian không
  offset. Test của fixture phải cho **repo thật** đọc nó, chứ không assert vào
  chính fixture.
- Nối handler mới vào `core/dev/mockHandlers.ts`.

## 8. Xong một màn thì kiểm gì

```
npm test        # đọc kết quả rồi mới commit, đừng chain &&
npm run typecheck
```

- Chạy `npm test 2>&1 | grep -c "console."` **ít nhất 10 lần**, mọi lần ra `0`.
  Một lần sạch không chứng minh gì — nhánh này từng có flake 6%.
- Với mỗi dòng trong bảng phép phá của màn: **thực sự phá code, chạy, dán output
  chứng minh ĐỎ, rồi hoàn nguyên**. Dòng nào vẫn xanh thì nói thẳng, **đừng sửa
  bảng cho khớp**.

# SkillSwap Mobile — Design handoff

Bộ thiết kế mobile app SkillSwap (Mentee + Mentor, không có Admin), 25 màn hình, khung 390×844.
Bản sống trên canvas: https://claude.ai/artifact/H1kTLGm6qDZpJPD8CCcEzi (chủ sở hữu mở được; nếu session của bạn có công cụ Artifact thì `read` link này để lấy bản mới nhất — file trong thư mục này là bản chụp ngày 04/10/2026).

Mục tiêu khi dùng thư mục này: **sửa giao diện app mobile cho khớp thiết kế, giữ nguyên logic, API và state hiện có.**

---

## 1. Cách đọc file `.dc.html`

Mỗi file `screens/*.dc.html` là một màn hình, viết bằng HTML + style inline. Bỏ qua phần vỏ của trình thiết kế:

| Thấy gì | Nghĩa là |
|---|---|
| `<script src="./support.js">`, `<x-dc>`, `<helmet>` | Vỏ của công cụ thiết kế — bỏ qua |
| `style="…"` inline | Giá trị thiết kế chính xác (px, màu, radius) — dùng làm chuẩn |
| `{{ten}}` | Giá trị động, được tính trong `renderVals()` ở thẻ `<script type="text/x-dc">` cuối file |
| `<sc-for list="{{items}}" as="x">` | Vòng lặp (map) |
| `<sc-if value="{{cond}}">` | Render có điều kiện |
| `onClick="{{fn}}"` + `this.setState` | Tương tác mẫu (chọn tab, chip, slot…) — chuyển thành state thật trong app |
| `href="Xyz.dc.html"` | Điều hướng sang màn hình `Xyz` (xem bảng ở mục 4) |
| `src="/_blob/…"` | Ảnh — tra bảng asset ở mục 3 |
| Chữ trong `[NGOẶC VUÔNG]` | Chỗ trống chờ dữ liệu thật |

Tên người, giá, số dư, mã môn là **dữ liệu mẫu** — trong app lấy từ API.

## 2. Design tokens (theo design system SkillSwap)

File đầy đủ: `tokens.json`. Tóm tắt dùng nhiều nhất:

- **Font**: Montserrat 400/500/600/700/800 (Google Fonts). Không dùng Inter/Roboto/Plus Jakarta cho app.
- **Màu**
  - `surface-page` #F4F7FD (nền màn hình) · `surface` #FFFFFF (card) · `surface-tint` #EBF3FF (nền nhấn, nút phụ)
  - `ink` #0F2D6B (tiêu đề) · `ink-body` #3D4F75 (nội dung) · `ink-muted` #5A6A8C (chú thích)
  - `line` #DCE6FA (viền 1px, divider)
  - `accent / primary-blue` #2F6BFF · `navy / brand-deep` #0F2D6B (khối tối: thẻ Koko, ví)
  - `sky-blue` #56D1FF (eyebrow trên nền navy) · chữ phụ trên navy #B8C7E6
  - Trạng thái: success #22C55E / ink #15803D / soft #DCFCE7 · warning #F59E0B / ink #B45309 / soft #FEF3C7 · neutral soft #EEF2FA · danger text #B42318
- **Gradient nút chính**: `linear-gradient(135deg, #1A47D6 0%, #2F6BFF 100%)`, bóng `0 8px 20px rgba(47,107,255,0.30)`
- **Bóng card**: `0 8px 32px rgba(15,45,107,0.06)` (chỉ một kiểu bóng mỗi màn hình)
- **Radius**: card 24 · card nhỏ / ô icon 16–20 · input 12 · nút, chip, badge, avatar: full (pill)
- **Khoảng cách**: lề màn hình 20 · gap giữa khối 14–20 · padding card 16
- **Cỡ chữ**: tiêu đề màn hình 26/700 (màn tab) hoặc 18/700 (màn con có nút back) · tiêu đề section 16–18/700 · body 14–15 · caption 12–13 · tab label 11
- **Vùng chạm** tối thiểu 44×44. Nút chính cao 52–56.
- **Icon**: Lucide, nét 2px, bo đầu nét, 20–24px (code web đã có `lucide-react`; trên RN dùng `lucide-react-native`).

## 3. Asset

| Trong thiết kế | File | Có sẵn trong repo web |
|---|---|---|
| `/_blob/06de8bb72ea17ab76437267c6498c7ed` | koko.png (tư thế chuẩn) | `public/images/Koko.png` |
| `/_blob/1aa01e4f64b8f757a72fc3263f1cc0fd` | koko-happy.png | lấy từ design system SkillSwap |
| `/_blob/b44554af311f956d8e3c3214653e0b69` | koko-laptop.png | lấy từ design system SkillSwap |
| `/_blob/2fb2a1e7e18e8aefff5c769076724f95` | koko-reading.png | lấy từ design system SkillSwap |
| `/_blob/34398f09275ab110d3d7e99a8506d468` | skillswap-logo-full.png | `public/images/SkillSwap_Logo_Text.png` |
| `/_blob/610651dbf1b05101b10b59dd8078648d` | skillswap-mark.png | `public/images/SkillSwapLogo.png` |

Design system: https://claude.ai/artifact/JdRibYbgqWBM1rbimeRXeR (nhóm Mascot, Logos).

## 4. Danh sách màn hình

### Mentee — thanh tab: Bảng tin · Mentor · Lịch hẹn · Tin nhắn · Hồ sơ

| File | Màn hình | Route web tương ứng |
|---|---|---|
| Welcome | Chào mừng / đăng nhập Google | `/login` |
| Onboarding | Hoàn thiện hồ sơ sinh viên | `/onboarding/student-profile` |
| Main | Bảng tin (tab 1) | `/dashboard` |
| PostDetail | Chi tiết bài viết + bình luận | `/post-detail/[id]` |
| Notifications | Thông báo | `NotificationMenu` |
| Mentors | Tìm Mentor, lọc lĩnh vực (tab 2) | `/mentor-booking` |
| MentorDetail | Hồ sơ mentor + dịch vụ | `MentorDetail` |
| Booking | Chọn ngày, khung giờ (bước 2/3) | `BookingFlow` |
| BookingConfirm | Xác nhận, mục tiêu, thanh toán S-coins (bước 3/3) | `BookingFlow` + `BookingGoalModal` |
| MyBookings | Lịch hẹn theo trạng thái (tab 3) | `/my-bookings` |
| Messages | Danh sách hội thoại (tab 4) | `/messages` (ConversationSidebar) |
| ChatDetail | Chat 1:1 | `/messages` (ChatPanel) |
| KokoChat | Trợ lý AI Koko | `KouKouChatPanel` |
| Profile | Hồ sơ, ví, menu (tab 5) | `/profile` |
| MentorRegistration | Đăng ký Mentor, 6 bước | `/mentor-registration` |

### Mentor — thanh tab: Tổng quan · Booking · Lịch dạy · Ví · Thêm

| File | Màn hình | Route web tương ứng |
|---|---|---|
| MentorDashboard | Tổng quan, chỉ số, biểu đồ 7 ngày | `/mentor/dashboard` |
| MentorBookings | Lịch đặt theo trạng thái | `/mentor/bookings` |
| MentorBookingDetail | Chi tiết, chọn nền tảng, xác nhận/từ chối | `/mentor/bookings` (modal chi tiết) |
| MentorSchedule | Lịch dạy theo ngày + Google Calendar | `/mentor/schedule-manage` |
| MentorServices | Danh sách dịch vụ, bật/tắt | `/mentor/schedule-manage` (dịch vụ) |
| MentorServiceDetail | Sửa dịch vụ, giá, duy trì chat | `/mentor/services/[serviceId]` |
| MentorWallet | Ví S-coins, giao dịch, yêu cầu rút | `/mentor/wallet` |
| MentorPosts | Bài viết + bottom sheet tạo bài | `/mentor/posts` |
| MentorCourses | Khóa học (trạng thái trống) | `/mentor/my-courses` |
| MentorMore | Menu: dịch vụ, khóa học, bài viết, chuyển sang Mentee | — |

Nhãn trạng thái booking giữ đúng như web: Đang chờ · Đang diễn ra · Đã hoàn thành · Vắng mặt · Bị từ chối · Quá hạn · Mentee hủy · Mentor hủy.

## 5. Component dùng chung nên tách

TabBar (5 mục, cao 84, mục active #2F6BFF/700) · ScreenHeader (nút back tròn 44 + tiêu đề) · PrimaryButton (gradient, pill) · SecondaryButton (nền #EBF3FF, chữ accent) · Card · Chip/FilterTabs (chọn: nền accent chữ trắng) · StatusBadge · Avatar chữ cái đầu · SegmentedControl (nền #EBF3FF, mục chọn nền trắng) · Switch (52×30) · ListRow (cao 56) · TextField (cao 48, radius 12) · BottomBar cố định (nút chính + nút phụ) · EmptyState có Koko.

---

## 6. Prompt mẫu để dán vào session mới

> Mình đính kèm thư mục `mobile-design-handoff/`. Đọc `HANDOFF.md` trước. Sau đó xem code app mobile hiện tại của mình và sửa giao diện cho khớp thiết kế trong `screens/*.dc.html` + `tokens.json`.
> Quy tắc: giữ nguyên logic, API, state, điều hướng hiện có; chỉ thay UI. Làm theo thứ tự: (1) đưa tokens vào theme, (2) dựng các component dùng chung ở mục 5, (3) sửa từng màn hình theo bảng mục 4, mỗi lần một màn. Màn nào app chưa có thì liệt kê ra và hỏi mình trước khi tạo. Dữ liệu mẫu trong thiết kế phải thay bằng dữ liệu thật từ API.

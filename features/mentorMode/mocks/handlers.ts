/**
 * @file handlers.ts
 * @description Handler MSW cho hai endpoint của chế độ Mentor, dùng trong CHẾ ĐỘ
 * MOCK của app.
 *
 * Đây KHÔNG phải handler của test — lý do tách hai thứ ghi đầy đủ ở
 * `core/auth/mocks/handlers.ts`. Handler ở đây mô tả "một thế giới hợp lý để xem
 * giao diện"; handler trong từng file test mô tả "đúng một tình huống đang kiểm".
 * Hình dạng DTO thì dùng chung một xưởng (`mentorModeFixture.ts`).
 *
 * ## Hồ sơ mock gắn đúng người dùng mock
 *
 * `userId` và `displayName` lấy từ `MOCK_USER` của `core/auth/mocks`. Lệch id thì
 * màn `MentorMore` sẽ dẫn "Xem hồ sơ công khai" sang một mentor khác, và trong
 * chế độ mock thì không có gì báo cho biết.
 *
 * ## `mentorStatus = ACTIVE` có chủ ý
 *
 * Chỉ `ACTIVE` mới làm lối "Xem hồ sơ công khai" hiện ra
 * (`MentorDiscoveryService.isDiscoverableMentor()`), nên một fixture ở trạng thái
 * khác sẽ làm nhánh đó không xem được trên máy bao giờ. Trạng thái khác thì đổi
 * tại chỗ khi cần kiểm — xem `taoHoSoMentorRong()` cho trường hợp
 * `exists: false`.
 *
 * ## Mốc thời gian theo HAI khuôn
 *
 * Hồ sơ dùng `LocalDateTime` (không offset), còn giao dịch ví dùng
 * `OffsetDateTime` (có `+07:00`). Xưởng fixture đã viết đúng; đừng "chuẩn hoá"
 * chúng về một khuôn ở đây.
 */

import { http } from 'msw';

import { MOCK_USER } from '@/core/auth/mocks/handlers';
import { getEnv } from '@/core/config/env';
import { jsonMock } from '@/core/dev/jsonMock';
import { taoHoSoMentor, taoViMentor } from '@/features/mentorMode/mocks/mentorModeFixture';
import { studioMockHandlers } from '@/features/mentorMode/mocks/studioMock';
import type { MentorProfileResponse, MentorWalletResponse } from '@/features/mentorMode/types';

const base = getEnv().apiUrl;

/** Bọc dữ liệu vào envelope `ApiResponse<T>` đúng như backend trả về */
function envelope(data: unknown) {
  return {
    timestamp: new Date().toISOString(),
    status: 200,
    code: 'SUCCESS_0200',
    message: 'Thành công',
    data,
  };
}

/** Hồ sơ mentor giả, gắn với đúng người dùng mock của `core/auth/mocks` */
export const MOCK_MENTOR_PROFILE: MentorProfileResponse = taoHoSoMentor({
  userId: MOCK_USER.publicId,
  email: MOCK_USER.email,
  displayName: MOCK_USER.fullName,
});

/** Ví settlement giả */
export const MOCK_MENTOR_WALLET: MentorWalletResponse = taoViMentor();

export const mentorModeMockHandlers = [
  http.get(`${base}/api/me/mentor-profile`, () => jsonMock(envelope(MOCK_MENTOR_PROFILE))),
  http.get(`${base}/api/me/mentor-wallet`, () => jsonMock(envelope(MOCK_MENTOR_WALLET))),
  ...studioMockHandlers,
];
